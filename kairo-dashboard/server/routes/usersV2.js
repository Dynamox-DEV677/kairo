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
import { joinedSchoolEmail }                    from '../services/welcomeEmail.js'
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

    // 6. Create user profile
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('users')
      .insert({
        id:         authUser.id,
        name:       name.trim(),
        role:       effectiveRole,
        school_id:  school.id,
        status:     initialStatus,
        subject:    subject    || null,
        class_name: class_name || null,
        avatar_url: avatarUrl,
      })
      .select('id, name, role, status, school_id, subject, class_name, avatar_url, created_at')
      .single()

    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.id)
      throw new Error(profileErr.message)
    }

    // 6. Sign in for immediate session
    const { data: signInData } = await supabaseAdmin.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    const autoPromoted = isFirstMember && role !== 'admin'
    console.log(`[Users] ✓ Registered: ${name} (${effectiveRole}, ${initialStatus}) → ${school.school_name}${autoPromoted ? ' [auto-promoted to admin]' : ''}`)

    // Welcome email — fire and forget
    joinedSchoolEmail({
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
