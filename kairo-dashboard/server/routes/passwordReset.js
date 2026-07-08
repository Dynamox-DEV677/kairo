/**
 * Password Reset routes.
 *
 *   POST /api/users/forgot-password    Generate a reset link, email it to user
 *   POST /api/users/reset-password     Verify token + set new password
 *
 * Token strategy: JWT signed with `ENCRYPTION_SECRET`.
 *   - Self-contained → no DB table to add, works under Vercel serverless.
 *   - Includes `iat`, so a token issued before the user's most recent
 *     password change is rejected. This gives us cheap one-time-use without
 *     a "used_tokens" table.
 *   - Default expiry: 30 minutes. Override via RESET_TOKEN_TTL_MINUTES.
 *
 * Security posture:
 *   - `forgot-password` always returns 200 regardless of whether the email
 *     exists in our system — anti-enumeration.
 *   - Rate-limited via the shared `apiLimiter` middleware mounted in app.js.
 *   - The reset URL only carries the JWT; the token never appears in logs
 *     unless `[email] FAILED` is hit, in which case Nodemailer surfaces it.
 */

import { Router } from 'express'
import jwt        from 'jsonwebtoken'
import { supabaseAdmin, requireSupabase } from '../services/supabase.js'
import { getClientIp } from '../middleware/schoolAuth.js'
import { sendPasswordResetEmail } from '../email/index.js'
import { appUrl } from '../email/theme.js'

const router = Router()
router.use(requireSupabase)

const TOKEN_TTL_MIN = Math.max(5, parseInt(process.env.RESET_TOKEN_TTL_MINUTES || '30', 10) || 30)

function resetSecret() {
  // Derive the JWT signing key from ENCRYPTION_SECRET so we don't need a new
  // env var. The literal-string suffix scopes the key to this purpose so it
  // can't be replayed against anything else that signs with ENCRYPTION_SECRET.
  return `${process.env.ENCRYPTION_SECRET || 'kairo-default-secret'}::password-reset`
}

function signResetToken({ userId, email, passwordChangedAt }) {
  return jwt.sign(
    {
      sub:    userId,
      email,
      pcat:   passwordChangedAt || 0,  // password-changed-at timestamp at issue time
      kind:  'pwd-reset',
    },
    resetSecret(),
    { expiresIn: `${TOKEN_TTL_MIN}m`, algorithm: 'HS256' }
  )
}

function verifyResetToken(token) {
  try {
    const decoded = jwt.verify(token, resetSecret(), { algorithms: ['HS256'] })
    if (decoded.kind !== 'pwd-reset') return null
    return decoded
  } catch {
    return null
  }
}

/**
 * Look up a Supabase auth user by email. Returns `{ id, email, last_sign_in_at,
 * updated_at }` or null if not found.
 */
async function findAuthUser(email) {
  // Supabase admin doesn't have a "lookup by email" helper — we paginate.
  // For Kora's current scale this is acceptable; bump page size if needed.
  let page = 1
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 })
    if (error || !data?.users?.length) return null
    const hit = data.users.find(u => (u.email || '').toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (data.users.length < 200) return null
    page += 1
    if (page > 50) return null   // safety cap
  }
}

// ── POST /api/users/forgot-password ────────────────────────────────────────
// Always returns 200 — never reveals whether the email exists.
router.post('/forgot-password', async (req, res) => {
  const rawEmail = (req.body?.email || '').trim().toLowerCase()
  const clientIp  = getClientIp(req)
  const userAgent = req.headers['user-agent'] || ''

  // Always respond with the same generic message
  const genericOk = { message: 'If an account exists for that email, a reset link is on its way.' }

  if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    // Still 200 — anti-enumeration
    return res.json(genericOk)
  }

  try {
    const authUser = await findAuthUser(rawEmail)
    if (!authUser) {
      console.log(`[password-reset] no-op: no account for ${rawEmail}`)
      return res.json(genericOk)
    }

    // Look up the user's display name from our profile table (best effort)
    let name = null
    try {
      const { data: profile } = await supabaseAdmin
        .from('users')
        .select('name')
        .eq('id', authUser.id)
        .maybeSingle()
      name = profile?.name || null
    } catch { /* ignore */ }

    // Use updated_at (Supabase bumps it on password change) as the pcat baseline.
    const pcat = authUser.updated_at ? Date.parse(authUser.updated_at) : Date.now()

    const token    = signResetToken({ userId: authUser.id, email: rawEmail, passwordChangedAt: pcat })
    const resetUrl = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`

    // Fire-and-forget — don't make the user wait on SMTP
    sendPasswordResetEmail({
      to:                rawEmail,
      name,
      resetUrl,
      expiresInMinutes:  TOKEN_TTL_MIN,
      ip:                clientIp || null,
      userAgent,
      time:              new Date(),
    }).catch(() => {})

    console.log(`[password-reset] sent for ${rawEmail} (token expires in ${TOKEN_TTL_MIN} min)`)
    return res.json(genericOk)
  } catch (e) {
    console.error('[password-reset] error:', e.message)
    // Still 200 — leaking errors here would enable enumeration
    return res.json(genericOk)
  }
})

// ── POST /api/users/reset-password ─────────────────────────────────────────
// Verify the token, set a new password via Supabase admin API.
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body || {}

  if (!token)    return res.status(400).json({ error: 'Reset token is required.' })
  if (!password) return res.status(400).json({ error: 'New password is required.' })
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' })
  }

  const decoded = verifyResetToken(token)
  if (!decoded) return res.status(401).json({ error: 'Reset link is invalid or has expired. Request a new one.' })

  try {
    // Check that the password hasn't been changed since the token was issued.
    // If it has, the token's `pcat` is older than the user's current updated_at.
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(decoded.sub)
    const authUser = authData?.user
    if (!authUser) return res.status(404).json({ error: 'Account not found.' })

    const currentPcat = authUser.updated_at ? Date.parse(authUser.updated_at) : 0
    if (decoded.pcat && currentPcat && currentPcat > decoded.pcat + 1000) {
      // Token was issued BEFORE the most recent password change → used already / stale.
      return res.status(401).json({ error: 'This reset link has already been used. Request a new one if needed.' })
    }

    // Apply the new password
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(decoded.sub, {
      password,
    })
    if (updateErr) throw new Error(updateErr.message)

    console.log(`[password-reset] ✓ password reset for ${decoded.email}`)
    return res.json({ message: 'Password updated. You can now sign in with your new password.' })
  } catch (e) {
    console.error('[password-reset/reset] error:', e.message)
    return res.status(500).json({ error: 'Could not reset password. Try requesting a new link.' })
  }
})

export default router
