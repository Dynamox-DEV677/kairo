/**
 * Study Room v2 — shared notes + voice mesh decisions. The convergence/glare
 * rules are the whole correctness story; audio audibility is verified in the
 * browser, not here.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  makeNote, mergeNotes, removeNote, noteToNotebook, MAX_NOTES, MAX_LEN,
} from '../../src/lib/roomNotes.core.js'

/* ── shared notes ─────────────────────────────────────────────────────────── */

test('a note is trimmed, capped, and empty text makes no note', () => {
  const n = makeNote({ byKey: 'a', byName: 'Aarav', text: '  hello   world  ', ts: 100 })
  assert.equal(n.text, 'hello world')
  assert.equal(n.byName, 'Aarav')
  assert.equal(makeNote({ byKey: 'a', byName: 'x', text: '   ', ts: 1 }), null)
  const long = makeNote({ byKey: 'a', byName: 'x', text: 'z'.repeat(500), ts: 1 })
  assert.equal(long.text.length, MAX_LEN)
})

test('merge is union-by-id and stays ordered by time — joiners converge', () => {
  let notes = []
  const a = makeNote({ byKey: 'a', byName: 'A', text: 'first', ts: 10 })
  const b = makeNote({ byKey: 'b', byName: 'B', text: 'second', ts: 20 })
  notes = mergeNotes(notes, a)
  notes = mergeNotes(notes, b)
  // A joiner replays the whole pad; the duplicate 'a' must not double.
  notes = mergeNotes(notes, [a, b])
  assert.equal(notes.length, 2)
  assert.deepEqual(notes.map(n => n.text), ['first', 'second'])
})

test('merge caps at MAX_NOTES, dropping the oldest', () => {
  let notes = []
  for (let i = 0; i < MAX_NOTES + 15; i++) {
    notes = mergeNotes(notes, makeNote({ byKey: 'a', byName: 'A', text: 'n' + i, ts: i }))
  }
  assert.equal(notes.length, MAX_NOTES)
  assert.equal(notes[0].text, 'n15', 'oldest 15 dropped')
})

test('a note can be retracted, and junk merges are ignored', () => {
  const a = makeNote({ byKey: 'a', byName: 'A', text: 'keep', ts: 1 })
  const b = makeNote({ byKey: 'b', byName: 'B', text: 'drop', ts: 2 })
  let notes = mergeNotes(mergeNotes([], a), b)
  notes = removeNote(notes, b.id)
  assert.deepEqual(notes.map(n => n.text), ['keep'])
  assert.deepEqual(mergeNotes(notes, { id: null }), notes)
  assert.deepEqual(mergeNotes(notes, null), notes)
})

test('linking a note builds a real Notebook payload tagged to the room', () => {
  const n = makeNote({ byKey: 'a', byName: 'A', text: 'Ohm law: V = IR', ts: 1 })
  const p = noteToNotebook(n, 'BKCLD8')
  assert.equal(p.kind, 'note')
  assert.equal(p.content, 'Ohm law: V = IR')
  assert.ok(p.tags.includes('study-room'))
  assert.match(p.source, /BKCLD8/)
  // A long note title is truncated with an ellipsis.
  const long = makeNote({ byKey: 'a', byName: 'A', text: 'x'.repeat(100), ts: 1 })
  assert.ok(noteToNotebook(long).title.endsWith('…'))
})
