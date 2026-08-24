import express from 'express'
import groqPool from '../services/groqPool.js'
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'

/**
 * HD voice for Listen — Groq's Orpheus TTS on the same free-tier key pool the
 * rest of Kyno's AI runs on. One card script per call, so the response stays
 * small and comfortably inside Vercel's 10s ceiling (never batch a playlist
 * into one request — that's the timeout rule from the exam/notebook lessons).
 *
 * The client ALWAYS has the device voice to fall back on, so every failure
 * here is a soft one: return a clean error and the card still gets spoken,
 * just less prettily.
 */

const router = express.Router()

export const TTS_MODEL = 'canopylabs/orpheus-v1-english'
export const TTS_VOICES = ['hannah', 'troy', 'austin']
export const MAX_CHARS = 600

/** Pure, testable: what actually gets sent to the model. */
export function clampSpeechText(input) {
  const s = String(input || '').replace(/\s+/g, ' ').trim()
  if (!s) return null
  if (s.length <= MAX_CHARS) return s
  // Cut on a sentence edge when one exists in the tail; never mid-word.
  const cut = s.slice(0, MAX_CHARS)
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '))
  return (lastStop > MAX_CHARS * 0.5 ? cut.slice(0, lastStop + 1) : cut.slice(0, cut.lastIndexOf(' '))).trim()
}

export function pickVoice(v) {
  return TTS_VOICES.includes(String(v || '').toLowerCase()) ? String(v).toLowerCase() : TTS_VOICES[0]
}

router.use(requireSupabaseAuth)

router.post('/', async (req, res) => {
  const text = clampSpeechText(req.body?.text)
  if (!text) return res.status(400).json({ error: 'text required' })
  const voice = pickVoice(req.body?.voice)

  const key = groqPool.next()
  if (!key) return res.status(503).json({ error: 'HD voice unavailable — no live keys', fallback: true })

  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: TTS_MODEL,
        voice,
        input: text,
        response_format: 'wav',
      }),
    })

    if (!upstream.ok) {
      groqPool.markBad(key, upstream.status)
      const detail = await upstream.text().catch(() => '')
      // 429/4xx/5xx all mean the same thing to the student: use the device
      // voice this time. Log enough to debug, say little.
      console.warn('[tts] upstream', upstream.status, detail.slice(0, 200))
      return res.status(503).json({ error: 'HD voice busy — using device voice', fallback: true })
    }

    const audio = Buffer.from(await upstream.arrayBuffer())
    res.setHeader('Content-Type', 'audio/wav')
    res.setHeader('Cache-Control', 'no-store')
    return res.send(audio)
  } catch (e) {
    groqPool.markBad(key, 500)
    console.warn('[tts] error', e?.message)
    return res.status(503).json({ error: 'HD voice unavailable', fallback: true })
  }
})

export default router
