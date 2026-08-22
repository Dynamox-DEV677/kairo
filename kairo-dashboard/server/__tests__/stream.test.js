/**
 * C27 — stream guidance. The spec's bar: the suggestion must be DEMONSTRABLY
 * driven by real performance, not the quiz alone. These pin exactly that —
 * same quiz answers, different performance data → different suggestion.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  suggestStream, performanceScores, quizScores, PERF_WEIGHT,
} from '../../src/lib/stream.core.js'

const strongScience = [
  { subject: 'Physics', topic: 'motion', mastery: 0.9 },
  { subject: 'Chemistry', topic: 'atoms', mastery: 0.85 },
  { subject: 'Mathematics', topic: 'algebra', mastery: 0.8 },
]
const strongArts = [
  { subject: 'History', topic: 'revolt', mastery: 0.9 },
  { subject: 'English', topic: 'prose', mastery: 0.88 },
  { subject: 'Geography', topic: 'rivers', mastery: 0.82 },
]

test('DONE WHEN: same quiz answers, different real performance → different stream', () => {
  const artsLeaningQuiz = ['arts', 'arts', 'science', 'commerce']  // identical in both calls
  const a = suggestStream({ mastery: strongScience, signals: artsLeaningQuiz })
  const b = suggestStream({ mastery: strongArts, signals: artsLeaningQuiz })
  // Performance is weighted 0.6, so strong science mastery pulls the science
  // student toward Science DESPITE an arts-leaning quiz.
  assert.equal(a.top, 'science', 'strong science performance wins over an arts quiz')
  assert.equal(b.top, 'arts')
  assert.notEqual(a.top, b.top)
  assert.equal(a.dataStrength, 'ok')
})

test('with NO performance data, it leans on the quiz and says so', () => {
  const r = suggestStream({ mastery: [], signals: ['commerce', 'commerce', 'commerce', 'science'] })
  assert.equal(r.top, 'commerce')
  assert.equal(r.dataStrength, 'none')
})

test('MODEST but real science mastery still beats an all-arts quiz (relative standing)', () => {
  // The real-data trap: BKT mastery from a few quizzes is ~0.47, not 0.9. The
  // blend must weigh science's RELATIVE lead (0.47 vs arts 0), not raw size,
  // or a perfect arts quiz overpowers genuine performance.
  const modestScience = [
    { subject: 'Physics', topic: 'motion', mastery: 0.47 },
    { subject: 'Chemistry', topic: 'atoms', mastery: 0.47 },
  ]
  const r = suggestStream({ mastery: modestScience, signals: ['arts', 'arts', 'arts', 'arts'] })
  assert.equal(r.top, 'science', 'relative science strength wins despite an all-arts quiz')
})

test('performance is weighted more than the quiz (0.6 vs 0.4)', () => {
  assert.ok(PERF_WEIGHT > 0.5)
  // A science-strong student with a purely arts quiz still tilts science.
  const r = suggestStream({ mastery: strongScience, signals: ['arts', 'arts', 'arts', 'arts'] })
  assert.equal(r.top, 'science')
})

test('performanceScores maps subjects to streams and counts distinct subjects', () => {
  const { scores, distinctSubjects } = performanceScores(strongScience)
  assert.ok(scores.science > scores.arts)
  assert.ok(scores.science > 0.7)
  assert.equal(distinctSubjects >= 3, true)
  // Mathematics feeds BOTH science and commerce.
  assert.ok(scores.commerce > 0, 'maths lifts commerce too')
})

test('quizScores normalises to fractions that sum to ~1', () => {
  const q = quizScores(['science', 'science', 'commerce', 'arts'])
  assert.ok(Math.abs((q.science + q.commerce + q.arts) - 1) < 1e-9)
  assert.ok(q.science > q.commerce)
  assert.deepEqual(quizScores([]), { science: 0, commerce: 0, arts: 0 })
})

test('reasons cite the real evidence when performance backed the call', () => {
  const r = suggestStream({ mastery: strongScience, signals: ['science', 'science', 'commerce', 'arts'] })
  assert.ok(r.reasons.some(x => /mastery/i.test(x)), 'a reason cites real mastery %')
})

test('a near-tie is flagged rather than presented as certain', () => {
  // roughly balanced signals, no perf → the two top streams are close.
  const r = suggestStream({ mastery: [], signals: ['science', 'commerce'] })
  assert.equal(r.close, true)
})
