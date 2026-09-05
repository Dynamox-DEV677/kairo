/**
 * Battles are against Kyno, never against another child.
 *
 * Pairing two students was the only place in the app where one child's
 * identity was put in front of another. It is gone. The round is unchanged --
 * seven questions, sixty seconds, faster right answers score more -- and the
 * opponent is Kyno, playing at an accuracy calibrated to this student's
 * mastery, deterministic from the round seed so a result can be recomputed.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { kynoPlay, kynoScoreAfter, KYNO_ACCURACY, KYNO_OPPONENT_NAME, ROUND } from '../../src/lib/arena.core.js'

const ROOT = join(import.meta.dirname, '..', '..')
const progress = readFileSync(join(ROOT, 'src', 'pages', 'Progress.tsx'), 'utf-8')

test('Kyno plays at the accuracy its band promises', () => {
  for (const band of [1, 2, 3]) {
    let correct = 0, total = 0
    for (let seed = 1; seed <= 3000; seed++) {
      const play = kynoPlay(ROUND.questions, { band, seed })
      correct += play.filter(p => p.correct).length
      total += play.length
    }
    const measured = correct / total
    assert.ok(Math.abs(measured - KYNO_ACCURACY[band]) < 0.03,
      `band ${band} measured ${measured.toFixed(3)}, promised ${KYNO_ACCURACY[band]}`)
  }
})

test('a round is deterministic, so a result can be rechecked', () => {
  assert.deepEqual(kynoPlay(7, { band: 2, seed: 99 }), kynoPlay(7, { band: 2, seed: 99 }))
  assert.notDeepEqual(kynoPlay(7, { band: 2, seed: 99 }), kynoPlay(7, { band: 2, seed: 100 }))
})

test('accuracy is configurable, as the brief asks', () => {
  assert.ok(kynoPlay(7, { seed: 3, accuracy: 1 }).every(p => p.correct))
  assert.ok(kynoPlay(7, { seed: 3, accuracy: 0 }).every(p => !p.correct))
})

test('the score only counts questions the student has reached', () => {
  const play = kynoPlay(7, { band: 3, seed: 5 })
  assert.equal(kynoScoreAfter(play, 0), 0)
  assert.ok(kynoScoreAfter(play, 7) >= kynoScoreAfter(play, 3))
  assert.equal(kynoScoreAfter(play, 99), kynoScoreAfter(play, 7), 'never past the end')
})

test('no path can pair two students any more', () => {
  for (const gone of ['queueForBattle', 'findOpponent', 'leaveQueue', 'matched with someone', 'Nobody free']) {
    assert.ok(!progress.includes(gone), `Progress still references ${gone}`)
  }
  assert.ok(progress.includes('Play Kyno'), 'the action names the opponent')
  assert.ok(progress.includes(KYNO_OPPONENT_NAME), 'and so does the scoreboard')
})

test('the round keeps its shape', () => {
  assert.equal(ROUND.questions, 7)
  assert.equal(ROUND.seconds, 60)
})
