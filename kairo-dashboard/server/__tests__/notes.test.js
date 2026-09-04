/**
 * Notes — nothing is stored without a return date.
 *
 * These pin the rules that stop the space becoming a graveyard: every save
 * yields cards, the due block never shows a zero, one search spans notes,
 * formulas and doubts, a formula flag is never invented, the clip list is
 * finite, and the writing screen counts what the scheme wants without writing
 * a word of it.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  provenanceLabel, originLine, returnLabel, attachCards, noteStats, cardsForNote, unifiedSearch,
  dueSummary, boldTriggers, splitBody, formulaFlags, chapterChips, pickClips, wordJudgement, schemeCheck,
} from '../../src/lib/notes.core.js'

const NOW = Date.UTC(2026, 8, 3, 12, 0, 0)
const DAY = 86_400_000
const SHEET = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'data', 'formulas.cbse10.json'), 'utf-8'))
const GRAPH = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'data', 'syllabusGraph', 'cbse10.json'), 'utf-8'))

/* ── the sheet is data, and it is consistent ─────────────────────────────── */

test('every sheet formula points at a real Class 10 chapter and says WHEN to use it', () => {
  const ids = new Set(GRAPH.nodes.filter(n => n.kind === 'chapter').map(n => n.id))
  assert.ok(SHEET.formulas.length >= 30)
  for (const f of SHEET.formulas) {
    assert.ok(ids.has(f.chapter), `${f.id}: chapter ${f.chapter} is not in cbse10.json`)
    assert.ok(f.expr && f.name, `${f.id}: needs expr and name`)
    assert.ok(f.when && f.when.length > 20, `${f.id}: the WHEN line is the point of the sheet`)
    assert.ok(Array.isArray(f.signatures), `${f.id}: signatures[]`)
  }
  assert.equal(new Set(SHEET.formulas.map(f => f.id)).size, SHEET.formulas.length, 'ids unique')
})

/* ── provenance ───────────────────────────────────────────────────────────── */

test('provenance is always a sentence a student recognises', () => {
  assert.equal(provenanceLabel('doubt-solving'), 'From a doubt')
  assert.equal(provenanceLabel('teach-back'), 'From teach back')
  assert.equal(provenanceLabel(null, 'note'), 'Written by you')
  assert.equal(provenanceLabel(null, 'doubt'), 'From a doubt')
  assert.match(originLine({ createdAt: NOW, source: 'doubt-solving' }), /^Saved \d+ \w+ from a doubt you asked$/)
})

/* ── return dates ─────────────────────────────────────────────────────────── */

test('returnLabel is plain: due now / back tomorrow / back in N days / weeks', () => {
  assert.equal(returnLabel(NOW - 1, NOW), 'due now')
  assert.equal(returnLabel(NOW + 0.5 * DAY, NOW), 'back tomorrow')
  assert.equal(returnLabel(NOW + 2 * DAY, NOW), 'back in 2 days')
  assert.equal(returnLabel(NOW + 21 * DAY, NOW), 'back in 3 weeks')
  assert.equal(returnLabel(undefined, NOW), null)
})

test('dueSummary is null when nothing is due — never a zero', () => {
  assert.equal(dueSummary([{ id: 'a', dueAt: NOW + DAY }], {}, NOW), null)
  assert.equal(dueSummary([], {}, NOW), null)
  const idx = attachCards(attachCards({}, 'n1', ['a', 'b']), 'n2', ['c'])
  const s = dueSummary([{ id: 'a', dueAt: NOW - 1 }, { id: 'b', dueAt: NOW - 1 }, { id: 'c', dueAt: NOW - 1 }, { id: 'z', dueAt: NOW + DAY }], idx, NOW)
  assert.equal(s.headline, '3 cards due today')
  assert.equal(s.sub, 'From 2 notes you saved')
  assert.deepEqual(s.ids, ['a', 'b', 'c'])
})

/* ── cards from a note ────────────────────────────────────────────────────── */

test('saving a note always makes at least one card, offline, from the text itself', () => {
  const cards = cardsForNote('Free fall', 'A body dropped from rest falls with acceleration 9.8 m/s². The distance fallen in time t is s = ½gt². Air resistance is ignored at this level.')
  assert.ok(cards.length >= 1)
  assert.ok(cards.every(c => c.front && c.back))
  // and a one-line note still gets a return date
  const tiny = cardsForNote('Ohm', 'Current is proportional to voltage at constant temperature.')
  assert.ok(tiny.length >= 1)
  assert.deepEqual(cardsForNote('', ''), [])
})

test('attachCards dedupes and noteStats reads the note\'s own cards', () => {
  const idx = attachCards(attachCards({}, 'n1', ['a', 'b']), 'n1', ['b', 'c'])
  assert.deepEqual(idx.n1, ['a', 'b', 'c'])
  const cards = [{ id: 'a', dueAt: NOW + 2 * DAY, topic: 'free fall', ts: NOW - 5 * DAY }, { id: 'c', dueAt: NOW + 6 * DAY, topic: 'free fall', ts: NOW - 5 * DAY }]
  const events = [
    { type: 'flashcard_review', ts: NOW - DAY, topic: 'free fall', correct: true },
    { type: 'flashcard_review', ts: NOW - DAY, topic: 'free fall', correct: false },
    { type: 'flashcard_review', ts: NOW - 10 * DAY, topic: 'free fall', correct: true },   // before the save: not counted
  ]
  const s = noteStats('n1', idx, cards, events, NOW)
  assert.equal(s.cards, 2)
  assert.equal(s.nextLabel, 'back in 2 days')
  assert.equal(s.right, 1); assert.equal(s.total, 2)
})

/* ── one search ───────────────────────────────────────────────────────────── */

test('"half gt squared" finds the note, the formula and the doubt in one index', () => {
  const rows = unifiedSearch('half gt squared', {
    notes:    [{ id: 'n1', title: 'Free fall', content: 'Distance fallen is s = ½gt²', source: 'doubt-solving', updatedAt: NOW }],
    formulas: [{ id: 'f1', name: 'Second equation of motion', expr: 's = ut + ½at²', when: 'Distance from time', ts: NOW }],
    doubts:   [{ id: 'd1', question: 'Why is it half g t squared and not g t squared?', ts: NOW }],
  })
  assert.deepEqual(new Set(rows.map(r => r.kind)), new Set(['note', 'formula', 'doubt']))
  assert.deepEqual(unifiedSearch('', { notes: [{ id: 'x', title: 'a' }] }), [])
})

/* ── body rendering ───────────────────────────────────────────────────────── */

test('trigger words are bolded and equations get their own block', () => {
  const segs = boldTriggers('A ball is dropped from rest and falls freely.')
  assert.ok(segs.some(s => s.bold && /dropped/i.test(s.text)))
  assert.ok(segs.some(s => s.bold && /from rest/i.test(s.text)))
  const body = splitBody('The ball starts from rest.\n$$s = ut + ½at²$$\nSo the time is 2 s.')
  assert.deepEqual(body.map(b => b.kind), ['prose', 'eq', 'prose'])
  assert.equal(body[1].text, 's = ut + ½at²')
})

/* ── the formula flag ─────────────────────────────────────────────────────── */

test('a formula is flagged ONLY when the student has really lost marks to its habit', () => {
  const sheet = SHEET.formulas
  const quiet = formulaFlags(sheet, [{ signature: 'formula-not-written', marksLost: 1 }])   // one occurrence is not a pattern
  assert.equal(quiet.size, 0)
  const flags = formulaFlags(sheet, [
    { signature: 'formula-not-written', marksLost: 2 }, { signature: 'formula-not-written', marksLost: 3 },
  ])
  const ohm = flags.get('elec.ohm')
  assert.ok(ohm, 'Ohm\'s law carries the formula-not-written signature')
  assert.equal(ohm.marks, 5)
  assert.equal(ohm.line, 'You have lost 5 marks by not writing this line before substituting')
  assert.equal(flags.has('prob.classical'), false, 'a formula without that signature stays unflagged')
})

test('chapter chips come from the sheet, biggest first', () => {
  const chips = chapterChips(SHEET.formulas)
  assert.ok(chips.length >= 10)
  assert.ok(chips[0].count >= chips[chips.length - 1].count)
})

/* ── finite clips ─────────────────────────────────────────────────────────── */

test('the clip list is six to eight items and then it ends', () => {
  const deck = Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, kind: 'flashcard', subject: 'Physics', topic: i % 4 === 0 ? 'electricity' : 'optics', front: `Q${i}`, back: `A${i}`, ts: NOW - i * 1000, due: i < 3 }))
  const weak = [{ topic: 'electricity', marksLost: 4, dominant: 'conceptual' }, { topic: 'optics', marksLost: 2, dominant: 'careless' }]
  const r = pickClips(deck, weak, { max: 6 })
  assert.equal(r.items.length, 6)
  assert.equal(r.items[0].why, 'Your weakest topic · 4 marks lost to it')
  assert.ok(r.items.every(i => i.why && i.type))
  assert.equal(r.general, false)
  assert.ok(r.totalMinutes >= 6)
  assert.equal(pickClips(deck, [], { max: 20 }).items.length, 8, 'the cap is eight, whatever is asked')
  assert.equal(pickClips(deck, []).general, true)
})

/* ── writing ──────────────────────────────────────────────────────────────── */

test('wordJudgement helps rather than scores', () => {
  assert.match(wordJudgement('', 5).line, /^0 words · aim for about 60 words for 5 marks$/)
  assert.match(wordJudgement('word '.repeat(52), 5).verdict, /about right for 5 marks/)
  assert.match(wordJudgement('word '.repeat(20), 5).verdict, /short for 5 marks/)
  assert.match(wordJudgement('word '.repeat(300), 5).verdict, /long for 5 marks/)
})

test('schemeCheck counts what is present and never touches the text', () => {
  const reqs = [
    { point: 'Definition of respiration', marks: 1, keywords: ['respiration is', 'release of energy'] },
    { point: 'The word equation', marks: 1, keywords: ['glucose + oxygen', 'carbon dioxide + water'] },
    { point: 'Where it happens — mitochondria', marks: 1, keywords: ['mitochondria'] },
    { point: 'Two differences from photosynthesis', marks: 2, keywords: ['photosynthesis'] },
  ]
  const text = 'Respiration is the release of energy from glucose. Glucose + oxygen gives carbon dioxide + water. It happens in the mitochondria.'
  const r = schemeCheck(text, reqs)
  assert.equal(r.line, '3 of 5')
  assert.equal(r.rows[3].present, false)
  assert.equal(schemeCheck('', reqs).have, 0)
})
