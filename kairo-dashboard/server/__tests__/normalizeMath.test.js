/**
 * The reported bug: `V = I \times R` rendered literally in chat.
 *
 * All 21 render sites already load remark-math, so the plugin was never the
 * problem — remark-math only looks inside `$...$`, and the model writes
 * commands bare. These pin the repair.
 *
 * Imports the real module directly (it is plain .js for exactly this reason),
 * so there is no transpiled copy to drift.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeMath } from '../../src/lib/normalizeMath.js'

test('the reported bug: bare \\times gets delimiters', () => {
  const out = normalizeMath('V = I \\times R')
  assert.ok(out.includes('$'), `not wrapped: ${out}`)
  assert.ok(out.includes('\\times'), 'command was lost')
})

test('math already wrapped is left alone', () => {
  const already = 'The law is $V = I \\times R$ exactly.'
  assert.equal(normalizeMath(already), already)
})

test('display math is left alone', () => {
  const block = '$$\\frac{a}{b}$$'
  assert.equal(normalizeMath(block), block)
})

test('code blocks are never touched', () => {
  const code = '```\nconst x = a \\times b\n```'
  assert.equal(normalizeMath(code), code)
})

test('inline code is never touched', () => {
  const code = 'Call `\\times` in LaTeX.'
  assert.equal(normalizeMath(code), code)
})

test('plain prose with no LaTeX is returned unchanged', () => {
  const prose = "Ohm's law relates voltage, current and resistance."
  assert.equal(normalizeMath(prose), prose)
})

test('text without any backslash short-circuits', () => {
  const s = 'no maths here at all'
  assert.equal(normalizeMath(s), s)
})

test('a bulleted equation keeps its bullet outside the math', () => {
  const out = normalizeMath('- P = V \\times I')
  assert.ok(/^-\s/.test(out), `bullet was swallowed: ${out}`)
  assert.ok(out.includes('$'), 'not wrapped')
})

test('a sentence containing maths does not become one math span', () => {
  // Wrapping a whole sentence makes KaTeX render an unreadable error box,
  // which is worse than the stray backslash we started with.
  const out = normalizeMath('We know that P = V \\times I, which gives power in watts.')
  assert.ok(!out.trim().startsWith('$'), `whole sentence was wrapped: ${out}`)
  assert.ok(out.includes('$'), 'command not wrapped at all')
})

test('empty and null input do not throw', () => {
  assert.equal(normalizeMath(''), '')
  assert.equal(normalizeMath(undefined), undefined)
})
