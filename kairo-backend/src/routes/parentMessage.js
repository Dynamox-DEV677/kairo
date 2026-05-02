/**
 * Parent Message Generator Routes
 *
 * POST /api/parent-message/generate
 */
import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { aiCall, parseJSON } from '../utils/ai.js'

const router = Router()
router.use(requireAuth)

router.post('/generate', async (req, res) => {
  const {
    student_name,
    class: cls,
    subject,
    message_type,      // performance | warning | appreciation | fee | attendance | general
    tone = 'formal',   // formal | friendly | urgent
    context,           // free-text details: "scored 45/100 in maths, weak in algebra"
    parent_name,
    teacher_name,
    school_name = 'School',
  } = req.body

  if (!student_name || !message_type || !context)
    return res.status(400).json({ error: 'student_name, message_type, context are required.' })

  try {
    const prompt = `You are a school teacher writing a message to a parent.

Details:
- Student: ${student_name}${cls ? `, Class ${cls}` : ''}
- Subject: ${subject || 'General'}
- Message type: ${message_type}
- Tone: ${tone}
- Context: ${context}
- Parent name: ${parent_name || 'Parent/Guardian'}
- Teacher: ${teacher_name || 'Class Teacher'}
- School: ${school_name}

Return ONLY valid JSON:
{
  "subject_line": "Short subject (for email/WhatsApp notification)",
  "salutation": "Dear Mr./Mrs. [Name],",
  "body": "Full message body — 2-4 paragraphs, professional, appropriate tone, specific details from context",
  "closing": "Regards, \\n[Teacher Name]\\n[School Name]",
  "whatsapp_version": "Shorter version suitable for WhatsApp (under 300 chars)",
  "sms_version": "Very short SMS version (under 160 chars)"
}

Rules:
- Be specific, use the student's name and actual details
- ${tone === 'urgent' ? 'Be firm and clear about consequences' : tone === 'friendly' ? 'Be warm and encouraging' : 'Maintain professional distance'}
- No markdown in the body field, plain text only
- No extra text outside JSON`

    const raw = await aiCall({
      taskType: 'parent_message',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1200,
    })

    res.json(parseJSON(raw))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Generate multiple messages for bulk parent communication
router.post('/bulk', async (req, res) => {
  const { students, message_type, context_template, tone = 'formal', school_name } = req.body
  if (!students?.length || !message_type || !context_template)
    return res.status(400).json({ error: 'students[], message_type, context_template required.' })

  const results = []
  for (const s of students.slice(0, 20)) { // cap at 20
    try {
      const context = context_template.replace('{name}', s.name).replace('{class}', s.class || '')
      const prompt = `Write a brief ${tone} ${message_type} message to the parent of ${s.name} (Class ${s.class || ''}). Context: ${context}. School: ${school_name || 'School'}. Return JSON with "subject_line", "body", "whatsapp_version" only.`
      const raw = await aiCall({ taskType: 'parent_message', messages: [{ role: 'user', content: prompt }], maxTokens: 600 })
      results.push({ student: s.name, ...parseJSON(raw) })
    } catch (e) {
      results.push({ student: s.name, error: e.message })
    }
  }

  res.json({ count: results.length, messages: results })
})

export default router
