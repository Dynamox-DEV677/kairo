/**
 * Cloze cards — the value is in what it REFUSES to blank. A garbage blank
 * ("_____ objects stay at rest") is worse than no card, so the heuristic skips
 * anything without a confident term, and never blanks a stopword or math.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildClozeCards, pickBlank } from '../../src/lib/cloze.core.js'

test('blanks the key term, front carries the gap and back the answer', () => {
  const cards = buildClozeCards('The mitochondrion is the powerhouse of the cell and makes ATP.')
  assert.ok(cards.length >= 1)
  const c = cards[0]
  assert.ok(c.front.includes('_____'))
  assert.ok(!c.front.toLowerCase().includes(c.back.toLowerCase()), 'the answer is not left visible in the front')
})

test('prefers a number+unit when present', () => {
  assert.equal(pickBlank('The acceleration due to gravity is about 9.8 m/s downward here.'), '9.8 m/s')
})

test('never blanks a stopword; a meaningful first-word term is fine', () => {
  const term = pickBlank('Photosynthesis happens inside the chloroplast of green plant cells.')
  // Not a stopword, and a real content term ("_____ happens inside the
  // chloroplast…" is a good card, so a first-word content term is allowed).
  assert.ok(term && !['the', 'of', 'inside', 'green', 'plant'].includes(term.toLowerCase()))
  assert.ok(term.length >= 6)
})

test('skips sentences too short or with no confident term', () => {
  assert.deepEqual(buildClozeCards('It is red.'), [])          // too short
  assert.deepEqual(buildClozeCards('and to the of it is on'), []) // all stopwords
})

test('does not blank inside math, and dedupes repeated terms', () => {
  const cards = buildClozeCards(
    'Newton stated the second law. Newton also described gravitation. The formula $F = ma$ links force and mass here.',
  )
  // "Newton" blanked once, not twice.
  assert.ok(cards.filter(c => c.back === 'Newton').length <= 1)
  // No blank fell inside the $...$.
  assert.ok(cards.every(c => !/\$.*_____.*\$/.test(c.front)))
})

test('respects the max cap', () => {
  const long = Array.from({ length: 20 }, (_, i) =>
    `Sentence number ${i} explains an important concept called Widget${i} clearly today.`).join(' ')
  assert.ok(buildClozeCards(long, { max: 5 }).length <= 5)
})

test('empty / junk input yields no cards, never throws', () => {
  assert.deepEqual(buildClozeCards(''), [])
  assert.deepEqual(buildClozeCards(null), [])
  assert.deepEqual(buildClozeCards('   \n  '), [])
})
