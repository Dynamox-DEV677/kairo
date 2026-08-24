/**
 * Audit task 1 — math delimiter normalisation. Acceptance: a fixture set of
 * realistic model outputs (inline, display, mixed, Greek, fractions,
 * integrals, chemistry, vectors) renders with zero visible raw LaTeX
 * delimiters and zero stray $$. "Renders" here = after normalisation the
 * string contains no \(…\)/\[…\] and every $$ is paired — which is exactly
 * what remark-math needs to render it.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeMathDelimiters as fix, MATH_STYLE_RULE } from '../../src/lib/math.core.js'

/** 20 fixtures shaped like real Groq solver output. */
const FIXTURES = [
  // 1-3: the reported repro — inline \(…\) inside prose
  'The discriminant \\(\\Delta = b^2 - 4ac\\) decides the nature of roots.',
  'When \\(\\Delta > 0\\) the roots are real and distinct.',
  'Here \\(a\\ne0\\), \\(b\\), and \\(c\\) are real coefficients.',
  // 4-6: display \[…\]
  'The quadratic formula is:\n\\[x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}\\]\nUse it when factoring fails.',
  '\\[\\int_0^1 x^2\\,dx = \\frac{1}{3}\\]',
  'Energy: \\[E = mc^2\\] which Einstein derived.',
  // 7-8: mixed $ and \( in ONE answer (the actual model behaviour)
  'For $ax^2+bx+c=0$, the discriminant \\(\\Delta = b^2-4ac\\) tells us: $$x = \\frac{-b\\pm\\sqrt{\\Delta}}{2a}$$',
  'Slope $m = \\tan\\theta$ where \\(\\theta\\) is the angle with the x-axis.',
  // 9: the dangling-$$ leak from the audit ("lost left-hand side")
  'So the roots are = \\frac{4 \\pm 8}{4}$$ giving $x_1 = 3$ and $x_2 = -1$.',
  // 10: doubled delimiters
  'Result: $$$$v = u + at$$$$ by definition.',
  // 11-12: Greek + vectors
  '\\(\\alpha + \\beta = -b/a\\) and \\(\\alpha\\beta = c/a\\).',
  'Force \\(\\vec{F} = m\\vec{a}\\) is a vector equation.',
  // 13-14: chemistry
  'Sulphuric acid \\(H_2SO_4\\) is a strong acid; in water: \\[H_2SO_4 \\rightarrow 2H^+ + SO_4^{2-}\\]',
  'States: \\(2H_2(g) + O_2(g) \\rightarrow 2H_2O(l)\\) at STP.',
  // 15: integrals inline
  'The area is \\(\\int_a^b f(x)\\,dx\\), taken over the interval.',
  // 16: multiline display with aligned content
  'Solving:\n\\[\n\\begin{aligned} 2x + 3 &= 7 \\\\ x &= 2 \\end{aligned}\n\\]',
  // 17: code fence must be untouched
  'In Python:\n```py\nprint("\\(not math\\)")\n```\nBut \\(x=2\\) is math.',
  // 18: inline code must be untouched
  'Type `\\(escaped\\)` literally, though \\(y=3\\) renders.',
  // 19: already-clean output stays identical
  'Clean: $E=mc^2$ and $$F=ma$$ need no changes.',
  // 20: prose with currency-adjacent dollars stays sane
  'The kit costs $5. The voltage is \\(V=IR\\).',
]

test('DONE WHEN: zero raw LaTeX delimiters and zero stray $$ across all 20 fixtures', () => {
  for (const [i, raw] of FIXTURES.entries()) {
    const out = fix(raw)
    // no \( \) \[ \] outside code…
    const outsideCode = out.split(/(```[\s\S]*?```|`[^`\n]*`)/).filter((_, j) => j % 2 === 0).join('')
    assert.ok(!/\\[()[\]]/.test(outsideCode), `fixture ${i + 1} still has raw delimiters: ${out}`)
    // …and every $$ is paired
    const dd = (outsideCode.match(/\$\$/g) || []).length
    assert.equal(dd % 2, 0, `fixture ${i + 1} has a dangling $$: ${out}`)
  }
})

test('specific conversions land exactly', () => {
  assert.equal(fix('\\(x\\)'), '$x$')
  assert.equal(fix('\\[x=2\\]'), '$$x=2$$')
  assert.equal(fix('$$$$v$$$$'), '$$v$$')
})

test('the dangling-$$ leak is repaired by dropping the orphan, not eating the answer', () => {
  const out = fix('roots are = \\frac{4 \\pm 8}{4}$$ giving $x_1 = 3$.')
  assert.ok(!out.includes('$$'), 'orphan removed')
  assert.ok(out.includes('$x_1 = 3$'), 'inline math after the orphan survives')
})

test('code is sacred: fences and inline code pass through byte-identical', () => {
  const fence = '```py\nprint("\\(not math\\)")\n```'
  assert.ok(fix(fence).includes('\\(not math\\)'))
  const inline = 'use `\\(lit\\)` here'
  assert.ok(fix(inline).includes('`\\(lit\\)`'))
})

test('clean input is a no-op; junk input is safe', () => {
  const clean = 'Clean: $E=mc^2$ and $$F=ma$$ stay.'
  assert.equal(fix(clean), clean)
  assert.equal(fix(null), '')
  assert.equal(fix(undefined), '')
})

test('the style rule pins one convention for the prompts', () => {
  assert.match(MATH_STYLE_RULE, /\$\.\.\.\$/)
  assert.match(MATH_STYLE_RULE, /Never use/)
})
