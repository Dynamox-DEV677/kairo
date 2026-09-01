import { Router } from 'express'
import { fail } from '../lib/fail.js'
import { requireSupabaseAuth, requireRole } from '../middleware/supabaseAuth.js'
import { aiCall, parseJSON } from '../utils/ai.js'

const router = Router()
router.use(requireSupabaseAuth)
// Sec 3.5: no UI ships for these in v1, so the role check is the only thing
// standing in front of them. A student token must not reach a teacher tool.
router.use(requireRole('teacher', 'admin'))

router.post('/generate', async (req, res) => {
  const {
    subject,
    topic,
    class: cls = '10',
    board = 'CBSE',
    duration_minutes = 45,
    teaching_style = 'interactive',
    has_smartboard = false,
  } = req.body

  if (!subject || !topic) return res.status(400).json({ error: 'subject and topic are required.' })

  try {
    const prompt = `You are an expert ${board} Class ${cls} ${subject} teacher.

Create a detailed lesson plan for the topic: "${topic}"
Class duration: ${duration_minutes} minutes
Teaching style: ${teaching_style}
Has smart board: ${has_smartboard}

Return ONLY valid JSON:
{
  "topic": "${topic}",
  "subject": "${subject}",
  "class": "${cls}",
  "board": "${board}",
  "duration_minutes": ${duration_minutes},
  "learning_objectives": ["By end of class, students will be able to...", "..."],
  "prerequisites": ["What students should already know..."],
  "materials_needed": ["textbook", "..."],
  "lesson_phases": [
    {
      "phase": "Introduction / Hook",
      "duration_minutes": 5,
      "activity": "...",
      "teacher_action": "...",
      "student_action": "...",
      "key_questions": ["..."]
    },
    {
      "phase": "Concept Explanation",
      "duration_minutes": 15,
      "activity": "...",
      "teacher_action": "...",
      "student_action": "...",
      "key_questions": ["..."]
    },
    {
      "phase": "Guided Practice",
      "duration_minutes": 10,
      "activity": "...",
      "teacher_action": "...",
      "student_action": "...",
      "key_questions": ["..."]
    },
    {
      "phase": "Independent Practice",
      "duration_minutes": 10,
      "activity": "...",
      "teacher_action": "...",
      "student_action": "...",
      "key_questions": ["..."]
    },
    {
      "phase": "Closure / Summary",
      "duration_minutes": 5,
      "activity": "...",
      "teacher_action": "...",
      "student_action": "...",
      "key_questions": ["..."]
    }
  ],
  "homework": "Specific homework assignment with page numbers / problem numbers",
  "assessment_strategy": "How to check if students understood",
  "bloom_levels_covered": ["Remember", "Understand", "Apply"],
  "differentiation": {
    "for_advanced": "...",
    "for_struggling": "..."
  },
  "common_misconceptions": ["..."],
  "board_exam_connection": "How this topic appears in board exams"
}

No markdown, no extra text.`

    const raw = await aiCall({
      taskType: 'lesson_plan',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2500,
    })

    res.json(parseJSON(raw))
  } catch (e) {
    fail(res, req, e)
  }
})

export default router
