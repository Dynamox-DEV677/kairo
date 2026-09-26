import { Router } from 'express'
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'
import { normalizeFeedback } from '../../src/lib/feedback.core.js'

/**
 * Tester feedback -- "something broke", ideas, questions, wrong answers.
 *
 * The closed-testing review asks how testers reported problems and what
 * changed because of it; this is where those reports land. Requires the
 * tester_feedback table (server/db/2026-09-26_tester_feedback.sql). Until that
 * migration runs, the endpoint answers { stored: false } and the app tells the
 * student it didn't go through -- never "sent" when nothing was stored.
 */
const router = Router()
router.use(requireSupabaseAuth)

// A speed bump, not a wall: Vercel runs several instances, each with its own
// map. The wall is the table's own length checks.
const recent = new Map()
const WINDOW_MS = 10 * 60_000
const MAX_PER_WINDOW = 5
function tooMany(userId, now = Date.now()) {
  const hits = (recent.get(userId) || []).filter(t => now - t < WINDOW_MS)
  if (hits.length >= MAX_PER_WINDOW) { recent.set(userId, hits); return true }
  hits.push(now)
  recent.set(userId, hits)
  return false
}

router.post('/', async (req, res) => {
  const n = normalizeFeedback(req.body)
  if (!n.ok) return res.status(400).json({ error: n.error })
  if (tooMany(req.user.id)) return res.status(429).json({ error: 'That is a lot of feedback at once — give it a few minutes.' })

  try {
    const { supabaseAdmin } = await import('../services/supabase.js')
    const { error } = await supabaseAdmin.from('tester_feedback').insert({
      user_id: req.user.id,
      category: n.value.category,
      message: n.value.message,
      screen: n.value.screen,
      app_version: n.value.appVersion,
      device: n.value.device,
    })
    if (error) {
      // 42P01 = table missing (migration not run yet). Say so honestly.
      console.warn('[feedback] insert failed:', error.code, error.message)
      return res.json({ stored: false, reason: error.code === '42P01' ? 'table-missing' : 'insert-failed' })
    }
    return res.json({ stored: true })
  } catch (e) {
    console.warn('[feedback]', e?.message)
    return res.json({ stored: false, reason: 'error' })
  }
})

export default router
