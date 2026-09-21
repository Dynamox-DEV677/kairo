/**
 * The on-device search engine.
 *
 * The bug these pin: measured against a real NCERT chapter, "who was the first
 * president of india" came back CONFIDENT on a biology passage. It matched
 * "first" and "india" -- two of three words -- and raw term coverage called
 * that 67%. Handing a student a confidently-wrong passage is the one failure
 * this engine exists to avoid, so most of what follows is about REFUSING.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  stem, tokenize, chunk, chunkPages, buildIndex, mergeIndexes, search,
  isConfident, snippet,
} from '../../src/lib/search.core.js'

/** A small stand-in for a science chapter. Real text lives in the PDFs. */
const CORPUS = [
  { id: 'a', text: 'The cell is the fundamental unit of life. Every living organism is made of cells. A cell is the smallest unit that can carry out all the processes of life.' },
  { id: 'b', text: 'The plasma membrane is the outermost covering of the cell. It is selectively permeable and controls which substances enter and leave the cell.' },
  { id: 'c', text: 'Mitochondria are the powerhouses of the cell. They release energy required for various chemical activities needed for life, stored in the form of ATP molecules.' },
  { id: 'd', text: 'When a cell is placed in a hypertonic solution, water moves out of the cell by osmosis and the cell shrinks. In a hypotonic solution the cell swells.' },
  { id: 'e', text: 'The cell wall is a rigid outer covering found in plant cells. It is made of cellulose and gives the plant cell its shape and strength.' },
]

const ix = buildIndex(CORPUS)

/* ── tokenising ───────────────────────────────────────────────────────────── */

test('stemming handles textbook plurals without mangling short words', () => {
  assert.equal(stem('cells'), 'cell')
  assert.equal(stem('bodies'), 'body')
  assert.equal(stem('shrinks'), 'shrink')
  // "gas" must not become "ga", and a real Porter stemmer would do worse here
  assert.equal(stem('gas'), 'gas')
  assert.equal(stem('mass'), 'mass')
  assert.equal(stem('nucleus'), 'nucleus')
})

test('the stop list keeps words that are also exam topics', () => {
  // A generic stop list drops these, and they are entire physics chapters.
  for (const w of ['work', 'power', 'force', 'matter', 'light', 'state']) {
    assert.ok(tokenize(w).length === 1, `"${w}" must survive tokenising`)
  }
})

test('digits survive -- "class 10" and "chapter 6" are real queries', () => {
  assert.deepEqual(tokenize('Class 10 Chapter 6'), ['class', '10', 'chapter', '6'])
})

/* ── chunking ─────────────────────────────────────────────────────────────── */

test('chunking never emits a stray fragment on its own', () => {
  const text = 'A heading\n\nA reasonably long paragraph that goes on for a while and comfortably clears the minimum chunk length set by the chunker so that it stands as its own passage.\n\nTiny.'
  const out = chunk(text)
  assert.ok(out.length >= 1)
  // "Tiny." is below the floor, so it must be folded in, never left alone.
  assert.ok(!out.includes('Tiny.'), 'a fragment must be folded into its neighbour')
  assert.ok(out.join(' ').includes('Tiny.'), 'and must not be lost')
})

/* ── ranking ──────────────────────────────────────────────────────────────── */

test('finds the passage that actually answers the question', () => {
  assert.equal(search(ix, 'plasma membrane')[0].doc.id, 'b')
  assert.equal(search(ix, 'powerhouse of the cell ATP')[0].doc.id, 'c')
  assert.equal(search(ix, 'what happens in a hypertonic solution')[0].doc.id, 'd')
  assert.equal(search(ix, 'cellulose plant cell wall')[0].doc.id, 'e')
})

test('a term in every passage does not decide the ranking', () => {
  // "cell" is in all five. The result must be driven by the rarer word.
  const r = search(ix, 'cell cellulose')
  assert.equal(r[0].doc.id, 'e')
})

/* ── refusing, which is the point ─────────────────────────────────────────── */

test('DONE WHEN: an off-topic question is refused, not answered confidently', () => {
  // The exact regression. "first" and "india" matched a biology passage and
  // raw coverage scored it 67%, over the old 50% bar.
  const r = search(ix, 'who was the first president of india')
  assert.equal(isConfident(r), false, 'must refuse a question the book cannot answer')
})

test('questions from a different subject are refused', () => {
  for (const q of ['quadratic formula', 'messi world cup', 'how do I bake a cake']) {
    assert.equal(isConfident(search(ix, q)), false, `must refuse: ${q}`)
  }
})

test('coverage is weighted by rarity, not by counting words', () => {
  // Both queries match one word of two. The one matching the RARE word is the
  // real hit; the one matching the common word is a coincidence.
  const rare = search(ix, 'mitochondria zebra')
  const common = search(ix, 'cell zebra')
  assert.ok(rare[0].coverage > common[0].coverage,
    'matching a rare term must count for more than matching a ubiquitous one')
})

test('many equally good matches is not a reason to refuse', () => {
  // Every passage mentions cells. An earlier version required the top hit to
  // out-score the runner-up and therefore refused "what is a cell" in a
  // chapter about cells, at 100% coverage.
  assert.equal(isConfident(search(ix, 'what is a cell')), true)
})

/* ── library ──────────────────────────────────────────────────────────────── */

test('indexes merge, so a student can search their whole shelf at once', () => {
  const other = buildIndex([{ id: 'z', text: 'Ohm law states that current through a conductor is proportional to voltage.' }])
  const all = mergeIndexes([ix, other])
  assert.equal(all.docCount, CORPUS.length + 1)
  assert.equal(search(all, 'ohm law voltage')[0].doc.id, 'z')
  assert.equal(search(all, 'plasma membrane')[0].doc.id, 'b')
})

test('an empty index and an empty query are answerable, not throwable', () => {
  assert.deepEqual(search(buildIndex([]), 'anything'), [])
  assert.deepEqual(search(ix, ''), [])
  assert.deepEqual(search(ix, '   '), [])
  assert.equal(isConfident([]), false)
})

/* ── presentation ─────────────────────────────────────────────────────────── */

test('the snippet centres on the match and marks the hit words', () => {
  const r = search(ix, 'hypertonic')
  const sn = snippet(r[0].doc.text, r[0].terms, { width: 80 })
  const hit = sn.parts.filter(p => p.hit).map(p => p.text.trim().toLowerCase())
  assert.ok(hit.some(h => h.includes('hypertonic')), 'the matched term must be marked')
  // Segments, not HTML -- this module does not decide what a highlight looks like.
  assert.ok(sn.parts.every(p => typeof p.text === 'string' && typeof p.hit === 'boolean'))
})

/*
 * A search hit has to be somewhere the student can go.
 *
 * The reader draws the real textbook page now, so "here is your answer,
 * somewhere in this book" is not an answer. These pin the two ways that
 * quietly breaks: losing the page number, and letting a short page's text
 * get filed under the page before it.
 */
test('every passage remembers which page it came from', () => {
  const pages = [
    { page: 1, text: 'A'.repeat(40) + ' photosynthesis happens in the chloroplast of a plant cell.' },
    { page: 2, text: 'B'.repeat(40) + ' respiration releases the energy stored in glucose molecules.' },
  ]
  const passages = chunkPages(pages)
  assert.ok(passages.length >= 2)
  assert.deepEqual([...new Set(passages.map(p => p.page))].sort(), [1, 2])

  const ix = buildIndex(passages.map((p, i) => ({ id: String(i), text: p.text, page: p.page })))
  assert.equal(search(ix, 'chloroplast')[0].doc.page, 1)
})

test('a short page is never folded into the page before it', () => {
  // chunk() glues a stray fragment onto the previous chunk. Across a page
  // boundary that would file this text under page 1 and send the student to a
  // page that does not contain it, so chunking must happen per page.
  const pages = [
    { page: 1, text: 'The solvent is the component present in the larger amount. '.repeat(6) },
    { page: 2, text: 'Tyndall effect.' },
  ]
  const tyndall = chunkPages(pages).find(p => p.text.includes('Tyndall'))
  assert.equal(tyndall.page, 2)
})
