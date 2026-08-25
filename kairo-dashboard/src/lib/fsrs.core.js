/**
 * FSRS + exam-date compression (brief part B). Pure, no React, no I/O.
 *
 * The base algorithm is FSRS (the free-spaced-repetition-scheduler family) —
 * a two-component memory model: each card carries a STABILITY (days for
 * retrievability to fall to 90%) and a DIFFICULTY (1..10). Ratings are
 * 1=Again 2=Hard 3=Good 4=Easy. Weights below are the published FSRS-4.5
 * defaults; they live here as data so they can be tuned without touching
 * the maths.
 *
 * On top sits the thing no competitor ships: DAYS-TO-EXAM as a first-class
 * input. Intervals compress by phase and are HARD-CLAMPED so no card is
 * ever scheduled past the exam.
 */

export const W = [
  0.4872, 1.4003, 3.7145, 13.8206,
  5.1618, 1.2298, 0.8975, 0.031,
  1.6474, 0.1367, 1.0461,
  2.1072, 0.0793, 0.3246, 1.587,
  0.2272, 2.8755,
]

export const TARGET_RETENTION = 0.9
const F = 19 / 81   // FSRS-4.5 power-forgetting-curve constants
const C = -0.5

export const RATINGS = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 }

/** Retrievability after `elapsedDays` at a given stability. */
export function retrievability(elapsedDays, stability) {
  if (stability <= 0) return 0
  return Math.pow(1 + F * (elapsedDays / stability), C)
}

/** The interval (days) that lands retrievability at the target. */
export function intervalFor(stability, targetRetention = TARGET_RETENTION) {
  const ivl = (stability / F) * (Math.pow(targetRetention, 1 / C) - 1)
  return Math.max(1, Math.round(ivl))
}

const clampD = d => Math.min(10, Math.max(1, d))

/** First review of a new card. */
export function initCard(rating) {
  const stability = W[rating - 1]
  const difficulty = clampD(W[4] - Math.exp(W[5] * (rating - 1)) + 1)
  return { stability, difficulty, reps: 1, lapses: rating === RATINGS.AGAIN ? 1 : 0 }
}

/** Subsequent review. elapsedDays = real days since the last review. */
export function reviewCard(card, rating, elapsedDays) {
  const r = retrievability(Math.max(0, elapsedDays), card.stability)
  let difficulty = clampD(
    W[7] * (W[4] - Math.exp(W[5] * 0) + 1) + (1 - W[7]) * (card.difficulty - W[6] * (rating - 3)),
  )

  let stability
  if (rating === RATINGS.AGAIN) {
    stability = Math.min(
      card.stability,
      W[11] * Math.pow(difficulty, -W[12]) * (Math.pow(card.stability + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)),
    )
  } else {
    const hardPenalty = rating === RATINGS.HARD ? W[15] : 1
    const easyBonus = rating === RATINGS.EASY ? W[16] : 1
    stability = card.stability * (
      1 + Math.exp(W[8]) * (11 - difficulty) * Math.pow(card.stability, -W[9]) *
      (Math.exp(W[10] * (1 - r)) - 1) * hardPenalty * easyBonus
    )
  }
  stability = Math.max(0.1, stability)

  return {
    stability,
    difficulty,
    reps: (card.reps || 0) + 1,
    lapses: (card.lapses || 0) + (rating === RATINGS.AGAIN ? 1 : 0),
  }
}

/* ── exam-date compression ────────────────────────────────────────────────── */

export const PHASES = [
  { id: 'FAR', min: 90, factor: 1.0 },
  { id: 'MID', min: 30, factor: 0.6 },
  { id: 'NEAR', min: 7, factor: 0.35 },
  { id: 'FINAL', min: 0, factor: 0.2 },
]

export function phaseFor(daysToExam) {
  if (daysToExam == null || !Number.isFinite(daysToExam)) return 'FAR'
  for (const p of PHASES) if (daysToExam >= p.min) return p.id
  return 'FINAL'
}

/**
 * The full scheduling decision for one card:
 * base FSRS interval → phase compression → the two HARD RULES:
 *   1. never scheduled after the exam (clamped to land at least a day before,
 *      or tomorrow when even that is impossible);
 *   2. deterministic — same inputs, same output.
 */
export function nextInterval(card, { daysToExam = null, targetRetention = TARGET_RETENTION } = {}) {
  const base = intervalFor(card.stability, targetRetention)
  const phase = phaseFor(daysToExam)
  const factor = PHASES.find(p => p.id === phase).factor
  let ivl = Math.max(1, Math.round(base * factor))

  if (daysToExam != null && Number.isFinite(daysToExam)) {
    // hard rule: the card is seen at least once before the paper.
    ivl = Math.min(ivl, Math.max(1, Math.floor(daysToExam) - 1))
    if (daysToExam <= 1) ivl = 1
  }
  return { intervalDays: ivl, phase, baseIntervalDays: base }
}

/**
 * What the phase means for the day's MIX (consumed by Today):
 * how much of the day goes to review vs new coverage, and whether new
 * topics are allowed at all.
 */
export function phasePolicy(daysToExam) {
  const phase = phaseFor(daysToExam)
  switch (phase) {
    case 'FAR': return { phase, newAllowed: true, reviewShare: 0.35, note: 'Far out — coverage beats review. Untouched high-mark chapters first.' }
    case 'MID': return { phase, newAllowed: true, reviewShare: 0.55, note: 'Getting closer — balance new chapters against keeping what you have.' }
    case 'NEAR': return { phase, newAllowed: true, newMarksFloor: 5, reviewShare: 0.75, note: 'Close now — review dominates; only big untouched chapters are worth opening.' }
    default: return { phase: 'FINAL', newAllowed: false, reviewShare: 1, note: 'Final days — nothing new. Pure triage by marks at risk.' }
  }
}
