/**
 * Revision Reels — acceptance for C1 (feed from real data, resume across
 * sessions) and the C30 contract (an exported doubt-card is just a flashcard
 * record, so it must appear in the deck).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDeck, deckSubjects, readPositions, positionFor, withPosition,
} from '../../src/lib/reels.core.js'

const FORMULAS = [
  { id: 'f1', ts: 100, name: "Ohm's Law", expr: 'V = IR', subject: 'Physics', variants: ['I = V/R', 'R = V/I'] },
  { id: 'f2', ts: 200, name: 'Speed', expr: 'v = d/t', subject: 'Physics' },
]
const CARDS = [
  { id: 'c1', ts: 150, front: 'What is osmosis?', back: 'Movement of water…', subject: 'Biology', dueAt: 50 },
  { id: 'c2', ts: 300, front: 'Define mole', back: '6.022e23 particles', subject: 'Chemistry', dueAt: 9999 },
]

test('the deck is built from the real stores, nothing generated', () => {
  const deck = buildDeck({ formulas: FORMULAS, flashcards: CARDS }, { now: 100 })
  assert.equal(deck.length, 4)
  // Every card traces back to a source record by id.
  assert.deepEqual(deck.map(c => c.id).sort(), ['c:c1', 'c:c2', 'f:f1', 'f:f2'])
})

test('rearrangements stay nested on one card — the A2 rule holds in Reels', () => {
  const deck = buildDeck({ formulas: FORMULAS, flashcards: [] })
  const ohm = deck.find(c => c.id === 'f:f1')
  assert.equal(deck.filter(c => /Ohm/.test(c.front)).length, 1, "Ohm's Law must be ONE card")
  assert.deepEqual(ohm.variants, ['I = V/R', 'R = V/I'])
})

test('cards due for review surface first, then newest', () => {
  const deck = buildDeck({ formulas: FORMULAS, flashcards: CARDS }, { now: 100 })
  assert.equal(deck[0].id, 'c:c1', 'the due card leads')
  assert.equal(deck[0].due, true)
  // Remaining order is newest-first by timestamp.
  assert.deepEqual(deck.slice(1).map(c => c.ts), [300, 200, 100])
})

test('a doubt exported via recordFlashcard shape shows up in the deck (C30)', () => {
  const exported = { id: 'x1', ts: 999, front: 'Why is the sky blue?', back: 'Rayleigh scattering…', topic: 'Light', dueAt: 0 }
  const deck = buildDeck({ formulas: [], flashcards: [exported] }, { now: 1000 })
  assert.equal(deck.length, 1)
  assert.equal(deck[0].front, 'Why is the sky blue?')
  assert.equal(deck[0].subject, 'General') // no subject set -> honest bucket, not a guess
})

test('subject chips reflect the real deck, biggest first', () => {
  const subs = deckSubjects(buildDeck({ formulas: FORMULAS, flashcards: CARDS }))
  assert.equal(subs[0].subject, 'Physics')
  assert.equal(subs[0].count, 2)
  assert.equal(subs.length, 3)
})

test('resume is by card id, so new cards do not shift the saved spot', () => {
  const deck1 = buildDeck({ formulas: FORMULAS, flashcards: [] })
  const pos = withPosition({}, 'Physics', deck1[1].id)
  // A new formula lands at the front of tomorrow's deck…
  const deck2 = buildDeck({
    formulas: [...FORMULAS, { id: 'f3', ts: 999, name: 'KE', expr: 'KE = ½mv²', subject: 'Physics' }],
    flashcards: [],
  })
  // …and the student still resumes on the SAME card, not the same index.
  assert.equal(deck2[positionFor(deck2, pos, 'Physics')].id, deck1[1].id)
})

test('a deleted card falls back to the top, never an error', () => {
  const deck = buildDeck({ formulas: FORMULAS, flashcards: [] })
  assert.equal(positionFor(deck, { Physics: 'f:gone' }, 'Physics'), 0)
})

test('garbage in the position store means start fresh, not crash', () => {
  for (const junk of [null, undefined, '', 'not json', '[1,2]', 42]) {
    assert.deepEqual(readPositions(junk), {}, JSON.stringify(junk))
  }
  assert.deepEqual(readPositions('{"Physics":"f:f1"}'), { Physics: 'f:f1' })
})

test('empty stores produce an empty deck, not a demo deck', () => {
  // Global Rule 3: no hardcoded demo output standing in for the feature.
  assert.deepEqual(buildDeck({}), [])
  assert.deepEqual(buildDeck({ formulas: null, flashcards: undefined }), [])
})
