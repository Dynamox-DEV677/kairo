/**
 * AI Council — the "team of mentors studying you."
 *
 * POST /api/council/brief
 *   Body: a student-profile snapshot:
 *     { name, exam, examDates:[{name,date}], goal,
 *       weakTopics:[..], strongTopics:[..], streak, recentAccuracy }
 *   Returns the daily command-center brief:
 *     { greetingNote, todaysFocus:[{task,subject,why}], mentorNote,
 *       predictedScore, potentialScore, mainWeakness, motivation }
 *
 * One endpoint plays all six council roles (Mentor, Planner, Analyst,
 * Exam, Motivation, Memory) by synthesising the profile into a single
 * actionable brief — cheaper + faster than six separate calls, same feel.
 */
import { Router } from 'express'
import { aiCall, parseJSON } from '../utils/ai.js'

const router = Router()

router.post('/brief', async (req, res) => {
  const {
    name = 'Student',
    exam = 'jee',
    examDates = [],
    goal = '',
    weakTopics = [],
    strongTopics = [],
    streak = 0,
    recentAccuracy = null,
    studyHours = 4,
  } = req.body || {}

  // Nearest exam + days remaining (computed server-side, not by the AI,
  // so the countdown is always exact).
  const today = new Date().toISOString().slice(0, 10)
  const withDays = (examDates || [])
    .filter(e => e && e.date)
    .map(e => ({ ...e, days: Math.max(0, Math.round((new Date(e.date) - new Date(today)) / 86400000)) }))
    .sort((a, b) => a.days - b.days)
  const nextExam = withDays[0] || null

  const prompt = `You are the AI Council inside Kyno — a team of six mentors (Mentor, Planner, Analyst, Exam strategist, Motivation coach, Memory keeper) studying ONE student. Produce today's command-center brief.

Student: ${name}
Primary exam: ${exam.toUpperCase()}
${nextExam ? `Nearest exam: ${nextExam.name} in ${nextExam.days} days` : 'No exam date set'}
Current goal: ${goal || 'not set'}
Weak topics: ${weakTopics.length ? weakTopics.join(', ') : 'unknown'}
Strong topics: ${strongTopics.length ? strongTopics.join(', ') : 'unknown'}
Study streak: ${streak} days
Recent accuracy: ${recentAccuracy != null ? recentAccuracy + '%' : 'unknown'}
Daily study capacity: ${studyHours} hours

Return ONLY valid JSON, no markdown:
{
  "greetingNote": "one warm, specific sentence acknowledging where they are right now",
  "todaysFocus": [
    { "task": "concrete action e.g. '20 Rotational Motion MCQs'", "subject": "Physics", "why": "short reason tied to their weakness or exam" }
  ],
  "mentorNote": "2-3 sentences of sharp, faculty-grade guidance for TODAY — what to prioritise and one thing to avoid",
  "predictedScore": <integer — realistic current score on their exam's scale given accuracy + weaknesses>,
  "potentialScore": <integer — achievable score if they fix their main weakness, higher than predicted>,
  "scoreScale": "<the exam's max, e.g. '300' for JEE Main, '720' for NEET'>",
  "mainWeakness": "the single highest-priority topic to fix",
  "motivation": <integer 0-100 — a motivation/confidence meter given streak + trend>,
  "trend": "improving | steady | dipping"
}

Rules:
- todaysFocus: 3-4 items, fit within ${studyHours} hours, weight toward weak topics.
- Be specific and exam-real. No generic filler like "study hard".
- predictedScore < potentialScore. Use the correct scale for ${exam.toUpperCase()}.`

  try {
    const raw = await aiCall({
      taskType: 'study_plan',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1600,
      temperature: 0.6,
    })
    const brief = parseJSON(raw)
    if (!brief) return res.status(502).json({ error: 'AI returned non-JSON', raw: raw?.slice(0, 600) })
    // Attach the exact server-computed countdowns so the UI never drifts.
    brief.examDates = withDays
    brief.nextExam = nextExam
    brief.generatedAt = new Date().toISOString()
    return res.json(brief)
  } catch (err) {
    console.error('[council] brief failed:', err)
    return res.status(500).json({ error: err.message })
  }
})

export default router
