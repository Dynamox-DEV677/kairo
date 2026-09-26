/**
 * Tester feedback -- the one place a student writes to the Kyno team.
 *
 * Shared by the Profile sheet and /api/feedback, so what the screen promises
 * ("this is exactly what gets sent") and what the server stores are one set of
 * rules. The users are minors: keep only what's needed to act on a report,
 * and attach nothing the student didn't see before pressing Send.
 *
 * Pure. node --test runs it.
 */

export const FEEDBACK_CATEGORIES = [
  { id: 'bug', label: 'Something broke' },
  { id: 'idea', label: 'Idea' },
  { id: 'question', label: 'Question' },
  { id: 'answer', label: 'Wrong answer' },
]

/** Where in Kyno it happened. A fixed list, never free text. */
export const FEEDBACK_SCREENS = [
  { id: 'today', label: 'Today' },
  { id: 'doubt', label: 'Doubt' },
  { id: 'practice', label: 'Practice' },
  { id: 'plan', label: 'Plan' },
  { id: 'notes', label: 'Notes' },
  { id: 'reader', label: 'Reader' },
  { id: 'progress', label: 'Progress' },
  { id: 'performance', label: 'Performance' },
  { id: 'profile', label: 'Profile' },
  { id: 'other', label: 'Somewhere else' },
]

export const MESSAGE_MIN = 3
export const MESSAGE_MAX = 2000

/**
 * The only device facts that travel, all coarse and none identifying: which
 * platform, the screen size (layout bugs are unfixable without it), and
 * whether it was online. Everything else a client sends is dropped here --
 * the server runs this too, so a modified client can't add fields.
 */
export function deviceSummary(env = {}) {
  const w = Math.round(Number(env?.width))
  const h = Math.round(Number(env?.height))
  const okSize = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0
  return {
    platform: ['android', 'ios', 'web'].includes(env?.platform) ? env.platform : 'web',
    viewport: okSize ? `${Math.min(w, 9999)}x${Math.min(h, 9999)}` : null,
    online: env?.online !== false,
  }
}

/**
 * Clean a submission, or say why it can't be sent.
 * -> { ok: true, value } | { ok: false, error }  (error is student-facing)
 */
export function normalizeFeedback(input) {
  const category = String(input?.category ?? '')
  if (!FEEDBACK_CATEGORIES.some(c => c.id === category)) {
    return { ok: false, error: 'Pick what kind of feedback this is.' }
  }
  const message = String(input?.message ?? '').replace(/\r\n/g, '\n').trim()
  if (message.length < MESSAGE_MIN) return { ok: false, error: 'Write a little more so the team can act on it.' }
  if (message.length > MESSAGE_MAX) return { ok: false, error: `Keep it under ${MESSAGE_MAX} characters.` }
  const screen = FEEDBACK_SCREENS.some(s => s.id === input?.screen) ? input.screen : 'other'
  const appVersion = input?.appVersion ? String(input.appVersion).slice(0, 40) : null
  return { ok: true, value: { category, message, screen, appVersion, device: deviceSummary(input?.device) } }
}
