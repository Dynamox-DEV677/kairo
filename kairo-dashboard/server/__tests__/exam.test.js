/**
 * Exam-hall mode — acceptance. The bar: the clock is wall-time (hiding the
 * tab can't stop it), blank ≠ wrong under negative marking, and the
 * post-mortem finds the time-sink questions that actually lose exams.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PAPER_PRESETS, remainingMs, paletteStates, scorePaper, postMortem,
  splitCounts, clockLabel, LEAK_MULTIPLE,
} from '../../src/lib/exam.core.js'

const MIN = 60_000

const QS = [
  { q: 'Q1', options: ['a', 'b', 'c', 'd'], correctIndex: 0, subject: 'Physics' },
  { q: 'Q2', options: ['a', 'b', 'c', 'd'], correctIndex: 1, subject: 'Physics' },
  { q: 'Q3', options: ['a', 'b', 'c', 'd'], correctIndex: 2, subject: 'Chemistry' },
  { q: 'Q4', options: ['a', 'b', 'c', 'd'], correctIndex: 3, subject: 'Chemistry' },
]

test('DONE WHEN: the clock is wall-time — hiding the tab cannot stop it', () => {
  const start = 1_000_000
  const total = 30 * MIN
  // 10 minutes pass in the world (tab hidden or not — irrelevant).
  assert.equal(remainingMs(start, total, start + 10 * MIN), 20 * MIN)
  assert.equal(remainingMs(start, total, start + 31 * MIN), 0, 'clamped at zero → auto-submit')
})

test('negative marking: blank is strategy, wrong is a penalty', () => {
  const jee = PAPER_PRESETS.find(p => p.id === 'jee')
  assert.equal(jee.marking.wrong, -1)
  //  right, wrong, blank, right
  const s = scorePaper(QS, [0, 0, null, 3], jee.marking)
  assert.equal(s.correct, 2)
  assert.equal(s.wrong, 1)
  assert.equal(s.blank, 1)
  assert.equal(s.marks, 2 * 4 - 1) // 7 — the blank cost nothing
  assert.equal(s.negLost, 1)
  assert.equal(s.maxMarks, 16)
})

test('boards marking never goes negative', () => {
  const boards = PAPER_PRESETS.find(p => p.id === 'boards')
  const s = scorePaper(QS, [1, 0, 0, 0], boards.marking) // 0 right? Q1 correct is 0, answered 1 → wrong…
  assert.equal(s.marks, 0)
  assert.ok(s.marks >= 0)
})

test('the post-mortem names the time sink: long time + no marks = leak', () => {
  const times = [2 * MIN, 8 * MIN, 2 * MIN, 2 * MIN] // Q2 ate 8 minutes
  const answers = [0, 0, 2, null]                     // and was WRONG; Q4 blank+cheap
  const pm = postMortem({ questions: QS, answers, times, marking: { correct: 4, wrong: -1 } })
  assert.equal(pm.leaks.length, 1)
  assert.equal(pm.leaks[0].i, 1, 'the 8-minute wrong answer is the leak')
  assert.ok(pm.leaks[0].timeMs >= LEAK_MULTIPLE * pm.avgTimeMs)
  // a CORRECT slow question is never a leak — slow-but-right is fine
  const pm2 = postMortem({ questions: QS, answers: [0, 1, 2, null], times, marking: { correct: 4, wrong: -1 } })
  assert.equal(pm2.leaks.length, 0)
  // per-subject accuracy counts attempts only
  assert.equal(pm.bySubject.Chemistry.attempted, 1)
  assert.equal(pm.bySubject.Chemistry.correct, 1)
})

test('palette + splits + clock', () => {
  assert.deepEqual(paletteStates(4, [0, null, 2, null], [3]), ['done', 'blank', 'done', 'flag'])
  assert.deepEqual(splitCounts(24, ['P', 'C', 'M']), [8, 8, 8])
  assert.deepEqual(splitCounts(20, ['P', 'C', 'M']), [7, 7, 6])
  assert.equal(clockLabel(61_000), '1:01')
  assert.equal(clockLabel(3_661_000), '1:01:01')
  assert.equal(clockLabel(0), '0:00')
})

test('presets are honestly labelled minis with real ratios', () => {
  const jee = PAPER_PRESETS.find(p => p.id === 'jee')
  const neet = PAPER_PRESETS.find(p => p.id === 'neet')
  assert.match(jee.label, /mini/)
  assert.match(neet.label, /mini/)
  // real pace ratios: JEE 2.5 min/q, NEET ≈ 1.05 min/q
  assert.equal(jee.minutes / jee.questions, 2.5)
  assert.ok(Math.abs(neet.minutes / neet.questions - 1.083) < 0.1)
})
