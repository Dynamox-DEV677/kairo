import { Router } from 'express'
import { supabaseAdmin, SUPABASE_CONFIGURED } from '../services/supabase.js'
// Must be the Supabase verifier, not the self-signed one in middleware/auth.js.
// The client sends a Supabase access token; jwt.verify() against JWT_SECRET
// cannot validate it, threw, and the swallowed catch left req.user undefined --
// so a fully signed-in student fell through to the anonymous branch and got a
// 401 on every single XP write. That is why XP never persisted.
import { optionalSupabaseAuth } from '../middleware/supabaseAuth.js'

const router = Router()

// SECURITY: the score row is keyed by user_id, so taking that id from the
// request body let anyone rewrite any student's leaderboard XP. Signed-in
// callers are pinned to their own token identity. Anonymous/device-id players
// are still allowed (the app works logged-out) but can only write a device
// row, never a real account's.
router.post('/xp', optionalSupabaseAuth, async (req, res) => {
  if (!SUPABASE_CONFIGURED) return res.json({ ok: false, offline: true })
  const { name = 'Student', week, xp } = req.body || {}
  const bodyId = (req.body?.user_id || '').toString()
  const tokenId = (req.user?.id || req.user?.sub || '').toString()

  // Signed in -> always the token's id. Signed out -> only a device- id.
  const user_id = tokenId || (/^dev-[a-z0-9]{4,}$/i.test(bodyId) ? bodyId : '')
  if (!user_id) return res.status(401).json({ error: 'Sign in to appear on the leaderboard.' })
  if (!week || typeof xp !== 'number') {
    return res.status(400).json({ error: 'week and xp required' })
  }
  try {
    const { error } = await supabaseAdmin
      .from('league_scores')
      .upsert(
        { user_id, name: String(name).slice(0, 40), week, xp: Math.max(0, Math.floor(xp)) },
        { onConflict: 'user_id,week' },
      )
    if (error) throw error
    res.json({ ok: true })
  } catch (e) {
    const msg = e?.message || ''
    if (msg.includes('does not exist') || msg.includes('schema cache')) {
      return res.json({ ok: false, offline: true, hint: 'run server/db/league_schema.sql in Supabase' })
    }
    console.error('[league] xp:', e)
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Could not save your XP.' } })
  }
})

router.get('/board', async (req, res) => {
  if (!SUPABASE_CONFIGURED) return res.json({ offline: true, rows: [], rank: 0 })
  const range = String(req.query.range || 'week')
  const userId = String(req.query.user_id || '')
  try {
    let q = supabaseAdmin.from('league_scores').select('user_id, name, xp, week')
    if (range === 'month') {
      const month = String(req.query.month || '')
      if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month required (YYYY-MM)' })
      q = q.gte('week', `${month}-01`).lte('week', `${month}-31`)
    } else if (range !== 'all') {
      const week = String(req.query.week || '')
      // Validate at the boundary. 'week' goes into a date column, so an
      // ISO-week string like 2026-W33 reached Postgres, failed to parse, and
      // the raw "invalid input syntax for type date" came back to the client.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) {
        return res.status(400).json({
          error: { code: 'BAD_INPUT', message: 'week must be a date (YYYY-MM-DD).', fields: ['week'] },
        })
      }
      q = q.eq('week', week)
    }
    const { data, error } = await q.limit(5000)
    if (error) throw error

    const byUser = new Map()
    for (const r of (data || [])) {
      const cur = byUser.get(r.user_id) || { user_id: r.user_id, name: r.name || 'Student', xp: 0 }
      cur.xp += (r.xp || 0)
      if (r.name) cur.name = r.name
      byUser.set(r.user_id, cur)
    }
    const all = [...byUser.values()].sort((a, b) => b.xp - a.xp)
    const rank = userId ? (all.findIndex(r => r.user_id === userId) + 1) : 0
    const me = userId ? all.find(r => r.user_id === userId) : null
    const rows = all.slice(0, 20).map(r => ({
      name: r.name || 'Student',
      xp: r.xp,
      you: r.user_id === userId,
    }))
    res.json({ rank, total: all.length, rows, youXp: me ? me.xp : 0 })
  } catch (e) {
    const msg = e?.message || ''
    if (msg.includes('does not exist') || msg.includes('schema cache')) {
      return res.json({ offline: true, rows: [], rank: 0, hint: 'run server/db/league_schema.sql in Supabase' })
    }
    console.error('[league] board:', e)
    // Never hand a raw database message to the client.
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Could not load the leaderboard.' } })
  }
})

export default router
