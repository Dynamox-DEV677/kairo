/**
 * The lint rule the brief asks for: no module may declare a subject array.
 *
 * Nine of them did, none agreeing — that WAS the bug. This fails the build
 * if a new one appears. Scans source: a regression here is a code change.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dirname, '..', '..', 'src')
// Only the registry may name subjects. The syllabus GRAPH names chapters and
// its own subject nodes, which is a different axis (what's IN a subject).
const ALLOWED = new Set([
  'curriculum/subjects.ts',
  'curriculum/subjects.cbse.json',
  'lib/syllabusGraph.core.js',
  'lib/stream.core.js',        // maps subjects → streams, uses ids
  'lib/diagnostic.core.js',    // question bank keyed by subject
  'data/starterDecks.ts',
  // exam.core defines EXAM PATTERNS (a JEE mini paper IS P/C/M) — that is
  // the shape of a paper, not a list for the student to pick from.
  'lib/exam.core.js',
])

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.(ts|tsx|js)$/.test(name) && !name.endsWith('.d.ts')) yield p
  }
}

/** An array literal holding 3+ subject-looking strings. */
const SUBJECTY = /\[[^\]\n]*?(['"`])(Physics|Chemistry|Biology|Mathematics|Maths|English|Hindi|Social Science|Computer Science)\1[^\]\n]*?\]/

test('no module declares its own subject array', () => {
  const hits = []
  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1).replace(/\\/g, '/')
    if (ALLOWED.has(rel)) continue
    const lines = readFileSync(file, 'utf-8').split('\n')
    lines.forEach((line, i) => {
      if (!SUBJECTY.test(line)) return
      // count how many subject names are on the line — 3+ is a list
      const names = line.match(/(Physics|Chemistry|Biology|Mathematics|Maths|English|Hindi|Social Science|Computer Science|Economics|Geography|History)/g) || []
      if (names.length >= 3) hits.push(`${rel}:${i + 1}  ${line.trim().slice(0, 100)}`)
    })
  }
  assert.deepEqual(hits, [],
    `hardcoded subject arrays found — use availableSubjects() from src/curriculum/subjects.ts:\n${hits.join('\n')}`)
})
