/**
 * Focus Lock — the self-control tool. Pure accounting for focus sessions:
 * only genuinely-focused time counts (the page visible and the timer running),
 * drifts pause the clock rather than shaming the student, and the streak is
 * computed from real session history.
 *
 * A session is segments: [{ start, end }] — a segment opens when the timer
 * runs and closes on pause/drift/finish. Focused time is the sum of segments,
 * so minutes spent drifted in another tab can never count.
 */

export const MIN_STREAK_SESSION_MS = 10 * 60 * 1000 // a day needs 10+ focused minutes to count
export const HISTORY_CAP = 200

/** Sum of closed segments plus the open one (if any), clamped to sane values. */
export function sessionFocusedMs(segments, now = 0) {
  let total = 0
  for (const s of segments || []) {
    if (!s || typeof s.start !== 'number') continue
    const end = typeof s.end === 'number' ? s.end : now
    if (end > s.start) total += end - s.start
  }
  return total
}

/** Parse persisted history; junk in → empty out. Newest last. */
export function parseHistory(raw) {
  try {
    const h = JSON.parse(raw)
    if (!Array.isArray(h)) return []
    return h.filter(r => r && typeof r.ts === 'number' && typeof r.focusedMs === 'number' && r.focusedMs >= 0)
  } catch { return [] }
}

/** Append a finished session, capped so localStorage never bloats. */
export function appendSession(history, record) {
  const next = [...(history || []), record]
  return next.length > HISTORY_CAP ? next.slice(next.length - HISTORY_CAP) : next
}

const DAY = 86_400_000

/** Local calendar day key. Local on purpose — a student's "day" is their day. */
export function dayKey(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/**
 * Consecutive days (ending today or yesterday) with at least one
 * MIN_STREAK_SESSION_MS session. Yesterday-anchored so the streak doesn't
 * read 0 at 7am before today's session has happened.
 */
export function focusStreakDays(history, now) {
  const days = new Set(
    (history || [])
      .filter(r => r.focusedMs >= MIN_STREAK_SESSION_MS)
      .map(r => dayKey(r.ts)),
  )
  if (!days.size) return 0
  let anchor = now
  if (!days.has(dayKey(anchor))) {
    anchor -= DAY
    if (!days.has(dayKey(anchor))) return 0
  }
  let streak = 0
  while (days.has(dayKey(anchor))) { streak++; anchor -= DAY }
  return streak
}

/** Total focused minutes in the last 7 days. */
export function weekMinutes(history, now) {
  const ms = (history || [])
    .filter(r => now - r.ts <= 7 * DAY)
    .reduce((a, r) => a + r.focusedMs, 0)
  return Math.round(ms / 60000)
}

/**
 * The end-of-session line. Compares this session against the last 7 days of
 * history (EXCLUDING itself) so "your longest this week" is earned, not
 * assumed — and celebrates without inflating.
 */
export function sessionHeadline(record, history, now) {
  const mins = Math.round(record.focusedMs / 60000)
  if (mins < 1) return 'Under a minute focused — the next one will be longer.'
  const label = `${mins} focused minute${mins === 1 ? '' : 's'}`
  const prior = (history || []).filter(r => r !== record && now - r.ts <= 7 * DAY)
  if (!prior.length) return `${label} — first session this week.`
  const best = Math.max(...prior.map(r => r.focusedMs))
  if (record.focusedMs > best) return `${label} — your longest this week.`
  if (record.drifts === 0) return `${label}, zero drifts. Clean.`
  return `${label} banked.`
}
