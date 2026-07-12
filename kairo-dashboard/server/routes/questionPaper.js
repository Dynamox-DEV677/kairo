import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { aiCall, parseJSON } from '../utils/ai.js'

const router = Router()
router.use(requireAuth)

router.post('/generate', async (req, res) => {
  const {
    subject,
    class: cls = '10',
    board = 'CBSE',
    chapters = [],
    total_marks = 80,
    duration_minutes = 180,
    difficulty = 'mixed',
    include_answer_key = true,
    question_types = ['mcq', 'short', 'long', 'assertion_reason'],
  } = req.body

  if (!subject) return res.status(400).json({ error: 'subject is required.' })

  try {
    const prompt = `You are a senior ${board} Class ${cls} ${subject} paper setter.

Create a complete question paper following these specs:
- Total marks: ${total_marks}
- Duration: ${duration_minutes} minutes
- Chapters: ${chapters.length ? chapters.join(', ') : 'All chapters'}
- Difficulty: ${difficulty}
- Question types to include: ${question_types.join(', ')}

Return ONLY valid JSON in this format:
{
  "title": "${board} Class ${cls} ${subject} — Sample Paper",
  "subject": "${subject}",
  "class": "${cls}",
  "board": "${board}",
  "total_marks": ${total_marks},
  "duration_minutes": ${duration_minutes},
  "general_instructions": ["...", "..."],
  "sections": [
    {
      "name": "Section A",
      "type": "mcq",
      "description": "Choose the correct option",
      "marks_per_question": 1,
      "questions": [
        {
          "qno": 1,
          "question": "...",
          "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
          "marks": 1,
          "chapter": "...",
          "difficulty": "easy",
          "answer": "A",
          "explanation": "..."
        }
      ]
    },
    {
      "name": "Section B",
      "type": "short",
      "description": "Short answer questions",
      "marks_per_question": 3,
      "questions": [
        {
          "qno": 1,
          "question": "...",
          "marks": 3,
          "chapter": "...",
          "difficulty": "medium",
          "answer_key": "..."
        }
      ]
    },
    {
      "name": "Section C",
      "type": "long",
      "description": "Long answer questions",
      "marks_per_question": 5,
      "questions": [
        {
          "qno": 1,
          "question": "...",
          "marks": 5,
          "chapter": "...",
          "difficulty": "hard",
          "answer_key": "...",
          "value_points": ["point 1", "point 2"]
        }
      ]
    }
  ],
  "marking_scheme_notes": "..."
}

Ensure total marks add up to exactly ${total_marks}. No markdown, no extra text.`

    const raw = await aiCall({
      taskType: 'question_paper',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 4000,
      temperature: 0.6,
    })

    res.json(parseJSON(raw))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
