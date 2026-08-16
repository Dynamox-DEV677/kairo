/**
 * Bridging mode — what a curriculum switcher has already covered, and what they
 * have not.
 *
 * A student moving CBSE → Cambridge mid-year is told "catch up" and left to
 * work out on what. This compares the two curricula's real topic maps and
 * splits them three ways: already covered, only in the old course (safe to drop),
 * and only in the new one (the actual catch-up list).
 *
 * Nothing here is generated. Every row comes from src/data/syllabus/*.json,
 * which is why the comparison can be trusted — and why it refuses to run at all
 * when one side has no verified map (see `unavailable`).
 *
 * The matcher is deliberately shared with the syllabus resolver's approach:
 * token overlap after stemming, with a floor. Chapter names differ across
 * boards for the same physics ("Gravitation" vs "Gravitational fields"), so an
 * exact-string comparison would report a student has covered nothing.
 */

const STOP = new Set([
  'the', 'a', 'an', 'of', 'and', 'in', 'to', 'for', 'on', 'is', 'are', 'its',
  'what', 'how', 'why', 'explain', 'chapter', 'topic', 'class', 'question',
  'introduction', 'basic', 'general', 'their', 'other', 'more', 'using', 'use',
])

/**
 * Light suffix stripping, so morphological variants of the same word collapse.
 *
 * Boards name the same content differently: NCERT "Gravitation" vs Cambridge
 * "Gravitational fields", "Atomic structure" vs "Structure of the atom". Plural
 * folding alone left those as zero-overlap, which reported a switching student
 * as having covered nothing.
 *
 * Each rule keeps a minimum stem length so short words are not destroyed.
 */
const stem = (w) => w
  .replace(/(ies)$/, 'y')
  .replace(/(es|s)$/, '')
  .replace(/ical$/, (m, ...a) => 'ic')
  .replace(/al$/, (m, o, str) => (str.length - 2 >= 5 ? '' : m))
  .replace(/ic$/, (m, o, str) => (str.length - 2 >= 4 ? '' : m))

export function tokenise(s) {
  return new Set(
    String(s || '').toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP.has(w))
      .map(stem),
  )
}

/**
 * How strongly two topic names refer to the same thing, 0–1.
 *
 * Symmetric overlap over the smaller token set, so "Gravitation" matches
 * "Gravitational fields" without a long name swallowing a short one.
 */
export function similarity(a, b) {
  const A = tokenise(a), B = tokenise(b)
  if (!A.size || !B.size) return 0
  let shared = 0
  for (const t of A) if (B.has(t)) shared++
  return shared / Math.min(A.size, B.size)
}

/**
 * Above this, two topics are treated as the same content.
 *
 * Set high on purpose. Telling a switching student they have already covered
 * something they have not is the expensive error — they skip it and meet it in
 * an exam. The cheap error is listing something twice as "to learn".
 */
export const MATCH_FLOOR = 0.6

/**
 * Compare two topic lists.
 *
 * `oldTopics` / `newTopics` are the flat topic records the syllabus modules
 * return: { name, chapter, subject }. Returns plain data; no formatting.
 */
export function compareTopics(oldTopics, newTopics, opts = {}) {
  const floor = opts.floor ?? MATCH_FLOOR
  const oldList = Array.isArray(oldTopics) ? oldTopics : []
  const newList = Array.isArray(newTopics) ? newTopics : []

  // Score every (new, old) pair once, then assign strongest-first.
  //
  // Matching is ONE-TO-ONE: an old chapter can be claimed by only one new
  // topic. When a new curriculum splits one old chapter into four sub-topics,
  // the student has met the material but has not covered four topics' worth of
  // it, and counting all four as done inflates readiness and invites them to
  // skip. Strongest-first assignment means the best match wins the pairing
  // rather than whichever happened to be iterated first.
  const pairs = []
  for (let ni = 0; ni < newList.length; ni++) {
    const n = newList[ni]
    for (let oi = 0; oi < oldList.length; oi++) {
      const o = oldList[oi]
      // Only compare within a subject when both sides declare one — "Transport"
      // in Biology is not "Transport" in Physics.
      if (n.subject && o.subject && !subjectsAlign(n.subject, o.subject)) continue
      const score = Math.max(
        similarity(n.name, o.name),
        similarity(`${n.chapter} ${n.name}`, `${o.chapter} ${o.name}`),
      )
      if (score >= floor) pairs.push({ ni, oi, score })
    }
  }
  pairs.sort((a, b) => b.score - a.score)

  const takenNew = new Map()   // new index -> { oi, score }
  const matchedOld = new Set()
  for (const p of pairs) {
    if (takenNew.has(p.ni) || matchedOld.has(p.oi)) continue
    takenNew.set(p.ni, p)
    matchedOld.add(p.oi)
  }

  const covered = []
  const toLearn = []
  newList.forEach((n, ni) => {
    const hit = takenNew.get(ni)
    if (hit) covered.push({ ...n, matchedWith: oldList[hit.oi].name, confidence: round(hit.score) })
    else toLearn.push({ ...n })
  })

  const canDrop = oldList.filter((_, i) => !matchedOld.has(i))

  return { covered, toLearn, canDrop }
}

function round(n) { return Math.round(n * 100) / 100 }

/** A board with a singleStage returns the same rows for every class key. */
function dedupe(rows) {
  const seen = new Set()
  return rows.filter(r => {
    const k = r.topicId || `${r.subject}|${r.chapter}|${r.name}`
    if (seen.has(k)) return false
    seen.add(k); return true
  })
}

/**
 * Classes 6..n — what a student at class n has been taught so far.
 * Exported so the page and the tests agree on what "already covered" means.
 */
export function classesUpTo(cls) {
  const n = parseInt(String(cls ?? '').match(/\d{1,2}/)?.[0] ?? '', 10)
  if (!Number.isFinite(n)) return []
  const out = []
  for (let i = 6; i <= n; i++) out.push(String(i))
  return out
}

/**
 * NCERT teaches one combined "Science"; Cambridge and IB split it into Physics,
 * Chemistry and Biology. Treating those as different subjects would make every
 * comparison across that boundary come out empty.
 */
const COMBINED = new Set(['science'])
export function subjectsAlign(a, b) {
  const x = String(a).toLowerCase(), y = String(b).toLowerCase()
  if (x === y) return true
  if (COMBINED.has(x) || COMBINED.has(y)) {
    const sci = new Set(['physics', 'chemistry', 'biology', 'science'])
    return sci.has(x) && sci.has(y)
  }
  return false
}

/**
 * The whole comparison, given a topic-lookup function.
 *
 * `lookup(board, cls)` must return the flat topic list for that board — the
 * caller passes in allTopics from either the client or the server module, so
 * this file stays free of imports and testable on its own.
 *
 * Returns `unavailable` with a reason instead of a comparison when either side
 * has no verified map. A made-up gap list is worse than no gap list: the
 * student would revise the wrong things.
 */
export function buildBridge({ from, to, lookup }) {
  const fromMapped = !!from?.syllabusBoard
  const toMapped   = !!to?.syllabusBoard

  if (!fromMapped || !toMapped) {
    const missing = [
      !fromMapped && (from?.label || 'the previous curriculum'),
      !toMapped && (to?.label || 'the new curriculum'),
    ].filter(Boolean)
    return {
      unavailable: true,
      reason: `Kyno does not have a verified topic map for ${missing.join(' or ')} yet, so it cannot tell you what actually overlaps. Rather than show you a guess, it is showing you nothing — a wrong catch-up list is worse than none.`,
      missing,
    }
  }

  // Everything the student has actually covered, not just their current year.
  // A student switching in class 9 has sat through 6, 7 and 8 as well, and
  // comparing only class 9 against a two-year IGCSE course reported them as 12%
  // ready when they had already met most of the foundational content.
  const oldTopics = dedupe(
    (from.classes && from.classes.length ? from.classes : [from.cls])
      .flatMap(c => lookup(from.syllabusBoard, c) || []),
  )
  const newTopics = dedupe(
    (to.classes && to.classes.length ? to.classes : [to.cls])
      .flatMap(c => lookup(to.syllabusBoard, c) || []),
  )

  if (!oldTopics.length || !newTopics.length) {
    return {
      unavailable: true,
      reason: 'One of these curricula has no topics mapped at that grade yet, so there is nothing honest to compare.',
      missing: [],
    }
  }

  const { covered, toLearn, canDrop } = compareTopics(oldTopics, newTopics)

  return {
    unavailable: false,
    from: { label: from.label, cls: from.cls, total: oldTopics.length },
    to:   { label: to.label,   cls: to.cls,   total: newTopics.length },
    covered,
    toLearn,
    canDrop,
    /** Share of the new course the student has already met. */
    readiness: newTopics.length ? Math.round((covered.length / newTopics.length) * 100) : 0,
  }
}

/** Group rows by subject then chapter, for rendering. */
export function groupRows(rows) {
  const out = new Map()
  for (const r of rows || []) {
    const subj = r.subject || 'General'
    if (!out.has(subj)) out.set(subj, new Map())
    const chapters = out.get(subj)
    const ch = r.chapter || '—'
    if (!chapters.has(ch)) chapters.set(ch, [])
    chapters.get(ch).push(r)
  }
  return [...out.entries()].map(([subject, chapters]) => ({
    subject,
    chapters: [...chapters.entries()].map(([chapter, topics]) => ({ chapter, topics })),
  }))
}
