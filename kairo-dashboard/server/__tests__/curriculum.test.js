/**
 * Curriculum-aligned answers — acceptance.
 *
 * Each block below pins one of the brief's "DONE WHEN" conditions, plus the
 * copyright rule, which is the one that has to hold unconditionally.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  BOARD_OPTIONS, COMMAND_WORDS, normaliseBoard, resolveCurriculum,
  curriculumDirective, detectCommandWord, commandWordDirective,
} from '../../src/lib/curriculum.core.js'
import { allTopics, resolveTopic } from '../utils/syllabus.js'

const DATA = join(dirname(fileURLToPath(import.meta.url)), '../../src/data/syllabus')
const readBoard = (b) => JSON.parse(readFileSync(join(DATA, `${b}.json`), 'utf8'))

/* ── Feature 1: the Board selector actually drives the AI ─────────────────── */

test('board strings map to the right curriculum, including the messy ones', () => {
  assert.equal(normaliseBoard('CBSE'), 'ncert')
  assert.equal(normaliseBoard('cbse'), 'ncert')
  assert.equal(normaliseBoard('Cambridge'), 'cambridge')
  assert.equal(normaliseBoard('IGCSE'), 'cambridge')
  assert.equal(normaliseBoard('Cambridge IGCSE'), 'cambridge')
  assert.equal(normaliseBoard('ICSE'), 'icse')
  assert.equal(normaliseBoard('IB'), 'ib')
  // A state board is taught NCERT-style but we do not claim its chapter map.
  assert.equal(normaliseBoard('Tamil Nadu State Board'), 'ncert')
  // Unknown / unset must NOT silently become NCERT.
  assert.equal(normaliseBoard(''), 'generic')
  assert.equal(normaliseBoard(null), 'generic')
  assert.equal(normaliseBoard('Something else'), 'generic')
})

test('DONE WHEN: the same doubt produces genuinely different instructions per curriculum', () => {
  const ncert = curriculumDirective('CBSE', '9')
  const cam   = curriculumDirective('Cambridge', '10')

  assert.notEqual(ncert, cam)
  // Not merely a different label — the actual teaching instructions differ.
  assert.match(ncert, /NCERT/)
  assert.match(ncert, /CBSE board exams/)
  assert.match(cam, /Cambridge IGCSE/)
  assert.match(cam, /mark scheme/)
  assert.match(cam, /command word/i)
  assert.ok(!/NCERT/.test(cam), 'a Cambridge student must never be told to follow NCERT')
  assert.ok(!/mark scheme/.test(ncert), 'an NCERT student is not sitting a Cambridge paper')
})

test('a student with no board set gets no invented curriculum', () => {
  const d = curriculumDirective('', '')
  assert.ok(!/NCERT/.test(d))
  assert.ok(!/Cambridge/.test(d))
})

test('boards we have not mapped are styled but never given another board\'s chapters', () => {
  const icse = resolveCurriculum('ICSE', '9')
  assert.equal(icse.syllabusBoard, null, 'ICSE must not borrow the CBSE map')
  assert.match(curriculumDirective('ICSE', '9'), /ICSE/)
  assert.equal(resolveCurriculum('IB', '10').syllabusBoard, null)
})

/* ── Feature 4: localised examples ────────────────────────────────────────── */

test('DONE WHEN: example context differs between an NCERT and a Cambridge student', () => {
  const ncert = curriculumDirective('CBSE', '8')
  const cam   = curriculumDirective('Cambridge', '10')

  assert.match(ncert, /rupees|₹/)
  assert.match(ncert, /Indian/)
  assert.match(cam, /international/)
  assert.match(cam, /never assume rupees/)
  assert.ok(!/₹/.test(cam), 'Cambridge examples must not default to rupees')
})

/* ── Feature 3: Cambridge command words ───────────────────────────────────── */

test('DONE WHEN: state / explain / evaluate are structurally distinct', () => {
  const state    = commandWordDirective('state')
  const explain  = commandWordDirective('explain')
  const evaluate = commandWordDirective('evaluate')

  for (const [a, b] of [[state, explain], [explain, evaluate], [state, evaluate]]) {
    assert.notEqual(a, b)
  }
  // The distinction that actually reflects the mark schemes:
  assert.match(state,    /One sentence/)          // bare fact
  assert.match(explain,  /reason chain/)          // linked reasoning
  assert.match(evaluate, /[Bb]oth sides/)         // for, against…
  assert.match(evaluate, /judgement/)             // …and a verdict
  // Every one explains itself to the student.
  for (const d of [state, explain, evaluate]) assert.match(d, /Why this structure/)
})

test('command words are detected where Cambridge puts them, and not mid-sentence', () => {
  assert.equal(detectCommandWord('Explain why the resistance increases.'), 'explain')
  assert.equal(detectCommandWord('(a) State the unit of force.'), 'state')
  assert.equal(detectCommandWord('Look at the graph. Evaluate the method used.'), 'evaluate')
  // "state" inside "states of matter" is not a command word.
  assert.equal(detectCommandWord('The three states of matter are solid, liquid and gas.'), null)
  assert.equal(detectCommandWord(''), null)
  assert.equal(detectCommandWord(null), null)
})

test('every command word carries a shape, a reason and a marks hint', () => {
  const wanted = ['state', 'explain', 'evaluate', 'describe', 'calculate', 'compare', 'suggest', 'define']
  for (const w of wanted) {
    assert.ok(COMMAND_WORDS[w], `missing command word: ${w}`)
    assert.ok(COMMAND_WORDS[w].shape.length > 20, w)
    assert.ok(COMMAND_WORDS[w].why.length > 20, w)
    assert.match(COMMAND_WORDS[w].marksTypically, /\d/, w)
  }
})

test('an unknown command word produces nothing rather than a guess', () => {
  assert.equal(commandWordDirective('ponder'), '')
  assert.equal(commandWordDirective(''), '')
})

/* ── Feature 2: per-curriculum topic maps ─────────────────────────────────── */

test('DONE WHEN: a Cambridge and an NCERT student see different topic lists', () => {
  const ncert = allTopics('cbse', '9').map(t => t.chapter)
  const cam   = allTopics('cambridge', '10').map(t => t.chapter)

  assert.ok(ncert.length > 0)
  assert.ok(cam.length > 0)

  // Not one generic list. A little overlap is real and expected — both courses
  // genuinely teach a chapter called "Statistics" — so the test is that each
  // list is overwhelmingly its own, not that they are disjoint.
  const nSet = new Set(ncert), cSet = new Set(cam)
  const shared = [...nSet].filter(c => cSet.has(c))
  assert.ok(shared.length / nSet.size < 0.15,
    `too much overlap to be two curricula: ${shared.join(', ')}`)
  assert.ok(nSet.size - shared.length > 10, 'NCERT list is not distinctly its own')
  assert.ok(cSet.size - shared.length > 10, 'IGCSE list is not distinctly its own')

  // And each is recognisably its own curriculum.
  assert.ok(ncert.some(c => /Gravitation|Tissues/.test(c)), 'NCERT chapters missing')
  assert.ok(cam.some(c => /Space physics|Stoichiometry|Organisation of the organism/.test(c)), 'IGCSE topics missing')
})

test('IGCSE resolves the same for every class, because Cambridge does not split it by year', () => {
  // IGCSE is a two-year course for 14-16 year olds. Inventing a per-year split
  // would be exactly the fabricated structure the brief forbids.
  const nine = allTopics('cambridge', '9').length
  const ten  = allTopics('cambridge', '10').length
  assert.ok(nine > 100)
  assert.equal(nine, ten)
  assert.equal(readBoard('cambridge').singleStage, 'igcse')
})

test('NCERT classes 6-9 are all present', () => {
  for (const cls of ['6', '7', '8', '9']) {
    const t = allTopics('cbse', cls)
    assert.ok(t.length > 0, `class ${cls} has no topics`)
    assert.ok(t.some(x => x.subject === 'Science'), `class ${cls} has no Science`)
    assert.ok(t.some(x => x.subject === 'Mathematics'), `class ${cls} has no Mathematics`)
  }
})

test('topic resolution stays inside the student\'s own curriculum', () => {
  // "Stoichiometry" is IGCSE; it is not an NCERT Class 9 chapter name.
  assert.ok(resolveTopic('Stoichiometry', 'cambridge', '10'))
  assert.equal(resolveTopic('Stoichiometry', 'cbse', '9'), null)
  // …and the reverse.
  assert.ok(resolveTopic('Gravitation', 'cbse', '9'))
})

test('a board with no map resolves nothing rather than guessing', () => {
  assert.deepEqual(allTopics('icse', '9'), [])
  assert.equal(resolveTopic('Gravitation', 'icse', '9'), null)
})

test('topic ids are unique and stable-looking in both maps', () => {
  for (const board of ['cbse', 'cambridge']) {
    const d = readBoard(board)
    const ids = []
    for (const cl of Object.values(d.classes))
      for (const su of Object.values(cl))
        for (const ch of Object.values(su))
          for (const t of ch) ids.push(t.topicId)
    assert.equal(new Set(ids).size, ids.length, `${board}: duplicate topicIds`)
    for (const id of ids) assert.match(id, /^[a-z0-9.\-]+$/, `${board}: bad id ${id}`)
  }
})

/* ── The copyright rule ───────────────────────────────────────────────────── */

test('the syllabus maps hold structure only — titles, never prose', () => {
  for (const board of ['cbse', 'cambridge']) {
    const d = readBoard(board)
    // Provenance is recorded, so a claim about a curriculum can be traced.
    assert.ok(d.sources, `${board}.json has no sources block`)
    for (const cl of Object.values(d.classes))
      for (const su of Object.values(cl))
        for (const [chapter, topics] of Object.entries(su)) {
          // A title is short and has no sentence punctuation. Prose would.
          assert.ok(chapter.length <= 80, `${board}: chapter too long to be a title: ${chapter}`)
          for (const t of topics) {
            assert.ok(t.name.length <= 80, `${board}: not a title: ${t.name}`)
            assert.ok(!/\.\s+[A-Z]/.test(t.name), `${board}: looks like prose: ${t.name}`)
          }
        }
  }
})

test('every directive tells the model to write original text', () => {
  for (const board of ['CBSE', 'Cambridge', 'ICSE', 'IB', '']) {
    const d = curriculumDirective(board, '9')
    assert.match(d, /your own words/, `${board || '(none)'} directive is missing the originality rule`)
    assert.match(d, /Never reproduce, quote or closely/, board || '(none)')
  }
})

/* ── The single-source-of-truth rule ──────────────────────────────────────── */

test('BOARD_OPTIONS is one list, and every entry resolves to a real curriculum', () => {
  assert.ok(BOARD_OPTIONS.length >= 5)
  const values = BOARD_OPTIONS.map(b => b.value)
  assert.equal(new Set(values).size, values.length, 'duplicate board values')
  assert.ok(values.includes('Cambridge'), 'Cambridge/IGCSE must be selectable')
  assert.ok(values.includes('CBSE'))
  for (const b of BOARD_OPTIONS) {
    assert.ok(b.label, `${b.value} has no label`)
    assert.ok(normaliseBoard(b.value), `${b.value} does not normalise`)
  }
})

test('the scope list passed to the model comes from the real map', () => {
  const scope = allTopics('cambridge', '10').filter(t => t.subject === 'Physics').map(t => t.name)
  const d = curriculumDirective('Cambridge', '10', { scope })
  assert.match(d, /Topics in scope/)
  assert.match(d, /Momentum|Density|Radioactivity/)
  // No scope passed => no scope section, rather than an empty one that reads
  // as "nothing is in your syllabus".
  assert.ok(!/Topics in scope/.test(curriculumDirective('Cambridge', '10')))
})
