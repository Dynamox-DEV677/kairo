/**
 * AI Memory — legacy route. The `ai_memory` table was deleted in the DB
 * cleanup; the client now stores memory in localStorage via src/lib/twin.ts.
 *
 * These endpoints stay mounted so old API callers don't get 404/500 — they
 * all return 200 with empty/no-op payloads. New code should not call them.
 */
import { Router } from 'express'
import { supabaseAdmin, requireSupabase } from '../services/supabase.js'
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'

const router = Router()
router.use(requireSupabase)
router.use(requireSupabaseAuth)

/** Detect "table doesn't exist" from a Supabase error. */
function isMissingTable(err) {
  const msg = String(err?.message || err || '').toLowerCase()
  return msg.includes('does not exist')
      || msg.includes('schema cache')
      || msg.includes('ai_memory')
}

/** Empty payload in the shape the legacy UI expects. */
const EMPTY_MEMORY = {
  total:       0,
  weak:        [],
  strong:      [],
  mistakes:    [],
  improved:    [],
  preferences: [],
  all:         [],
}

// ── POST /track — accept the call, silently no-op if table is gone ──────────
router.post('/track', async (req, res) => {
  try {
    const { type, subject, topic, content, signal, hits } = req.body || {}
    if (!type) return res.json({ message: 'no-op (no type)' })

    const { data, error } = await supabaseAdmin
      .from('ai_memory')
      .insert({
        user_id: req.user.id,
        type, subject, topic, content,
        signal: signal ?? 0, hits: hits ?? 1,
        last_seen: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      if (isMissingTable(error)) return res.json({ message: 'no-op (table missing)' })
      throw new Error(error.message)
    }
    res.status(201).json({ message: 'Tracked', id: data.id })
  } catch (e) {
    if (isMissingTable(e)) return res.json({ message: 'no-op (table missing)' })
    res.status(500).json({ error: e.message })
  }
})

// ── GET / — return the legacy bucket shape or an empty payload ──────────────
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_memory')
      .select('*')
      .eq('user_id', req.user.id)
      .order('last_seen', { ascending: false })
      .limit(200)

    if (error) {
      if (isMissingTable(error)) return res.json(EMPTY_MEMORY)
      throw new Error(error.message)
    }

    const weak = [], strong = [], mistakes = [], prefs = []
    for (const m of data) {
      if (m.type === 'weak_topic' || (m.type === 'mistake' && m.signal < -0.3)) weak.push(m)
      else if (m.type === 'strong_topic') strong.push(m)
      else if (m.type === 'preference') prefs.push(m)
      if (m.type === 'mistake') mistakes.push(m)
    }
    weak.sort((a, b) => a.signal - b.signal)
    strong.sort((a, b) => b.signal - a.signal)
    const improved = data.filter(m => m.signal > 0.3 && m.hits > 1).slice(0, 6)

    res.json({
      total:    data.length,
      weak:     weak.slice(0, 12),
      strong:   strong.slice(0, 8),
      mistakes: mistakes.slice(0, 20),
      improved,
      preferences: prefs,
      all:      data,
    })
  } catch (e) {
    if (isMissingTable(e)) return res.json(EMPTY_MEMORY)
    res.status(500).json({ error: e.message })
  }
})

// ── GET /context — compact summary string for AI prompts ────────────────────
router.get('/context', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_memory')
      .select('type, subject, topic, signal, hits')
      .eq('user_id', req.user.id)
      .order('last_seen', { ascending: false })
      .limit(40)

    if (error) {
      if (isMissingTable(error)) return res.json({ context: '' })
      throw new Error(error.message)
    }
    res.json({ context: buildPromptContext(data || []) })
  } catch (e) {
    if (isMissingTable(e)) return res.json({ context: '' })
    res.status(500).json({ error: e.message })
  }
})

// ── DELETE /:id ─────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('ai_memory')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
    if (error && !isMissingTable(error)) throw new Error(error.message)
    res.json({ message: 'Forgotten' })
  } catch (e) {
    if (isMissingTable(e)) return res.json({ message: 'no-op' })
    res.status(500).json({ error: e.message })
  }
})

// ── POST /clear ─────────────────────────────────────────────────────────────
router.post('/clear', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('ai_memory')
      .delete()
      .eq('user_id', req.user.id)
    if (error && !isMissingTable(error)) throw new Error(error.message)
    res.json({ message: 'Memory cleared.' })
  } catch (e) {
    if (isMissingTable(e)) return res.json({ message: 'no-op' })
    res.status(500).json({ error: e.message })
  }
})

// ─── Helper: build a compact prompt string from raw rows ────────────────────
function buildPromptContext(rows) {
  if (!rows || rows.length === 0) return ''
  const weak    = rows.filter(r => r.type === 'weak_topic'   || (r.type === 'mistake' && r.signal < -0.3))
  const strong  = rows.filter(r => r.type === 'strong_topic' && r.signal > 0.3)
  const recents = rows.slice(0, 10)
  const parts = []
  if (weak.length)    parts.push(`Weak topics: ${weak.slice(0, 6).map(r => r.topic || r.subject).join(', ')}`)
  if (strong.length)  parts.push(`Strong topics: ${strong.slice(0, 4).map(r => r.topic || r.subject).join(', ')}`)
  if (recents.length) parts.push(`Recent activity: ${recents.length} entries`)
  return parts.join(' · ')
}

export default router
