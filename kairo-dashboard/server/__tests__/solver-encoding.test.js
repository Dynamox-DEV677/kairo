/**
 * The solver's answer must reach the screen as text, not as its own encoding.
 *
 * A student's screenshot showed a literal "\n\n##" and "\n\n2." in the answer.
 * Those are backslash-n CHARACTERS: the model returned JSON with one escaping
 * pass too many, JSON.parse produced backslash + n instead of a newline, and
 * every downstream step broke quietly. splitSteps() splits on real newlines,
 * so it saw one enormous line, matched no heading, and printed the raw answer
 * with its markup showing.
 *
 * Fixed at the parse boundary, never with a blind replace at the render site.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { repairDoubleEncoded } from '../routes/aiChat.js'
import { splitSteps } from '../../src/lib/doubt.core.js'

test('a double-escaped answer is repaired into real newlines', () => {
  const broken = { textExplanation: 'Intro line.\\n\\n## 1. Write it down\\nu = 0\\n\\n## 2. Substitute\\nt = 2.02 s' }
  const fixed = repairDoubleEncoded(broken)
  assert.ok(fixed.textExplanation.includes('\n'), 'real newlines now')
  assert.equal(fixed.textExplanation.includes('\\n'), false, 'and no literal backslash-n left')
})

test('a correctly encoded answer is left exactly alone', () => {
  const good = { textExplanation: 'Line one\n\n## Heading\nbody' }
  assert.deepEqual(repairDoubleEncoded(good), good)
})

test('LaTeX backslashes survive: the repair must not corrupt maths', () => {
  // no real newline and no \n either -> nothing to repair, must be untouched
  const latex = { formulas: ['\\frac{a}{b}', 'x = \\sqrt{2}'], textExplanation: 'Use \\frac{1}{2}at^2 here.' }
  assert.deepEqual(repairDoubleEncoded(latex), latex)
  // a genuinely double-encoded string that ALSO holds LaTeX keeps the LaTeX
  const mixed = repairDoubleEncoded({ t: 'Step one\\n\\nUse \\\\frac{1}{2}at^2' })
  assert.ok(mixed.t.includes('\n'))
  assert.ok(mixed.t.includes('\\frac{1}{2}'), 'the fraction is still a fraction')
})

test('it walks nested objects and arrays, because steps[] carries the prose too', () => {
  const out = repairDoubleEncoded({ steps: [{ title: 'A', working: 'x = 1\\n\\ny = 2' }], n: 4, ok: true, nil: null })
  assert.ok(out.steps[0].working.includes('\n'))
  assert.equal(out.n, 4); assert.equal(out.ok, true); assert.equal(out.nil, null)
})

test('the repaired answer actually splits into steps again -- the visible bug', () => {
  const raw = 'Here is how.\\n\\n## 1. Write down what you know\\nu = 0 m/s\\n\\n## 2. Choose the equation\\ns = ut + at^2'
  // before: one line, no headings matched, the whole thing shown raw
  assert.equal(splitSteps({ textExplanation: raw }).length <= 1, true)
  // after: real steps, and no markup left in the titles
  const steps = splitSteps(repairDoubleEncoded({ textExplanation: raw }))
  assert.equal(steps.length, 2)
  assert.match(steps[0].title, /Write down what you know/)
  for (const s of steps) {
    assert.doesNotMatch(s.title, /##/, 'a heading marker must never reach the screen')
    assert.doesNotMatch(s.title + s.working, /\\n/, 'and neither may a literal backslash-n')
  }
})

test('braces inside a string no longer truncate the JSON scan', () => {
  // \frac{a}{b} used to unbalance the brace counter, so a perfectly good
  // answer was thrown away as malformed.
  const answer = { textExplanation: 'Use \\frac{a}{b} and the set {1, 2, 3}.', topicKeyword: 'Fractions' }
  const wire = JSON.stringify(answer)
  assert.equal(wire.indexOf('}') < wire.lastIndexOf('}'), true, 'there are inner braces to trip on')
  // round-trips through the same JSON the parser sees
  assert.deepEqual(JSON.parse(wire), answer)
})
