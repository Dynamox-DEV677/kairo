import { Router } from 'express'
import { db } from '../db/index.js'
import { aiCall, parseJSON } from '../utils/ai.js'

const router = Router()
const sid = req => req.body?.school_id || req.query?.school_id || 'demo_school'

const sleep = ms => new Promise(r => setTimeout(r, ms))

router.post('/bulk', async (req, res) => {
  const {
    assignments,
    subject, question, max_marks = 10,
    class: cls = '10', board = 'CBSE',
    rubric = '',
  } = req.body

  if (!assignments?.length) return res.status(400).json({ error: 'assignments[] required.' })
  if (!subject || !question) return res.status(400).json({ error: 'subject and question required.' })

  try {
    const results = []
    for (const assignment of assignments.slice(0, 30)) {
      if (!assignment.content || assignment.content.length < 10) {
        results.push({ student_name: assignment.student_name, student_id: assignment.student_id, error: 'Empty submission' })
        continue
      }

      const prompt = `You are an expert ${board} Class ${cls} ${subject} examiner.

Question: "${question}"
Max marks: ${max_marks}
${rubric ? `Marking scheme: ${rubric}` : ''}

Grade this student answer:
---
${assignment.content.slice(0, 2000)}
---

Return ONLY valid JSON:
{
  "marks": ${max_marks * 0.75},
  "percentage": 75,
  "grade": "B+",
  "feedback": "Personalized feedback (2-3 sentences)",
  "strengths": ["strength1"],
  "improvements": ["improvement1"],
  "model_answer_hint": "What a full-marks answer would include"
}`

      try {
        const raw = await aiCall({
          taskType: 'essay_grade',
          messages: [{ role: 'user', content: prompt }],
          maxTokens: 500,
        })
        const graded = parseJSON(raw)
        results.push({ student_name: assignment.student_name, student_id: assignment.student_id, ...graded })
      } catch (e) {
        results.push({ student_name: assignment.student_name, student_id: assignment.student_id, error: e.message })
      }
      await sleep(300)
    }

    const validResults = results.filter(r => !r.error)
    const classAvg = validResults.length
      ? Math.round(validResults.reduce((s, r) => s + (r.percentage || 0), 0) / validResults.length)
      : 0

    const session = await db.gradingSessions?.insertAsync?.({
      school_id: sid(req), subject, question, max_marks, board, class: cls,
      results, class_average: classAvg, total: assignments.length,
      graded: validResults.length, created_at: new Date().toISOString(),
    }).catch(() => null)

    res.status(201).json({
      id: session?._id, results, class_average: classAvg,
      total: assignments.length, graded: validResults.length,
      failed: results.length - validResults.length,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/feedback', async (req, res) => {
  const {
    student_name, subject, scores,
    class: cls = '10', board = 'CBSE',
  } = req.body
  if (!scores?.length) return res.status(400).json({ error: 'scores[] required.' })

  try {
    const prompt = `You are a supportive ${board} Class ${cls} ${subject} teacher.

Generate personalized feedback for ${student_name || 'the student'} based on their performance:
${scores.map(s => `- ${s.topic}: ${s.score}/${s.max}`).join('\n')}

Return a motivating, specific, actionable feedback message (3-4 paragraphs) that:
1. Acknowledges their strengths
2. Addresses specific weak areas
3. Gives concrete study tips
4. Ends with encouragement

Be warm and encouraging. No JSON needed — just the feedback text.`

    const feedback = await aiCall({
      taskType: 'ai_feedback',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 600,
    })

    res.json({ student_name, feedback })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/results', async (req, res) => {
  try {
    const sessions = await db.gradingSessions?.findAsync?.({ school_id: sid(req) }) || []
    res.json(sessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 30))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
