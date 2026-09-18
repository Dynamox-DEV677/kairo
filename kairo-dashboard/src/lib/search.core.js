/**
 * The search engine. Kyno's own, on the device, no model and no network.
 *
 * This is the thing that lets a student point Kyno at their own textbook. They
 * upload a chapter, it gets split into passages and indexed here, and a
 * question finds the passage that answers it -- instantly, offline, and
 * without a single word of their book leaving the phone.
 *
 * It is BM25, the ranking function search engines used before neural
 * retrieval. That is not a downgrade for this job:
 *
 *   - It cannot hallucinate. It returns a passage that exists in the book or
 *     it returns nothing. For an app used by minors revising for exams, an
 *     answer that is merely PLAUSIBLE is worse than no answer.
 *   - It runs in milliseconds on a cheap phone, with no signal.
 *   - It is deterministic, so a test can pin its behaviour.
 *   - Nothing about it can be retired by a provider on a Tuesday, which is
 *     exactly how every AI feature in this app died for a month.
 *
 * Why BM25 rather than counting matching words: term frequency saturates (the
 * tenth "photosynthesis" in a passage adds almost nothing over the third) and
 * long passages are penalised, so a rambling page cannot outrank the tight
 * paragraph that actually answers the question.
 */

/* ── tokenising ───────────────────────────────────────────────────────────── */

/**
 * Words that carry no signal. Kept deliberately SHORT.
 *
 * A big stop-list is a liability in a physics textbook: "work", "power",
 * "force", "state", "matter" and "light" are all ordinary English words and
 * all exam topics. Only words that can never be a search intent are removed.
 */
const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'than', 'that', 'this',
  'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'do', 'does', 'did', 'have', 'has', 'had', 'of', 'to', 'in', 'on', 'at',
  'by', 'for', 'with', 'from', 'as', 'it', 'its', 'we', 'you', 'they', 'i',
  'he', 'she', 'his', 'her', 'their', 'our', 'your', 'my', 'me', 'them', 'us',
  'so', 'such', 'can', 'will', 'would', 'should', 'could', 'may', 'might',
  'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
])

/**
 * Crude suffix stripping, on purpose.
 *
 * A real stemmer (Porter) would be more correct and would also turn "gases"
 * into "gase" and "physics" into "physic", which then fail to match what a
 * student typed. This handles the plural and tense endings that actually cost
 * matches in a textbook, and leaves everything else alone.
 *
 * Short words are never stemmed: "gas" must not become "ga".
 */
export function stem(word) {
  let w = word
  if (w.length > 5 && w.endsWith('ies')) return w.slice(0, -3) + 'y'   // bodies -> body
  if (w.length > 4 && (w.endsWith('sses') || w.endsWith('shes') || w.endsWith('ches'))) return w.slice(0, -2)
  if (w.length > 4 && w.endsWith('ing')) return w.slice(0, -3)
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) return w.slice(0, -1)
  return w
}

/**
 * Text -> searchable terms.
 *
 * Digits are KEPT. "Class 10", "Chapter 6", "class 9 chapter 12" are real
 * queries, and a student searching "10th" should find it.
 */
export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    // Single LETTERS are noise; single DIGITS are not. Dropping everything
    // under two characters lost the 6 in "chapter 6" and the 9 in "class 9",
    // which are among the most literal queries a student types.
    .filter(t => t && (t.length > 1 || /[0-9]/.test(t)) && !STOP.has(t))
    .map(stem)
}

/* ── chunking ─────────────────────────────────────────────────────────────── */

/**
 * A book split into the unit a student should be shown.
 *
 * Not the whole chapter (too long to read as an answer) and not a sentence
 * (too short to make sense out of context). Paragraphs, with short ones glued
 * to their neighbour so a heading is never returned on its own.
 */
export function chunk(text, { min = 220, max = 1100 } = {}) {
  const paras = String(text || '')
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const out = []
  let buf = ''
  for (const p of paras) {
    // A long paragraph stands alone; flush whatever was accumulating first.
    if (p.length >= max) {
      if (buf) { out.push(buf); buf = '' }
      out.push(p)
      continue
    }
    buf = buf ? `${buf} ${p}` : p
    if (buf.length >= min) { out.push(buf); buf = '' }
  }
  if (buf) {
    // Don't emit a stray fragment: fold it into the previous chunk instead.
    if (out.length && buf.length < min) out[out.length - 1] += ` ${buf}`
    else out.push(buf)
  }
  return out
}

/* ── the index ────────────────────────────────────────────────────────────── */

/**
 * Build an inverted index over passages.
 *
 * `docs` is [{ id, text, ...meta }]. Everything else on a doc is carried
 * through untouched, so a caller can hang a chapter name, a page number or a
 * source file on it and get it back in the results.
 *
 * The returned object is plain JSON: it can be stringified into IndexedDB and
 * reloaded without rebuilding, which matters because indexing a whole textbook
 * on a cheap phone is something you want to do once.
 */
export function buildIndex(docs = []) {
  const postings = Object.create(null)   // term -> { [docIdx]: count }
  const lengths = []
  const meta = []

  docs.forEach((doc, i) => {
    const terms = tokenize(doc.text)
    lengths[i] = terms.length
    const { text, ...rest } = doc
    meta[i] = { ...rest, text }
    for (const t of terms) {
      const p = postings[t] || (postings[t] = Object.create(null))
      p[i] = (p[i] || 0) + 1
    }
  })

  const total = lengths.reduce((a, c) => a + c, 0)
  return {
    version: 1,
    postings,
    lengths,
    meta,
    docCount: docs.length,
    avgLen: docs.length ? total / docs.length : 0,
  }
}

/** Merge indexes -- a student's library is many books indexed separately. */
export function mergeIndexes(indexes = []) {
  const docs = []
  for (const ix of indexes) {
    if (!ix || !Array.isArray(ix.meta)) continue
    for (const m of ix.meta) docs.push(m)
  }
  return buildIndex(docs)
}

/* ── ranking ──────────────────────────────────────────────────────────────── */

const K1 = 1.5   // how fast term frequency saturates
const B = 0.75   // how hard long passages are penalised

/**
 * Search. Returns [{ score, doc, terms }] best first.
 *
 * `minScore` exists because the honest failure is the whole point: a weak
 * match dressed up as an answer is worse than "I don't have this yet, here is
 * the chapter". The caller is expected to show nothing rather than show
 * something bad -- see CONFIDENT below.
 */
export function search(index, query, { limit = 8, minScore = 0 } = {}) {
  if (!index || !index.docCount) return []
  const qTerms = [...new Set(tokenize(query))]
  if (!qTerms.length) return []

  const scores = new Map()
  const hitTerms = new Map()
  // IDF per query term, and the total "information" the query is asking for.
  // A term the index has never seen still counts toward the total, because
  // failing to match the one rare word in a question is exactly the case that
  // must NOT be reported as a confident answer.
  const idfOf = new Map()
  let askedMass = 0
  for (const t of qTerms) {
    const df = index.postings[t] ? Object.keys(index.postings[t]).length : 0
    const idf = Math.log(1 + (index.docCount - df + 0.5) / (df + 0.5))
    idfOf.set(t, idf)
    askedMass += idf
  }

  for (const t of qTerms) {
    const posting = index.postings[t]
    if (!posting) continue
    const df = Object.keys(posting).length
    const idf = idfOf.get(t)

    for (const key of Object.keys(posting)) {
      const i = Number(key)
      const tf = posting[key]
      const len = index.lengths[i] || 1
      const norm = tf * (K1 + 1) / (tf + K1 * (1 - B + B * (len / (index.avgLen || 1))))
      scores.set(i, (scores.get(i) || 0) + idf * norm)
      if (!hitTerms.has(i)) hitTerms.set(i, new Set())
      hitTerms.get(i).add(t)
    }
  }

  return [...scores.entries()]
    .map(([i, score]) => ({
      score,
      doc: index.meta[i],
      terms: [...(hitTerms.get(i) || [])],
      /*
       * Coverage weighted by IDF, not a raw count of matched words.
       *
       * Counting words made "who was the first president of india" a CONFIDENT
       * hit on a biology chapter: it matched "first" and "india", two words
       * out of three, and scored 67%. Weighted by how rare each term is, those
       * two carry almost no information and the query correctly comes back
       * unanswerable. The same bug passed "tyndall effect" on a passage whose
       * only shared word was "effect".
       */
      coverage: askedMass > 0
        ? [...(hitTerms.get(i) || [])].reduce((m, t) => m + (idfOf.get(t) || 0), 0) / askedMass
        : 0,
    }))
    .filter(r => r.score > minScore)
    .sort((a, b) => b.score - a.score || a.doc.id?.localeCompare?.(b.doc.id) || 0)
    .slice(0, limit)
}

/**
 * Is the top hit good enough to show as an answer?
 *
 * ONE gate: how much of the question's information was actually found.
 *
 * There used to be a second gate requiring the top hit to out-score the runner
 * up. It was wrong, and measuring on a real chapter is what showed it: in a
 * chapter ABOUT cells, a dozen passages match "plasma membrane" almost
 * equally, and the gate refused the question at 100% coverage. Many good
 * matches is not vagueness -- it means the book covers the topic well, and the
 * right response is to show several passages, not to claim ignorance.
 *
 * `minLead` is kept as an option, defaulting to off, because a caller
 * searching a whole LIBRARY rather than one chapter may reasonably want it.
 */
export function isConfident(results, { minCoverage = 0.62, minLead = 1 } = {}) {
  if (!results.length) return false
  const top = results[0]
  if (top.coverage < minCoverage) return false
  if (minLead > 1 && results.length > 1 && top.score < results[1].score * minLead) return false
  return true
}

/* ── presentation ─────────────────────────────────────────────────────────── */

/**
 * The part of a passage worth showing, centred on the matched terms.
 *
 * Returns segments rather than HTML so the caller highlights them with its own
 * components -- building markup here would mean this module decided what a
 * highlight looks like, and it has no business doing that.
 */
export function snippet(text, terms, { width = 240 } = {}) {
  const src = String(text || '')
  const want = new Set(terms.map(stem))
  const words = src.split(/(\s+)/)

  let best = 0, bestHits = -1
  for (let i = 0; i < words.length; i++) {
    let hits = 0, len = 0
    for (let j = i; j < words.length && len < width; j++) {
      len += words[j].length
      const w = stem(words[j].toLowerCase().replace(/[^a-z0-9]/g, ''))
      if (w && want.has(w)) hits++
    }
    if (hits > bestHits) { bestHits = hits; best = i }
  }

  let len = 0, end = best
  while (end < words.length && len < width) { len += words[end].length; end++ }

  const parts = []
  for (let i = best; i < end; i++) {
    const raw = words[i]
    const w = stem(raw.toLowerCase().replace(/[^a-z0-9]/g, ''))
    const hit = !!w && want.has(w)
    const last = parts[parts.length - 1]
    if (last && last.hit === hit) last.text += raw
    else parts.push({ text: raw, hit })
  }
  return {
    parts,
    truncatedStart: best > 0,
    truncatedEnd: end < words.length,
  }
}
