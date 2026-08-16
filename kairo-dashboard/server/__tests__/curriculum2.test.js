/**
 * Curriculum depth, IB, bridging, and cross-feature filtering — acceptance.
 *
 * Every "DONE WHEN" in the brief is pinned with at least two curriculum
 * selections, because "it produces output" is not the claim — "it produces
 * DIFFERENT, accurate output per curriculum" is.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  BOARD_OPTIONS, classNumber, gradeBand, resolveCurriculum, curriculumDirective, normaliseBoard,
} from '../../src/lib/curriculum.core.js'
import {
  similarity, subjectsAlign, compareTopics, buildBridge, classesUpTo, groupRows, MATCH_FLOOR,
} from '../../src/lib/bridge.core.js'
import { allTopics, resolveTopic } from '../utils/syllabus.js'

const DATA = join(dirname(fileURLToPath(import.meta.url)), '../../src/data/syllabus')
const readBoard = (b) => JSON.parse(readFileSync(join(DATA, `${b}.json`), 'utf8'))

/* ── 1. Age-appropriate depth within the same curriculum ──────────────────── */

test('class parses out of every shape the profile stores it in', () => {
  assert.equal(classNumber('Class 9'), 9)
  assert.equal(classNumber('9'), 9)
  assert.equal(classNumber(10), 10)
  assert.equal(classNumber('class 6 '), 6)
  assert.equal(classNumber(''), null)
  assert.equal(classNumber('Class 99'), null)   // out of range, not a grade
  assert.equal(classNumber(null), null)
})

test('grade bands split where the teaching actually changes', () => {
  for (const c of [6, 7, 8])   assert.equal(gradeBand(c), 'middle', String(c))
  for (const c of [9, 10])     assert.equal(gradeBand(c), 'secondary', String(c))
  for (const c of [11, 12])    assert.equal(gradeBand(c), 'senior', String(c))
  assert.equal(gradeBand(''), null)
})

test('DONE WHEN: same curriculum, different grade => genuinely different instructions', () => {
  const c6 = curriculumDirective('CBSE', '6')
  const c9 = curriculumDirective('CBSE', '9')

  assert.notEqual(c6, c9)
  // Both are NCERT — the curriculum half is identical…
  assert.match(c6, /NCERT/)
  assert.match(c9, /NCERT/)
  // …and the depth half is not.
  assert.match(c6, /ages 11-14/)
  assert.match(c9, /ages 14-16/)
  assert.match(c6, /Short sentences/)
  assert.match(c6, /Arithmetic only/)
  assert.ok(!/Arithmetic only/.test(c9), 'a class 9 answer is not restricted to arithmetic')
  assert.match(c9, /proper technical vocabulary/)
  assert.ok(!/proper technical vocabulary/.test(c6))
})

test('depth scales across all three bands, not just two', () => {
  const [a, b, c] = ['7', '10', '12'].map(cl => curriculumDirective('CBSE', cl))
  assert.equal(new Set([a, b, c]).size, 3)
  assert.match(c, /Full rigour/)
  assert.ok(!/Full rigour/.test(a))
})

test('depth applies on every curriculum, not only NCERT', () => {
  for (const board of ['CBSE', 'Cambridge', 'IB', 'ICSE']) {
    const young = curriculumDirective(board, '6')
    const older = curriculumDirective(board, '11')
    assert.notEqual(young, older, board)
    assert.match(young, /ages 11-14/, board)
  }
})

test('no grade set means no invented grade', () => {
  const d = curriculumDirective('CBSE', '')
  assert.ok(!/ages \d/.test(d))
})

/* ── 2. IB as its own curriculum ──────────────────────────────────────────── */

test('IB is selectable and resolves to its own curriculum', () => {
  assert.ok(BOARD_OPTIONS.some(b => b.value === 'IB'))
  assert.equal(normaliseBoard('IB'), 'ib')
  assert.equal(normaliseBoard('International Baccalaureate'), 'ib')
  const p = resolveCurriculum('IB', '11')
  assert.equal(p.syllabusBoard, 'ib')
  assert.equal(p.isIB, true)
  assert.equal(p.isCambridge, false)
})

test('DONE WHEN: IB answers are distinct from BOTH NCERT and Cambridge', () => {
  const ib = curriculumDirective('IB', '11')
  const ncert = curriculumDirective('CBSE', '11')
  const cam = curriculumDirective('Cambridge', '11')

  assert.equal(new Set([ib, ncert, cam]).size, 3)
  // IB's own vocabulary, present in neither of the others.
  assert.match(ib, /Diploma Programme/)
  assert.match(ib, /SL|HL/)
  assert.match(ib, /Nature of Science/)
  assert.match(ib, /command terms/)
  for (const other of [ncert, cam]) {
    assert.ok(!/Diploma Programme/.test(other))
    assert.ok(!/Nature of Science/.test(other))
  }
  assert.ok(!/NCERT/.test(ib), 'IB must never be told to follow NCERT')
  assert.ok(!/mark scheme/.test(ib), 'IB is not marked against a Cambridge mark scheme')
})

test('DONE WHEN: IB topic lists follow IB structure, not NCERT or Cambridge', () => {
  const ib = allTopics('ib', '11')
  assert.ok(ib.length > 50, `only ${ib.length} IB topics`)

  const chapters = ib.map(t => t.chapter)
  // The IB's own organising structure — themes, Structure/Reactivity.
  assert.ok(chapters.some(c => /^A\. Space, time and motion/.test(c)), 'IB Physics themes missing')
  assert.ok(chapters.some(c => /^Structure 1\./.test(c)), 'IB Chemistry Structure missing')
  assert.ok(chapters.some(c => /^C\. Interaction and interdependence/.test(c)), 'IB Biology themes missing')

  // And nothing borrowed from the other two maps.
  const cam = new Set(allTopics('cambridge', '11').map(t => t.chapter))
  const cbse = new Set(allTopics('cbse', '10').map(t => t.chapter))
  for (const c of new Set(chapters)) {
    assert.ok(!cam.has(c), `IB chapter also in Cambridge: ${c}`)
    assert.ok(!cbse.has(c), `IB chapter also in CBSE: ${c}`)
  }
})

test('IB topics carry the codes a student can look up in their own guide', () => {
  const bio = allTopics('ib', '11').filter(t => t.subject === 'Biology')
  assert.ok(bio.some(t => /^C1\.2 /.test(t.name)), 'IB Biology topic codes missing')
  assert.ok(resolveTopic('Cell respiration', 'ib', '11'))
})

test('IB flags what it has NOT mapped instead of inventing it', () => {
  const d = readBoard('ib')
  assert.ok(d.unmapped, 'ib.json must declare what is unmapped')
  // Maths guides are not publicly downloadable — so there is no Maths map.
  assert.ok(d.unmapped.Mathematics)
  assert.equal(allTopics('ib', '11').filter(t => t.subject === 'Mathematics').length, 0)
  // MYP has no fixed topic list published at all.
  assert.ok(Object.keys(d.unmapped).some(k => /MYP/.test(k)))
  assert.ok(d.sources, 'ib.json must record provenance')
})

/* ── 3. Bridging mode ─────────────────────────────────────────────────────── */

test('similarity matches the same content under different names', () => {
  assert.ok(similarity('Gravitation', 'Gravitational fields') >= MATCH_FLOOR)
  assert.ok(similarity('Isotopes', 'Isotopes and isobars') >= MATCH_FLOOR)
  // …and does not match unrelated topics that share a filler word.
  assert.ok(similarity('Sound', 'Structure of the atom') < MATCH_FLOOR)
  assert.equal(similarity('', 'Motion'), 0)
})

test('a combined Science course lines up with split sciences', () => {
  assert.ok(subjectsAlign('Science', 'Physics'))
  assert.ok(subjectsAlign('Physics', 'Physics'))
  assert.ok(!subjectsAlign('Mathematics', 'Biology'))
  assert.ok(!subjectsAlign('Science', 'Mathematics'))
})

test('classesUpTo models "everything I have been taught so far"', () => {
  assert.deepEqual(classesUpTo('9'), ['6', '7', '8', '9'])
  assert.deepEqual(classesUpTo('Class 6'), ['6'])
  assert.deepEqual(classesUpTo(''), [])
})

test('DONE WHEN: CBSE Class 9 Science -> Cambridge IGCSE is a real comparison', () => {
  const from = resolveCurriculum('CBSE', '9')
  const to   = resolveCurriculum('Cambridge', '10')
  const r = buildBridge({
    from: { label: from.label, cls: from.cls, syllabusBoard: from.syllabusBoard, classes: classesUpTo('9') },
    to:   { label: to.label,   cls: to.cls,   syllabusBoard: to.syllabusBoard },
    lookup: allTopics,
  })

  assert.equal(r.unavailable, false)
  assert.ok(r.covered.length > 20, `only ${r.covered.length} covered`)
  assert.ok(r.toLearn.length > 20, `only ${r.toLearn.length} to learn`)
  assert.ok(r.canDrop.length > 0)
  assert.ok(r.readiness > 0 && r.readiness < 100)

  // Every covered row names the old topic it was matched against, so a student
  // can check the claim rather than trust it.
  for (const c of r.covered) {
    assert.ok(c.matchedWith, `covered row with no match: ${c.name}`)
    assert.ok(c.confidence >= MATCH_FLOOR, `${c.name} matched below the floor`)
  }

  // Specific real overlaps this pair genuinely has.
  const names = r.covered.map(c => c.name)
  assert.ok(names.includes('Momentum'), 'Momentum should already be covered')
  assert.ok(names.some(n => /Isotopes/.test(n)), 'Isotopes should already be covered')

  // …and a specific real gap: IGCSE Space physics has no CBSE 6-9 equivalent.
  assert.ok(r.toLearn.some(t => /Stars and the Universe|The Earth and the Solar System/.test(t.name)),
    'IGCSE space physics should show as a gap')
})

test('the comparison is not symmetric — direction matters', () => {
  const mk = (fromB, fromC, toB, toC) => {
    const a = resolveCurriculum(fromB, fromC), b = resolveCurriculum(toB, toC)
    return buildBridge({
      from: { label: a.label, cls: a.cls, syllabusBoard: a.syllabusBoard, classes: classesUpTo(fromC) },
      to:   { label: b.label, cls: b.cls, syllabusBoard: b.syllabusBoard },
      lookup: allTopics,
    })
  }
  const there = mk('CBSE', '9', 'Cambridge', '10')
  const back  = mk('Cambridge', '10', 'CBSE', '9')
  assert.notEqual(there.readiness, back.readiness)
})

test('bridging refuses rather than guesses when a map is missing', () => {
  const icse = resolveCurriculum('ICSE', '9')
  const cam  = resolveCurriculum('Cambridge', '10')
  const r = buildBridge({
    from: { label: icse.label, cls: icse.cls, syllabusBoard: icse.syllabusBoard },
    to:   { label: cam.label,  cls: cam.cls,  syllabusBoard: cam.syllabusBoard },
    lookup: allTopics,
  })
  assert.equal(r.unavailable, true)
  assert.match(r.reason, /verified topic map/)
  assert.ok(r.missing.some(m => /ICSE/.test(m)))
})

test('a topic is never counted as both covered and still-to-learn', () => {
  const old = [{ name: 'Motion', chapter: 'Motion', subject: 'Science' }]
  const nw = [
    { name: 'Motion', chapter: 'Mechanics', subject: 'Physics' },
    { name: 'Radioactivity', chapter: 'Nuclear', subject: 'Physics' },
  ]
  const { covered, toLearn, canDrop } = compareTopics(old, nw)
  assert.equal(covered.length, 1)
  assert.equal(toLearn.length, 1)
  assert.equal(canDrop.length, 0)
  const both = covered.filter(c => toLearn.some(t => t.name === c.name))
  assert.deepEqual(both, [])
})

test('one old topic cannot be spent twice', () => {
  // Two new topics, one plausible old match — only one may claim it.
  const old = [{ name: 'Electricity', chapter: 'Electricity', subject: 'Science' }]
  const nw = [
    { name: 'Electricity', chapter: 'A', subject: 'Physics' },
    { name: 'Electricity', chapter: 'B', subject: 'Physics' },
  ]
  const { covered } = compareTopics(old, nw)
  assert.equal(covered.length, 1)
})

test('groupRows nests subject -> chapter -> topics for rendering', () => {
  const g = groupRows([
    { name: 'a', chapter: 'C1', subject: 'Physics' },
    { name: 'b', chapter: 'C1', subject: 'Physics' },
    { name: 'c', chapter: 'C2', subject: 'Biology' },
  ])
  assert.equal(g.length, 2)
  const phy = g.find(x => x.subject === 'Physics')
  assert.equal(phy.chapters.length, 1)
  assert.equal(phy.chapters[0].topics.length, 2)
})

/* ── 4. Cross-feature filtering ───────────────────────────────────────────── */

test('DONE WHEN: formula-sheet scope differs by curriculum where the curricula differ', () => {
  const scopeFor = (board, cls, subject) => {
    const p = resolveCurriculum(board, cls)
    return allTopics(p.syllabusBoard, p.cls || undefined)
      .filter(t => t.subject === subject || t.subject === 'Science')
      .map(t => t.name)
  }
  const cbse = scopeFor('CBSE', '10', 'Physics')
  const cam  = scopeFor('Cambridge', '10', 'Physics')
  const ib   = scopeFor('IB', '11', 'Physics')

  for (const s of [cbse, cam, ib]) assert.ok(s.length > 0)
  // Three curricula, three different scopes handed to the generator.
  assert.notDeepEqual(cbse.slice().sort(), cam.slice().sort())
  assert.notDeepEqual(cam.slice().sort(), ib.slice().sort())
  // IB-only content must not leak into a CBSE sheet.
  assert.ok(ib.some(n => /Rigid body mechanics|Galilean/.test(n)))
  assert.ok(!cbse.some(n => /Galilean/.test(n)))
})

test('every board a student can pick is either mapped or honestly unmapped', () => {
  for (const b of BOARD_OPTIONS) {
    const p = resolveCurriculum(b.value, '10')
    if (p.syllabusBoard) {
      assert.ok(allTopics(p.syllabusBoard, p.cls).length > 0, `${b.value} claims a map but has no topics`)
    } else {
      // Unmapped is fine — silently borrowing another board's topics is not.
      assert.deepEqual(allTopics(p.syllabusBoard || 'nope', p.cls), [])
    }
  }
})

/* ── Copyright ────────────────────────────────────────────────────────────── */

test('the IB map holds structure only — titles, never guide prose', () => {
  const d = readBoard('ib')
  for (const cl of Object.values(d.classes))
    for (const su of Object.values(cl))
      for (const [chapter, topics] of Object.entries(su)) {
        assert.ok(chapter.length <= 80, `chapter too long to be a title: ${chapter}`)
        for (const t of topics) {
          assert.ok(t.name.length <= 80, `not a title: ${t.name}`)
          assert.ok(!/\.\s+[A-Z][a-z]+\s+[a-z]+\s+[a-z]+/.test(t.name), `looks like prose: ${t.name}`)
        }
      }
})

test('every directive still tells the model to write original text', () => {
  for (const board of ['CBSE', 'Cambridge', 'IB', 'ICSE', '']) {
    for (const cls of ['6', '9', '12']) {
      const d = curriculumDirective(board, cls)
      assert.match(d, /your own words/, `${board || '(none)'} class ${cls}`)
      assert.match(d, /Never reproduce, quote or closely/, `${board || '(none)'} class ${cls}`)
    }
  }
})
