/**
 * Practice — the two AI calls the session needs that nothing else provides.
 *
 * Flashcards and MCQs need no AI and never touch this file. These two do:
 *
 *   POST /grade      a photographed, handwritten answer marked against the
 *                    CBSE step-marking scheme, as a STRUCTURED rubric.
 *   POST /teachback  a spoken explanation graded on whether it names the
 *                    mechanism — never on phrasing, dialect or Hinglish.
 *
 * Both return JSON the screens render directly. The existing /api/essay/grade
 * returns five 0-20 parameter scores for essays; that is the wrong shape for a
 * 5-mark physics answer, where the question is WHICH LINE lost the mark. So
 * this is a new route rather than a change to a working one.
 */
import { Router } from 'express'
import { aiCall, parseJSON } from '../utils/ai.js'
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'
import { fail } from '../lib/fail.js'

const router = Router()
router.use(requireSupabaseAuth)

const STEP_TYPES = ['method', 'substitution', 'answer', 'units', 'presentation']

/* ── written answer, step-marked ─────────────────────────────────────────── */

/**
 * The rubric is built around the lines the STUDENT wrote, not an ideal
 * solution. That is what lets the screen draw a red box over the actual line
 * that lost the mark on their own handwriting -- seeing it there is the point.
 */
router.post('/grade', async (req, res) => {
  const question = String(req.body?.question || '').trim()
  const answer   = String(req.body?.answer || '').trim()      // transcribed working, line-separated
  const marks    = Math.max(1, Math.min(10, parseInt(req.body?.marks, 10) || 5))
  const board    = String(req.body?.board || 'CBSE').slice(0, 24)
  const cls      = String(req.body?.class || '10').replace(/\D/g, '') || '10'
  const subject  = String(req.body?.subject || 'Science').slice(0, 40)

  if (!question) return res.status(400).json({ error: 'question required' })
  if (!answer)   return res.status(400).json({ error: 'answer required' })
  if (answer.length > 4000) return res.status(400).json({ error: 'That answer is very long — photograph one question at a time.' })

  const prompt = `You are a ${board} Class ${cls} ${subject} examiner marking ONE handwritten answer against the board's STEP-MARKING scheme.

QUESTION (${marks} marks):
${question}

THE STUDENT'S WORKING, exactly as transcribed from their paper, one line per line:
${answer.split('\n').map((l, i) => `L${i + 1}: ${l}`).join('\n')}

Mark it the way the board does: marks are awarded per STEP, not per final answer.
- A correct formula stated earns its mark even if everything after is wrong.
- Correct substitution earns a mark even if the arithmetic slips.
- Units and presentation are real marks and are commonly lost.
- Judge ONLY what is written. Never credit a step that is not on the page.
- Total awarded must be an integer from 0 to ${marks}.

Return ONLY valid JSON (no markdown, no prose):
{
  "total": ${marks},
  "awarded": <integer 0-${marks}>,
  "verdict": <ONE short line naming the biggest thing, e.g. "You lost a mark on presentation" or "Full marks — clean working">,
  "steps": [
    {
      "line": <the line number Ln this refers to, as an integer, or null if the step is MISSING from the page>,
      "type": <one of ${STEP_TYPES.map(t => `"${t}"`).join(' | ')}>,
      "marks": <marks available for this step, integer>,
      "awarded": <marks given, integer, 0 to marks>,
      "title": <4-8 words, e.g. "You skipped the formula line" or "Units carried through">,
      "reason": <1-2 plain sentences for a student. If lost: what to write next time and WHY the board gives a mark for it. If earned: what they did that most students drop.>
    }
  ]
}

Include a step for every mark available, earned or lost, so the steps' "marks" sum to ${marks}.`

  try {
    const raw = await aiCall({
      taskType: 'essay_grade',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1200,
      temperature: 0.2,
    })
    const r = normaliseRubric(parseJSON(raw), marks)
    if (!r) throw new Error('grader returned an unusable rubric')
    res.json(r)
  } catch (e) {
    fail(res, req, e, { status: 502, message: 'Could not grade this one right now — your photo is saved and it will be marked when the AI is back.' })
  }
})

/**
 * Defensive reshaping. The screen trusts this object completely, so a model
 * that returns 6/5 or a step type it invented is corrected here, not rendered.
 */
export function normaliseRubric(r, marks) {
  if (!r || typeof r !== 'object') return null
  const total = marks
  const steps = (Array.isArray(r.steps) ? r.steps : [])
    .filter(s => s && typeof s === 'object')
    .map(s => {
      const m = Math.max(0, parseInt(s.marks, 10) || 0)
      const a = Math.max(0, Math.min(m, parseInt(s.awarded, 10) || 0))
      return {
        line:    Number.isInteger(s.line) && s.line > 0 ? s.line : null,
        type:    STEP_TYPES.includes(s.type) ? s.type : 'method',
        marks:   m,
        awarded: a,
        title:   String(s.title || (a === m ? 'Marks earned' : 'Mark lost')).slice(0, 80),
        reason:  String(s.reason || '').slice(0, 400),
      }
    })
  let awarded = steps.length
    ? steps.reduce((acc, s) => acc + s.awarded, 0)
    : Math.max(0, Math.min(total, parseInt(r.awarded, 10) || 0))
  awarded = Math.max(0, Math.min(total, awarded))
  return {
    total,
    awarded,
    verdict: String(r.verdict || (awarded === total ? 'Full marks — clean working' : `You scored ${awarded} of ${total}`)).slice(0, 120),
    steps,
  }
}

/* ── teach back ──────────────────────────────────────────────────────────── */

/**
 * The rubric is one question: did they name the mechanism?
 *
 * A student who says "heavier thing has more force but also more mass so it
 * cancels out yaar" has understood gravity. Marking that down for the
 * "yaar" -- or for saying "thing" instead of "object" -- would be grading
 * English, not physics, and would teach students to perform vocabulary at the
 * app instead of explaining what they know.
 */
router.post('/teachback', async (req, res) => {
  const question   = String(req.body?.question || '').trim()
  const transcript = String(req.body?.transcript || '').trim()
  const subject    = String(req.body?.subject || 'Science').slice(0, 40)
  const cls        = String(req.body?.class || '10').replace(/\D/g, '') || '10'

  if (!question)   return res.status(400).json({ error: 'question required' })
  if (!transcript) return res.status(400).json({ error: 'transcript required' })
  if (transcript.length > 3000) return res.status(400).json({ error: 'That is a long explanation — say the core idea in a minute or so.' })

  const prompt = `A Class ${cls} student was asked to explain this to a friend, out loud, in their own words:

"${question}"

Here is a speech-to-text transcript of what they said. It may contain informal phrasing, dialect, Hindi or Tamil words mixed with English, filler words, and transcription errors. NONE of that matters.

TRANSCRIPT:
${transcript}

Grade ONE thing: did they name the actual MECHANISM -- the reason, the cause-and-effect -- or only the fact?
- "Heavy and light fall together" is the fact. "More mass means more force but also more resistance to acceleration, and those cancel" is the mechanism.
- Never penalise informal words, slang, code-switching, or grammar. Judge the physics/chemistry/maths/biology in it, not the English.
- If they named the mechanism in ANY words, they got it.

Return ONLY valid JSON (no markdown, no prose):
{
  "score": <0-100, how completely the mechanism was named>,
  "verdict": <ONE short encouraging line>,
  "gotRight": [<up to 3 short bullets: what they correctly explained, quoting their own phrasing where you can>],
  "missed": [
    { "point": <the missing idea, 3-8 words>, "reasoning": <the missing reasoning SPELLED OUT in 1-2 plain sentences, so they can say it next time> }
  ]
}`

  try {
    const raw = await aiCall({
      taskType: 'essay_grade',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 700,
      temperature: 0.3,
    })
    const r = parseJSON(raw)
    if (!r || typeof r !== 'object') throw new Error('teach-back grader returned no JSON')
    res.json({
      score:    Math.max(0, Math.min(100, parseInt(r.score, 10) || 0)),
      verdict:  String(r.verdict || '').slice(0, 140),
      gotRight: (Array.isArray(r.gotRight) ? r.gotRight : []).map(s => String(s).slice(0, 200)).slice(0, 3),
      missed:   (Array.isArray(r.missed) ? r.missed : [])
        .filter(m => m && typeof m === 'object')
        .map(m => ({ point: String(m.point || '').slice(0, 80), reasoning: String(m.reasoning || '').slice(0, 300) }))
        .slice(0, 3),
    })
  } catch (e) {
    fail(res, req, e, { status: 502, message: 'Could not grade the explanation right now — moving on, it will not count against you.' })
  }
})

export default router
