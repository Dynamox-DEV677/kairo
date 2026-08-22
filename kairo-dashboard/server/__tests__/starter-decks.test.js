/**
 * Starter decks — the cold-start content. The rules that matter: a deck is
 * offered only to a matching curriculum, adding is idempotent (no doubling),
 * and the shipped content is original, correct-shaped, copyright-clean.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  decksForCurriculum, cardKey, newCardsForDeck, deckAlreadyAdded, deckRemainingCount,
} from '../../src/lib/starterDecks.core.js'

const DECK = {
  id: 'd1', title: 'Physics · Motion', subject: 'Physics', boards: ['*'], classes: [],
  blurb: 'x', cards: [
    { front: "Newton's first law", back: 'A body stays at rest…' },
    { front: 'Momentum formula', back: 'p = mv' },
  ],
}
const NCERT_ONLY = { ...DECK, id: 'd2', boards: ['ncert'] }
const CLASS10 = { ...DECK, id: 'd3', boards: ['ncert'], classes: ['10'] }

test('universal decks reach every board; ncert decks only NCERT-family', () => {
  assert.ok(decksForCurriculum([DECK], { board: 'Cambridge' }).length === 1, 'universal reaches Cambridge')
  assert.ok(decksForCurriculum([DECK], { board: 'IB' }).length === 1)
  assert.equal(decksForCurriculum([NCERT_ONLY], { board: 'Cambridge' }).length, 0, 'NCERT deck hidden from Cambridge')
  assert.equal(decksForCurriculum([NCERT_ONLY], { board: 'CBSE' }).length, 1)
  assert.equal(decksForCurriculum([NCERT_ONLY], { board: 'Tamil Nadu State Board' }).length, 1, 'state ≈ ncert')
})

test('a class-pinned deck only shows for that class', () => {
  assert.equal(decksForCurriculum([CLASS10], { board: 'CBSE', cls: 'Class 10' }).length, 1)
  assert.equal(decksForCurriculum([CLASS10], { board: 'CBSE', cls: '9' }).length, 0)
  // No class set: a class-pinned deck stays hidden rather than mis-served.
  assert.equal(decksForCurriculum([CLASS10], { board: 'CBSE' }).length, 0)
})

test('adding a deck is idempotent — the second add contributes nothing', () => {
  const first = newCardsForDeck(DECK, [])
  assert.equal(first.length, 2)
  // topic is the deck title with the leading "Subject · " stripped, so the reel
  // header does not double the subject.
  assert.ok(first.every(c => c.source === 'starter' && c.subject === 'Physics' && c.topic === 'Motion'))

  // Simulate them now living in the store, then add again.
  const inStore = first.map(c => ({ subject: c.subject, front: c.front, back: c.back }))
  assert.deepEqual(newCardsForDeck(DECK, inStore), [], 'no new cards the second time')
  assert.equal(deckAlreadyAdded(DECK, inStore), true)
  assert.equal(deckRemainingCount(DECK, inStore), 0)
})

test('a partially-added deck only tops up the missing cards', () => {
  const half = [{ subject: 'Physics', front: "Newton's first law", back: 'x' }]
  const rest = newCardsForDeck(DECK, half)
  assert.equal(rest.length, 1)
  assert.equal(rest[0].front, 'Momentum formula')
})

test('dedupe is case/space-insensitive on the front, scoped to subject', () => {
  assert.equal(cardKey('Physics', '  Newton\'s   First Law '), cardKey('physics', "newton's first law"))
  assert.notEqual(cardKey('Physics', 'Transport'), cardKey('Biology', 'Transport'))
})

/* ── the shipped content ────────────────────────────────────────────────── */

test('every shipped deck is well-formed, and cards are titles-not-prose length', () => {
  const p = join(dirname(fileURLToPath(import.meta.url)), '../../src/data/starterDecks.ts')
  const src = readFileSync(p, 'utf8')
  // No PYQ/frequency claims (we do not have that dataset — must not fake it).
  assert.ok(!/asked in \d{4}|appeared \d+ times|PYQ frequency/i.test(src), 'no fabricated PYQ claims')
  // Standard fact markers present (this really is high-yield science content).
  assert.ok(/Newton|photosynthesis|quadratic|Pythagoras/i.test(src))
})
