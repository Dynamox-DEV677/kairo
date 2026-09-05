/**
 * A missing syllabus makes a screen thinner, never unavailable.
 *
 * Study rooms refused to open for any student whose board and class have no
 * verified syllabus -- which is most personal students -- because the topic
 * picker was built from chapters and the list came back empty. The safety rule
 * is that a topic is NEVER free text. It was never that the topic must be a
 * syllabus chapter.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { topicChoices, FALLBACK_TOPICS } from '../../src/lib/arena.core.js'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')

test('the picker always has options, syllabus or not', () => {
  const withSyllabus = topicChoices([{ id: 'sci.phy.electricity', name: 'Electricity' }])
  assert.equal(withSyllabus.source, 'syllabus')
  assert.equal(withSyllabus.items[0].name, 'Electricity')

  for (const empty of [[], null, undefined]) {
    const out = topicChoices(empty)
    assert.equal(out.source, 'fallback')
    assert.equal(out.items.length, FALLBACK_TOPICS.length)
    assert.ok(out.items.every(i => i.id && i.name), 'every option is pickable')
  }
})

test('the fallback is the fixed list from the brief, in order', () => {
  assert.deepEqual([...FALLBACK_TOPICS], [
    'Physics', 'Chemistry', 'Biology', 'Maths', 'English',
    'Hindi', 'Social Science', 'Computer Science', 'Revision', 'Homework',
  ])
})

test('the room never offers a text input, and never blocks entry', () => {
  const progress = read('src', 'pages', 'Progress.tsx')
  const room = progress.slice(progress.indexOf('What are you working on?') - 3000)
  assert.doesNotMatch(room.slice(0, 4000), /<input/, 'a topic is never free text')
  assert.match(progress, /topicChoices\(/, 'the picker reads choices, not raw chapters')
  // the dead end that used to stop them getting in
  assert.doesNotMatch(progress, /\{!chapters\.length && <Card/, 'an empty chapter list must not block the room')
})

test('the map draws subjects instead of refusing to open', () => {
  const progress = read('src', 'pages', 'Progress.tsx')
  assert.match(progress, /Your subjects, waiting for data/)
  assert.match(progress, /no data yet/)
  assert.match(progress, /FALLBACK_TOPICS\.slice/, 'drawn from the same fixed list')
})

test("Plan's Today falls back to the last thing studied", () => {
  const plan = read('src', 'pages', 'Plan.tsx')
  assert.match(plan, /Back to \$\{last\}/)
  assert.match(plan, /The last thing you studied/)
})

test('the practice builder never needed a syllabus', () => {
  // it builds from due cards and mistake history, which is the point
  const core = read('src', 'lib', 'practice.core.js')
  assert.doesNotMatch(core, /graphForProfile|syllabusFor/, 'no syllabus dependency to remove')
})
