/**
 * Performance — the one AI call the space needs.
 *
 * Patterns, counts, marks and charts are computed client-side from stored
 * rows and need no AI. Only the prose is generated: what is actually going on,
 * the fix, and why they did it. This route produces that ONCE PER SIGNATURE
 * and caches it -- a habit barely changes between views, and generating it on
 * every open would cost tokens for identical text.
 *
 * If this is down, the pattern screen renders with its occurrences and marks
 * and a quiet line where the diagnosis would be. Never blank.
 */
import { Router } from 'express'
import { aiCall, parseJSON } from '../utils/ai.js'
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'
import { fail } from '../lib/fail.js'

const router = Router()
router.use(requireSupabaseAuth)

/** signature -> { diagnosis, fix, code, why, ts }. Cold on a new instance; fine. */
const CACHE = new Map()
const TTL_MS = 7 * 24 * 60 * 60 * 1000

router.post('/diagnose', async (req, res) => {
  const signature = String(req.body?.signature || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 48)
  const name      = String(req.body?.name || '').slice(0, 120)
  const type      = String(req.body?.type || '').slice(0, 20)
  const samples   = Array.isArray(req.body?.samples) ? req.body.samples.slice(0, 4) : []

  if (!signature) return res.status(400).json({ error: 'signature required' })

  const hit = CACHE.get(signature)
  if (hit && Date.now() - hit.ts < TTL_MS) return res.json({ ...hit, cached: true })

  const sampleText = samples.map((s, i) => {
    const lines = Array.isArray(s?.lines) ? s.lines.map((l, k) => `  L${k + 1}: ${String(l).slice(0, 120)}`).join('\n') : ''
    return `Occurrence ${i + 1}${s?.question ? ` — question: ${String(s.question).slice(0, 200)}` : ''}${lines ? `\n${lines}` : ''}${Number.isInteger(s?.divergedAt) ? `\n  diverged at L${s.divergedAt}` : ''}${s?.why ? `\n  grader's note: ${String(s.why).slice(0, 200)}` : ''}`
  }).join('\n\n')

  const prompt = `A student has a RECURRING error pattern. Its stable name is "${signature}"${name ? ` ("${name}")` : ''}${type ? `, type: ${type}` : ''}.

${sampleText ? `Here are recent occurrences from their own work:\n\n${sampleText}\n` : 'No worked samples are available — reason from the pattern name.'}

Write for a 14-year-old reading about their own mistakes. Rules:
- Name the HABIT, never the person. "You skip the line", never "you are careless".
- Separate what they KNOW from what they DO. If the samples show the formula written correctly and the slip on the next line, say exactly that.
- The fix must be SMALL and specific — a habit a person can adopt tomorrow. "Be more careful" is useless. "Write the substitution on its own line" is a fix.
- No warnings, no alarm, no comparison to other students.

Return ONLY valid JSON (no markdown, no prose):
{
  "diagnosis": <2 sentences: what is actually going on, separating what they know from what they do>,
  "fix": <1 sentence, the specific habit>,
  "code": <3-5 short lines of corrected working in plain text showing the fix, with an arrow (←) marking the fixed line; empty string if not applicable>,
  "why": <1 sentence: the mechanical reason the slip happens, e.g. "You multiply ½ × 10 in your head and write 10 instead of 5.">,
  "cost": <1 short clause: what the fix costs and what it earns, e.g. "three seconds, and it earns a method mark even when the answer is wrong">
}`

  try {
    const raw = await aiCall({
      taskType: 'essay_grade',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 500,
      temperature: 0.3,
    })
    const r = parseJSON(raw)
    if (!r || typeof r !== 'object') throw new Error('diagnosis returned no JSON')
    const out = {
      diagnosis: String(r.diagnosis || '').slice(0, 500),
      fix:       String(r.fix || '').slice(0, 240),
      code:      String(r.code || '').slice(0, 400),
      why:       String(r.why || '').slice(0, 240),
      cost:      String(r.cost || '').slice(0, 160),
      ts: Date.now(),
    }
    CACHE.set(signature, out)
    res.json({ ...out, cached: false })
  } catch (e) {
    fail(res, req, e, { status: 502, message: 'The diagnosis is not available right now. The pattern, its occurrences and marks are all still here.' })
  }
})

export default router
