/**
 * /api/ai/chat  — OpenRouter proxy (no auth required, key stays server-side)
 * The frontend streams through here instead of calling OpenRouter directly.
 */
import express from 'express'

const router = express.Router()
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions'

router.post('/chat', async (req, res) => {
  const { messages, model = 'openai/gpt-oss-20b:free', stream = false } = req.body

  if (!messages?.length) {
    return res.status(400).json({ error: 'messages array required' })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'OPENROUTER_API_KEY not configured on server.' })
  }

  try {
    const upstream = await fetch(OR_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.ALLOWED_ORIGIN || 'https://kairo-daily-edu.vercel.app',
        'X-Title': 'Kairo',
      },
      body: JSON.stringify({ model, messages, stream }),
    })

    if (!stream) {
      const data = await upstream.json()
      return res.json(data)
    }

    // Stream SSE back to client
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const reader = upstream.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(decoder.decode(value))
    }
    res.end()
  } catch (err) {
    console.error('[aiChat]', err.message)
    res.status(500).json({ error: 'Upstream request failed.' })
  }
})

export default router
