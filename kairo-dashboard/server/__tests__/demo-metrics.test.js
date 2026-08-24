/**
 * Audit task 2 — the demo twin's showcase numbers, pinned so they can never
 * again read "TREND −100% · PREDICTED —". The fixtures come from the SAME
 * pure dataset seedDemo uses (demoData.core.js), so this tests the truth.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  selectPerformanceTrend, selectPrediction, assessmentScores, ASSESSMENT_TYPES, PREDICTION_MIN_SCORED,
} from '../../src/lib/selectors.core.js'
import { DEMO_QUIZ_EVENTS } from '../../src/lib/demoData.core.js'

const NOW = 1_800_000_000_000
const toEvents = (rows) => rows.map(r => ({ ...r, ts: NOW - r.daysAgo * 86_400_000 }))

test('DONE WHEN: the demo dataset yields a sane trend and a real prediction', () => {
  const events = toEvents(DEMO_QUIZ_EVENTS)
  const trend = selectPerformanceTrend(events)
  assert.ok(trend > -0.2, `trend must not read as collapse; got ${trend}`)
  assert.ok(trend > 0, 'the demo story is an improving fortnight')

  const pred = selectPrediction(events, 100)
  assert.equal(pred.ready, true, `demo must clear the ${PREDICTION_MIN_SCORED}-assessment gate (has ${assessmentScores(events).length})`)
  assert.ok(pred.mid >= 55 && pred.mid <= 90, `predicted score is a believable number, got ${pred.mid}`)
})

test('root cause pinned: mistake bookkeeping (score 0) cannot move trend or prediction', () => {
  const events = toEvents(DEMO_QUIZ_EVENTS)
  const withMistakes = [
    ...events,
    { type: 'mistake', score: 0, correct: false, ts: NOW - 1000 },
    { type: 'mistake', score: 0, correct: false, ts: NOW - 900 },
    { type: 'mistake', score: 0, correct: false, ts: NOW - 800 },
  ]
  assert.equal(selectPerformanceTrend(withMistakes), selectPerformanceTrend(events))
  assert.deepEqual(selectPrediction(withMistakes, 100), selectPrediction(events, 100))
  assert.ok(!ASSESSMENT_TYPES.has('mistake'))
})

test('the old failure mode reproduced: counting mistakes DID crush the trend', () => {
  // A student with fine scores who logged three mistakes afterwards. Under
  // the old any-scored-event rule this sequence slopes hard negative.
  const good = [70, 75, 80, 85].map((score, i) => ({ type: 'quiz_answered', score, ts: NOW - (10 - i) * 86_400_000 }))
  const zeros = [0, 0, 0].map((score, i) => ({ type: 'mistake', score, ts: NOW - i }))
  const trend = selectPerformanceTrend([...good, ...zeros])
  assert.ok(trend > 0, 'assessments-only keeps the true upward trend')
})

test('below 4 assessments the trend refuses to guess', () => {
  const three = toEvents(DEMO_QUIZ_EVENTS.slice(0, 3))
  assert.equal(selectPerformanceTrend(three), 0)
})
