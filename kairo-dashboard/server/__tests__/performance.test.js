/**
 * Performance — the taxonomy and aggregation, against realistic event rows.
 *
 * This space tells a fourteen-year-old about their failures. The rules that
 * keep it honest are pinned here: a pattern needs three, marks outrank
 * frequency, a "beaten" pattern has been silent for 21 days, the reframe is
 * only offered when the numbers support it, and no insight is ever invented to
 * fill a slot.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TYPES, classifyEvent, mistakeRecords, patterns, summarize, beatenCopy,
  impact, topicGroups, crossCut, weeklySparkline, signatureInfo, habitTitle,
} from '../../src/lib/performance.core.js'

const NOW = Date.UTC(2026, 8, 3, 12, 0, 0)
const DAY = 86_400_000

const mcqWrong = (over = {}) => ({
  type: 'quiz_answered', ts: NOW - DAY, topic: 'vectors', subject: 'Physics', correct: false,
  durationMs: 30_000, difficulty: 0.5,
  payload: { q: 'Q?', options: ['5 m', '7 m', '1 m', '12 m'], correctIndex: 0, chosenIndex: 1 },
  ...over,
})

/* ── classification ──────────────────────────────────────────────────────── */

test('a graded written answer yields one record per LOST step, with the grader\'s signature', () => {
  const recs = classifyEvent({
    type: 'essay_graded', ts: NOW, topic: 'motion', payload: {
      source: 'written', q: 'Find t', lines: ['s = ut + ½at²', '20 = 0.5 × 9.8 × t²', 't = 2.02'],
      steps: [
        { line: null, type: 'method', marks: 1, awarded: 0, title: 'Formula skipped', signature: 'formula-not-written', habit: 'You went straight to numbers.' },
        { line: 2, type: 'substitution', marks: 2, awarded: 2 },
        { line: 3, type: 'units', marks: 1, awarded: 0, title: 'No unit' },
      ],
    },
  })
  assert.equal(recs.length, 2, 'earned steps are not mistakes')
  assert.equal(recs[0].signature, 'formula-not-written')
  assert.equal(recs[0].type, 'formula')
  assert.equal(recs[0].why, 'You went straight to numbers.')
  assert.equal(recs[0].source, 'written')
  // no signature from the grader → a sensible default per rubric type
  assert.equal(recs[1].signature, 'omits-units')
  assert.equal(recs[1].type, 'careless')
  assert.equal(recs[1].divergedAt, 3)
  assert.deepEqual(recs[1].lines, ['s = ut + ½at²', '20 = 0.5 × 9.8 × t²', 't = 2.02'])
})

test('a wrong MCQ whose chosen option differs only by sign is careless / sign-flip', () => {
  const [r] = classifyEvent(mcqWrong({ payload: { q: 'Q', options: ['-9.8', '9.8', '4.9', '0'], correctIndex: 1, chosenIndex: 0 } }))
  assert.equal(r.type, 'careless'); assert.equal(r.signature, 'sign-flip')
  assert.equal(r.studentAnswer, '-9.8'); assert.equal(r.correctAnswer, '9.8')
})

test('a wrong MCQ off by a power of ten is a unit slip', () => {
  const [r] = classifyEvent(mcqWrong({ payload: { q: 'Q', options: ['20 m/s', '2000 cm/s', '2 m/s', '200 m/s'], correctIndex: 0, chosenIndex: 3 } }))
  assert.equal(r.signature, 'unit-conversion')
})

test('a fast wrong MCQ on an easy question is rushed; a blank one is incomplete', () => {
  const [fast] = classifyEvent(mcqWrong({ durationMs: 3000, difficulty: 0.3 }))
  assert.equal(fast.signature, 'rushed-mcq'); assert.equal(fast.type, 'careless')
  const [blank] = classifyEvent(mcqWrong({ payload: { q: 'Q', options: ['a', 'b'], correctIndex: 0, chosenIndex: null } }))
  assert.equal(blank.type, 'incomplete'); assert.equal(blank.signature, 'ran-out-of-time')
})

test('with no evidence of a specific habit, a wrong MCQ is conceptual and topic-scoped — never an invented habit', () => {
  const [r] = classifyEvent(mcqWrong())
  assert.equal(r.type, 'conceptual')
  assert.equal(r.signature, 'concept-vectors')
})

test('explicit type + signature from a writer are believed', () => {
  const [r] = classifyEvent({ type: 'mistake', ts: NOW, topic: 'suvat', payload: { errType: 'calculation', signature: 'drops-half-in-suvat', source: 'doubt', why: 'You halved in your head.' } })
  assert.equal(r.signature, 'drops-half-in-suvat'); assert.equal(r.type, 'calculation'); assert.equal(r.why, 'You halved in your head.')
})

test('correct answers and unknown event types produce nothing', () => {
  assert.deepEqual(classifyEvent({ type: 'quiz_answered', correct: true, ts: NOW }), [])
  assert.deepEqual(classifyEvent({ type: 'lab_opened', ts: NOW }), [])
  assert.deepEqual(classifyEvent(null), [])
})

test('mistakeRecords flattens the whole log newest-first', () => {
  const recs = mistakeRecords([mcqWrong({ ts: NOW - 3 * DAY }), mcqWrong({ ts: NOW - DAY }), { type: 'quiz_answered', correct: true, ts: NOW }])
  assert.equal(recs.length, 2)
  assert.ok(recs[0].ts > recs[1].ts)
})

/* ── patterns ────────────────────────────────────────────────────────────── */

const sig = (signature, ts, marks = 1, over = {}) => ({
  type: 'mistake', ts, topic: 'motion', payload: { signature, marksLost: marks, source: 'written', ...over },
})

test('a pattern needs three; fewer is "forming", not a pattern', () => {
  const recs = mistakeRecords([sig('omits-units', NOW - DAY), sig('omits-units', NOW - 2 * DAY)])
  const p = patterns(recs, NOW)
  assert.equal(p.live.length, 0)
  assert.equal(p.forming.length, 1)
  assert.equal(p.forming[0].count, 2)
})

test('patterns are ranked by MARKS lost, not by frequency', () => {
  const recs = mistakeRecords([
    sig('omits-units', NOW - DAY, 1), sig('omits-units', NOW - 2 * DAY, 1), sig('omits-units', NOW - 3 * DAY, 1), sig('omits-units', NOW - 4 * DAY, 1), // 4 × 1 = 4
    sig('drops-half-in-suvat', NOW - DAY, 3), sig('drops-half-in-suvat', NOW - 2 * DAY, 3), sig('drops-half-in-suvat', NOW - 3 * DAY, 3), // 3 × 3 = 9
  ])
  const p = patterns(recs, NOW)
  assert.equal(p.live[0].signature, 'drops-half-in-suvat')
  assert.equal(p.live[0].marksLost, 9)
  assert.equal(p.live[0].type, 'calculation', 'type comes from the vocabulary, by entity')
})

test('a pattern silent for 21 days is beaten; "getting better" needs fewer recent than prior', () => {
  const recs = mistakeRecords([
    sig('sign-flip', NOW - 25 * DAY), sig('sign-flip', NOW - 30 * DAY), sig('sign-flip', NOW - 40 * DAY),
    sig('omits-units', NOW - DAY), sig('omits-units', NOW - 16 * DAY), sig('omits-units', NOW - 20 * DAY), sig('omits-units', NOW - 24 * DAY),
  ])
  const p = patterns(recs, NOW)
  assert.equal(p.beaten[0].signature, 'sign-flip')
  const units = p.live.find(r => r.signature === 'omits-units')
  assert.equal(units.trend, 'improving')
  assert.equal(units.trendLabel, 'getting better')
})

test('flashcard recall misses never become patterns — they are not slips', () => {
  const recs = mistakeRecords(Array.from({ length: 5 }, (_, i) => ({ type: 'flashcard_review', correct: false, ts: NOW - i * DAY, topic: 'moles' })))
  assert.equal(recs.length, 5)
  assert.equal(patterns(recs, NOW).all.length, 0)
})

test('the sparkline is five weekly buckets, oldest first; older than 35 days falls off', () => {
  // 1d, 2d -> this week (index 4) · 9d -> last week (3) · 30d -> week 5 (0) · 40d -> outside the window
  const recs = [{ ts: NOW - DAY }, { ts: NOW - 2 * DAY }, { ts: NOW - 9 * DAY }, { ts: NOW - 30 * DAY }, { ts: NOW - 40 * DAY }]
  assert.deepEqual(weeklySparkline(recs, NOW), [1, 0, 0, 1, 2])
})

/* ── states ──────────────────────────────────────────────────────────────── */

test('summarize: empty, early ("you have two of one so far"), ready', () => {
  assert.equal(summarize([], NOW).state, 'empty')
  const early = summarize(mistakeRecords([sig('omits-units', NOW), sig('omits-units', NOW - DAY)]), NOW)
  assert.equal(early.state, 'early')
  assert.match(early.sub, /needs 3\. You have 2 of one so far/)
  const ready = summarize(mistakeRecords([sig('omits-units', NOW), sig('omits-units', NOW - DAY), sig('omits-units', NOW - 2 * DAY)]), NOW)
  assert.equal(ready.state, 'ready')
  assert.equal(ready.headline, 'One mistake keeps coming back')
})

test('beatenCopy shows a real beaten pattern, else the closest thing, never an invented one', () => {
  const withBeaten = patterns(mistakeRecords([sig('sign-flip', NOW - 25 * DAY), sig('sign-flip', NOW - 30 * DAY), sig('sign-flip', NOW - 40 * DAY)]), NOW)
  const b = beatenCopy(withBeaten, NOW)
  assert.equal(b.real, true); assert.match(b.title, /1 pattern beaten/); assert.match(b.sub, /gone 25 days/)
  assert.equal(beatenCopy(patterns([], NOW), NOW), null)
})

/* ── impact ──────────────────────────────────────────────────────────────── */

test('impact is null without a mock — the screen hides rather than charting nothing', () => {
  assert.equal(impact([], [], NOW), null)
})

test('impact reframes only when non-conceptual losses exceed conceptual', () => {
  const mockTs = NOW - DAY
  const events = [{ type: 'quiz_completed', ts: mockTs, score: 61, payload: { mock: true, total: 100 } }]
  const habits = mistakeRecords([
    sig('omits-units', mockTs - 60_000, 11, { source: 'mock' }),
    sig('formula-not-written', mockTs - 60_000, 8, { source: 'mock' }),
    sig('arithmetic-slip', mockTs - 60_000, 5, { source: 'mock' }),
    sig('ran-out-of-time', mockTs - 60_000, 3, { source: 'mock' }),
    { type: 'mistake', ts: mockTs - 60_000, topic: 'optics', payload: { errType: 'conceptual', marksLost: 12, source: 'mock' } },
  ])
  const i = impact(habits, events, NOW)
  assert.equal(i.totalLost, 39)
  assert.equal(i.segments[0].type, 'conceptual', 'segments sorted by marks')
  assert.match(i.reframe.headline, /^27 of those 39 marks were not about knowing the subject/)
  assert.equal(i.cheapest[0].marks, 11)
  assert.ok(i.cheapest.every(c => c.type !== 'conceptual'))

  // the honest alternative
  const gaps = mistakeRecords([
    { type: 'mistake', ts: mockTs - 60_000, topic: 'optics', payload: { errType: 'conceptual', marksLost: 30, source: 'mock' } },
    sig('omits-units', mockTs - 60_000, 4, { source: 'mock' }),
  ])
  const j = impact(gaps, events, NOW)
  assert.match(j.reframe.headline, /ideas that are not there yet/)
  assert.ok(!/not about knowing/.test(j.reframe.headline))
})

/* ── topics ──────────────────────────────────────────────────────────────── */

test('topicGroups splits RELEARN (conceptual > 60%) from TIGHTEN UP, with advice from the split', () => {
  const recs = mistakeRecords([
    { type: 'mistake', ts: NOW, topic: 'optics', payload: { errType: 'conceptual', marksLost: 3 } },
    { type: 'mistake', ts: NOW, topic: 'optics', payload: { errType: 'conceptual', marksLost: 3 } },
    sig('omits-units', NOW, 1, { }),  // topic 'motion'
    sig('omits-units', NOW - DAY, 1),
    sig('sign-flip', NOW - 2 * DAY, 1),
  ])
  const g = topicGroups(recs, [{ topic: 'optics', mastery: 0.3 }, { topic: 'motion', mastery: 0.7 }], NOW)
  assert.equal(g.relearn[0].topic, 'optics')
  assert.match(g.relearn[0].advice, /start from the chapter/)
  assert.equal(g.tighten[0].topic, 'motion')
  assert.equal(g.tighten[0].dominant, 'careless')
  assert.match(g.tighten[0].advice, /units, signs and copying/)
  assert.equal(g.tighten[0].mastery, 70)
})

test('a topic drilled 3+ times in three weeks and still weak is routed to teach-back', () => {
  const recs = mistakeRecords([sig('arithmetic-slip', NOW), sig('arithmetic-slip', NOW - DAY), sig('arithmetic-slip', NOW - 2 * DAY)])
  const g = topicGroups(recs, [{ topic: 'motion', mastery: 0.35 }], NOW)
  assert.match(g.tighten[0].advice, /teaching it back/)
})

/* ── detail ──────────────────────────────────────────────────────────────── */

test('crossCut speaks only when every occurrence shares a source, and never under three', () => {
  const written = Array.from({ length: 3 }, (_, i) => ({ source: 'written', ts: NOW - i * DAY }))
  assert.match(crossCut(written), /Every single one was a written answer\. It has never happened in an MCQ\./)
  assert.equal(crossCut(written.slice(0, 2)), null)
  assert.equal(crossCut([{ source: 'written' }, { source: 'quiz' }, { source: 'mock' }]), null)
})

test('every vocabulary signature has a type in the taxonomy, a fix, and a second-person title', () => {
  for (const id of ['drops-half-in-suvat', 'omits-units', 'sign-flip', 'formula-not-written', 'no-vector-resolution']) {
    const info = signatureInfo(id)
    assert.ok(TYPES.includes(info.type), `${id} type`)
    assert.ok(info.fix && info.fix.length > 10, `${id} fix`)
    assert.ok(!/be more careful/i.test(info.fix), 'a fix must be a habit, not an admonition')
    assert.match(habitTitle(id), /^You /)
  }
  // an unknown signature still renders a name and never crashes
  assert.equal(signatureInfo('weird-new-thing').name, 'Weird new thing')
})

test('record ids are unique even for identical events in the same millisecond', () => {
  // React keys and deep links. Found in the browser: a preview seed wrote two
  // identical slips with the same ts and React dropped one of the rows.
  const same = { type: 'mistake', ts: NOW, topic: 'motion', payload: { signature: 'omits-units', marksLost: 1 } }
  const recs = mistakeRecords([same, { ...same }, { ...same }])
  assert.equal(recs.length, 3)
  assert.equal(new Set(recs.map(r => r.id)).size, 3)

  // and two lost steps with the same signature inside ONE graded answer
  const graded = classifyEvent({ type: 'essay_graded', ts: NOW, topic: 'motion', payload: { steps: [
    { line: 2, type: 'units', marks: 1, awarded: 0, signature: 'omits-units' },
    { line: 4, type: 'units', marks: 1, awarded: 0, signature: 'omits-units' },
  ] } })
  assert.equal(new Set(graded.map(r => r.id)).size, 2)
})
