import { loadState } from './twin'
import { loadGame } from './game'
import * as core from './selectors.core.js'

/**
 * The single read surface for every derived number in the app.
 *
 * Components import from here and nowhere else. Before this, 27 files
 * recomputed XP, streak, level and prediction independently, which is why Home
 * said "3 day streak", the same screen later said "0 day streak", and the Kyno
 * tab said "0d" — all at the same moment, all "correct" by their own maths.
 *
 * The arithmetic lives in selectors.core.js so the tests exercise the real
 * implementation rather than a copy. This file only supplies the state.
 */

export { MASTERY_BAR, PREDICTION_MIN_SCORED } from './selectors.core.js'

export interface Prediction {
  ready: boolean
  need?: number
  reason?: string
  low?: number
  high?: number
  mid?: number
  outOf?: number
  basedOn?: number
}

/** Consecutive active days, derived from the event log — never from a stored
 *  counter and never from anything the student can type in. */
export function selectStreak(): number {
  return core.selectStreak(loadState().events)
}

/**
 * Streak plus the grace mechanic: one forgiven day per week, so a single
 * missed day does not reset a month of work to zero.
 *
 * Freezes are derived from the event log, not stored, so there is nothing to
 * sync and nothing that can disagree with the history.
 */
export function selectStreakDetail() {
  return core.selectStreakDetail(loadState().events)
}

export function selectXP(): { total: number; today: number; week: number } {
  return core.selectXP(loadGame())
}

export function selectLevel(): { level: number; into: number; need: number; pct: number } {
  return core.selectLevel(selectXP().total)
}

export function selectMastered(): number {
  return core.selectMastered(loadState().mastery)
}

/** null means "not enough data", which the UI must render as such rather than
 *  as 0% — see the note in selectors.core.js. */
export function selectRetention(): number | null {
  return core.selectRetention(loadState().mastery)
}

/**
 * `outOf` is the paper total (360 for NEET, 300 for JEE Main, 80 for a board
 * subject paper). Defaults to a percentage.
 */
export function selectPrediction(outOf = 100): Prediction {
  return core.selectPrediction(loadState().events, outOf)
}

/** Everything the home screen needs, in one read, so a single render cannot
 *  show two numbers that disagree. */
export function selectProgress() {
  const xp = selectXP()
  return {
    xp,
    level: core.selectLevel(xp.total),
    streak: selectStreak(),
    mastered: selectMastered(),
    retention: selectRetention(),
  }
}
