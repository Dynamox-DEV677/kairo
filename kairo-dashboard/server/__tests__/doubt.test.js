/**
 * Doubt Solving — the pure half, against realistic solver output.
 *
 * The answer screen reveals one step at a time, so splitSteps() decides what a
 * step IS. Get it wrong and a student either sees the whole solution at once
 * (the feature does nothing) or sees four steps invented out of one paragraph
 * (the app lying about the structure of the maths).
 *
 * The prose fixtures below are shaped like what SOLVER_SYSTEM actually
 * produces: markdown ## headings, $$..$$ display math, doubled-backslash LaTeX.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  relativeTime, contextLabel, looksLikeWorking, splitSteps,
  weaknessSuggestion, ownMistakeLine, recentDoubtCards, sentenceCase,
} from '../../src/lib/doubt.core.js'

const NOW = Date.UTC(2026, 8, 3, 12, 0, 0)

/* ── time ─────────────────────────────────────────────────────────────────── */

test('relativeTime stays coarse and never renders a raw timestamp', () => {
  assert.equal(relativeTime(NOW - 5_000, NOW), 'just now')
  assert.equal(relativeTime(NOW - 5 * 60_000, NOW), '5m ago')
  assert.equal(relativeTime(NOW - 3 * 3600_000, NOW), '3h ago')
  assert.equal(relativeTime(NOW - 26 * 3600_000, NOW), 'yesterday')
  assert.equal(relativeTime(NOW - 3 * 86400_000, NOW), '3d ago')
  assert.equal(relativeTime(0, NOW), '')
  assert.equal(relativeTime(undefined, NOW), '')
})

/* ── context chip ─────────────────────────────────────────────────────────── */

test('contextLabel degrades instead of printing undefined', () => {
  assert.equal(contextLabel({ cls: '10', board: 'CBSE' }, 'Physics'), 'Class 10 · CBSE · Physics')
  assert.equal(contextLabel({ cls: 'Class 9', board: 'ICSE' }, ''), 'Class 9 · ICSE')
  assert.equal(contextLabel({ board: 'CBSE' }, 'Maths'), 'CBSE · Maths')
  assert.equal(contextLabel({}, ''), '')
  assert.equal(contextLabel(undefined, undefined), '')
  // The chip is sent with every solve, so a stray "undefined" would reach the model.
  assert.ok(!contextLabel({ cls: undefined, board: undefined }, undefined).includes('undefined'))
})

/* ── working vs prose ─────────────────────────────────────────────────────── */

test('looksLikeWorking separates equations from sentences', () => {
  assert.equal(looksLikeWorking('$$v^2 = u^2 + 2as$$'), true)
  assert.equal(looksLikeWorking('$s = ut$'), true)
  assert.equal(looksLikeWorking('v = 0 + 9.8 × 2 = 19.6 m/s'), true)
  assert.equal(looksLikeWorking('The ball starts from rest, so u is zero.'), false)
  assert.equal(looksLikeWorking(''), false)
  assert.equal(looksLikeWorking('   '), false)
})

/* ── splitting ────────────────────────────────────────────────────────────── */

const HEADED = `## Write down what you know
The ball is dropped, so the initial velocity is zero.
u = 0 m/s, a = 9.8 m/s², t = 2 s

## Pick the equation
We want velocity from acceleration and time, so the first equation of motion fits.
$$v = u + at$$

## Substitute
v = 0 + 9.8 × 2 = 19.6 m/s
Units matter here — metres per second, not metres.`

test('markdown headings become steps, with working split from reasoning', () => {
  const steps = splitSteps({ textExplanation: HEADED })
  assert.equal(steps.length, 3)

  assert.equal(steps[0].title, 'Write down what you know')
  assert.match(steps[0].working, /u = 0 m\/s/)
  assert.match(steps[0].why, /initial velocity is zero/)
  // The equation must NOT leak into the prose slot — it renders unreadably.
  assert.ok(!steps[0].why.includes('9.8 m/s²'))

  assert.equal(steps[1].title, 'Pick the equation')
  assert.equal(steps[1].working, '$$v = u + at$$')

  assert.match(steps[2].working, /19\.6 m\/s/)
})

test('numbered steps work when the model skips headings', () => {
  const steps = splitSteps({
    textExplanation: [
      '1. Find the moles of sodium',
      'n = 4.6 / 23 = 0.2 mol',
      '2. Use the mole ratio',
      'The equation is 1:1, so 0.2 mol of NaOH forms.',
      '3. Convert back to grams',
      'm = 0.2 × 40 = 8 g',
    ].join('\n'),
  })
  assert.equal(steps.length, 3)
  assert.equal(steps[0].title, 'Find the moles of sodium')
  assert.equal(steps[2].working, 'm = 0.2 × 40 = 8 g')
})

test('"Step 1:" prefixes are stripped, not repeated in the title', () => {
  const steps = splitSteps({
    textExplanation: 'Step 1: Draw the diagram\nMark the forces.\nStep 2: Resolve\nF = 10 N',
  })
  assert.equal(steps.length, 2)
  // The UI already renders a numbered chip; "1. Step 1: Draw" reads as a bug.
  assert.equal(steps[0].title, 'Draw the diagram')
  assert.equal(steps[1].title, 'Resolve')
})

test('a one-paragraph answer stays ONE step rather than being invented into four', () => {
  const steps = splitSteps({
    textExplanation: 'Photosynthesis is how plants convert light into chemical energy.',
  })
  assert.equal(steps.length, 1)
  assert.equal(steps[0].title, 'The answer')
  assert.match(steps[0].why, /chemical energy/)
})

test('a structured plan short-circuits the prose parsing entirely', () => {
  const steps = splitSteps({
    steps: [{ title: 'Step 1: Set up', working: 'F = ma', why: 'Newton second law.' }],
    textExplanation: '## This heading must be ignored\nbody',
  })
  assert.equal(steps.length, 1)
  assert.equal(steps[0].title, 'Set up')
  assert.equal(steps[0].working, 'F = ma')
})

test('empty and missing plans produce no steps, not a crash', () => {
  assert.deepEqual(splitSteps(null), [])
  assert.deepEqual(splitSteps(undefined), [])
  assert.deepEqual(splitSteps({}), [])
  assert.deepEqual(splitSteps({ textExplanation: '   ' }), [])
})

test('every step carries a usable title even from ragged input', () => {
  for (const s of splitSteps({ textExplanation: '## \nbody one\n## **   **\nbody two' })) {
    assert.ok(s.title.length > 0, 'a blank title renders as an empty card')
  }
})

/* ── weakness suggestion ──────────────────────────────────────────────────── */

const M = (over = {}) => ({ topic: 'Vectors', subject: 'Physics', count: 3, lastAt: NOW - 86400_000, severity: 0.7, ...over })

test('weaknessSuggestion needs a real pattern, not one bad day', () => {
  assert.equal(weaknessSuggestion([], NOW), null)
  assert.equal(weaknessSuggestion(undefined, NOW), null)
  // one mistake is not a weakness
  assert.equal(weaknessSuggestion([M({ count: 1 })], NOW), null)
  // stale mistakes are not this week's problem
  assert.equal(weaknessSuggestion([M({ lastAt: NOW - 30 * 86400_000 })], NOW), null)
})

test('weaknessSuggestion picks the most severe and carries a ready prompt', () => {
  const s = weaknessSuggestion([
    M({ topic: 'Vectors', severity: 0.4 }),
    M({ topic: 'Moles', severity: 0.9, subject: 'Chemistry' }),
  ], NOW)
  assert.equal(s.topic, 'Moles')
  assert.match(s.headline, /Moles keeps tripping you up/)
  assert.match(s.detail, /3 wrong this week/)
  // Tapping the card must be able to ask immediately, with no extra typing.
  assert.match(s.prompt, /Moles/)
})

/* ── the differentiator ───────────────────────────────────────────────────── */

test('ownMistakeLine stays silent unless the history really says so', () => {
  assert.equal(ownMistakeLine('Vectors', [], NOW), null)
  assert.equal(ownMistakeLine('', [M()], NOW), null)
  // Telling a student they keep failing something they have never got wrong is
  // both false and discouraging.
  assert.equal(ownMistakeLine('Trigonometry', [M({ topic: 'Vectors' })], NOW), null)
  assert.equal(ownMistakeLine('Vectors', [M({ count: 1 })], NOW), null)
})

test('ownMistakeLine names the real count and topic', () => {
  const line = ownMistakeLine('Vectors', [M({ count: 3 })], NOW)
  assert.match(line, /Vectors/)
  assert.match(line, /3 times/)
})

/* ── recents ──────────────────────────────────────────────────────────────── */

test('recentDoubtCards drops rows that would render as empty cards', () => {
  const cards = recentDoubtCards([
    { id: 'a', question: 'Why does a ball fall faster?', subject: 'Physics', ts: NOW - 3600_000 },
    { id: 'b', question: '   ', subject: 'Maths', ts: NOW },
    { id: 'c', subject: 'Maths', ts: NOW },
  ], 5, NOW)
  assert.equal(cards.length, 1)
  assert.equal(cards[0].id, 'a')
  assert.equal(cards[0].meta, 'Physics · 1h ago')
})

test('recentDoubtCards respects the limit the entry screen asks for', () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ id: String(i), question: `q${i}`, ts: NOW }))
  assert.equal(recentDoubtCards(many, 2, NOW).length, 2)
  assert.deepEqual(recentDoubtCards(null, 2, NOW), [])
})

/* ── display casing ───────────────────────────────────────────────────────── */

test('the weakness headline is sentence-cased, because stored topics are not', () => {
  // twin.ts normalizeTopic() lowercases every topic so "Vectors" and "vectors"
  // cannot become two separate weaknesses. Correct for storage; the card read
  // "vectors keeps tripping you up" until this.
  const s = weaknessSuggestion([M({ topic: 'vectors' })], NOW)
  assert.match(s.headline, /^Vectors keeps/)
})

test('sentenceCase touches only the first letter', () => {
  assert.equal(sentenceCase('vectors'), 'Vectors')
  // Title-casing everything would wreck these.
  assert.equal(sentenceCase('pH scale'), 'PH scale')
  assert.equal(sentenceCase("newton's laws"), "Newton's laws")
  assert.equal(sentenceCase(''), '')
  assert.equal(sentenceCase(undefined), '')
})

test('ownMistakeLine leaves the topic lowercase — it sits mid-sentence', () => {
  const line = ownMistakeLine('vectors', [M({ topic: 'vectors', count: 3 })], NOW)
  assert.match(line, /slipped on vectors/)
})
