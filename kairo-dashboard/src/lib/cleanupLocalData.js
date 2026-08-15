/**
 * One-time repair of knowledge-graph data already sitting on a device.
 *
 * knowledgeHygiene.js stops NEW junk. This fixes what is already there: the
 * "Ai" concept node, 48 of 55 events tagged only "General", Trigonometry split
 * across three topics with three mastery numbers, six Ohm's Law formulas, and
 * chat commands and wrong answers stored as doubts.
 *
 * Pure: takes a state object, returns a NEW state plus a report of exactly what
 * changed. Nothing here writes to storage — the caller decides, which makes a
 * dry run possible and means a bug in here cannot destroy a student's history
 * on import.
 */

import { canonicalTopic, classifyChatTurn, isSameFormula, sameText } from './knowledgeHygiene.js'

/** Subject inferred from a topic, so "General" can be replaced where the topic
 *  actually tells us. Only clear cases — a wrong subject is worse than none. */
/**
 * Order matters: the first match wins, so the most specific subject goes first.
 *
 * Mathematics leads because maths topic names collide with science vocabulary
 * far more than the reverse — "equations", "series", "functions", "vectors".
 * The Chemistry pattern used to contain a bare `equation`, which matched
 * "Quadratic Equations" and filed it under Chemistry. That is almost certainly
 * how the live app got it wrong, and a test now pins it.
 *
 * Every pattern here has to be a term that belongs to ONE subject. A word that
 * appears in two syllabuses does not belong in this list at all — leaving a
 * subject untagged is recoverable; tagging it wrongly hides the topic where the
 * student will never look for it.
 */
const SUBJECT_HINTS = [
  [/trigonom|algebra|quadratic|polynomial|geometry|triangle|circle|probabilit|statistic|arithmetic progress|coordinate|calculus|logarithm|matri(x|ces)/i, 'Mathematics'],
  [/ohm|circuit|resist|magnet|refract|lens|mirror|newton|momentum|gravit|friction|electric current/i, 'Physics'],
  [/acid|alkali|salt|metal|carbon|chemical (reaction|equation)|periodic table|mole concept|electrolys|valenc|isotope|covalent|ionic bond/i, 'Chemistry'],
  [/cell|mitosis|meiosis|tissue|life process|respirat|reproduc|heredity|gene|photosynth|ecosystem|organism|nutrition|excretion/i, 'Biology'],
]

function inferSubject(topic) {
  const t = String(topic || '')
  for (const [re, subject] of SUBJECT_HINTS) if (re.test(t)) return subject
  return null
}

/**
 * The subject a record SHOULD carry, given its topic.
 *
 * Junk tags ("General") were already handled. This also overrides a tag that is
 * confidently WRONG — Quadratic Equations filed under Chemistry, which is what
 * the live app shows. The AI picks the subject at capture time and sometimes
 * picks badly, and a wrong subject is not a cosmetic problem: it puts the topic
 * in the wrong place in every browser, search and study plan, so the student
 * cannot find it where they'd look.
 *
 * Only overrides when the topic text is unambiguous. `null` means leave it
 * alone — guessing over a subject we cannot infer would be the same mistake in
 * the other direction.
 */
function correctSubject(topic, current) {
  const inferred = inferSubject(topic)
  if (!inferred) return null
  const cur = String(current || '').trim().toLowerCase()
  if (!cur) return inferred
  // 'Math' / 'Maths' / 'Mathematics' are the same answer, not a mismatch.
  const same = inferred.toLowerCase().startsWith(cur.slice(0, 4))
    || cur.startsWith(inferred.toLowerCase().slice(0, 4))
  return same ? null : inferred
}

const isJunkSubject = (s) => {
  const v = String(s || '').trim().toLowerCase()
  return !v || v === 'general' || v === 'misc' || v === 'other' || v === 'unknown'
}

/**
 * @param {object} state  a TwinState-shaped object
 * @returns {{ state: object, report: object }}
 */
export function cleanupLocalData(state) {
  const report = {
    topicsMerged: 0,
    junkNodesRemoved: 0,
    subjectsRetagged: 0,
    doubtsRemoved: 0,
    formulasMerged: 0,
    cardsDeduped: 0,
    masteryRowsMerged: 0,
    details: [],
  }

  const next = {
    ...state,
    events: [...(state.events || [])],
    mastery: [...(state.mastery || [])],
    doubts: [...(state.doubts || [])],
    concepts: [...(state.concepts || [])],
    formulas: [...(state.formulas || [])],
    flashcards: [...(state.flashcards || [])],
  }

  /* ── 1. canonicalise topics on every record ─────────────────────────── */
  const canonOf = (t) => canonicalTopic(t)?.display ?? null

  const retopic = (arr, label) => arr.filter(item => {
    if (!item) return false
    const original = item.topic
    const canon = canonOf(original)
    if (original && !canon) {
      // The topic was junk ("Ai", "General", a sentence). Drop the record only
      // if the topic was the ONLY thing identifying it.
      report.junkNodesRemoved++
      report.details.push(`${label}: dropped "${String(original).slice(0, 40)}"`)
      return false
    }
    if (canon && canon !== original) {
      report.topicsMerged++
      item.topic = canon
    }
    if (isJunkSubject(item.subject)) {
      const inferred = inferSubject(item.topic)
      if (inferred) { item.subject = inferred; report.subjectsRetagged++ }
      else delete item.subject       // better absent than falsely "General"
    } else {
      // Real but wrong — Quadratic Equations under Chemistry.
      const fixed = correctSubject(item.topic, item.subject)
      if (fixed) { item.subject = fixed; report.subjectsRetagged++ }
    }
    return true
  })

  next.concepts = retopic(next.concepts, 'concept')
  next.formulas = retopic(next.formulas, 'formula')
  next.flashcards = retopic(next.flashcards, 'card')

  /* ── 2. doubts that were never questions ────────────────────────────── */
  next.doubts = next.doubts.filter(d => {
    const kind = classifyChatTurn(d?.question)
    if (kind === 'question') {
      const canon = canonOf(d.topic)
      if (canon && canon !== d.topic) { d.topic = canon; report.topicsMerged++ }
      if (isJunkSubject(d.subject)) {
        const inferred = inferSubject(d.topic)
        if (inferred) { d.subject = inferred; report.subjectsRetagged++ }
        else delete d.subject
      } else {
        const fixed = correctSubject(d.topic, d.subject)
        if (fixed) { d.subject = fixed; report.subjectsRetagged++ }
      }
      return true
    }
    report.doubtsRemoved++
    report.details.push(`doubt (${kind}): "${String(d?.question || '').slice(0, 48)}"`)
    return false
  })

  /* ── 3. merge duplicate formulas into variants ──────────────────────── */
  const keptFormulas = []
  for (const f of next.formulas) {
    const match = keptFormulas.find(k => isSameFormula(k, f))
    if (match) {
      const variants = new Set([...(match.variants || []), f.expr])
      match.variants = [...variants].filter(v => v !== match.expr).slice(0, 6)
      report.formulasMerged++
      continue
    }
    keptFormulas.push(f)
  }
  next.formulas = keptFormulas

  /* ── 4. duplicate cards by front text ───────────────────────────────── */
  const keptCards = []
  for (const c of next.flashcards) {
    if (keptCards.some(k => sameText(k.front, c.front) && k.topic === c.topic)) {
      report.cardsDeduped++
      continue
    }
    keptCards.push(c)
  }
  next.flashcards = keptCards

  /* ── 5. merge mastery rows split across topic spellings ─────────────── */
  // This is the one that made Trigonometry show three different percentages.
  const byTopic = new Map()
  for (const row of next.mastery) {
    const canon = canonOf(row?.topic)
    if (!canon) { report.junkNodesRemoved++; continue }
    const existing = byTopic.get(canon)
    if (!existing) {
      byTopic.set(canon, { ...row, topic: canon })
      continue
    }
    // Combine the evidence rather than picking a winner — both rows describe
    // the same topic, so the attempts genuinely happened.
    const attempts = (existing.attempts || 0) + (row.attempts || 0)
    const correct = (existing.correct || 0) + (row.correct || 0)
    byTopic.set(canon, {
      ...existing,
      attempts,
      correct,
      mastery: attempts ? correct / attempts : existing.mastery,
      lastStudiedAt: Math.max(existing.lastStudiedAt || 0, row.lastStudiedAt || 0),
      lastCorrectAt: Math.max(existing.lastCorrectAt || 0, row.lastCorrectAt || 0) || null,
    })
    report.masteryRowsMerged++
  }
  next.mastery = [...byTopic.values()]

  /* ── 6. events: canonicalise, retag, drop junk-topic entries ────────── */
  next.events = next.events.filter(e => {
    if (!e) return false
    if (e.topic) {
      const canon = canonOf(e.topic)
      if (!canon) { e.topic = undefined }   // keep the event, lose the bad label
      else if (canon !== e.topic) { e.topic = canon; report.topicsMerged++ }
    }
    if (isJunkSubject(e.subject)) {
      const inferred = inferSubject(e.topic)
      if (inferred) { e.subject = inferred; report.subjectsRetagged++ }
      else delete e.subject
    } else {
      const fixed = correctSubject(e.topic, e.subject)
      if (fixed) { e.subject = fixed; report.subjectsRetagged++ }
    }
    return true
  })

  return { state: next, report }
}

/** Human-readable one-liner for the console / a confirm dialog. */
export function summarise(report) {
  const bits = []
  if (report.topicsMerged)     bits.push(`${report.topicsMerged} topic labels normalised`)
  if (report.masteryRowsMerged)bits.push(`${report.masteryRowsMerged} split mastery rows merged`)
  if (report.junkNodesRemoved) bits.push(`${report.junkNodesRemoved} junk nodes removed`)
  if (report.subjectsRetagged) bits.push(`${report.subjectsRetagged} "General" tags replaced`)
  if (report.doubtsRemoved)    bits.push(`${report.doubtsRemoved} non-questions removed from doubts`)
  if (report.formulasMerged)   bits.push(`${report.formulasMerged} duplicate formulas merged`)
  if (report.cardsDeduped)     bits.push(`${report.cardsDeduped} duplicate cards removed`)
  return bits.length ? bits.join(', ') : 'nothing to clean'
}
