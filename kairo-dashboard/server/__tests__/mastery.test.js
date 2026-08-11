import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  updateMastery, decayMastery, band, sm2, weightFor, daysBetween, BKT,
} from '../utils/mastery.js'

test('a correct answer raises mastery, a wrong one lowers it', () => {
  const start = 0.5
  assert.ok(updateMastery(start, true) > start)
  assert.ok(updateMastery(start, false) < start)
})

test('mastery stays inside 0..1 no matter how one-sided the evidence', () => {
  let m = BKT.pInit
  for (let i = 0; i < 200; i++) m = updateMastery(m, true, 2)
  assert.ok(m > 0 && m < 1, `ran away to ${m}`)

  let w = BKT.pInit
  for (let i = 0; i < 200; i++) w = updateMastery(w, false, 2)
  assert.ok(w > 0 && w < 1, `ran away to ${w}`)
})

test('guessing is modelled, so one lucky MCQ is not mastery', () => {
  // A single correct 4-option answer must not push a beginner into 'strong'.
  const after = updateMastery(BKT.pInit, true)
  assert.notEqual(band(after), 'strong', `one guess reached ${after}`)
})

test('sustained correct answers do reach strong', () => {
  let m = BKT.pInit
  for (let i = 0; i < 8; i++) m = updateMastery(m, true, 1.5)
  assert.equal(band(m), 'strong', `8 correct only reached ${m}`)
})

test('a heavier signal moves mastery further than a light one', () => {
  const light = updateMastery(0.5, true, weightFor('doubt'))
  const heavy = updateMastery(0.5, true, weightFor('mock_question'))
  assert.ok(heavy > light, `mock ${heavy} did not beat doubt ${light}`)
})

test('mastery decays with time, and well-known topics decay slower', () => {
  assert.equal(decayMastery(0.8, 0), 0.8)
  assert.ok(decayMastery(0.8, 30) < 0.8)

  // Same elapsed time: the stronger topic should retain a larger fraction.
  const strongKept = decayMastery(0.9, 30) / 0.9
  const weakKept   = decayMastery(0.5, 30) / 0.5
  assert.ok(strongKept > weakKept, 'a well-known topic faded faster than a shaky one')
})

test('a topic is never both weak and strong', () => {
  // The whole point of one number. Bands must be disjoint and total.
  for (let m = 0; m <= 1.0001; m += 0.01) {
    const b = band(m)
    assert.ok(['weak', 'developing', 'strong'].includes(b), `no band at ${m}`)
  }
  assert.equal(band(0.2), 'weak')
  assert.equal(band(0.55), 'developing')
  assert.equal(band(0.9), 'strong')
})

test('SM-2 ladders up on passes and resets on a fail', () => {
  let c = sm2({}, 4)
  assert.equal(c.interval, 1)
  c = sm2(c, 4); assert.equal(c.interval, 6)
  c = sm2(c, 4); assert.ok(c.interval > 6)

  const failed = sm2(c, 1)
  assert.equal(failed.interval, 1, 'a lapse must return to a 1-day interval')
  assert.equal(failed.reps, 0)
  assert.equal(failed.lapses, 1)
  assert.ok(failed.ease < c.ease, 'ease should be penalised by a lapse')
})

test('ease never falls below the SM-2 floor', () => {
  let c = {}
  for (let i = 0; i < 30; i++) c = sm2(c, 0)
  assert.ok(c.ease >= 1.3, `ease collapsed to ${c.ease}`)
})

test('due dates are real and in the future', () => {
  const c = sm2({}, 5)
  assert.ok(!Number.isNaN(Date.parse(c.dueAt)))
  assert.ok(Date.parse(c.dueAt) > Date.now(), 'card was due immediately')
  // The live app shows "forgetting in 0h" for everything; that is the bug this
  // assertion exists to prevent coming back.
})

test('daysBetween handles a missing timestamp', () => {
  assert.equal(daysBetween(null), 0)
  assert.equal(daysBetween(undefined), 0)
})
