
import { aiCall } from '../utils/ai.js'

const TONE_INSTRUCTIONS = {
  friendly: 'Write in a warm, friendly and encouraging tone. Be polite and understanding.',
  formal:   'Write in a formal, professional tone suitable for official school communication.',
  urgent:   'Write with a sense of urgency while remaining respectful. Make the consequences clear.',
}

export async function generateEmailContent(context) {
  const { studentName, className, feeAmount, dueDate, trigger, tone = 'friendly' } = context
  const toneGuide = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.friendly

  const triggerLabel = {
    before_due: `due in a few days (${dueDate})`,
    on_due:     `due TODAY (${dueDate})`,
    after_due:  `OVERDUE since ${dueDate}`,
    manual:     `pending (due: ${dueDate})`,
  }[trigger] || `due on ${dueDate}`

  const prompt = `You are a school admin assistant. Write a fee reminder email.

Context:
- Student: ${studentName} (Class ${className})
- Fee Amount: ₹${feeAmount}
- Status: ${triggerLabel}
- Tone: ${toneGuide}

Output ONLY valid JSON with these exact keys:
{
  "subject": "...",
  "body": "..."
}

Rules:
- Subject: concise, under 60 chars
- Body: plain text, 3-5 short paragraphs, NO markdown
- Include student name, amount, due date naturally in the text
- Sign off as "Kyno School Admin"
- Do NOT include salutation (Dear Parent), we add that separately`

  try {
    const raw = await aiCall({
      taskType: 'speed',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 512,
    })
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    if (parsed.subject && parsed.body) return parsed
    throw new Error('Incomplete AI response')

  } catch (err) {
    console.warn('[AI] Falling back to template:', err.message)
    return fallbackTemplate(context)
  }
}

function fallbackTemplate({ studentName, className, feeAmount, dueDate, trigger, tone }) {
  const isOverdue = trigger === 'after_due'
  const isToday   = trigger === 'on_due'

  const subject = isOverdue
    ? `[OVERDUE] Fee Reminder — ${studentName} | ₹${feeAmount}`
    : isToday
    ? `Fee Due Today — ${studentName} | ₹${feeAmount}`
    : `Fee Reminder — ${studentName} | Due ${dueDate}`

  const urgencyLine = isOverdue
    ? `This is a reminder that the fee of ₹${feeAmount} for ${studentName} (Class ${className}) was due on ${dueDate} and remains unpaid.`
    : isToday
    ? `This is a reminder that the fee of ₹${feeAmount} for ${studentName} (Class ${className}) is due today.`
    : `This is a friendly reminder that the fee of ₹${feeAmount} for ${studentName} (Class ${className}) is due on ${dueDate}.`

  const body = `${urgencyLine}

We kindly request you to clear the pending amount at the earliest to avoid any disruption to your child's academic activities.

If you have already made the payment, please disregard this message or contact us with the receipt.

Thank you for your cooperation.

Warm regards,
Kyno School Admin`

  return { subject, body }
}
