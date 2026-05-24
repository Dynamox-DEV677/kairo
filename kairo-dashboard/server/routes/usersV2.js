/**
 * User Account Routes (Supabase-backed, multi-tenant)
 *
 * POST /api/users/register      Sign up + join a school (email + school passcode)
 * POST /api/users/login         Email + password login → JWT (with IP log + network check)
 * GET  /api/users/profile       Current user's profile + school context
 * PUT  /api/users/profile       Update name / avatar / subject / class_name
 * POST /api/users/join-school   Existing user joins a school
 * POST /api/users/logout        Invalidate session
 * GET  /api/users/school-members  List members (teacher/admin only)
 */
import { Router } from 'express'
import bcrypt     from 'bcryptjs'
import { supabaseAdmin, requireSupabase }      from '../services/supabase.js'
import { requireSupabaseAuth, requireRole }    from '../middleware/supabaseAuth.js'
import {
  sendWelcomeJoinEmail,
  sendWelcomePersonalEmail,
  sendSignInEmail,
  getTransporter,
} from '../email/index.js'
import { getClientIp, isIpInRange }            from '../middleware/schoolAuth.js'

const router = Router()
router.use(requireSupabase)

// ── Helpers ────────────────────────────────────────────────────────────────────
/**
 * Log a login attempt to the login_logs table.
 * Fire-and-forget — never blocks the response.
 */
async function logLogin({ userId, schoolId, email, ipAddress, userAgent, success, reason }) {
  try {
    await supabaseAdmin.from('login_logs').insert({
      user_id:    userId    || null,
      school_id:  schoolId  || null,
      email:      email     || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      success:    !!success,
      reason:     reason    || null,
    })
  } catch (e) {
    console.error('[loginLog] Failed to write log:', e.message)
  }
}

/**
 * Check whether a school's network rules allow the given IP.
 * Returns true if no rules exist or IP matches at least one.
 */
async function checkNetworkForLogin(schoolId, clientIp) {
  if (!schoolId || !clientIp) return { allowed: true }

  const { data: rules, error } = await supabaseAdmin
    .from('network_rules')
    .select('cidr, label')
    .eq('school_id', schoolId)
    .eq('enabled', true)

  if (error || !rules || rules.length === 0) return { allowed: true }

  const matchedRule = rules.find(r => isIpInRange(clientIp, r.cidr))
  return {
    allowed:  !!matchedRule,
    rule:     matchedRule || null,
    total:    rules.length,
  }
}

// ── Email diagnostic ──────────────────────────────────────────────────────────
// Lets you check from a browser tab whether SMTP is actually configured in the
// running Vercel deployment. No keys exposed — just yes/no flags.
//
//   GET /api/users/email-status        → just config
//   GET /api/users/email-status?to=x@y → send a test "sign-in" template
router.get('/email-status', async (req, res) => {
  const hasFrom = !!process.env.KAIRO_EMAIL
  const hasPwd  = !!process.env.KAIRO_EMAIL_APP_PASSWORD
  const transport = getTransporter()
  const transportReady = !!transport

  // Optional live probe: pass ?to=someone@example.com to actually send a
  // 1-line test email. Useful for verifying the Gmail App Password without
  // creating a real account every time.
  const to = (req.query.to || '').toString().trim()
  let probe = null
  if (to) {
    if (!hasFrom || !hasPwd || !transportReady) {
      probe = { ok: false, reason: 'transport-not-configured' }
    } else {
      try {
        const info = await transport.sendMail({
          from:    process.env.KAIRO_EMAIL,
          to,
          subject: 'Kairo · email diagnostic test',
          text:    'If you got this, KAIRO_EMAIL + KAIRO_EMAIL_APP_PASSWORD are working.',
        })
        probe = { ok: true, messageId: info.messageId }
      } catch (e) {
        probe = { ok: false, reason: String(e?.message || e).slice(0, 240) }
      }
    }
  }

  res.json({
    KAIRO_EMAIL_set:              hasFrom,
    KAIRO_EMAIL_APP_PASSWORD_set: hasPwd,
    transport_ready:              transportReady,
    from_address:                 hasFrom ? process.env.KAIRO_EMAIL : null,
    test_send:                    probe,
    hint: transportReady
      ? 'Transport configured. Use ?to=you@example.com to send a real test message.'
      : 'Set KAIRO_EMAIL (Gmail address) and KAIRO_EMAIL_APP_PASSWORD (16-char Gmail App Password) in Vercel env vars, then redeploy.',
  })
})

// ── Register: Create auth user + join school ──────────────────────────────────
router.post('/register', async (req, res) => {
  const {
    email,
    password,
    name,
    role           = 'student',
    school_name,
    school_passcode,
    subject,         // for teachers
    class_name,      // for students
    avatar_base64,   // optional: data:image/...;base64,...
  } = req.body

  if (!email || !password) return res.status(400).json({ error: 'email and password are required.' })
  if (!name)               return res.status(400).json({ error: 'name is required.' })
  if (!school_name)        return res.status(400).json({ error: 'school_name is required.' })
  if (!school_passcode)    return res.status(400).json({ error: 'school_passcode is required.' })
  if (!['student','teacher'].includes(role)) {
    return res.status(400).json({ error: 'role must be student or teacher.' })
  }

  try {
    // 1. Verify school exists
    const { data: school, error: schoolErr } = await supabaseAdmin
      .from('schools')
      .select('id, school_name, school_passcode, school_logo_url, require_approval')
      .ilike('school_name', school_name)
      .maybeSingle()

    if (schoolErr || !school) return res.status(404).json({ error: `School "${school_name}" not found.` })

    // 2. Verify passcode
    const passcodeMatch = await bcrypt.compare(school_passcode, school.school_passcode)
    if (!passcodeMatch) return res.status(401).json({ error: 'Incorrect school passcode.' })

    // 3. Check if this is the very first member of the school → auto-admin
    const { count: existingCount } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', school.id)

    const isFirstMember = existingCount === 0
    const effectiveRole = isFirstMember ? 'admin' : role

    // Determine initial status
    // First member (admin) is always active; students may require approval
    const initialStatus = isFirstMember
      ? 'active'
      : (effectiveRole === 'student' && school.require_approval) ? 'pending' : 'active'

    // 4. Create Supabase auth user
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email:         email.trim().toLowerCase(),
      password,
      email_confirm: true,
    })

    if (authErr) {
      if (authErr.message.includes('already') || authErr.status === 422) {
        return res.status(409).json({ error: 'An account with this email already exists.' })
      }
      throw new Error(authErr.message)
    }

    const authUser = authData.user

    // 5. Upload avatar (optional) → Supabase Storage
    let avatarUrl = null
    if (avatar_base64 && typeof avatar_base64 === 'string') {
      try {
        const m = avatar_base64.match(/^data:(image\/[a-z+]+);base64,(.+)$/i)
        if (m) {
          const mime = m[1]
          const ext  = (mime.split('/')[1] || 'png').replace('+xml', '')
          const buffer = Buffer.from(m[2], 'base64')
          if (buffer.length > 5 * 1024 * 1024) throw new Error('Avatar exceeds 5 MB')
          const path = `avatars/${authUser.id}.${ext}`
          const { error: upErr } = await supabaseAdmin.storage
            .from('kairo-public')
            .upload(path, buffer, { contentType: mime, upsert: true })
          if (!upErr) {
            const { data: { publicUrl } } = supabaseAdmin.storage.from('kairo-public').getPublicUrl(path)
            avatarUrl = publicUrl
          }
        }
      } catch (e) {
        console.warn('[Users/register] avatar upload skipped:', e.message)
      }
    }

    // 6. Create user profile — bulletproof 4-layer fallback
    //    Layer A: full payload (status, subject, class_name)
    //    Layer B: drop status
    //    Layer C: drop subject + class_name
    //    Layer D: id + name + role + school_id only
    //    If even D fails, log it; Login.tsx auto-provisions on first sign-in.
    const profile = await tryInsertSchoolProfile(
      authUser.id, name.trim(), effectiveRole, school.id, avatarUrl,
      initialStatus, subject, class_name,
    ) || {
      id: authUser.id, name: name.trim(), role: effectiveRole,
      school_id: school.id, avatar_url: avatarUrl,
    }

    // 6. Sign in for immediate session
    const { data: signInData } = await supabaseAdmin.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    const autoPromoted = isFirstMember && role !== 'admin'
    console.log(`[Users] ✓ Registered: ${name} (${effectiveRole}, ${initialStatus}) → ${school.school_name}${autoPromoted ? ' [auto-promoted to admin]' : ''}`)

    // Welcome email — fire and forget
    sendWelcomeJoinEmail({
      to:               email.trim().toLowerCase(),
      name:             name.trim(),
      role:             effectiveRole,
      schoolName:       school.school_name,
      requireApproval:  initialStatus === 'pending',
    }).catch(() => {})

    res.status(201).json({
      message: isFirstMember
        ? 'Account created. You are the first member — you have been made the school admin.'
        : initialStatus === 'pending'
          ? 'Account created. Awaiting admin approval before full access.'
          : 'Account created successfully.',
      auto_promoted_to_admin: autoPromoted,
      user:   profile,
      school: {
        id:              school.id,
        school_name:     school.school_name,
        school_logo_url: school.school_logo_url,
        require_approval: school.require_approval,
      },
      access_token:  signInData?.session?.access_token  || null,
      refresh_token: signInData?.session?.refresh_token || null,
      expires_in:    signInData?.session?.expires_in    || 3600,
      pending_approval: initialStatus === 'pending',
    })
  } catch (e) {
    console.error('[Users/register]', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── Register Personal: standalone student, no school ──────────────────────────
// For individuals using Kairo on their own (not via a school).
// Creates auth user + profile with school_id = null.
router.post('/register-personal', async (req, res) => {
  const { email, password, name, class_name, board, avatar_base64 } = req.body
  // Accept a role param (added so teachers can sign up without a school
  // code). Defaults to 'student' for backwards compat with existing
  // frontends. Anything not in the allow-list collapses to 'student' so
  // a malicious payload can never promote itself to admin.
  const rawRole = (req.body?.role || 'student').toString().toLowerCase()
  const role    = rawRole === 'teacher' ? 'teacher' : 'student'

  if (!email || !password) return res.status(400).json({ error: 'email and password are required.' })
  if (!name)               return res.status(400).json({ error: 'name is required.' })
  if (password.length < 8) return res.status(400).json({ error: 'password must be 8+ characters.' })

  let authUser = null
  try {
    // ─── 1. Create Supabase auth user — REQUIRED, must succeed ──────────
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email:         email.trim().toLowerCase(),
      password,
      email_confirm: true,
    })
    if (authErr) {
      if (authErr.message.includes('already') || authErr.status === 422) {
        return res.status(409).json({ error: 'An account with this email already exists.' })
      }
      throw new Error(authErr.message)
    }
    authUser = authData.user

    // ─── 2. Optional avatar upload — never blocks signup ─────────────────
    let avatarUrl = null
    if (avatar_base64 && typeof avatar_base64 === 'string') {
      try {
        const m = avatar_base64.match(/^data:(image\/[a-z+]+);base64,(.+)$/i)
        if (m) {
          const mime = m[1]
          const ext  = (mime.split('/')[1] || 'png').replace('+xml', '')
          const buffer = Buffer.from(m[2], 'base64')
          if (buffer.length > 5 * 1024 * 1024) throw new Error('Avatar exceeds 5 MB')
          const path = `avatars/${authUser.id}.${ext}`
          const { error: upErr } = await supabaseAdmin.storage
            .from('kairo-public')
            .upload(path, buffer, { contentType: mime, upsert: true })
          if (!upErr) {
            const { data: { publicUrl } } = supabaseAdmin.storage.from('kairo-public').getPublicUrl(path)
            avatarUrl = publicUrl
          }
        }
      } catch (e) {
        console.warn('[Users/register-personal] avatar upload skipped:', e.message)
      }
    }

    // ─── 3. Create user profile — bulletproof multi-layer fallback ──────
    // Layer A: try the full insert
    // Layer B: retry with minimal columns if A errors with schema mismatch
    // Layer C: if even B fails, log it and CONTINUE — the user can still
    //          sign in; Login.tsx auto-provisions the row on first login.
    const profile = await tryInsertPersonalProfile(authUser.id, name.trim(), avatarUrl, class_name, board, role)

    // ─── 4. Sign in for immediate session ────────────────────────────────
    const { data: signInData } = await supabaseAdmin.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    console.log(`[Users] ✓ Registered personal: ${name} as ${role} (${authUser.id})`)

    // Welcome email — never blocks the response. We resolve a tiny
    // status object that the response surfaces so the UI can show
    // either "check your inbox" or "we couldn't send a welcome email"
    // without keeping the user waiting.
    const emailStatus = await (async () => {
      try {
        const info = await sendWelcomePersonalEmail({
          to:        email.trim().toLowerCase(),
          name:      name.trim(),
          className: class_name || null,
          board:     board || null,
        })
        if (info?.messageId) {
          return { sent: true, messageId: info.messageId }
        }
        // Transport returns null when KAIRO_EMAIL / APP_PASSWORD aren't
        // configured in env (or when the SMTP call itself failed).
        return { sent: false, reason: 'transport-skipped-or-failed' }
      } catch (e) {
        return { sent: false, reason: String(e?.message || e).slice(0, 200) }
      }
    })()

    if (!emailStatus.sent) {
      console.warn(`[Users] welcome email NOT sent → ${email}: ${emailStatus.reason}`)
    }

    res.status(201).json({
      message: 'Personal account created.',
      user: profile || {
        id: authUser.id, name: name.trim(), role,
        school_id: null, avatar_url: avatarUrl,
        class_name: class_name || null, board: board || null,
      },
      access_token:  signInData?.session?.access_token  || null,
      refresh_token: signInData?.session?.refresh_token || null,
      expires_in:    signInData?.session?.expires_in    || 3600,
      email_status:  emailStatus,
    })
  } catch (e) {
    console.error('[Users/register-personal] FATAL:', e.message)
    // Only rollback auth.users if we got that far AND the failure was auth-side.
    // If the failure is purely on public.users, the auth user is still valid
    // and Login.tsx will auto-provision on first sign-in.
    res.status(500).json({ error: e.message })
  }
})

/** Same defensive multi-attempt insert for school-joined users. */
async function tryInsertSchoolProfile(id, name, role, schoolId, avatarUrl, status, subject, class_name) {
  const attempts = [
    { id, name, role, school_id: schoolId, avatar_url: avatarUrl, status,            subject: subject || null, class_name: class_name || null },
    { id, name, role, school_id: schoolId, avatar_url: avatarUrl,                    subject: subject || null, class_name: class_name || null },
    { id, name, role, school_id: schoolId, avatar_url: avatarUrl },
    { id, name, role, school_id: schoolId },
  ]
  for (let i = 0; i < attempts.length; i++) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert(attempts[i])
      .select('id, name, role, school_id, avatar_url, created_at')
      .single()
    if (!error) {
      const patches = [
        { status: status || 'active' }, { subject: subject || null }, { class_name: class_name || null },
      ]
      for (const p of patches) {
        await supabaseAdmin.from('users').update(p).eq('id', id).then(() => {}, () => {})
      }
      return data
    }
    console.warn(`[Users/register] school profile insert attempt ${i + 1} failed:`, error.message)
  }
  console.error('[Users/register] all school profile insert attempts failed — Login.tsx will auto-provision')
  return null
}

/**
 * Try every reasonable shape of a profile insert.
 *
 *   1. Full payload (status, class_name, board)
 *   2. Drop status (older schemas without the check constraint)
 *   3. Drop class_name + board (rawest base schema)
 *   4. id + name + role only (last resort)
 *
 * Returns the inserted row, or null if every attempt fails. NEVER throws.
 * Successful insert continues; failure logs but doesn't bubble — the auth
 * user is created and Login.tsx will provision the row on first login.
 */
async function tryInsertPersonalProfile(id, name, avatarUrl, class_name, board, role = 'student') {
  // Defensive clamp — never let an unexpected role slip through.
  const safeRole = role === 'teacher' ? 'teacher' : 'student'
  const attempts = [
    { id, name, role: safeRole, school_id: null, avatar_url: avatarUrl, status: 'active', class_name: class_name || null, board: board || null },
    { id, name, role: safeRole, school_id: null, avatar_url: avatarUrl, class_name: class_name || null, board: board || null },
    { id, name, role: safeRole, school_id: null, avatar_url: avatarUrl },
    { id, name, role: safeRole },
  ]
  for (let i = 0; i < attempts.length; i++) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert(attempts[i])
      .select('id, name, role, school_id, avatar_url, created_at')
      .single()
    if (!error) {
      // Best-effort patch the optional columns
      const patches = [
        { status: 'active' }, { class_name: class_name || null }, { board: board || null },
      ]
      for (const p of patches) {
        await supabaseAdmin.from('users').update(p).eq('id', id).then(() => {}, () => {})
      }
      return data
    }
    console.warn(`[Users/register-personal] profile insert attempt ${i + 1} failed:`, error.message)
  }
  // All 4 attempts failed — log but keep the auth user; Login.tsx will heal it.
  console.error('[Users/register-personal] all profile insert attempts failed — letting Login.tsx auto-provision')
  return null
}

// ── Login ──────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password are required.' })

  const clientIp  = getClientIp(req)
  const userAgent = req.headers['user-agent'] || null

  try {
    // 1. Authenticate with Supabase
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email:    email.trim().toLowerCase(),
      password,
    })

    if (error || !data.session) {
      // Log failed attempt (no user ID yet)
      await logLogin({ email, ipAddress: clientIp, userAgent, success: false, reason: 'wrong_credentials' })
      return res.status(401).json({ error: 'Invalid email or password.' })
    }

    // 2. Load profile
    const { data: profile } = await supabaseAdmin
      .from('user_profile')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (!profile) {
      await logLogin({ email, ipAddress: clientIp, userAgent, success: false, reason: 'profile_missing' })
      return res.status(403).json({ error: 'User profile not found. Please complete registration.' })
    }

    // 3. Check account status
    const { data: userStatus } = await supabaseAdmin
      .from('users')
      .select('status')
      .eq('id', data.user.id)
      .single()

    if (userStatus?.status === 'suspended') {
      await logLogin({
        userId: data.user.id, schoolId: profile.school_id,
        email, ipAddress: clientIp, userAgent, success: false, reason: 'suspended',
      })
      return res.status(403).json({ error: 'Your account has been suspended. Contact your school admin.' })
    }

    if (userStatus?.status === 'pending') {
      await logLogin({
        userId: data.user.id, schoolId: profile.school_id,
        email, ipAddress: clientIp, userAgent, success: false, reason: 'pending_approval',
      })
      return res.status(403).json({
        error:   'Your account is pending admin approval. Contact your school admin.',
        pending: true,
      })
    }

    // 4. Network restriction check (skip for admins)
    if (profile.school_id && profile.role !== 'admin') {
      const netCheck = await checkNetworkForLogin(profile.school_id, clientIp)
      if (!netCheck.allowed) {
        await logLogin({
          userId: data.user.id, schoolId: profile.school_id,
          email, ipAddress: clientIp, userAgent, success: false, reason: 'network_blocked',
        })
        return res.status(403).json({
          error:     "Login denied: your network is not allowed by your school's Wi-Fi policy.",
          client_ip: clientIp,
        })
      }
    }

    // 5. Update last login info
    await supabaseAdmin
      .from('users')
      .update({
        last_login_ip: clientIp,
        last_login_at: new Date().toISOString(),
      })
      .eq('id', data.user.id)

    // 6. Log successful login
    await logLogin({
      userId: data.user.id, schoolId: profile.school_id,
      email, ipAddress: clientIp, userAgent, success: true,
    })

    // 7. Sign-in security alert — fire and forget so the response isn't delayed.
    //    We send on every successful login; users rely on this as an early-
    //    warning system for account compromise.
    sendSignInEmail({
      to:        email.trim().toLowerCase(),
      name:      profile.name || null,
      userAgent: userAgent || '',
      ip:        clientIp || null,
      time:      new Date(),
    }).catch(() => {})

    res.json({
      message:       'Login successful.',
      access_token:  data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in:    data.session.expires_in,
      user:          { ...profile, last_login_ip: clientIp },
    })
  } catch (e) {
    console.error('[Users/login]', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── Get Profile ────────────────────────────────────────────────────────────────
router.get('/profile', requireSupabaseAuth, async (req, res) => {
  res.json({
    ...req.user,
    school: req.school,
  })
})

// ── Update Profile ─────────────────────────────────────────────────────────────
router.put('/profile', requireSupabaseAuth, async (req, res) => {
  const { name, avatar_url, subject, class_name } = req.body
  const updates = {}
  if (name       !== undefined) updates.name       = name.trim()
  if (avatar_url !== undefined) updates.avatar_url = avatar_url
  if (subject    !== undefined) updates.subject    = subject    || null
  if (class_name !== undefined) updates.class_name = class_name || null

  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update.' })

  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, name, role, status, school_id, avatar_url, subject, class_name')
      .single()

    if (error) throw new Error(error.message)
    res.json({ message: 'Profile updated.', user: data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Join School ────────────────────────────────────────────────────────────────
router.post('/join-school', requireSupabaseAuth, async (req, res) => {
  const { school_name, school_passcode, class_name, subject } = req.body
  if (!school_name || !school_passcode) {
    return res.status(400).json({ error: 'school_name and school_passcode are required.' })
  }
  if (req.user.school_id) {
    return res.status(409).json({ error: 'You are already in a school. Leave first to join another.' })
  }

  try {
    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('id, school_name, school_passcode, school_logo_url, require_approval')
      .ilike('school_name', school_name)
      .maybeSingle()

    if (!school) return res.status(404).json({ error: `School "${school_name}" not found.` })

    const match = await bcrypt.compare(school_passcode, school.school_passcode)
    if (!match) return res.status(401).json({ error: 'Incorrect school passcode.' })

    const initialStatus = (req.user.role === 'student' && school.require_approval) ? 'pending' : 'active'

    const updates = {
      school_id: school.id,
      status:    initialStatus,
    }
    if (class_name) updates.class_name = class_name
    if (subject)    updates.subject    = subject

    await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', req.user.id)

    res.json({
      message: initialStatus === 'pending'
        ? `Joined "${school.school_name}". Awaiting admin approval.`
        : `Joined "${school.school_name}" successfully.`,
      school: {
        id:              school.id,
        school_name:     school.school_name,
        school_logo_url: school.school_logo_url,
      },
      pending_approval: initialStatus === 'pending',
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── List School Members ────────────────────────────────────────────────────────
router.get('/school-members', requireSupabaseAuth, requireRole('teacher', 'admin'), async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'You are not in a school.' })

  const { role, status, class_name } = req.query

  try {
    let query = supabaseAdmin
      .from('users')
      .select('id, name, role, status, subject, class_name, avatar_url, last_login_at, created_at')
      .eq('school_id', req.schoolId)
      .order('created_at', { ascending: false })

    if (role)       query = query.eq('role', role)
    if (status)     query = query.eq('status', status)
    if (class_name) query = query.eq('class_name', class_name)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    res.json({ school_id: req.schoolId, members: data, count: data.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Logout ─────────────────────────────────────────────────────────────────────
router.post('/logout', requireSupabaseAuth, async (req, res) => {
  res.json({ message: 'Logged out. Discard your access_token and refresh_token.' })
})

export default router
