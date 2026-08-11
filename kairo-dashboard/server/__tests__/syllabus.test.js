/**
 * The syllabus map is the thing that stops junk entering the learner model.
 * These assertions encode the two failures it exists to prevent.
 *
 * Reads the JSON directly rather than importing the .ts resolver, so the suite
 * stays dependency-free — the resolver's own logic is mirrored here in the
 * scoring test below.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const cbse = JSON.parse(
  readFileSync(join(here, '../../src/data/syllabus/cbse.json'), 'utf8'),
)

function flatten(data) {
  const out = []
  for (const [cls, subjects] of Object.entries(data.classes))
    for (const [subject, chapters] of Object.entries(subjects))
      for (const [chapter, topics] of Object.entries(chapters))
        for (const t of topics) out.push({ ...t, cls, subject, chapter })
  return out
}

const topics = flatten(cbse)

test('the map is not empty and covers both classes', () => {
  assert.ok(topics.length > 100, `only ${topics.length} topics`)
  assert.ok(topics.some(t => t.cls === '9'))
  assert.ok(topics.some(t => t.cls === '10'))
})

test('every topicId is unique', () => {
  const seen = new Set()
  for (const t of topics) {
    assert.ok(!seen.has(t.topicId), `duplicate topicId: ${t.topicId}`)
    seen.add(t.topicId)
  }
})

test('every topicId follows board.class.subject.chapter.topic', () => {
  for (const t of topics) {
    assert.match(
      t.topicId,
      /^cbse\.(9|10)\.[a-z]+\.[a-z0-9-]+\.[a-z0-9-]+$/,
      `malformed topicId: ${t.topicId}`,
    )
    assert.ok(t.name && t.name.length > 2, `topic missing a name: ${t.topicId}`)
  }
})

test('topicIds carry the class they belong to', () => {
  for (const t of topics) {
    assert.ok(
      t.topicId.startsWith(`cbse.${t.cls}.`),
      `${t.topicId} is filed under class ${t.cls}`,
    )
  }
})

test('the topics the app got wrong in production are present', () => {
  // Every one of these appeared as a bug: Ohm's law duplicated six times in
  // Formula Sheet, mitosis flashcards that vanished, a trigonometry answer
  // marked wrong when it was right, and a quiz that ignored the subject.
  const needed = [
    'cbse.10.sci.elec.ohms-law',
    'cbse.9.sci.cell.division',
    'cbse.10.math.trig.identities',
    'cbse.10.sci.reactions.balancing',
  ]
  const ids = new Set(topics.map(t => t.topicId))
  for (const id of needed) assert.ok(ids.has(id), `missing ${id}`)
})

test('a junk string does not resolve to any topic', () => {
  // "wat is ur name" is a real entry in the current weak-topics list.
  const STOP = new Set(['the','a','an','of','and','in','to','for','on','is','are','its','what','how','why','explain','chapter','topic','class','question'])
  const stem = w => w.replace(/(ies)$/, 'y').replace(/(es|s)$/, '')
  const tok = s => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)).map(stem))

  const score = (raw) => {
    const q = tok(raw)
    let best = 0
    for (const t of topics) {
      const tt = tok(`${t.name} ${t.chapter}`)
      let shared = 0
      for (const x of q) if (tt.has(x)) shared++
      if (shared) best = Math.max(best, shared / Math.min(q.size, tt.size))
    }
    return best
  }

  for (const junk of ['wat is ur name', 'camera study problem', 'asdfgh']) {
    assert.ok(score(junk) < 0.55, `"${junk}" resolved with score ${score(junk)}`)
  }
  // And a real one still does resolve.
  assert.ok(score('ohms law') >= 0.55, 'a genuine topic failed to resolve')
})
