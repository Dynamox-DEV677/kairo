/**
 * Mistake Museum — acceptance. The bar: cards come from the student's real
 * wrong answers, retire only after FIX_STREAK consecutive corrects, and old
 * events without stored questions are shown honestly, not reconstructed.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  museumEntries, drillDeck, rotatedOptions, museumStats, cleanOption, questionKey, FIX_STREAK,
} from '../../src/lib/museum.core.js'

const Q1 = 'A convex lens always forms a real image. True or false?'
const P1 = { q: Q1, options: ['True', 'False'], correctIndex: 1, chosenIndex: 0, explanation: 'Virtual when object is inside f.' }

const ev = (over) => ({ type: 'quiz_answered', ts: 1000, subject: 'Physics', topic: 'optics', correct: false, difficulty: 0.5, durationMs: 30_000, ...over })

test('a wrong answer with a stored question becomes a rich card', () => {
  const { entries, legacy } = museumEntries([ev({ payload: P1 })])
  assert.equal(entries.length, 1)
  assert.equal(entries[0].question, Q1)
  assert.deepEqual(entries[0].options, ['True', 'False'])
  assert.equal(entries[0].chosenIndex, 0)
  assert.equal(entries[0].fixed, false)
  assert.equal(legacy.length, 0)
})

test('DONE WHEN: two consecutive corrects retire a card; a later miss un-retires it', () => {
  const wrong = ev({ payload: P1 })
  const right = ev({ ts: 2000, correct: true, payload: { q: Q1 } }) // thin payload on corrects
  const once = museumEntries([wrong, right]).entries[0]
  assert.equal(once.fixed, false, `needs ${FIX_STREAK} in a row`)

  const twice = museumEntries([wrong, right, { ...right, ts: 3000 }]).entries[0]
  assert.equal(twice.fixed, true)

  const relapse = museumEntries([wrong, right, { ...right, ts: 3000 }, ev({ ts: 4000, payload: P1 })]).entries[0]
  assert.equal(relapse.fixed, false, 'a new miss reopens it')
  assert.equal(relapse.misses, 2)
})

test('a non-consecutive correct does not count toward fixing', () => {
  const events = [
    ev({ payload: P1 }),                                  // wrong
    ev({ ts: 2000, correct: true, payload: { q: Q1 } }),  // right
    ev({ ts: 3000, payload: P1 }),                        // wrong again — resets
    ev({ ts: 4000, correct: true, payload: { q: Q1 } }),  // right (streak 1)
  ]
  assert.equal(museumEntries(events).entries[0].fixed, false)
})

test('old events without payload group into honest topic rows, never fake cards', () => {
  const { entries, legacy } = museumEntries([
    ev({}), ev({ ts: 1100 }), ev({ ts: 1200, topic: 'atoms', subject: 'Chemistry' }),
  ])
  assert.equal(entries.length, 0)
  assert.equal(legacy.length, 2)
  assert.equal(legacy[0].topic, 'optics')
  assert.equal(legacy[0].count, 2)
})

test('the why heuristic separates careless / timing / concept', () => {
  const fastEasy = museumEntries([ev({ durationMs: 5000, difficulty: 0.3, payload: P1 })]).entries[0]
  assert.equal(fastEasy.why, 'careless')
  const slow = museumEntries([ev({ durationMs: 90_000, payload: { ...P1, q: 'Q2' } })]).entries[0]
  assert.equal(slow.why, 'timing')
  const normal = museumEntries([ev({ payload: { ...P1, q: 'Q3' } })]).entries[0]
  assert.equal(normal.why, 'concept')
})

test('the drill takes oldest unfixed cards and rotates options answerably', () => {
  const wrongA = ev({ ts: 500, payload: { ...P1, q: 'QA', options: ['w', 'x', 'y', 'z'], correctIndex: 2 } })
  const wrongB = ev({ ts: 900, payload: { ...P1, q: 'QB' } })
  const { entries } = museumEntries([wrongA, wrongB])
  const deck = drillDeck(entries)
  assert.equal(deck[0].question, 'QA', 'oldest first')

  const rot = rotatedOptions(deck[0])
  assert.equal(rot.options.length, 4)
  assert.equal(rot.options[rot.correctIndex], 'y', 'rotation still points at the right answer')
})

test('stats + option cleaning', () => {
  const { entries } = museumEntries([
    ev({ payload: P1 }),
    ev({ payload: { ...P1, q: 'Q2' }, subject: 'Chemistry', durationMs: 90_000 }),
  ])
  const s = museumStats(entries)
  assert.equal(s.open, 2)
  assert.equal(s.bySubject.Physics, 1)
  assert.equal(s.byWhy.timing, 1)
  assert.equal(cleanOption('B) 42 m/s'), '42 m/s')
  assert.equal(cleanOption('  plain '), 'plain')
  assert.equal(questionKey('  A  B '), 'a b')
})
