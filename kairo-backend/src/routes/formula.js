/**
 * Formula Sheet Routes
 *
 * POST /api/formula/generate    Generate formula sheet for a subject/chapter
 * GET  /api/formula             List saved formula sheets
 * DELETE /api/formula/:id
 */
import { Router } from 'express'
import { db } from '../db/index.js'
import { aiCall, parseJSON } from '../utils/ai.js'

const router = Router()
const sid = req => req.body?.school_id || req.query?.school_id || 'demo_school'

router.post('/generate', async (req, res) => {
  const {
    subject, chapter = '',
    class: cls = '10', board = 'CBSE',
  } = req.body
  if (!subject) return res.status(400).json({ error: 'subject is required.' })

  try {
    const prompt = `You are an expert ${board} Class ${cls} ${subject} teacher.

Generate a comprehensive formula sheet${chapter ? ` for the chapter "${chapter}"` : ` for ${subject}`}.

Return ONLY valid JSON:
{
  "subject": "${subject}",
  "chapter": "${chapter || 'All Chapters'}",
  "sections": [
    {
      "name": "Section Name",
      "formulas": [
        {
          "name": "Formula Name",
          "formula": "v = u + at",
          "variables": "v=final velocity, u=initial velocity, a=acceleration, t=time",
          "when_to_use": "When finding velocity with uniform acceleration",
          "example": "If u=5 m/s, a=2 m/s², t=3s, v=5+2×3=11 m/s",
          "unit": "m/s"
        }
      ]
    }
  ],
  "constants": [
    { "name": "Constant Name", "symbol": "g", "value": "9.8 m/s²" }
  ],
  "tips": ["Quick tip 1", "Quick tip 2"],
  "common_mistakes": ["Mistake 1", "Mistake 2"]
}

Include at least 3 sections with 3-5 formulas each. No markdown.`

    const raw = await aiCall({
      taskType: 'formula_sheet',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2000,
    })

    const sheet = parseJSON(raw)

    const doc = await db.formulaSheets?.insertAsync?.({
      school_id: sid(req), subject, chapter, board, class: cls,
      sheet, created_at: new Date().toISOString(),
    }).catch(() => null)

    res.status(201).json({ ...sheet, id: doc?._id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/', async (req, res) => {
  const { subject } = req.query
  const q = { school_id: sid(req) }
  if (subject) q.subject = subject
  try {
    const sheets = await db.formulaSheets?.findAsync?.(q) || []
    res.json(sheets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/:id', async (req, res) => {
  await db.formulaSheets?.removeAsync?.({ _id: req.params.id, school_id: sid(req) }, {})
  res.json({ message: 'Deleted.' })
})

export default router
