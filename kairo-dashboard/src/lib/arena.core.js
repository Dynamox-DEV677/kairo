/**
 * The battle question bank and scoring -- shared by the server (which holds
 * the answers) and the client (which never sees them).
 *
 * NO AI. The old Battle Mode generated questions with a model at play time
 * and fought three fake bots. Both are gone. Questions here are built
 * deterministically from two verified datasets the app already ships:
 *
 *   - the formula sheet: "when do you reach for this formula" and its reverse
 *   - the syllabus graph: "which chapter covers this topic"
 *
 * Syllabus-true, cheap, offline-buildable, and honest about what it is. The
 * bank is thin for Chemistry and Biology today (no formulas there); it grows
 * by adding data, never by calling a model.
 *
 * Two humans get the SAME seven questions, picked by a seed derived from the
 * match id. Never fake an opponent: when nobody is waiting, the client offers
 * a solo timed round instead.
 */

export const ROUND = { questions: 7, seconds: 60, waitSeconds: 15, opponentTimeoutMs: 12_000, graceMs: 4_000 }

/**
 * Which syllabus unit a student calls which subject. This is a mapping of
 * graph ids, not a pick list -- the subjects a student actually studies come
 * from their board and class, and a chapter outside this map simply yields no
 * question. Our Environment is taught inside Biology, so it maps there.
 */
const UNIT_SUBJECT = {
  'sci.phy': 'Physics',
  'sci.chem': 'Chemistry',
  'sci.bio': 'Biology',
  'sci.env': 'Biology',
}
const MATHS = 'Maths'

/** Derived, so the map above stays the single source. */
export const SUBJECTS = [...new Set([...Object.values(UNIT_SUBJECT), MATHS])]

export function subjectOfChapter(chapterId) {
  const id = String(chapterId || '')
  if (id.startsWith('math')) return MATHS
  return UNIT_SUBJECT[id.split('.').slice(0, 2).join('.')] || null
}

/* ── deterministic randomness ─────────────────────────────────────────────── */

export function hashSeed(str) {
  let h = 2166136261
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0 }
  return h >>> 0
}

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(list, seed) {
  const r = rng(seed)
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]] }
  return out
}

/** Pick `n` distractors from a pool, deterministically, never the answer itself. */
function distractors(pool, answer, n, seed) {
  const others = pool.filter(x => x !== answer)
  return shuffle(others, seed).slice(0, n)
}

function question(id, subject, kind, text, answer, pool) {
  const wrong = distractors(pool, answer, 3, hashSeed(id + ':d'))
  if (wrong.length < 3) return null
  const options = shuffle([answer, ...wrong], hashSeed(id + ':o'))
  return { id, subject, kind, text, options, answer: options.indexOf(answer) }
}

/* ── the bank ─────────────────────────────────────────────────────────────── */

export function buildBank(formulas = [], graph = null) {
  const out = []

  // formula ↔ when-to-use, within one subject
  const bySubject = new Map()
  for (const f of formulas || []) {
    const s = subjectOfChapter(f.chapter)
    if (!s || !f.expr || !f.when) continue
    if (!bySubject.has(s)) bySubject.set(s, [])
    bySubject.get(s).push(f)
  }
  for (const [subject, list] of bySubject) {
    const whens = [...new Set(list.map(f => f.when))]
    const exprs = [...new Set(list.map(f => f.expr))]
    for (const f of list) {
      const q1 = question(`f:${f.id}:when`, subject, 'formula-when', `When do you reach for  ${f.expr}  ?`, f.when, whens)
      const q2 = question(`f:${f.id}:expr`, subject, 'formula-expr', `Which formula fits: ${f.when}`, f.expr, exprs)
      if (q1) out.push(q1)
      if (q2) out.push(q2)
    }
  }

  // topic → chapter, within one subject; two topics per chapter keeps the bank honest about its size
  if (graph && Array.isArray(graph.chapters)) {
    const chaptersBySubject = new Map()
    for (const c of graph.chapters) {
      const s = subjectOfChapter(c.id)
      if (!s) continue
      if (!chaptersBySubject.has(s)) chaptersBySubject.set(s, [])
      chaptersBySubject.get(s).push(c)
    }
    for (const [subject, chapters] of chaptersBySubject) {
      const names = chapters.map(c => c.name)
      for (const c of chapters) {
        const topics = [...new Set((c.topics || []).map(t => String(t).trim()).filter(t => t.length >= 4))]
        // prefer longer, more specific topic phrases; skip ones that name the chapter itself
        const picked = topics.filter(t => !c.name.toLowerCase().includes(t.toLowerCase())).sort((a, b) => b.length - a.length).slice(0, 2)
        picked.forEach((t, i) => {
          const q = question(`t:${c.id}:${i}`, subject, 'topic-chapter', `Which chapter covers “${t}”?`, c.name, names)
          if (q) out.push(q)
        })
      }
    }
  }
  return out
}

/** What the client is allowed to see: never the answer. */
export function publicQuestion(q) {
  if (!q) return null
  const { answer, ...rest } = q
  void answer
  return rest
}

/** Seven questions for a subject, the same seven for both players of a match. */
export function pickQuestions(bank, subject, seed, n = ROUND.questions) {
  const pool = (bank || []).filter(q => q.subject === subject)
  return shuffle(pool, hashSeed(`${seed}:${subject}`)).slice(0, n)
}

export function subjectCounts(bank) {
  const out = {}
  for (const s of SUBJECTS) out[s] = (bank || []).filter(q => q.subject === s).length
  return out
}

/* ── scoring ─────────────────────────────────────────────────────────────── */

/** 10 for a correct answer plus up to 5 for speed; nothing for a wrong one. */
export function scoreAnswer(correct, elapsedMs, { base = 10, bonusMax = 5, perQuestionMs = 8_500 } = {}) {
  if (!correct) return 0
  const t = Math.max(0, Math.min(1, (Number(elapsedMs) || 0) / perQuestionMs))
  return base + Math.round(bonusMax * (1 - t))
}

export function outcome(myScore, oppScore) {
  if (myScore > oppScore) return 'won'
  if (myScore < oppScore) return 'lost'
  return 'draw'
}

/** Mastery band 1-3 from the average mastery of a subject's chapters. Matched within ±1. */
export function masteryBand(avgMastery) {
  const m = Math.max(0, Math.min(1, Number(avgMastery) || 0))
  return m < 0.35 ? 1 : m < 0.7 ? 2 : 3
}
