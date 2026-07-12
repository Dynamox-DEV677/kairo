import { Router } from 'express'
import { supabaseAdmin, requireSupabase }             from '../services/supabase.js'
import { requireSupabaseAuth }                         from '../middleware/supabaseAuth.js'
import { requireTeacherOrAdmin, checkNetworkRestriction } from '../middleware/schoolAuth.js'

const router = Router()
router.use(requireSupabase)
router.use(requireSupabaseAuth)
router.use(checkNetworkRestriction)

router.post('/', requireTeacherOrAdmin, async (req, res) => {
  const {
    title,
    description,
    subject,
    target_class,
    due_date,
    max_score = 100,
    status    = 'active',
  } = req.body

  if (!title)        return res.status(400).json({ error: 'title is required.' })
  if (!req.schoolId) return res.status(400).json({ error: 'You are not part of a school.' })

  try {
    const { data, error } = await supabaseAdmin
      .from('tasks')
      .insert({
        school_id:    req.schoolId,
        created_by:   req.user.id,
        title:        title.trim(),
        description:  description || null,
        subject:      subject     || null,
        target_class: target_class || null,
        due_date:     due_date    || null,
        max_score:    max_score,
        status,
      })
      .select('*')
      .single()

    if (error) throw new Error(error.message)

    console.log(`[Tasks] ✓ Created: "${title}" by ${req.user.name}`)
    res.status(201).json({ message: 'Task created.', task: data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/', async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'You are not part of a school.' })

  const { subject, status, target_class } = req.query

  try {
    let query = supabaseAdmin
      .from('tasks')
      .select(`
        id, title, description, subject, target_class, due_date,
        max_score, status, created_at, updated_at,
        creator:users!tasks_created_by_fkey(id, name, role)
      `)
      .eq('school_id', req.schoolId)
      .order('created_at', { ascending: false })

    if (req.user.role === 'student') {
      query = query.eq('status', 'active')
      if (req.user.class_name) {
        query = query.or(`target_class.is.null,target_class.eq.${req.user.class_name}`)
      }
    }

    if (subject)      query = query.eq('subject', subject)
    if (status && req.user.role !== 'student') query = query.eq('status', status)
    if (target_class) query = query.eq('target_class', target_class)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    if (req.user.role === 'student' && data.length > 0) {
      const taskIds = data.map(t => t.id)
      const { data: submissions } = await supabaseAdmin
        .from('task_submissions')
        .select('task_id, status, score, submitted_at')
        .eq('student_id', req.user.id)
        .in('task_id', taskIds)

      const subMap = Object.fromEntries((submissions || []).map(s => [s.task_id, s]))
      const enriched = data.map(t => ({ ...t, my_submission: subMap[t.id] || null }))
      return res.json({ tasks: enriched, count: enriched.length })
    }

    res.json({ tasks: data, count: data.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/:id', async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'You are not part of a school.' })

  try {
    const { data: task, error } = await supabaseAdmin
      .from('tasks')
      .select(`
        *,
        creator:users!tasks_created_by_fkey(id, name, role, subject)
      `)
      .eq('id', req.params.id)
      .eq('school_id', req.schoolId)
      .single()

    if (error || !task) return res.status(404).json({ error: 'Task not found.' })

    if (req.user.role === 'student') {
      const { data: submission } = await supabaseAdmin
        .from('task_submissions')
        .select('*')
        .eq('task_id', task.id)
        .eq('student_id', req.user.id)
        .maybeSingle()
      return res.json({ task, my_submission: submission || null })
    }

    const { count: submissionCount } = await supabaseAdmin
      .from('task_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('task_id', task.id)

    res.json({ task, submission_count: submissionCount })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/:id', requireTeacherOrAdmin, async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'You are not part of a school.' })

  try {
    const { data: existing } = await supabaseAdmin
      .from('tasks')
      .select('id, created_by, school_id')
      .eq('id', req.params.id)
      .single()

    if (!existing)                          return res.status(404).json({ error: 'Task not found.' })
    if (existing.school_id !== req.schoolId) return res.status(403).json({ error: 'Not your school.' })
    if (existing.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the task creator or an admin can update this task.' })
    }

    const allowed = ['title', 'description', 'subject', 'target_class', 'due_date', 'max_score', 'status']
    const updates = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }

    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update.' })

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .update(updates)
      .eq('id', req.params.id)
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    res.json({ message: 'Task updated.', task: data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/:id', requireTeacherOrAdmin, async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'You are not part of a school.' })

  try {
    const { data: existing } = await supabaseAdmin
      .from('tasks')
      .select('id, created_by, school_id, title')
      .eq('id', req.params.id)
      .single()

    if (!existing)                          return res.status(404).json({ error: 'Task not found.' })
    if (existing.school_id !== req.schoolId) return res.status(403).json({ error: 'Not your school.' })
    if (existing.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the task creator or an admin can delete this task.' })
    }

    const { error } = await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('id', req.params.id)

    if (error) throw new Error(error.message)

    console.log(`[Tasks] 🗑 Deleted: "${existing.title}" by ${req.user.name}`)
    res.json({ message: 'Task deleted.' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/:id/submit', async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Only students can submit tasks.' })
  }
  if (!req.schoolId) return res.status(400).json({ error: 'You are not part of a school.' })

  const { content, file_url } = req.body
  if (!content && !file_url) return res.status(400).json({ error: 'content or file_url is required.' })

  try {
    const { data: task, error: taskErr } = await supabaseAdmin
      .from('tasks')
      .select('id, status, due_date, school_id')
      .eq('id', req.params.id)
      .eq('school_id', req.schoolId)
      .single()

    if (taskErr || !task) return res.status(404).json({ error: 'Task not found.' })
    if (task.status === 'closed') return res.status(400).json({ error: 'This task is closed — submissions are no longer accepted.' })
    if (task.status === 'draft')  return res.status(400).json({ error: 'This task is not yet published.' })

    const isLate = task.due_date && new Date() > new Date(task.due_date)
    const status = isLate ? 'late' : 'submitted'

    const { data, error } = await supabaseAdmin
      .from('task_submissions')
      .upsert(
        {
          task_id:      req.params.id,
          student_id:   req.user.id,
          content:      content  || null,
          file_url:     file_url || null,
          status,
          submitted_at: new Date().toISOString(),
          score:      null,
          feedback:   null,
          graded_at:  null,
          graded_by:  null,
        },
        { onConflict: 'task_id,student_id' }
      )
      .select('*')
      .single()

    if (error) throw new Error(error.message)

    console.log(`[Tasks] 📝 Submitted: task ${req.params.id} by student ${req.user.name} (${status})`)
    res.status(201).json({
      message:    isLate ? 'Submitted (late — past due date).' : 'Submitted successfully.',
      submission: data,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/:id/submissions', requireTeacherOrAdmin, async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'You are not part of a school.' })

  try {
    const { data: task } = await supabaseAdmin
      .from('tasks')
      .select('id, school_id, title, max_score')
      .eq('id', req.params.id)
      .eq('school_id', req.schoolId)
      .single()

    if (!task) return res.status(404).json({ error: 'Task not found.' })

    const { data, error } = await supabaseAdmin
      .from('task_submissions')
      .select(`
        *,
        student:users!task_submissions_student_id_fkey(id, name, class_name, avatar_url),
        grader:users!task_submissions_graded_by_fkey(id, name)
      `)
      .eq('task_id', req.params.id)
      .order('submitted_at', { ascending: false })

    if (error) throw new Error(error.message)

    const graded   = data.filter(s => s.status === 'graded').length
    const ungraded = data.filter(s => s.status !== 'graded').length

    res.json({
      task_id:    req.params.id,
      task_title: task.title,
      max_score:  task.max_score,
      submissions: data,
      total:      data.length,
      graded,
      ungraded,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/:id/submissions/:sid/grade', requireTeacherOrAdmin, async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'You are not part of a school.' })

  const { score, feedback } = req.body
  if (score === undefined || score === null) return res.status(400).json({ error: 'score is required.' })

  try {
    const { data: task } = await supabaseAdmin
      .from('tasks')
      .select('id, school_id, max_score')
      .eq('id', req.params.id)
      .eq('school_id', req.schoolId)
      .single()

    if (!task) return res.status(404).json({ error: 'Task not found.' })

    if (typeof score !== 'number' || score < 0 || score > task.max_score) {
      return res.status(400).json({ error: `score must be a number between 0 and ${task.max_score}.` })
    }

    const { data, error } = await supabaseAdmin
      .from('task_submissions')
      .update({
        score,
        feedback:   feedback   || null,
        status:     'graded',
        graded_at:  new Date().toISOString(),
        graded_by:  req.user.id,
      })
      .eq('id', req.params.sid)
      .eq('task_id', req.params.id)
      .select(`
        *,
        student:users!task_submissions_student_id_fkey(id, name)
      `)
      .single()

    if (error) throw new Error(error.message)
    if (!data) return res.status(404).json({ error: 'Submission not found.' })

    console.log(`[Tasks] ✅ Graded: submission ${req.params.sid} → ${score}/${task.max_score}`)
    res.json({ message: 'Submission graded.', submission: data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
