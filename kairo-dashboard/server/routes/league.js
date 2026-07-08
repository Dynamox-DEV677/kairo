/**
 * Kora League — weekly XP leaderboard (Duolingo-style).
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
  const week = String(req.query.week || '')
  const userId = String(req.query.user_id || '')
  if (!week) return res.status(400).json({ error: 'week required' })
  try {
    const { data, error } = await supabaseAdmin
      .from('league_scores')
      .select('user_id, name, xp')
      .eq('week', week)
      .order('xp', { ascending: false })
      .limit(100)
    if (error) throw error
    const all = data || []
    const rank = userId ? (all.findIndex(r => r.user_id === userId) + 1) : 0
    const rows = all.slice(0, 20).map(r => ({
      name: r.name || 'Student',
      xp: r.xp,
      you: r.user_id === userId,
    }))
    res.json({ rank, total: all.length, rows })
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
