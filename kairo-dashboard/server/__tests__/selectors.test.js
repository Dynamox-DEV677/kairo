/**
 * Phase 0.3 acceptance: reload five times, get the same numbers.
 *
 * These pin the specific contradictions reported from the live app —
 * "3 day streak" next to "0 day streak" next to "0d", and a prediction that
 * moved 250 -> 180 on a plain reload with no new activity.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  selectStreak, selectXP, selectLevel, selectMastered, selectRetention,
  selectPrediction, PREDICTION_MIN_SCORED, MASTERY_BAR,
} from '../../src/lib/selectors.core.js'

const DAY = 86_400_000
const NOW = Date.parse('2026-08-14T10:00:00Z')
const daysAgo = (n) => NOW - n * DAY

// --- streak ---------------------------------------------------------------

test('an empty log is a zero streak, not a crash', () => {
  assert.equal(selectStreak([], NOW), 0)
  assert.equal(selectStreak(null, NOW), 0)
})

test('consecutive days count', () => {
  const ev = [0, 1, 2].map(d => ({ ts: daysAgo(d) }))
  assert.equal(selectStreak(ev, NOW), 3)
})

test('no activity yet today does not break the streak', () => {
  // A student at 9am has not studied today. Resetting them to 0 is the bug.
  const ev = [1, 2, 3].map(d => ({ ts: daysAgo(d) }))
  assert.equal(selectStreak(ev, NOW), 3)
})

test('a fully missed day does break it', () => {
  const ev = [1, 3, 4].map(d => ({ ts: daysAgo(d) }))
  assert.equal(selectStreak(ev, NOW), 1)
})

test('a streak longer than 60 days is not truncated', () => {
  // twin.ts computed this over a 60-day event window, so day 61 onward
  // silently vanished and a 90-day streak displayed as 60.
  const ev = Array.from({ length: 90 }, (_, d) => ({ ts: daysAgo(d) }))
  assert.equal(selectStreak(ev, NOW), 90)
})

test('several events in one day count as one day', () => {
  const ev = [
    { ts: daysAgo(0) }, { ts: daysAgo(0) + 3600_000 }, { ts: daysAgo(0) + 7200_000 },
    { ts: daysAgo(1) },
  ]
  assert.equal(selectStreak(ev, NOW), 2)
})

test('streak is stable across repeated reads — the reported bug', () => {
  const ev = [0, 1, 2].map(d => ({ ts: daysAgo(d) }))
  const runs = Array.from({ length: 5 }, () => selectStreak(ev, NOW))
  assert.deepEqual(runs, [3, 3, 3, 3, 3], 'streak drifted between reads')
})

// --- xp and level ---------------------------------------------------------

test('XP never reads negative or NaN', () => {
  assert.deepEqual(selectXP({ totalXP: -50 }), { total: 0, today: 0, week: 0 })
  assert.deepEqual(selectXP({ totalXP: 'abc' }), { total: 0, today: 0, week: 0 })
  assert.deepEqual(selectXP(null), { total: 0, today: 0, week: 0 })
})

test('level thresholds are computed in one place only', () => {
  assert.equal(selectLevel(0).level, 1)
  assert.equal(selectLevel(99).level, 1)
  assert.equal(selectLevel(100).level, 2)
  assert.equal(selectLevel(300).level, 3)   // 100 + 200
  assert.equal(selectLevel(600).level, 4)   // 100 + 200 + 300
})

test('level progress never exceeds its own requirement', () => {
  for (let xp = 0; xp < 5000; xp += 37) {
    const l = selectLevel(xp)
    assert.ok(l.into < l.need, `xp ${xp}: into ${l.into} >= need ${l.need}`)
    assert.ok(l.pct >= 0 && l.pct <= 100)
  }
})

// --- mastery and retention ------------------------------------------------

test('mastered counts only rows at or above the bar', () => {
  const m = [{ mastery: 0.9 }, { mastery: MASTERY_BAR }, { mastery: 0.69 }, { mastery: 0.1 }]
  assert.equal(selectMastered(m), 2)
})

test('retention is null with no data, never 0%', () => {
  // "Retention 0%" to a student who has answered correctly reads as "you have
  // forgotten everything" when it means "we have no data".
  assert.equal(selectRetention([]), null)
  assert.equal(selectRetention([{ mastery: 0.8, attempts: 0 }]), null)
})

test('retention reflects real mastery once there is data', () => {
  assert.equal(selectRetention([{ mastery: 0.8, attempts: 3 }, { mastery: 0.6, attempts: 2 }]), 70)
})

// --- prediction -----------------------------------------------------------

test('no prediction below the evidence bar, and it says how many more', () => {
  const ev = Array.from({ length: 5 }, (_, i) => ({ ts: daysAgo(i), score: 70 }))
  const p = selectPrediction(ev)
  assert.equal(p.ready, false)
  assert.equal(p.need, PREDICTION_MIN_SCORED - 5)
  assert.match(p.reason, /15 more/)
})

test('prediction is identical across five reads — the 250 -> 180 bug', () => {
  // The old code sliced an UNSORTED array, so a reload could pick a different
  // 20 events and move the number with no new activity.
  const ev = Array.from({ length: 40 }, (_, i) => ({ ts: daysAgo(40 - i), score: 40 + (i % 30) }))
  const runs = Array.from({ length: 5 }, () => JSON.stringify(selectPrediction(ev, 360)))
  assert.equal(new Set(runs).size, 1, `prediction drifted:\n${runs.join('\n')}`)
})

test('input order does not change the prediction', () => {
  const ev = Array.from({ length: 30 }, (_, i) => ({ ts: daysAgo(30 - i), score: 50 + i }))
  const shuffled = [...ev].reverse()
  assert.deepEqual(selectPrediction(ev, 360), selectPrediction(shuffled, 360))
})

test('prediction is a range, never a bare number', () => {
  const ev = Array.from({ length: 25 }, (_, i) => ({ ts: daysAgo(25 - i), score: 60 + (i % 10) }))
  const p = selectPrediction(ev, 360)
  assert.equal(p.ready, true)
  assert.ok(p.low < p.high, 'band collapsed to a point')
  assert.ok(p.low <= p.mid && p.mid <= p.high)
  assert.equal(p.outOf, 360)
})

test('an erratic student gets a wider band than a steady one', () => {
  const steady  = Array.from({ length: 25 }, (_, i) => ({ ts: daysAgo(25 - i), score: 70 }))
  const erratic = Array.from({ length: 25 }, (_, i) => ({ ts: daysAgo(25 - i), score: i % 2 ? 40 : 95 }))
  const s = selectPrediction(steady, 360)
  const e = selectPrediction(erratic, 360)
  assert.ok((e.high - e.low) > (s.high - s.low), 'band did not widen for erratic scores')
})

test('prediction stays inside the paper total', () => {
  const ev = Array.from({ length: 25 }, (_, i) => ({ ts: daysAgo(25 - i), score: 100 }))
  const p = selectPrediction(ev, 360)
  assert.ok(p.high <= 360, `high ${p.high} exceeds the paper`)
  assert.ok(p.low >= 0)
})
