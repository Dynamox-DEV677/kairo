/**
 * The last of the QA list: notes that kept nothing, and a speed that forgot.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cardsForNote } from '../../src/lib/notes.core.js'

const ROOT = join(import.meta.dirname, '..', '..')
const notes = readFileSync(join(ROOT, 'src', 'pages', 'Notes.tsx'), 'utf-8')

test('a note with real content always yields cards', () => {
  // The library listed "Flashcards - Photosynthesis  0 cards": a note with no
  // return date, which is the one thing this space promises never to keep.
  const real = cardsForNote('Photosynthesis', 'Photosynthesis is the process by which plants convert light energy into chemical energy stored in glucose.')
  assert.ok(real.length > 0)
  const teach = cardsForNote('Teach-back - newtons third law', 'I said that every action has a reaction that is equal and opposite in direction.')
  assert.ok(teach.length > 0, 'notes saved from other spaces are not special')
})

test('and a note that cannot yield one is left alone, not retried forever', () => {
  assert.equal(cardsForNote('my name', '').length, 0)
  assert.equal(cardsForNote('TBXEGP', 'x').length, 0)
})

test('the library repairs notes that were saved without cards', () => {
  assert.match(notes, /Any note without cards gets them, once/)
  assert.match(notes, /String\(n\.content \|\| ''\)\.trim\(\)\.length > 24/, 'too-short notes are skipped')
  assert.match(notes, /cardsForNote\(n\.title, n\.content/)
})

test('playback speed offers 2x and is remembered', () => {
  assert.match(notes, /\[1, 1\.25, 1\.5, 2\]\.map/, 'revision listening is usually a second pass')
  assert.match(notes, /RATE_KEY/, 'the choice survives closing the screen')
  assert.match(notes, /setJSON\(RATE_KEY, r\)/)
})
