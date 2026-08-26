/**
 * Today (brief part D-2) — the scheduler's output for one day, already
 * ordered, capped to what the student can actually finish.
 *
 * The MIX is decided by the exam phase, not by taste:
 *   FAR    coverage-led (reviewShare .35)
 *   MID    balanced (.55)
 *   NEAR   review-led, new only above a marks floor (.75)
 *   FINAL  review only, no new topics ever (1.0)
 *
 * Pure: same aggregates in, same plan out. No React, no I/O, no clock of
 * its own — `now` and `dailyMinutes` are inputs.
 */

import { phasePolicy } from './fsrs.core.js'

/** Rough minutes each kind of item costs, so the day is capped honestly. */
export const COST_MINUTES = { review: 12, coverage: 35, repair: 15 }

/** Default when the student hasn't told us their capacity. */
export const DEFAULT_DAILY_MINUTES = 90

/**
 * @param dueCards  [{ id, front, subject, topic, dueAt }] — already due
 * @param ranked    rankNodes() output (coverage/retention candidates)
 * @param fading    chapters whose state is FADING (repair candidates)
 */
export function todayPlan({
  dueCards = [],
  ranked = [],
  fading = [],
  daysToExam = null,
  dailyMinutes = DEFAULT_DAILY_MINUTES,
  now = 0,
} = {}) {
  const policy = phasePolicy(daysToExam)
  const budget = Math.max(15, dailyMinutes)

  const reviewBudget = Math.round(budget * policy.reviewShare)
  const coverageBudget = budget - reviewBudget

  const items = []
  let usedReview = 0
  let usedCoverage = 0

  // 1. Repair first when something SOLID is slipping — cheapest marks in the
  //    product, and the reason is the most motivating thing we can say.
  for (const f of fading) {
    if (usedReview + COST_MINUTES.repair > reviewBudget) break
    items.push({
      kind: 'repair',
      id: f.id,
      title: `Bring back ${f.name}`,
      why: 'You were solid on this — it is fading now. A short pass is the cheapest win on the board.',
      minutes: COST_MINUTES.repair,
      to: 'reels',
    })
    usedReview += COST_MINUTES.repair
  }

  // 2. Due cards — the SRS debt, batched so one item is one sitting.
  if (dueCards.length && usedReview + COST_MINUTES.review <= reviewBudget) {
    const batch = Math.min(dueCards.length, Math.max(5, Math.floor((reviewBudget - usedReview) / COST_MINUTES.review) * 8))
    items.push({
      kind: 'review',
      id: 'due-cards',
      title: `Flip ${batch} due card${batch === 1 ? '' : 's'}`,
      why: daysToExam != null && daysToExam <= 30
        ? `${dueCards.length} card${dueCards.length === 1 ? '' : 's'} are due and the exam is ${Math.floor(daysToExam)} day${Math.floor(daysToExam) === 1 ? '' : 's'} out — these are marks you already earned.`
        : 'Timed to just before you would forget them — five minutes now saves relearning later.',
      minutes: COST_MINUTES.review,
      count: batch,
      to: 'reels',
    })
    usedReview += COST_MINUTES.review
  }

  // 3. Coverage — only when the phase allows new work, and in NEAR only for
  //    chapters worth opening.
  //
  //    A full first pass is COST_MINUTES.coverage, but a review-heavy phase
  //    leaves less than that: rather than silently dropping coverage
  //    altogether (which made NEAR indistinguishable from FINAL and hid a
  //    9-mark untouched chapter 20 days before the paper), the FIRST
  //    coverage item may take a shortened session down to HALF a pass. Below
  //    that there is genuinely no room and coverage waits for tomorrow.
  if (policy.newAllowed) {
    for (const row of ranked) {
      const marks = row.node?.typical_marks ?? 0
      if (policy.newMarksFloor && marks < policy.newMarksFloor) continue
      if (items.some(i => i.id === row.node.id)) continue

      const left = coverageBudget - usedCoverage
      const isFirst = usedCoverage === 0
      const minutes = left >= COST_MINUTES.coverage
        ? COST_MINUTES.coverage
        : (isFirst && left >= COST_MINUTES.coverage / 2 ? left : 0)
      if (!minutes) break

      items.push({
        kind: 'coverage',
        id: row.node.id,
        title: row.state === 'UNTOUCHED' ? `Open ${row.node.name}` : `Push on ${row.node.name}`,
        why: withDays(row.reason, daysToExam),
        minutes,
        partial: minutes < COST_MINUTES.coverage,
        marks: Math.round(marks),
        to: 'exam-planner',
      })
      usedCoverage += minutes
    }
  }

  return {
    phase: policy.phase,
    daysToExam: daysToExam == null ? null : Math.floor(daysToExam),
    note: policy.note,
    items,
    plannedMinutes: items.reduce((s, i) => s + i.minutes, 0),
    budgetMinutes: budget,
  }
}

/** "worth 8 marks, never opened" → "…, 34 days left" (the brief's example). */
function withDays(reason, daysToExam) {
  if (daysToExam == null || !Number.isFinite(daysToExam)) return reason
  const d = Math.floor(daysToExam)
  return `${reason.replace(/\.$/, '')}, ${d} day${d === 1 ? '' : 's'} left.`
}
