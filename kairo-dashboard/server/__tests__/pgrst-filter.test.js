/**
 * Text that goes into a PostgREST filter string (.or()) is quoted.
 *
 * Unquoted, a comma in a search starts a new condition, a parenthesis opens a
 * group and a dot splits column.operator.value, so "Ch. 5 (revision), part 2"
 * errors or quietly means something else. Every user-typed or self-set value in
 * an .or() goes through pgrstValue / ilikeContains -- and that is pinned against
 * the routes' source, so a raw ${...} can't slip back in.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pgrstValue, ilikeContains } from '../lib/pgrst.js'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')

// PostgREST's own rule (pQuotedValue in QueryParams.hs): one "..." value, in
// which a backslash takes the next character literally. Mirrored here so the
// tests can check the round trip.
function unquote(v) {
  assert.match(v, /^"(?:[^"\\]|\\.)*"$/s, `not exactly one quoted value: ${v}`)
  return v.slice(1, -1).replace(/\\(.)/gs, '$1')
}

test('plain text comes back unchanged inside quotes', () => {
  assert.equal(pgrstValue('algebra'), '"algebra"')
  assert.equal(unquote(pgrstValue('Class 9 A')), 'Class 9 A')
})

test('filter syntax inside the text stays text', () => {
  for (const s of ['Ch. 5 (revision), part 2', 'a,b', 'x)', '(y', 'col.eq.1', 'say "hi"', 'back\\slash', 'trailing\\']) {
    assert.equal(unquote(pgrstValue(s)), s)
  }
})

test('ilikeContains matches the text literally, wildcards included', () => {
  assert.equal(unquote(ilikeContains('photosynthesis')), '%photosynthesis%')
  assert.equal(unquote(ilikeContains('100%')), '%100\\%%')
  assert.equal(unquote(ilikeContains('a_b')), '%a\\_b%')
  assert.equal(unquote(ilikeContains('C:\\notes')), '%C:\\\\notes%')
  assert.equal(unquote(ilikeContains('Ch. 5 (revision), part 2')), '%Ch. 5 (revision), part 2%')
})

test('empty and odd inputs never throw', () => {
  assert.equal(pgrstValue(''), '""')
  assert.equal(pgrstValue(null), '""')
  assert.equal(pgrstValue(undefined), '""')
  assert.equal(unquote(pgrstValue(['a', 'b'])), 'a,b')      // ?q=a&q=b arrives as an array
  assert.equal(unquote(ilikeContains(undefined)), '%%')
})

test('no route splices raw user text into an .or() filter', () => {
  const notes    = read('server', 'routes', 'notes.js')
  const notebook = read('server', 'routes', 'notebook.js')
  const tasks    = read('server', 'routes', 'tasks.js')
  assert.doesNotMatch(notes,    /\.or\(`[^`]*\$\{q\}/)
  assert.doesNotMatch(notebook, /\.or\(`[^`]*\$\{q\}/)
  assert.doesNotMatch(tasks,    /\.or\(`[^`]*\$\{req\.user\.class_name\}/)
  assert.match(notes,    /ilikeContains\(q\)/)
  assert.match(notebook, /ilikeContains\(q\)/)
  assert.match(tasks,    /pgrstValue\(req\.user\.class_name\)/)
})
