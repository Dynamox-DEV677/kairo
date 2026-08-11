import { Router } from 'express'
import { db } from '../db/index.js'
import { aiCall } from '../utils/ai.js'

import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'

const router = Router()

// Phase 0: was reachable with no token. These burn the Groq quota and touch
// student data; identity comes from the verified JWT only.
router.use(requireSupabaseAuth)
const sid = req => req.body?.school_id || req.query?.school_id || 'demo_school'

router.post('/improve', async (req, res) => {
  const { text, tone = 'formal', subject = 'General', class: cls = '10', board = 'CBSE' } = req.body
  if (!text || text.length < 10) return res.status(400).json({ error: 'text required (min 10 chars).' })

  try {
    const prompt = `You are an expert ${board} Class ${cls} ${subject} writing coach.

Improve the following student answer by changing the tone to "${tone}". Keep the core meaning and facts exactly the same.

Tone guidelines:
- formal: Academic, structured, professional language
- friendly: Warm, conversational but still accurate
- exam: Precise, to-the-point, examiner-friendly with keywords highlighted

Original text:
---
${text.slice(0, 3000)}
---

Return ONLY the improved version. No explanations, no markdown.`

    const improved = await aiCall({
      taskType: 'writing_improve',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1000,
    })

    const doc = await db.writingSessions?.insertAsync?.({
      school_id: sid(req), type: 'improve', original: text,
      result: improved, tone, subject, created_at: new Date().toISOString(),
    }).catch(() => null)

    res.json({ original: text, improved, tone, id: doc?._id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/expand', async (req, res) => {
  const { text, subject = 'General', target_words = 200, class: cls = '10', board = 'CBSE' } = req.body
  if (!text || text.length < 10) return res.status(400).json({ error: 'text required.' })

  try {
    const prompt = `You are an expert ${board} Class ${cls} ${subject} examiner.

Expand the following short answer into a comprehensive ${target_words}-word answer suitable for board exams.
Add relevant details, examples, and key terms. Keep all original facts intact.

Short answer:
---
${text.slice(0, 2000)}
---

Return ONLY the expanded answer. No headings, no markdown.`

    const expanded = await aiCall({
      taskType: 'writing_expand',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1200,
    })

    res.json({ original: text, expanded, target_words })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/topper', async (req, res) => {
  const { text, subject = 'General', class: cls = '10', board = 'CBSE' } = req.body
  if (!text || text.length < 20) return res.status(400).json({ error: 'text required (min 20 chars).' })

  try {
    const prompt = `You are a top-scoring ${board} Class ${cls} ${subject} student who always gets full marks.

Rewrite the following answer to topper-level quality. Use:
- Precise technical vocabulary
- Clear structure with logical flow
- Relevant examples and diagrams mentioned (e.g., "Refer diagram below")
- Keywords that examiners look for
- Concise but comprehensive coverage

Original answer:
---
${text.slice(0, 3000)}
---

Return ONLY the rewritten answer. No preamble.`

    const rewritten = await aiCall({
      taskType: 'writing_topper',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1200,
    })

    res.json({ original: text, rewritten })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/plagiarism', async (req, res) => {
  const { text } = req.body
  if (!text || text.length < 50) return res.status(400).json({ error: 'text required (min 50 chars).' })

  try {
    const prompt = `You are an academic integrity checker.

Analyze the following student text for signs of plagiarism or unoriginal writing. Check for:
1. Common phrases that appear copy-pasted from textbooks
2. Inconsistent writing style (mix of very advanced and very basic)
3. Overly formal language for the stated grade level
4. Sections that seem too polished compared to others

Text to analyze:
---
${text.slice(0, 3000)}
---

Return ONLY valid JSON:
{
  "originality_score": 85,
  "risk_level": "low",
  "flags": [
    { "phrase": "exact phrase detected", "reason": "appears verbatim from common sources" }
  ],
  "sections": [
    { "text": "...excerpt...", "concern": "inconsistent tone", "severity": "low" }
  ],
  "summary": "Brief 2-sentence assessment",
  "recommendation": "What the student should do"
}`

    const raw = await aiCall({
      taskType: 'plagiarism',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 800,
    })

    let result
    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      result = JSON.parse(cleaned)
    } catch {
      result = { originality_score: 75, risk_level: 'unknown', summary: raw, flags: [], sections: [] }
    }

    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
