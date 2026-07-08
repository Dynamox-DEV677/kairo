/**
 * Nodemailer transport — singleton, lazy-built, env-driven.
 *
 * Env vars (set in Vercel and `.env`):
 *   KAIRO_EMAIL              the platform Gmail address
 *   KAIRO_EMAIL_APP_PASSWORD 16-char Gmail App Password (spaces stripped)
 *
 * If either is missing the transport silently returns null and sends are
 * skipped (logged) so authentication routes never break in dev/CI.
 */

import nodemailer from 'nodemailer'

const FROM_EMAIL  = process.env.KAIRO_EMAIL
const APP_PWD     = (process.env.KAIRO_EMAIL_APP_PASSWORD || '').replace(/\s+/g, '')
const FROM_NAME   = process.env.KAIRO_EMAIL_FROM_NAME || 'Kora · Accelerate Your Academics'

let _transporter = null

/** Returns the transporter, or null if env vars are missing. */
export function getTransporter() {
  if (_transporter) return _transporter
  if (!FROM_EMAIL || !APP_PWD) return null
  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth:    { user: FROM_EMAIL, pass: APP_PWD },
  })
  return _transporter
}

export function getFromAddress() {
  return FROM_EMAIL ? `"${FROM_NAME}" <${FROM_EMAIL}>` : null
}

/**
 * Send one email. Fire-and-forget: never throws, logs failures, returns
 * the nodemailer info object on success or null on failure / no-config.
 *
 * Always pass a plain-text `text` fallback alongside the HTML — many spam
 * filters down-rank HTML-only messages.
 */
export async function send({ to, subject, html, text, replyTo }) {
  const t = getTransporter()
  if (!t) {
    console.warn(`[email] KAIRO_EMAIL not configured — skipping "${subject}" → ${to}`)
    return null
  }
  if (!to) {
    console.warn(`[email] No "to" address provided — skipping "${subject}"`)
    return null
  }
  try {
    const info = await t.sendMail({
      from: getFromAddress(),
      to, subject, html, text,
      replyTo: replyTo || undefined,
    })
    console.log(`[email] ✓ ${subject} → ${to} (${info.messageId})`)
    return info
  } catch (err) {
    console.error(`[email] ✗ FAILED "${subject}" → ${to}: ${err.message}`)
    return null
  }
}
