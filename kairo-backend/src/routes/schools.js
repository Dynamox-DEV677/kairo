/**
 * School Account Routes
 *
 * POST  /api/schools/register          Register a new school (generates passcode)
 * GET   /api/schools/:id               Get school public info
 * GET   /api/schools/by-name/:name     Look up school by name (for join flow)
 * POST  /api/schools/:id/upload-logo   Upload logo to Supabase Storage
 * GET   /api/schools/:id/stats         School stats (requires auth)
 */
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { supabaseAdmin, requireSupabase } from '../services/supabase.js'
import { requireSupabaseAuth, requireRole } from '../middleware/supabaseAuth.js'

const router = Router()
router.use(requireSupabase)

// ── Register School ────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { school_name, school_email, school_logo_url } = req.body
  if (!school_name) return res.status(400).json({ error: 'school_name is required.' })
  if (!school_email) return res.status(400).json({ error: 'school_email is required.' })

  try {
    // Check uniqueness
    const { data: existing } = await supabaseAdmin
      .from('schools')
      .select('id')
      .ilike('school_name', school_name)
      .maybeSingle()

    if (existing) return res.status(409).json({ error: `School "${school_name}" is already registered.` })

    // Generate plain passcode — shown ONCE to the admin
    const plainPasscode = generatePasscode()
    const hashedPasscode = await bcrypt.hash(plainPasscode, 12)

    const { data: school, error } = await supabaseAdmin
      .from('schools')
      .insert({
        school_name:     school_name.trim(),
        school_email:    school_email.trim().toLowerCase(),
        school_passcode: hashedPasscode,
        school_logo_url: school_logo_url || null,
      })
      .select('id, school_name, school_email, school_logo_url, created_at')
      .single()

    if (error) throw new Error(error.message)

    console.log(`[Schools] ✓ Registered: ${school_name} (${school.id})`)

    res.status(201).json({
      message:   'School registered successfully.',
      school_id: school.id,
      school,
      // Return PLAIN passcode once — admin must save this
      passcode:  plainPasscode,
      warning:   'Save this passcode securely — it will never be shown again.',
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
      .select('id, school_name, school_logo_url, school_email, plan, created_at')
      .eq('id', req.params.id)
      .single()

    if (error || !data) return res.status(404).json({ error: 'School not found.' })
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Look up school by name (used in join flow) ────────────────────────────────
router.get('/by-name/:name', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('schools')
      .select('id, school_name, school_logo_url, school_email')
      .ilike('school_name', req.params.name)
      .maybeSingle()

    if (error || !data) return res.status(404).json({ error: 'School not found.' })
    // Don't return passcode
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Upload Logo to Supabase Storage ──────────────────────────────────────────
// Expects multipart/form-data with field "logo" (image file)
router.post('/:id/upload-logo', requireSupabaseAuth, requireRole('admin'), async (req, res) => {
  const schoolId = req.params.id
  // Ensure this admin belongs to this school
  if (req.schoolId !== schoolId) return res.status(403).json({ error: 'Not your school.' })

  const base64 = req.body.logo_base64   // accept base64 string for simplicity
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

// ── School Stats ──────────────────────────────────────────────────────────────
router.get('/:id/stats', requireSupabaseAuth, async (req, res) => {
  const schoolId = req.params.id
  if (req.schoolId !== schoolId) return res.status(403).json({ error: 'Not your school.' })

  try {
    const [
      { count: totalUsers },
      { count: totalStudents },
      { count: totalTeachers },
      { count: totalNotes },
      { count: activeNotifs },
    ] = await Promise.all([
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'student'),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'teacher'),
      supabaseAdmin.from('notes').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabaseAdmin.from('notifications').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).gt('expires_at', new Date().toISOString()),
    ])

    res.json({
      school_id:       schoolId,
      total_users:     totalUsers,
      total_students:  totalStudents,
      total_teachers:  totalTeachers,
      total_notes:     totalNotes,
      active_notifications: activeNotifs,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function generatePasscode() {
  // Format: XXXX-XXXX-XXXX (uppercase alphanumeric, easy to read/share)
  const seg = () => crypto.randomBytes(3).toString('hex').toUpperCase()
  return `${seg()}-${seg()}-${seg()}`
}

export default router
