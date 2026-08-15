/**
 * Phase 2.4 and 2.5. The fixture below is the live device state described in
 * the bug report, reproduced as data.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanupLocalData, summarise } from '../../src/lib/cleanupLocalData.js'
import { sm2, dueState, revisionQueue, qualityFrom } from '../../src/lib/srs.js'

const NOW = Date.parse('2026-08-15T12:00:00Z')
const HOUR = 3600_000
const DAY = 86_400_000

function dirtyState() {
  return {
    events: [
      { ts: NOW - DAY, subject: 'General', topic: 'Ohm\'s Law' },
      { ts: NOW - DAY, subject: 'General', topic: 'trig' },
      { ts: NOW - DAY, subject: 'General', topic: 'Ai' },
    ],
    mastery: [
      { topic: 'Trigonometry', subject: 'General', mastery: 0.8, attempts: 5, correct: 4, lastStudiedAt: NOW - DAY },
      { topic: 'trigonometry', subject: 'Maths',   mastery: 0.2, attempts: 5, correct: 1, lastStudiedAt: NOW - 2 * DAY },
      { topic: 'trig',         subject: 'General', mastery: 0.5, attempts: 2, correct: 1, lastStudiedAt: NOW - 3 * DAY },
      { topic: 'Ai',           subject: 'General', mastery: 0.1, attempts: 1, correct: 0, lastStudiedAt: NOW },
    ],
    doubts: [
      { question: 'What is Ohm\'s law?', topic: "Ohm's Law", subject: 'General' },
      { question: 'Make Flashcard Abt This', topic: 'General' },
      { question: 'No Create It In Flashcards', topic: 'General' },
      { question: 'R = V X I = 12 X 3 = 36 Ohms', topic: 'General' },
    ],
    concepts: [{ topic: 'Ai', subject: 'General' }, { topic: 'Mitosis', subject: 'General' }],
    formulas: [
      { ts: NOW - 2 * 60_000, expr: 'V = I R',  topic: "Ohm's Law", name: "Ohm's Law" },
      { ts: NOW - 3 * 60_000, expr: 'V = I × R', topic: 'ohms law',  name: 'Ohm' },
      { ts: NOW - 4 * 60_000, expr: 'R = V / I', topic: "OHM'S LAW", name: 'Resistance' },
      { ts: NOW - 5 * 60_000, expr: 'I = V / R', topic: 'ohm law',   name: 'Current' },
      { ts: NOW - 6 * 60_000, expr: 'V=IR',      topic: "Ohm's Law", name: 'Ohms' },
      { ts: NOW - 7 * 60_000, expr: 'R=V÷I',     topic: 'ohms-law',  name: 'R' },
      { ts: NOW - 8 * 60_000, expr: 'P = V I',   topic: "Ohm's Law", name: 'Power' },
    ],
    flashcards: [
      { front: 'What is mitosis?', topic: 'Mitosis' },
      { front: 'what is  MITOSIS? ', topic: 'Mitosis' },
    ],
  }
}

// --- 2.4 cleanup ----------------------------------------------------------

test('the "Ai" node is gone from concepts and mastery', () => {
  const { state } = cleanupLocalData(dirtyState())
  assert.ok(!state.concepts.some(c => /^ai$/i.test(c.topic || '')), 'Ai concept survived')
  assert.ok(!state.mastery.some(m => /^ai$/i.test(m.topic || '')), 'Ai mastery row survived')
})

test('Trigonometry becomes exactly one topic with one mastery number', () => {
  const { state } = cleanupLocalData(dirtyState())
  const trig = state.mastery.filter(m => /trigonometry/i.test(m.topic))
  assert.equal(trig.length, 1, `still ${trig.length} rows: ${trig.map(t => t.topic)}`)
  // Evidence is combined, not one row picked arbitrarily: 4+1+1 of 5+5+2.
  assert.equal(trig[0].attempts, 12)
  assert.equal(trig[0].correct, 6)
  assert.equal(trig[0].mastery, 0.5)
})

test('"General" is replaced where the topic makes the subject obvious', () => {
  const { state } = cleanupLocalData(dirtyState())
  const ohm = state.formulas.find(f => /ohm/i.test(f.topic || ''))
  assert.equal(ohm.subject, 'Physics')
  const mitosis = state.concepts.find(c => /mitosis/i.test(c.topic || ''))
  assert.equal(mitosis.subject, 'Biology')
})

test('"General" is deleted, never left in place, when nothing can be inferred', () => {
  const { state } = cleanupLocalData({
    ...dirtyState(),
    concepts: [{ topic: 'Photosynthesis', subject: 'General' }, { topic: 'Wave Optics', subject: 'General' }],
  })
  for (const c of state.concepts) {
    assert.notEqual(String(c.subject || '').toLowerCase(), 'general', 'a General tag survived')
  }
})

test('commands and wrong answers are removed from doubts; real questions stay', () => {
  const { state, report } = cleanupLocalData(dirtyState())
  assert.equal(state.doubts.length, 1, `kept ${state.doubts.length} doubts`)
  assert.match(state.doubts[0].question, /What is Ohm/)
  assert.equal(report.doubtsRemoved, 3)
})

test("the six Ohm's Law formulas merge into one, keeping the variants", () => {
  const { state } = cleanupLocalData(dirtyState())
  const ohms = state.formulas.filter(f => /ohm/i.test(f.topic || ''))
  assert.equal(ohms.length, 2, `expected Ohm's Law + Power, got ${ohms.length}`)
  const law = ohms.find(f => f.expr.includes('I') && !/P/.test(f.expr))
  assert.ok(law.variants.length >= 3, `only ${law.variants?.length} variants kept`)
})

test('P = V I is NOT merged into Ohm\'s law', () => {
  // Different relation, same topic. Merging these would lose a real formula.
  const { state } = cleanupLocalData(dirtyState())
  assert.ok(state.formulas.some(f => /P/.test(f.expr)), 'the power formula was swallowed')
})

test('duplicate flashcards collapse', () => {
  const { state } = cleanupLocalData(dirtyState())
  assert.equal(state.flashcards.length, 1)
})

test('cleanup is pure — the input state is not mutated in place', () => {
  const input = dirtyState()
  const before = input.doubts.length
  cleanupLocalData(input)
  assert.equal(input.doubts.length, before, 'input was mutated')
})

test('running cleanup twice changes nothing the second time', () => {
  const first = cleanupLocalData(dirtyState())
  const second = cleanupLocalData(first.state)
  assert.equal(second.report.doubtsRemoved, 0)
  assert.equal(second.report.formulasMerged, 0)
  assert.equal(second.report.masteryRowsMerged, 0)
  assert.equal(summarise(second.report), 'nothing to clean')
})

test('the report says what it did, for a dry run', () => {
  const { report } = cleanupLocalData(dirtyState())
  assert.ok(report.doubtsRemoved > 0 && report.formulasMerged > 0)
  assert.match(summarise(report), /removed|merged/)
})

// --- 2.5 spaced repetition ------------------------------------------------

test('due dates spread across days instead of all reading 0h', () => {
  // The reported bug: every topic said "forgetting in 0h".
  let card = {}
  const intervals = []
  for (let i = 0; i < 5; i++) { card = sm2(card, 4, NOW); intervals.push(card.interval) }
  assert.deepEqual(intervals.slice(0, 2), [1, 6])
  assert.ok(new Set(intervals).size > 1, 'every review produced the same interval')
  assert.ok(intervals[4] > intervals[2], 'intervals did not grow')
})

test('an overdue topic says overdue, not "0h"', () => {
  // Math.max(0, negative) is what erased this case and printed 0h.
  const s = dueState(NOW - 3 * DAY, NOW)
  assert.equal(s.state, 'overdue')
  assert.match(s.label, /3 days overdue/)
})

test('a freshly scheduled topic is not due', () => {
  const s = dueState(NOW + 6 * DAY, NOW)
  assert.equal(s.state, 'scheduled')
  assert.match(s.label, /6 days/)
})

test('Revise Soon shows only what is due within 48h, worst first, max 5', () => {
  const rows = [
    { topic: 'A', dueAt: NOW + 10 * DAY },
    { topic: 'B', dueAt: NOW - 2 * DAY },
    { topic: 'C', dueAt: NOW + 6 * HOUR },
    { topic: 'D', dueAt: NOW + 40 * HOUR },
    { topic: 'E', dueAt: NOW + 3 * DAY },
  ]
  const q = revisionQueue(rows, { now: NOW })
  assert.deepEqual(q.map(r => r.topic), ['B', 'C', 'D'], 'wrong set or order')
})

test('a lapse shortens the next interval and dents ease', () => {
  let card = sm2(sm2(sm2({}, 5, NOW), 5, NOW), 5, NOW)
  const lapsed = sm2(card, 1, NOW)
  assert.equal(lapsed.interval, 1)
  assert.ok(lapsed.ease < card.ease)
  assert.equal(lapsed.lapses, 1)
})

test('quality reflects difficulty, so a hard correct answer counts for more', () => {
  assert.ok(qualityFrom(true, 0.9) > qualityFrom(true, 0.2))
  assert.ok(qualityFrom(false, 0.9) < qualityFrom(true, 0.2))
})
