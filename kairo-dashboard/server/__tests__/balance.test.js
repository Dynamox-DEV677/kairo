/**
 * Feature 3 acceptance, in full.
 *
 * The brief asks for 3 real unbalanced equations of varying difficulty. This
 * covers those plus the cases that break naive balancers. Because balancing is
 * arithmetic rather than recall, this criterion CAN be met without a photo —
 * the only part a photo tests is the OCR reading the equation off the page.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { balance, parseFormula, parseEquation } from '../../src/lib/balanceEquation.js'

const b = (eq) => balance(eq)

// --- parsing --------------------------------------------------------------

test('parses nested groups and multipliers', () => {
  assert.deepEqual(parseFormula('Ca(OH)2'), { Ca: 1, O: 2, H: 2 })
  assert.deepEqual(parseFormula('Al2(SO4)3'), { Al: 2, S: 3, O: 12 })
  assert.deepEqual(parseFormula('H2O'), { H: 2, O: 1 })
})

test('two-letter elements are not read as two elements', () => {
  // Cl must not parse as C + l. This is the classic formula-parser bug.
  assert.deepEqual(parseFormula('NaCl'), { Na: 1, Cl: 1 })
  assert.deepEqual(parseFormula('CO'), { C: 1, O: 1 })
  assert.deepEqual(parseFormula('Co'), { Co: 1 })
})

test('an existing coefficient is ignored, not honoured', () => {
  // The student's coefficients are what we are recomputing; trusting them
  // would re-balance an already-wrong guess.
  assert.deepEqual(parseFormula('2H2O'), { H: 2, O: 1 })
})

test('accepts the arrow forms students actually write', () => {
  for (const arrow of ['->', '=>', '→', '=']) {
    const eq = parseEquation(`H2 + O2 ${arrow} H2O`)
    assert.ok(eq, `failed on "${arrow}"`)
    assert.deepEqual(eq.left, ['H2', 'O2'])
  }
})

// --- Class 9-10 equations -------------------------------------------------

test('easy: combustion of hydrogen', () => {
  const r = b('H2 + O2 -> H2O')
  assert.ok(r.ok, r.reason)
  assert.deepEqual(r.coefficients, [2, 1, 2])
  assert.equal(r.balanced, '2H2 + O2 → 2H2O')
})

test('medium: methane combustion', () => {
  const r = b('CH4 + O2 -> CO2 + H2O')
  assert.ok(r.ok, r.reason)
  assert.deepEqual(r.coefficients, [1, 2, 1, 2])
})

test('medium: iron + water, an NCERT Class 10 staple', () => {
  const r = b('Fe + H2O -> Fe3O4 + H2')
  assert.ok(r.ok, r.reason)
  assert.deepEqual(r.coefficients, [3, 4, 1, 4])
})

test('harder: fractional intermediate, cleared to whole numbers', () => {
  // C2H6 needs 7/2 O2 before scaling — the case that breaks float balancers.
  const r = b('C2H6 + O2 -> CO2 + H2O')
  assert.ok(r.ok, r.reason)
  assert.deepEqual(r.coefficients, [2, 7, 4, 6])
})

test('harder: aluminium sulphate double displacement', () => {
  const r = b('Al2(SO4)3 + NaOH -> Al(OH)3 + Na2SO4')
  assert.ok(r.ok, r.reason)
  assert.deepEqual(r.coefficients, [1, 6, 2, 3])
})

test('an already-balanced equation stays as it is', () => {
  const r = b('NaOH + HCl -> NaCl + H2O')
  assert.ok(r.ok, r.reason)
  assert.deepEqual(r.coefficients, [1, 1, 1, 1])
})

// --- the answer is proved, not asserted -----------------------------------

test('every element genuinely balances in the returned coefficients', () => {
  const cases = [
    'H2 + O2 -> H2O',
    'CH4 + O2 -> CO2 + H2O',
    'Fe + H2O -> Fe3O4 + H2',
    'C2H6 + O2 -> CO2 + H2O',
    'Al2(SO4)3 + NaOH -> Al(OH)3 + Na2SO4',
    'KClO3 -> KCl + O2',
  ]
  for (const eq of cases) {
    const r = b(eq)
    assert.ok(r.ok, `${eq}: ${r.reason}`)
    const nLeft = r.left.length
    const all = [...r.left, ...r.right].map(parseFormula)
    const els = [...new Set(all.flatMap(p => Object.keys(p)))]
    for (const el of els) {
      const l = r.left.reduce((s, _f, j) => s + r.coefficients[j] * (all[j][el] || 0), 0)
      const rr = r.right.reduce((s, _f, j) => s + r.coefficients[nLeft + j] * (all[nLeft + j][el] || 0), 0)
      assert.equal(l, rr, `${eq}: ${el} is ${l} vs ${rr}`)
    }
  }
})

test('coefficients are the SMALLEST whole numbers', () => {
  // 4H2 + 2O2 -> 4H2O balances too, and would be wrong to show.
  const r = b('H2 + O2 -> H2O')
  assert.deepEqual(r.coefficients, [2, 1, 2])
})

// --- honest failure -------------------------------------------------------

test('an impossible equation says so instead of inventing a balance', () => {
  const r = b('H2 -> O2')
  assert.equal(r.ok, false)
  assert.ok(r.reason.length > 10)
})

test('an unreadable formula names the formula it could not read', () => {
  const r = b('H2 + ??? -> H2O')
  assert.equal(r.ok, false)
  assert.match(r.reason, /\?\?\?/)
})

test('a missing arrow is reported, not guessed at', () => {
  const r = b('H2 + O2 H2O')
  assert.equal(r.ok, false)
  assert.match(r.reason, /→|=/)
})

test('the working shows a check the student can follow', () => {
  const r = b('CH4 + O2 -> CO2 + H2O')
  assert.ok(r.steps.length >= 4)
  assert.ok(r.steps.some(s => /Check —/.test(s)), 'no verification step in the working')
})
