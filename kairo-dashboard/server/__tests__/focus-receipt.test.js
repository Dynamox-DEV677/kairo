/**
 * Focus ban list + session receipt — acceptance. The bar: the receipt is
 * computed from the real event log inside the session window, never
 * self-reported; the ban list is a bounded, deduped contract.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseBanList, toggleBan, sessionReceipt, receiptLine, todaysFocus, MAX_BANS,
} from '../../src/lib/focusReceipt.core.js'

const MIN = 60_000

test('ban list: dedupes, trims, caps, and toggles case-insensitively', () => {
  assert.deepEqual(parseBanList('["Instagram"," Instagram ",""]'), ['Instagram'])
  assert.deepEqual(parseBanList('junk'), [])
  let l = ['Instagram']
  l = toggleBan(l, 'youtube')
  assert.deepEqual(l, ['Instagram', 'youtube'])
  l = toggleBan(l, 'INSTAGRAM') // same app, different case → removes
  assert.deepEqual(l, ['youtube'])
  let full = Array.from({ length: MAX_BANS }, (_, i) => `App${i}`)
  assert.equal(toggleBan(full, 'OneMore').length, MAX_BANS, 'capped')
})

test('DONE WHEN: the receipt is exactly what the log says happened in the window', () => {
  const start = 1000, end = start + 25 * MIN
  const events = [
    { ts: start - 5, type: 'quiz_answered', correct: true, subject: 'Physics', topic: 'motion' },   // BEFORE — excluded
    { ts: start + 1 * MIN, type: 'quiz_answered', correct: true, subject: 'Physics', topic: 'motion' },
    { ts: start + 2 * MIN, type: 'quiz_answered', correct: false, subject: 'Physics', topic: 'motion' },
    { ts: start + 5 * MIN, type: 'flashcard_review', subject: 'Chemistry', topic: 'atoms' },
    { ts: start + 8 * MIN, type: 'note_created', subject: 'Chemistry', topic: 'atoms' },
    { ts: start + 9 * MIN, type: 'session_end' },                                                   // not a study action
    { ts: end + 5, type: 'quiz_answered', correct: true, subject: 'Maths', topic: 'algebra' },      // AFTER — excluded
  ]
  const r = sessionReceipt(events, start, end)
  assert.equal(r.questions, 2)
  assert.equal(r.correct, 1)
  assert.equal(r.cards, 1)
  assert.equal(r.notes, 1)
  assert.equal(r.actions, 4)
  assert.deepEqual(r.topics.map(t => t.topic), ['motion', 'atoms'])
  assert.equal(r.topics[0].count, 2, 'busiest topic first')
})

test('receiptLine reads naturally and returns null for an empty session', () => {
  const r = sessionReceipt([{ ts: 5, type: 'quiz_answered', correct: true, subject: 'P', topic: 'motion' }], 0, 10)
  assert.match(receiptLine(r), /1 question \(1 right\) · 1 topic/)
  assert.equal(receiptLine(sessionReceipt([], 0, 10)), null, 'no invented activity')
})

test('todaysFocus merges only TODAY\'s sessions and their receipts', () => {
  const now = Date.parse('2026-08-23T18:00:00')
  const mkReceipt = (q, topic) => ({ questions: q, correct: q, cards: 0, notes: 0, topics: [{ subject: 'Physics', topic, count: q }] })
  const history = [
    { ts: Date.parse('2026-08-22T18:00:00'), focusedMs: 50 * MIN, drifts: 0, receipt: mkReceipt(9, 'old') }, // yesterday
    { ts: Date.parse('2026-08-23T09:00:00'), focusedMs: 25 * MIN, drifts: 1, driftMs: 3 * MIN, receipt: mkReceipt(3, 'motion') },
    { ts: Date.parse('2026-08-23T16:00:00'), focusedMs: 20 * MIN, drifts: 0, driftMs: 0, receipt: mkReceipt(2, 'motion') },
  ]
  const t = todaysFocus(history, now)
  assert.equal(t.sessions, 2)
  assert.equal(t.focusedMin, 45)
  assert.equal(t.drifts, 1)
  assert.equal(t.driftMin, 3)
  assert.equal(t.questions, 5)
  assert.equal(t.topics[0].topic, 'motion')
  assert.equal(t.topics[0].count, 5, 'same topic merges across sessions')
  assert.equal(todaysFocus(history, Date.parse('2026-08-25T10:00:00')), null, 'no sessions → no card')
})
