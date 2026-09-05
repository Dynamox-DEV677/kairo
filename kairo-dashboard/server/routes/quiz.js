import { Router } from 'express'
import { fail } from '../lib/fail.js'
import { db } from '../db/index.js'
import { aiCall, parseJSON } from '../utils/ai.js'

import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'

const router = Router()

// Phase 0: was reachable with no token. These burn the Groq quota and touch
// student data; identity comes from the verified JWT only.
router.use(requireSupabaseAuth)
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

Mix difficulties: 30% easy, 50% medium, 20% hard. Make questions exam-style. No markdown.
Mathematics notation: use $...$ for inline math and $$...$$ for display math ONLY. Never use \\(...\\), \\[...\\], or bare LaTeX commands outside dollar delimiters.`

    const raw = await aiCall({
      taskType: 'quiz_generate',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2500,
    })

    /**
     * An empty or unreadable question set is DATA, not a server fault.
     *
     * This route has 500ed through four audits. A 500 tells the student
     * "something broke on our side" and tells us nothing, because the one
     * thing worth seeing -- what the model actually replied -- was never
     * logged. Now it is, truncated, on exactly the failing path.
     */
    let data = null
    try {
      data = parseJSON(raw)
    } catch (e) {
      console.error('[quiz/start] unparseable model reply',
        JSON.stringify({ subject, topic, len: (raw || '').length, head: String(raw || '').slice(0, 600) }))
      return res.status(200).json({
        session_id: 'local', total: 0, questions: [], first_question: null,
        reason: 'Kyno could not build questions for this topic just now.',
      })
    }
    const list = Array.isArray(data?.questions) ? data.questions.filter(Boolean) : []
    if (!list.length) {
      console.error('[quiz/start] model returned no questions',
        JSON.stringify({ subject, topic, keys: Object.keys(data || {}), head: String(raw || '').slice(0, 600) }))
      return res.status(200).json({
        session_id: 'local', total: 0, questions: [], first_question: null,
        reason: 'Kyno had no questions ready for this topic.',
      })
    }
    data.questions = list

    // The model can return prose, an empty list, or a shape with no questions
    // at all. data.questions.length then threw a TypeError, fail() turned it
    // into a bare 500, and the student saw "something is broken on our side"
    // while the Practice session silently dropped its question block and
    // jumped to the written answer. Check it, and say what actually happened.
    const questions = Array.isArray(data?.questions)
      ? data.questions.filter(q => q && (q.question || q.q))
      : []
    if (!questions.length) {
      return fail(res, req, new Error(`quiz/start produced no usable questions for ${subject}/${topic || 'any topic'} (model returned ${String(raw || '').length} chars)`), {
        status: 502,
        message: `Kyno could not write ${subject} questions just now. Nothing you did — try again in a minute.`,
      })
    }
    data.questions = questions

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
    fail(res, req, e)
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
    fail(res, req, e)
  }
})

router.get('/history', async (req, res) => {
  try {
    const sessions = await db.quizSessions?.findAsync?.({
      school_id: sid(req), status: 'completed'
    }) || []
    res.json(sessions.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)).slice(0, 50))
  } catch (e) {
    fail(res, req, e)
  }
})

/**
 * Audit task 6 — "this looks wrong" on any model-generated question.
 * Converts an invisible risk into a review stream. Requires the
 * question_reports table (server/db/2026-08-24_question_reports.sql); until
 * that migration runs, the endpoint answers { stored: false } and clients
 * keep the report queued locally.
 */
router.post('/report', async (req, res) => {
  const { question, options, claimed, source = 'unknown', note = '' } = req.body || {}
  if (!question || typeof question !== 'string') return res.status(400).json({ error: 'question required' })

  try {
    const { supabaseAdmin } = await import('../services/supabase.js')
    const { error } = await supabaseAdmin.from('question_reports').insert({
      user_id: req.user.id,
      source: String(source).slice(0, 40),
      question: String(question).slice(0, 2000),
      options: Array.isArray(options) ? options.slice(0, 6).map(o => String(o).slice(0, 500)) : null,
      claimed: claimed != null ? String(claimed).slice(0, 500) : null,
      note: String(note).slice(0, 1000),
    })
    if (error) {
      // 42P01 = table missing (migration not run yet). Say so honestly.
      console.warn('[quiz/report] insert failed:', error.code, error.message)
      return res.json({ stored: false, reason: error.code === '42P01' ? 'table-missing' : 'insert-failed' })
    }
    return res.json({ stored: true })
  } catch (e) {
    console.warn('[quiz/report]', e?.message)
    return res.json({ stored: false, reason: 'error' })
  }
})

export default router
