/**
 * Maths that rendered wrong, found in the pre-production check (2026-10-23).
 *
 *  - A % inside maths is a LaTeX COMMENT: "\times 100% \text{…}" showed as
 *    "×100" with everything after it gone, in study guides and in every
 *    answer rendered through prepMathMarkdown.
 *  - Plain-text chemistry: "H2O" came out as an italic H times 2 times O,
 *    "Fe^3+" put the + on the baseline, "H_2O" dropped the O into the
 *    subscript, and "->" stayed a minus and a greater-than.
 *
 * Every expected string is also rendered by KaTeX with throwOnError, so a
 * "fix" that produces LaTeX KaTeX cannot draw fails here.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import katex from 'katex'
import { formulaTex } from '../../src/lib/bookStudio.core.js'
import { prepMathMarkdown } from '../../src/lib/math.core.js'

const draws = (tex) => assert.doesNotThrow(() => katex.renderToString(tex, { throwOnError: true, strict: false }), tex)

test('chemistry gets real subscripts and charges', () => {
  const cases = {
    'H2O': '\\mathrm{H_{2}O}',
    'CO2': '\\mathrm{CO_{2}}',
    'C6H12O6': '\\mathrm{C_{6}H_{12}O_{6}}',
    'Fe^3+': 'Fe^{3+}',
    'SO4^2-': '\\mathrm{SO_{4}}^{2-}',
    'H_2O': 'H_{2}O',
    'H_2SO_4': 'H_{2}SO_{4}',
    '2H2 + O2 -> 2H2O': '2\\mathrm{H_{2}} + \\mathrm{O_{2}} \\to 2\\mathrm{H_{2}O}',
  }
  for (const [plain, tex] of Object.entries(cases)) {
    assert.equal(formulaTex(plain), tex, plain)
    draws(tex)
  }
})

test('physics labels and ordinary formulas are left as they were', () => {
  assert.equal(formulaTex('R2 = V/I'), 'R2 = V/I', 'a lone symbol with a number is a label, not chemistry')
  assert.equal(formulaTex('x^2 + y^2'), 'x^{2} + y^{2}')
  assert.equal(formulaTex('F = ma'), 'F = ma')
  assert.equal(formulaTex('a^(n+1)'), 'a^{n+1}')
})

test('a % in a formula that is already LaTeX no longer deletes the rest of it', () => {
  const out = formulaTex(String.raw`\frac{m_{solute}}{m_{solution}} \times 100% \text{ by mass}`)
  assert.equal(out, String.raw`\frac{m_{solute}}{m_{solution}} \times 100\% \text{ by mass}`)
  draws(out)
  assert.equal(formulaTex(String.raw`50\% \times 2`), String.raw`50\% \times 2`, 'already escaped stays single')
})

test('a % inside maths in an answer is escaped, and only inside maths', () => {
  const md = prepMathMarkdown(String.raw`Efficiency is $\frac{out}{in} \times 100%$, about 40% here.`)
  assert.equal(md, String.raw`Efficiency is $\frac{out}{in} \times 100\%$, about 40% here.`)
  assert.equal(prepMathMarkdown(String.raw`$$x = 5% \text{ of } y$$`), String.raw`$$x = 5\% \text{ of } y$$`)
})

test('every citation format the model writes becomes a checked page chip', async () => {
  const { parseAnswer } = await import('../../src/lib/bookStudio.core.js')
  const ok = [3, 4, 12]
  assert.deepEqual(parseAnswer('Food [p. 12].', ok), { notInBook: false, text: 'Food (p. 12).', pages: [12] })
  assert.deepEqual(parseAnswer('Food (page 12).', ok).pages, [12])
  assert.deepEqual(parseAnswer('Both [pp. 3-4].', ok).pages, [3, 4])
  assert.equal(parseAnswer('Made up (page 99).', ok).text, 'Made up.', 'a page that was not given is dropped')
  assert.equal(parseAnswer('A plain (bracketed) aside.', ok).text, 'A plain (bracketed) aside.')
  const once = parseAnswer('X [p. 12].', ok).text
  assert.equal(parseAnswer(once, ok).text, once, 'parsing twice changes nothing')
})
