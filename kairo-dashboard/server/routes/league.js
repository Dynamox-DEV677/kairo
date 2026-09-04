import { Router } from 'express'
import { supabaseAdmin, SUPABASE_CONFIGURED } from '../services/supabase.js'
// Must be the Supabase verifier, not the self-signed one in middleware/auth.js.
// The client sends a Supabase access token; jwt.verify() against JWT_SECRET
// cannot validate it, threw, and the swallowed catch left req.user undefined --
// so a fully signed-in student fell through to the anonymous branch and got a
// 401 on every single XP write. That is why XP never persisted.
import { optionalSupabaseAuth, requireSupabaseAuth } from '../middleware/supabaseAuth.js'
import { profilesFor, blockedSet, ensureSocialProfile } from '../lib/social.js'
import { effortBand, GROUP_SIZE, MIN_GROUP } from '../../src/lib/progress.core.js'

const router = Router()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const missingTable = e => { const m = String(e?.message || '').toLowerCase(); return m.includes('does not exist') || m.includes('schema cache') }

// SECURITY: the score row is keyed by user_id, so taking that id from the
// request body let anyone rewrite any student's leaderboard XP. Signed-in
// callers are pinned to their own token identity. Anonymous/device-id players
// are still allowed (the app works logged-out) but can only write a device
// row, never a real account's.
//
// IDENTITY: this route used to accept a `name` from the body and store it, and
// the board handed it to anyone who asked. Real names never enter this table
// again -- the column is dropped by 2026-09-04_social.sql, the body field is
// ignored, and the board shows usernames the server derives itself.
router.post('/xp', optionalSupabaseAuth, async (req, res) => {
  if (!SUPABASE_CONFIGURED) return res.json({ ok: false, offline: true })
  const { week, xp, minutes } = req.body || {}
  const bodyId = (req.body?.user_id || '').toString()
  const tokenId = (req.user?.id || req.user?.sub || '').toString()

  // Signed in -> always the token's id. Signed out -> only a device- id.
  const user_id = tokenId || (/^dev-[a-z0-9]{4,}$/i.test(bodyId) ? bodyId : '')
  if (!user_id) return res.status(401).json({ error: 'Sign in to appear on the leaderboard.' })
  if (!week || typeof xp !== 'number' || !/^\d{4}-\d{2}-\d{2}$/.test(String(week))) {
    return res.status(400).json({ error: 'week (YYYY-MM-DD) and xp required' })
  }
  const row = { user_id, week, xp: Math.max(0, Math.floor(xp)) }
  // Study minutes this week: the effort the new league groups on. Capped at a
  // week of minutes so a bad clock cannot buy a place.
  const mins = Number(minutes)
  const withMinutes = Number.isFinite(mins) ? { ...row, minutes: Math.max(0, Math.min(7 * 24 * 60, Math.floor(mins))) } : row
  try {
    let { error } = await supabaseAdmin.from('league_scores').upsert(withMinutes, { onConflict: 'user_id,week' })
    // The minutes column arrives with the social migration; until it is run, store XP alone.
    if (error && /minutes/i.test(error.message || '')) {
      ({ error } = await supabaseAdmin.from('league_scores').upsert(row, { onConflict: 'user_id,week' }))
    }
    if (error) throw error
    res.json({ ok: true })
  } catch (e) {
    if (missingTable(e)) return res.json({ ok: false, offline: true, hint: 'run server/db/league_schema.sql in Supabase' })
    console.error('[league] xp:', e)
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Could not save your XP.' } })
  }
})

// The board. Usernames only; "you" is the token's identity, never a query
// parameter (the old `user_id` param let anyone look up another student's
// rank). Students who turned leagues off, and anyone in a block pair with the
// caller, are not on the caller's board at all.
router.get('/board', optionalSupabaseAuth, async (req, res) => {
  if (!SUPABASE_CONFIGURED) return res.json({ offline: true, rows: [], rank: 0, total: 0 })
  const range = String(req.query.range || 'week')
  const meId = (req.user?.id || req.user?.sub || '').toString()
  try {
    let q = supabaseAdmin.from('league_scores').select('user_id, xp, week')
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

    // Anonymous device rows have no username to show, so they are not shown.
    const byUser = new Map()
    for (const r of (data || [])) {
      if (!UUID_RE.test(String(r.user_id))) continue
      byUser.set(r.user_id, (byUser.get(r.user_id) || 0) + (r.xp || 0))
    }
    const sorted = [...byUser.entries()].map(([user_id, xp]) => ({ user_id, xp })).sort((a, b) => b.xp - a.xp)

    const ids = [...new Set([...sorted.slice(0, 60).map(r => r.user_id), ...(meId ? [meId] : [])])]
    const profiles = await profilesFor(ids)
    const blocked = meId ? await blockedSet(meId) : new Set()
    const visible = sorted.filter(r => {
      if (r.user_id === meId) return true
      if (blocked.has(r.user_id)) return false
      const p = profiles.get(r.user_id)
      return p ? p.show_in_leagues !== false : true
    })

    const rank = meId ? (visible.findIndex(r => r.user_id === meId) + 1) : 0
    const me = meId ? visible.find(r => r.user_id === meId) : null
    const rows = visible.slice(0, 20).map(r => {
      const username = profiles.get(r.user_id)?.username || 'student'
      // `name` is kept as an alias so the pre-cutover League page keeps working; it is the username.
      return { name: username, username, xp: r.xp, you: r.user_id === meId }
    })
    res.json({ rank, total: visible.length, rows, youXp: me ? me.xp : 0 })
  } catch (e) {
    if (missingTable(e)) return res.json({ offline: true, rows: [], rank: 0, total: 0, hint: 'run server/db/league_schema.sql in Supabase' })
    console.error('[league] board:', e)
    // Never hand a raw database message to the client.
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Could not load the leaderboard.' } })
  }
})

/**
 * The new league: a group of at most fifteen, formed on EFFORT (study minutes
 * this week), never on ability. A hard-working weak student can come first,
 * which is the only version of this feature that helps rather than
 * demoralises. Nobody is relegated: the bottom simply stays. Fewer than five
 * in the group → `small`, and the client hides the tile.
 */
router.get('/group', requireSupabaseAuth, async (req, res) => {
  if (!SUPABASE_CONFIGURED) return res.json({ offline: true })
  const week = String(req.query.week || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return res.status(400).json({ error: { code: 'BAD_INPUT', message: 'week must be a date (YYYY-MM-DD).', fields: ['week'] } })
  const me = req.user.id
  try {
    const prof = await ensureSocialProfile(me)
    if (prof.offline) return res.json({ offline: true, hint: 'run server/db/2026-09-04_social.sql in Supabase' })
    if (prof.show_in_leagues === false) return res.json({ off: true })

    let { data: mine, error } = await supabaseAdmin.from('league_scores').select('user_id, xp, minutes, group_id').eq('user_id', me).eq('week', week).maybeSingle()
    if (error) throw error
    if (!mine) {
      const { data: ins, error: e2 } = await supabaseAdmin.from('league_scores')
        .upsert({ user_id: me, week, xp: 0, minutes: 0 }, { onConflict: 'user_id,week' }).select('user_id, xp, minutes, group_id').single()
      if (e2) throw e2
      mine = ins
    }
    const band = effortBand(mine.minutes || 0)
    if (!mine.group_id) {
      const { data: rows, error: e3 } = await supabaseAdmin.from('league_scores').select('group_id').eq('week', week).like('group_id', `${week}:${band}:%`)
      if (e3) throw e3
      const counts = new Map()
      for (const r of rows || []) counts.set(r.group_id, (counts.get(r.group_id) || 0) + 1)
      const open = [...counts.entries()].sort((a, b) => b[1] - a[1]).find(([, n]) => n < GROUP_SIZE)   // fill the fullest open group first
      const gid = open ? open[0] : `${week}:${band}:${counts.size + 1}`
      const { error: e4 } = await supabaseAdmin.from('league_scores').update({ group_id: gid }).eq('user_id', me).eq('week', week)
      if (e4) throw e4
      mine.group_id = gid
    }
    const { data: members, error: e5 } = await supabaseAdmin.from('league_scores').select('user_id, xp, minutes').eq('week', week).eq('group_id', mine.group_id)
    if (e5) throw e5
    const profiles = await profilesFor((members || []).map(m => m.user_id))
    const blocked = await blockedSet(me)
    const rows = (members || [])
      .filter(m => m.user_id === me || (!blocked.has(m.user_id) && profiles.get(m.user_id)?.show_in_leagues !== false))
      .map(m => ({ username: profiles.get(m.user_id)?.username || 'student', xp: m.xp || 0, you: m.user_id === me }))
      .sort((a, b) => b.xp - a.xp)
    res.json({ week, band, size: rows.length, small: rows.length < MIN_GROUP, rows })
  } catch (e) {
    if (missingTable(e) || /group_id|minutes/i.test(e?.message || '')) return res.json({ offline: true, hint: 'run server/db/2026-09-04_social.sql in Supabase' })
    console.error('[league] group:', e)
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Could not load your league.' } })
  }
})

export default router
