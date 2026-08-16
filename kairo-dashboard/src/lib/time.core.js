/**
 * C24 — chapter-wise study time. Pure store math; the browser side that feeds
 * it lives in timeTracker.ts.
 *
 * The rule that shapes everything here: the number shown must be time the app
 * actually attributed to a topic, never an estimate. So credits carry a clamp
 * (a tab left open overnight is not eleven hours of Chemistry), and the view
 * labels itself as "time Kyno could attribute" rather than claiming to be the
 * student's whole study life.
 */

/** A single credit is capped at 10 minutes. Anything longer is a parked tab,
 *  not a study burst — long sessions accumulate through repeated credits. */
export const MAX_CREDIT_MS = 10 * 60_000

/** Ignore blips under 5s: a card swiped past was not studied. */
export const MIN_CREDIT_MS = 5_000

/** Per-day buckets kept per topic. 60 days ≈ 2KB/topic worst case. */
export const KEEP_DAYS = 60

export function emptyStore() {
  return { v: 1, rows: {} }
}

export function readStore(raw) {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (v && v.v === 1 && v.rows && typeof v.rows === 'object') return v
  } catch { /* corrupt -> fresh */ }
  return emptyStore()
}

export function dayKey(ts) {
  const d = new Date(ts)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * Credit `ms` of study time to (subject, topic). Returns a NEW store.
 * Credits outside [MIN, MAX] are clamped (max) or dropped (min).
 */
export function credit(store, { subject, topic, ms, ts }) {
  const clean = Math.min(Math.floor(ms || 0), MAX_CREDIT_MS)
  if (clean < MIN_CREDIT_MS) return store

  const s = subject && String(subject).trim() ? String(subject).trim() : 'General'
  const t = topic && String(topic).trim() ? String(topic).trim() : '—'
  const key = `${s}|${t}`
  const day = dayKey(ts)

  const prev = store.rows[key] || { ms: 0, days: {} }
  const days = { ...prev.days, [day]: (prev.days[day] || 0) + clean }

  // Trim old day buckets; the lifetime total keeps the full history's sum.
  const keys = Object.keys(days).sort()
  while (keys.length > KEEP_DAYS) delete days[keys.shift()]

  return {
    v: 1,
    rows: { ...store.rows, [key]: { ms: prev.ms + clean, days } },
  }
}

/**
 * The breakdown view's data: subjects -> topics, with lifetime, today and
 * last-7-day totals, biggest first. Everything sums from real credits.
 */
export function aggregate(store, now) {
  const today = dayKey(now)
  const week = new Set()
  for (let i = 0; i < 7; i++) week.add(dayKey(now - i * 86_400_000))

  const bySubject = new Map()
  for (const [key, row] of Object.entries(store.rows || {})) {
    const [subject, topic] = key.split('|')
    const todayMs = row.days?.[today] || 0
    const weekMs = Object.entries(row.days || {}).reduce((a, [d, m]) => a + (week.has(d) ? m : 0), 0)
    if (!bySubject.has(subject)) bySubject.set(subject, { subject, ms: 0, todayMs: 0, weekMs: 0, topics: [] })
    const s = bySubject.get(subject)
    s.ms += row.ms; s.todayMs += todayMs; s.weekMs += weekMs
    s.topics.push({ topic, ms: row.ms, todayMs, weekMs })
  }

  const subjects = [...bySubject.values()].sort((a, b) => b.ms - a.ms)
  for (const s of subjects) s.topics.sort((a, b) => b.ms - a.ms)

  return {
    subjects,
    totalMs: subjects.reduce((a, s) => a + s.ms, 0),
    todayMs: subjects.reduce((a, s) => a + s.todayMs, 0),
    weekMs: subjects.reduce((a, s) => a + s.weekMs, 0),
  }
}

/** "1h 24m", "12m", "45s" — one unit pair, no decimals. */
export function formatMs(ms) {
  const s = Math.floor((ms || 0) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}
