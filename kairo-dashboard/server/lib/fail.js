/**
 * The one way a route reports that it broke.
 *
 * 181 places did this instead:
 *
 *     catch (e) { res.status(500).json({ error: e.message }) }
 *
 * which has two faults. It tells nobody — these never reach the global error
 * handler, so the only record was a console line in Vercel that nobody reads,
 * which is how the quiz engine stayed dead in production until a student
 * screenshotted it. And it puts `e.message` on the wire: whatever the database
 * driver, the AI provider or a null dereference happened to say, sent straight
 * to a 15-year-old's phone.
 *
 * fail() alerts, and answers with a sentence that gives nothing away.
 */

import { reportFault } from '../services/alert.js'

/**
 * @param {import('express').Response} res
 * @param {import('express').Request}  req
 * @param {unknown} e      the caught error — logged and alerted, never sent
 * @param {object} [opts]
 * @param {number} [opts.status=500]
 * @param {string} [opts.message]  student-safe copy, if this route has better wording
 * @param {object} [opts.extra]    context for the alert — never student content
 */
export function fail(res, req, e, opts = {}) {
  const { status = 500, message = 'Something went wrong on our side.', extra } = opts

  // A short id printed in the log AND shown to the student. Without it a
  // report of "it said something broke" cannot be matched to anything, which
  // is exactly the position four 500s left us in.
  const ref = Math.random().toString(36).slice(2, 8).toUpperCase()

  reportFault({
    route: req?.originalUrl || req?.path || 'unknown',
    message: e?.message || String(e ?? 'unknown error'),
    stack: e?.stack,
    status,
    source: 'server',
    extra: { ...(extra || {}), ref },
  })
  console.error(`[fail ${ref}] ${req?.method || ''} ${req?.originalUrl || req?.path || '?'} -> ${status}: ${e?.message || e}`)

  // A string, not { code, message } — the client reads `data.error` as a
  // string in most places, and changing 181 responses' shape at the same time
  // as their content is how you turn a fix into an outage.
  if (!res.headersSent) res.status(status).json({ error: message, ref })
}
