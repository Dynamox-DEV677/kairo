/**
 * A mock paper that survives the app being killed.
 *
 * Android reclaims a backgrounded WebView without warning. A mock runs forty
 * minutes and every answer lived only in React state, so one trip to WhatsApp
 * could take the whole paper with it. The in-flight paper is now written on
 * every change and restored when the student comes back.
 *
 * The clock is NOT paused while the app is away. It is an exam: time spent
 * outside it is still spent. startedAt is stored and the time left is
 * recomputed from the wall clock, exactly as the room itself does.
 *
 * Pure. Storage is the caller's.
 */

export const MOCK_KEY = 'kyno:mock:inflight'
export const MOCK_VERSION = 1
/**
 * After this long past its end, a paper is abandoned, not "in progress".
 * Coming back the same evening shows the result of the paper that ran out;
 * opening the mock room days later starts a fresh paper instead of ambushing
 * the student with a stale one.
 */
export const ABANDON_AFTER_MS = 12 * 3_600_000

export function snapshotMock({ subject, questions, answers, flags, i, startedAt, totalMs }, now = Date.now()) {
  return {
    v: MOCK_VERSION,
    subject,
    questions,
    answers,
    flags: [...(flags || [])],
    i,
    startedAt,
    totalMs,
    savedAt: now,
  }
}

function parse(raw) {
  if (raw == null) return null
  if (typeof raw !== 'string') return raw
  try { return JSON.parse(raw) } catch { return null }
}

/**
 * The saved paper, ready to restore -- or null.
 *
 * Null for anything that is not unmistakably a live paper for THIS subject:
 * corrupt JSON, an old format, answers that don't line up with the questions,
 * a paper long abandoned. Restoring a wrong paper into an exam is worse than
 * starting a new one.
 *
 * `expired` means the time ran out while the app was away. The caller submits
 * it as it stands, because that is what the clock says happened.
 */
export function readMock(raw, subject, now = Date.now()) {
  const s = parse(raw)
  if (!s || s.v !== MOCK_VERSION) return null
  if (subject != null && s.subject !== subject) return null
  if (!Array.isArray(s.questions) || !s.questions.length) return null
  if (!Array.isArray(s.answers) || s.answers.length !== s.questions.length) return null
  if (!Number.isFinite(s.startedAt) || !Number.isFinite(s.totalMs) || s.totalMs <= 0) return null
  if (now - s.startedAt > s.totalMs + ABANDON_AFTER_MS) return null

  const msLeft = Math.max(0, s.totalMs - (now - s.startedAt))
  return {
    subject: s.subject,
    questions: s.questions,
    answers: s.answers.map(a => (Number.isInteger(a) ? a : null)),
    flags: new Set((Array.isArray(s.flags) ? s.flags : []).filter(Number.isInteger)),
    i: Number.isInteger(s.i) && s.i >= 0 && s.i < s.questions.length ? s.i : 0,
    startedAt: s.startedAt,
    totalMs: s.totalMs,
    msLeft,
    expired: msLeft === 0,
  }
}

/** For the Practice home screen: is there a paper to go back to? */
export function peekMock(raw, now = Date.now()) {
  const s = parse(raw)
  const r = s ? readMock(s, null, now) : null
  if (!r) return null
  return {
    subject: r.subject,
    msLeft: r.msLeft,
    expired: r.expired,
    answered: r.answers.filter(a => a != null).length,
    total: r.questions.length,
  }
}
