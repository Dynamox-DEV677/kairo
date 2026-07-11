/**
 * Kyno League — weekly XP leaderboard (Duolingo-style).
 *
 *   POST /api/league/xp     { user_id, name, week, xp }  → upsert weekly score
 *   GET  /api/league/board  ?week=YYYY-MM-DD&user_id=…   → top 20 + your rank
 *
 * Backed by Supabase (table: league_scores — see db/league_schema.sql).
 * Degrades gracefully: without Supabase env vars the endpoints answer
 * with { offline: true } so the client can show local-only scores.
 */
import { Router } from 'express'
import { supabaseAdmin, SUPABASE_CONFIGURED } from '../services/supabase.js'

const router = Router()

router.post('/xp', async (req, res) => {
  if (!SUPABASE_CONFIGURED) return res.json({ ok: false, offline: true })
  const { user_id, name = 'Student', week, xp } = req.body || {}
  if (!user_id || !week || typeof xp !== 'number') {
    return res.status(400).json({ error: 'user_id, week, xp required' })
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
    // Table missing → hint instead of hard error
    const msg = e?.message || ''
    if (msg.includes('does not exist') || msg.includes('schema cache')) {
      return res.json({ ok: false, offline: true, hint: 'run server/db/league_schema.sql in Supabase' })
    }
    console.error('[league] xp:', e)
    res.status(500).json({ error: msg })
  }
})

router.get('/board', async (req, res) => {
  if (!SUPABASE_CONFIGURED) return res.json({ offline: true, rows: [], rank: 0 })
  // range: 'week' (default, back-compat with the Home mini-board) | 'month' | 'all'
  //   week  → the single weekly row per user (week=YYYY-MM-DD required)
  //   month → sum of a user's weekly rows in that month (month=YYYY-MM required)
  //   all   → sum of every weekly row per user (lifetime)
  // league_scores holds one row per (user_id, week), so month/all-time are
  // just aggregations over those rows — no extra tables needed.
  const range = String(req.query.range || 'week')
  const userId = String(req.query.user_id || '')
  try {
    let q = supabaseAdmin.from('league_scores').select('user_id, name, xp, week')
    if (range === 'month') {
      const month = String(req.query.month || '')
      if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month required (YYYY-MM)' })
      q = q.gte('week', `${month}-01`).lte('week', `${month}-31`)
    } else if (range !== 'all') {
      // default 'week'
      const week = String(req.query.week || '')
      if (!week) return res.status(400).json({ error: 'week required' })
      q = q.eq('week', week)
    }
    const { data, error } = await q.limit(5000)
    if (error) throw error

    // Aggregate per user (a no-op for 'week', which already has one row each).
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
    res.status(500).json({ error: msg })
  }
})

export default router
