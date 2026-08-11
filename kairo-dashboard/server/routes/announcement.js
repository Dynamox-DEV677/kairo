import { Router } from 'express'
import { db } from '../db/index.js'
import { aiCall } from '../utils/ai.js'

import { requireSupabaseAuth, requireRole } from '../middleware/supabaseAuth.js'

const router = Router()

// Phase 0: served school data to anyone who guessed an integer school_id.
// No UI ships for these in v1, so the role check is the only guard.
router.use(requireSupabaseAuth)
router.use(requireRole('teacher', 'admin'))
const sid = req => req.body?.school_id || req.query?.school_id || 'demo_school'

router.post('/generate', async (req, res) => {
  const {
    type = 'general',
    topic, audience = 'all',
    tone = 'formal',
    details = '',
    school_name = 'Our School',
    include_whatsapp = true,
  } = req.body

  if (!topic) return res.status(400).json({ error: 'topic is required.' })

  try {
    const prompt = `You are a professional school administrator for ${school_name}.

Write a school announcement with the following details:
- Type: ${type}
- Topic: ${topic}
- Audience: ${audience}
- Tone: ${tone}
- Additional details: ${details || 'None'}

Return ONLY valid JSON:
{
  "title": "Announcement Title",
  "body": "Full formal announcement text (2-4 paragraphs)",
  "short_version": "1-sentence summary for notice board",
  "whatsapp_message": "WhatsApp-friendly version with emojis (under 200 words)",
  "sms_version": "SMS version (under 160 chars)",
  "key_dates": ["Date: Event"],
  "action_required": "What recipients need to do (or null)"
}`

    const raw = await aiCall({
      taskType: 'announcement',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 800,
    })

    let announcement
    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      announcement = JSON.parse(cleaned)
    } catch {
      announcement = { title: topic, body: raw, short_version: '', whatsapp_message: '', sms_version: '' }
    }

    const doc = await db.announcements?.insertAsync?.({
      school_id: sid(req), type, topic, audience, tone, ...announcement,
      created_at: new Date().toISOString(),
    }).catch(() => null)

    res.status(201).json({ ...announcement, id: doc?._id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/', async (req, res) => {
  const { type } = req.query
  const q = { school_id: sid(req) }
  if (type) q.type = type
  try {
    const announcements = await db.announcements?.findAsync?.(q) || []
    res.json(announcements.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/:id', async (req, res) => {
  await db.announcements?.removeAsync?.({ _id: req.params.id, school_id: sid(req) }, {})
  res.json({ message: 'Deleted.' })
})

export default router
