/**
 * Battles: a deterministic question bank from data the app already ships,
 * seven shared questions per match, answers that never reach a client, and
 * scoring that pays for speed only when the answer is right.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadGraph } from '../../src/lib/syllabusGraph.core.js'
import { ROUND, SUBJECTS, buildBank, publicQuestion, pickQuestions, subjectCounts, scoreAnswer, outcome, masteryBand, subjectOfChapter } from '../../src/lib/arena.core.js'

const ROOT = join(import.meta.dirname, '..', '..')
const FORMULAS = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'formulas.cbse10.json'), 'utf-8')).formulas
const GRAPH = loadGraph(JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'syllabusGraph', 'cbse10.json'), 'utf-8')))
const BANK = buildBank(FORMULAS, GRAPH)

test('every question has four distinct options, the answer among them, and a unique id', () => {
  const ids = new Set()
  for (const q of BANK) {
    assert.equal(q.options.length, 4, q.id)
    assert.equal(new Set(q.options).size, 4, `${q.id}: duplicate options`)
    assert.ok(q.answer >= 0 && q.answer < 4)
    assert.ok(SUBJECTS.includes(q.subject), q.subject)
    assert.equal(ids.has(q.id), false, `${q.id} twice`); ids.add(q.id)
  }
  const counts = subjectCounts(BANK)
  for (const s of SUBJECTS) assert.ok(counts[s] >= ROUND.questions, `${s} has ${counts[s]} questions -- fewer than one round`)
})

test('the same source data always builds the same bank, in the same order', () => {
  assert.deepEqual(buildBank(FORMULAS, GRAPH), BANK)
})

test('a client never sees the answer', () => {
  const q = publicQuestion(BANK[0])
  assert.equal('answer' in q, false)
  assert.deepEqual(Object.keys(q).sort(), ['id', 'kind', 'options', 'subject', 'text'])
})

test('both players of a match get the same seven questions of the chosen subject', () => {
  for (const s of SUBJECTS) {
    const a = pickQuestions(BANK, s, 'match-123'), b = pickQuestions(BANK, s, 'match-123')
    assert.equal(a.length, ROUND.questions)
    assert.deepEqual(a.map(q => q.id), b.map(q => q.id))
    assert.ok(a.every(q => q.subject === s))
    assert.equal(new Set(a.map(q => q.id)).size, a.length, 'no repeats within a round')
  }
  assert.notDeepEqual(pickQuestions(BANK, 'Maths', 'match-123').map(q => q.id), pickQuestions(BANK, 'Maths', 'match-124').map(q => q.id))
})

test('speed pays only when the answer is right, and never more than five extra', () => {
  assert.equal(scoreAnswer(false, 100), 0)
  assert.equal(scoreAnswer(true, 0), 15)
  assert.equal(scoreAnswer(true, 8_500), 10)
  assert.equal(scoreAnswer(true, 60_000), 10)
  assert.ok(scoreAnswer(true, 4_250) > 10 && scoreAnswer(true, 4_250) < 15)
  assert.equal(outcome(30, 20), 'won'); assert.equal(outcome(20, 30), 'lost'); assert.equal(outcome(0, 0), 'draw')
})

test('mastery bands and subjects of chapters', () => {
  assert.equal(masteryBand(0.1), 1); assert.equal(masteryBand(0.5), 2); assert.equal(masteryBand(0.9), 3)
  assert.equal(subjectOfChapter('sci.phy.electricity'), 'Physics')
  assert.equal(subjectOfChapter('sci.env.environment'), 'Biology')
  assert.equal(subjectOfChapter('math.trig.intro'), 'Maths')
  assert.equal(subjectOfChapter('nope'), null)
})
