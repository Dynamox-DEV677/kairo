/**
 * Admission Enquiry Bot Routes
 *
 * POST /api/admission/chat          Chat with admission bot
 * POST /api/admission/lead          Save enquiry lead
 * GET  /api/admission/leads         List captured leads
 * PUT  /api/admission/leads/:id     Update lead status
 */
import { Router } from 'express'

import { db } from '../db/index.js'
import { aiCall } from '../utils/ai.js'

const router = Router()

// ── Public chat endpoint (no auth required — used by embeddable widget) ────────
router.post('/chat', async (req, res) => {
  const { message, school_id, conversation_history = [], school_info = {} } = req.body
  if (!message || !school_id) return res.status(400).json({ error: 'message and school_id are required.' })

  try {
    const systemPrompt = `You are an AI admission assistant for ${school_info.name || 'this school'}.

School Information:
${school_info.description || 'A leading educational institution providing quality education.'}
${school_info.grades ? `Grades offered: ${school_info.grades}` : ''}
${school_info.fees ? `Fee range: ${school_info.fees}` : ''}
${school_info.contact ? `Contact: ${school_info.contact}` : ''}
${school_info.address ? `Address: ${school_info.address}` : ''}
${school_info.facilities ? `Facilities: ${school_info.facilities}` : ''}

Your role:
- Answer admission questions professionally and warmly
- Collect enquirer's name, child's name, grade applying for, contact number (ask naturally in conversation)
- Guide them through the admission process
- If you don't know something specific, say "Our admission team will contact you with details"
- Keep responses concise and friendly (under 100 words)
- NEVER make up specific information not provided above`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation_history.slice(-8).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ]

    const reply = await aiCall({
      taskType: 'admission_chat',
      messages,
      maxTokens: 300,
      temperature: 0.8,
    })

    res.json({ reply, timestamp: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Save a lead (public) ───────────────────────────────────────────────────────
router.post('/lead', async (req, res) => {
  const { school_id, parent_name, child_name, grade, phone, email, message } = req.body
  if (!school_id || !phone) return res.status(400).json({ error: 'school_id and phone are required.' })

  try {
    const lead = await db.admissionLeads.insertAsync({
      school_id,
      parent_name: parent_name || '',
      child_name:  child_name  || '',
      grade:       grade       || '',
      phone,
      email:       email       || '',
      message:     message     || '',
      status:      'new',       // new | contacted | admitted | not_interested
      created_at:  new Date().toISOString(),
    })
    res.status(201).json({ id: lead._id, message: 'Enquiry captured. Team will contact you soon.' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── List leads (auth required) ─────────────────────────────────────────────────
router.get('/leads', async (req, res) => {
  const { status } = req.query
  const q = { school_id: req.query?.school_id || 'demo_school' }
  if (status) q.status = status
  try {
    const leads = await db.admissionLeads.findAsync(q).sort({ created_at: -1 }).limit(200)
    res.json(leads)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Update lead status ─────────────────────────────────────────────────────────
router.put('/leads/:id', async (req, res) => {
  const { status, notes } = req.body
  const valid = ['new', 'contacted', 'admitted', 'not_interested']
  if (status && !valid.includes(status))
    return res.status(400).json({ error: `status must be: ${valid.join(', ')}` })
  const u = { updated_at: new Date().toISOString() }
  if (status) u.status = status
  if (notes)  u.notes  = notes
  await db.admissionLeads.updateAsync({ _id: req.params.id, school_id: req.query?.school_id || 'demo_school' }, { $set: u })
  res.json({ message: 'Lead updated.' })
})

export default router
