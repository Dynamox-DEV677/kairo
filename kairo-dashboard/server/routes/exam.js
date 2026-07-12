import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { aiCall, parseJSON } from '../utils/ai.js'

const router = Router()
router.use(requireAuth)

router.post('/predict', async (req, res) => {
  const {
    subject,
    class: cls = '10',
    board = 'CBSE',
    chapters = [],
    exam_type = 'board',
  } = req.body

  if (!subject) return res.status(400).json({ error: 'subject is required.' })

  try {
    const prompt = `You are a seasoned ${board} Class ${cls} ${subject} teacher who has analyzed 10+ years of board exam patterns.

Predict the most likely exam topics for the upcoming ${exam_type} exam.
${chapters.length ? `Focus on these chapters: ${chapters.join(', ')}` : ''}

Return ONLY valid JSON:
{
  "subject": "${subject}",
  "board": "${board}",
  "class": "${cls}",
  "exam_type": "${exam_type}",
  "high_probability": [
    {
      "topic": "topic name",
      "chapter": "chapter name",
      "probability": 92,
      "reason": "Appears in 8 of last 10 papers",
      "likely_question_types": ["long answer", "derivation"],
      "marks": 5
    }
  ],
  "medium_probability": [...],
  "low_but_important": [...],
  "sure_shot_formulas": ["formula1", "formula2"],
  "expected_paper_pattern": "brief description of expected format"
}

List at least 5 high, 5 medium, 3 low topics. Be specific and exam-focused. No markdown.`

    const raw = await aiCall({
      taskType: 'exam_predict',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2000,
    })

    res.json(parseJSON(raw))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/mock', async (req, res) => {
  const {
    subject,
    class: cls = '10',
    board = 'CBSE',
    chapters = [],
    total_marks = 40,
    duration_minutes = 90,
  } = req.body

  if (!subject) return res.status(400).json({ error: 'subject is required.' })

  try {
    const prompt = `Create a ${board} Class ${cls} ${subject} mock test.
${chapters.length ? `Chapters: ${chapters.join(', ')}` : ''}
Total marks: ${total_marks} | Duration: ${duration_minutes} minutes

Return ONLY valid JSON:
{
  "title": "...",
  "subject": "${subject}",
  "total_marks": ${total_marks},
  "duration_minutes": ${duration_minutes},
  "sections": [
    {
      "name": "Section A — Objective",
      "type": "mcq",
      "marks_per_question": 1,
      "questions": [
        {
          "qno": 1,
          "question": "...",
          "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
          "correct": "A",
          "explanation": "..."
        }
      ]
    },
    {
      "name": "Section B — Short Answer",
      "type": "short",
      "marks_per_question": 3,
      "questions": [
        { "qno": 1, "question": "...", "answer_key": "..." }
      ]
    },
    {
      "name": "Section C — Long Answer",
      "type": "long",
      "marks_per_question": 5,
      "questions": [
        { "qno": 1, "question": "...", "answer_key": "..." }
      ]
    }
  ]
}

No markdown, no extra text.`

    const raw = await aiCall({
      taskType: 'question_paper',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 3000,
    })

    res.json(parseJSON(raw))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
