import { Router } from 'express'
import { supabaseAdmin, requireSupabase } from '../services/supabase.js'
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'

const router = Router()
router.use(requireSupabase)
router.use(requireSupabaseAuth)

const KINDS = ['flashcards', 'summary', 'doubt', 'concept_map', 'note', 'plan', 'grade']

/**
 * Every route here answered a missing `notebooks` table with a bare 500, which
 * the client swallowed -- so chat could report "Created 6 flashcards" while
 * nothing was written anywhere. A missing table is a deployment problem, not a
 * request problem: say so, with the fix.
 */
function fail(res, e) {
  const msg = e?.message || 'Unknown error'
  if (msg.includes('does not exist') || msg.includes('schema cache')) {
    return res.status(503).json({
      error: 'The notebook store is not set up on this project yet.',
      hint:  'Run server/db/notebook_schema.sql in the Supabase SQL editor.',
    })
  }
  console.error('[notebook]', msg)
  return res.status(500).json({ error: msg })
}

router.get('/', async (req, res) => {
  const { kind, subject, q, limit = 50 } = req.query
  try {
    let query = supabaseAdmin
      .from('notebooks')
      .select('id, kind, subject, title, content, tags, source, pinned, created_at, updated_at')
      .eq('user_id', req.user.id)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(Math.min(Number(limit) || 50, 200))

    if (kind && KINDS.includes(kind))    query = query.eq('kind', kind)
    if (subject)                          query = query.eq('subject', subject)
    if (q)                                query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    res.json(data || [])
  } catch (e) {
    fail(res, e)
  }
})

router.post('/', async (req, res) => {
  const { kind, subject, title, content, tags, source } = req.body || {}
  if (!kind || !KINDS.includes(kind)) return res.status(400).json({ error: `kind must be one of: ${KINDS.join(', ')}` })
  if (!title?.trim() || !content) return res.status(400).json({ error: 'title and content are required' })

  try {
    const { data, error } = await supabaseAdmin
      .from('notebooks')
      .insert({
        user_id:   req.user.id,
        school_id: req.schoolId || null,
        kind,
        subject:   subject?.trim() || null,
        title:     title.trim().slice(0, 200),
        content:   typeof content === 'string' ? content : JSON.stringify(content),
        tags:      Array.isArray(tags) ? tags.slice(0, 10) : [],
        source:    source || null,
      })
      .select('id, created_at')
      .single()

    if (error) throw new Error(error.message)
    res.status(201).json({ id: data.id, message: 'Saved to notebook.' })
  } catch (e) {
    fail(res, e)
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notebooks')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()
    if (error || !data) return res.status(404).json({ error: 'Not found.' })
    res.json(data)
  } catch (e) { fail(res, e) }
})

router.put('/:id', async (req, res) => {
  const { title, content, tags, subject, pinned } = req.body || {}
  const u = { updated_at: new Date().toISOString() }
  if (title    !== undefined) u.title   = String(title).trim().slice(0, 200)
  if (content  !== undefined) u.content = typeof content === 'string' ? content : JSON.stringify(content)
  if (tags     !== undefined) u.tags    = Array.isArray(tags) ? tags.slice(0, 10) : []
  if (subject  !== undefined) u.subject = subject || null
  if (pinned   !== undefined) u.pinned  = !!pinned

  try {
    const { data: existing } = await supabaseAdmin
      .from('notebooks').select('user_id').eq('id', req.params.id).single()
    if (!existing || existing.user_id !== req.user.id) return res.status(403).json({ error: 'Not your note.' })

    const { error } = await supabaseAdmin
      .from('notebooks').update(u).eq('id', req.params.id)
    if (error) throw new Error(error.message)
    res.json({ message: 'Updated' })
  } catch (e) { fail(res, e) }
})

router.delete('/:id', async (req, res) => {
  try {
    const { data: existing } = await supabaseAdmin
      .from('notebooks').select('user_id').eq('id', req.params.id).single()
    if (!existing || existing.user_id !== req.user.id) return res.status(403).json({ error: 'Not your note.' })

    const { error } = await supabaseAdmin
      .from('notebooks').delete().eq('id', req.params.id)
    if (error) throw new Error(error.message)
    res.json({ message: 'Deleted' })
  } catch (e) { fail(res, e) }
})

router.get('/meta/stats', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notebooks')
      .select('kind, subject')
      .eq('user_id', req.user.id)
    if (error) throw new Error(error.message)

    const byKind = {}
    const bySubject = {}
    for (const n of data || []) {
      byKind[n.kind] = (byKind[n.kind] || 0) + 1
      if (n.subject) bySubject[n.subject] = (bySubject[n.subject] || 0) + 1
    }
    res.json({ total: data.length, byKind, bySubject })
  } catch (e) { fail(res, e) }
})

export default router
