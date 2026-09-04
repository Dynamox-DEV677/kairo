/**
 * /api/arena -- 1v1 battles between two humans, 7 questions, 60 seconds.
 *
 * Usernames only. No messages. The server keeps the answers and the score.
 * A missing table (migration not run yet) answers { offline: true } so the
 * client shows "needs a connection" instead of a spinner that hangs.
 *
 * No AI anywhere in this space. If a model call ever appears here, that is a bug.
 */
import { Router } from 'express'
import { fail } from '../lib/fail.js'
import { requireSupabase } from '../services/supabase.js'
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'
import { subjects, joinQueue, leaveQueue, getMatch, answer, stats, isMissingTable } from '../lib/arena.js'

const router = Router()
router.use(requireSupabase)
router.use(requireSupabaseAuth)

const HINT = 'run server/db/2026-09-04_social.sql in Supabase'
const soft = (res, e, fallback) => {
  if (isMissingTable(e)) return res.json({ offline: true, hint: HINT, ...fallback })
  return null
}

router.get('/subjects', (_req, res) => res.json({ subjects: subjects() }))

router.post('/queue', async (req, res) => {
  const subject = String(req.body?.subject || '')
  const band = Math.max(1, Math.min(3, parseInt(req.body?.band, 10) || 2))
  try {
    const r = await joinQueue(req.user.id, subject, band)
    if (r.error) return res.status(400).json({ error: r.error })
    res.json(r)
  } catch (e) { if (!soft(res, e, { waiting: false })) fail(res, req, e) }
})

router.delete('/queue', async (req, res) => {
  try { await leaveQueue(req.user.id); res.json({ ok: true }) }
  catch (e) { if (!soft(res, e, {})) fail(res, req, e) }
})

router.get('/match/:id', async (req, res) => {
  try {
    const m = await getMatch(String(req.params.id), req.user.id)
    if (!m) return res.status(404).json({ error: 'No such round.' })
    res.json(m)
  } catch (e) { if (!soft(res, e, {})) fail(res, req, e) }
})

router.post('/match/:id/answer', async (req, res) => {
  try {
    const r = await answer(String(req.params.id), req.user.id, req.body?.index, req.body?.choice, req.body?.elapsedMs)
    if (r.error) return res.status(r.status || 400).json({ error: r.error })
    res.json(r)
  } catch (e) { if (!soft(res, e, {})) fail(res, req, e) }
})

router.get('/me', async (req, res) => {
  try { res.json(await stats(req.user.id)) }
  catch (e) { if (!soft(res, e, { played: 0, won: 0, drawn: 0 })) fail(res, req, e) }
})

export default router
