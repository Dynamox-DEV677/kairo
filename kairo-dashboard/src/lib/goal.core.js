/**
 * The 490 Tracker — turn a board target ("490/500") into per-subject gaps and
 * the topics that close them fastest.
 *
 * Honesty rules, learned the hard way in stream.core:
 *  - Marks are projected from REAL accuracy (correct/attempts), never from raw
 *    BKT mastery — mastery sits ~0.4-0.5 even on a strong subject, so reading
 *    it as a percentage would tell every student they are failing.
 *  - A subject with fewer than MIN_ATTEMPTS answers gets NO number, just
 *    "answer more questions to unlock this". A projection from 3 answers is
 *    noise dressed up as insight.
 *  - The headline pace only appears when EVERY chosen subject has data;
 *    otherwise the honest headline is how many subjects still need answers.
 *  - Lever gains are labelled estimates (≈) and derive from the real
 *    distribution of the student's own wrong answers — never invented.
 */

export const MIN_ATTEMPTS = 8
export const ON_TRACK_TOLERANCE = 2

/** Marks each subject is worth. Indian boards: 100 per subject. */
export const MARKS_PER_SUBJECT = 100

export const TARGET_PRESETS = [450, 470, 480, 490]

/**
 * Rows of one subject.
 *
 * Both sides go through the SAME resolver, because the target now stores
 * canonical ids ('mathematics') while mastery rows carry whatever the quiz
 * wrote ('Math', 'Maths'). Comparing raw strings silently matched nothing
 * and every subject read "needs more answers".
 */
function rowsFor(mastery, subject, resolve) {
  const norm = resolve || defaultResolve
  const want = norm(subject)
  return (mastery || []).filter(r =>
    r && norm(r.subject) === want &&
    typeof r.attempts === 'number' && r.attempts > 0)
}

/** Fallback when no registry resolver is injected (tests, pure use). */
function defaultResolve(v) {
  const s = String(v || '').trim().toLowerCase()
  if (s === 'math' || s === 'maths') return 'mathematics'
  if (s === 'social' || s === 'sst') return 'social-science'
  return s.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/**
 * Projection for one subject, from real answer history.
 * Returns { projected, attempts, correct, confidence } — projected is null
 * (never a guess) below MIN_ATTEMPTS.
 */
export function subjectProjection(mastery, subject, resolve) {
  const rows = rowsFor(mastery, subject, resolve)
  const attempts = rows.reduce((a, r) => a + r.attempts, 0)
  const correct = rows.reduce((a, r) => a + (r.correct || 0), 0)
  if (attempts < MIN_ATTEMPTS) {
    return { projected: null, attempts, correct, confidence: 'none' }
  }
  const projected = Math.round((correct / attempts) * MARKS_PER_SUBJECT)
  return {
    projected,
    attempts,
    correct,
    confidence: attempts >= 25 ? 'ok' : 'low',
  }
}

/**
 * The topics inside one subject where marks are leaking, by the student's own
 * wrong-answer distribution. `gainEstimate` splits the subject's gap across
 * topics in proportion to where the wrong answers actually happened.
 */
export function leverTopics(mastery, subject, gap, { max = 3, resolve } = {}) {
  if (!gap || gap <= 0) return []
  const rows = rowsFor(mastery, subject, resolve)
    .map(r => ({ ...r, wrong: Math.max(0, r.attempts - (r.correct || 0)) }))
    .filter(r => r.wrong > 0)
  const totalWrong = rows.reduce((a, r) => a + r.wrong, 0)
  if (!totalWrong) return []
  return rows
    .sort((a, b) => b.wrong - a.wrong || a.mastery - b.mastery)
    .slice(0, max)
    .map(r => ({
      topic: r.topic,
      subject: r.subject,
      wrong: r.wrong,
      attempts: r.attempts,
      // ≈ share of the subject gap this topic's misses account for. An
      // estimate by construction; the UI labels it "≈ +N".
      gainEstimate: Math.max(1, Math.round(gap * (r.wrong / totalWrong))),
    }))
}

/**
 * The whole plan. target = { total, subjects: string[] }.
 * Subjects are weighted evenly (total / subjects.length each).
 */
export function goalPlan({ mastery = [], target, resolve } = {}) {
  const subjects = (target && Array.isArray(target.subjects)) ? target.subjects.filter(Boolean) : []
  const total = target && Number(target.total)
  if (!subjects.length || !Number.isFinite(total) || total <= 0) return null

  const outOf = subjects.length * MARKS_PER_SUBJECT
  const targetPer = total / subjects.length

  const perSubject = subjects.map(s => {
    const p = subjectProjection(mastery, s, resolve)
    const gap = p.projected == null ? null : Math.round(targetPer - p.projected)
    return {
      subject: s,
      ...p,
      targetPer: Math.round(targetPer),
      gap,
      onTrack: p.projected != null && p.projected >= targetPer - ON_TRACK_TOLERANCE,
      levers: p.projected == null ? [] : leverTopics(mastery, s, Math.max(0, gap ?? 0), { resolve }),
    }
  })

  const withData = perSubject.filter(s => s.projected != null)
  const ready = withData.length === subjects.length

  // The single biggest lever across lagging subjects — the headline action.
  const allLevers = perSubject
    .filter(s => !s.onTrack)
    .flatMap(s => s.levers)
    .sort((a, b) => b.gainEstimate - a.gainEstimate)

  return {
    total,
    outOf,
    subjects: perSubject,
    ready,
    subjectsWithData: withData.length,
    // Only claim a pace when every subject is backed by real answers.
    paceTotal: ready ? withData.reduce((a, s) => a + s.projected, 0) : null,
    topLever: allLevers[0] || null,
  }
}

/* ── target persistence helpers (pure: parse/serialise only) ─────────────── */

export function parseGoal(raw) {
  try {
    const g = JSON.parse(raw)
    if (!g || !Number.isFinite(Number(g.total)) || !Array.isArray(g.subjects) || !g.subjects.length) return null
    return { total: Number(g.total), subjects: g.subjects.map(String).filter(Boolean) }
  } catch { return null }
}

/**
 * Subjects to offer at setup: the ones the student has actually answered
 * questions in (most-practised first), topped up from a standard list.
 */
/**
 * Subjects to offer at goal setup, as canonical IDS.
 *
 * The reported bug lived here: this merged the student's practised subject
 * STRINGS (which came from quiz data as "Math") with a hardcoded standard
 * list (which said "Mathematics"), so both appeared as separate chips. Now
 * everything is resolved to one registry id before deduping, and the
 * board-appropriate list comes from the registry — so a Tamil Nadu student
 * is offered Tamil, not Hindi.
 *
 * @param resolve   registry resolveSubjectId — injected so this core stays pure
 * @param available registry ids appropriate to the student's board/class
 */
export function suggestSubjects(mastery, { max = 8, resolve = null, available = null } = {}) {
  // Same resolver the projection uses — a plain slugger would leave "Math"
  // and "Mathematics" as two ids and reproduce the exact reported bug.
  const toId = resolve || defaultResolve

  const practisedCount = new Map()
  for (const r of mastery || []) {
    if (!r || !r.subject) continue
    if (/^general$/i.test(String(r.subject))) continue
    const id = toId(r.subject)
    if (!id) continue
    practisedCount.set(id, (practisedCount.get(id) || 0) + (r.attempts || 0))
  }
  const practised = [...practisedCount.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)

  const fallback = ['mathematics', 'science', 'social-science', 'english', 'physics', 'chemistry', 'biology']
  const pool = available && available.length ? available : fallback

  const out = []
  for (const id of [...practised, ...pool]) {
    if (id && !out.includes(id)) out.push(id)
    if (out.length >= max) break
  }
  return out
}

/** The denominator is 100 × the subjects the student actually sits. */
export function totalOutOf(subjectCount) {
  return Math.max(0, Number(subjectCount) || 0) * MARKS_PER_SUBJECT
}
