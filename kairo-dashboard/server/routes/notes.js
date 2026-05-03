/**
 * Notes Routes (Supabase-backed, school-scoped)
 *
 * POST   /api/notes            Save a note
 * GET    /api/notes            List my notes (with optional subject filter)
 * GET    /api/notes/:id        Get a single note
 * PUT    /api/notes/:id        Update a note
 * DELETE /api/notes/:id        Delete a note
 * GET    /api/notes/:id/pdf    Download note as PDF (pdfkit)
 * GET    /api/notes/subjects   List distinct subjects for this user
 */
import { Router }        from 'express'
import PDFDocument       from 'pdfkit'
import { supabaseAdmin, requireSupabase } from '../services/supabase.js'
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'

const router = Router()
router.use(requireSupabase)
router.use(requireSupabaseAuth)

// ── Save Note ─────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { title, content, subject = 'General' } = req.body

  if (!title?.trim())   return res.status(400).json({ error: 'title is required.' })
  if (!content?.trim()) return res.status(400).json({ error: 'content is required.' })
  if (!req.schoolId)    return res.status(400).json({ error: 'You must be in a school to save notes.' })

  try {
    const { data, error } = await supabaseAdmin
      .from('notes')
      .insert({
        user_id:   req.user.id,
        school_id: req.schoolId,
        title:     title.trim(),
        content:   content.trim(),
        subject:   subject.trim() || 'General',
      })
      .select('id, title, content, subject, word_count, created_at, updated_at')
      .single()

    if (error) throw new Error(error.message)

    console.log(`[Notes] ✓ Saved: "${title}" by ${req.user.name}`)
    res.status(201).json({ message: 'Note saved.', note: data })
  } catch (e) {
    console.error('[Notes/save]', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── List Notes ────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { subject, q, limit = 50, offset = 0 } = req.query

  try {
    let query = supabaseAdmin
      .from('notes')
      .select('id, title, subject, word_count, created_at, updated_at')
      .eq('user_id', req.user.id)
      .order('updated_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1)

    if (subject) query = query.ilike('subject', subject)
    if (q)       query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    res.json({ notes: data, count: data.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Get Single Note ───────────────────────────────────────────────────────────
router.get('/subjects', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notes')
      .select('subject')
      .eq('user_id', req.user.id)

    if (error) throw new Error(error.message)

    const subjects = [...new Set(data.map(r => r.subject))].sort()
    res.json({ subjects })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notes')
      .select('id, title, content, subject, word_count, created_at, updated_at')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)   // enforce ownership
      .single()

    if (error || !data) return res.status(404).json({ error: 'Note not found.' })
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Update Note ───────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { title, content, subject } = req.body
  const updates = {}
  if (title   !== undefined) updates.title   = title.trim()
  if (content !== undefined) updates.content = content.trim()
  if (subject !== undefined) updates.subject = subject.trim() || 'General'

  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update.' })

  try {
    const { data, error } = await supabaseAdmin
      .from('notes')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id, title, content, subject, word_count, updated_at')
      .single()

    if (error || !data) return res.status(404).json({ error: 'Note not found or not yours.' })
    res.json({ message: 'Note updated.', note: data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Delete Note ───────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notes')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id')
      .single()

    if (error || !data) return res.status(404).json({ error: 'Note not found or not yours.' })
    res.json({ message: 'Note deleted.' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Download Note as PDF ──────────────────────────────────────────────────────
router.get('/:id/pdf', async (req, res) => {
  try {
    const { data: note, error } = await supabaseAdmin
      .from('notes')
      .select('id, title, content, subject, word_count, created_at')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (error || !note) return res.status(404).json({ error: 'Note not found.' })

    // Set up PDF streaming
    const filename = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    doc.pipe(res)

    // ── Header ──
    doc
      .fillColor('#1e293b')
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(note.title, { align: 'left' })

    doc.moveDown(0.3)

    // Subject + metadata bar
    doc
      .fontSize(10)
      .fillColor('#64748b')
      .font('Helvetica')
      .text(
        `Subject: ${note.subject}   •   ${note.word_count ?? 0} words   •   ${new Date(note.created_at).toLocaleDateString('en-IN', { dateStyle: 'long' })}`,
        { align: 'left' }
      )

    // Divider
    doc.moveDown(0.5)
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor('#e2e8f0')
      .stroke()
    doc.moveDown(0.8)

    // ── Body ──
    doc
      .fontSize(12)
      .fillColor('#1e293b')
      .font('Helvetica')
      .text(note.content, { align: 'left', lineGap: 4 })

    // ── Footer ──
    doc.moveDown(2)
    doc
      .fontSize(9)
      .fillColor('#94a3b8')
      .text(`Generated by Kairo — ${req.user.name} — ${req.school?.school_name ?? ''}`, {
        align: 'center',
      })

    doc.end()
    console.log(`[Notes] ✓ PDF generated: "${note.title}"`)
  } catch (e) {
    console.error('[Notes/pdf]', e.message)
    if (!res.headersSent) res.status(500).json({ error: e.message })
  }
})

export default router
