/**
 * The one place XP, streak, level, mastery and prediction are computed.
 *
 * Before this there were three answers to "what is my streak": a counter in
 * kairo:game:v1, computeStreak() over the event log in twin.ts, and a number
 * the student could type into a profile field. Home showed one, the Kyno tab
 * showed another, and both were sometimes wrong.
 *
 * Pure functions over plain data, deliberately: they take events and state
 * rather than reading storage, so the tests exercise the real implementation
 * instead of a transpiled copy of it.
 */

const DAY = 86_400_000

const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime() }

/**
 * Consecutive days with at least one activity event, counting back from today.
 *
 * Today not having activity *yet* does not break the streak — it is only
 * broken by a fully empty day that has already passed. Anything else punishes
 * a student at 9am for not having studied at 9am.
 *
 * Scans the whole history. twin.ts computed this over a 60-day window, so a
 * streak longer than 60 days silently truncated to 60.
 */
export function selectStreak(events, now = Date.now()) {
  if (!events || !events.length) return 0

  const days = new Set()
  for (const e of events) if (e && typeof e.ts === 'number') days.add(startOfDay(e.ts))
  if (!days.size) return 0

  const today = startOfDay(now)
  let streak = 0
  for (let i = 0; ; i++) {
    const target = today - i * DAY
    if (days.has(target)) { streak++; continue }
    if (i === 0) continue            // today is still in progress
    break
  }
  return streak
}

/** ISO-ish week key (Monday-based) for a timestamp. Used to ration freezes. */
function weekKey(ms) {
  const d = new Date(startOfDay(ms))
  const dow = (d.getDay() + 6) % 7          // Monday = 0
  d.setDate(d.getDate() - dow)
  return startOfDay(d.getTime())
}

export const FREEZES_PER_WEEK = 1

/**
 * Streak with the grace mechanic.
 *
 * One missed day per week is forgiven instead of resetting to zero. A student
 * who studies six days a week for a month has built a habit; telling them they
 * are on "day 0" because of one bad Tuesday is both false and the exact moment
 * they stop opening the app.
 *
 * The freezes are DERIVED, not stored. A freeze is spent by walking backwards
 * and forgiving the first gap in each week, computed from the same event log
 * as the streak itself. That means no extra state to persist, nothing to drift
 * between devices, and no way for the count to disagree with the history —
 * a stored freeze counter would be a second source of truth for the same fact.
 *
 * Returns the streak, which days were forgiven, and how many freezes remain in
 * the CURRENT week so the UI can show it.
 */
export function selectStreakDetail(events, now = Date.now()) {
  const empty = { streak: 0, frozenDays: [], freezesLeftThisWeek: FREEZES_PER_WEEK, usedFreeze: false }
  if (!events || !events.length) return empty

  const days = new Set()
  for (const e of events) if (e && typeof e.ts === 'number') days.add(startOfDay(e.ts))
  if (!days.size) return empty

  const today = startOfDay(now)
  const usedByWeek = new Map()
  const frozenDays = []
  let streak = 0

  for (let i = 0; ; i++) {
    const target = today - i * DAY
    if (days.has(target)) { streak++; continue }

    // Today not being done YET is not a miss — the day is still running.
    if (i === 0) continue

    const wk = weekKey(target)
    const used = usedByWeek.get(wk) || 0
    if (used < FREEZES_PER_WEEK) {
      usedByWeek.set(wk, used + 1)
      frozenDays.push(target)
      continue                                  // forgiven, streak survives
    }
    break                                       // second miss in a week ends it
  }

  // A trailing freeze is a gap the streak never actually reached past, so it
  // should not be reported as "spent" on the student's behalf.
  while (frozenDays.length && frozenDays[frozenDays.length - 1] < today - streak * DAY) {
    frozenDays.pop()
  }

  const thisWeek = weekKey(today)
  const spentThisWeek = frozenDays.filter(d => weekKey(d) === thisWeek).length

  return {
    streak,
    frozenDays,
    freezesLeftThisWeek: Math.max(0, FREEZES_PER_WEEK - spentThisWeek),
    usedFreeze: spentThisWeek > 0,
  }
}

/** XP is a genuine accumulator, so it comes from game state — but only from
 *  here, so no screen adds its own bonus on top. */
export function selectXP(game) {
  const g = game || {}
  return {
    total: Math.max(0, Number(g.totalXP) || 0),
    today: Math.max(0, Number(g.todayXP) || 0),
    week:  Math.max(0, Number(g.weekXP) || 0),
  }
}

/** Level thresholds live here alone. Duplicating this arithmetic is how one
 *  screen shows level 3 while another shows level 4 on the same XP. */
export function selectLevel(totalXP) {
  let level = 1, need = 100, rest = Math.max(0, Number(totalXP) || 0)
  while (rest >= need) { rest -= need; level++; need = level * 100 }
  return { level, into: rest, need, pct: need ? Math.round((rest / need) * 100) : 0 }
}

export const MASTERY_BAR = 0.7

export function selectMastered(mastery) {
  return (mastery || []).filter(m => Number(m?.mastery) >= MASTERY_BAR).length
}

/**
 * Retention: how much of what they got right is still holding.
 *
 * Returns null rather than 0 when nothing has been scored. The live app shows
 * "Retention 0%" to students who have answered correctly, which reads as
 * "you have forgotten everything" when it means "we have no data".
 */
export function selectRetention(mastery) {
  const rows = (mastery || []).filter(m => Number(m?.attempts) > 0)
  if (!rows.length) return null
  const sum = rows.reduce((s, m) => s + (Number(m.mastery) || 0), 0)
  return Math.round((sum / rows.length) * 100)
}

/** Below this there is not enough evidence to name a number. */
export const PREDICTION_MIN_SCORED = 20

/**
 * Predicted exam score.
 *
 * Deterministic for a given event set: events are sorted by timestamp before
 * slicing. The old version sliced an unsorted array, so a plain reload could
 * pick a different 20 events and the prediction jumped 250 -> 180 with no new
 * activity — which teaches a student their score is arbitrary.
 *
 * Returns a range, never a bare number, and returns null with a reason below
 * the evidence bar rather than inventing confidence.
 */
/**
 * Only these event types are PERFORMANCE evidence. The demo-metrics bug
 * (audit task 2) traced here: 'mistake' records carry score:0 as bookkeeping,
 * and counting them dragged both the trend (to a flat −100%) and the
 * prediction band down for any student who logged mistakes — while their
 * actual quiz scores were fine.
 */
export const ASSESSMENT_TYPES = new Set(['quiz_answered', 'quiz_completed', 'essay_graded'])

export function assessmentScores(events) {
  return (events || [])
    .filter(e => e && ASSESSMENT_TYPES.has(e.type) && typeof e.score === 'number' && typeof e.ts === 'number')
    .sort((a, b) => a.ts - b.ts)
}

function slope(ys) {
  if (ys.length < 2) return 0
  const n = ys.length
  const sx = (n - 1) * n / 2
  const sy = ys.reduce((a, b) => a + b, 0)
  const sxy = ys.reduce((acc, y, i) => acc + i * y, 0)
  const sxx = ys.reduce((acc, _, i) => acc + i * i, 0)
  const denom = n * sxx - sx * sx
  return denom === 0 ? 0 : (n * sxy - sx * sy) / denom
}

/**
 * Direction of travel over real assessments, −1..1. Fewer than 4 scored
 * assessments is a coin toss, so it reports 0 rather than guessing.
 */
export function selectPerformanceTrend(events) {
  const scored = assessmentScores(events).map(e => e.score)
  if (scored.length < 4) return 0
  const s = slope(scored)
  const mag = Math.min(1, Math.abs(s) / 3)
  return s >= 0 ? mag : -mag
}

export function selectPrediction(events, outOf = 100) {
  const scored = assessmentScores(events)

  if (scored.length < PREDICTION_MIN_SCORED) {
    return {
      ready: false,
      need: PREDICTION_MIN_SCORED - scored.length,
      reason: `Answer ${PREDICTION_MIN_SCORED - scored.length} more questions and we can estimate this.`,
    }
  }

  const recent = scored.slice(-PREDICTION_MIN_SCORED)
  const mean = recent.reduce((s, e) => s + e.score, 0) / recent.length

  // Spread of the sample sets the band. A student whose scores swing 40 points
  // deserves a wider range than one holding steady, and saying so is honest.
  const variance = recent.reduce((s, e) => s + (e.score - mean) ** 2, 0) / recent.length
  const sd = Math.sqrt(variance)
  const halfBand = Math.max(3, Math.min(15, sd))

  const pct = (v) => Math.max(0, Math.min(100, v))
  return {
    ready: true,
    low:   Math.round(pct(mean - halfBand) / 100 * outOf),
    high:  Math.round(pct(mean + halfBand) / 100 * outOf),
    mid:   Math.round(pct(mean) / 100 * outOf),
    outOf,
    basedOn: recent.length,
  }
}

/**
 * Weak topics, ranked worst first.
 *
 * There were two answers to "what am I weak at": this list, derived from
 * mastery, and a comma-separated text field the student typed into their
 * profile. The typed one fed the AI prompt, so a student who never filled it in
 * got generic advice while the app already knew their real weak spots.
 *
 * `minAttempts` guards against calling a topic weak after one unlucky answer.
 */
export function selectWeakTopics(mastery, { max = 6, minAttempts = 2 } = {}) {
  return (mastery || [])
    .filter(m => Number(m?.attempts) >= minAttempts && Number(m?.mastery) < 0.45)
    .sort((a, b) => (a.mastery || 0) - (b.mastery || 0))
    .slice(0, max)
    .map(m => ({
      topicId: m.topicId || m.topic || null,
      topic: m.topic,
      subject: m.subject,
      mastery: Math.round((Number(m.mastery) || 0) * 100) / 100,
      attempts: Number(m.attempts) || 0,
      // Severity is what the UI sorts and colours by. Deriving it from mastery
      // keeps it from becoming a third independent number.
      severity: Math.round((1 - (Number(m.mastery) || 0)) * 100) / 100,
      lastStudiedAt: m.lastStudiedAt ?? null,
    }))
}

export function selectStrongTopics(mastery, { max = 5, minAttempts = 3 } = {}) {
  return (mastery || [])
    .filter(m => Number(m?.attempts) >= minAttempts && Number(m?.mastery) >= MASTERY_BAR)
    .sort((a, b) => (b.mastery || 0) - (a.mastery || 0))
    .slice(0, max)
    .map(m => ({
      topicId: m.topicId || m.topic || null,
      topic: m.topic,
      subject: m.subject,
      mastery: Math.round((Number(m.mastery) || 0) * 100) / 100,
      attempts: Number(m.attempts) || 0,
      // Zero by definition — a strong topic has no severity. Kept on the shape
      // so weak and strong lists stay interchangeable for the UI.
      severity: 0,
      lastStudiedAt: m.lastStudiedAt ?? null,
    }))
}
