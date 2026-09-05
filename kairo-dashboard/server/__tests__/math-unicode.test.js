/**
 * Unicode maths must reach KaTeX as LaTeX.
 *
 * Students and models write Greek as Unicode -- "sin θ + cos θ", a resistance
 * of "5 Ω" -- not as \theta and \Omega. KaTeX treats a raw Unicode Greek
 * letter inside math mode as an unknown symbol, so in strict mode it refused
 * the whole expression and the flashcard rendered nothing at all:
 *
 *   LaTeX-incompatible input and strict mode is set to 'warn':
 *   Unrecognized Unicode character "Ω" (937) [unknownSymbol]
 *
 * The mapping runs ONLY inside math spans. In prose "θ" is already the right
 * character and the student should see it; rewriting prose would put a literal
 * \theta on the screen, which is the opposite of the fix.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { prepMathMarkdown, normalizeMathUnicode } from '../../src/lib/math.core.js'

test('Unicode Greek inside maths becomes a LaTeX command', () => {
  assert.equal(normalizeMathUnicode('$sin θ + cos θ$'), '$sin \\theta + cos \\theta$')
  assert.equal(normalizeMathUnicode('R = 5 $Ω$'), 'R = 5 $\\Omega$')
  assert.equal(normalizeMathUnicode('$$μ = 0.3$$'), '$$\\mu = 0.3$$')
})

test('a command never runs into the next letter', () => {
  // "\Deltax" is an unknown command; "\Delta x" is a delta and an x.
  assert.equal(normalizeMathUnicode('$$Δx ≥ 0$$'), '$$\\Delta x \\ge 0$$')
  assert.equal(normalizeMathUnicode('$Δ + 1$'), '$\\Delta + 1$', 'and no stray space when none is needed')
})

test('operators, units and the symbols physics is made of', () => {
  assert.equal(normalizeMathUnicode('$3 × 4 ÷ 2 ≠ 5$'), '$3 \\times 4 \\div 2 \\neq 5$')
  assert.equal(normalizeMathUnicode('$90°$'), '$90^{\\circ}$')
  assert.equal(normalizeMathUnicode('$x ≤ y ≥ z ± 1$'), '$x \\le y \\ge z \\pm 1$')
  assert.equal(normalizeMathUnicode('$∑ ∫ ∂ ∇ ∞$'), '$\\sum \\int \\partial \\nabla \\infty$')
})

test('prose and code are left exactly alone', () => {
  // a student should read θ as θ, never as \theta
  assert.equal(normalizeMathUnicode('The angle θ is 30°.'), 'The angle θ is 30°.')
  assert.equal(normalizeMathUnicode('`θ`'), '`θ`')
  assert.equal(normalizeMathUnicode('```\nΩ\n```'), '```\nΩ\n```')
  assert.equal(normalizeMathUnicode('$\\theta$'), '$\\theta$', 'already-LaTeX is untouched')
  assert.equal(normalizeMathUnicode(''), '')
})

test('the flashcard path end to end: Unicode in, maths out', () => {
  assert.equal(prepMathMarkdown('$sin θ + cos θ$'), '$sin \\theta + cos \\theta$')
  // the four cases the brief asks to see render
  assert.match(prepMathMarkdown('$\\sin\\theta + \\cos\\theta$'), /\\sin\\theta/)
  assert.match(prepMathMarkdown('Resistance is $5 Ω$'), /\\Omega/)
  assert.match(prepMathMarkdown('$$E = mc^2$$'), /\$\$E = mc\^2\$\$/)
})

test('every KaTeX render site uses the shared options, so strict mode is off everywhere', () => {
  const SRC = join(import.meta.dirname, '..', '..', 'src')
  const walk = d => readdirSync(d).flatMap(n => {
    const p = join(d, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
  const offenders = []
  for (const f of walk(SRC).filter(f => /\.tsx$/.test(f))) {
    const src = readFileSync(f, 'utf-8')
    if (!src.includes('rehypeKatex')) continue
    if (!src.includes('KATEX_OPTS')) offenders.push(f.slice(SRC.length + 1))
  }
  assert.deepEqual(offenders, [],
    'these render KaTeX without the shared options, so strict mode still drops Greek letters:\n  ' + offenders.join('\n  '))
})
