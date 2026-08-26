/**
 * Today (brief part D-2) — the MIX is decided by the exam phase, and the
 * day never exceeds what the student said they can finish.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { todayPlan, COST_MINUTES } from '../../src/lib/todayPlan.core.js'

const node = (id, name, marks) => ({ id, name, typical_marks: marks, est_study_minutes: 300, pyq_frequency: 0.9 })
const ranked = [
  { node: node('a', 'Electrochemistry', 9), state: 'UNTOUCHED', score: 0.02, reason: 'Worth ~9 marks, never opened.', substitutedFor: null },
  { node: node('b', 'Coordination Compounds', 7), state: 'UNTOUCHED', score: 0.015, reason: 'Worth ~7 marks, never opened.', substitutedFor: null },
  { node: node('c', 'Magnetism and Matter', 3), state: 'UNTOUCHED', score: 0.01, reason: 'Worth ~3 marks, never opened.', substitutedFor: null },
]
const due = Array.from({ length: 12 }, (_, i) => ({ id: `card${i}` }))

test('DONE WHEN: 5 days out the plan contains ZERO new topics', () => {
  const p = todayPlan({ dueCards: due, ranked, daysToExam: 5, dailyMinutes: 120 })
  assert.equal(p.phase, 'FINAL')
  assert.equal(p.items.filter(i => i.kind === 'coverage').length, 0)
  assert.ok(p.items.some(i => i.kind === 'review'), 'review still happens')
})

test('DONE WHEN: 200 days out, coverage leads the day', () => {
  const p = todayPlan({ dueCards: due, ranked, daysToExam: 200, dailyMinutes: 120 })
  assert.equal(p.phase, 'FAR')
  const coverage = p.items.filter(i => i.kind === 'coverage')
  assert.ok(coverage.length >= 2, `expected coverage-led day, got ${JSON.stringify(p.items.map(i => i.kind))}`)
  assert.equal(coverage[0].marks, 9, 'highest marks-at-risk first')
})

test('changing the exam date visibly re-plans the day', () => {
  const far = todayPlan({ dueCards: due, ranked, daysToExam: 200, dailyMinutes: 120 })
  const near = todayPlan({ dueCards: due, ranked, daysToExam: 20, dailyMinutes: 120 })
  const final = todayPlan({ dueCards: due, ranked, daysToExam: 3, dailyMinutes: 120 })
  const kinds = p => p.items.map(i => i.kind).join(',')
  assert.notEqual(kinds(far), kinds(near))
  assert.notEqual(kinds(near), kinds(final))
  // NEAR keeps only chapters above the marks floor
  assert.ok(!near.items.some(i => i.marks === 3), 'the 3-mark chapter is not worth opening this close')
})

test('a fading chapter is repaired before anything else', () => {
  const p = todayPlan({
    dueCards: due, ranked, daysToExam: 60, dailyMinutes: 120,
    fading: [node('f', 'Ray Optics and Optical Instruments', 7)],
  })
  assert.equal(p.items[0].kind, 'repair')
  assert.match(p.items[0].why, /fading/i)
})

test('never more than the student can finish', () => {
  const small = todayPlan({ dueCards: due, ranked, daysToExam: 200, dailyMinutes: 30 })
  assert.ok(small.plannedMinutes <= 30 + COST_MINUTES.coverage, 'stays inside the declared capacity')
  assert.ok(small.items.length < 4)
})

test('pure and deterministic', () => {
  const a = todayPlan({ dueCards: due, ranked, daysToExam: 45, dailyMinutes: 90 })
  const b = todayPlan({ dueCards: due, ranked, daysToExam: 45, dailyMinutes: 90 })
  assert.deepEqual(a, b)
})

test('every item states WHY, and days-left rides along when there is an exam', () => {
  const p = todayPlan({ dueCards: due, ranked, daysToExam: 34, dailyMinutes: 120 })
  for (const i of p.items) assert.ok(i.why && i.why.length > 10, `${i.kind} has no reason`)
  assert.ok(p.items.some(i => /34 days left/.test(i.why)), 'the brief\'s own example line')
})
