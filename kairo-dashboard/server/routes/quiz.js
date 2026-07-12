import { Router } from 'express'
import { db } from '../db/index.js'
import { aiCall, parseJSON } from '../utils/ai.js'

const router = Router()
const sid = req => req.body?.school_id || req.query?.school_id || 'demo_school'

router.post('/start', async (req, res) => {
  const {
    subject, topic = '', class: cls = '10', board = 'CBSE',
    difficulty = 'medium',
    total_questions = 10,
  } = req.body
  if (!subject) return res.status(400).json({ error: 'subject is required.' })

  try {
    const prompt = `You are an expert ${board} Class ${cls} ${subject} quiz maker.

Generate ${Math.min(total_questions, 15)} MCQ questions${topic ? ` on the topic "${topic}"` : ''} at ${difficulty} difficulty level.

Return ONLY valid JSON:
{
  "questions": [
    {
      "id": 1,
      "question": "Question text?",
      "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
      "correct": "A",
      "explanation": "Brief explanation of why A is correct",
      "difficulty": "easy",
      "topic": "subtopic name"
    }
  ]
}

Mix difficulties: 30% easy, 50% medium, 20% hard. Make questions exam-style. No markdown.`

    const raw = await aiCall({
      taskType: 'quiz_generate',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2500,
    })

    const data = parseJSON(raw)

    const session = await db.quizSessions?.insertAsync?.({
      school_id: sid(req), subject, topic, board, class: cls,
      questions: data.questions, answers: [], current_index: 0,
      score: 0, difficulty, status: 'active',
      started_at: new Date().toISOString(),
    }).catch(() => ({ _id: null, questions: data.questions }))

    res.status(201).json({
      session_id: session._id || 'local',
      total: data.questions.length,
      first_question: data.questions[0],
      questions: data.questions,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/answer', async (req, res) => {
  const { session_id, question_index, answer, correct, score, total } = req.body
  if (session_id && session_id !== 'local') {
    try {
      const session = await db.quizSessions?.findOneAsync?.({ _id: session_id })
      if (session) {
        const answers = [...(session.answers || []), { question_index, answer, correct }]
        const newScore = answers.filter(a => a.correct).length
        await db.quizSessions?.updateAsync?.({ _id: session_id }, {
          $set: { answers, score: newScore, current_index: question_index + 1 }
        })
      }
    } catch {}
  }
  res.json({ recorded: true })
})

router.post('/complete', async (req, res) => {
  const { session_id, score, total, answers, subject, topic } = req.body

  try {
    const percent = Math.round((score / total) * 100)
    const grade = percent >= 90 ? 'A+' : percent >= 80 ? 'A' : percent >= 70 ? 'B+' : percent >= 60 ? 'B' : percent >= 50 ? 'C' : 'D'

    if (session_id && session_id !== 'local') {
      await db.quizSessions?.updateAsync?.({ _id: session_id }, {
        $set: { status: 'completed', score, total, percent, grade, completed_at: new Date().toISOString() }
      }).catch(() => null)
    }

    const xpEarned = Math.round(score * 10 + (percent >= 80 ? 50 : 0))
    await db.gamification?.updateAsync?.(
      { school_id: sid(req) },
      { $inc: { xp: xpEarned, quizzes_completed: 1 } },
      { upsert: true }
    ).catch(() => null)

    res.json({ score, total, percent, grade, xp_earned: xpEarned })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/history', async (req, res) => {
  try {
    const sessions = await db.quizSessions?.findAsync?.({
      school_id: sid(req), status: 'completed'
    }) || []
    res.json(sessions.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)).slice(0, 50))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
