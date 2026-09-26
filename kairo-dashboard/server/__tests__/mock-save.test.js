/**
 * A mock paper that survives Android killing the app.
 *
 * What these pin: the paper comes back exactly as left; the clock does NOT
 * pause while the app is away (it is an exam); a paper that ran out comes
 * back to be submitted as it stands, answers intact; and anything that isn't
 * unmistakably a live paper for this subject is refused rather than
 * half-restored into an exam.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { snapshotMock, readMock, peekMock, MOCK_VERSION, ABANDON_AFTER_MS } from '../../src/lib/mockSave.core.js'

const T0 = new Date(2026, 8, 26, 16, 0, 0).getTime()
const MIN = 60_000
const Q = [
  { q: 'a', options: ['1', '2'], correctIndex: 0 },
  { q: 'b', options: ['1', '2'], correctIndex: 1 },
  { q: 'c', options: ['1', '2'], correctIndex: 0 },
]
const paper = (over = {}) => snapshotMock({
  subject: 'Science', questions: Q, answers: [1, null, 0], flags: new Set([2]), i: 1,
  startedAt: T0, totalMs: 40 * MIN, ...over,
}, T0 + 5 * MIN)

test('a paper comes back exactly as it was left', () => {
  const r = readMock(JSON.stringify(paper()), 'Science', T0 + 10 * MIN)
  assert.deepEqual(r.answers, [1, null, 0])
  assert.deepEqual([...r.flags], [2])
  assert.equal(r.i, 1)
  assert.equal(r.startedAt, T0)
})

test('the clock kept running while the app was away — it is an exam', () => {
  const r = readMock(paper(), 'Science', T0 + 25 * MIN)
  assert.equal(r.msLeft, 15 * MIN)
  assert.equal(r.expired, false)
})

test('time that ran out while away comes back expired, answers intact', () => {
  const r = readMock(paper(), 'Science', T0 + 41 * MIN)
  assert.equal(r.msLeft, 0)
  assert.equal(r.expired, true)
  assert.deepEqual(r.answers, [1, null, 0])
})

test('a paper abandoned long ago is not restored into a new exam', () => {
  assert.equal(readMock(paper(), 'Science', T0 + 40 * MIN + ABANDON_AFTER_MS + 1), null)
})

test('only the same subject is restored', () => {
  assert.equal(readMock(paper(), 'Maths', T0 + MIN), null)
  assert.ok(readMock(paper(), null, T0 + MIN), 'null means any subject, for the home screen')
})

test('corrupt or mismatched snapshots are refused, never half-restored', () => {
  assert.equal(readMock('{not json', 'Science', T0), null)
  assert.equal(readMock(null, 'Science', T0), null)
  assert.equal(readMock({ ...paper(), v: MOCK_VERSION + 1 }, 'Science', T0), null)
  assert.equal(readMock({ ...paper(), answers: [1] }, 'Science', T0), null)
  assert.equal(readMock({ ...paper(), questions: [], answers: [] }, 'Science', T0), null)
  assert.equal(readMock({ ...paper(), startedAt: 'yesterday' }, 'Science', T0), null)
})

test('junk inside a valid snapshot is cleaned, not trusted', () => {
  const r = readMock({ ...paper(), answers: [1, 'x', 7.5], flags: [2, 'y'], i: 99 }, 'Science', T0 + MIN)
  assert.deepEqual(r.answers, [1, null, null])
  assert.deepEqual([...r.flags], [2])
  assert.equal(r.i, 0)
})

test('the home screen can see how far along the paper is', () => {
  assert.deepEqual(peekMock(JSON.stringify(paper()), T0 + 10 * MIN),
    { subject: 'Science', msLeft: 30 * MIN, expired: false, answered: 2, total: 3 })
  assert.equal(peekMock(null, T0), null)
})
