/**
 * Analytics Routes
 *
 * GET  /api/analytics/weak-areas         Weak area detection from essays + quizzes
 * GET  /api/analytics/class-performance  Class-wide performance summary
 * POST /api/analytics/rank-predict       Predict board exam rank
 * GET  /api/analytics/study-today        Daily "What to study today" AI card
 * GET  /api/analytics/dashboard          Student performance dashboard summary
 */
import { Router } from 'express'
import { db } from '../db/index.js'
import { aiCall, parseJSON } from '../utils/ai.js'

const router = Router()
const sid = req => req.body?.school_id || req.query?.school_id || 'demo_school'

// ── Weak Area Detection ────────────────────────────────────────────────────────
router.get('/weak-areas', async (req, res) => {
  const { student_id } = req.query
  const schoolId = sid(req)

  try {
    // Gather data from essays and quizzes
    const essayQ = { school_id: schoolId }
    if (student_id) essayQ.student_id = student_id
    const essays = await db.essays?.findAsync?.(essayQ) || []

    const quizQ = { school_id: schoolId, status: 'completed' }
    if (student_id) quizQ.student_id = student_id
    const quizzes = await db.quizSessions?.findAsync?.(quizQ) || []

    const flashcardQ = { school_id: schoolId }
    if (student_id) flashcardQ.student_id = student_id
    const flashcards = await db.flashcards?.findAsync?.(flashcardQ) || []

    // Analyze subject performance
    const subjectScores = {}

    essays.forEach(e => {
      if (!e.subject || !e.result) return
      if (!subjectScores[e.subject]) subjectScores[e.subject] = { scores: [], type: 'essay' }
      subjectScores[e.subject].scores.push(e.result.overall_score || 0)
    })

    quizzes.forEach(q => {
      if (!q.subject || !q.percent) return
      const key = q.subject + (q.topic ? ` → ${q.topic}` : '')
      if (!subjectScores[key]) subjectScores[key] = { scores: [], type: 'quiz' }
      subjectScores[key].scores.push(q.percent)
    })

    // Hard flashcards
    const hardCards = flashcards.filter(f => f.repetitions <= 1 || f.easiness < 2.0)

    const weakAreas = Object.entries(subjectScores)
      .map(([subject, data]) => {
        const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length
        return { subject, avg_score: Math.round(avg), attempts: data.scores.length, type: data.type }
      })
      .filter(w => w.avg_score < 70)
      .sort((a, b) => a.avg_score - b.avg_score)

    const hardFlashTopics = [...new Set(hardCards.map(f => f.topic || f.front?.slice(0, 30)).filter(Boolean))].slice(0, 5)

    res.json({
      weak_areas: weakAreas,
      hard_flashcard_topics: hardFlashTopics,
      total_essays: essays.length,
      total_quizzes: quizzes.length,
      overall_health: weakAreas.length === 0 ? 'good' : weakAreas.length <= 2 ? 'moderate' : 'needs_attention',
      generated_at: new Date().toISOString(),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Class Performance Dashboard ────────────────────────────────────────────────
router.get('/class-performance', async (req, res) => {
  const schoolId = sid(req)
  const { class: cls } = req.query

  try {
    const studentQ = { school_id: schoolId }
    if (cls) studentQ.class = cls
    const students = await db.students?.findAsync?.(studentQ) || []

    const essays = await db.essays?.findAsync?.({ school_id: schoolId }) || []
    const quizzes = await db.quizSessions?.findAsync?.({ school_id: schoolId, status: 'completed' }) || []

    // Group by student
    const studentMap = {}
    students.forEach(s => {
      studentMap[s._id] = { name: s.name, class: s.class, essay_scores: [], quiz_scores: [] }
    })

    essays.forEach(e => {
      if (e.student_id && studentMap[e.student_id]) {
        studentMap[e.student_id].essay_scores.push(e.result?.overall_score || 0)
      }
    })

    quizzes.forEach(q => {
      if (q.student_id && studentMap[q.student_id]) {
        studentMap[q.student_id].quiz_scores.push(q.percent || 0)
      }
    })

    const performance = Object.entries(studentMap).map(([id, data]) => {
      const allScores = [...data.essay_scores, ...data.quiz_scores]
      const avg = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null
      return { student_id: id, ...data, avg_score: avg }
    }).filter(s => s.essay_scores.length + s.quiz_scores.length > 0)
      .sort((a, b) => (b.avg_score || 0) - (a.avg_score || 0))

    const subjectBreakdown = {}
    essays.forEach(e => {
      if (!e.subject) return
      if (!subjectBreakdown[e.subject]) subjectBreakdown[e.subject] = []
      subjectBreakdown[e.subject].push(e.result?.overall_score || 0)
    })

    const subjectAvgs = Object.entries(subjectBreakdown).map(([subject, scores]) => ({
      subject, avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), count: scores.length
    })).sort((a, b) => a.avg - b.avg)

    res.json({
      total_students: students.length,
      active_students: performance.length,
      class_average: performance.length ? Math.round(performance.reduce((a, b) => a + (b.avg_score || 0), 0) / performance.length) : 0,
      top_students: performance.slice(0, 5),
      needs_attention: performance.filter(s => s.avg_score < 60).slice(0, 5),
      subject_breakdown: subjectAvgs,
      generated_at: new Date().toISOString(),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Rank Predictor ─────────────────────────────────────────────────────────────
router.post('/rank-predict', async (req, res) => {
  const {
    scores,          // [{ subject, score, max }]
    class: cls = '10', board = 'CBSE',
    exam_type = 'board',
  } = req.body
  if (!scores?.length) return res.status(400).json({ error: 'scores[] is required.' })

  try {
    const totalObtained = scores.reduce((s, x) => s + x.score, 0)
    const totalMax = scores.reduce((s, x) => s + x.max, 0)
    const percent = Math.round((totalObtained / totalMax) * 100)

    const prompt = `You are an expert ${board} Class ${cls} exam analyst.

A student scored:
${scores.map(s => `- ${s.subject}: ${s.score}/${s.max}`).join('\n')}
Total: ${totalObtained}/${totalMax} (${percent}%)
Exam type: ${exam_type}

Predict their likely:
1. Rank range in school (e.g., top 5%, top 20%)
2. State rank percentile
3. Expected grade
4. Likely college options if Class 12
5. Specific advice to improve rank

Return ONLY valid JSON:
{
  "total_score": ${totalObtained},
  "total_max": ${totalMax},
  "percentage": ${percent},
  "grade": "A+",
  "school_rank_estimate": "Top 10-15%",
  "state_percentile": "Top 20%",
  "expected_band": "Distinction",
  "college_options": ["...", "..."],
  "subject_analysis": [
    { "subject": "...", "score": 85, "performance": "good", "tip": "..." }
  ],
  "improvement_tips": ["tip1", "tip2", "tip3"],
  "predicted_final_score": 92
}`

    const raw = await aiCall({
      taskType: 'rank_predict',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1000,
    })

    const prediction = parseJSON(raw)
    res.json(prediction)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Daily "What to Study Today" Card ──────────────────────────────────────────
router.get('/study-today', async (req, res) => {
  const schoolId = sid(req)
  const { class: cls = '10', board = 'CBSE', exam_date } = req.query

  try {
    // Get weak areas
    const essays = await db.essays?.findAsync?.({ school_id: schoolId }) || []
    const quizzes = await db.quizSessions?.findAsync?.({ school_id: schoolId, status: 'completed' }) || []
    const plans = await db.studyPlans?.findAsync?.({ school_id: schoolId }) || []

    const today = new Date().toISOString().slice(0, 10)
    const dayOfWeek = new Date().toLocaleDateString('en-IN', { weekday: 'long' })

    // Find weak subjects
    const subjectScores = {}
    essays.forEach(e => {
      if (!e.subject) return
      if (!subjectScores[e.subject]) subjectScores[e.subject] = []
      subjectScores[e.subject].push(e.result?.overall_score || 0)
    })
    quizzes.forEach(q => {
      if (!q.subject) return
      if (!subjectScores[q.subject]) subjectScores[q.subject] = []
      subjectScores[q.subject].push(q.percent || 0)
    })

    const weakSubjects = Object.entries(subjectScores)
      .map(([s, scores]) => ({ subject: s, avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) }))
      .filter(s => s.avg < 70)
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 3)

    // Check today's tasks from active study plans
    const todayTasks = []
    for (const plan of plans.slice(0, 3)) {
      const week = plan.plan?.weeks?.find(w => w.days?.some(d => d.date === today))
      if (week) {
        const day = week.days?.find(d => d.date === today)
        if (day) todayTasks.push(...(day.tasks || []))
      }
    }

    const prompt = `You are a motivating AI study coach for ${board} Class ${cls} students.

Today is ${dayOfWeek}, ${today}.
${exam_date ? `The student has an exam on ${exam_date}.` : ''}
${weakSubjects.length > 0 ? `Weak subjects: ${weakSubjects.map(s => `${s.subject} (${s.avg}%)`).join(', ')}` : 'No weak subjects identified yet.'}
${todayTasks.length > 0 ? `Today's study plan tasks: ${todayTasks.map(t => `${t.subject} - ${t.topic} (${t.hours}h)`).join(', ')}` : ''}

Generate a personalized "Today's Study Card". Return ONLY valid JSON:
{
  "greeting": "Motivating good morning message (1 sentence)",
  "focus_subject": "Most important subject today",
  "focus_topic": "Specific topic to focus on",
  "priority_tasks": [
    { "task": "Task description", "duration": "45 min", "type": "study" }
  ],
  "quick_win": "One easy topic they can finish in 15 mins to build confidence",
  "motivation_quote": "Short inspiring study quote",
  "daily_goal": "Clear goal for today in 1 sentence",
  "pomodoro_plan": "25 min study + 5 min break recommendation"
}`

    const raw = await aiCall({
      taskType: 'study_today',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 600,
    })

    const card = parseJSON(raw)
    res.json({ ...card, date: today, day: dayOfWeek, weak_subjects: weakSubjects })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
