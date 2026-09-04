/**
 * Plan — the one AI call the space makes.
 *
 * The pace model, coverage bars, countdown, week strip and focus timer are all
 * arithmetic over stored rows and never touch this file. Only the topic
 * breakdown is generated: given a chapter and the STANDARD three-session split
 * (LEARN / PRACTISE / TEST, minutes already decided by the pace model), the
 * model rewrites the "what" and "why" of each session so they name the actual
 * ideas in that chapter rather than "the core ideas".
 *
 * The split itself -- how many sessions, how long, always ending on TEST -- is
 * NOT the model's to change. If this route is down the screen shows the
 * standard breakdown and says so in one quiet line.
 */
import { Router } from 'express'
import { aiCall, parseJSON } from '../utils/ai.js'
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'
import { fail } from '../lib/fail.js'

const router = Router()
router.use(requireSupabaseAuth)

const KINDS = ['LEARN', 'PRACTISE', 'TEST']

router.post('/topic', async (req, res) => {
  const chapter  = String(req.body?.chapter || '').slice(0, 120).trim()
  const topics   = Array.isArray(req.body?.topics) ? req.body.topics.map(t => String(t).slice(0, 80)).slice(0, 8) : []
  const sessions = Array.isArray(req.body?.sessions) ? req.body.sessions.slice(0, 4) : []
  const board    = String(req.body?.board || 'CBSE').slice(0, 24)
  const cls      = String(req.body?.class || '10').replace(/\D/g, '') || '10'

  if (!chapter) return res.status(400).json({ error: 'chapter required' })
  if (!sessions.length || !sessions.every(s => s && KINDS.includes(s.kind))) {
    return res.status(400).json({ error: 'sessions must be LEARN / PRACTISE / TEST' })
  }

  const prompt = `A ${board} Class ${cls} student is about to study the chapter "${chapter}"${topics.length ? ` (topics: ${topics.join(', ')})` : ''} in ${sessions.length} short sessions. The session structure is FIXED and you must not change it:

${sessions.map((s, i) => `${i + 1}. ${s.kind} — ${Math.round(s.minutes)} minutes`).join('\n')}

For EACH session, write:
- "what": exactly what to cover, naming the specific ideas, definitions, formulas or question types from THIS chapter (one sentence, concrete — e.g. "The three definitions plus V = IR" not "the basics").
- "why": why this session exists in this order, in one sentence a fifteen-year-old would accept (e.g. "Everything else in the chapter sits on top of these.").

The TEST session is always a written answer, photographed and graded — describe what kind of question to attempt.
No motivational language. No "you've got this". Plain and specific.

Return ONLY valid JSON (no markdown, no prose):
{ "sessions": [ { "kind": "LEARN", "what": "...", "why": "..." } ] }`

  try {
    const raw = await aiCall({
      taskType: 'speed',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 500,
      temperature: 0.4,
    })
    const r = parseJSON(raw)
    const out = Array.isArray(r?.sessions) ? r.sessions : []
    // The client's split is the truth; the model only supplies wording, and
    // only for the sessions that exist. Anything else is dropped.
    const merged = sessions.map((s, i) => ({
      kind: s.kind,
      minutes: Math.round(s.minutes),
      what: String(out[i]?.what || s.what || '').slice(0, 240),
      why:  String(out[i]?.why  || s.why  || '').slice(0, 240),
    }))
    if (!merged.some(m => m.what)) throw new Error('topic split returned no wording')
    res.json({ sessions: merged, generated: true })
  } catch (e) {
    fail(res, req, e, { status: 502, message: 'Using the standard breakdown for this chapter.' })
  }
})

export default router
