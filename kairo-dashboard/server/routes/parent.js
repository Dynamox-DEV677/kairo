import { Router }  from 'express'
import { fail } from '../lib/fail.js'
import crypto      from 'crypto'
import bcrypt      from 'bcryptjs'
import { supabaseAdmin, requireSupabase } from '../services/supabase.js'
import { requireSupabaseAuth, requireRole } from '../middleware/supabaseAuth.js'
import { parentLinkedEmail }                from '../services/welcomeEmail.js'

const router = Router()
router.use(requireSupabase)

router.post('/generate-code', requireSupabaseAuth, requireRole('student'), async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'You must be in a school to generate a parent code.' })

  try {
    await supabaseAdmin
      .from('parent_codes')
      .update({ used: true })
      .eq('student_id', req.user.id)
      .eq('used', false)

    const code = generateCode()

    const { data, error } = await supabaseAdmin
      .from('parent_codes')
      .insert({
        student_id: req.user.id,
        school_id:  req.schoolId,
        code,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id, code, expires_at, created_at')
      .single()

    if (error) throw new Error(error.message)

    console.log(`[Parent] ✓ Code generated for student ${req.user.id}: ${code}`)

    res.status(201).json({
      message:    'Parent access code generated. Share it with your parent.',
      code:       data.code,
      expires_at: data.expires_at,
      warning:    'Previous codes have been invalidated. This code expires in 7 days.',
    })
  } catch (e) {
    fail(res, req, e)
  }
})

router.get('/my-code', requireSupabaseAuth, requireRole('student'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('parent_codes')
      .select('id, code, used, expires_at, created_at')
      .eq('student_id', req.user.id)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(error.message)

    if (!data) {
      return res.json({ code: null, message: 'No active code. Generate one first.' })
    }

    res.json({ code: data.code, expires_at: data.expires_at, created_at: data.created_at })
  } catch (e) {
    fail(res, req, e)
  }
})

router.post('/register', async (req, res) => {
  const { name, email, password, access_code } = req.body

  if (!name)        return res.status(400).json({ error: 'name is required.' })
  if (!email)       return res.status(400).json({ error: 'email is required.' })
  if (!password)    return res.status(400).json({ error: 'password is required.' })
  if (!access_code) return res.status(400).json({ error: 'access_code is required. Ask your child to generate one.' })

  try {
    const { data: codeRow, error: codeErr } = await supabaseAdmin
      .from('parent_codes')
      .select('id, student_id, school_id, used, expires_at')
      .eq('code', access_code.trim().toUpperCase())
      .maybeSingle()

    if (codeErr) throw new Error(codeErr.message)
    if (!codeRow)                   return res.status(404).json({ error: 'Invalid access code.' })
    if (codeRow.used)               return res.status(409).json({ error: 'This access code has already been used. Ask your child to generate a new one.' })
    if (new Date(codeRow.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This access code has expired. Ask your child to generate a new one.' })
    }

    const { data: existing } = await supabaseAdmin
      .from('parent_links')
      .select('id, parent:users!parent_links_parent_id_fkey(id, name)')
      .eq('student_id', codeRow.student_id)

    if (existing && existing.length > 0) {
      return res.status(409).json({
        error: 'A parent is already linked to this student. Only one parent account per student is supported.',
      })
    }

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

    const { data: parentProfile, error: profileErr } = await supabaseAdmin
      .from('users')
      .insert({
        id:        authUser.id,
        name:      name.trim(),
        role:      'parent',
        school_id: codeRow.school_id,
        status:    'active',
      })
      .select('id, name, role, school_id')
      .single()

    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.id)
      throw new Error(profileErr.message)
    }

    const { error: linkErr } = await supabaseAdmin
      .from('parent_links')
      .insert({
        parent_id:  authUser.id,
        student_id: codeRow.student_id,
        school_id:  codeRow.school_id,
      })

    if (linkErr) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.id)
      throw new Error(linkErr.message)
    }

    await supabaseAdmin
      .from('parent_codes')
      .update({ used: true })
      .eq('id', codeRow.id)

    const { data: signInData } = await supabaseAdmin.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    const { data: student } = await supabaseAdmin
      .from('users')
      .select('id, name, class_name')
      .eq('id', codeRow.student_id)
      .single()

    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('id, school_name, school_logo_url')
      .eq('id', codeRow.school_id)
      .maybeSingle()

    console.log(`[Parent] ✓ Registered: ${name} → linked to student ${student?.name}`)

    parentLinkedEmail({
      to:          email.trim().toLowerCase(),
      name:        name.trim(),
      studentName: student?.name || 'your child',
      schoolName:  school?.school_name || 'their school',
    }).catch(() => {})

    res.status(201).json({
      message:       `Account created. You are now linked to ${student?.name}.`,
      parent:        parentProfile,
      linked_student: student,
      school,
      access_token:  signInData?.session?.access_token  || null,
      refresh_token: signInData?.session?.refresh_token || null,
      expires_in:    signInData?.session?.expires_in    || 3600,
    })
  } catch (e) {
    console.error('[Parent/register]', e.message)
    fail(res, req, e)
  }
})

router.get('/profile', requireSupabaseAuth, requireRole('parent'), async (req, res) => {
  try {
    const { data: links, error } = await supabaseAdmin
      .from('parent_links')
      .select(`
        student_id,
        school_id,
        linked_at,
        student:users!parent_links_student_id_fkey(id, name, class_name, subject, avatar_url),
        school:schools!parent_links_school_id_fkey(id, school_name, school_logo_url)
      `)
      .eq('parent_id', req.user.id)

    if (error) throw new Error(error.message)

    res.json({
      parent: req.user,
      links:  links || [],
    })
  } catch (e) {
    fail(res, req, e)
  }
})

router.get('/marks', requireSupabaseAuth, requireRole('parent'), async (req, res) => {
  try {
    const { data: links } = await supabaseAdmin
      .from('parent_links')
      .select('student_id, student:users!parent_links_student_id_fkey(id, name, class_name)')
      .eq('parent_id', req.user.id)

    if (!links || links.length === 0) {
      return res.status(404).json({ error: 'No child linked to your account.' })
    }

    const link      = links[0]
    const studentId = link.student_id

    const { data, error } = await supabaseAdmin
      .from('marks')
      .select(`
        id, subject, exam_name, marks_obtained, total_marks, remarks, created_at,
        teacher:users!marks_teacher_id_fkey(id, name)
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    const summary = buildSummary(data)

    res.json({ student: link.student, marks: data, summary })
  } catch (e) {
    fail(res, req, e)
  }
})

router.get('/links', requireSupabaseAuth, requireRole('admin'), async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'Not in a school.' })

  try {
    const { data, error } = await supabaseAdmin
      .from('parent_links')
      .select(`
        id, linked_at,
        parent:users!parent_links_parent_id_fkey(id, name, role),
        student:users!parent_links_student_id_fkey(id, name, class_name)
      `)
      .eq('school_id', req.schoolId)
      .order('linked_at', { ascending: false })

    if (error) throw new Error(error.message)

    res.json({ links: data, count: data.length })
  } catch (e) {
    fail(res, req, e)
  }
})

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function buildSummary(marks) {
  if (!marks || marks.length === 0) return null
  const bySubject = {}
  for (const m of marks) {
    if (!bySubject[m.subject]) bySubject[m.subject] = { obtained: 0, max: 0, count: 0 }
    bySubject[m.subject].obtained += parseFloat(m.marks_obtained)
    bySubject[m.subject].max      += parseFloat(m.total_marks)
    bySubject[m.subject].count    += 1
  }
  const subjects = Object.entries(bySubject).map(([subject, d]) => ({
    subject,
    percentage:     Math.round((d.obtained / d.max) * 100),
    total_obtained: d.obtained,
    total_max:      d.max,
    count:          d.count,
  })).sort((a, b) => b.percentage - a.percentage)

  const totalObtained = marks.reduce((s, m) => s + parseFloat(m.marks_obtained), 0)
  const totalMax      = marks.reduce((s, m) => s + parseFloat(m.total_marks), 0)

  return {
    average_percentage: Math.round((totalObtained / totalMax) * 100),
    total_exams:        marks.length,
    strong_subjects:    subjects.filter(s => s.percentage >= 75).map(s => s.subject),
    weak_subjects:      subjects.filter(s => s.percentage < 50).map(s => s.subject),
    subjects,
  }
}

export default router
