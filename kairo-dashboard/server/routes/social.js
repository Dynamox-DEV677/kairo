/**
 * /api/social -- the student's own social identity: username + switches.
 *
 * Only the caller's row is ever read or written here. Nothing on this router
 * returns anything about another student; boards and rooms get usernames
 * through server/lib/social.js and never touch this file.
 *
 * No AI anywhere in this space. If a model call ever appears here, that is a
 * bug.
 */
import { Router } from 'express'
import { fail } from '../lib/fail.js'
import { requireSupabase } from '../services/supabase.js'
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'
import { ensureSocialProfile, updateSwitches, changeUsername, reportUser } from '../lib/social.js'
import { validateUsername } from '../../src/lib/username.core.js'

const router = Router()
router.use(requireSupabase)
router.use(requireSupabaseAuth)

const NOT_READY = 'Usernames are not set up on the server yet — run server/db/2026-09-04_social.sql.'

const pub = p => ({
  username: p.username,
  show_in_leagues: p.show_in_leagues !== false,
  allow_battles: p.allow_battles !== false,
  join_rooms: p.join_rooms === true,
  username_changed_at: p.username_changed_at || null,
  offline: !!p.offline,
})

router.get('/me', async (req, res) => {
  try { res.json(pub(await ensureSocialProfile(req.user.id))) } catch (e) { fail(res, req, e) }
})

router.put('/username', async (req, res) => {
  const v = validateUsername(req.body?.username)
  if (!v.ok) return res.status(400).json({ error: v.reason })
  try {
    const r = await changeUsername(req.user.id, v.username)
    if (r.offline) return res.status(503).json({ error: NOT_READY })
    if (r.taken) return res.status(409).json({ error: 'That name is taken — try another.' })
    if (r.tooSoon) return res.status(429).json({ error: 'You can change your name once a day.' })
    res.json(pub(r.profile))
  } catch (e) { fail(res, req, e) }
})

router.put('/settings', async (req, res) => {
  const patch = {}
  for (const k of ['show_in_leagues', 'allow_battles', 'join_rooms']) if (typeof req.body?.[k] === 'boolean') patch[k] = req.body[k]
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to change.' })
  try {
    const p = await updateSwitches(req.user.id, patch)
    if (p.offline) return res.status(503).json({ error: NOT_READY })
    res.json(pub(p))
  } catch (e) { fail(res, req, e) }
})

// Silent by design. The other student is never told, and the reporter gets
// the same 200 whether or not the username exists.
router.post('/report', async (req, res) => {
  try { await reportUser(req.user.id, req.body?.username, req.body?.context) } catch (e) { console.warn('[social] report:', e?.message) }
  res.json({ ok: true })
})

export default router
