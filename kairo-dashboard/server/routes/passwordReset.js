
import { Router } from 'express'
import jwt        from 'jsonwebtoken'
import { supabaseAdmin, requireSupabase } from '../services/supabase.js'
import { getClientIp } from '../middleware/schoolAuth.js'
import { sendPasswordResetEmail } from '../email/index.js'
import { appUrl } from '../email/theme.js'

const router = Router()
router.use(requireSupabase)

const TOKEN_TTL_MIN = Math.max(5, parseInt(process.env.RESET_TOKEN_TTL_MINUTES || '30', 10) || 30)

/**
 * Password-reset tokens are signed with this. The old fallback,
 * 'kairo-default-secret', is a literal string in the repository — with the env
 * var unset, anyone who read the source could forge a reset token for any
 * email address and take over the account. Account recovery is exactly the
 * path that must never be guessable.
 *
 * Throws rather than defaulting. Callers turn it into a 503, so reset is
 * unavailable instead of being available to everyone.
 */
function resetSecret() {
  const s = process.env.ENCRYPTION_SECRET
  if (!s || s.length < 32) {
    throw new Error('ENCRYPTION_SECRET is not configured — refusing to sign a reset token.')
  }
  return `${s}::password-reset`
}

/** Wraps a handler so a missing secret is a clean 503, not a 500 stack. */
function needsSecret(handler) {
  return async (req, res, next) => {
    try {
      resetSecret()
    } catch {
      return res.status(503).json({
        error: {
          code: 'RESET_UNAVAILABLE',
          message: 'Password reset is temporarily unavailable. Please contact support.',
        },
      })
    }
    return handler(req, res, next)
  }
}

function signResetToken({ userId, email, passwordChangedAt }) {
  return jwt.sign(
    {
      sub:    userId,
      email,
      pcat:   passwordChangedAt || 0,
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

async function findAuthUser(email) {
  let page = 1
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 })
    if (error || !data?.users?.length) return null
    const hit = data.users.find(u => (u.email || '').toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (data.users.length < 200) return null
    page += 1
    if (page > 50) return null
  }
}

router.post('/forgot-password', needsSecret(async (req, res) => {
  const rawEmail = (req.body?.email || '').trim().toLowerCase()
  const clientIp  = getClientIp(req)
  const userAgent = req.headers['user-agent'] || ''

  const genericOk = { message: 'If an account exists for that email, a reset link is on its way.' }

  if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return res.json(genericOk)
  }

  try {
    const authUser = await findAuthUser(rawEmail)
    if (!authUser) {
      console.log(`[password-reset] no-op: no account for ${rawEmail}`)
      return res.json(genericOk)
    }

    let name = null
    try {
      const { data: profile } = await supabaseAdmin
        .from('users')
        .select('name')
        .eq('id', authUser.id)
        .maybeSingle()
      name = profile?.name || null
    } catch {  }

    const pcat = authUser.updated_at ? Date.parse(authUser.updated_at) : Date.now()

    const token    = signResetToken({ userId: authUser.id, email: rawEmail, passwordChangedAt: pcat })
    const resetUrl = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`

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
    return res.json(genericOk)
  }
}))

router.post('/reset-password', needsSecret(async (req, res) => {
  const { token, password } = req.body || {}

  if (!token)    return res.status(400).json({ error: 'Reset token is required.' })
  if (!password) return res.status(400).json({ error: 'New password is required.' })
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' })
  }

  const decoded = verifyResetToken(token)
  if (!decoded) return res.status(401).json({ error: 'Reset link is invalid or has expired. Request a new one.' })

  try {
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(decoded.sub)
    const authUser = authData?.user
    if (!authUser) return res.status(404).json({ error: 'Account not found.' })

    const currentPcat = authUser.updated_at ? Date.parse(authUser.updated_at) : 0
    if (decoded.pcat && currentPcat && currentPcat > decoded.pcat + 1000) {
      return res.status(401).json({ error: 'This reset link has already been used. Request a new one if needed.' })
    }

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
}))

export default router
