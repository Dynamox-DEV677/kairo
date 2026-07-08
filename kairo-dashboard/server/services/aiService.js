/**
 * AI Service
 * ──────────
 * Generates dynamic, non-robotic fee reminder email content
 * via OpenRouter (same API used by the dashboard).
 *
 * Falls back to a clean template if AI is unavailable.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = process.env.AI_MODEL || 'openai/gpt-oss-20b:free'

const TONE_INSTRUCTIONS = {
  friendly: 'Write in a warm, friendly and encouraging tone. Be polite and understanding.',
  formal:   'Write in a formal, professional tone suitable for official school communication.',
  urgent:   'Write with a sense of urgency while remaining respectful. Make the consequences clear.',
}

/**
 * Generate email subject + body using AI.
 * @param {{ studentName, parentEmail, className, feeAmount, dueDate, status, trigger, tone }} context
 * @returns {{ subject: string, body: string }}
 */
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
- Sign off as "Kora School Admin"
- Do NOT include salutation (Dear Parent), we add that separately`

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'Kora Fee Reminder',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 512,
      }),
    })

    if (!res.ok) throw new Error(`AI API ${res.status}`)

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content || ''
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    if (parsed.subject && parsed.body) return parsed
    throw new Error('Incomplete AI response')

  } catch (err) {
    console.warn('[AI] Falling back to template:', err.message)
    return fallbackTemplate(context)
  }
}

// ─── Fallback Template ────────────────────────────────────────────────────────

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
Kora School Admin`

  return { subject, body }
}
