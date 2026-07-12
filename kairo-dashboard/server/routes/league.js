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
      if (!week) return res.status(400).json({ error: 'week required' })
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
    res.status(500).json({ error: msg })
  }
})

export default router
