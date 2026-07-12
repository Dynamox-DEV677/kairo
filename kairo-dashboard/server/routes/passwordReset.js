
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
  return `${process.env.ENCRYPTION_SECRET || 'kairo-default-secret'}::password-reset`
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

router.post('/forgot-password', async (req, res) => {
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
})

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
})

export default router
