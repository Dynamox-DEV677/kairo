import { supabaseAdmin } from '../supabase.js'
import { retentionFor } from './mastery.js'

const LOOKBACK_DAYS = 60

function clamp01(x)    { return Math.max(0, Math.min(1, x)) }
function safeDiv(a, b) { return b === 0 ? 0 : a / b }
function avg(arr)      { return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length }

function slope(ys) {
  if (ys.length < 2) return 0
  const n  = ys.length
  const sx = (n - 1) * n / 2
  const sy = ys.reduce((a, b) => a + b, 0)
  const sxy = ys.reduce((acc, y, i) => acc + i * y, 0)
  const sxx = ys.reduce((acc, _, i) => acc + i * i, 0)
  const denom = n * sxx - sx * sx
  if (denom === 0) return 0
  return (n * sxy - sx * sy) / denom
}

function computeLearningStyle(events) {
  const buckets = { visual: 0, text: 0, interactive: 0, repetition: 0 }
  for (const e of events) {
    const mod = e.modality
    if (!mod || !(mod in buckets)) continue
    const weight = 1 + Math.log1p((e.duration_ms || 5000) / 60_000)
    buckets[mod] += weight
  }
  const total = Object.values(buckets).reduce((a, b) => a + b, 0) || 1
  return {
    visual:      +(buckets.visual      / total).toFixed(3),
    text:        +(buckets.text        / total).toFixed(3),
    interactive: +(buckets.interactive / total).toFixed(3),
    repetition:  +(buckets.repetition  / total).toFixed(3),
  }
}

function computePace(events) {
  if (events.length < 5) return 'steady'

  const now    = Date.now()
  const dayMs  = 24 * 3600 * 1000
  const counts = new Array(14).fill(0)
  for (const e of events) {
    const dayIdx = Math.floor((now - new Date(e.created_at).getTime()) / dayMs)
    if (dayIdx >= 0 && dayIdx < 14) counts[dayIdx] += 1
  }
  const mean    = avg(counts)
  const variance = avg(counts.map(c => (c - mean) ** 2))
  const stddev  = Math.sqrt(variance)

  if (mean > 8 && stddev < mean * 0.6) return 'fast'
  if (stddev > mean * 1.2)              return 'inconsistent'
  if (mean < 2)                          return 'slow'
  return 'steady'
}

function computeFocusPattern(events, sessions) {
  const hourScore = {}
  for (const e of events) {
    if (e.score == null) continue
    const h = new Date(e.created_at).getHours()
    if (!hourScore[h]) hourScore[h] = []
    hourScore[h].push(e.score)
  }
  let bestHour = null, bestAvg = -1
  for (const [h, scores] of Object.entries(hourScore)) {
    if (scores.length < 3) continue
    const a = avg(scores)
    if (a > bestAvg) { bestAvg = a; bestHour = Number(h) }
  }

  const validSessions = (sessions || []).filter(s => s.duration_min != null)
  const avgMin = validSessions.length ? avg(validSessions.map(s => s.duration_min)) : null

  const lowFocus = validSessions.filter(s => s.focus_score != null && s.focus_score < 0.4)
  const dropoff  = lowFocus.length ? avg(lowFocus.map(s => s.duration_min)) : null

  return {
    focus_best_hour:     bestHour,
    focus_avg_minutes:   avgMin   != null ? +avgMin.toFixed(1)   : null,
    focus_dropoff_after: dropoff  != null ? +dropoff.toFixed(1)  : null,
  }
}

function computeRetention(masteryRows) {
  if (!masteryRows.length) return 0.5
  let num = 0, denom = 0
  const now = new Date()
  for (const m of masteryRows) {
    const r = retentionFor(m, now)
    const w = 0.2 + 0.8 * m.mastery
    num   += r * w
    denom += w
  }
  return clamp01(safeDiv(num, denom))
}

function computeConsistency(events) {
  if (!events.length) return 0
  const now = Date.now()
  const dayMs = 24 * 3600 * 1000
  const days = new Set()
  for (const e of events) {
    const dayIdx = Math.floor((now - new Date(e.created_at).getTime()) / dayMs)
    if (dayIdx >= 0 && dayIdx < 14) days.add(dayIdx)
  }
  return days.size / 14
}

function computeBurnoutRisk(sessions, perfTrend) {
  const last7  = sessions.filter(s => Date.now() - new Date(s.started_at).getTime() < 7  * 86_400_000)
  const last30 = sessions.filter(s => Date.now() - new Date(s.started_at).getTime() < 30 * 86_400_000)
  if (last30.length < 4) return 0

  const recentMin = last7.reduce((a, s) => a + (s.duration_min || 0), 0) / 7
  const baseMin   = last30.reduce((a, s) => a + (s.duration_min || 0), 0) / 30

  const overload = recentMin > baseMin * 1.4 ? (recentMin / baseMin - 1) : 0
  const stagnation = perfTrend < 0 ? -perfTrend : 0
  return clamp01(0.6 * overload + 0.4 * stagnation)
}

function computePerformanceTrend(events) {
  const scored = events
    .filter(e => typeof e.score === 'number')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(e => e.score)
  if (scored.length < 4) return 0
  const s = slope(scored)
  return clamp01(s / 3) * (s >= 0 ? 1 : -1)
}

function computeConfidence(masteryRows, events) {
  if (!masteryRows.length && !events.length) return 0.5
  const masteredTopics = masteryRows.filter(m => m.mastery >= 0.7).length
  const masteryFactor  = clamp01(masteredTopics / 10)
  const recentCorrect  = events.filter(e => typeof e.correct === 'boolean')
  const accFactor      = recentCorrect.length
    ? recentCorrect.filter(e => e.correct).length / recentCorrect.length
    : 0.5
  return clamp01(0.45 * masteryFactor + 0.55 * accFactor)
}

function topTopics(masteryRows, { weak = true, max = 6 }) {
  const sorted = [...masteryRows].sort((a, b) =>
    weak ? a.mastery - b.mastery : b.mastery - a.mastery
  )
  return sorted.slice(0, max).map(m => ({
    subject:       m.subject,
    topic:         m.topic,
    mastery:       m.mastery,
    attempts:      m.attempts,
    last_studied:  m.last_studied_at,
    severity:      weak ? +(1 - m.mastery).toFixed(2) : null,
  }))
}

function forgettingSoon(masteryRows, max = 6) {
  const now = new Date()
  return [...masteryRows]
    .filter(m => m.forget_at && new Date(m.forget_at) < new Date(now.getTime() + 7 * 86_400_000))
    .sort((a, b) => new Date(a.forget_at) - new Date(b.forget_at))
    .slice(0, max)
    .map(m => ({
      subject: m.subject,
      topic:   m.topic,
      hours_until_forget: Math.max(0, +(
        (new Date(m.forget_at) - now) / 3600_000
      ).toFixed(1)),
      mastery: m.mastery,
    }))
}

function computeStreak(events) {
  if (!events.length) return 0
  const dayMs = 86_400_000
  const today = new Date(); today.setHours(0,0,0,0)
  const dayKey = (d) => {
    const x = new Date(d); x.setHours(0,0,0,0); return x.getTime()
  }
  const days = new Set(events.map(e => dayKey(e.created_at)))
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const target = today.getTime() - i * dayMs
    if (days.has(target)) streak++
    else if (i > 0) break
  }
  return streak
}

export async function recomputeTwin(userId) {
  if (!userId) return null

  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString()

  const eventsRes = await supabaseAdmin
    .from('twin_events')
    .select('event_type, subject, topic, score, correct, duration_ms, modality, created_at')
    .eq('user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(2000)
  const events = eventsRes.data || []
  if (eventsRes.error) {
    console.warn(`[twin/compute] twin_events read failed (${eventsRes.error.code}): ${eventsRes.error.message}`)
  }

  const masteryRes = await supabaseAdmin
    .from('knowledge_mastery')
    .select('*')
    .eq('user_id', userId)
  const masteryRows = masteryRes.data || []
  if (masteryRes.error) {
    console.warn(`[twin/compute] knowledge_mastery read failed (${masteryRes.error.code}): ${masteryRes.error.message}`)
  }

  const sessionsRes = await supabaseAdmin
    .from('study_sessions')
    .select('started_at, duration_min, focus_score')
    .eq('user_id', userId)
    .gte('started_at', since)
  const sessions = sessionsRes.data || []
  if (sessionsRes.error) {
    console.warn(`[twin/compute] study_sessions read failed (${sessionsRes.error.code}): ${sessionsRes.error.message}`)
  }

  const missingTable = (e) => e && (e.code === '42P01' || /relation .* does not exist/.test(e.message || ''))
  if (missingTable(eventsRes.error) && missingTable(masteryRes.error) && missingTable(sessionsRes.error)) {
    const err = new Error('Kyno schema not installed. Run kairo-dashboard/server/db/twin_schema.sql in your Supabase SQL editor.')
    err.code = 'TWIN_SCHEMA_MISSING'
    throw err
  }

  const style       = computeLearningStyle(events)
  const pace        = computePace(events)
  const focus       = computeFocusPattern(events, sessions)
  const retention   = computeRetention(masteryRows)
  const consistency = computeConsistency(events)
  const perfTrend   = computePerformanceTrend(events)
  const burnout     = computeBurnoutRisk(sessions, perfTrend)
  const confidence  = computeConfidence(masteryRows, events)
  const weakTopics  = topTopics(masteryRows, { weak: true,  max: 6 })
  const strongTopics= topTopics(masteryRows, { weak: false, max: 5 })
  const forgetSoon  = forgettingSoon(masteryRows, 8)
  const streak      = computeStreak(events)

  const recentScored = events
    .filter(e => typeof e.score === 'number')
    .slice(0, 20)
    .map(e => e.score)
  const avgRecent  = recentScored.length ? avg(recentScored) : null
  const predExam   = avgRecent != null
    ? Math.round(clamp01((avgRecent / 100) + perfTrend * 0.15) * 100)
    : null
  const predBand   = predExam == null ? null
    : predExam >= 90 ? 'A+' : predExam >= 80 ? 'A' : predExam >= 70 ? 'B+'
    : predExam >= 60 ? 'B'  : predExam >= 50 ? 'C' : predExam >= 40 ? 'D' : 'F'

  const snapshot = {
    user_id: userId,
    style_visual:        style.visual,
    style_text:          style.text,
    style_interactive:   style.interactive,
    style_repetition:    style.repetition,
    pace,
    focus_best_hour:     focus.focus_best_hour,
    focus_avg_minutes:   focus.focus_avg_minutes,
    focus_dropoff_after: focus.focus_dropoff_after,
    retention_score:     +retention.toFixed(3),
    consistency_score:   +consistency.toFixed(3),
    burnout_risk:        +burnout.toFixed(3),
    confidence:          +confidence.toFixed(3),
    performance_trend:   +perfTrend.toFixed(3),
    predicted_exam_score: predExam,
    predicted_band:      predBand,
    streak_days:         streak,
    last_active_at:      events[0]?.created_at || null,
    weak_topics:         weakTopics,
    strong_topics:       strongTopics,
    forgetting_soon:     forgetSoon,
    computed_at:         new Date().toISOString(),
  }

  const { error } = await supabaseAdmin
    .from('academic_twins')
    .upsert(snapshot, { onConflict: 'user_id' })
  if (error) {
    console.warn(`[twin/compute] upsert failed: ${error.message}`)
  }
  return snapshot
}

export async function getTwin(userId) {
  if (!userId) return null
  const { data } = await supabaseAdmin
    .from('academic_twins')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (data) return data
  return recomputeTwin(userId)
}
