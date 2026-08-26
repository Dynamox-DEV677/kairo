/**
 * Canonical subject registry — the acceptance criteria, verbatim.
 * Runs against the REAL data file generated from CBSE's ANNEXURE-H, so a
 * bad data edit fails CI.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const DATA = JSON.parse(readFileSync(
  join(import.meta.dirname, '..', '..', 'src', 'curriculum', 'subjects.cbse.json'), 'utf-8'))
const SUBJECTS = DATA.subjects
const byId = new Map(SUBJECTS.map(s => [s.id, s]))

test('the data came from the official CBSE document, and says so', () => {
  assert.match(DATA.source, /cbse/i)
  assert.match(DATA.source, /SUBJECT LIST|ANNEXURE/i)
  assert.ok(DATA.fetched, 'records when it was pulled')
})

test('DONE WHEN: no duplicate subjects — Math and Mathematics are ONE id', () => {
  const ids = SUBJECTS.map(s => s.id)
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids in the registry')
  // the reported bug: both spellings present in My Goal
  assert.ok(byId.has('mathematics'))
  assert.ok(!byId.has('math'), '"math" must not be a separate subject')
  assert.ok(!byId.has('maths'))
})

test('a CBSE student can reach every language CBSE offers', () => {
  const langs = SUBJECTS.filter(s => s.kind === 'language')
  // 45 official language OPTIONS collapse to 41 distinct subjects
  // (Course-A/B and Core/Elective are variants of one language).
  assert.ok(langs.length >= 40, `only ${langs.length} languages`)
  for (const id of ['tamil', 'telugu', 'marathi', 'bengali', 'kannada', 'malayalam',
                    'gujarati', 'punjabi', 'odia', 'assamese', 'urdu', 'sanskrit',
                    'kashmiri', 'mizo', 'bodo', 'manipuri', 'nepali', 'sindhi']) {
    assert.ok(byId.has(id), `missing Indian language: ${id}`)
  }
  for (const id of ['french', 'german', 'spanish', 'japanese', 'russian', 'arabic']) {
    assert.ok(byId.has(id), `missing foreign language: ${id}`)
  }
})

test('codes match the official document, including the ones secondary sources get wrong', () => {
  const code = (id, key) => byId.get(id)?.codes?.cbse?.[key]
  assert.equal(code('tamil', '10:default'), '006')
  assert.equal(code('hindi', '10:A'), '002')
  assert.equal(code('hindi', '10:B'), '085')
  assert.equal(code('english', '10:lang-lit'), '184')
  assert.equal(code('english', '10:communicative'), '101', 'omitted by the brief\'s list')
  assert.equal(code('science', '10:default'), '086')
  assert.equal(code('social-science', '10:default'), '087')
  assert.equal(code('mathematics', '10:standard'), '041')
  assert.equal(code('mathematics', '10:basic'), '241')
  // Spanish is 099 in the official list; coaching copies say 096.
  assert.equal(code('spanish', '10:default'), '099')
})

test('every language carries its own script', () => {
  const missing = SUBJECTS
    .filter(s => s.kind === 'language')
    .filter(s => !s.nativeLabel)
    .map(s => s.id)
  assert.deepEqual(missing, [], `languages with no nativeLabel: ${missing.join(', ')}`)
})

test('names survived the PDF\'s Cyrillic lookalikes', () => {
  // The source PDF writes "HINDI COURSE -В" with a Cyrillic В (U+0412) and
  // "LIMBOО" with a Cyrillic О. Storing those breaks matching invisibly.
  for (const s of SUBJECTS) {
    assert.ok(!/[Ѐ-ӿ]/.test(s.label), `${s.id}: Cyrillic in label "${s.label}"`)
  }
})

test('ids are slugs, never display labels — they are what gets persisted', () => {
  for (const s of SUBJECTS) {
    assert.match(s.id, /^[a-z0-9-]+$/, `${s.id} is not a stable slug`)
    assert.ok(s.label && s.kind && Array.isArray(s.classes))
  }
})
