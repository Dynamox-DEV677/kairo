/**
 * The 490 Tracker — acceptance. The bar: every number must trace to the
 * student's real answer history; no data → no number, ever.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  goalPlan, subjectProjection, leverTopics, suggestSubjects, parseGoal, MIN_ATTEMPTS,
} from '../../src/lib/goal.core.js'

// A believable twin: strong-ish Physics, leaky Chemistry, no English data.
const MASTERY = [
  { subject: 'Physics',   topic: 'Motion',        mastery: 0.62, attempts: 14, correct: 13 },
  { subject: 'Physics',   topic: 'Optics',        mastery: 0.48, attempts: 10, correct: 8 },
  { subject: 'Chemistry', topic: 'Atoms',         mastery: 0.35, attempts: 12, correct: 8 },
  { subject: 'Chemistry', topic: 'Acids & Bases', mastery: 0.22, attempts: 10, correct: 4 },
  { subject: 'English',   topic: 'Prose',         mastery: 0.5,  attempts: 2,  correct: 2 },
]
const TARGET = { total: 196, subjects: ['Physics', 'Chemistry'] } // 98 each

test('projection is real accuracy, not raw mastery', () => {
  const p = subjectProjection(MASTERY, 'Physics')
  // 21 correct of 24 attempts = 88% — NOT the ~55% raw mastery would claim.
  assert.equal(p.projected, 88)
  assert.equal(p.attempts, 24)
})

test('DONE WHEN: below MIN_ATTEMPTS there is NO number, never a guess', () => {
  const p = subjectProjection(MASTERY, 'English') // only 2 attempts
  assert.equal(p.projected, null)
  assert.equal(p.confidence, 'none')
  assert.ok(MIN_ATTEMPTS >= 5)
})

test('the plan finds the gap and the lever that closes it', () => {
  const plan = goalPlan({ mastery: MASTERY, target: TARGET })
  assert.ok(plan.ready, 'both subjects have data')
  const chem = plan.subjects.find(s => s.subject === 'Chemistry')
  assert.equal(chem.projected, Math.round((12 / 22) * 100)) // 55
  assert.ok(chem.gap > 0)
  assert.equal(chem.onTrack, false)
  // Acids & Bases has 6 wrong vs Atoms' 4 — it is the bigger lever.
  assert.equal(chem.levers[0].topic, 'Acids & Bases')
  assert.ok(chem.levers[0].gainEstimate >= chem.levers[1].gainEstimate)
  // Headline lever is the biggest one anywhere.
  assert.equal(plan.topLever.topic, 'Acids & Bases')
})

test('pace headline only when EVERY subject has data', () => {
  const partial = goalPlan({ mastery: MASTERY, target: { total: 294, subjects: ['Physics', 'Chemistry', 'English'] } })
  assert.equal(partial.ready, false)
  assert.equal(partial.paceTotal, null, 'no fabricated total from partial data')
  assert.equal(partial.subjectsWithData, 2)

  const full = goalPlan({ mastery: MASTERY, target: TARGET })
  assert.equal(full.paceTotal, 88 + 55)
})

test('an on-track subject earns no levers and no nag', () => {
  const plan = goalPlan({ mastery: MASTERY, target: { total: 160, subjects: ['Physics', 'Chemistry'] } }) // 80 each
  const phy = plan.subjects.find(s => s.subject === 'Physics')
  assert.equal(phy.onTrack, true)
  // Physics IS above its 80 target, so it contributes no levers to the headline.
  assert.ok(plan.topLever == null || plan.topLever.subject !== 'Physics')
})

test('setup helpers: suggested subjects lead with what was actually practised', () => {
  const s = suggestSubjects(MASTERY)
  assert.equal(s[0], 'Physics')          // most attempts
  assert.ok(s.includes('Mathematics'))   // topped up from the standard list
  assert.ok(!s.some(x => /general/i.test(x)))
})

test('parseGoal round-trips and rejects junk', () => {
  assert.deepEqual(parseGoal(JSON.stringify({ total: 490, subjects: ['A', 'B'] })), { total: 490, subjects: ['A', 'B'] })
  assert.equal(parseGoal('{"total":"nope","subjects":[]}'), null)
  assert.equal(parseGoal('not json'), null)
})
