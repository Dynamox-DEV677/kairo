/**
 * Focus Lock — acceptance. The bar: only visibly-focused time counts, and the
 * streak/headline are earned from real history, never inflated.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sessionFocusedMs, focusStreakDays, weekMinutes, sessionHeadline,
  parseHistory, appendSession, HISTORY_CAP, MIN_STREAK_SESSION_MS,
} from '../../src/lib/focus.core.js'

const MIN = 60_000
const DAY = 86_400_000

test('DONE WHEN: drifted-away time cannot count as focus', () => {
  // 10 min focused, 5 min drifted (gap between segments), 5 more focused.
  const segs = [
    { start: 0, end: 10 * MIN },          // focused
    { start: 15 * MIN, end: 20 * MIN },   // back after a 5-min drift
  ]
  assert.equal(sessionFocusedMs(segs), 15 * MIN) // NOT 20
  // An open segment counts up to `now`, not beyond.
  assert.equal(sessionFocusedMs([{ start: 0 }], 7 * MIN), 7 * MIN)
})

test('streak counts consecutive real days, anchored to today OR yesterday', () => {
  const now = 100 * DAY + 13 * 3_600_000 // some 1pm
  const day = n => now - n * DAY
  const ok = ts => ({ ts, focusedMs: MIN_STREAK_SESSION_MS })
  // Sessions yesterday, day-2, day-3 → streak 3 even before today's session.
  assert.equal(focusStreakDays([ok(day(1)), ok(day(2)), ok(day(3))], now), 3)
  // A too-short session does not extend the streak.
  assert.equal(focusStreakDays([{ ts: day(1), focusedMs: MIN }, ok(day(2))], now), 0)
  // A gap breaks it.
  assert.equal(focusStreakDays([ok(day(0)), ok(day(2))], now), 1)
})

test('the headline is earned: longest-this-week only when it actually is', () => {
  const now = 50 * DAY
  const history = [
    { ts: now - 2 * DAY, focusedMs: 30 * MIN, drifts: 1 },
    { ts: now - 1 * DAY, focusedMs: 42 * MIN, drifts: 0 },
  ]
  const big = { ts: now, focusedMs: 45 * MIN, drifts: 2 }
  assert.match(sessionHeadline(big, [...history, big], now), /longest this week/)
  const small = { ts: now, focusedMs: 20 * MIN, drifts: 0 }
  assert.match(sessionHeadline(small, [...history, small], now), /zero drifts/)
  const tiny = { ts: now, focusedMs: 20_000, drifts: 0 }
  assert.match(sessionHeadline(tiny, [tiny], now), /Under a minute/)
})

test('week minutes only counts the last 7 days', () => {
  const now = 50 * DAY
  const h = [
    { ts: now - 8 * DAY, focusedMs: 60 * MIN }, // too old
    { ts: now - 1 * DAY, focusedMs: 25 * MIN },
    { ts: now, focusedMs: 5 * MIN },
  ]
  assert.equal(weekMinutes(h, now), 30)
})

test('history parsing survives junk and stays capped', () => {
  assert.deepEqual(parseHistory('nope'), [])
  assert.deepEqual(parseHistory('{"a":1}'), [])
  assert.equal(parseHistory(JSON.stringify([{ ts: 1, focusedMs: 5 }, { bad: true }])).length, 1)
  let h = []
  for (let i = 0; i < HISTORY_CAP + 20; i++) h = appendSession(h, { ts: i, focusedMs: MIN })
  assert.equal(h.length, HISTORY_CAP)
  assert.equal(h[h.length - 1].ts, HISTORY_CAP + 19, 'newest kept, oldest dropped')
})
