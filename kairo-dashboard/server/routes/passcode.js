/**
 * /api/passcode/* — Kairo OS device passcode reset OTP flow.
 *
 *   POST /api/passcode/send-otp     { email }     → emails a 6-digit code
 *   POST /api/passcode/verify-otp   { email, code } → checks the code
 *
 * Storage: in-memory Map. Each entry expires after 10 minutes and is also
 * proactively purged on every request. For multi-instance prod, swap the
 * Map for a Supabase row (see comments below). For Vercel hobby +
 * Anthropic single-instance, in-memory is fine — a cold start just makes
 * the user request another code.
 *
 * Anti-abuse:
 *   • 30 s cooldown between sends per email
 *   • Max 4 sends per email per 10-min rolling window
 *   • OTPs are stored as SHA-256 hashes (never plain)
 *   • 6 failed verifications → entry destroyed (forces a fresh send)
 */
import { Router } from 'express'
import crypto from 'crypto'
import { sendPasscodeOtpEmail } from '../email/index.js'

const router = Router()

// In-memory store keyed by lowercased email.
//   email → { hash, expiresAt, lastSentAt, sendTimestamps[], attemptsLeft }
const STORE = new Map()

const OTP_TTL_MS         = 10 * 60 * 1000      // 10 minutes
const RESEND_COOLDOWN_MS = 30 * 1000           // 30 s between sends
const WINDOW_MS          = 10 * 60 * 1000      // 10-min anti-spam window
const SENDS_PER_WINDOW   = 4
const MAX_ATTEMPTS       = 6

function hashCode(code, email) {
  // Per-email salt — even if STORE leaks, hashes can't be replayed across users
  return crypto.createHash('sha256').update(`${email}::${code}`).digest('hex')
}
function genCode() {
  // 6 digits, never starts with 0 (Apple-style readability)
  return String(crypto.randomInt(100000, 1_000_000))
}
function normEmail(s) {
  return String(s || '').trim().toLowerCase()
}
function validEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}
function purge(email) {
  // Drop expired entries on every touch
  const r = STORE.get(email)
  if (r && r.expiresAt < Date.now()) STORE.delete(email)
}

// ── POST /send-otp ──────────────────────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  const email = normEmail(req.body?.email)
  if (!validEmail(email)) {
    return res.status(400).json({ error: 'A valid email is required.' })
  }

  purge(email)
  const now = Date.now()
  const existing = STORE.get(email) || { sendTimestamps: [] }

  // Trim send-timestamps to the last 10 minutes
  existing.sendTimestamps = (existing.sendTimestamps || []).filter(t => t > now - WINDOW_MS)

  // Per-email cooldown
  if (existing.lastSentAt && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
    const cooldown = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000)
    return res.status(429).json({
      error:    `Slow down — try again in ${cooldown}s.`,
      cooldown,
      ok:       false,
      reason:   'cooldown',
    })
  }

  // 4-per-10-min cap
  if (existing.sendTimestamps.length >= SENDS_PER_WINDOW) {
    return res.status(429).json({
      error:  'Too many requests for this email. Wait a few minutes.',
      ok:     false,
      reason: 'window-full',
    })
  }

  // Generate + store
  const code = genCode()
  const entry = {
    hash:           hashCode(code, email),
    expiresAt:      now + OTP_TTL_MS,
    lastSentAt:     now,
    sendTimestamps: [...existing.sendTimestamps, now],
    attemptsLeft:   MAX_ATTEMPTS,
  }
  STORE.set(email, entry)

  // Fire the email — never block the response on it.
  // The transport already swallows errors, so this is safe to await briefly.
  try {
    await sendPasscodeOtpEmail({
      to:               email,
      code,
      expiresInMinutes: 10,
      ip:               req.headers['x-forwarded-for'] || req.ip,
      userAgent:        req.headers['user-agent'] || '',
    })
  } catch (e) {
    console.warn('[passcode/send-otp] email send failed:', e?.message)
    // Don't fail the request — code is still valid; user can ask for a resend.
  }

  // In dev, surface the code so the UI can auto-fill (localhost only).
  const isDev = (req.hostname || '').includes('localhost') ||
                (req.headers['x-forwarded-for'] || '').includes('127.0.0.1')

  res.status(200).json({
    ok:        true,
    cooldown:  Math.ceil(RESEND_COOLDOWN_MS / 1000),
    remaining: Math.max(0, SENDS_PER_WINDOW - entry.sendTimestamps.length),
    expires_in_sec: Math.ceil(OTP_TTL_MS / 1000),
    dev_otp:   isDev ? code : undefined,
  })
})

// ── POST /verify-otp ────────────────────────────────────────────────────────
router.post('/verify-otp', (req, res) => {
  const email = normEmail(req.body?.email)
  const code  = String(req.body?.code || '').trim()
  if (!validEmail(email)) return res.status(400).json({ error: 'Invalid email.' })
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Code must be 6 digits.' })

  purge(email)
  const entry = STORE.get(email)
  if (!entry) {
    return res.status(400).json({
      ok:     false,
      error:  'No active code. Request a new one.',
      reason: 'no-otp',
    })
  }
  if (entry.expiresAt < Date.now()) {
    STORE.delete(email)
    return res.status(400).json({
      ok:     false,
      error:  'Code expired. Request a new one.',
      reason: 'expired',
    })
  }
  if (entry.attemptsLeft <= 0) {
    STORE.delete(email)
    return res.status(400).json({
      ok:     false,
      error:  'Too many wrong attempts. Request a new code.',
      reason: 'locked',
    })
  }

  const ok = hashCode(code, email) === entry.hash
  if (!ok) {
    entry.attemptsLeft -= 1
    STORE.set(email, entry)
    return res.status(400).json({
      ok:     false,
      error:  'Incorrect verification code.',
      reason: 'mismatch',
      attempts_left: entry.attemptsLeft,
    })
  }

  // Success — burn the code immediately so it can't be re-used.
  STORE.delete(email)
  res.status(200).json({ ok: true })
})

// ── Health (handy for debugging in dev) ─────────────────────────────────────
router.get('/health', (_req, res) => {
  res.json({ ok: true, pending: STORE.size })
})

export default router
