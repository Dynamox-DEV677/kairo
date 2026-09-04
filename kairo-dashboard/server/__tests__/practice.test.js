/**
 * Practice — the session builder, against realistic inputs.
 *
 * The student picks time, Kyno picks format. These pin the rules that make
 * that promise true: the budget is respected, 5 minutes is cards only, a 15-
 * or 30-minute session is NEVER a single format, and a format that fails
 * mid-session drops out silently instead of erroring.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ESTIMATE, buildSession, dueCards, targetTopic, rebuildWithout, clock,
  intervalLabel, lastMissLine, movementRows, resultsHeadline, xpFor, flatTopicNudge, trimQuestions,
} from '../../src/lib/practice.core.js'

const NOW = Date.UTC(2026, 8, 3, 12, 0, 0)
const DAY = 86_400_000

const card = (i, over = {}) => ({
  id: `c${i}`, front: `Q${i}`, back: `A${i}`, topic: 'vectors', subject: 'Physics',
  dueAt: NOW - i * 3600_000, ...over,
})
const many = (n) => Array.from({ length: n }, (_, i) => card(i))
const M = (over = {}) => ({ topic: 'vectors', subject: 'Physics', count: 3, severity: 0.7, lastAt: NOW - DAY, ...over })

/* ── sources ─────────────────────────────────────────────────────────────── */

test('dueCards uses dueAt <= now — the same test Home and Flashcards use', () => {
  const cards = [card(1), card(2, { dueAt: NOW + DAY }), { id: 'x', dueAt: NOW - 1 }] // last has no front/back
  const due = dueCards(cards, NOW)
  assert.deepEqual(due.map(c => c.id), ['c1'])
})

test('dueCards is oldest-overdue first', () => {
  const due = dueCards([card(1), card(5), card(3)], NOW)
  assert.deepEqual(due.map(c => c.id), ['c5', 'c3', 'c1'])
})

test('targetTopic prefers mistakes, then weakest mastery, then null', () => {
  assert.equal(targetTopic([M({ topic: 'moles', severity: 0.9 }), M()], []).topic, 'moles')
  assert.equal(targetTopic([], [{ topic: 'optics', mastery: 0.2, attempts: 4 }, { topic: 'waves', mastery: 0.8, attempts: 4 }]).topic, 'optics')
  // one attempt is not evidence of weakness
  assert.equal(targetTopic([], [{ topic: 'optics', mastery: 0.1, attempts: 1 }]), null)
  assert.equal(targetTopic([], []), null)
})

/* ── the builder ─────────────────────────────────────────────────────────── */

test('5 minutes is cards only', () => {
  const s = buildSession({ minutes: 5, cards: many(40), mistakes: [M()], now: NOW })
  assert.equal(s.counts.questions, 0)
  assert.equal(s.counts.written, 0)
  assert.equal(s.counts.teach, 0)
  assert.ok(s.counts.cards > 0)
  assert.ok(s.items.every(i => i.kind === 'card'))
})

test('15 and 30 minutes are NEVER a single format — even with plenty of cards', () => {
  for (const minutes of [15, 30]) {
    const s = buildSession({ minutes, cards: many(200), mistakes: [M()], now: NOW })
    const kinds = new Set(s.items.map(i => i.kind))
    assert.ok(kinds.size >= 2, `${minutes} min collapsed to one format: ${[...kinds]}`)
  }
})

test('15 and 30 minutes are never a single format — even with NO cards due', () => {
  for (const minutes of [15, 30]) {
    const s = buildSession({ minutes, cards: [], mistakes: [M()], now: NOW })
    const kinds = new Set(s.items.map(i => i.kind))
    assert.ok(kinds.size >= 2, `${minutes} min with no cards collapsed to: ${[...kinds]}`)
    assert.ok(s.counts.questions > 0, 'time freed by having no cards must flow into questions')
  }
})

test('the plan fits the budget', () => {
  for (const minutes of [5, 15, 30]) {
    const s = buildSession({ minutes, cards: many(200), mistakes: [M()], now: NOW })
    const secs = s.counts.cards * ESTIMATE.card + s.counts.questions * ESTIMATE.question
      + s.counts.written * ESTIMATE.written + s.counts.teach * ESTIMATE.teach
    assert.ok(secs <= minutes * 60 + 30, `${minutes} min plan estimates ${secs}s`)
  }
})

test('30 minutes includes one written answer and one teach-back; 15 only the written', () => {
  const s30 = buildSession({ minutes: 30, cards: many(50), mistakes: [M()], now: NOW })
  assert.equal(s30.counts.written, 1)
  assert.equal(s30.counts.teach, 1)
  const s15 = buildSession({ minutes: 15, cards: many(50), mistakes: [M()], now: NOW })
  assert.equal(s15.counts.written, 1)
  assert.equal(s15.counts.teach, 0)
})

test('cards are clamped to what is actually due', () => {
  const s = buildSession({ minutes: 15, cards: many(4), mistakes: [M()], now: NOW })
  assert.equal(s.counts.cards, 4)
})

test('questions carry the target topic; with no history they are mixed', () => {
  const s = buildSession({ minutes: 15, cards: [], mistakes: [M({ topic: 'moles' })], now: NOW })
  assert.ok(s.items.some(i => i.kind === 'question' && i.topic === 'moles'))
  assert.match(s.preview.find(r => r.kind === 'question').label, /on moles/)

  const blank = buildSession({ minutes: 15, cards: [], mistakes: [], mastery: [], now: NOW })
  assert.match(blank.preview.find(r => r.kind === 'question').label, /mixed/)
})

test('an unknown budget falls back to 15, never crashes', () => {
  const s = buildSession({ minutes: 7, cards: many(10), mistakes: [M()], now: NOW })
  assert.equal(s.minutes, 15)
})

test('disabled formats are honoured and the invariant still holds', () => {
  // grader down mid-day: no written answer, still two formats
  const s = buildSession({ minutes: 30, cards: many(50), mistakes: [M()], now: NOW, disabled: ['written', 'teach'] })
  assert.equal(s.counts.written, 0)
  assert.equal(s.counts.teach, 0)
  assert.ok(new Set(s.items.map(i => i.kind)).size >= 2)
})

test('the preview only lists formats with a count, with minutes per row', () => {
  const s = buildSession({ minutes: 5, cards: many(10), now: NOW })
  assert.equal(s.preview.length, 1)
  assert.equal(s.preview[0].kind, 'card')
  assert.ok(s.preview[0].minutes >= 1)
})

/* ── degraded state ──────────────────────────────────────────────────────── */

test('rebuildWithout drops only the failed format, only from here on', () => {
  const items = [
    { kind: 'card' }, { kind: 'written' }, { kind: 'card' }, { kind: 'written' }, { kind: 'teach' },
  ]
  const out = rebuildWithout(items, 'written', 2)
  // the already-done written (index 1) is kept; the upcoming one (index 3) is gone
  assert.deepEqual(out.map(i => i.kind), ['card', 'written', 'card', 'teach'])
})

/* ── in-session ──────────────────────────────────────────────────────────── */

test('clock formats and never goes negative', () => {
  assert.equal(clock(702_000), '11:42')
  assert.equal(clock(59_000), '0:59')
  assert.equal(clock(-5000), '0:00')
})

test('intervalLabel shows the real next interval, not a placeholder', () => {
  assert.equal(intervalLabel(0), '1 min')
  assert.equal(intervalLabel(0.04), '1 hr')
  assert.equal(intervalLabel(0.5), '12 hrs')
  assert.equal(intervalLabel(1), '1 day')
  assert.equal(intervalLabel(6), '6 days')
  assert.equal(intervalLabel(14), '14 days')
  assert.equal(intervalLabel(45), '2 months')
})

test('lastMissLine is null with no miss on record — the strip hides', () => {
  const c = card(1)
  assert.equal(lastMissLine(c, [], NOW), null)
  assert.equal(lastMissLine(c, [{ ts: NOW - DAY, topic: 'vectors', correct: true }], NOW), null)
  assert.equal(lastMissLine(c, [{ ts: NOW - DAY, topic: 'optics', correct: false }], NOW), null)
})

test('lastMissLine names how long ago', () => {
  const c = card(1)
  assert.equal(lastMissLine(c, [{ ts: NOW - 3 * DAY, topic: 'Vectors', correct: false }], NOW), 'You got this wrong 3 days ago')
  assert.equal(lastMissLine(c, [{ ts: NOW - DAY, topic: 'vectors', correct: false }], NOW), 'You got this wrong yesterday')
  assert.equal(lastMissLine(c, [{ ts: NOW - 3600_000, topic: 'vectors', correct: false }], NOW), 'You got this wrong today')
})

/* ── results ─────────────────────────────────────────────────────────────── */

test('movementRows reports movement, and says "no change" out loud', () => {
  const before = [{ topic: 'vectors', mastery: 0.41 }, { topic: 'moles', mastery: 0.55 }]
  const after  = [{ topic: 'vectors', mastery: 0.68 }, { topic: 'moles', mastery: 0.56 }]
  const rows = movementRows(before, after, ['vectors', 'moles'])
  assert.equal(rows[0].topic, 'vectors')
  assert.equal(rows[0].label, '41% → 68%')
  assert.equal(rows[0].moved, true)
  assert.equal(rows[1].label, 'no change')
  assert.equal(rows[1].moved, false)
})

test('a topic touched for the first time starts from 0%', () => {
  const rows = movementRows([], [{ topic: 'optics', mastery: 0.3 }], ['optics'])
  assert.equal(rows[0].from, 0)
  assert.equal(rows[0].to, 30)
})

test('resultsHeadline names the biggest change and counts weak topics honestly', () => {
  const rows = movementRows(
    [{ topic: 'vectors', mastery: 0.41 }, { topic: 'moles', mastery: 0.5 }, { topic: 'optics', mastery: 0.3 }],
    [{ topic: 'vectors', mastery: 0.68 }, { topic: 'moles', mastery: 0.5 }, { topic: 'optics', mastery: 0.4 }],
    ['vectors', 'moles', 'optics'],
  )
  const h = resultsHeadline(rows, ['vectors', 'moles', 'optics'])
  assert.equal(h.headline, 'Vectors moved.')
  assert.equal(h.sub, 'Two of your three weak topics improved. One did not.')
})

test('resultsHeadline with nothing moved does not pretend', () => {
  const rows = movementRows([{ topic: 'moles', mastery: 0.5 }], [{ topic: 'moles', mastery: 0.5 }], ['moles'])
  assert.equal(resultsHeadline(rows, []).headline, 'Nothing moved yet.')
})

test('xpFor rewards finishing and the hard formats, not grinding', () => {
  const grind = xpFor({ cards: 200, questions: 0, correct: 0, finished: true })
  const balanced = xpFor({ cards: 20, questions: 6, correct: 4, written: 1, finished: true })
  assert.ok(balanced > grind, 'a balanced session must out-earn a card grind')
  assert.equal(xpFor({ finished: false }), 0)
})

test('flatTopicNudge points a flat topic at a different format', () => {
  const rows = movementRows([{ topic: 'periodic table', mastery: 0.4 }], [{ topic: 'periodic table', mastery: 0.4 }], ['periodic table'])
  const n = flatTopicNudge(rows)
  assert.match(n.headline, /^Periodic table did not budge/)
  assert.match(n.detail, /teaching it back/)
  assert.equal(flatTopicNudge([]), null)
})

test('trimQuestions drops only the surplus question items when the API comes back short', () => {
  const items = [
    { kind: 'card' }, { kind: 'question' }, { kind: 'question' }, { kind: 'question' },
    { kind: 'written' }, { kind: 'question' }, { kind: 'teach' },
  ]
  // planned 4 questions, got 2
  const out = trimQuestions(items, 2)
  assert.deepEqual(out.map(i => i.kind), ['card', 'question', 'question', 'written', 'teach'])
  // enough (or more) available: nothing changes
  assert.equal(trimQuestions(items, 9).length, items.length)
  // none available: every question item goes, the rest stays
  assert.deepEqual(trimQuestions(items, 0).map(i => i.kind), ['card', 'written', 'teach'])
  assert.deepEqual(trimQuestions(null, 3), [])
})
