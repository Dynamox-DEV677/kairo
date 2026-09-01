import { Router } from 'express'
import { fail } from '../lib/fail.js'
import { db } from '../db/index.js'
import { aiCall } from '../utils/ai.js'

import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'

const router = Router()

// Phase 0: was reachable with no token. These burn the Groq quota and touch
// student data; identity comes from the verified JWT only.
router.use(requireSupabaseAuth)
const sid = req => req.body?.school_id || req.query?.school_id || 'demo_school'

router.post('/simplify', async (req, res) => {
  const {
    concept, subject = 'General', level = 'class8',
    class: cls = '10', board = 'CBSE',
  } = req.body
  if (!concept) return res.status(400).json({ error: 'concept is required.' })

  const levelLabel = {
    class5:  'a Class 5 student (age 10, very simple words, fun analogies)',
    class8:  'a Class 8 student (age 13, basic science knowledge)',
    class12: 'a Class 12 student (almost undergraduate level)',
  }[level] || 'a Class 8 student'

  try {
    const prompt = `Explain the following ${subject} concept to ${levelLabel}.

Concept: "${concept}"

Use:
- Simple language appropriate for the level
- A real-life analogy or example they can relate to
- Short sentences and clear structure
- If needed, a simple metaphor

Keep it under 150 words. No markdown headers.`

    const explanation = await aiCall({
      taskType: 'concept_simplify',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 400,
    })

    res.json({ concept, level, explanation, subject })
  } catch (e) {
    fail(res, req, e)
  }
})

router.post('/mindmap', async (req, res) => {
  const { chapter, subject = 'General', class: cls = '10', board = 'CBSE' } = req.body
  if (!chapter) return res.status(400).json({ error: 'chapter is required.' })

  try {
    const prompt = `You are an expert ${board} Class ${cls} ${subject} teacher.

Create a comprehensive text-based mindmap for the chapter: "${chapter}"

Return ONLY valid JSON:
{
  "title": "${chapter}",
  "subject": "${subject}",
  "nodes": [
    {
      "id": "root",
      "label": "${chapter}",
      "children": [
        {
          "id": "n1",
          "label": "Main Topic 1",
          "color": "#818cf8",
          "children": [
            { "id": "n1a", "label": "Subtopic A", "children": [] },
            { "id": "n1b", "label": "Subtopic B", "children": [] }
          ]
        }
      ]
    }
  ],
  "key_formulas": ["formula1", "formula2"],
  "important_terms": ["term1", "term2"],
  "exam_tips": "2-sentence tip for this chapter in exams"
}

Create at least 4 main topics, each with 2-4 subtopics. No markdown.`

    const raw = await aiCall({
      taskType: 'concept_mindmap',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1500,
    })

    let mindmap
    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      mindmap = JSON.parse(cleaned)
    } catch {
      mindmap = { title: chapter, subject, nodes: [], key_formulas: [], important_terms: [], exam_tips: raw }
    }

    const doc = await db.mindmaps?.insertAsync?.({
      school_id: sid(req), chapter, subject, board, class: cls,
      mindmap, created_at: new Date().toISOString(),
    }).catch(() => null)

    res.status(201).json({ ...mindmap, id: doc?._id })
  } catch (e) {
    fail(res, req, e)
  }
})

router.post('/doubt', async (req, res) => {
  const { question, subject = 'General', class: cls = '10', board = 'CBSE' } = req.body
  if (!question) return res.status(400).json({ error: 'question is required.' })

  try {
    const prompt = `You are an expert ${board} Class ${cls} ${subject} teacher.

Answer this student doubt clearly and completely:

"${question}"

Provide:
1. Direct answer (2-3 sentences)
2. Detailed explanation with example
3. Key point to remember for exams
4. Common mistake students make

Keep it educational and encouraging.`

    const answer = await aiCall({
      taskType: 'concept_doubt',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 600,
    })

    const doc = await db.doubts?.insertAsync?.({
      school_id: sid(req), question, answer, subject, board, class: cls,
      created_at: new Date().toISOString(),
    }).catch(() => null)

    res.status(201).json({ question, answer, id: doc?._id })
  } catch (e) {
    fail(res, req, e)
  }
})

router.get('/doubts', async (req, res) => {
  const { subject, search } = req.query
  const q = { school_id: sid(req) }
  if (subject) q.subject = subject
  try {
    let doubts = await db.doubts?.findAsync?.(q) || []
    doubts = doubts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 100)
    if (search) {
      const s = search.toLowerCase()
      doubts = doubts.filter(d => d.question?.toLowerCase().includes(s) || d.answer?.toLowerCase().includes(s))
    }
    res.json(doubts)
  } catch (e) {
    fail(res, req, e)
  }
})

export default router
