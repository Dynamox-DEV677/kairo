/**
 * C28 — mistake-pattern analyser. The categories must be EARNED from real
 * timing + mastery, and where timing is absent the classifier must not invent
 * a timing-based reason.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyMistakes, STRONG_MASTERY } from '../../src/lib/mistakes.core.js'

const NOW = 1_700_000_000_000
const ev = (topic, correct, durationMs, difficulty = 0.5, ago = 1) => ({
  type: 'quiz_answered', topic, subject: 'Physics', correct,
  durationMs, difficulty, ts: NOW - ago * 3_600_000,
})

test('a fast wrong answer on a strong topic is a careless slip', () => {
  const events = [
    // establish a ~40s median on "motion"
    ev('motion', true, 40_000), ev('motion', true, 42_000), ev('motion', true, 38_000),
    // then a wrong one answered in 10s — well under half the median
    ev('motion', false, 10_000),
  ]
  const mastery = [{ topic: 'motion', mastery: 0.8 }]  // strong
  const r = classifyMistakes(events, mastery, { now: NOW })
  const careless = r.categories.find(c => c.key === 'careless')
  assert.ok(careless, 'careless bucket present')
  assert.equal(careless.topics[0].topic, 'motion')
})

test('a slow wrong answer is time pressure', () => {
  const events = [
    ev('optics', true, 30_000), ev('optics', true, 30_000), ev('optics', true, 30_000),
    ev('optics', false, 70_000),  // > 1.6x median
  ]
  const r = classifyMistakes(events, [{ topic: 'optics', mastery: 0.7 }], { now: NOW })
  assert.ok(r.categories.find(c => c.key === 'timing'), 'timing bucket present')
})

test('repeated wrongs on a low-mastery topic are a concept gap', () => {
  const events = [
    ev('thermo', false, 45_000, 0.6), ev('thermo', false, 50_000, 0.6),
    ev('thermo', true, 48_000, 0.6),
  ]
  const r = classifyMistakes(events, [{ topic: 'thermo', mastery: 0.25 }], { now: NOW })
  const gap = r.categories.find(c => c.key === 'conceptual')
  assert.ok(gap)
  assert.equal(gap.topics[0].topic, 'thermo')
})

test('no timing data => no fabricated timing calls, and it says so', () => {
  const events = [
    { type: 'quiz_answered', topic: 'waves', correct: false, difficulty: 0.6, ts: NOW - 3_600_000 },
    { type: 'quiz_answered', topic: 'waves', correct: false, difficulty: 0.6, ts: NOW - 7_200_000 },
  ]
  const r = classifyMistakes(events, [{ topic: 'waves', mastery: 0.3 }], { now: NOW })
  assert.equal(r.timedShare, 0)
  assert.equal(r.categories.every(c => c.key !== 'timing'), true, 'no timing category without timing data')
})

test('correct answers are never counted as mistakes', () => {
  const events = [ev('a', true, 10_000), ev('b', true, 10_000)]
  const r = classifyMistakes(events, [], { now: NOW })
  assert.equal(r.total, 0)
  assert.deepEqual(r.categories, [])
})

test('old attempts outside the window are ignored', () => {
  const events = [ev('x', false, 10_000, 0.3, 24 * 40)]  // 40 days ago
  const r = classifyMistakes(events, [], { now: NOW, windowDays: 30 })
  assert.equal(r.total, 0)
})

test('every emitted category carries a fix, and STRONG_MASTERY is a real bar', () => {
  const events = [ev('m', false, 10_000, 0.3), ev('m', true, 30_000), ev('m', true, 30_000), ev('m', true, 30_000)]
  const r = classifyMistakes(events, [{ topic: 'm', mastery: 0.9 }], { now: NOW })
  for (const c of r.categories) assert.ok(c.fix && c.fix.length > 15, c.key + ' needs a fix line')
  assert.ok(STRONG_MASTERY > 0 && STRONG_MASTERY < 1)
})
