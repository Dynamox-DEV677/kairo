/**
 * Make "We've been alerted" true.
 *
 * That sentence ships to students today and it is a lie. Errors DO reach
 * /api/ops/error — the route exists and accepts them — but it pushes each one
 * into `const ERROR_LOG = []`, an in-memory array. On Vercel every request may
 * land on a fresh serverless instance and instances are recycled constantly,
 * so the array is gone almost immediately. The only way to read it is
 * /api/ops/status, which is deliberately 404-gated behind OPS_TOKEN.
 *
 * Net effect: the app faithfully reports every failure into a bucket with no
 * bottom, and nobody is watching. Two features sat dead in production and the
 * first anyone knew was a screenshot.
 *
 * This sends an email instead. Deliberately boring:
 *
 *   · DE-DUPED by error signature — one alert per distinct fault, not one per
 *     student who hits it. A broken quiz endpoint would otherwise mail on
 *     every single tap.
 *   · RATE LIMITED to a few per hour, because an alert storm is the same as
 *     no alerts.
 *   · NEVER THROWS. Alerting that can break a request is worse than none, so
 *     every failure here is swallowed after a console line.
 *
 * Also in-memory, and that is fine: the de-dupe cache being cold on a new
 * instance means at worst one extra email, which is the safe direction.
 */

import nodemailer from 'nodemailer'

const TO = process.env.ALERT_EMAIL || process.env.KAIRO_EMAIL
const FROM = process.env.KAIRO_EMAIL
const PASS = process.env.KAIRO_EMAIL_APP_PASSWORD

const WINDOW_MS = 60 * 60 * 1000   // an hour
const MAX_PER_WINDOW = 6           // beyond this, stay quiet until the window rolls
const REPEAT_AFTER_MS = 6 * 60 * 60 * 1000  // re-alert on the same fault after 6h

/** signature -> last time we mailed about it */
const lastSent = new Map()
/** timestamps of alerts sent, for the rate limit */
let recent = []

function configured() {
  return !!(TO && FROM && PASS)
}

/**
 * What makes two errors "the same"?
 *
 * Route plus message, with digits stripped. Ids, timestamps and counts differ
 * on every occurrence of what is really one bug, and leaving them in would
 * defeat the de-dupe entirely.
 */
function signature({ route = '', message = '' }) {
  return `${route}|${String(message).replace(/\d+/g, '#').slice(0, 160)}`
}

function withinRateLimit() {
  const now = Date.now()
  recent = recent.filter(t => now - t < WINDOW_MS)
  return recent.length < MAX_PER_WINDOW
}

let transporter = null
function mailer() {
  if (transporter) return transporter
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: FROM, pass: PASS },
  })
  return transporter
}

/**
 * Report a fault. Fire-and-forget — callers must not await this on a request
 * path, and must never let it change what the student sees.
 *
 * @param {object} f
 * @param {string} f.route     where it happened, e.g. '/api/quiz/start'
 * @param {string} f.message   the real error message (server-side only)
 * @param {string} [f.stack]
 * @param {number} [f.status]  HTTP status returned to the client
 * @param {string} [f.source]  'server' | 'client'
 * @param {object} [f.extra]   anything else worth seeing, no student content
 */
export function reportFault(f = {}) {
  try {
    const { route = 'unknown', message = '', stack, status, source = 'server', extra } = f
    if (!message) return

    // Always leave a trace in the platform log, even when email is off — this
    // is the line you grep for in Vercel when something is on fire.
    console.error(`[fault] ${source} ${status || ''} ${route} :: ${String(message).slice(0, 300)}`)

    if (!configured()) return

    const sig = signature({ route, message })
    const now = Date.now()
    const seen = lastSent.get(sig)
    if (seen && now - seen < REPEAT_AFTER_MS) return   // already told you about this one
    if (!withinRateLimit()) return

    lastSent.set(sig, now)
    recent.push(now)

    const subject = `Kyno fault · ${route}${status ? ` · ${status}` : ''}`
    const body = [
      `Route:    ${route}`,
      `Status:   ${status ?? '—'}`,
      `Source:   ${source}`,
      `When:     ${new Date().toISOString()}`,
      `Commit:   ${process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local'}`,
      `Env:      ${process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'}`,
      '',
      'Message:',
      String(message).slice(0, 2000),
      stack ? `\nStack:\n${String(stack).slice(0, 3000)}` : '',
      extra ? `\nExtra:\n${JSON.stringify(extra, null, 2).slice(0, 1500)}` : '',
      '',
      `— De-duped: you will not get this same fault again for ${REPEAT_AFTER_MS / 3600000}h.`,
    ].join('\n')

    // Not awaited on purpose: a slow SMTP handshake must not hold a student's
    // request open, and a failed send must not become a second error.
    mailer().sendMail({ from: FROM, to: TO, subject, text: body })
      .catch(e => console.warn('[alert] could not send:', e.message))
  } catch (e) {
    console.warn('[alert] reportFault itself failed:', e?.message)
  }
}

/** For the status endpoint and tests — no secrets in here. */
export function alertStatus() {
  return {
    configured: configured(),
    to: configured() ? String(TO).replace(/^(.{2}).*(@.*)$/, '$1***$2') : null,
    sentThisHour: recent.filter(t => Date.now() - t < WINDOW_MS).length,
    maxPerHour: MAX_PER_WINDOW,
    distinctFaultsTracked: lastSent.size,
  }
}

/** Tests only. */
export function _reset() {
  lastSent.clear()
  recent = []
}
