/**
 * Account routes — profile changes that need server help.
 *
 *   POST /api/account/email-change/request  { new_email, name? }
 *        → emails a 6-digit code to the NEW address (proves ownership)
 *   POST /api/account/email-change/verify   { new_email, code, user_id? }
 *        → checks the code; when Supabase admin is configured and a
 *          user_id is supplied, updates the auth user's email too.
 *
 * Codes live in instance memory with a 10-minute TTL — fine for a
 * warm Vercel window; a cold start just means "request a new code".
 */
import { Router } from 'express'
import { sendPasscodeOtpEmail } from '../email/index.js'
import { supabaseAdmin, SUPABASE_CONFIGURED } from '../services/supabase.js'

const router = Router()

const _codes = new Map()   // email(lower) -> { code, expires }
const TTL_MS = 10 * 60 * 1000

function newCode() {
  return String(Math.floor(100000 + Math.random() * 900000))   // 6 digits
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

router.post('/email-change/verify', async (req, res) => {
  const email = (req.body?.new_email || '').toString().trim().toLowerCase()
  const code  = (req.body?.code || '').toString().trim()
  const userId = (req.body?.user_id || '').toString().trim()

  const entry = _codes.get(email)
  if (!entry) return res.status(400).json({ error: 'No code requested for this email (or it expired) — request a new one.' })
  if (Date.now() > entry.expires) {
    _codes.delete(email)
    return res.status(400).json({ error: 'Code expired — request a new one.' })
  }
  if (entry.code !== code) return res.status(400).json({ error: 'Wrong code — check the 6 digits and try again.' })
  _codes.delete(email)

  // Best effort: update the Supabase auth user's email (requires the
  // service-role key). Local/anonymous profiles just get ok:true and
  // the frontend updates its stored profile.
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
