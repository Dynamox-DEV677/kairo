/**
 * /api/passcode/* — Kora device passcode reset OTP flow.
 *
 *   POST /api/passcode/send-otp     { email }     → emails a 6-digit code
 *   POST /api/passcode/verify-otp   { email, code } → checks the code
 *
 * Storage strategy (changed: 2026-05-19):
 *   PRIMARY  : Supabase table `kairo_otps`. Survives Vercel cold starts and
 *              works across every serverless instance. Required for any
 *              production traffic above ~50 concurrent users.
 *   FALLBACK : In-memory Map. Used only if the table doesn't exist (i.e.
 *              the migration in db/kairo_otps_schema.sql hasn't been run)
 *              or Supabase is unreachable. Survives single-instance, dev,
 *              and the first deploy before the SQL has run.
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
import { supabaseAdmin } from '../services/supabase.js'

const router = Router()

// In-memory fallback. Used when Supabase is unreachable / table missing.
//   email → { hash, expiresAt, lastSentAt, sendTimestamps[], attemptsLeft }
const STORE = new Map()

const OTP_TTL_MS         = 10 * 60 * 1000      // 10 minutes
const RESEND_COOLDOWN_MS = 30 * 1000           // 30 s between sends
const WINDOW_MS          = 10 * 60 * 1000      // 10-min anti-spam window
const SENDS_PER_WINDOW   = 4
const MAX_ATTEMPTS       = 6

// ───────────────────────────── Helpers ─────────────────────────────────────
function hashCode(code, email) {
  // Per-email salt — even if the row leaks, hashes can't be replayed across users
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

// Did the error string tell us the table is missing? Then the deploy is
// running ahead of the migration and we should silently fall back to the
// in-memory Map.
function isMissingTable(err) {
  const msg = String(err?.message || err || '')
  return /relation .* does not exist/i.test(msg)
       || /could not find .* table/i.test(msg)
       || /schema cache/i.test(msg)
}

// ─────────────────────── Storage abstraction ───────────────────────────────
// All four methods return the same shape so the route code doesn't care
// where the OTP actually lives.
//
//   read(email)   → { hash, expiresAt, lastSentAt, sendTimestamps[], attemptsLeft } | null
//   write(email, row) → void
//   bump(email, row)  → void  (updates attempts_left after wrong code)
//   destroy(email)    → void

async function readRow(email) {
  // Try Supabase first.
  try {
    const { data, error } = await supabaseAdmin
      .from('kairo_otps')
      .select('email, hash, expires_at, last_sent_at, send_timestamps, attempts_left')
      .eq('email', email)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return STORE.get(email) || null   // also check memory in case of recent fall-back
    // Purge if expired
    if (new Date(data.expires_at).getTime() < Date.now()) {
      await destroyRow(email).catch(() => {})
      return null
    }
    return {
      hash:           data.hash,
      expiresAt:      new Date(data.expires_at).getTime(),
      lastSentAt:     new Date(data.last_sent_at).getTime(),
      sendTimestamps: Array.isArray(data.send_timestamps) ? data.send_timestamps : [],
      attemptsLeft:   data.attempts_left,
    }
  } catch (e) {
    if (!isMissingTable(e)) console.warn('[passcode] supabase read failed, using memory fallback:', e.message)
    // ── Memory fallback ──
    const row = STORE.get(email)
    if (!row) return null
    if (row.expiresAt < Date.now()) { STORE.delete(email); return null }
    return row
  }
}

async function writeRow(email, row) {
  STORE.set(email, row)                          // always write to memory too
  try {
    const { error } = await supabaseAdmin
      .from('kairo_otps')
      .upsert({
        email,
        hash:            row.hash,
        expires_at:      new Date(row.expiresAt).toISOString(),
        last_sent_at:    new Date(row.lastSentAt).toISOString(),
        send_timestamps: row.sendTimestamps,
        attempts_left:   row.attemptsLeft,
      }, { onConflict: 'email' })
    if (error) throw new Error(error.message)
  } catch (e) {
    if (!isMissingTable(e)) console.warn('[passcode] supabase upsert failed:', e.message)
    // memory copy already written above — no further action needed
  }
}

async function destroyRow(email) {
  STORE.delete(email)
  try {
    await supabaseAdmin.from('kairo_otps').delete().eq('email', email)
  } catch (e) {
    if (!isMissingTable(e)) console.warn('[passcode] supabase delete failed:', e.message)
  }
}

// ── POST /send-otp ──────────────────────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  const email = normEmail(req.body?.email)
  if (!validEmail(email)) {
    return res.status(400).json({ error: 'A valid email is required.' })
  }

  const now = Date.now()
  const existing = (await readRow(email)) || { sendTimestamps: [] }

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
  await writeRow(email, entry)

  // Fire the email — never block the response on it.
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
  }

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
router.post('/verify-otp', async (req, res) => {
  const email = normEmail(req.body?.email)
  const code  = String(req.body?.code || '').trim()
  if (!validEmail(email))    return res.status(400).json({ error: 'Invalid email.' })
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Code must be 6 digits.' })

  const entry = await readRow(email)
  if (!entry) {
    return res.status(400).json({ ok: false, error: 'No active code. Request a new one.', reason: 'no-otp' })
  }
  if (entry.expiresAt < Date.now()) {
    await destroyRow(email)
    return res.status(400).json({ ok: false, error: 'Code expired. Request a new one.', reason: 'expired' })
  }
  if (entry.attemptsLeft <= 0) {
    await destroyRow(email)
    return res.status(400).json({ ok: false, error: 'Too many wrong attempts. Request a new code.', reason: 'locked' })
  }

  const ok = hashCode(code, email) === entry.hash
  if (!ok) {
    entry.attemptsLeft -= 1
    await writeRow(email, entry)
    return res.status(400).json({
      ok:     false,
      error:  'Incorrect verification code.',
      reason: 'mismatch',
      attempts_left: entry.attemptsLeft,
    })
  }

  // Success — burn the code immediately so it can't be re-used.
  await destroyRow(email)
  res.status(200).json({ ok: true })
})

// ── Health (handy for debugging in dev) ─────────────────────────────────────
router.get('/health', async (_req, res) => {
  let dbRows = null
  try {
    const { count } = await supabaseAdmin
      .from('kairo_otps')
      .select('email', { count: 'exact', head: true })
    dbRows = count
  } catch { /* ignore */ }
  res.json({ ok: true, memory_pending: STORE.size, db_pending: dbRows })
})

export default router
