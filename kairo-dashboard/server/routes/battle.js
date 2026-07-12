import { Router } from 'express'
import { supabaseAdmin, requireSupabase } from '../services/supabase.js'
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'

const router = Router()
router.use(requireSupabase)
router.use(requireSupabaseAuth)

const XP_PER_CORRECT = { easy: 8, medium: 14, hard: 22 }

function today() { return new Date().toISOString().slice(0, 10) }

const DAILY_TOPICS = [
  { subject: 'Mathematics', topic: 'Quadratic Equations',  difficulty: 'medium' },
  { subject: 'Physics',     topic: 'Newton\'s Laws',         difficulty: 'medium' },
  { subject: 'Chemistry',   topic: 'Periodic Table Trends', difficulty: 'medium' },
  { subject: 'Biology',     topic: 'Photosynthesis',         difficulty: 'easy'   },
  { subject: 'English',     topic: 'Tenses & Modals',        difficulty: 'easy'   },
  { subject: 'History',     topic: 'Indian Independence',    difficulty: 'medium' },
  { subject: 'Mathematics', topic: 'Trigonometry',           difficulty: 'hard'   },
  { subject: 'Physics',     topic: 'Optics',                 difficulty: 'medium' },
  { subject: 'Geography',   topic: 'Climate Zones',          difficulty: 'easy'   },
  { subject: 'Chemistry',   topic: 'Acids & Bases',          difficulty: 'medium' },
]

function isMissingTable(err) {
  const msg = String(err?.message || err || '').toLowerCase()
  return msg.includes('does not exist')
      || msg.includes('schema cache')
      || msg.includes('battle_scores')
}

router.post('/submit', async (req, res) => {
  const { score, total, difficulty = 'medium', topic, subject, daily = false } = req.body || {}
  if (typeof score !== 'number' || typeof total !== 'number' || total < 1) {
    return res.status(400).json({ error: 'score and total must be numbers, total > 0' })
  }
  if (!['easy', 'medium', 'hard'].includes(difficulty)) {
    return res.status(400).json({ error: 'difficulty must be easy/medium/hard' })
  }

  const xp = score * (XP_PER_CORRECT[difficulty] || 14)

  if (!req.schoolId) {
    return res.json({ message: 'Saved locally (no school)', xp_gained: xp })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('battle_scores')
      .insert({
        user_id:    req.user.id,
        school_id:  req.schoolId,
        score, total,
        accuracy:   total > 0 ? score / total : 0,
        difficulty,
        topic:      topic || null,
        subject:    subject || null,
        xp,
        is_daily:   !!daily,
        played_on:  today(),
      })
      .select('id, xp, played_on')
      .single()

    if (error) {
      if (isMissingTable(error)) return res.json({ message: 'no-op', xp_gained: xp })
      throw new Error(error.message)
    }
    res.status(201).json({ message: 'Score saved', id: data.id, xp_gained: xp })
  } catch (e) {
    if (isMissingTable(e)) return res.json({ message: 'no-op', xp_gained: xp })
    res.status(500).json({ error: e.message })
  }
})

router.get('/leaderboard', async (req, res) => {
  const range = req.query.range || 'week'
  if (!req.schoolId) {
    return res.json({ range, leaders: [], you: null, personal: true })
  }
  const td    = today()

  try {
    let q = supabaseAdmin
      .from('battle_scores')
      .select('user_id, xp, score, total, played_on')
      .eq('school_id', req.schoolId)

    if (range === 'today') q = q.eq('played_on', td)
    else if (range === 'week') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      q = q.gte('played_on', weekAgo)
    }

    const { data: rows, error } = await q
    if (error) {
      if (isMissingTable(error)) return res.json({ range, leaders: [], you: null, table_missing: true })
      throw new Error(error.message)
    }

    const byUser = {}
    for (const r of rows || []) {
      if (!byUser[r.user_id]) byUser[r.user_id] = { user_id: r.user_id, xp: 0, battles: 0, score: 0, total: 0 }
      byUser[r.user_id].xp      += r.xp || 0
      byUser[r.user_id].battles += 1
      byUser[r.user_id].score   += r.score
      byUser[r.user_id].total   += r.total
    }
    const aggList = Object.values(byUser)
    aggList.sort((a, b) => b.xp - a.xp)
    const top = aggList.slice(0, 50)

    const userIds = top.map(r => r.user_id)
    let nameMap = {}
    if (userIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('users').select('id, name, avatar_url, class_name')
        .in('id', userIds)
      nameMap = (users || []).reduce((m, u) => { m[u.id] = u; return m }, {})
    }

    const enriched = top.map((r, i) => ({
      rank:       i + 1,
      user_id:    r.user_id,
      name:       nameMap[r.user_id]?.name || 'Anonymous',
      avatar_url: nameMap[r.user_id]?.avatar_url || null,
      class_name: nameMap[r.user_id]?.class_name || null,
      xp:         r.xp,
      battles:    r.battles,
      accuracy:   r.total > 0 ? Math.round((r.score / r.total) * 100) : 0,
    }))

    res.json({ range, leaders: enriched, you: enriched.find(e => e.user_id === req.user.id) || null })
  } catch (e) {
    if (isMissingTable(e)) return res.json({ range, leaders: [], you: null, table_missing: true })
    res.status(500).json({ error: e.message })
  }
})

router.get('/me', async (req, res) => {
  const empty = {
    total_xp:     0,
    battles:      0,
    avg_accuracy: 0,
    streak:       0,
    best:         null,
    recent:       [],
  }
  if (!req.schoolId) return res.json(empty)
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('battle_scores')
      .select('id, score, total, accuracy, difficulty, topic, subject, xp, is_daily, played_on, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(60)

    if (error) {
      if (isMissingTable(error)) return res.json(empty)
      throw new Error(error.message)
    }

    const totalXp = (rows || []).reduce((s, r) => s + (r.xp || 0), 0)
    const battles = rows.length
    const avgAcc  = battles > 0 ? rows.reduce((s, r) => s + r.accuracy, 0) / battles : 0

    const days = new Set((rows || []).map(r => r.played_on))
    let streak = 0
    const cursor = new Date()
    while (true) {
      const k = cursor.toISOString().slice(0, 10)
      if (days.has(k)) {
        streak++
        cursor.setDate(cursor.getDate() - 1)
      } else {
        if (streak === 0) {
          cursor.setDate(cursor.getDate() - 1)
          const k2 = cursor.toISOString().slice(0, 10)
          if (days.has(k2)) { streak++; cursor.setDate(cursor.getDate() - 1); continue }
        }
        break
      }
    }

    const best = rows.reduce((m, r) => (r.accuracy > (m?.accuracy || 0) ? r : m), null)

    res.json({
      total_xp:    totalXp,
      battles,
      avg_accuracy: Math.round(avgAcc * 100),
      streak,
      best,
      recent:      rows.slice(0, 10),
    })
  } catch (e) {
    if (isMissingTable(e)) return res.json(empty)
    res.status(500).json({ error: e.message })
  }
})

router.get('/daily-challenge', async (req, res) => {
  const start = new Date(new Date().getFullYear(), 0, 0)
  const diff = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)
  const idx = Math.floor(diff) % DAILY_TOPICS.length
  const c = DAILY_TOPICS[idx]

  let alreadyPlayed = false
  try {
    const { data } = await supabaseAdmin
      .from('battle_scores')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('played_on', today())
      .eq('is_daily', true)
      .maybeSingle()
    alreadyPlayed = !!data
  } catch {  }

  res.json({
    date: today(),
    challenge: c,
    already_played: alreadyPlayed,
    xp_per_correct: XP_PER_CORRECT[c.difficulty],
    questions: 10,
  })
})

export default router
