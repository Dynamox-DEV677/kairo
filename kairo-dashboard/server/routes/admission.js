/**
 * Admission Bot — Supabase-backed, school-scoped lead pipeline
 *
 * PUBLIC (no auth required — used by parent-facing chat widget):
 *   POST /api/admission/chat               AI chat with school-aware system prompt
 *   POST /api/admission/lead               Capture an admission enquiry
 *   GET  /api/admission/public-config/:id  Read a school's admission_config (limited fields)
 *
 * ADMIN ONLY (school-scoped):
 *   GET    /api/admission/config           Read full admission_config for my school
 *   PUT    /api/admission/config           Update admission_config
 *   GET    /api/admission/leads            List leads for my school
 *   PUT    /api/admission/leads/:id        Update lead status / notes
 *   DELETE /api/admission/leads/:id        Delete a lead
 *   GET    /api/admission/stats            Lead stats (counts by status)
 */
import { Router } from 'express'
import { supabaseAdmin, requireSupabase } from '../services/supabase.js'
import { requireSupabaseAuth, requireRole } from '../middleware/supabaseAuth.js'
import { aiCall } from '../utils/ai.js'

const router = Router()
router.use(requireSupabase)

// ── Build system prompt from school's admission_config ─────────────────────────
function buildSystemPrompt(schoolName, cfg) {
  const c = cfg || {}
  return `You are an AI admission assistant for ${schoolName || 'this school'}.

School information:
${c.description || 'A leading educational institution providing quality education.'}
${c.grades        ? `Grades offered: ${c.grades}` : ''}
${c.fees          ? `Fees: ${c.fees}` : ''}
${c.timings       ? `School timings: ${c.timings}` : ''}
${c.contact       ? `Contact: ${c.contact}` : ''}
${c.address       ? `Address: ${c.address}` : ''}
${c.facilities    ? `Facilities: ${c.facilities}` : ''}
${c.documents     ? `Documents needed for admission: ${c.documents}` : ''}
${c.admission_dates ? `Admission dates / window: ${c.admission_dates}` : ''}

Your role:
- Answer admission questions warmly and professionally
- Naturally collect parent name, child name, grade, contact number during the chat
- Guide them through the admission process
- If a question can't be answered from the info above, say "Our admission team will contact you with details"
- Keep replies concise (under 100 words) and friendly
- Never invent specific information not provided`
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ENDPOINTS (no auth)
// ─────────────────────────────────────────────────────────────────────────────

// Public school config — only safe fields exposed to parents
router.get('/public-config/:school_id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('schools')
      .select('id, school_name, school_logo_url, admission_config')
      .eq('id', req.params.school_id)
      .single()

    if (error || !data) return res.status(404).json({ error: 'School not found.' })
    res.json({
      school_id:   data.id,
      school_name: data.school_name,
      school_logo: data.school_logo_url,
      config:      data.admission_config || {},
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Public chat — uses the school's saved config
router.post('/chat', async (req, res) => {
  const { message, school_id, conversation_history = [] } = req.body
  if (!message || !school_id) return res.status(400).json({ error: 'message and school_id are required.' })

  try {
    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('school_name, admission_config')
      .eq('id', school_id)
      .single()

    if (!school) return res.status(404).json({ error: 'School not found.' })

    const messages = [
      { role: 'system', content: buildSystemPrompt(school.school_name, school.admission_config) },
      ...conversation_history.slice(-8).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ]

    const reply = await aiCall({
      taskType:    'admission_chat',
      messages,
      maxTokens:   320,
      temperature: 0.8,
    })

    res.json({ reply, timestamp: new Date().toISOString() })
  } catch (e) {
    console.error('[admission/chat]', e.message)
    res.status(500).json({ error: e.message })
  }
})

// Public lead capture
router.post('/lead', async (req, res) => {
  const { school_id, parent_name, child_name, grade, phone, email, message, source } = req.body

  if (!school_id) return res.status(400).json({ error: 'school_id is required.' })
  if (!phone && !email) return res.status(400).json({ error: 'phone or email is required.' })

  try {
    // Verify school exists (avoid junk leads)
    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('id')
      .eq('id', school_id)
      .single()
    if (!school) return res.status(404).json({ error: 'School not found.' })

    const { data: lead, error } = await supabaseAdmin
      .from('admission_leads')
      .insert({
        school_id,
        parent_name: parent_name?.trim() || null,
        child_name:  child_name?.trim()  || null,
        grade:       grade?.trim()       || null,
        phone:       phone?.trim()       || null,
        email:       email?.trim().toLowerCase() || null,
        message:     message?.trim()     || null,
        source:      source              || 'chat_bot',
        status:      'new',
      })
      .select('id, created_at')
      .single()

    if (error) throw new Error(error.message)

    res.status(201).json({
      id:      lead.id,
      message: 'Enquiry captured. The admission team will contact you within 24 hours.',
    })
  } catch (e) {
    console.error('[admission/lead]', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS (auth + admin role)
// ─────────────────────────────────────────────────────────────────────────────
router.use(requireSupabaseAuth)

// Get my school's full admission config
router.get('/config', requireRole('admin'), async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'You are not in a school.' })
  try {
    const { data, error } = await supabaseAdmin
      .from('schools')
      .select('admission_config, school_name, school_logo_url')
      .eq('id', req.schoolId)
      .single()

    if (error) throw new Error(error.message)
    res.json({
      school_name: data.school_name,
      school_logo: data.school_logo_url,
      config:      data.admission_config || {},
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Update my school's admission config
router.put('/config', requireRole('admin'), async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'You are not in a school.' })

  const allowed = [
    'description', 'grades', 'fees', 'timings', 'contact',
    'address', 'facilities', 'documents', 'admission_dates',
  ]
  const config = {}
  for (const k of allowed) {
    if (req.body?.[k] !== undefined) config[k] = String(req.body[k]).trim()
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('schools')
      .update({ admission_config: config })
      .eq('id', req.schoolId)
      .select('admission_config')
      .single()

    if (error) throw new Error(error.message)
    res.json({ message: 'Saved.', config: data.admission_config })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// List leads for my school
router.get('/leads', requireRole('admin'), async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'You are not in a school.' })

  const { status } = req.query
  try {
    let q = supabaseAdmin
      .from('admission_leads')
      .select('*')
      .eq('school_id', req.schoolId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (status && status !== 'all') q = q.eq('status', status)

    const { data, error } = await q
    if (error) throw new Error(error.message)
    res.json(data || [])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Update lead
router.put('/leads/:id', requireRole('admin'), async (req, res) => {
  const valid = ['new', 'contacted', 'admitted', 'rejected', 'not_interested']
  const u = { updated_at: new Date().toISOString() }
  if (req.body.status) {
    if (!valid.includes(req.body.status)) {
      return res.status(400).json({ error: `status must be: ${valid.join(', ')}` })
    }
    u.status = req.body.status
  }
  if (req.body.notes !== undefined) u.notes = req.body.notes

  try {
    // Verify lead belongs to my school
    const { data: existing } = await supabaseAdmin
      .from('admission_leads')
      .select('school_id')
      .eq('id', req.params.id)
      .single()

    if (!existing || existing.school_id !== req.schoolId) {
      return res.status(403).json({ error: 'Not your lead.' })
    }

    const { error } = await supabaseAdmin
      .from('admission_leads')
      .update(u)
      .eq('id', req.params.id)

    if (error) throw new Error(error.message)
    res.json({ message: 'Lead updated.' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Delete lead
router.delete('/leads/:id', requireRole('admin'), async (req, res) => {
  try {
    const { data: existing } = await supabaseAdmin
      .from('admission_leads')
      .select('school_id')
      .eq('id', req.params.id)
      .single()

    if (!existing || existing.school_id !== req.schoolId) {
      return res.status(403).json({ error: 'Not your lead.' })
    }

    const { error } = await supabaseAdmin
      .from('admission_leads')
      .delete()
      .eq('id', req.params.id)

    if (error) throw new Error(error.message)
    res.json({ message: 'Lead deleted.' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Stats — counts by status
router.get('/stats', requireRole('admin'), async (req, res) => {
  if (!req.schoolId) return res.status(400).json({ error: 'You are not in a school.' })

  try {
    const [
      { count: total },
      { count: newCount },
      { count: contacted },
      { count: admitted },
      { count: rejected },
    ] = await Promise.all([
      supabaseAdmin.from('admission_leads').select('*', { count: 'exact', head: true }).eq('school_id', req.schoolId),
      supabaseAdmin.from('admission_leads').select('*', { count: 'exact', head: true }).eq('school_id', req.schoolId).eq('status', 'new'),
      supabaseAdmin.from('admission_leads').select('*', { count: 'exact', head: true }).eq('school_id', req.schoolId).eq('status', 'contacted'),
      supabaseAdmin.from('admission_leads').select('*', { count: 'exact', head: true }).eq('school_id', req.schoolId).eq('status', 'admitted'),
      supabaseAdmin.from('admission_leads').select('*', { count: 'exact', head: true }).eq('school_id', req.schoolId).eq('status', 'rejected'),
    ])

    res.json({ total, new: newCount, contacted, admitted, rejected })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
