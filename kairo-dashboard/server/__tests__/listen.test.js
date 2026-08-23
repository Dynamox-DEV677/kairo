/**
 * Revise with your ears — acceptance. The bar: a voice must never read TeX
 * noise aloud, and the playlist is the student's own cards, due-first.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { speakableText, buildPlaylist, PLAYLIST_CAP } from '../../src/lib/listen.core.js'
import { buildDeck } from '../../src/lib/reels.core.js'

test('DONE WHEN: LaTeX reads as words, never as dollar-backslash noise', () => {
  const s = speakableText('Speed: $v = \\frac{d}{t}$ and $E = mc^2$.')
  assert.ok(!/[\\${}^]/.test(s), `no TeX symbols left: "${s}"`)
  assert.match(s, /d over t/)
  assert.match(s, /mc squared/)
})

test('units and symbols speak like a teacher says them', () => {
  assert.match(speakableText('g = 9.8 m/s²'), /m per s squared/)
  assert.match(speakableText('boils at 100°C'), /100 degrees Celsius/)
  assert.match(speakableText('2H₂ + O₂ → 2H₂O'.normalize()), /gives/)
  assert.match(speakableText('$\\sqrt{16}$'), /square root of 16/)
  assert.match(speakableText('x ± y'), /plus or minus/)
})

test('markdown is stripped, content kept', () => {
  const s = speakableText('## Newton\n**Force** is `F = ma` — see [chapter](https://x).')
  assert.ok(!/[#*`\[\]]/.test(s))
  assert.match(s, /Force is F = ma/)
  assert.match(s, /chapter/)
})

test('the playlist is the student\'s own deck, due-first, capped', () => {
  const flashcards = []
  for (let i = 0; i < 20; i++) {
    flashcards.push({ id: String(i), front: `Q${i}?`, back: `A${i}`, subject: 'Physics', dueAt: i < 2 ? 1 : 9e15, ts: i })
  }
  const deck = buildDeck({ flashcards }, { now: 5 }) // cards 0,1 due
  const items = buildPlaylist(deck)
  assert.equal(items.length, PLAYLIST_CAP)
  assert.equal(items[0].due, true, 'due cards lead')
  assert.match(items[0].sub, /due for review/)
  assert.match(items[0].script, /The answer: A[01]/)
})

test('a formula card reads name then formula; junk cards are skipped', () => {
  const deck = buildDeck({ formulas: [{ id: 'f1', name: "Ohm's Law", expr: '$V = IR$', subject: 'Physics' }] })
  const items = buildPlaylist(deck)
  assert.equal(items.length, 1)
  assert.match(items[0].script, /Ohm's Law\. The formula is: V = IR\./)
  assert.deepEqual(buildPlaylist([{ front: '', back: '' }, null]), [])
})
