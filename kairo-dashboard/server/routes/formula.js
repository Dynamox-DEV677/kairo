import { Router } from 'express'
import { curriculumDirective, resolveCurriculum } from '../../src/lib/curriculum.core.js'
import { allTopics } from '../utils/syllabus.js'
import { db } from '../db/index.js'
import { aiCall, parseJSON } from '../utils/ai.js'

import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'

const router = Router()

// Phase 0: was reachable with no token. These burn the Groq quota and touch
// student data; identity comes from the verified JWT only.
router.use(requireSupabaseAuth)
const sid = req => req.body?.school_id || req.query?.school_id || 'demo_school'

router.post('/generate', async (req, res) => {
  const {
    subject, chapter = '',
    class: cls = '10', board = 'CBSE',
  } = req.body
  if (!subject) return res.status(400).json({ error: 'subject is required.' })

  try {
    // Notation, units and which formulas are even examinable differ between
    // curricula — an IGCSE sheet is not a CBSE sheet with a different header.
    // Scope comes from the verified topic map, so the model picks from the
    // student's real chapter list instead of a remembered one.
    const p = resolveCurriculum(board, cls)
    const scope = p.syllabusBoard
      ? allTopics(p.syllabusBoard, p.cls || undefined)
          .filter(t => t.subject === subject || t.subject === 'Science')
          .map(t => `${t.name} (${t.chapter})`)
      : []

    const prompt = `You are an expert ${p.label} ${cls ? `class ${cls} ` : ''}${subject} teacher.

${curriculumDirective(board, cls, { scope })}

Generate a comprehensive formula sheet${chapter ? ` for the chapter "${chapter}"` : ` for ${subject}`}.
Only include formulas that are actually part of this curriculum at this level. If a
formula is commonly taught elsewhere but is NOT in this syllabus, leave it out.

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
