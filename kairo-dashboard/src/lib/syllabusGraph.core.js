/**
 * The syllabus graph (retention+coverage brief, part A).
 *
 * One finite tree per exam: subject → unit → chapter. Chapters are the
 * countable nodes — every state, coverage %, and risk score is per chapter,
 * and the seed data's `topics` arrays are matching metadata, not nodes.
 * The seed lives in src/data/syllabusGraph/*.json as reviewable data;
 * marks and PYQ weights are estimates BY DESIGN and get corrected in data,
 * never in components.
 *
 * Every chapter is in exactly one state:
 *   UNTOUCHED  no mapped contact ever
 *   SEEN       contact, but never assessed
 *   PRACTISED  assessed, mastery below the solid bar
 *   SOLID      assessed, mastery at/above the bar, retention holding
 *   FADING     was solid, retention decayed past the fade bar
 */

export const SOLID_BAR = 0.6
export const FADE_BAR = 0.45

export function loadGraph(json) {
  const nodes = json?.nodes || []
  const byId = new Map()
  for (const n of nodes) {
    if (byId.has(n.id)) throw new Error(`duplicate node id: ${n.id}`)
    byId.set(n.id, n)
  }
  for (const n of nodes) {
    if (n.parent && !byId.has(n.parent)) throw new Error(`${n.id}: missing parent ${n.parent}`)
    for (const p of n.prereq || []) {
      if (!byId.has(p)) throw new Error(`${n.id}: missing prereq ${p}`)
    }
    if (n.kind === 'chapter') {
      if (!(n.typical_marks > 0)) throw new Error(`${n.id}: chapter needs typical_marks`)
      if (!(n.est_study_minutes > 0)) throw new Error(`${n.id}: chapter needs est_study_minutes`)
      if (!(n.pyq_frequency >= 0 && n.pyq_frequency <= 1)) throw new Error(`${n.id}: pyq_frequency out of range`)
    }
  }
  return {
    id: json.graph,
    exam: json.exam,
    label: json.label,
    byId,
    chapters: nodes.filter(n => n.kind === 'chapter'),
    subjects: nodes.filter(n => n.kind === 'subject'),
    units: nodes.filter(n => n.kind === 'unit'),
  }
}

export function subjectOfNode(graph, node) {
  let cur = node
  while (cur && cur.kind !== 'subject') cur = graph.byId.get(cur.parent)
  return cur || null
}

/* ── activity → chapter matching ─────────────────────────────────────────── */

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

const SUBJECT_ALIAS = {
  physics: 'phy', phy: 'phy',
  chemistry: 'chem', chem: 'chem',
  mathematics: 'math', maths: 'math', math: 'math',
  science: 'sci', sci: 'sci',
}

/**
 * Map one activity (subject, topic strings from the twin) to a chapter id.
 * Conservative on purpose: no subject gate match → null; no topic evidence →
 * null. The brief's rule — leave unmapped rather than guess.
 */
export function matchChapter(graph, subject, topic) {
  // The alias is a gate only when THIS graph has that subject node. Class 10
  // files "Physics" activity under one "Science" subject; gating on 'phy'
  // there would refuse every match and leave the whole chapter UNTOUCHED.
  const aliased = SUBJECT_ALIAS[norm(subject)]
  const subjId = aliased && graph.subjects.some(sn => sn.id === aliased) ? aliased : null
  const t = norm(topic)
  if (!t) return null

  const candidates = graph.chapters.filter(c =>
    !subjId || subjectOfNode(graph, c)?.id === subjId)
  if (!candidates.length) return null

  // 1. topic string appears in the chapter's topic list (either direction)
  for (const c of candidates) {
    for (const ct of c.topics || []) {
      const n = norm(ct)
      if (n === t || n.includes(t) || t.includes(n)) return c.id
    }
  }
  // 2. topic ≈ chapter name
  for (const c of candidates) {
    const n = norm(c.name)
    if (n === t || n.includes(t) || t.includes(n)) return c.id
  }
  return null
}

/* ── states ───────────────────────────────────────────────────────────────── */

export const STATES = ['UNTOUCHED', 'SEEN', 'PRACTISED', 'SOLID', 'FADING']

/**
 * State per chapter from real twin data.
 *  - events: any mapped event = contact; quiz/assessment events = assessed.
 *  - mastery rows: matched the same way; mastery + retentionNow drive
 *    SOLID vs FADING.
 * Returns Map<chapterId, {state, mastery, retention, lastContact, evidence}>.
 */
export function nodeStates(graph, { events = [], mastery = [] } = {}) {
  const acc = new Map() // chapterId -> { contact, assessed, lastContact }
  const touch = (id, ts, assessed) => {
    if (!id) return
    const row = acc.get(id) || { contact: 0, assessed: 0, lastContact: 0 }
    row.contact++
    if (assessed) row.assessed++
    row.lastContact = Math.max(row.lastContact, ts || 0)
    acc.set(id, row)
  }

  for (const e of events) {
    if (!e) continue
    const id = matchChapter(graph, e.subject, e.topic)
    touch(id, e.ts, e.type === 'quiz_answered' || e.type === 'quiz_completed')
  }

  const masteryBy = new Map() // chapterId -> best {mastery, retention}
  for (const m of mastery) {
    const id = matchChapter(graph, m.subject, m.topic)
    if (!id) continue
    const cur = masteryBy.get(id)
    if (!cur || m.mastery > cur.mastery) {
      masteryBy.set(id, { mastery: m.mastery, retention: m.retentionNow ?? 1 })
    }
    if (m.attempts > 0) touch(id, m.lastStudiedAt, true)
  }

  const out = new Map()
  for (const c of graph.chapters) {
    const a = acc.get(c.id)
    const m = masteryBy.get(c.id)
    let state = 'UNTOUCHED'
    if (a) {
      if (!a.assessed) state = 'SEEN'
      else if (m && m.mastery >= SOLID_BAR) {
        state = m.retention < FADE_BAR ? 'FADING' : 'SOLID'
      } else state = 'PRACTISED'
    }
    out.set(c.id, {
      state,
      mastery: m?.mastery ?? 0,
      retention: m?.retention ?? (a ? 1 : 1),
      lastContact: a?.lastContact ?? 0,
    })
  }
  return out
}

/** Coverage against the REAL node count — never against "touched so far". */
export function coverage(graph, states) {
  const total = graph.chapters.length
  const untouched = graph.chapters.filter(c => states.get(c.id)?.state === 'UNTOUCHED')
  const marksUntouched = untouched.reduce((s, c) => s + c.typical_marks, 0)
  return {
    total,
    touched: total - untouched.length,
    pct: total ? Math.round(((total - untouched.length) / total) * 100) : 0,
    untouched,
    marksUntouched: Math.round(marksUntouched),
  }
}
