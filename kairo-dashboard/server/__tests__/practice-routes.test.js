/**
 * The two Practice AI routes: structured out, safe out, and mounted.
 *
 * The written-answer screen renders a rubric object directly onto a photo of
 * the student's handwriting. It trusts that object completely, so the shaping
 * that keeps a model's "6/5" from being drawn on someone's paper is tested
 * here, as is the promise that a grader outage never reaches a student as a
 * raw error.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { normaliseRubric } from '../routes/practice.js'

const SRC = readFileSync(join(import.meta.dirname, '..', 'routes', 'practice.js'), 'utf-8')
const APP = readFileSync(join(import.meta.dirname, '..', 'app.js'), 'utf-8')

/* ── structural ──────────────────────────────────────────────────────────── */

test('the practice router is mounted and behind auth', () => {
  assert.match(APP, /app\.use\('\/api\/practice',\s*practiceRoutes\)/)
  assert.match(SRC, /router\.use\(requireSupabaseAuth\)/)
})

test('both handlers fail through fail(), never a raw e.message', () => {
  assert.equal((SRC.match(/fail\(res, req, e/g) || []).length, 2)
  assert.ok(!/res\.status\(\d+\)\.json\(\{\s*error:\s*e\.message/.test(SRC))
})

test('both prompts demand JSON and the grader prompt is step-marking', () => {
  assert.equal((SRC.match(/Return ONLY valid JSON/g) || []).length, 2)
  assert.match(SRC, /STEP-MARKING/)
  // the differentiator: the teach-back rubric must forbid grading the English
  assert.match(SRC, /Never penalise informal words, slang, code-switching, or grammar/)
})

test('the degraded-state copy keeps the session going', () => {
  assert.match(SRC, /your photo is saved and it will be marked when the AI is back/)
  assert.match(SRC, /it will not count against you/)
})

/* ── normaliseRubric ─────────────────────────────────────────────────────── */

test('awarded can never exceed the marks available', () => {
  const r = normaliseRubric({ awarded: 9, steps: [{ marks: 5, awarded: 9, type: 'method' }] }, 5)
  assert.equal(r.total, 5)
  assert.equal(r.awarded, 5)
  assert.equal(r.steps[0].awarded, 5)
})

test('awarded is derived from the steps when they exist', () => {
  const r = normaliseRubric({
    awarded: 5,   // the model's headline disagrees with its own steps
    steps: [
      { line: 1, marks: 1, awarded: 1, type: 'method', title: 'Formula stated' },
      { line: 2, marks: 2, awarded: 2, type: 'substitution' },
      { line: 3, marks: 1, awarded: 0, type: 'units', title: 'Units dropped' },
      { line: null, marks: 1, awarded: 0, type: 'presentation' },
    ],
  }, 5)
  assert.equal(r.awarded, 3)
})

test('an invented step type becomes method; a bad line becomes null', () => {
  const r = normaliseRubric({ steps: [{ line: 'two', marks: 1, awarded: 1, type: 'neatness' }] }, 3)
  assert.equal(r.steps[0].type, 'method')
  assert.equal(r.steps[0].line, null)
})

test('a missing verdict is filled in honestly', () => {
  assert.match(normaliseRubric({ steps: [{ marks: 2, awarded: 2 }] }, 2).verdict, /Full marks/)
  assert.match(normaliseRubric({ steps: [{ marks: 2, awarded: 1 }] }, 2).verdict, /1 of 2/)
})

test('garbage in is null out, not a crash', () => {
  assert.equal(normaliseRubric(null, 5), null)
  assert.equal(normaliseRubric('text', 5), null)
  const r = normaliseRubric({}, 5)
  assert.equal(r.awarded, 0)
  assert.deepEqual(r.steps, [])
})
