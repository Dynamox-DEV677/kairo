import { Router } from 'express'
import crypto from 'crypto'
import { sendPasscodeOtpEmail } from '../email/index.js'
import { supabaseAdmin } from '../services/supabase.js'

const router = Router()

const STORE = new Map()

const OTP_TTL_MS         = 10 * 60 * 1000
const RESEND_COOLDOWN_MS = 30 * 1000
const WINDOW_MS          = 10 * 60 * 1000
const SENDS_PER_WINDOW   = 4
const MAX_ATTEMPTS       = 6

function hashCode(code, email) {
  return crypto.createHash('sha256').update(`${email}::${code}`).digest('hex')
}
function genCode() {
  return String(crypto.randomInt(100000, 1_000_000))
}
function normEmail(s) {
  return String(s || '').trim().toLowerCase()
}
function validEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function isMissingTable(err) {
  const msg = String(err?.message || err || '')
  return /relation .* does not exist/i.test(msg)
       || /could not find .* table/i.test(msg)
       || /schema cache/i.test(msg)
}

async function readRow(email) {
  try {
    const { data, error } = await supabaseAdmin
      .from('kairo_otps')
      .select('email, hash, expires_at, last_sent_at, send_timestamps, attempts_left')
      .eq('email', email)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return STORE.get(email) || null
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
    const row = STORE.get(email)
    if (!row) return null
    if (row.expiresAt < Date.now()) { STORE.delete(email); return null }
    return row
  }
}

async function writeRow(email, row) {
  STORE.set(email, row)
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

router.post('/send-otp', async (req, res) => {
  const email = normEmail(req.body?.email)
  if (!validEmail(email)) {
    return res.status(400).json({ error: 'A valid email is required.' })
  }

  const now = Date.now()
  const existing = (await readRow(email)) || { sendTimestamps: [] }

  existing.sendTimestamps = (existing.sendTimestamps || []).filter(t => t > now - WINDOW_MS)

  if (existing.lastSentAt && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
    const cooldown = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000)
    return res.status(429).json({
      error:    `Slow down — try again in ${cooldown}s.`,
      cooldown,
      ok:       false,
      reason:   'cooldown',
    })
  }

  if (existing.sendTimestamps.length >= SENDS_PER_WINDOW) {
    return res.status(429).json({
      error:  'Too many requests for this email. Wait a few minutes.',
      ok:     false,
      reason: 'window-full',
    })
  }

  const code = genCode()
  const entry = {
    hash:           hashCode(code, email),
    expiresAt:      now + OTP_TTL_MS,
    lastSentAt:     now,
    sendTimestamps: [...existing.sendTimestamps, now],
    attemptsLeft:   MAX_ATTEMPTS,
  }
  await writeRow(email, entry)

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

  await destroyRow(email)
  res.status(200).json({ ok: true })
})

router.get('/health', async (_req, res) => {
  let dbRows = null
  try {
    const { count } = await supabaseAdmin
      .from('kairo_otps')
      .select('email', { count: 'exact', head: true })
    dbRows = count
  } catch {  }
  res.json({ ok: true, memory_pending: STORE.size, db_pending: dbRows })
})

export default router
