/**
 * Notes space — the one AI call it makes.
 *
 * (Not /api/notes: that is the school-mode notes CRUD in notes.js. This is the
 * marking-scheme helper for the long-answer screen, mounted at
 * /api/notes-scheme so the two never collide.)
 *
 * Notes, formulas, search, card counts and return dates are stored rows and
 * never touch this file. Card generation is the deterministic cloze builder.
 * The only generated thing is the MARKING SCHEME for a long-answer question:
 * what the board awards marks for, point by point, so the writing screen can
 * show what is present and what is missing.
 *
 * WHAT THIS ROUTE MUST NEVER DO: write the answer. No "improve", no "expand",
 * no completion of the student's sentences. A tool that writes a student's
 * homework teaches nothing and gets the app banned from any school that
 * notices. This returns requirements and keywords -- never prose the student
 * could paste.
 */
import { Router } from 'express'
import { aiCall, parseJSON } from '../utils/ai.js'
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'
import { fail } from '../lib/fail.js'

const router = Router()
router.use(requireSupabaseAuth)

router.post('/scheme', async (req, res) => {
  const question = String(req.body?.question || '').trim().slice(0, 600)
  const marks    = Math.max(1, Math.min(10, parseInt(req.body?.marks, 10) || 5))
  const board    = String(req.body?.board || 'CBSE').slice(0, 24)
  const cls      = String(req.body?.class || '10').replace(/\D/g, '') || '10'
  const subject  = String(req.body?.subject || 'Science').slice(0, 40)

  if (!question) return res.status(400).json({ error: 'question required' })

  const prompt = `You are a ${board} Class ${cls} ${subject} examiner. A student is about to write a ${marks}-mark long answer to this question:

"${question}"

Write the MARKING SCHEME an examiner would use: the specific points that earn marks, and how many each earns. The marks must sum to ${marks}.

For each point also give 2-4 short lowercase "keywords" -- words or two-word phrases that would appear in a student's answer if they had covered that point (e.g. "mitochondria", "glucose + oxygen", "word equation"). These are used to check presence, not to write anything.

Do NOT write a model answer. Do NOT write example sentences. Points only.

Return ONLY valid JSON (no markdown, no prose):
{ "requirements": [ { "point": "<what earns the mark, 4-10 words>", "marks": <integer>, "keywords": ["...", "..."] } ] }`

  try {
    const raw = await aiCall({
      taskType: 'speed',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 500,
      temperature: 0.2,
    })
    const r = parseJSON(raw)
    const reqs = (Array.isArray(r?.requirements) ? r.requirements : [])
      .filter(x => x && typeof x === 'object' && x.point)
      .map(x => ({
        point: String(x.point).slice(0, 120),
        marks: Math.max(1, Math.min(marks, parseInt(x.marks, 10) || 1)),
        keywords: (Array.isArray(x.keywords) ? x.keywords : []).map(k => String(k).toLowerCase().slice(0, 40)).filter(Boolean).slice(0, 5),
      }))
      .slice(0, 8)
    if (!reqs.length) throw new Error('scheme returned no requirements')
    res.json({ requirements: reqs, generated: true })
  } catch (e) {
    fail(res, req, e, { status: 502, message: 'The marking scheme is not available right now — tick the points by hand below.' })
  }
})

export default router
