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

/* ── the Kyno opponent ──────────────────────────────────────────────────────
 *
 * Battles are against Kyno, not against another child. That is an owner
 * decision, and it is also the right one on privacy grounds: pairing two
 * students was the only place in the app where one child's identity was put
 * in front of another. Removing it removes that surface entirely.
 *
 * The round is unchanged -- seven questions, sixty seconds, faster right
 * answers score more. Only the opponent changed.
 *
 * Kyno plays at an accuracy calibrated to the student's own mastery band, so
 * a strong student gets a real race and a struggling one is not buried. It is
 * DETERMINISTIC from the match seed: the same round always plays out the same
 * way, so a result can be recomputed and checked, and nothing depends on a
 * server holding secret state.
 */

/** Accuracy Kyno plays at, per mastery band (1 = shaky, 3 = solid). */
export const KYNO_ACCURACY = { 1: 0.5, 2: 0.65, 3: 0.78 }

/** How long Kyno "thinks", per band, in ms. Faster when it knows the topic. */
const KYNO_PACE = { 1: [4200, 11000], 2: [3200, 9000], 3: [2200, 7200] }

/** A deterministic 0-1 from an integer. Same seed, same round, always. */
function unit(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/**
 * How Kyno answers each question of a round.
 *
 * Returns one entry per question: whether it got it right and how long it
 * took. Pass `accuracy` to override the band, which is what makes it tunable
 * without touching this file.
 */
export function kynoPlay(questionCount, { band = 2, seed = 1, accuracy = null } = {}) {
  const n = Math.max(0, Math.floor(Number(questionCount) || 0))
  const acc = accuracy == null ? (KYNO_ACCURACY[band] ?? 0.65) : Math.max(0, Math.min(1, Number(accuracy)))
  const [fast, slow] = KYNO_PACE[band] || KYNO_PACE[2]
  const out = []
  for (let i = 0; i < n; i++) {
    const correct = unit(seed + i * 7 + 1) < acc
    const elapsedMs = Math.round(fast + unit(seed + i * 13 + 5) * (slow - fast))
    out.push({ correct, elapsedMs })
  }
  return out
}

/** Kyno's running score after `answered` questions of a play-through. */
export function kynoScoreAfter(play, answered) {
  return (play || []).slice(0, Math.max(0, answered)).reduce(
    (t, p) => t + scoreAnswer(p.correct, p.elapsedMs), 0)
}

/** The label a student sees for their opponent. Never another child's name. */
export const KYNO_OPPONENT_NAME = 'Kyno'

/* ── topics without a syllabus ──────────────────────────────────────────────
 *
 * The safety rule is that a topic is NEVER free text -- not that it must be a
 * syllabus chapter. Study rooms were refusing to open for any student whose
 * board and class have no verified syllabus, which is most personal students,
 * because the picker was built from chapters and the list came back empty.
 *
 * A syllabus makes these screens BETTER. Its absence must not make them
 * UNAVAILABLE. So: chapters when we have them, this fixed list when we do not,
 * and a text input in neither case.
 */
export const FALLBACK_TOPICS = [
  'Physics', 'Chemistry', 'Biology', 'Maths', 'English',
  'Hindi', 'Social Science', 'Computer Science', 'Revision', 'Homework',
]

/** The picker's options: real chapters if any, otherwise the fixed list. */
export function topicChoices(chapters = []) {
  const real = Array.isArray(chapters) ? chapters.filter(c => c && c.id && c.name) : []
  if (real.length) return { source: 'syllabus', items: real }
  return { source: 'fallback', items: FALLBACK_TOPICS.map(name => ({ id: 'topic:' + name.toLowerCase().replace(/[^a-z]+/g, '-'), name })) }
}
