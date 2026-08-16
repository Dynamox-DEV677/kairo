/**
 * C13 — re-fitting an exam plan when days were missed.
 *
 * Deterministic, no AI: the plan's blocks and the student's own check-ins are
 * the whole input. Missed blocks (past days, never checked off) are carried
 * into the remaining days, most important type first, capped per day so the
 * catch-up does not itself become an impossible day — the failure mode of
 * every paper study plan.
 *
 * If everything cannot fit before the exam, the overflow is SAID, with a
 * triage order — never silently dropped, never squeezed into fantasy days.
 */

/** What to rescue first when time is short. Rest never carries over. */
export const TYPE_PRIORITY = ['concept', 'practice', 'mock', 'PYQ', 'revision']

/** At most this many carried blocks are added to any single remaining day. */
export const MAX_CARRY_PER_DAY = 2

export function blockKey(week, day, idx) { return `${week}-${day}-${idx}` }

/** Flatten a weeklySchedule into absolute day slots, in plan order. */
export function flattenDays(weeklySchedule) {
  const out = []
  let dayIndex = 0
  for (const wk of weeklySchedule || []) {
    for (const d of wk.days || []) {
      out.push({ week: wk.week, day: d.day, dayIndex, blocks: d.blocks || [] })
      dayIndex++
    }
  }
  return out
}

/** Day index of "today" inside the plan, from when the plan was created. */
export function planDayIndex(createdAtMs, nowMs) {
  if (!Number.isFinite(createdAtMs) || !Number.isFinite(nowMs)) return 0
  return Math.max(0, Math.floor((nowMs - createdAtMs) / 86_400_000))
}

/**
 * What has been missed so far: blocks on days already behind us that were
 * never checked off. Rest blocks don't count — you cannot "owe" rest.
 */
export function missedBlocks(plan, completion, todayIdx) {
  const days = flattenDays(plan?.weeklySchedule)
  const missed = []
  for (const d of days) {
    if (d.dayIndex >= todayIdx) break
    d.blocks.forEach((b, i) => {
      if (b?.type === 'rest') return
      if (!completion?.[blockKey(d.week, d.day, i)]) {
        missed.push({ ...b, from: { week: d.week, day: d.day, idx: i } })
      }
    })
  }
  return missed
}

/**
 * Re-fit: carry missed blocks into the remaining days.
 *
 * Returns { plan, moved, overflow, changed } where `plan` is a NEW object with
 * carried blocks appended to future days (marked carried:true so the UI can
 * show where they came from), and `overflow` is whatever genuinely no longer
 * fits, in triage order.
 */
export function readjustPlan(plan, completion, todayIdx) {
  const missed = missedBlocks(plan, completion, todayIdx)
  if (!missed.length) return { plan, moved: 0, overflow: [], changed: false }

  // Most important first, so if anything overflows it is the least critical.
  const queue = [...missed].sort(
    (a, b) => TYPE_PRIORITY.indexOf(a.type) - TYPE_PRIORITY.indexOf(b.type),
  )

  const days = flattenDays(plan.weeklySchedule)
  const future = days.filter(d => d.dayIndex >= todayIdx)
  const capacity = new Map(future.map(d => [d.dayIndex, MAX_CARRY_PER_DAY]))
  const placements = new Map() // dayIndex -> blocks to append

  const overflow = []
  for (const b of queue) {
    const slot = future.find(d => (capacity.get(d.dayIndex) || 0) > 0 && !d.blocks.some(x => x?.type === 'rest' && d.blocks.length === 1))
    if (!slot) { overflow.push(b); continue }
    capacity.set(slot.dayIndex, capacity.get(slot.dayIndex) - 1)
    if (!placements.has(slot.dayIndex)) placements.set(slot.dayIndex, [])
    placements.get(slot.dayIndex).push({ ...b, carried: true })
  }

  // Rebuild the schedule immutably with the placements appended.
  let dayIndex = 0
  const weeklySchedule = (plan.weeklySchedule || []).map(wk => ({
    ...wk,
    days: (wk.days || []).map(d => {
      const extra = placements.get(dayIndex) || []
      dayIndex++
      return extra.length ? { ...d, blocks: [...(d.blocks || []), ...extra] } : d
    }),
  }))

  return {
    plan: { ...plan, weeklySchedule },
    moved: missed.length - overflow.length,
    overflow,
    changed: missed.length - overflow.length > 0,
  }
}
