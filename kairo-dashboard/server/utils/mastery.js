/**
 * Bayesian Knowledge Tracing + SM-2.
 *
 * One mastery number per topic, so a topic can no longer be weak and strong at
 * the same time -- which the current memory store manages for both `vectors`
 * and `periodic table`.
 *
 * No dependency, no cost. About 100 lines of arithmetic.
 */

/**
 * BKT parameters. These are the standard starting values from the literature;
 * they are deliberately not tuned per-topic yet because there is no data to
 * tune them with. Revisit once there are a few thousand real attempts.
 */
export const BKT = {
  /** P(knows it already), before any evidence. */
  pInit:     0.25,
  /** P(learns it on this attempt), if they did not know it. */
  pTransit:  0.15,
  /** P(right answer despite not knowing) -- a 4-option MCQ is 0.25 by luck
   *  alone, so guessing has to be modelled or every quiz inflates mastery. */
  pGuess:    0.25,
  /** P(wrong answer despite knowing) -- careless error, misread question. */
  pSlip:     0.10,
}

/**
 * One graded observation.
 *
 * `weight` lets a timed mock count for more than a flashcard flip without
 * needing separate models: it scales how far the posterior is allowed to move.
 */
export function updateMastery(prior, correct, weight = 1) {
  const p = clamp(prior ?? BKT.pInit, 0.01, 0.99)

  // P(known | evidence)
  const num = correct
    ? p * (1 - BKT.pSlip)
    : p * BKT.pSlip
  const den = correct
    ? p * (1 - BKT.pSlip) + (1 - p) * BKT.pGuess
    : p * BKT.pSlip + (1 - p) * (1 - BKT.pGuess)

  const posterior = den === 0 ? p : num / den

  // Then the chance they learned it during this attempt.
  const withLearning = posterior + (1 - posterior) * BKT.pTransit

  // Blend toward the new belief by weight, so a low-stakes signal nudges and a
  // high-stakes one moves properly.
  const w = clamp(weight, 0.1, 2) / 2
  return clamp(p + (withLearning - p) * (0.5 + w), 0.01, 0.99)
}

/**
 * Time decay. Knowledge is not static, and a mastery score that never falls
 * would mean a topic learned in April still reads as strong in December.
 *
 * Half-life scales with how well it was known: something at 0.9 fades far more
 * slowly than something scraped to 0.5. `daysSince` of 0 returns the input.
 */
export function decayMastery(mastery, daysSince) {
  if (!daysSince || daysSince <= 0) return mastery
  const halfLifeDays = 7 + 30 * clamp(mastery, 0, 1)
  return clamp(mastery * Math.pow(0.5, daysSince / halfLifeDays), 0.01, 0.99)
}

/** Weak / OK / strong from one number, so the bands live in one place. */
export function band(mastery) {
  if (mastery < 0.45) return 'weak'
  if (mastery > 0.70) return 'strong'
  return 'developing'
}

/**
 * SM-2. `quality` is 0–5 as in the original algorithm; 3 is the pass mark.
 * Returns the next interval and due date.
 *
 * The current app shows "Trigonometry forgetting in 0h" for everything, which
 * is a placeholder rather than a computation. This is the computation.
 */
export function sm2(card, quality) {
  const q = clamp(Math.round(quality), 0, 5)
  let { ease = 2.5, interval = 0, reps = 0, lapses = 0 } = card || {}

  if (q < 3) {
    // Failed. Back to the start of the ladder, but the ease penalty persists,
    // so a repeatedly-lapsed card keeps coming back sooner than a fresh one.
    reps = 0
    interval = 1
    lapses += 1
    ease = Math.max(1.3, ease - 0.20)
  } else {
    reps += 1
    if (reps === 1)      interval = 1
    else if (reps === 2) interval = 6
    else                 interval = Math.round(interval * ease)
    ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
  }

  return {
    ease: round2(ease),
    interval,
    reps,
    lapses,
    dueAt: addDays(new Date(), interval).toISOString(),
  }
}

/** Signal type -> how much it should move the needle. */
export const SIGNAL_WEIGHT = {
  mock_question:   2.0,
  quiz_answer:     1.5,
  mistake:         1.5,
  practice:        1.0,
  flashcard:       0.8,
  // Asking for the answer is evidence of not knowing, but weak evidence --
  // students also tap it when they are simply in a hurry.
  show_answer:     0.6,
  doubt:           0.4,
}

export function weightFor(type) {
  return SIGNAL_WEIGHT[type] ?? 1.0
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const round2 = (n) => Math.round(n * 100) / 100
const addDays = (d, n) => new Date(d.getTime() + n * 86400000)

export function daysBetween(iso, now = new Date()) {
  if (!iso) return 0
  return Math.max(0, (now.getTime() - new Date(iso).getTime()) / 86400000)
}
