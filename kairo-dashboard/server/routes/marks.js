/**
 * Marks / Grades API
 *
 * Teacher  → POST /api/marks              Add marks for a student
 * Teacher  → PUT  /api/marks/:id          Update marks
 * Teacher  → DELETE /api/marks/:id        Delete a mark entry
 * Student  → GET  /api/marks/my           View own marks
 * Parent   → GET  /api/marks/child        View linked child's marks (read-only)
 * Teacher  → GET  /api/marks/student/:id  View one student's marks
 * Admin    → GET  /api/marks/school       All marks for the school (audit)
 */
import { Router }  from 'express'
import { supabaseAdmin, requireSupabase } from '../services/supabase.js'
import { requireSupabaseAuth, requireRole } from '../middleware/supabaseAuth.js'

const router = Router()
router.use(requireSupabase)
router.use(requireSupabaseAuth)

// ── GET /marks/my — student views their own marks ─────────────────────────
router.get('/my', requireRole('student'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('marks')
      .select(`
        id, subject, exam_name, marks_obtained, total_marks, remarks, created_at,
        teacher:users!marks_teacher_id_fkey(id, name, subject)
      `)
      .eq('student_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    res.json({ marks: data, summary: buildSummary(data) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /marks/child — parent views linked child's marks ──────────────────
router.get('/child', requireRole('parent'), async (req, res) => {
  try {
    // Get the linked student
    const { data: links, error: linkErr } = await supabaseAdmin
      .from('parent_links')
      .select('student_id, student:users!parent_links_student_id_fkey(id, name, class_name)')
      .eq('parent_id', req.user.id)

    if (linkErr) throw new Error(linkErr.message)
    if (!links || links.length === 0) {
      return res.status(404).json({ error: 'No child linked to your account. Generate a code from the student account and use it to link.' })
    }

    const link = links[0]
    const studentId = link.student_id

    const { data, error } = await supabaseAdmin
      .from('marks')
      .select(`
        id, subject, exam_name, marks_obtained, total_marks, remarks, created_at,
        teacher:users!marks_teacher_id_fkey(id, name, subject)
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    res.json({
      student:  link.student,
      marks:    data,
      summary:  buildSummary(data),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /marks/school — admin views all marks ─────────────────────────────
router.get('/school', requireRole('admin'), async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'Not in a school.' })

  const { subject, student_id, limit = '50', offset = '0' } = req.query

  try {
    let query = supabaseAdmin
      .from('marks')
      .select(`
        id, subject, exam_name, marks_obtained, total_marks, remarks, created_at,
        student:users!marks_student_id_fkey(id, name, class_name),
        teacher:users!marks_teacher_id_fkey(id, name)
      `)
      .eq('school_id', req.schoolId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

    if (subject)    query = query.eq('subject', subject)
    if (student_id) query = query.eq('student_id', student_id)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    res.json({ marks: data, count: data.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /marks/student/:id — teacher/admin views a student's marks ─────────
router.get('/student/:id', requireRole('teacher', 'admin'), async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'Not in a school.' })

  try {
    // Verify student is in same school
    const { data: student } = await supabaseAdmin
      .from('users')
      .select('id, name, class_name, school_id')
      .eq('id', req.params.id)
      .single()

    if (!student || student.school_id !== req.schoolId) {
      return res.status(404).json({ error: 'Student not found in your school.' })
    }

    const { data, error } = await supabaseAdmin
      .from('marks')
      .select(`
        id, subject, exam_name, marks_obtained, total_marks, remarks, created_at, updated_at,
        teacher:users!marks_teacher_id_fkey(id, name)
      `)
      .eq('student_id', req.params.id)
      .eq('school_id', req.schoolId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    res.json({ student, marks: data, summary: buildSummary(data) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── POST /marks — teacher adds marks for a student ─────────────────────────
router.post('/', requireRole('teacher', 'admin'), async (req, res) => {
  const { student_id, subject, exam_name, marks_obtained, total_marks = 100, remarks } = req.body

  if (!student_id)    return res.status(400).json({ error: 'student_id is required.' })
  if (!subject)       return res.status(400).json({ error: 'subject is required.' })
  if (!exam_name)     return res.status(400).json({ error: 'exam_name is required.' })
  if (marks_obtained == null) return res.status(400).json({ error: 'marks_obtained is required.' })
  if (!req.schoolId)  return res.status(400).json({ error: 'You are not in a school.' })

  const obtained = parseFloat(marks_obtained)
  const total    = parseFloat(total_marks)

  if (isNaN(obtained) || obtained < 0)    return res.status(400).json({ error: 'marks_obtained must be a non-negative number.' })
  if (isNaN(total)    || total <= 0)      return res.status(400).json({ error: 'total_marks must be positive.' })
  if (obtained > total)                   return res.status(400).json({ error: 'marks_obtained cannot exceed total_marks.' })

  try {
    // Verify student is in same school
    const { data: student } = await supabaseAdmin
      .from('users')
      .select('id, name, school_id, role')
      .eq('id', student_id)
      .single()

    if (!student || student.school_id !== req.schoolId) {
      return res.status(404).json({ error: 'Student not found in your school.' })
    }
    if (student.role !== 'student') {
      return res.status(400).json({ error: 'target user is not a student.' })
    }

    const { data, error } = await supabaseAdmin
      .from('marks')
      .insert({
        school_id:      req.schoolId,
        student_id,
        teacher_id:     req.user.id,
        subject:        subject.trim(),
        exam_name:      exam_name.trim(),
        marks_obtained: obtained,
        total_marks:    total,
        remarks:        remarks?.trim() || null,
      })
      .select('*')
      .single()

    if (error) throw new Error(error.message)

    console.log(`[Marks] ✓ Added: ${student.name} — ${subject} ${exam_name} ${obtained}/${total}`)
    res.status(201).json({ message: 'Marks added.', mark: data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── PUT /marks/:id — teacher updates a mark entry ─────────────────────────
router.put('/:id', requireRole('teacher', 'admin'), async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'Not in a school.' })

  try {
    const { data: existing } = await supabaseAdmin
      .from('marks')
      .select('id, school_id, teacher_id')
      .eq('id', req.params.id)
      .single()

    if (!existing) return res.status(404).json({ error: 'Mark entry not found.' })
    if (existing.school_id !== req.schoolId) return res.status(403).json({ error: 'Not your school.' })
    // Teachers can only edit their own entries; admins can edit any
    if (req.user.role === 'teacher' && existing.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own mark entries.' })
    }

    const { subject, exam_name, marks_obtained, total_marks, remarks } = req.body
    const updates: any = {}
    if (subject        !== undefined) updates.subject        = subject.trim()
    if (exam_name      !== undefined) updates.exam_name      = exam_name.trim()
    if (marks_obtained !== undefined) updates.marks_obtained = parseFloat(marks_obtained)
    if (total_marks    !== undefined) updates.total_marks    = parseFloat(total_marks)
    if (remarks        !== undefined) updates.remarks        = remarks?.trim() || null

    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update.' })

    const { data, error } = await supabaseAdmin
      .from('marks')
      .update(updates)
      .eq('id', req.params.id)
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    res.json({ message: 'Marks updated.', mark: data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── DELETE /marks/:id — teacher/admin deletes a mark entry ────────────────
router.delete('/:id', requireRole('teacher', 'admin'), async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'Not in a school.' })

  try {
    const { data: existing } = await supabaseAdmin
      .from('marks')
      .select('id, school_id, teacher_id, subject, exam_name')
      .eq('id', req.params.id)
      .single()

    if (!existing) return res.status(404).json({ error: 'Mark entry not found.' })
    if (existing.school_id !== req.schoolId) return res.status(403).json({ error: 'Not your school.' })
    if (req.user.role === 'teacher' && existing.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own mark entries.' })
    }

    const { error } = await supabaseAdmin
      .from('marks')
      .delete()
      .eq('id', req.params.id)

    if (error) throw new Error(error.message)

    console.log(`[Marks] 🗑 Deleted: ${existing.subject} / ${existing.exam_name}`)
    res.json({ message: 'Mark entry deleted.' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Helper: build summary from marks array ────────────────────────────────
function buildSummary(marks) {
  if (!marks || marks.length === 0) return null

  // Subject-wise breakdown
  const bySubject = {}
  for (const m of marks) {
    if (!bySubject[m.subject]) bySubject[m.subject] = { total_obtained: 0, total_max: 0, count: 0 }
    bySubject[m.subject].total_obtained += parseFloat(m.marks_obtained)
    bySubject[m.subject].total_max      += parseFloat(m.total_marks)
    bySubject[m.subject].count          += 1
  }

  const subjects = Object.entries(bySubject).map(([subject, d]: any) => ({
    subject,
    total_obtained: d.total_obtained,
    total_max:      d.total_max,
    percentage:     Math.round((d.total_obtained / d.total_max) * 100),
    count:          d.count,
  })).sort((a, b) => b.percentage - a.percentage)

  const totalObtained = marks.reduce((s, m) => s + parseFloat(m.marks_obtained), 0)
  const totalMax      = marks.reduce((s, m) => s + parseFloat(m.total_marks), 0)
  const avgPercent    = Math.round((totalObtained / totalMax) * 100)

  return {
    average_percentage: avgPercent,
    total_exams:        marks.length,
    strong_subjects:    subjects.filter(s => s.percentage >= 75).map(s => s.subject),
    weak_subjects:      subjects.filter(s => s.percentage < 50).map(s => s.subject),
    subjects,
  }
}

export default router
