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
export function selectPrediction(events, outOf = 100) {
  const scored = (events || [])
    .filter(e => typeof e?.score === 'number' && typeof e?.ts === 'number')
    .sort((a, b) => a.ts - b.ts)

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
