/**
 * Weightage backs the marks-per-hour optimiser (Prompt 2 Phase C). If the
 * marks do not sum to the real paper, every "+22 marks" projection the app
 * shows a student is wrong -- so the totals are pinned here.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const dir = join(here, '../../src/data/syllabus')
const w = JSON.parse(readFileSync(join(dir, 'weightage.cbse.json'), 'utf8'))
const tree = JSON.parse(readFileSync(join(dir, 'cbse.json'), 'utf8'))

for (const [paper, chapters] of Object.entries(w.chapters)) {
  test(`${paper}: marks sum to the theory paper total`, () => {
    const total = Object.values(chapters).reduce((s, c) => s + c.marks, 0)
    assert.equal(total, w.papers[paper].theoryMarks,
      `${paper} sums to ${total}, paper is ${w.papers[paper].theoryMarks}`)
  })

  test(`${paper}: every chapter has sane marks and difficulty`, () => {
    for (const [name, c] of Object.entries(chapters)) {
      assert.ok(c.marks > 0 && c.marks <= 20, `${name}: marks ${c.marks}`)
      assert.ok(c.difficulty >= 1 && c.difficulty <= 5, `${name}: difficulty ${c.difficulty}`)
      assert.ok(c.unit, `${name}: missing unit`)
    }
  })

  test(`${paper}: every weighted chapter exists in the topic tree`, () => {
    // A chapter with marks but no topics is unreachable — the optimiser would
    // tell a student to study something they cannot open.
    const [cls, subject] = paper.split('.')
    const real = Object.keys(tree.classes[cls][subject])
    for (const name of Object.keys(chapters)) {
      assert.ok(real.includes(name), `"${name}" has marks but no topics in cbse.json`)
    }
  })
}

test('the two files stay in step: no topic chapter is left unweighted', () => {
  // The reverse gap is just as bad — an unweighted chapter reads as 0 marks
  // and the optimiser would tell the student to skip it.
  const missing = []
  for (const paper of Object.keys(w.chapters)) {
    const [cls, subject] = paper.split('.')
    for (const name of Object.keys(tree.classes[cls][subject])) {
      if (!w.chapters[paper][name]) missing.push(`${paper} / ${name}`)
    }
  }
  assert.deepEqual(missing, [], `unweighted chapters:\n  ${missing.join('\n  ')}`)
})
