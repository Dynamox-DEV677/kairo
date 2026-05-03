/**
 * SM-2 Spaced Repetition Algorithm
 * ──────────────────────────────────
 * Based on SuperMemo SM-2 algorithm.
 *
 * Quality ratings:
 *  0 — complete blackout / wrong
 *  1 — wrong, but remembered after seeing answer
 *  2 — wrong, but easy to recall on seeing answer
 *  3 — correct with significant difficulty
 *  4 — correct with some hesitation
 *  5 — perfect response
 */

/**
 * Calculate next review date and updated card state.
 *
 * @param {object} card
 * @param {number} card.easiness    - E-Factor, starts at 2.5
 * @param {number} card.interval    - days until next review
 * @param {number} card.repetitions - consecutive correct reviews
 * @param {number} quality          - 0–5 rating from user
 * @returns {{ easiness, interval, repetitions, nextReview: string }}
 */
export function sm2(card, quality) {
  let { easiness = 2.5, interval = 1, repetitions = 0 } = card

  if (quality >= 3) {
    // Correct response
    if (repetitions === 0)      interval = 1
    else if (repetitions === 1) interval = 6
    else                        interval = Math.round(interval * easiness)

    repetitions += 1
  } else {
    // Wrong — reset streak
    repetitions = 0
    interval = 1
  }

  // Update E-Factor (clamp to [1.3, ∞])
  easiness = Math.max(1.3, easiness + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))

  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + interval)

  return {
    easiness: Math.round(easiness * 100) / 100,
    interval,
    repetitions,
    nextReview: nextReview.toISOString().slice(0, 10),
  }
}

/**
 * Get cards due for review today or earlier.
 */
export function getDueCards(cards) {
  const today = new Date().toISOString().slice(0, 10)
  return cards.filter(c => !c.nextReview || c.nextReview <= today)
}

/**
 * Initial state for a brand-new flashcard.
 */
export function freshCardState() {
  return {
    easiness: 2.5,
    interval: 0,
    repetitions: 0,
    nextReview: new Date().toISOString().slice(0, 10), // due immediately
  }
}
