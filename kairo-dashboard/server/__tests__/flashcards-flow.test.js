/**
 * "I click create and the flashcards never come."
 *
 * Three separate faults, pinned here:
 *
 *  1. Pages stay mounted after their first visit, and the seven screens that
 *     show cards read the deck once. A card made in the Reader existed and
 *     appeared nowhere until a reload. The store now announces changes and
 *     every one of those screens re-reads on them.
 *  2. The Reader made cards only from sentences of 6-34 words, so a selected
 *     key word - or a long paragraph with no full stop - made nothing and said
 *     "too short". A word is now carded from its own sentences on the page,
 *     and long sentences are split at their own commas.
 *  3. The Flashcards page accepted only a bare JSON array, so a model that
 *     answered {"cards": [...]} produced an error after a good answer.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildClozeCards, clauses, clozeForTerm, dropLeadingHeading } from '../../src/lib/cloze.core.js'
import { readGeneratedCards } from '../../src/lib/flashcardParse.core.js'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')

const PAGE = 'Green plants make their own food by a process called photosynthesis. ' +
  'During photosynthesis, chlorophyll in the leaves traps the energy of sunlight. ' +
  'The food made by plants is stored in the form of starch in different parts of the plant.'

test('the store announces every added or reviewed card', () => {
  const twin = read('src', 'lib', 'twin.ts')
  assert.match(twin, /export const FLASHCARDS_CHANGED = 'kyno:flashcards-changed'/)
  assert.match(twin, /state\.flashcards\.unshift\(c\)\s+saveState\(state\)\s+notifyFlashcards\('added'\)/)
  assert.match(twin, /card\.reviews = \(card\.reviews \|\| 0\) \+ 1\s+saveState\(state\)\s+notifyFlashcards\('reviewed'\)/)
  assert.match(twin, /queueMicrotask/, 'five cards in one loop are one event, not five')
})

test('every screen that shows the deck re-reads it when it changes', () => {
  const screens = {
    'src/pages/Practice.tsx': /\[view, tick, cardsVersion\]/,
    'src/pages/Flashcards.tsx': /useEffect\(\(\) => \{ reloadDeck\(\) \}, \[cardsVersion\]\)/,
    'src/pages/RevisionReels.tsx': /useFlashcardsVersion\(\{ ignoreReviews: true \}\)[\s\S]{0,300}\[rev, cardsVersion\]/,
    'src/pages/Listen.tsx': /const tick = useFlashcardsVersion\(\{ ignoreReviews: true \}\)/,
    'src/pages/Notes.tsx': /useLibrary\(tick \+ cardsVersion\)/,
    'src/pages/Progress.tsx': /useModel\(tick \+ cardsVersion\)/,
    'src/components/TodaysThree.tsx': /\}, \[cardsVersion\]\)/,
  }
  for (const [file, re] of Object.entries(screens)) {
    const src = read(...file.split('/'))
    assert.match(src, /import \{ useFlashcardsVersion \} from '\.\.\/lib\/useFlashcardsVersion'/, file)
    assert.match(src, re, file)
  }
})

test('a selected key word is carded from its own sentences on the page', () => {
  const cards = clozeForTerm('photosynthesis', PAGE)
  assert.equal(cards.length, 2)
  assert.ok(cards.every(c => c.back === 'photosynthesis' && c.front.includes('_____')))
  assert.ok(cards.every(c => !/photosynthesis/i.test(c.front)), 'the answer is not left in the question')
  // Casing and stray punctuation from the selection do not matter; the card
  // keeps the page's own spelling.
  assert.deepEqual(clozeForTerm('Chlorophyll.', PAGE).map(c => c.back), ['chlorophyll'])
})

test('a chapter heading the PDF glued onto a sentence is not part of the card', () => {
  // Found by pressing the button on NCERT Class 9 Science, chapter 5, page 1.
  const page = 'Exploring Mixtures and their Separation Chapter 5 Have you ever wondered how sweet, white ' +
    'crystals of sugar are obtained from tall, green sugarcane plants?'
  assert.deepEqual(clozeForTerm('sugarcane', page), [{
    front: 'Have you ever wondered how sweet, white crystals of sugar are obtained from tall, green _____ plants?',
    back: 'sugarcane',
  }])
  // An ordinary sentence with a capital in the middle is left alone.
  assert.equal(dropLeadingHeading('Newton stated The Law of motion in his book Principia here.'),
    'Newton stated The Law of motion in his book Principia here.')
})

test('a word the page never uses in a sentence makes no card rather than an invented one', () => {
  assert.deepEqual(clozeForTerm('mitochondria', PAGE), [])
  assert.deepEqual(clozeForTerm('', PAGE), [])
  assert.deepEqual(clozeForTerm('a whole long sentence of more than six words here', PAGE), [])
})

test('a long sentence is split at its own punctuation instead of yielding nothing', () => {
  const long = 'A mixture in which the substances are uniformly distributed throughout and the composition is the same ' +
    'in every part of it, such as salt dissolved in water or air around us, is called a homogeneous mixture while a ' +
    'mixture which has a non uniform composition is called heterogeneous'
  assert.ok(long.split(' ').length > 34)
  const parts = clauses(long)
  assert.ok(parts.length >= 2 && parts.every(p => p.split(' ').length <= 34))
  assert.ok(buildClozeCards(long, { max: 5 }).length >= 1, 'it used to make zero')
  // Short sentences are untouched.
  assert.deepEqual(clauses('The mitochondrion makes ATP for the cell.'), ['The mitochondrion makes ATP for the cell.'])
})

test('the Reader uses the page for short selections and says what actually went wrong', () => {
  const src = read('src', 'pages', 'Reader.tsx')
  assert.match(src, /if \(words <= 6\) cards = clozeForTerm\(sel, pageText\(book\.index, page, 40_000\), \{ max: 2 \}\)/)
  assert.match(src, /if \(!cards\.length\) cards = buildClozeCards\(sel, \{ max: 5 \}\)/)
  assert.match(src, /never uses .* in a full sentence/)
  assert.doesNotMatch(src, /That selection was too short to make a card from/)
})

test('generated cards are read whatever shape the model answers in', () => {
  assert.equal(readGeneratedCards('[{"front":"Q","back":"A"}]').length, 1)
  assert.equal(readGeneratedCards('{"cards":[{"front":"Q","back":"A"},{"front":"Q2","back":"A2"}]}').length, 2)
  assert.equal(readGeneratedCards('Sure:\n```json\n{"flashcards":[{"front":"Q","back":"A"}]}\n```').length, 1)
  const latex = String.raw`{"cards":[{"front":"What is $\sqrt{16}$?","back":"$\frac{8}{2}=4$"}]}`
  assert.deepEqual(readGeneratedCards(latex), [{ front: 'What is $\\sqrt{16}$?', back: '$\\frac{8}{2}=4$' }])
  assert.deepEqual(readGeneratedCards('sorry'), [])
  assert.deepEqual(readGeneratedCards(null), [])
  const page = read('src', 'pages', 'Flashcards.tsx')
  assert.match(page, /json: true,/)
  assert.match(page, /readGeneratedCards\(result\)/)
})
