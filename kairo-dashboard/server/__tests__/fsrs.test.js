/**
 * FSRS + exam compression (brief part B) — the acceptance list, verbatim:
 * pure/deterministic, no card past the exam, zero new topics at 5 days out,
 * coverage outranks review at 200 days, all four phases + boundaries.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  initCard, reviewCard, nextInterval, retrievability, phaseFor, phasePolicy, RATINGS,
} from '../../src/lib/fsrs.core.js'
import { loadGraph, nodeStates } from '../../src/lib/syllabusGraph.core.js'
import { rankNodes } from '../../src/lib/syllabusRank.core.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const G = loadGraph(JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'data', 'syllabusGraph', 'cbse12-pcm.json'), 'utf-8')))

test('FSRS behaves like a memory model should', () => {
  const c = initCard(RATINGS.GOOD)
  assert.ok(c.stability > 0 && c.difficulty >= 1 && c.difficulty <= 10)

  // easier ratings → longer stability at init
  assert.ok(initCard(RATINGS.EASY).stability > initCard(RATINGS.GOOD).stability)
  assert.ok(initCard(RATINGS.GOOD).stability > initCard(RATINGS.AGAIN).stability)

  // a successful on-time review grows stability; a lapse shrinks it
  const grown = reviewCard(c, RATINGS.GOOD, 3)
  assert.ok(grown.stability > c.stability)
  const lapsed = reviewCard(grown, RATINGS.AGAIN, 3)
  assert.ok(lapsed.stability < grown.stability)
  assert.equal(lapsed.lapses, 1)

  // retrievability decays with time
  assert.ok(retrievability(1, 5) > retrievability(10, 5))

  // pure: same inputs, same outputs
  assert.deepEqual(reviewCard(c, RATINGS.GOOD, 3), reviewCard(c, RATINGS.GOOD, 3))
})

test('HARD RULE: no card is ever scheduled past the exam', () => {
  const strong = { stability: 200, difficulty: 4, reps: 9, lapses: 0 } // base interval ≫ exam
  for (const days of [200, 90, 89, 30, 29, 7, 6, 2, 1]) {
    const { intervalDays } = nextInterval(strong, { daysToExam: days })
    assert.ok(intervalDays < Math.max(2, days), `daysToExam=${days}: interval ${intervalDays} lands past the paper`)
  }
})

test('phases and their boundaries', () => {
  assert.equal(phaseFor(null), 'FAR')
  assert.equal(phaseFor(200), 'FAR')
  assert.equal(phaseFor(90), 'FAR')
  assert.equal(phaseFor(89.9), 'MID')
  assert.equal(phaseFor(30), 'MID')
  assert.equal(phaseFor(29.9), 'NEAR')
  assert.equal(phaseFor(7), 'NEAR')
  assert.equal(phaseFor(6.9), 'FINAL')
  assert.equal(phaseFor(0), 'FINAL')

  // compression really compresses
  const c = { stability: 40, difficulty: 5, reps: 4, lapses: 0 }
  const far = nextInterval(c, { daysToExam: 200 }).intervalDays
  const mid = nextInterval(c, { daysToExam: 60 }).intervalDays
  const near = nextInterval(c, { daysToExam: 20 }).intervalDays
  assert.ok(far > mid && mid > near, `${far} > ${mid} > ${near} expected`)
})

test('ACCEPTANCE: 5 days out the plan contains zero new topics', () => {
  const p = phasePolicy(5)
  assert.equal(p.phase, 'FINAL')
  assert.equal(p.newAllowed, false)
  assert.equal(p.reviewShare, 1)
})

test('ACCEPTANCE: 200 days out, coverage outranks review in the ordering', () => {
  const p = phasePolicy(200)
  assert.equal(p.newAllowed, true)
  assert.ok(p.reviewShare < 0.5, 'coverage-first far out')

  // and the risk ranking itself surfaces untouched high-mark chapters above
  // marginal review: a student solid-with-mild-decay everywhere except two
  // untouched big chapters must see the untouched ones first.
  const mastery = G.chapters
    .filter(c => !['math.u3.integrals', 'chem.u1.electrochem'].includes(c.id))
    .map(c => ({ subject: subjName(c), topic: c.name, mastery: 0.8, retentionNow: 0.8, attempts: 4, lastStudiedAt: 1 }))
  const states = nodeStates(G, { events: [], mastery })
  const ranked = rankNodes(G, states, { max: 4 })
  const topIds = ranked.map(r => r.node.id)
  assert.ok(topIds.includes('chem.u1.electrochem'), `untouched electrochem in top: ${topIds}`)
  assert.ok(ranked[0].state === 'UNTOUCHED', 'an untouched chapter leads')

  function subjName(c) {
    return c.id.startsWith('phy') ? 'Physics' : c.id.startsWith('chem') ? 'Chemistry' : 'Mathematics'
  }
})

test('prereq gate: an untouched prerequisite surfaces INSTEAD, with the reason', () => {
  // Aldehydes (8 marks, pyq 1.0) outranks its whole prereq chain
  // (alcohols ← haloalkanes) when all three are untouched. The gate must
  // surface the chain's ROOT, not the high-scorer.
  const UNTOUCHED = new Set(['chem.u3.haloalkanes', 'chem.u3.alcohols', 'chem.u3.aldehydes'])
  const states = nodeStates(G, { events: [], mastery: G.chapters
    .filter(c => !UNTOUCHED.has(c.id))
    .map(c => ({
      subject: c.id.startsWith('phy') ? 'Physics' : c.id.startsWith('chem') ? 'Chemistry' : 'Mathematics',
      topic: c.name, mastery: 0.9, retentionNow: 0.9, attempts: 4, lastStudiedAt: 1,
    })) })

  const ranked = rankNodes(G, states, { max: 6 })
  const sub = ranked.find(r => r.substitutedFor?.id === 'chem.u3.aldehydes')
  assert.ok(sub, `the blocked chapter was substituted; got ${ranked.map(r => r.node.id).join(',')}`)
  assert.equal(sub.node.id, 'chem.u3.haloalkanes', 'the chain walks to its untouched ROOT')
  assert.match(sub.reason, /Comes before/)
  assert.ok(!ranked.some(r => r.node.id === 'chem.u3.aldehydes'), 'the blocked node itself never surfaces')
})
