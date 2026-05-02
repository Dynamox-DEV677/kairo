/**
 * User Account Routes (Supabase-backed, multi-tenant)
 *
 * POST /api/users/register     Sign up + join a school (email + school passcode)
 * POST /api/users/login        Email + password login → JWT
 * GET  /api/users/profile      Current user's profile + school context
 * PUT  /api/users/profile      Update name / avatar
 * POST /api/users/join-school  Existing user joins a school
 * POST /api/users/logout       Invalidate session
 * GET  /api/users/school-members  List all members in your school (teacher/admin only)
 */
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { supabaseAdmin, requireSupabase } from '../services/supabase.js'
import { requireSupabaseAuth, requireRole } from '../middleware/supabaseAuth.js'

const router = Router()
router.use(requireSupabase)

// ── Register: Create auth user + join school ──────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, name, role = 'student', school_name, school_passcode } = req.body

  if (!email || !password)      return res.status(400).json({ error: 'email and password are required.' })
  if (!name)                    return res.status(400).json({ error: 'name is required.' })
  if (!school_name)             return res.status(400).json({ error: 'school_name is required.' })
  if (!school_passcode)         return res.status(400).json({ error: 'school_passcode is required.' })
  if (!['student','teacher'].includes(role)) return res.status(400).json({ error: 'role must be student or teacher.' })

  try {
    // 1. Verify school exists
    const { data: school, error: schoolErr } = await supabaseAdmin
      .from('schools')
      .select('id, school_name, school_passcode, school_logo_url')
      .ilike('school_name', school_name)
      .maybeSingle()

    if (schoolErr || !school) return res.status(404).json({ error: `School "${school_name}" not found.` })

    // 2. Verify passcode
    const passcodeMatch = await bcrypt.compare(school_passcode, school.school_passcode)
    if (!passcodeMatch) return res.status(401).json({ error: 'Incorrect school passcode.' })

    // 3. Create Supabase auth user
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email:          email.trim().toLowerCase(),
      password,
      email_confirm:  true,   // skip email confirmation for now
    })

    if (authErr) {
      // Handle duplicate email
      if (authErr.message.includes('already') || authErr.status === 422) {
        return res.status(409).json({ error: 'An account with this email already exists.' })
      }
      throw new Error(authErr.message)
    }

    const authUser = authData.user

    // 4. Create user profile
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('users')
      .insert({
        id:        authUser.id,
        name:      name.trim(),
        role,
        school_id: school.id,
      })
      .select('id, name, role, school_id, created_at')
      .single()

    if (profileErr) {
      // Rollback auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.id)
      throw new Error(profileErr.message)
    }

    // 5. Generate a session token for immediate login
    const { data: session, error: sessionErr } = await supabaseAdmin.auth.admin.generateLink({
      type:  'magiclink',
      email: email.trim().toLowerCase(),
    })

    // Sign them in directly
    const { data: signInData } = await supabaseAdmin.auth.signInWithPassword({ email, password })

    console.log(`[Users] ✓ Registered: ${name} (${role}) → ${school.school_name}`)

    res.status(201).json({
      message: 'Account created successfully.',
      user:    profile,
      school: {
        id:             school.id,
        school_name:    school.school_name,
        school_logo_url: school.school_logo_url,
      },
      access_token:  signInData?.session?.access_token  || null,
      refresh_token: signInData?.session?.refresh_token || null,
      expires_in:    signInData?.session?.expires_in    || 3600,
    })
  } catch (e) {
    console.error('[Users/register]', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password are required.' })

  try {
    // Authenticate with Supabase
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email:    email.trim().toLowerCase(),
      password,
    })

    if (error || !data.session) {
      return res.status(401).json({ error: 'Invalid email or password.' })
    }

    // Load profile + school
    const { data: profile } = await supabaseAdmin
      .from('user_profile')   // our view that joins users + schools
      .select('*')
      .eq('id', data.user.id)
      .single()

    res.json({
      message:       'Login successful.',
      access_token:  data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in:    data.session.expires_in,
      user:          profile,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Get Profile ───────────────────────────────────────────────────────────────
router.get('/profile', requireSupabaseAuth, async (req, res) => {
  // req.user + req.school already attached by middleware
  res.json({
    ...req.user,
    school: req.school,
  })
})

// ── Update Profile ────────────────────────────────────────────────────────────
router.put('/profile', requireSupabaseAuth, async (req, res) => {
  const { name, avatar_url } = req.body
  const updates = {}
  if (name)       updates.name       = name.trim()
  if (avatar_url) updates.avatar_url = avatar_url

  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update.' })

  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, name, role, school_id, avatar_url')
      .single()

    if (error) throw new Error(error.message)
    res.json({ message: 'Profile updated.', user: data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Join School (for existing auth users who haven't joined yet) ──────────────
router.post('/join-school', requireSupabaseAuth, async (req, res) => {
  const { school_name, school_passcode } = req.body
  if (!school_name || !school_passcode) return res.status(400).json({ error: 'school_name and school_passcode are required.' })

  // Already in a school?
  if (req.user.school_id) return res.status(409).json({ error: 'You are already in a school. Leave first to join another.' })

  try {
    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('id, school_name, school_passcode, school_logo_url')
      .ilike('school_name', school_name)
      .maybeSingle()

    if (!school) return res.status(404).json({ error: `School "${school_name}" not found.` })

    const match = await bcrypt.compare(school_passcode, school.school_passcode)
    if (!match) return res.status(401).json({ error: 'Incorrect school passcode.' })

    await supabaseAdmin
      .from('users')
      .update({ school_id: school.id })
      .eq('id', req.user.id)

    res.json({
      message: `Joined "${school.school_name}" successfully.`,
      school: { id: school.id, school_name: school.school_name, school_logo_url: school.school_logo_url },
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── List School Members ────────────────────────────────────────────────────────
router.get('/school-members', requireSupabaseAuth, requireRole('teacher', 'admin'), async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'You are not in a school.' })

  const { role } = req.query

  try {
    let query = supabaseAdmin
      .from('users')
      .select('id, name, role, avatar_url, created_at')
      .eq('school_id', req.schoolId)
      .order('created_at', { ascending: false })

    if (role) query = query.eq('role', role)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    res.json({ school_id: req.schoolId, members: data, count: data.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Logout ────────────────────────────────────────────────────────────────────
router.post('/logout', requireSupabaseAuth, async (req, res) => {
  // Supabase JWTs are stateless — actual invalidation happens via refresh token
  // For now we just tell the client to discard tokens
  res.json({ message: 'Logged out. Discard your access_token and refresh_token.' })
})

export default router
