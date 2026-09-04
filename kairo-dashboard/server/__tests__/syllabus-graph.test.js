/**
 * Syllabus graph (brief part A) — seed integrity + states + coverage.
 * These run against the REAL CBSE 12 PCM seed, so a bad data edit fails CI.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  loadGraph, matchChapter, nodeStates, coverage, subjectOfNode, SOLID_BAR,
} from '../../src/lib/syllabusGraph.core.js'

const seed = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'data', 'syllabusGraph', 'cbse12-pcm.json'), 'utf-8'))
const G = loadGraph(seed)

test('the seed loads with full integrity (ids, parents, prereqs, weights)', () => {
  assert.equal(G.subjects.length, 3)
  assert.ok(G.chapters.length >= 30, `expected 30+ chapters, got ${G.chapters.length}`)
  // marks stay plausibly close to the real 70/70/80 paper totals
  for (const s of G.subjects) {
    const marks = G.chapters.filter(c => subjectOfNode(G, c).id === s.id)
      .reduce((sum, c) => sum + c.typical_marks, 0)
    assert.ok(marks >= 50 && marks <= 85, `${s.name}: ${marks} marks looks wrong`)
  }
  // prereqs point at chapters, never forward to themselves
  for (const c of G.chapters) for (const p of c.prereq || []) {
    assert.notEqual(p, c.id)
    assert.equal(G.byId.get(p).kind, 'chapter')
  }
})

test('activity matching is conservative: match real topics, refuse junk', () => {
  assert.equal(matchChapter(G, 'Physics', "ohm's law"), 'phy.u2.current')
  assert.equal(matchChapter(G, 'Chemistry', 'nernst equation'), 'chem.u1.electrochem')
  assert.equal(matchChapter(G, 'Mathematics', 'integration by parts'), 'math.u3.integrals')
  assert.equal(matchChapter(G, 'Maths', 'Integrals'), 'math.u3.integrals', 'chapter-name match')
  assert.equal(matchChapter(G, 'Physics', 'underwater basket weaving'), null, 'no guessing')
  assert.equal(matchChapter(G, 'Biology', 'photosynthesis'), null, 'subject outside the graph')
})

test('DONE WHEN: a student with no history sees everything UNTOUCHED — a real state, not an error', () => {
  const states = nodeStates(G, { events: [], mastery: [] })
  assert.equal(states.size, G.chapters.length)
  for (const [, s] of states) assert.equal(s.state, 'UNTOUCHED')
  const cov = coverage(G, states)
  assert.equal(cov.pct, 0)
  assert.equal(cov.total, G.chapters.length, 'coverage denominates the REAL node count')
  assert.ok(cov.marksUntouched > 150)
})

test('the five states all reachable from real-shaped data', () => {
  const now = 1_800_000_000_000
  const events = [
    { type: 'lab_opened', subject: 'Physics', topic: "coulomb's law", ts: now },              // SEEN
    { type: 'quiz_answered', subject: 'Physics', topic: "ohm's law", correct: false, ts: now }, // PRACTISED
  ]
  const mastery = [
    { subject: 'Physics', topic: "ohm's law", mastery: 0.3, retentionNow: 0.9, attempts: 2, lastStudiedAt: now },
    { subject: 'Mathematics', topic: 'integration by parts', mastery: 0.8, retentionNow: 0.9, attempts: 5, lastStudiedAt: now }, // SOLID
    { subject: 'Chemistry', topic: 'nernst equation', mastery: 0.75, retentionNow: 0.3, attempts: 5, lastStudiedAt: now },       // FADING
  ]
  const st = nodeStates(G, { events, mastery })
  assert.equal(st.get('phy.u1.charges').state, 'SEEN')
  assert.equal(st.get('phy.u2.current').state, 'PRACTISED')
  assert.equal(st.get('math.u3.integrals').state, 'SOLID')
  assert.equal(st.get('chem.u1.electrochem').state, 'FADING')
  assert.equal(st.get('phy.u6.ray-optics').state, 'UNTOUCHED')
  assert.ok(SOLID_BAR > 0.5)
})

/* ── the Class 10 graph (Plan space) ─────────────────────────────────────── */

const cbse10 = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'data', 'syllabusGraph', 'cbse10.json'), 'utf-8'))
const weightage = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'data', 'syllabus', 'weightage.cbse.json'), 'utf-8'))

test('cbse10 loads with full integrity and covers both Class 10 papers', () => {
  const g = loadGraph(cbse10)
  assert.equal(g.chapters.length, 27)
  assert.deepEqual(g.subjects.map(s => s.id).sort(), ['math', 'sci'])
  for (const c of g.chapters) {
    assert.ok(c.est_study_minutes >= 60 && c.est_study_minutes <= 400, `${c.id}: est ${c.est_study_minutes}`)
    assert.ok(Array.isArray(c.topics) && c.topics.length >= 1, `${c.id}: needs topics for matching`)
  }
})

test('cbse10 chapter names and marks stay in step with weightage.cbse.json', () => {
  const g = loadGraph(cbse10)
  const bySubject = { sci: '10.Science', math: '10.Mathematics' }
  const sums = { sci: 0, math: 0 }
  for (const c of g.chapters) {
    const subj = g.byId.get(g.byId.get(c.parent).parent).id
    const paper = weightage.chapters[bySubject[subj]]
    assert.ok(paper[c.name], `"${c.name}" is not a weightage key -- the two files would drift`)
    assert.equal(c.typical_marks, paper[c.name].marks, `${c.name}: marks differ from weightage`)
    sums[subj] += c.typical_marks
  }
  assert.equal(sums.sci, 80)
  assert.equal(sums.math, 80)
})

test('Class 10 activity matches through the Science subject, whatever the twin calls it', () => {
  const g = loadGraph(cbse10)
  // the twin files a physics doubt under subject "Physics"; class 10 has no
  // 'phy' subject node, so the gate must relax rather than refuse
  assert.equal(matchChapter(g, 'Physics', "ohm's law"), 'sci.phy.electricity')
  assert.equal(matchChapter(g, 'Science', 'refraction'), 'sci.phy.light')
  assert.equal(matchChapter(g, 'Mathematics', 'pythagoras theorem'), 'math.geometry.triangles')
  assert.equal(matchChapter(g, 'Mathematics', 'photosynthesis'), null, 'a maths gate must still refuse a biology topic')
})
