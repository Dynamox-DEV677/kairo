/**
 * C17 (prerequisite gate) + C13 (plan re-fit) — acceptance.
 *
 * C17 runs against the REAL shipped syllabus maps, so the prerequisite order
 * asserted here is the boards' own chapter order, not a fixture's.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prerequisitesFor, prereqGate, WEAK_BAR } from '../../src/lib/prereq.core.js'
import {
  readjustPlan, missedBlocks, planDayIndex, flattenDays, blockKey, MAX_CARRY_PER_DAY,
} from '../../src/lib/replan.core.js'
import { allTopics } from '../utils/syllabus.js'

const lookup = (b, c) => allTopics(b, c ?? undefined)

/* ── C17 ──────────────────────────────────────────────────────────────────── */

test('prerequisites are the real syllabus chapters that come before, nearest first', () => {
  // NCERT Class 9 Science: Gravitation follows Motion and Force and Laws of Motion.
  const pre = prerequisitesFor('Gravitation', { board: 'cbse', cls: '9', lookup })
  assert.ok(pre.length >= 2)
  assert.equal(pre[0], 'Force and Laws of Motion', 'nearest chapter first')
  assert.ok(pre.includes('Motion'))
})

test('the first chapter of a subject has no prerequisites', () => {
  const pre = prerequisitesFor('Matter in Our Surroundings', { board: 'cbse', cls: '9', lookup })
  assert.deepEqual(pre, [])
})

test('an unplaceable topic produces no gate rather than a guessed one', () => {
  assert.deepEqual(prerequisitesFor('underwater basket weaving', { board: 'cbse', cls: '9', lookup }), [])
  assert.equal(prereqGate('underwater basket weaving', { board: 'cbse', cls: '9', lookup, mastery: [] }), null)
})

test('DONE WHEN: a real weak prerequisite triggers a refresher offer', () => {
  const mastery = [
    { subject: 'Science', topic: 'force and laws of motion', chapter: 'Force and Laws of Motion', mastery: 0.3 },
  ]
  const g = prereqGate('Gravitation', { board: 'cbse', cls: '9', lookup, mastery })
  assert.ok(g, 'gate should fire')
  assert.equal(g.chapter, 'Force and Laws of Motion')
  assert.equal(g.evidence.mastery, 0.3)
  // The message pairs the gap with a next step and no shame words.
  assert.match(g.message, /brush-up|refresher|first/i)
  assert.ok(!/fail|weak student|bad|poor/i.test(g.message))
})

test('a STRONG prerequisite does not nag, and unknown mastery is not treated as weak', () => {
  const strong = [{ subject: 'Science', topic: 'force and laws of motion', mastery: 0.9 }]
  assert.equal(prereqGate('Gravitation', { board: 'cbse', cls: '9', lookup, mastery: strong }), null)
  // No mastery data at all => no gate. Gating every new user on every topic
  // would make the feature get turned off in a day.
  assert.equal(prereqGate('Gravitation', { board: 'cbse', cls: '9', lookup, mastery: [] }), null)
  assert.ok(WEAK_BAR < 0.6)
})

test('works on Cambridge structure too, not just NCERT', () => {
  // Radioactivity is in theme 5; its nearest prior themes come back in the
  // syllabus's own order. Momentum is in theme 1 and correctly has NONE —
  // first-theme topics must not gate.
  const pre = prerequisitesFor('Radioactivity', { board: 'cambridge', cls: '10', lookup })
  assert.ok(pre.includes('Electricity and magnetism'), pre.join(' | '))
  assert.deepEqual(prerequisitesFor('Momentum', { board: 'cambridge', cls: '10', lookup }), [])
})

/* ── C13 ──────────────────────────────────────────────────────────────────── */

const PLAN = {
  weeklySchedule: [
    { week: 1, focus: 'basics', days: [
      { day: 'Day 1', blocks: [
        { time: 'am', subject: 'Sci', topic: 'Motion', type: 'concept' },
        { time: 'pm', subject: 'Sci', topic: 'Motion numericals', type: 'practice' }] },
      { day: 'Day 2', blocks: [{ time: 'am', subject: 'Sci', topic: 'Force', type: 'concept' }] },
      { day: 'Day 3', blocks: [{ time: 'am', subject: '—', topic: 'rest', type: 'rest' }] },
      { day: 'Day 4', blocks: [{ time: 'am', subject: 'Sci', topic: 'Gravitation', type: 'concept' }] },
      { day: 'Day 5', blocks: [{ time: 'am', subject: 'Sci', topic: 'PYQ set', type: 'PYQ' }] },
    ] },
  ],
}

test('missed = past days, not checked off, rest never owed', () => {
  // Today is day index 3; day1 fully missed, day2 done, day3 was rest.
  const completion = { [blockKey(1, 'Day 2', 0)]: true }
  const missed = missedBlocks(PLAN, completion, 3)
  assert.equal(missed.length, 2)
  assert.deepEqual(missed.map(b => b.topic), ['Motion', 'Motion numericals'])
})

test('DONE WHEN: the plan demonstrably changes when days are missed', () => {
  const completion = { [blockKey(1, 'Day 2', 0)]: true }
  const r = readjustPlan(PLAN, completion, 3)
  assert.equal(r.changed, true)
  assert.equal(r.moved, 2)
  assert.deepEqual(r.overflow, [])

  const days = flattenDays(r.plan.weeklySchedule)
  const carried = days.flatMap(d => d.blocks.filter(b => b.carried))
  assert.equal(carried.length, 2)
  // Carried blocks land on days >= today, and each remembers where it came from.
  for (const d of days) {
    for (const b of d.blocks) {
      if (b.carried) {
        assert.ok(d.dayIndex >= 3, `carried block landed in the past: day ${d.dayIndex}`)
        assert.equal(b.from.day, 'Day 1')
      }
    }
  }
  // The original plan object is untouched.
  assert.equal(flattenDays(PLAN.weeklySchedule).flatMap(d => d.blocks).filter(b => b.carried).length, 0)
})

test('concept outranks PYQ when time is short, and overflow is said, not hidden', () => {
  // Only ONE future day with capacity 2, but 3 missed blocks.
  const tight = { weeklySchedule: [{ week: 1, focus: '', days: [
    { day: 'Day 1', blocks: [
      { topic: 'A', type: 'PYQ' }, { topic: 'B', type: 'concept' }, { topic: 'C', type: 'practice' }] },
    { day: 'Day 2', blocks: [{ topic: 'D', type: 'mock' }] },
  ] }] }
  const r = readjustPlan(tight, {}, 1)
  assert.equal(r.moved, MAX_CARRY_PER_DAY)
  assert.equal(r.overflow.length, 1)
  assert.equal(r.overflow[0].topic, 'A', 'the PYQ block is the one triaged out')
  const day2 = flattenDays(r.plan.weeklySchedule)[1]
  assert.deepEqual(day2.blocks.filter(b => b.carried).map(b => b.topic), ['B', 'C'])
})

test('nothing missed => nothing changes, and no false "behind" banner data', () => {
  const done = {}
  flattenDays(PLAN.weeklySchedule).forEach(d => d.blocks.forEach((b, i) => { done[blockKey(d.week, d.day, i)] = true }))
  const r = readjustPlan(PLAN, done, 5)
  assert.equal(r.changed, false)
  assert.equal(missedBlocks(PLAN, done, 5).length, 0)
})

test('planDayIndex is calendar math from the plan\'s creation moment', () => {
  const created = 1_700_000_000_000
  assert.equal(planDayIndex(created, created + 1000), 0)
  assert.equal(planDayIndex(created, created + 3.2 * 86_400_000), 3)
  assert.equal(planDayIndex(NaN, created), 0)
})
