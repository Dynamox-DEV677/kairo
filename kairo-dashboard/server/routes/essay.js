import { Router } from 'express'
import { db } from '../db/index.js'
import { aiCall, parseJSON } from '../utils/ai.js'

const router = Router()

router.post('/grade', async (req, res) => {
  const {
    student_id,
    student_name,
    title,
    content,
    subject,
    word_limit = 0,
    board = 'CBSE',
    class: cls = '10',
  } = req.body

  if (!content || !subject) return res.status(400).json({ error: 'content and subject are required.' })
  if (content.length < 50) return res.status(400).json({ error: 'Essay too short (min 50 characters).' })

  try {
    const prompt = `You are an expert ${board} Class ${cls} ${subject} examiner.

Grade the following student essay/answer:

Title: ${title || '(untitled)'}
Word limit: ${word_limit || 'unspecified'}
---
${content.slice(0, 4000)}
---

Evaluate on these parameters and return ONLY valid JSON:
{
  "overall_score": 85,         // 0–100
  "grade": "B+",               // A+/A/B+/B/C/D/F
  "word_count": 250,
  "parameters": {
    "content_relevance":   { "score": 18, "max": 20, "feedback": "..." },
    "structure":           { "score": 16, "max": 20, "feedback": "..." },
    "grammar_language":    { "score": 17, "max": 20, "feedback": "..." },
    "vocabulary":          { "score": 15, "max": 20, "feedback": "..." },
    "critical_thinking":   { "score": 14, "max": 20, "feedback": "..." }
  },
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "topper_tips": "What a top scorer would do differently in 2–3 sentences",
  "revised_intro": "A rewritten first sentence showing better style"
}

Be fair but exam-standard strict. No markdown.`

    const raw = await aiCall({
      taskType: 'essay_grade',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1500,
    })

    const result = parseJSON(raw)

    const doc = await db.essays.insertAsync({
      school_id: req.body?.school_id || req.query?.school_id || 'demo_school',
      graded_by: 'system',
      student_id: student_id || null,
      student_name: student_name || null,
      title: title || '',
      content,
      subject,
      board,
      class: cls,
      word_limit,
      result,
      graded_at: new Date().toISOString(),
    })

    res.status(201).json(doc)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/', async (req, res) => {
  const { student_id, subject } = req.query
  const q = { school_id: req.body?.school_id || req.query?.school_id || 'demo_school' }
  if (student_id) q.student_id = student_id
  if (subject)    q.subject    = subject
  try {
    const essays = await db.essays.findAsync(q).sort({ graded_at: -1 }).limit(50)
    res.json(essays)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const essay = await db.essays.findOneAsync({ _id: req.params.id, school_id: req.body?.school_id || req.query?.school_id || 'demo_school' })
    if (!essay) return res.status(404).json({ error: 'Essay not found.' })
    res.json(essay)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
