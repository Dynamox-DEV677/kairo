
import nodemailer from 'nodemailer'

const FROM_EMAIL  = process.env.KAIRO_EMAIL
const APP_PWD     = (process.env.KAIRO_EMAIL_APP_PASSWORD || '').replace(/\s+/g, '')
const FROM_NAME   = process.env.KAIRO_EMAIL_FROM_NAME || 'Kyno · Accelerate Your Academics'

let _transporter = null

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
