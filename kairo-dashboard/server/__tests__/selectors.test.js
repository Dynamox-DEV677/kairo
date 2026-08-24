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
  selectWeakTopics, selectStrongTopics,
  selectStreakDetail, FREEZES_PER_WEEK,
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
  const ev = Array.from({ length: 5 }, (_, i) => ({ ts: daysAgo(i), type: 'quiz_answered', score: 70 }))
  const p = selectPrediction(ev)
  assert.equal(p.ready, false)
  assert.equal(p.need, PREDICTION_MIN_SCORED - 5)
  assert.match(p.reason, /15 more/)
})

test('prediction is identical across five reads — the 250 -> 180 bug', () => {
  // The old code sliced an UNSORTED array, so a reload could pick a different
  // 20 events and move the number with no new activity.
  const ev = Array.from({ length: 40 }, (_, i) => ({ ts: daysAgo(40 - i), type: 'quiz_answered', score: 40 + (i % 30) }))
  const runs = Array.from({ length: 5 }, () => JSON.stringify(selectPrediction(ev, 360)))
  assert.equal(new Set(runs).size, 1, `prediction drifted:\n${runs.join('\n')}`)
})

test('input order does not change the prediction', () => {
  const ev = Array.from({ length: 30 }, (_, i) => ({ ts: daysAgo(30 - i), type: 'quiz_answered', score: 50 + i }))
  const shuffled = [...ev].reverse()
  assert.deepEqual(selectPrediction(ev, 360), selectPrediction(shuffled, 360))
})

test('prediction is a range, never a bare number', () => {
  const ev = Array.from({ length: 25 }, (_, i) => ({ ts: daysAgo(25 - i), type: 'quiz_answered', score: 60 + (i % 10) }))
  const p = selectPrediction(ev, 360)
  assert.equal(p.ready, true)
  assert.ok(p.low < p.high, 'band collapsed to a point')
  assert.ok(p.low <= p.mid && p.mid <= p.high)
  assert.equal(p.outOf, 360)
})

test('an erratic student gets a wider band than a steady one', () => {
  const steady  = Array.from({ length: 25 }, (_, i) => ({ ts: daysAgo(25 - i), type: 'quiz_answered', score: 70 }))
  const erratic = Array.from({ length: 25 }, (_, i) => ({ ts: daysAgo(25 - i), type: 'quiz_answered', score: i % 2 ? 40 : 95 }))
  const s = selectPrediction(steady, 360)
  const e = selectPrediction(erratic, 360)
  assert.ok((e.high - e.low) > (s.high - s.low), 'band did not widen for erratic scores')
})

test('prediction stays inside the paper total', () => {
  const ev = Array.from({ length: 25 }, (_, i) => ({ ts: daysAgo(25 - i), type: 'quiz_answered', score: 100 }))
  const p = selectPrediction(ev, 360)
  assert.ok(p.high <= 360, `high ${p.high} exceeds the paper`)
  assert.ok(p.low >= 0)
})

// --- Phase 1.3 acceptance: five reloads, no user action ------------------

/**
 * The reported bug in one assertion. A "reload" is a fresh read of the same
 * stored state, which is exactly what these pure functions model — so if this
 * holds, no screen can show a different number than another screen on the same
 * data, and no reload can move a number on its own.
 */
function dashboardSnapshot(events, mastery, game, now) {
  const xp = selectXP(game)
  return JSON.stringify({
    streak:     selectStreak(events, now),
    xp,
    level:      selectLevel(xp.total),
    mastered:   selectMastered(mastery),
    retention:  selectRetention(mastery),
    prediction: selectPrediction(events, 360),
  })
}

test('five reloads with no activity produce byte-identical numbers', () => {
  // A realistic account: 40 days of activity, 30 scored attempts, mixed mastery.
  const events = [
    ...Array.from({ length: 40 }, (_, d) => ({ ts: daysAgo(d) })),
    ...Array.from({ length: 30 }, (_, i) => ({ ts: daysAgo(30 - i), type: 'quiz_answered', score: 45 + (i * 7) % 50 })),
  ]
  const mastery = [
    { mastery: 0.92, attempts: 11 }, { mastery: 0.71, attempts: 6 },
    { mastery: 0.44, attempts: 9 },  { mastery: 0.18, attempts: 4 },
  ]
  const game = { totalXP: 1340, todayXP: 60, weekXP: 300 }

  const runs = Array.from({ length: 5 }, () => dashboardSnapshot(events, mastery, game, NOW))
  assert.equal(new Set(runs).size, 1,
    `numbers drifted across reloads:\n${[...new Set(runs)].join('\n\n')}`)
})

test('event order in storage does not change any displayed number', () => {
  // Events are appended, and a sync or restore can reorder them. None of that
  // may change what the student sees.
  const events = [
    ...Array.from({ length: 25 }, (_, d) => ({ ts: daysAgo(d) })),
    ...Array.from({ length: 22 }, (_, i) => ({ ts: daysAgo(22 - i), type: 'quiz_answered', score: 50 + i })),
  ]
  const mastery = [{ mastery: 0.8, attempts: 5 }]
  const game = { totalXP: 420 }

  const a = dashboardSnapshot(events, mastery, game, NOW)
  const b = dashboardSnapshot([...events].reverse(), mastery, game, NOW)
  assert.equal(a, b, 'reordering the event log changed the dashboard')
})

test('a brand-new account shows honest zeros, not fake numbers', () => {
  const snap = JSON.parse(dashboardSnapshot([], [], {}, NOW))
  assert.equal(snap.streak, 0)
  assert.equal(snap.xp.total, 0)
  assert.equal(snap.level.level, 1)
  assert.equal(snap.mastered, 0)
  assert.equal(snap.retention, null, 'retention must be unknown, not 0%')
  assert.equal(snap.prediction.ready, false, 'must not predict from no data')
})

// --- weak / strong topics -------------------------------------------------

test('a topic is never both weak and strong', () => {
  const m = [
    { topic: 'Electricity', mastery: 0.2, attempts: 6 },
    { topic: 'Trigonometry', mastery: 0.85, attempts: 5 },
    { topic: 'Light', mastery: 0.5, attempts: 4 },
  ]
  const weak = selectWeakTopics(m).map(t => t.topic)
  const strong = selectStrongTopics(m).map(t => t.topic)
  assert.equal(weak.filter(t => strong.includes(t)).length, 0,
    `overlap: ${weak.filter(t => strong.includes(t))}`)
})

test('one unlucky answer does not brand a topic weak', () => {
  const m = [{ topic: 'Heredity', mastery: 0.1, attempts: 1 }]
  assert.deepEqual(selectWeakTopics(m), [], 'called weak after a single attempt')
})

test('weak topics come back worst-first', () => {
  const m = [
    { topic: 'A', mastery: 0.40, attempts: 3 },
    { topic: 'B', mastery: 0.10, attempts: 3 },
    { topic: 'C', mastery: 0.25, attempts: 3 },
  ]
  assert.deepEqual(selectWeakTopics(m).map(t => t.topic), ['B', 'C', 'A'])
})

test('severity is derived from mastery, not stored separately', () => {
  const [t] = selectWeakTopics([{ topic: 'X', mastery: 0.3, attempts: 4 }])
  assert.equal(t.severity, 0.7)
})

// --- streak freeze (grace mechanic) --------------------------------------

test('one missed day is forgiven instead of collapsing the streak', () => {
  // Seven days, one missed. The freeze must preserve the run — but it must NOT
  // count the missed day as studied. The student did six days; claiming seven
  // would be exactly the kind of flattering fake number this app is trying to
  // stop showing.
  const ev = [0, 1, 2, 4, 5, 6].map(d => ({ ts: daysAgo(d) }))
  const r = selectStreakDetail(ev, NOW)

  assert.equal(r.streak, 6, `expected the 6 days actually studied, got ${r.streak}`)
  assert.equal(r.usedFreeze, true)

  // Without the grace mechanic the same history reads as 3 — which is what
  // made a student who showed up six times feel like they had failed.
  assert.equal(selectStreak(ev, NOW), 3)
})

test('a second miss in the same week does end the streak', () => {
  const ev = [0, 1, 4, 5, 6].map(d => ({ ts: daysAgo(d) }))   // 2 and 3 missing
  const r = selectStreakDetail(ev, NOW)
  assert.ok(r.streak < 7, `freeze covered two misses: ${r.streak}`)
})

test('freezes do not accumulate — one per week, not one per gap', () => {
  const ev = Array.from({ length: 30 }, (_, d) => d).filter(d => d % 3 !== 0)
    .map(d => ({ ts: daysAgo(d) }))
  const r = selectStreakDetail(ev, NOW)
  assert.ok(r.streak < 30, 'every third day missing still produced a full streak')
})

test('an unbroken week reports its freeze unspent', () => {
  const ev = [0, 1, 2, 3, 4, 5, 6].map(d => ({ ts: daysAgo(d) }))
  const r = selectStreakDetail(ev, NOW)
  assert.equal(r.streak, 7)
  assert.equal(r.freezesLeftThisWeek, FREEZES_PER_WEEK)
  assert.equal(r.usedFreeze, false)
})

test('not having studied yet today never spends a freeze', () => {
  // A student at 9am. Charging them a freeze for a day still in progress would
  // silently burn their one grace day every morning.
  const ev = [1, 2, 3].map(d => ({ ts: daysAgo(d) }))
  const r = selectStreakDetail(ev, NOW)
  assert.equal(r.streak, 3)
  assert.equal(r.freezesLeftThisWeek, FREEZES_PER_WEEK)
})

test('the freeze streak is deterministic across five reads', () => {
  const ev = [0, 1, 2, 4, 5, 6].map(d => ({ ts: daysAgo(d) }))
  const runs = Array.from({ length: 5 }, () => JSON.stringify(selectStreakDetail(ev, NOW)))
  assert.equal(new Set(runs).size, 1, 'freeze accounting drifted between reads')
})

test('an empty log is a zero streak with a full allowance', () => {
  const r = selectStreakDetail([], NOW)
  assert.equal(r.streak, 0)
  assert.equal(r.freezesLeftThisWeek, FREEZES_PER_WEEK)
})
