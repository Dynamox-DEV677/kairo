/**
 * C8 / C29 / C11 — acceptance.
 *
 * The spec's bar for each: micro-goals demonstrably tied to THAT student's
 * real weak/upcoming topics; the growth stat a real measured change over time;
 * difficulty demonstrably shifting on a real right/wrong sequence.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  todaysThree, growthStat, nextDifficulty, MIN_ATTEMPTS, MIN_SIGNAL,
} from '../../src/lib/daily.core.js'

const NOW = 1_700_000_000_000
const DAY = 86_400_000

const TWIN = {
  forgettingSoon: [{ subject: 'Physics', topic: 'ohms law', hoursUntilForget: 6, mastery: 0.6, overdue: false }],
  weakTopics: [
    { subject: 'Math', topic: 'quadratic equations', mastery: 0.3, severity: 0.8, attempts: 5, lastStudiedAt: NOW - DAY },
    { subject: 'Chemistry', topic: 'mole concept', mastery: 0.4, severity: 0.6, attempts: 3, lastStudiedAt: NOW - DAY },
  ],
  strongTopics: [{ subject: 'Biology', topic: 'cells', mastery: 0.9, severity: 0, attempts: 8, lastStudiedAt: NOW }],
}

/* ── C8 ───────────────────────────────────────────────────────────────────── */

test('DONE WHEN: the 3 tasks are tied to this student\'s real records', () => {
  const tasks = todaysThree({ twin: TWIN, dueCards: 4, examDates: [], now: NOW })
  assert.equal(tasks.length, 3)
  // Task 1: the forgetting-curve entry, by name.
  assert.match(tasks[0].title, /ohms law/)
  assert.equal(tasks[0].kind, 'revise')
  // Task 2: the weakest topic, by name, with its real attempt count in the why.
  assert.match(tasks[1].title, /quadratic equations/)
  assert.match(tasks[1].why, /5 attempts/)
  // Task 3: the real due-card count.
  assert.match(tasks[2].title, /4 due cards/)
  // Every task carries a destination — a gap is never stated without a next step.
  for (const t of tasks) { assert.ok(t.to); assert.ok(t.why.length > 20) }
})

test('an exam the student typed becomes a plan task with real day math', () => {
  const tasks = todaysThree({
    twin: { ...TWIN, forgettingSoon: [] }, dueCards: 0,
    examDates: [{ name: 'Physics unit test', date: new Date(NOW + 3 * DAY).toISOString().slice(0, 10) }],
    now: NOW,
  })
  const plan = tasks.find(t => t.kind === 'plan')
  assert.ok(plan, 'exam task missing')
  assert.match(plan.title, /Physics unit test/)
  assert.match(plan.why, /3 days/)
})

test('past exams are ignored; no data means fewer honest tasks, not filler', () => {
  const tasks = todaysThree({
    twin: {}, dueCards: 0,
    examDates: [{ name: 'Old exam', date: new Date(NOW - 2 * DAY).toISOString().slice(0, 10) }],
    now: NOW,
  })
  assert.deepEqual(tasks, [], 'no records -> no invented tasks')
})

test('the same day and data give the same three — no reshuffle per visit', () => {
  const a = todaysThree({ twin: TWIN, dueCards: 2, examDates: [], now: NOW })
  const b = todaysThree({ twin: TWIN, dueCards: 2, examDates: [], now: NOW + 60_000 })
  assert.deepEqual(a.map(t => t.title), b.map(t => t.title))
})

/* ── C29 ──────────────────────────────────────────────────────────────────── */

const answer = (daysAgo, correct) => ({ type: 'quiz_answered', ts: NOW - daysAgo * DAY, correct })

test('DONE WHEN: the growth stat is a real measured change over time', () => {
  const events = [
    // three weeks ago: 2/6 right
    ...[1, 0, 0, 1, 0, 0].map((c, i) => answer(15 + i * 0.1, !!c)),
    // this week: 5/6 right
    ...[1, 1, 1, 0, 1, 1].map((c, i) => answer(1 + i * 0.1, !!c)),
  ]
  const g = growthStat(events, NOW)
  assert.equal(g.ready, true)
  assert.equal(g.accBefore, 33)
  assert.equal(g.accNow, 83)
  assert.equal(g.deltaPts, 50)
})

test('too little data says so instead of showing a noise number', () => {
  const g = growthStat([answer(1, true), answer(2, false), answer(15, true)], NOW)
  assert.equal(g.ready, false)
  assert.equal(g.needed, MIN_ATTEMPTS)
})

test('a dip is reported as a real negative delta — the honesty is upstream of the copy', () => {
  const events = [
    ...[1, 1, 1, 1, 1].map((c, i) => answer(14 + i * 0.1, !!c)),
    ...[0, 0, 1, 0, 0].map((c, i) => answer(1 + i * 0.1, !!c)),
  ]
  const g = growthStat(events, NOW)
  assert.equal(g.ready, true)
  assert.ok(g.deltaPts < 0)
})

/* ── C11 ──────────────────────────────────────────────────────────────────── */

test('DONE WHEN: difficulty shifts on a real right/wrong sequence', () => {
  const rightRun = Array.from({ length: 8 }, () => ({ correct: true }))
  const up = nextDifficulty(rightRun, 'medium')
  assert.equal(up.level, 'hard')
  assert.equal(up.changed, true)

  const wrongRun = Array.from({ length: 8 }, () => ({ correct: false }))
  const down = nextDifficulty(wrongRun, 'medium')
  assert.equal(down.level, 'easy')
  assert.equal(down.changed, true)
  // The step-down reason must not shame (Global Rule 6).
  assert.ok(!/fail|bad|poor|behind/i.test(down.reason), down.reason)

  const mixed = [1, 0, 1, 0, 1, 0, 1, 0].map(c => ({ correct: !!c }))
  assert.equal(nextDifficulty(mixed, 'medium').changed, false)
})

test('one level at a time, and the ends do not overflow', () => {
  const aced = Array.from({ length: 10 }, () => ({ correct: true }))
  assert.equal(nextDifficulty(aced, 'easy').level, 'medium', 'easy steps to medium, not hard')
  assert.equal(nextDifficulty(aced, 'hard').changed, false, 'nowhere above hard')
  const missed = Array.from({ length: 10 }, () => ({ correct: false }))
  assert.equal(nextDifficulty(missed, 'easy').changed, false, 'nowhere below easy')
})

test('too few answers holds and says why, rather than adapting to noise', () => {
  const r = nextDifficulty([{ correct: true }, { correct: true }], 'medium')
  assert.equal(r.changed, false)
  assert.equal(r.level, 'medium')
  assert.match(r.reason, /not enough/)
  assert.ok(MIN_SIGNAL > 2)
})

test('only the last 10 answers count — old history cannot pin the level forever', () => {
  const oldWrong = Array.from({ length: 30 }, () => ({ correct: false }))
  const newRight = Array.from({ length: 10 }, () => ({ correct: true }))
  assert.equal(nextDifficulty([...oldWrong, ...newRight], 'medium').level, 'hard')
})
