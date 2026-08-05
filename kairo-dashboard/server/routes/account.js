import { Router } from 'express'
import { sendPasscodeOtpEmail } from '../email/index.js'
import { supabaseAdmin, SUPABASE_CONFIGURED } from '../services/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const _codes = new Map()
const TTL_MS = 10 * 60 * 1000

// Codes are keyed by email and only removed on success, so an abandoned
// request would sit in memory for the life of the warm instance.
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of _codes) if (now > v.expires) _codes.delete(k)
}, 5 * 60 * 1000).unref?.()

function newCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

router.post('/email-change/request', async (req, res) => {
  const email = (req.body?.new_email || '').toString().trim().toLowerCase()
  const name  = (req.body?.name || '').toString().slice(0, 60)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' })
  }
  const code = newCode()
  _codes.set(email, { code, expires: Date.now() + TTL_MS })
  try {
    await sendPasscodeOtpEmail({ to: email, name, code, expiresInMinutes: 10 })
    res.json({ ok: true, sent: true })
  } catch (e) {
    console.error('[account] otp send failed:', e.message)
    res.status(502).json({ error: 'Could not send the code — email service unavailable.' })
  }
})

// SECURITY: this endpoint reassigns a login email, so it must be authenticated
// and it must act on the CALLER. It previously took `user_id` from the request
// body with no auth at all: an attacker could request a code to their own
// address, verify it, pass a victim's user_id, and take over that account.
router.post('/email-change/verify', requireAuth, async (req, res) => {
  const email = (req.body?.new_email || '').toString().trim().toLowerCase()
  const code  = (req.body?.code || '').toString().trim()
  // Identity comes from the verified token only — never from the body.
  const userId = (req.user?.sub || req.user?.id || '').toString().trim()
  if (!userId) return res.status(401).json({ error: 'Could not identify your account — sign in again.' })

  const entry = _codes.get(email)
  if (!entry) return res.status(400).json({ error: 'No code requested for this email (or it expired) — request a new one.' })
  if (Date.now() > entry.expires) {
    _codes.delete(email)
    return res.status(400).json({ error: 'Code expired — request a new one.' })
  }
  if (entry.code !== code) return res.status(400).json({ error: 'Wrong code — check the 6 digits and try again.' })
  _codes.delete(email)

  let authUpdated = false
  if (SUPABASE_CONFIGURED && userId) {
    try {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email, email_confirm: true,
      })
      authUpdated = !error
      if (error) console.warn('[account] auth email update:', error.message)
    } catch (e) {
      console.warn('[account] auth email update threw:', e.message)
    }
  }
  res.json({ ok: true, verified: true, authUpdated })
})

export default router
