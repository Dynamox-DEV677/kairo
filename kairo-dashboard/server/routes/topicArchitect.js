import { Router } from 'express'
import { fail } from '../lib/fail.js'
import { aiCall, parseJSON } from '../utils/ai.js'

import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'

const router = Router()

// Phase 0: was reachable with no token. These burn the Groq quota and touch
// student data; identity comes from the verified JWT only.
router.use(requireSupabaseAuth)

const EXAM_CONTEXT = {
  neet: 'NEET (Indian medical entrance) — NCERT-rooted, single-correct MCQs, heavy Biology weight, no negative-marking surprises beyond standard -1.',
  jee:  'JEE Main/Advanced (Indian engineering entrance) — conceptual + numerical, single & multi-correct, assertion-reason, high rigour in Physics/Maths.',
  boards: 'CBSE/State board exams — descriptive answers, derivations, diagrams, stepwise marking.',
  general: 'general competitive prep — a balanced mix of conceptual and applied questions.',
}

router.post('/plan', async (req, res) => {
  const { topic, exam = 'neet', depth = 'standard' } = req.body || {}
  if (!topic || !topic.trim()) {
    return res.status(400).json({ error: 'topic is required.' })
  }
  const examCtx = EXAM_CONTEXT[exam] || EXAM_CONTEXT.general
  const qCount = depth === 'deep' ? 8 : 5

  const prompt = `You are the head of academics at India's sharpest ${exam.toUpperCase()} coaching institute.
A student gives you ONE topic. You return a complete, ruthless prep dossier — what matters, what doesn't, and exactly how it gets tested.

Topic: "${topic}"
Exam context: ${examCtx}

Return ONLY valid JSON in EXACTLY this shape — no markdown, no commentary:
{
  "topic": "${topic}",
  "subject": "the subject this falls under (e.g. Physics, Biology)",
  "examImportance": "HIGH | MEDIUM | LOW",
  "examWeightPercent": <approx % of the paper this topic + its cluster covers, integer>,
  "oneLineVerdict": "a blunt one-sentence verdict on how much to invest here",
  "whatToStudy": [
    { "point": "specific sub-topic to master", "why": "why it matters for the exam" }
  ],
  "whatToSkip": [
    { "point": "sub-topic that's low-yield or out of syllabus", "why": "why it's safe to skip or skim" }
  ],
  "mustKnowConcepts": [ "core concept 1", "core concept 2", "..." ],
  "conceptMap": {
    "nodes": [ { "id": "n1", "label": "central idea" }, { "id": "n2", "label": "sub idea" } ],
    "links": [ { "from": "n1", "to": "n2", "label": "relationship" } ]
  },
  "practiceQuestions": [
    {
      "q": "the question text",
      "type": "MCQ | numerical | assertion-reason",
      "options": ["A ...","B ...","C ...","D ..."],
      "answer": "the correct option or value",
      "explanation": "1-2 line why",
      "difficulty": "easy | medium | hard"
    }
  ],
  "pyqInsights": {
    "frequency": "how often this appears (e.g. 'every year', '1 in 2 years')",
    "typicalFormat": "how it's usually asked",
    "commonTraps": "the mistakes students make",
    "tip": "one high-leverage tip from past papers"
  },
  "studyOrder": [ "step 1", "step 2", "step 3" ],
  "estimatedHours": <integer hours to get exam-ready on this topic>
}

Rules:
- Generate exactly ${qCount} practice questions, mixing difficulties, exam-appropriate.
- conceptMap: 5-8 nodes, real relationships in the links.
- whatToStudy: 4-6 items. whatToSkip: 2-4 items (be honest about low-yield material).
- Keep everything specific to "${topic}" — no generic filler.
- mustKnowConcepts: 5-8 crisp items.`

  try {
    const raw = await aiCall({
      taskType: 'study_plan',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 4000,
      temperature: 0.5,
    })
    const plan = parseJSON(raw)
    if (!plan) {
      return res.status(502).json({ error: 'AI returned non-JSON', raw: raw?.slice(0, 800) })
    }
    plan.exam = exam
    plan.generatedAt = new Date().toISOString()
    return res.json(plan)
  } catch (err) {
    console.error('[topic-architect] plan failed:', err)
    return fail(res, req, err)
  }
})

router.post('/questions', async (req, res) => {
  const { topic, exam = 'neet', count = 5, difficulty = 'mixed' } = req.body || {}
  if (!topic || !topic.trim()) return res.status(400).json({ error: 'topic is required.' })
  const n = Math.min(20, Math.max(1, count))
  const examCtx = EXAM_CONTEXT[exam] || EXAM_CONTEXT.general

  const prompt = `You are an expert ${exam.toUpperCase()} question setter. Context: ${examCtx}
Generate ${n} exam-style questions on: "${topic}". Difficulty: ${difficulty}.

Return ONLY a JSON array. Each item:
{ "q":"...", "type":"MCQ|numerical|assertion-reason", "options":["A ...","B ...","C ...","D ..."], "answer":"...", "explanation":"1-2 lines", "difficulty":"easy|medium|hard" }

For numerical questions, "options" may be an empty array. Exactly ${n} items. No markdown.`

  try {
    const raw = await aiCall({
      taskType: 'question_paper',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 3000,
      temperature: 0.6,
    })
    const qs = parseJSON(raw)
    if (!Array.isArray(qs)) return res.status(502).json({ error: 'AI did not return an array', raw: raw?.slice(0, 600) })
    return res.json({ topic, exam, count: qs.length, questions: qs })
  } catch (err) {
    console.error('[topic-architect] questions failed:', err)
    return fail(res, req, err)
  }
})

export default router
