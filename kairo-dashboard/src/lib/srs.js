/**
 * Spaced repetition for the local twin.
 *
 * Replaces an exponential-decay "strength" that started at 1.0 and produced a
 * ~12 hour horizon for every topic. Anything studied longer ago than that had
 * forgetAt in the past, and the UI clamped negatives to zero — which is why
 * every single item read "forgetting in 0h", including ones answered
 * correctly minutes earlier.
 *
 * SM-2. Same algorithm as server/utils/mastery.js; srs.test.js asserts the two
 * stay identical, because a device scheduling a card for Tuesday while the
 * server says Friday is worse than either answer alone.
 */

const DAY_MS = 86_400_000
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const round2 = (n) => Math.round(n * 100) / 100

/**
 * One review. `quality` is 0–5 as in the original algorithm; 3 is the pass mark.
 * Returns the next interval in DAYS and the timestamp it falls due.
 */
export function sm2(card, quality, now = Date.now()) {
  const q = clamp(Math.round(quality), 0, 5)
  let { ease = 2.5, interval = 0, reps = 0, lapses = 0 } = card || {}

  if (q < 3) {
    // Failed. Back to the start of the ladder, but the ease penalty persists,
    // so a topic lapsed repeatedly keeps returning sooner than a fresh one.
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
    dueAt: now + interval * DAY_MS,
  }
}

/** Correctness and confidence -> an SM-2 quality score. */
export function qualityFrom(correct, difficulty = 0.5) {
  if (!correct) return difficulty > 0.7 ? 2 : 1
  // A correct answer on a hard question is stronger evidence than an easy one.
  return difficulty > 0.7 ? 5 : difficulty > 0.4 ? 4 : 3
}

/**
 * How a due item should be described.
 *
 * `overdue` is the case the old code erased. A topic three days past due is not
 * "forgetting in 0h" — it is already slipping, and the student needs to be told
 * that plainly rather than shown a zero.
 */
export function dueState(dueAt, now = Date.now()) {
  if (!dueAt) return { state: 'unscheduled', hours: null, label: 'Not scheduled yet' }

  const hours = (dueAt - now) / 3600_000
  if (hours < -24) {
    const days = Math.round(-hours / 24)
    return { state: 'overdue', hours, label: `${days} day${days === 1 ? '' : 's'} overdue` }
  }
  if (hours < 0)  return { state: 'overdue', hours, label: 'Due now' }
  if (hours < 1)  return { state: 'due',     hours, label: 'Due within the hour' }
  if (hours < 24) return { state: 'due',     hours, label: `Due in ${Math.round(hours)}h` }

  const days = Math.round(hours / 24)
  return { state: 'scheduled', hours, label: `Due in ${days} day${days === 1 ? '' : 's'}` }
}

/**
 * Revise Soon: only what is genuinely due inside the window, worst first.
 *
 * The old list filtered on "due within 7 days", which with a 12-hour horizon
 * meant everything qualified — so the panel showed the entire syllabus and told
 * the student all of it was slipping at once.
 */
export function revisionQueue(rows, { now = Date.now(), withinHours = 48, max = 5 } = {}) {
  return (rows || [])
    .filter(r => r?.dueAt || r?.forgetAt)
    .map(r => ({ row: r, due: r.dueAt ?? r.forgetAt }))
    .filter(({ due }) => (due - now) / 3600_000 < withinHours)
    .sort((a, b) => a.due - b.due)
    .slice(0, max)
    .map(({ row, due }) => ({
      topic: row.topic,
      subject: row.subject,
      mastery: row.mastery,
      dueAt: due,
      ...dueState(due, now),
    }))
}
