/**
 * C24 (chapter time) + C19 (recovery plan) — acceptance.
 *
 * C24's bar: "displayed time breakdown matches real logged session activity."
 * These tests drive the same credit/aggregate path the UI reads, so the sum on
 * screen IS the sum of the logged credits.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyStore, readStore, credit, aggregate, formatMs, dayKey,
  MAX_CREDIT_MS, MIN_CREDIT_MS, KEEP_DAYS,
} from '../../src/lib/time.core.js'
import { recoveryPlan } from '../../src/lib/daily.core.js'

const NOW = 1_700_000_000_000
const DAY = 86_400_000
const MIN = 60_000

/* ── C24 ──────────────────────────────────────────────────────────────────── */

test('the breakdown is exactly the sum of the logged credits', () => {
  let s = emptyStore()
  s = credit(s, { subject: 'Physics', topic: 'ohms law', ms: 5 * MIN, ts: NOW })
  s = credit(s, { subject: 'Physics', topic: 'ohms law', ms: 3 * MIN, ts: NOW })
  s = credit(s, { subject: 'Math', topic: 'quadratics', ms: 7 * MIN, ts: NOW })

  const a = aggregate(s, NOW)
  assert.equal(a.totalMs, 15 * MIN)
  assert.equal(a.subjects[0].subject, 'Physics') // 8m > 7m, biggest first
  assert.equal(a.subjects[0].ms, 8 * MIN)
  assert.equal(a.subjects[0].topics[0].topic, 'ohms law')
  assert.equal(a.subjects[1].ms, 7 * MIN)
})

test('today vs week vs lifetime split off real timestamps', () => {
  let s = emptyStore()
  s = credit(s, { subject: 'Math', topic: 'algebra', ms: 6 * MIN, ts: NOW })            // today
  s = credit(s, { subject: 'Math', topic: 'algebra', ms: 6 * MIN, ts: NOW - 3 * DAY })  // this week
  s = credit(s, { subject: 'Math', topic: 'algebra', ms: 6 * MIN, ts: NOW - 20 * DAY }) // older

  const a = aggregate(s, NOW)
  assert.equal(a.todayMs, 6 * MIN)
  assert.equal(a.weekMs, 12 * MIN)
  assert.equal(a.totalMs, 18 * MIN)
})

test('a parked tab cannot bank hours — single credits clamp at 10 minutes', () => {
  const s = credit(emptyStore(), { subject: 'Bio', topic: 'cells', ms: 11 * 60 * 60_000, ts: NOW })
  assert.equal(aggregate(s, NOW).totalMs, MAX_CREDIT_MS)
})

test('blips under 5 seconds are not study and are dropped', () => {
  const s = credit(emptyStore(), { subject: 'Bio', topic: 'cells', ms: MIN_CREDIT_MS - 1, ts: NOW })
  assert.equal(aggregate(s, NOW).totalMs, 0)
})

test('missing subject/topic falls into honest buckets, never invented ones', () => {
  const s = credit(emptyStore(), { ms: 2 * MIN, ts: NOW })
  const a = aggregate(s, NOW)
  assert.equal(a.subjects[0].subject, 'General')
  assert.equal(a.subjects[0].topics[0].topic, '—')
})

test('day buckets trim but the lifetime total never loses time', () => {
  let s = emptyStore()
  for (let i = 0; i < KEEP_DAYS + 20; i++) {
    s = credit(s, { subject: 'M', topic: 't', ms: MIN, ts: NOW - i * DAY })
  }
  const row = s.rows['M|t']
  assert.ok(Object.keys(row.days).length <= KEEP_DAYS)
  assert.equal(row.ms, (KEEP_DAYS + 20) * MIN, 'lifetime sum keeps trimmed days')
})

test('corrupt storage starts fresh instead of crashing', () => {
  for (const junk of [null, '', 'not json', '{"v":9}', 42]) {
    assert.deepEqual(readStore(junk), emptyStore(), JSON.stringify(junk))
  }
})

test('formatMs renders one clean unit pair', () => {
  assert.equal(formatMs(45_000), '45s')
  assert.equal(formatMs(12 * MIN), '12m')
  assert.equal(formatMs(84 * MIN), '1h 24m')
})

test('dayKey is local-date stable across a day', () => {
  assert.equal(dayKey(NOW), dayKey(NOW + 1000))
})

/* ── C19 ──────────────────────────────────────────────────────────────────── */

const q = (topic, correct, subject = 'Science') => ({ topic, correct, subject })

test('DONE WHEN: the plan is tied to THIS test\'s real wrong answers', () => {
  const plan = recoveryPlan([
    q('gravitation', false), q('gravitation', false), q('gravitation', true),
    q('sound', false), q('sound', true),
    q('motion', true), q('motion', true),
  ])
  assert.ok(plan)
  // Most-missed first, and the counts are the attempt's real counts.
  assert.equal(plan.steps[0].topic, 'gravitation')
  assert.equal(plan.steps[0].wrong, 2)
  assert.equal(plan.steps[0].total, 3)
  assert.equal(plan.steps[1].topic, 'sound')
  // Fully-correct topics are anchors, not steps.
  assert.deepEqual(plan.solid, ['motion'])
  assert.ok(!plan.steps.some(s => s.topic === 'motion'))
})

test('all-missed vs partly-missed get different, specific actions', () => {
  const plan = recoveryPlan([q('optics', false), q('optics', false), q('algebra', false), q('algebra', true)])
  const optics = plan.steps.find(s => s.topic === 'optics')
  const algebra = plan.steps.find(s => s.topic === 'algebra')
  assert.match(optics.action, /Re-learn/)
  assert.match(algebra.action, /1 of 2 right/)
  // Tone rule: no shame words anywhere in the plan copy.
  for (const s of plan.steps) assert.ok(!/fail|bad|poor|weak student|careless/i.test(s.action), s.action)
})

test('a clean run produces no manufactured plan', () => {
  assert.equal(recoveryPlan([q('sound', true), q('motion', true)]), null)
  assert.equal(recoveryPlan([]), null)
})
