/**
 * School Management Routes
 *
 * Public:
 *   POST  /api/schools/register              Register a new school
 *   GET   /api/schools/by-name/:name         Look up school by name (join flow)
 *   GET   /api/schools/:id                   Get school public info
 *
 * Admin only (requireSchoolAdmin):
 *   POST  /api/schools/:id/regenerate-passcode   Generate new passcode
 *   POST  /api/schools/:id/teachers              Add a teacher account
 *   POST  /api/schools/:id/approve/:userId        Approve a pending student
 *   POST  /api/schools/:id/suspend/:userId        Suspend a member
 *   POST  /api/schools/:id/reinstate/:userId      Reinstate a suspended member
 *   DELETE /api/schools/:id/members/:userId       Remove member from school
 *   POST  /api/schools/:id/upload-logo           Upload school logo
 *
 * Teacher/Admin:
 *   GET   /api/schools/:id/members           List all school members
 *   GET   /api/schools/:id/stats             School dashboard stats
 */
import { Router }   from 'express'
import bcrypt       from 'bcryptjs'
import crypto       from 'crypto'
import { supabaseAdmin, requireSupabase }         from '../services/supabase.js'
import { requireSupabaseAuth }                     from '../middleware/supabaseAuth.js'
import { requireSchoolAdmin, requireTeacherOrAdmin } from '../middleware/schoolAuth.js'

const router = Router()
router.use(requireSupabase)

// ── Register School ────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const {
    school_name,
    school_email,
    school_logo_url,
    domain,
    require_approval = false,
    // Optional: owner account to create alongside
    owner_email,
    owner_password,
    owner_name,
  } = req.body

  if (!school_name)  return res.status(400).json({ error: 'school_name is required.' })
  if (!school_email) return res.status(400).json({ error: 'school_email is required.' })

  try {
    // Check uniqueness
    const { data: existing } = await supabaseAdmin
      .from('schools')
      .select('id')
      .ilike('school_name', school_name)
      .maybeSingle()

    if (existing) return res.status(409).json({ error: `School "${school_name}" is already registered.` })

    // Generate plain passcode — admin can view it later
    const plainPasscode  = generatePasscode()
    const hashedPasscode = await bcrypt.hash(plainPasscode, 12)

    const { data: school, error } = await supabaseAdmin
      .from('schools')
      .insert({
        school_name:      school_name.trim(),
        school_email:     school_email.trim().toLowerCase(),
        school_passcode:  hashedPasscode,
        passcode_plain:   plainPasscode,         // admin-only readable, for sharing
        school_logo_url:  school_logo_url || null,
        domain:           domain          || null,
        require_approval: !!require_approval,
      })
      .select('id, school_name, school_email, school_logo_url, domain, require_approval, created_at')
      .single()

    if (error) throw new Error(error.message)

    let ownerAccount = null

    // If owner credentials provided, create admin account immediately
    if (owner_email && owner_password && owner_name) {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email:         owner_email.trim().toLowerCase(),
        password:      owner_password,
        email_confirm: true,
      })

      if (!authErr && authData?.user) {
        const { data: ownerProfile } = await supabaseAdmin
          .from('users')
          .insert({
            id:        authData.user.id,
            name:      owner_name.trim(),
            role:      'admin',
            school_id: school.id,
            status:    'active',
          })
          .select('id, name, role')
          .single()

        // Set owner_id on school
        await supabaseAdmin
          .from('schools')
          .update({ owner_id: authData.user.id })
          .eq('id', school.id)

        ownerAccount = ownerProfile
      }
    }

    console.log(`[Schools] ✓ Registered: ${school_name} (${school.id})`)

    res.status(201).json({
      message:        'School registered successfully.',
      school_id:      school.id,
      school,
      passcode:       plainPasscode,
      warning:        'Save this passcode securely — it will never be shown again.',
      owner_account:  ownerAccount,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Get School by ID (public info) ────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('schools')
      .select('id, school_name, school_logo_url, school_email, domain, plan, require_approval, created_at')
      .eq('id', req.params.id)
      .single()

    if (error || !data) return res.status(404).json({ error: 'School not found.' })
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Look up school by name ─────────────────────────────────────────────────────
router.get('/by-name/:name', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('schools')
      .select('id, school_name, school_logo_url, school_email, require_approval')
      .ilike('school_name', req.params.name)
      .maybeSingle()

    if (error || !data) return res.status(404).json({ error: 'School not found.' })
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── List Members ───────────────────────────────────────────────────────────────
router.get('/:id/members', requireSupabaseAuth, requireTeacherOrAdmin, async (req, res) => {
  const schoolId = req.params.id
  if (req.schoolId !== schoolId) return res.status(403).json({ error: 'Not your school.' })

  const { role, status, class_name } = req.query

  try {
    let query = supabaseAdmin
      .from('users')
      .select('id, name, role, status, subject, class_name, avatar_url, last_login_at, created_at')
      .eq('school_id', schoolId)
      .order('role', { ascending: true })
      .order('name', { ascending: true })

    if (role)       query = query.eq('role', role)
    if (status)     query = query.eq('status', status)
    if (class_name) query = query.eq('class_name', class_name)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    res.json({ school_id: schoolId, members: data, count: data.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Get Current Passcode (admin-only, for sharing with new joiners) ────────────
router.get('/:id/passcode', requireSupabaseAuth, requireSchoolAdmin, async (req, res) => {
  const schoolId = req.params.id
  if (req.schoolId !== schoolId) return res.status(403).json({ error: 'Not your school.' })

  try {
    const { data, error } = await supabaseAdmin
      .from('schools')
      .select('passcode_plain')
      .eq('id', schoolId)
      .single()

    if (error) throw new Error(error.message)
    if (!data?.passcode_plain) {
      return res.status(404).json({
        error: 'Passcode not stored. Regenerate it to get a new one.',
        regenerate: true,
      })
    }
    res.json({ passcode: data.passcode_plain })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Regenerate Passcode ────────────────────────────────────────────────────────
router.post('/:id/regenerate-passcode', requireSupabaseAuth, requireSchoolAdmin, async (req, res) => {
  const schoolId = req.params.id
  if (req.schoolId !== schoolId) return res.status(403).json({ error: 'Not your school.' })

  try {
    const plainPasscode  = generatePasscode()
    const hashedPasscode = await bcrypt.hash(plainPasscode, 12)

    const { error } = await supabaseAdmin
      .from('schools')
      .update({ school_passcode: hashedPasscode, passcode_plain: plainPasscode })
      .eq('id', schoolId)

    if (error) throw new Error(error.message)

    console.log(`[Schools] 🔑 Passcode regenerated for school ${schoolId}`)

    res.json({
      message:  'Passcode regenerated. Share this with new members.',
      passcode: plainPasscode,
      warning:  'The old passcode is now invalid. Save this new one securely.',
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Add Teacher ────────────────────────────────────────────────────────────────
// Admin creates a teacher account (no passcode needed — admin-initiated)
router.post('/:id/teachers', requireSupabaseAuth, requireSchoolAdmin, async (req, res) => {
  const schoolId = req.params.id
  if (req.schoolId !== schoolId) return res.status(403).json({ error: 'Not your school.' })

  const { email, password, name, subject } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password are required.' })
  if (!name)               return res.status(400).json({ error: 'name is required.' })

  try {
    // Create Supabase auth user
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

    // Create teacher profile
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('users')
      .insert({
        id:        authUser.id,
        name:      name.trim(),
        role:      'teacher',
        school_id: schoolId,
        subject:   subject || null,
        status:    'active',
      })
      .select('id, name, role, subject, school_id, created_at')
      .single()

    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.id)
      throw new Error(profileErr.message)
    }

    console.log(`[Schools] ✓ Teacher added: ${name} → ${schoolId}`)

    res.status(201).json({
      message: `Teacher "${name}" added to school.`,
      teacher: profile,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Approve Pending Student ────────────────────────────────────────────────────
router.post('/:id/approve/:userId', requireSupabaseAuth, requireSchoolAdmin, async (req, res) => {
  const { id: schoolId, userId } = req.params
  if (req.schoolId !== schoolId) return res.status(403).json({ error: 'Not your school.' })

  try {
    const { data: target, error: findErr } = await supabaseAdmin
      .from('users')
      .select('id, name, role, status, school_id')
      .eq('id', userId)
      .single()

    if (findErr || !target) return res.status(404).json({ error: 'User not found.' })
    if (target.school_id !== schoolId) return res.status(403).json({ error: 'User is not in your school.' })
    if (target.status !== 'pending')   return res.status(400).json({ error: `User status is "${target.status}", not "pending".` })

    const { error } = await supabaseAdmin
      .from('users')
      .update({ status: 'active' })
      .eq('id', userId)

    if (error) throw new Error(error.message)

    res.json({ message: `${target.name} has been approved and can now access school features.` })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Suspend Member ─────────────────────────────────────────────────────────────
router.post('/:id/suspend/:userId', requireSupabaseAuth, requireSchoolAdmin, async (req, res) => {
  const { id: schoolId, userId } = req.params
  if (req.schoolId !== schoolId) return res.status(403).json({ error: 'Not your school.' })
  if (userId === req.user.id)    return res.status(400).json({ error: 'You cannot suspend yourself.' })

  const { reason } = req.body

  try {
    const { data: target } = await supabaseAdmin
      .from('users')
      .select('id, name, role, school_id')
      .eq('id', userId)
      .single()

    if (!target)                      return res.status(404).json({ error: 'User not found.' })
    if (target.school_id !== schoolId) return res.status(403).json({ error: 'User is not in your school.' })
    if (target.role === 'admin')       return res.status(403).json({ error: 'Cannot suspend another admin.' })

    const { error } = await supabaseAdmin
      .from('users')
      .update({ status: 'suspended' })
      .eq('id', userId)

    if (error) throw new Error(error.message)

    console.log(`[Schools] 🚫 Suspended: ${target.name} (${userId}). Reason: ${reason || 'none'}`)

    res.json({ message: `${target.name} has been suspended.`, reason: reason || null })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Reinstate Member ───────────────────────────────────────────────────────────
router.post('/:id/reinstate/:userId', requireSupabaseAuth, requireSchoolAdmin, async (req, res) => {
  const { id: schoolId, userId } = req.params
  if (req.schoolId !== schoolId) return res.status(403).json({ error: 'Not your school.' })

  try {
    const { data: target } = await supabaseAdmin
      .from('users')
      .select('id, name, role, status, school_id')
      .eq('id', userId)
      .single()

    if (!target)                       return res.status(404).json({ error: 'User not found.' })
    if (target.school_id !== schoolId)  return res.status(403).json({ error: 'User is not in your school.' })
    if (target.status !== 'suspended') return res.status(400).json({ error: `User is not suspended.` })

    const { error } = await supabaseAdmin
      .from('users')
      .update({ status: 'active' })
      .eq('id', userId)

    if (error) throw new Error(error.message)

    res.json({ message: `${target.name} has been reinstated.` })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Remove Member ──────────────────────────────────────────────────────────────
router.delete('/:id/members/:userId', requireSupabaseAuth, requireSchoolAdmin, async (req, res) => {
  const { id: schoolId, userId } = req.params
  if (req.schoolId !== schoolId) return res.status(403).json({ error: 'Not your school.' })
  if (userId === req.user.id)    return res.status(400).json({ error: 'You cannot remove yourself.' })

  try {
    const { data: target } = await supabaseAdmin
      .from('users')
      .select('id, name, role, school_id')
      .eq('id', userId)
      .single()

    if (!target)                       return res.status(404).json({ error: 'User not found.' })
    if (target.school_id !== schoolId)  return res.status(403).json({ error: 'User is not in your school.' })
    if (target.role === 'admin')        return res.status(403).json({ error: 'Cannot remove another admin.' })

    // Detach from school (don't delete the auth account)
    const { error } = await supabaseAdmin
      .from('users')
      .update({ school_id: null, status: 'active' })
      .eq('id', userId)

    if (error) throw new Error(error.message)

    console.log(`[Schools] ✂️  Removed: ${target.name} (${userId}) from school ${schoolId}`)

    res.json({ message: `${target.name} has been removed from the school. Their account remains active.` })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Upload Logo ────────────────────────────────────────────────────────────────
router.post('/:id/upload-logo', requireSupabaseAuth, requireSchoolAdmin, async (req, res) => {
  const schoolId = req.params.id
  if (req.schoolId !== schoolId) return res.status(403).json({ error: 'Not your school.' })

  const base64 = req.body.logo_base64
  const mime   = req.body.mime_type || 'image/png'

  if (!base64) return res.status(400).json({ error: 'logo_base64 is required.' })

  try {
    const buffer   = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64')
    const ext      = mime.split('/')[1] || 'png'
    const filePath = `school-logos/${schoolId}.${ext}`

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('kairo-public')
      .upload(filePath, buffer, { contentType: mime, upsert: true })

    if (uploadErr) throw new Error(uploadErr.message)

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('kairo-public')
      .getPublicUrl(filePath)

    await supabaseAdmin
      .from('schools')
      .update({ school_logo_url: publicUrl })
      .eq('id', schoolId)

    res.json({ logo_url: publicUrl })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── School Stats ───────────────────────────────────────────────────────────────
router.get('/:id/stats', requireSupabaseAuth, requireTeacherOrAdmin, async (req, res) => {
  const schoolId = req.params.id
  if (req.schoolId !== schoolId) return res.status(403).json({ error: 'Not your school.' })

  try {
    const [
      { count: totalUsers },
      { count: totalStudents },
      { count: pendingStudents },
      { count: totalTeachers },
      { count: totalNotes },
      { count: activeNotifs },
      { count: totalTasks },
      { count: openTasks },
    ] = await Promise.all([
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'active'),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'student').eq('status', 'active'),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'student').eq('status', 'pending'),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'teacher').eq('status', 'active'),
      supabaseAdmin.from('notes').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabaseAdmin.from('notifications').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).gt('expires_at', new Date().toISOString()),
      supabaseAdmin.from('tasks').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabaseAdmin.from('tasks').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'active'),
    ])

    res.json({
      school_id:            schoolId,
      total_active_users:   totalUsers,
      total_students:       totalStudents,
      pending_students:     pendingStudents,
      total_teachers:       totalTeachers,
      total_notes:          totalNotes,
      active_notifications: activeNotifs,
      total_tasks:          totalTasks,
      open_tasks:           openTasks,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Update School Settings ─────────────────────────────────────────────────────
router.put('/:id', requireSupabaseAuth, requireSchoolAdmin, async (req, res) => {
  const schoolId = req.params.id
  if (req.schoolId !== schoolId) return res.status(403).json({ error: 'Not your school.' })

  const { school_name, school_email, require_approval, domain } = req.body
  const updates = {}

  if (school_name      !== undefined) updates.school_name      = school_name.trim()
  if (school_email     !== undefined) updates.school_email     = school_email.trim().toLowerCase()
  if (require_approval !== undefined) updates.require_approval = !!require_approval
  if (domain           !== undefined) updates.domain           = domain || null

  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update.' })

  try {
    const { data, error } = await supabaseAdmin
      .from('schools')
      .update(updates)
      .eq('id', schoolId)
      .select('id, school_name, school_email, domain, require_approval, school_logo_url')
      .single()

    if (error) throw new Error(error.message)
    res.json({ message: 'School settings updated.', school: data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Login Logs ─────────────────────────────────────────────────────────────────
router.get('/:id/login-logs', requireSupabaseAuth, requireSchoolAdmin, async (req, res) => {
  const schoolId = req.params.id
  if (req.schoolId !== schoolId) return res.status(403).json({ error: 'Not your school.' })

  const limit  = Math.min(parseInt(req.query.limit  || '50',  10), 200)
  const offset = Math.max(parseInt(req.query.offset || '0',   10), 0)
  const onlyFailed = req.query.failed === 'true'

  try {
    let query = supabaseAdmin
      .from('login_logs')
      .select(`
        id, email, ip_address, user_agent, success, reason, created_at,
        user:users!login_logs_user_id_fkey(id, name, role)
      `)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (onlyFailed) query = query.eq('success', false)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    res.json({ school_id: schoolId, logs: data, count: data.length, limit, offset })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Helpers ────────────────────────────────────────────────────────────────────
function generatePasscode() {
  // Format: XXXXXX-XXXXXX-XXXXXX (uppercase hex, easy to read/share)
  const seg = () => crypto.randomBytes(3).toString('hex').toUpperCase()
  return `${seg()}-${seg()}-${seg()}`
}

export default router
