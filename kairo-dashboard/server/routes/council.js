import { Router } from 'express'
import { aiCall, parseJSON } from '../utils/ai.js'

import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'

const router = Router()

/**
 * The brief served when the AI cannot be reached (pool cooling, quota) or
 * returns garbage. Built from the SAME request data — focus items come from
 * the student's real topic lists, nothing invented — and the fabricatable
 * fields (scores, motivation, trend) are omitted rather than guessed; the
 * client hides those cards when they are absent. Exported for tests.
 */
export function fallbackBrief({ name, weakTopics = [], strongTopics = [], nextExam = null, withDays = [] }) {
  const focusPool = (weakTopics.length ? weakTopics : strongTopics).slice(0, 3)
  return {
    fallback: true,
    greetingNote: `Hi ${name} — the AI mentors are busy right now, so today's plan is built straight from your own data.`,
    todaysFocus: focusPool.length
      ? focusPool.map(t => ({
          task: `30 focused minutes on ${t}`,
          subject: '',
          why: weakTopics.includes(t)
            ? 'It is on your weak-topic list — steady reps here move your score most.'
            : 'One of your strengths — one harder set turns good into exam-proof.',
        }))
      : [{
          task: 'Revise the last chapter you studied, then attempt 10 questions on it',
          subject: '',
          why: 'No topic data yet — finishing one clean loop today gives Kyno something real to plan from tomorrow.',
        }],
    mentorNote: nextExam
      ? `${nextExam.name} is ${nextExam.days} day${nextExam.days === 1 ? '' : 's'} out — one topic per day from your gap list covers it. Avoid starting anything brand-new today.`
      : 'Keep it small and finish it: one topic, one drill, one review. Avoid queueing more than you can close today.',
    mainWeakness: weakTopics[0] || null,
    examDates: withDays,
    nextExam,
    generatedAt: new Date().toISOString(),
  }
}

// Phase 0: was reachable with no token. These burn the Groq quota and touch
// student data; identity comes from the verified JWT only.
router.use(requireSupabaseAuth)

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
      maxTokens: 700,
      temperature: 0.6,
    })
    const brief = parseJSON(raw)
    // Garbage from the model gets the same data-built fallback as an outage —
    // a 502 here killed the whole Home screen over one malformed response.
    if (!brief) {
      console.error('[council] non-JSON from model, serving fallback')
      return res.json(fallbackBrief({ name, weakTopics, strongTopics, nextExam, withDays }))
    }
    brief.examDates = withDays
    brief.nextExam = nextExam
    brief.generatedAt = new Date().toISOString()
    return res.json(brief)
  } catch (err) {
    // The pool WILL have bad moments (429 cool-downs, quota resets). A 500
    // here killed the whole Home screen and invited refresh-hammering, which
    // makes the pool worse. Degrade instead: a brief computed from the SAME
    // request data. Focus items come from the student's real weak topics —
    // nothing invented — and the fabricatable fields (scores, motivation,
    // trend) are omitted rather than guessed; the client hides those cards.
    console.error('[council] brief failed, serving data-built fallback:', err.message)
    return res.json(fallbackBrief({ name, weakTopics, strongTopics, nextExam, withDays }))
  }
})

export default router
