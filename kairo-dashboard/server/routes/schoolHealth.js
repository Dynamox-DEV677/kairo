import { Router } from 'express'
import { fail } from '../lib/fail.js'
import { supabaseAdmin, requireSupabase } from '../services/supabase.js'
import { requireSupabaseAuth, requireRole } from '../middleware/supabaseAuth.js'

const router = Router()
router.use(requireSupabase)
router.use(requireSupabaseAuth)
router.use(requireRole('admin'))

const DAY = 24 * 60 * 60 * 1000

router.get('/', async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'You are not in a school.' })
  const schoolId = req.schoolId

  try {
    const [
      usersRes, marksRes, tasksRes, submissionsRes,
      notifsRes, leadsRes, pendingRes,
    ] = await Promise.all([
      supabaseAdmin.from('users')
        .select('id, role, status, class_name, last_login_at, created_at')
        .eq('school_id', schoolId),
      supabaseAdmin.from('marks')
        .select('id, student_id, teacher_id, subject, marks_obtained, total_marks, created_at')
        .eq('school_id', schoolId)
        .gte('created_at', new Date(Date.now() - 30 * DAY).toISOString()),
      supabaseAdmin.from('tasks')
        .select('id, created_by, subject, target_class, status, created_at')
        .eq('school_id', schoolId)
        .gte('created_at', new Date(Date.now() - 30 * DAY).toISOString()),
      supabaseAdmin.from('task_submissions')
        .select('id, student_id, task_id, status, submitted_at, score')
        .gte('submitted_at', new Date(Date.now() - 30 * DAY).toISOString()),
      supabaseAdmin.from('notifications')
        .select('id, sender_id, created_at')
        .eq('school_id', schoolId)
        .gte('created_at', new Date(Date.now() - 30 * DAY).toISOString()),
      supabaseAdmin.from('admission_leads')
        .select('id, status, created_at')
        .eq('school_id', schoolId)
        .gte('created_at', new Date(Date.now() - 30 * DAY).toISOString()),
      supabaseAdmin.from('users')
        .select('id, role, name')
        .eq('school_id', schoolId)
        .eq('status', 'pending'),
    ])

    const users        = usersRes.data        || []
    const marks        = marksRes.data        || []
    const tasks        = tasksRes.data        || []
    const submissions  = submissionsRes.data  || []
    const notifs       = notifsRes.data       || []
    const leads        = leadsRes.data        || []
    const pending      = pendingRes.data      || []

    const students = users.filter(u => u.role === 'student')
    const teachers = users.filter(u => u.role === 'teacher')
    const studentIds = new Set(students.map(s => s.id))
    const teacherIds = new Set(teachers.map(t => t.id))

    const byClass = {}
    for (const m of marks) {
      const stu = students.find(s => s.id === m.student_id)
      const cls = stu?.class_name || 'Unassigned'
      if (!byClass[cls]) byClass[cls] = { total: 0, max: 0, count: 0 }
      byClass[cls].total += parseFloat(m.marks_obtained) || 0
      byClass[cls].max   += parseFloat(m.total_marks)    || 0
      byClass[cls].count += 1
    }
    const classPerformance = Object.entries(byClass).map(([cls, d]) => ({
      class_name: cls,
      avg_pct:    d.max > 0 ? Math.round((d.total / d.max) * 100) : 0,
      exam_count: d.count,
    })).sort((a, b) => a.avg_pct - b.avg_pct)

    const weakClasses = classPerformance.filter(c => c.avg_pct < 60 && c.exam_count >= 3)

    const teacherTaskCount = {}
    for (const t of tasks) {
      if (teacherIds.has(t.created_by)) {
        teacherTaskCount[t.created_by] = (teacherTaskCount[t.created_by] || 0) + 1
      }
    }
    const teacherLoad = teachers.map(t => ({
      id:     t.id,
      name:   t.name || 'Unknown',
      tasks:  teacherTaskCount[t.id] || 0,
    })).sort((a, b) => b.tasks - a.tasks)

    const overloadedTeachers = teacherLoad.filter(t => t.tasks >= 8)

    const recentActiveStudents = new Set()
    for (const s of submissions) {
      if (studentIds.has(s.student_id) && (Date.now() - new Date(s.submitted_at).getTime()) < 14 * DAY) {
        recentActiveStudents.add(s.student_id)
      }
    }
    for (const m of marks) {
      if (studentIds.has(m.student_id) && (Date.now() - new Date(m.created_at).getTime()) < 14 * DAY) {
        recentActiveStudents.add(m.student_id)
      }
    }
    const inactiveStudents = students.filter(s => !recentActiveStudents.has(s.id))

    const now = Date.now()
    const inLast7 = (iso) => now - new Date(iso).getTime() < 7 * DAY
    const inPrior7 = (iso) => {
      const t = now - new Date(iso).getTime()
      return t >= 7 * DAY && t < 14 * DAY
    }
    const last7 = {
      marks:     marks.filter(m => inLast7(m.created_at)).length,
      tasks:     tasks.filter(t => inLast7(t.created_at)).length,
      subs:      submissions.filter(s => inLast7(s.submitted_at)).length,
      notifs:    notifs.filter(n => inLast7(n.created_at)).length,
    }
    const prior7 = {
      marks:     marks.filter(m => inPrior7(m.created_at)).length,
      tasks:     tasks.filter(t => inPrior7(t.created_at)).length,
      subs:      submissions.filter(s => inPrior7(s.submitted_at)).length,
      notifs:    notifs.filter(n => inPrior7(n.created_at)).length,
    }
    const trend = (curr, prev) => prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100)

    const leadFunnel = {
      new:       leads.filter(l => l.status === 'new').length,
      contacted: leads.filter(l => l.status === 'contacted').length,
      admitted:  leads.filter(l => l.status === 'admitted').length,
      rejected:  leads.filter(l => l.status === 'rejected').length,
    }

    let score = 100
    score -= weakClasses.length * 6
    score -= inactiveStudents.length > 0 ? Math.min(20, Math.round(inactiveStudents.length / Math.max(students.length, 1) * 100 * 0.3)) : 0
    score -= overloadedTeachers.length * 3
    score -= pending.length > 5 ? 5 : 0
    score = Math.max(0, Math.min(100, score))

    const alerts = []
    if (weakClasses.length > 0) {
      alerts.push({
        level: 'high',
        title: `${weakClasses.length} class${weakClasses.length === 1 ? '' : 'es'} below 60%`,
        body:  `Average performance is dropping in ${weakClasses.map(c => c.class_name).join(', ')}.`,
      })
    }
    if (inactiveStudents.length > students.length * 0.2 && students.length > 5) {
      alerts.push({
        level: 'high',
        title: `${inactiveStudents.length} students inactive (14d+)`,
        body:  'No marks or submissions logged. Consider reaching out.',
      })
    }
    if (overloadedTeachers.length > 0) {
      alerts.push({
        level: 'medium',
        title: `${overloadedTeachers.length} teacher${overloadedTeachers.length === 1 ? '' : 's'} overloaded`,
        body:  `Created 8+ tasks in 30 days: ${overloadedTeachers.map(t => t.name).join(', ')}.`,
      })
    }
    if (pending.length >= 5) {
      alerts.push({
        level: 'medium',
        title: `${pending.length} pending approvals`,
        body:  'New joiners are waiting. Approve them in the Pending tab.',
      })
    }
    if (trend(last7.subs, prior7.subs) < -30 && prior7.subs > 0) {
      alerts.push({
        level: 'medium',
        title: 'Submission rate dropping',
        body:  `${Math.abs(trend(last7.subs, prior7.subs))}% fewer submissions vs previous week.`,
      })
    }

    res.json({
      health_score: score,
      stats: {
        students:    students.length,
        teachers:    teachers.length,
        active_students:   recentActiveStudents.size,
        inactive_students: inactiveStudents.length,
        pending:     pending.length,
        marks_30d:   marks.length,
        tasks_30d:   tasks.length,
        subs_30d:    submissions.length,
      },
      classPerformance,
      weakClasses,
      teacherLoad,
      overloadedTeachers,
      inactiveStudents: inactiveStudents.slice(0, 12).map(s => ({
        id: s.id, class_name: s.class_name, last_login: s.last_login_at,
      })),
      engagement: { last7, prior7, trend: {
        marks:  trend(last7.marks,  prior7.marks),
        tasks:  trend(last7.tasks,  prior7.tasks),
        subs:   trend(last7.subs,   prior7.subs),
        notifs: trend(last7.notifs, prior7.notifs),
      }},
      leadFunnel,
      alerts,
    })
  } catch (e) {
    console.error('[school-health]', e.message)
    fail(res, req, e)
  }
})

export default router
