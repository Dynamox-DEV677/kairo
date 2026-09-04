/**
 * Plan — the pace model, and everything three screens read from it.
 *
 * Home owns "what do I do right now". This owns THE HORIZON: the exam date,
 * syllabus coverage, and whether the current pace is honestly enough.
 *
 * One computation sits under all of it:
 *
 *   daily_minutes      rolling 14-day MEDIAN of real study minutes
 *   days_left          exam_date - today
 *   minutes_needed     Σ over non-solid chapters of est_minutes × (1 - mastery)
 *   projected          current + (daily_minutes × days_left) / minutes_needed
 *   required           minutes_needed / days_left, to hit the target
 *
 * Median, not mean: one three-hour panic day must not flatter the projection.
 * And no projection at all under seven days of data -- two days of history is
 * not a promise the app is entitled to make.
 *
 * Pure. No React, no storage, no AI. node --test runs it on realistic rows.
 */

import { riskScore } from './syllabusRank.core.js'

const DAY = 86_400_000
export const HISTORY_WINDOW_DAYS = 14
export const MIN_HISTORY_DAYS = 7
export const DEFAULT_TARGET = 90
export const DEFAULT_SESSION_MIN = 25

/* ── time ─────────────────────────────────────────────────────────────────── */

export function dayKey(ts) {
  const d = new Date(ts)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function startOfDay(ts) {
  const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime()
}

function median(nums) {
  const a = nums.filter(Number.isFinite).sort((x, y) => x - y)
  if (!a.length) return null
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}

/**
 * Minutes actually studied per day over the last 14 days, from two sources:
 * completed focus sessions (kyno:focus:history) and the topic time store
 * (kyno:time:*). A day appears if either source has anything for it.
 *
 * Returns { byDay, days, median, sessionMedian }. `median` is null until
 * MIN_HISTORY_DAYS days carry data.
 */
export function dailyMinutes({ focusHistory = [], timeStore = null, now = Date.now() } = {}) {
  const byDay = new Map()
  const cutoff = startOfDay(now) - (HISTORY_WINDOW_DAYS - 1) * DAY

  for (const r of Array.isArray(focusHistory) ? focusHistory : []) {
    if (!r || typeof r.ts !== 'number' || r.ts < cutoff) continue
    const k = dayKey(r.ts)
    byDay.set(k, (byDay.get(k) || 0) + Math.max(0, (r.focusedMs || 0) / 60000))
  }
  const rows = timeStore && timeStore.rows ? Object.values(timeStore.rows) : []
  for (const row of rows) {
    for (const [k, ms] of Object.entries(row?.days || {})) {
      const t = Date.parse(k)
      if (!Number.isFinite(t) || t < cutoff) continue
      byDay.set(k, (byDay.get(k) || 0) + Math.max(0, ms / 60000))
    }
  }

  const mins = [...byDay.values()].map(m => Math.round(m))
  const sessions = (Array.isArray(focusHistory) ? focusHistory : [])
    .filter(r => r && r.ts >= cutoff && r.focusedMs > 0)
    .map(r => r.focusedMs / 60000)

  return {
    byDay,
    days: mins.length,
    median: mins.length >= MIN_HISTORY_DAYS ? Math.round(median(mins)) : null,
    sessionMedian: sessions.length >= 3 ? Math.round(median(sessions)) : DEFAULT_SESSION_MIN,
  }
}

/* ── coverage ─────────────────────────────────────────────────────────────── */

/**
 * Three-way split, weighted by MARKS, not by chapter count. Nine marks of
 * Triangles untouched is not the same as four marks of Polynomials untouched.
 *
 *   solid      state SOLID
 *   shaky      SEEN, PRACTISED, FADING -- touched but not reliable
 *   untouched  UNTOUCHED
 */
export function coverageSplit(graph, states) {
  const chapters = graph?.chapters || []
  const total = chapters.reduce((s, c) => s + (c.typical_marks || 0), 0) || 1
  let solid = 0, shaky = 0, untouched = 0
  for (const c of chapters) {
    const st = states?.get?.(c.id)?.state || 'UNTOUCHED'
    const m = c.typical_marks || 0
    if (st === 'SOLID') solid += m
    else if (st === 'UNTOUCHED') untouched += m
    else shaky += m
  }
  return {
    solidPct: Math.round((solid / total) * 100),
    shakyPct: Math.round((shaky / total) * 100),
    untouchedPct: Math.max(0, 100 - Math.round((solid / total) * 100) - Math.round((shaky / total) * 100)),
    totalMarks: total,
  }
}

/** Minutes still needed: each non-solid chapter's estimate, scaled by what is missing. */
export function minutesNeeded(graph, states) {
  let need = 0
  for (const c of graph?.chapters || []) {
    const st = states?.get?.(c.id)
    if (st?.state === 'SOLID') continue
    const mastery = st?.state === 'UNTOUCHED' ? 0 : Math.max(0, Math.min(1, st?.mastery ?? 0))
    need += (c.est_study_minutes || 0) * (1 - mastery)
  }
  return Math.round(need)
}

/* ── projection ───────────────────────────────────────────────────────────── */

/**
 * Where the current pace lands by exam day, and what it would take to hit the
 * target. Coverage here means "solid" -- shaky does not count as done.
 *
 * `reachable` is the honest target when the asked-for one is gone: never show
 * a number the student cannot still reach.
 */
export function project({ solidPct = 0, needMinutes = 0, dailyMedian = null, daysLeft = null, target = DEFAULT_TARGET } = {}) {
  const gap = Math.max(0, target - solidPct)
  if (daysLeft == null || daysLeft <= 0) {
    return { projected: solidPct, required: null, reachable: solidPct, gap, daysLeft: daysLeft ?? null, haveHistory: dailyMedian != null }
  }
  if (needMinutes <= 0) {
    return { projected: 100, required: 0, reachable: 100, gap: 0, daysLeft, haveHistory: dailyMedian != null }
  }
  const remainingPct = 100 - solidPct
  const perMinute = remainingPct / needMinutes            // coverage points bought per study minute
  const projected = dailyMedian == null ? null : Math.min(100, Math.round(solidPct + dailyMedian * daysLeft * perMinute))
  const required = Math.ceil((gap / perMinute) / daysLeft)  // minutes/day to close the gap
  // What is genuinely reachable if the student doubles down to a hard ceiling
  // of 4 hours a day -- beyond that the number is fantasy, and so is the plan.
  const ceiling = Math.min(100, Math.round(solidPct + 240 * daysLeft * perMinute))
  const reachable = ceiling >= target ? target : Math.max(solidPct, Math.floor(ceiling / 5) * 5)
  return { projected, required, reachable, gap, daysLeft, haveHistory: dailyMedian != null, perMinute }
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
function words(n) {
  n = Math.max(0, Math.round(n))
  if (n <= 20) return WORDS[n]
  // Past ninety-nine the digits read better than "one hundred and twenty",
  // and tens[] would otherwise index off the end into "undefined-zero".
  if (n > 99) return String(n)
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
  const t = Math.floor(n / 10), o = n % 10
  return o ? `${tens[t]}-${WORDS[o]}` : tens[t]
}
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

/**
 * THE HONEST LINE.
 *
 * "At 20 minutes a day you reach 68% by exam day. Forty-five minutes a day
 *  gets you to 90%."
 *
 * Both numbers from the model. Specific, computable, and it respects the
 * student enough to tell the truth instead of showing a motivational ring.
 * When the target is out of reach it says what IS reachable, never a number
 * they cannot still hit.
 */
export function honestLine(p, dailyMedian, target = DEFAULT_TARGET) {
  if (!p) return ''
  if (!p.haveHistory || dailyMedian == null) {
    return 'Kyno needs about a week of your real study time before it can promise you a number.'
  }
  if (p.daysLeft == null) {
    return `At ${dailyMedian} minutes a day, you are covering about ${Math.round(dailyMedian * (p.perMinute || 0) * 7)}% a week.`
  }
  if (p.projected >= target) {
    return `At ${dailyMedian} minutes a day you reach ${p.projected}% by exam day — that already clears ${target}%.`
  }
  const req = p.required || 0
  if (p.reachable < target) {
    const reqReach = Math.ceil(((p.reachable - (p.projected ?? 0)) / (p.perMinute || 1)) / Math.max(1, p.daysLeft)) + dailyMedian
    return `At ${dailyMedian} minutes a day you reach ${p.projected}% by exam day. ${target}% is out of reach now — ${cap(words(Math.min(240, Math.max(dailyMedian + 5, reqReach))))} minutes a day gets you to ${p.reachable}%.`
  }
  return `At ${dailyMedian} minutes a day you reach ${p.projected}% by exam day. ${cap(words(Math.min(240, req)))} minutes a day gets you to ${target}%.`
}

/* ── the week strip ───────────────────────────────────────────────────────── */

/**
 * Seven tiles, Monday to Sunday of the current week. done / missed / today /
 * future. Header is a COUNT -- "4 of 7 days" -- never a judgement.
 */
export function weekStrip(byDay, now = Date.now()) {
  const today = startOfDay(now)
  const dow = (new Date(today).getDay() + 6) % 7        // Monday = 0
  const monday = today - dow * DAY
  const tiles = []
  let done = 0
  for (let i = 0; i < 7; i++) {
    const ts = monday + i * DAY
    const mins = byDay?.get?.(dayKey(ts)) || 0
    let state
    if (ts > today) state = 'future'
    else if (mins >= 5) state = 'done'
    else state = ts === today ? 'today' : 'missed'
    if (state === 'done') done++
    tiles.push({ ts, label: 'MTWTFSS'[i], state, minutes: Math.round(mins) })
  }
  return { tiles, done, header: `${done} of 7 days` }
}

/** Consecutive missed days ending yesterday. Today does not count -- it is still running. */
export function missedRun(byDay, now = Date.now()) {
  const today = startOfDay(now)
  let n = 0
  for (let i = 1; i <= 30; i++) {
    const mins = byDay?.get?.(dayKey(today - i * DAY)) || 0
    if (mins >= 5) break
    n++
  }
  return n
}

/* ── the syllabus map ─────────────────────────────────────────────────────── */

/**
 * Chapter rows sorted by MARKS × WEAKNESS -- riskScore, the same ranking Home
 * uses -- never by chapter number. The order is the advice.
 */
export function chapterRows(graph, states, { sessionMin = DEFAULT_SESSION_MIN } = {}) {
  const rows = (graph?.chapters || []).map(c => {
    const st = states?.get?.(c.id)
    const state = st?.state || 'UNTOUCHED'
    const mastery = state === 'UNTOUCHED' ? 0 : Math.max(0, Math.min(1, st?.mastery ?? 0))
    const need = Math.round((c.est_study_minutes || 0) * (1 - mastery))
    const sessions = Math.max(1, Math.ceil(need / Math.max(10, sessionMin)))
    const solidPct = state === 'SOLID' ? 100 : Math.round(mastery * 100)
    const shakyPct = state === 'SOLID' || state === 'UNTOUCHED' ? 0 : Math.min(100 - solidPct, 40)
    let status
    if (state === 'SOLID') status = 'Solid'
    else if (state === 'UNTOUCHED') status = `Not started · needs about ${sessions} session${sessions === 1 ? '' : 's'}`
    else if (state === 'FADING') status = `${solidPct}% solid but fading · one revision session`
    else status = `${solidPct}% solid, ${shakyPct}% shaky · ${sessions} more session${sessions === 1 ? '' : 's'}`
    return {
      id: c.id, name: c.name, marks: c.typical_marks || 0, state, mastery,
      solidPct, shakyPct, needMinutes: need, sessions, status,
      atRisk: state === 'UNTOUCHED' && (c.typical_marks || 0) >= 6,
      score: riskScore(c, st),
      done: state === 'SOLID',
    }
  })
  const open = rows.filter(r => !r.done).sort((a, b) => b.score - a.score)
  const done = rows.filter(r => r.done)
  return { open, done }
}

/** "Two untouched chapters are worth 19 marks together." -- or null. */
export function untouchedCallout(rows) {
  const u = (rows || []).filter(r => r.state === 'UNTOUCHED')
  const marks = u.reduce((s, r) => s + r.marks, 0)
  if (!u.length || marks < 8) return null
  return {
    headline: `${cap(words(u.length))} untouched chapter${u.length === 1 ? ' is' : 's are'} worth ${marks} marks together.`,
    sub: 'Sorted below by marks on the paper, not by chapter number.',
    marks,
  }
}

/* ── topic architect: the default split ───────────────────────────────────── */

/**
 * Three sessions, not a six-hour marathon. LEARN, PRACTISE, TEST -- and always
 * end on TEST, written and graded, so they find out now rather than in the
 * exam. This is the standard breakdown the screen falls back to when the AI
 * layer is down; the generated version only rewrites the "what" and "why".
 */
export function defaultTopicPlan(node, { needMinutes = null, sessionMin = DEFAULT_SESSION_MIN, daysLeft = null, now = Date.now() } = {}) {
  const total = Math.max(30, needMinutes ?? node?.est_study_minutes ?? 90)
  // Up to an hour and a half is two sessions; anything bigger earns a PRACTISE
  // session in the middle. Three is the ceiling -- never a six-hour marathon.
  const n = total <= 90 ? 2 : 3
  const per = Math.max(15, Math.round(total / n / 5) * 5)
  const gapDays = daysLeft != null && daysLeft < n * 2 ? 1 : 2
  const topics = (node?.topics || []).slice(0, 3).join(', ')
  const kinds = n === 2 ? ['LEARN', 'TEST'] : ['LEARN', 'PRACTISE', 'TEST']
  const sessions = kinds.map((kind, i) => ({
    kind,
    minutes: kind === 'TEST' ? Math.min(per, 30) : per,
    day: startOfDay(now) + i * gapDays * DAY,
    what: kind === 'LEARN'
      ? `The core ideas${topics ? `: ${topics}` : ''}`
      : kind === 'PRACTISE'
        ? 'Ten questions, board-style, no notes'
        : 'One written answer, photographed and step-marked',
    why: kind === 'LEARN'
      ? 'Everything else in the chapter sits on top of these.'
      : kind === 'PRACTISE'
        ? 'Knowing it and doing it under time are different skills.'
        : 'Find out now, not in the exam.',
  }))
  const spanDays = (n - 1) * gapDays + 1
  const finish = sessions[sessions.length - 1].day
  const roomToRevise = daysLeft == null ? null : daysLeft - spanDays
  return {
    sessions, totalMinutes: sessions.reduce((s, x) => s + x.minutes, 0), spanDays, finish,
    framing: `${cap(words(n))} session${n === 1 ? '' : 's'} over ${words(spanDays)} day${spanDays === 1 ? '' : 's'}.${
      daysLeft == null ? '' : roomToRevise > 3 ? ` ${cap(words(Math.min(99, daysLeft)))} days left, so this finishes with room to revise.` : roomToRevise >= 0 ? ` ${cap(words(Math.min(99, daysLeft)))} days left — this finishes just in time.` : ' This does not fit before the exam — see what is reachable instead.'}`,
  }
}

/* ── adjust: fell behind ──────────────────────────────────────────────────── */

/**
 * Three options with their REAL consequences. Option 3 -- leave it -- is a
 * real choice offered with the same weight as the others. Twenty minutes a
 * day a student actually does beats forty-five they plan and skip.
 */
export function adjustOptions({ p, dailyMedian, rows, target = DEFAULT_TARGET } = {}) {
  if (!p || dailyMedian == null || p.daysLeft == null || p.daysLeft <= 0) return null
  const per = p.perMinute || 0
  const now = p.projected ?? 0
  const plus15 = Math.min(100, Math.round(now + 15 * p.daysLeft * per))

  // skipping the two smallest open chapters removes their minutes from the
  // denominator -- coverage of what remains rises, at a named cost
  const open = (rows || []).filter(r => !r.done).slice().sort((a, b) => a.marks - b.marks)
  const skip = open.slice(0, 2)
  const skipMarks = skip.reduce((s, r) => s + r.marks, 0)
  const skipMinutes = skip.reduce((s, r) => s + r.needMinutes, 0)
  const totalNeed = (rows || []).filter(r => !r.done).reduce((s, r) => s + r.needMinutes, 0) || 1
  const perAfterSkip = (100 - now) / Math.max(1, totalNeed - skipMinutes)
  const skipProjected = Math.min(100, Math.round(now + dailyMedian * p.daysLeft * perAfterSkip))

  return {
    was: target,
    now,
    options: [
      {
        id: 'more', title: 'Add 15 minutes a day', to: plus15, tone: 'recommended',
        detail: `${dailyMedian + 15} minutes a day instead of ${dailyMedian}. Same chapters, same order.`,
      },
      {
        id: 'skip', title: `Skip the two smallest chapters`, to: skipProjected, tone: 'neutral',
        detail: skip.length
          ? `${skip.map(r => r.name).join(' and ')} — ${skipMarks} marks. You would go in strong on everything else and blank on those.`
          : 'Nothing small enough left to skip.',
      },
      {
        id: 'keep', title: 'Leave it as it is', to: now, tone: 'neutral',
        detail: 'A real choice, not a failure. Twenty minutes a day you actually do beats forty-five you plan and skip.',
      },
    ],
  }
}

/* ── focus timer persistence (pure helpers) ───────────────────────────────── */

/**
 * A running session survives a reload: this is the state that is persisted
 * and recovered on mount. Elapsed is derived from wall-clock, never from a
 * tick counter, so backgrounding and reloads cannot lose time.
 */
export function elapsedMs(session, now = Date.now()) {
  if (!session || !session.startedAt) return 0
  const pausedSoFar = (session.pausedMs || 0) + (session.pausedAt ? now - session.pausedAt : 0)
  return Math.max(0, now - session.startedAt - pausedSoFar)
}

export function remainingMs(session, now = Date.now()) {
  if (!session) return 0
  return Math.max(0, (session.plannedMs || 0) - elapsedMs(session, now))
}

/** "You left the app twice · 4 min lost" -- accountability, not enforcement. */
export function driftLine(drifts = 0, driftMs = 0) {
  if (!drifts) return null
  const min = Math.round(driftMs / 60000)
  return {
    left: `You left the app ${drifts === 1 ? 'once' : drifts === 2 ? 'twice' : `${drifts} times`}`,
    lost: min >= 1 ? `${min} min lost` : 'under a minute lost',
  }
}
