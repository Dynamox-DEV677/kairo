// Camera Study Mode — live vision analysis for the "AI tutor watching you work" feature.
//
// Runs on Groq's vision model by default (free, fast, 10-key pool). If a Gemini
// key is ever configured it upgrades automatically — Gemini is stronger on messy
// handwriting. Frames are analysed in memory and never stored or logged.
import express from 'express'
import groqPool from '../services/groqPool.js'
import { withSlot } from '../utils/ai.js'

const router = express.Router()

// Vercel Hobby kills the function at 10s — bail first so we own the error.
const CAMERA_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 8500)

// Groq only. Verified live 2026-08-04: 10 keys healthy, qwen3.6-27b reads a
// diagram correctly in ~6s. Gemini is deliberately NOT used here.
const GROQ_VISION = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.6-27b'

// Token budget per mode. qwen3.6 is a REASONING model — it spends tokens
// thinking before it answers, so a long prompt on a small budget gets
// truncated mid-thought and returns nothing usable. detect/grade ask for a
// small JSON object; explain asks for eight markdown sections and needs room
// for both the reasoning and the answer.
const FAST_MODES  = new Set(['detect', 'grade'])
const LONG_MODES  = new Set(['explain', 'report'])
const tokensFor = (mode) => (FAST_MODES.has(mode) ? 900 : LONG_MODES.has(mode) ? 5000 : 2000)

// ── quota guard ────────────────────────────────────────────────────────────
// Protects the free tier from a runaway client loop. Per-IP sliding window.
const HITS = new Map()
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 25

function rateLimited(ip) {
  const now = Date.now()
  const arr = (HITS.get(ip) || []).filter(t => now - t < WINDOW_MS)
  if (arr.length >= MAX_PER_WINDOW) { HITS.set(ip, arr); return true }
  arr.push(now)
  HITS.set(ip, arr)
  if (HITS.size > 500) for (const [k, v] of HITS) if (!v.some(t => now - t < WINDOW_MS)) HITS.delete(k)
  return false
}

// ── helpers ────────────────────────────────────────────────────────────────
function splitDataUrl(image) {
  const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(image || '')
  if (m) return { mime: m[1], b64: m[2] }
  return { mime: 'image/jpeg', b64: String(image || '').replace(/^data:[^,]+,/, '') }
}

// qwen emits <think>…</think> before its answer — strip it before parsing.
/**
 * Remove a reasoning model's <think> block.
 *
 * qwen3.6 is a reasoning model: on a long prompt it can spend its whole token
 * budget inside <think> and get cut off before the closing tag. Blindly
 * deleting "<think> to end of string" then returned an EMPTY answer, which the
 * UI reported as "could not read that clearly". So: only drop an unterminated
 * block if doing so still leaves us something; otherwise salvage the tail,
 * which is the most useful part of a truncated reasoning dump.
 */
function stripThinking(s) {
  const raw = String(s || '')
  const closed = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  if (!/<think>/i.test(closed)) return closed

  const withoutOpen = closed.replace(/<think>[\s\S]*$/i, '').trim()
  if (withoutOpen) return withoutOpen

  // Everything was an unclosed think block — keep the tail rather than nothing.
  const tail = closed.replace(/^[\s\S]*?<think>/i, '').trim()
  return tail.length > 40 ? tail : ''
}

function parseJsonLoose(text) {
  const clean = stripThinking(text)
  const fence = clean.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const cand  = fence ? fence[1] : clean
  const start = cand.indexOf('{')
  if (start < 0) return null
  let depth = 0
  for (let i = start; i < cand.length; i++) {
    if (cand[i] === '{') depth++
    else if (cand[i] === '}') {
      depth--
      if (depth === 0) { try { return JSON.parse(cand.slice(start, i + 1)) } catch { return null } }
    }
  }
  return null
}


async function callGroqVision(prompt, image, devKey, mode = 'detect') {
  const key = devKey || groqPool.next()
  if (!key) throw new Error('no live Groq keys')
  // Camera frames are the heaviest payloads we send; share the global gate and
  // never let one hang past Vercel's function ceiling.
  const r = await withSlot(() => fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(CAMERA_TIMEOUT_MS),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_VISION,
      temperature: 0.2,
      max_tokens: tokensFor(mode),
      messages: [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: image } },
      ] }],
    }),
  }))
  if (!r.ok) {
    if (!devKey && (r.status === 429 || r.status >= 500)) { try { groqPool.markBad(key, r.status) } catch {  } }
    throw new Error(`groq/${GROQ_VISION} ${r.status}: ${(await r.text()).slice(0, 160)}`)
  }
  const d = await r.json()
  return d?.choices?.[0]?.message?.content || ''
}

function readDevKey(req) {
  const h = req.headers['x-groq-key']
  const k = (typeof h === 'string' ? h : '').trim()
  return /^gsk_[A-Za-z0-9]{20,}$/.test(k) ? k : ''
}

/** Groq vision, with one retry on a fresh pool key for transient failures. */
async function vision(prompt, image, { devKey = '', mode = 'detect' } = {}) {
  let lastErr
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return { text: await callGroqVision(prompt, image, devKey, mode), provider: 'groq' }
    } catch (e) {
      lastErr = e
      const transient = /\b(429|500|502|503|529)\b|timeout|abort|overload/i.test(e.message)
      if (!transient || attempt === 1) break
      await new Promise(r => setTimeout(r, 400))   // rotate to another pool key
    }
  }
  throw lastErr
}

// ── prompts ────────────────────────────────────────────────────────────────
const JSON_ONLY = 'Return ONLY a single valid JSON object. No prose, no markdown fences, no commentary.'

const PROMPTS = {
  detect: () => `You are looking through a student's phone camera at their study material.

First decide if this frame actually contains readable study content (a printed question, textbook page, worksheet, handwritten work, diagram or graph). If it is blurry, dark, empty, or just a random scene, set "hasContent": false and leave the other fields null.

If it does contain a question, identify it.

${JSON_ONLY}
Schema:
{
  "hasContent": boolean,
  "question": <the main question, transcribed, max 300 chars, or null>,
  "subject": <"Mathematics"|"Physics"|"Chemistry"|"Biology"|"English"|"History"|"Geography"|"Economics"|"Computer Science"|"General"|null>,
  "chapter": <likely chapter/unit name, or null>,
  "topic": <specific topic, or null>,
  "difficulty": <"Easy"|"Medium"|"Hard"|null>,
  "questionType": <e.g. "Numerical","MCQ","Derivation","Proof","Short answer","Diagram", or null>,
  "formulas": [<key formulas needed, plain strings, max 4>],
  "estMinutes": <integer estimated solving time, or null>,
  "confidence": <0-100 how sure you are of this reading>
}`,

  grade: (ctx) => `You are an AI tutor watching a student solve a problem on paper, through their camera.

The question being solved:
${ctx?.question || '(read it from the image)'}

Look at the student's handwritten working in this frame. Judge ONLY what is actually written — never invent steps. Solve the problem yourself first, then compare.

${JSON_ONLY}
Schema:
{
  "hasWork": <true if the student has written any working yet>,
  "status": <"correct"|"mistake"|"inprogress"|"unclear">,
  "progress": <0-100 how far through the solution they are>,
  "accuracy": <0-100 correctness of what they have written so far>,
  "mistakes": <integer count of distinct errors visible>,
  "confidence": <"High"|"Medium"|"Low">,
  "firstWrongStep": <step number of the first error, or null>,
  "feedback": <ONE short line for the student. If a step is right: "Step N looks right." If a calculation slipped: "Check this calculation." If the formula is wrong: a nudge like "Think about which formula connects these variables." NEVER give the answer. Max 90 chars.>,
  "done": <true only if they have reached a final answer>
}`,

  hint: (ctx) => `A student is stuck on this question:
${ctx?.question || '(read it from the image)'}

Their working so far is in the image. Give hint level ${ctx?.level || 1} of 4, where:
1 = the tiniest nudge (name the idea to think about, no maths)
2 = a bigger hint (name the formula/approach, still no working)
3 = explain the current step they are stuck on, with working for that step only
4 = the full worked solution to the final answer

${JSON_ONLY}
Schema: { "hint": <markdown string for level ${ctx?.level || 1}>, "level": ${ctx?.level || 1} }`,

  explain: (ctx) => `Explain the question in this image thoroughly for an Indian school student.
${ctx?.question ? 'Question: ' + ctx.question : ''}

Respond in clean markdown with EXACTLY these sections, in this order:

## Concept
## Why this formula?
## Step 1
## Step 2
## Step 3
## Common mistakes
## Alternative method
## Exam shortcut
## Memory trick
## Final answer
## Real-life example

Use $...$ for inline maths and $$...$$ for display maths. Be concrete and warm. If a section genuinely does not apply, write one line saying so rather than padding.`,

  ask: (ctx) => `A student is looking at the study material in this image and asks you, out loud:

"${(ctx?.query || '').slice(0, 400)}"

Answer them directly and warmly, like a tutor sitting beside them. Use the image for context. Keep it SHORT — 2-5 sentences, spoken-friendly (it will be read aloud). Use plain language, no headings, no bullet lists, minimal maths notation. If they are asking for the answer to an unsolved question, guide their thinking instead of just handing it over.

${JSON_ONLY}
Schema: { "answer": <your spoken reply> }`,

  report: (ctx) => `A student just finished solving this question on paper:
${ctx?.question || '(read it from the image)'}

Their final written work is in the image. They took ${ctx?.seconds ? Math.round(ctx.seconds / 60) + ' minutes' : 'an unknown time'}. Compare their solution against the correct one and produce an honest report card.

${JSON_ONLY}
Schema:
{
  "overallAccuracy": <0-100>,
  "conceptUnderstanding": <0-100>,
  "calculationAccuracy": <0-100>,
  "presentation": <0-100>,
  "neatness": <0-100>,
  "confidenceScore": <0-100>,
  "weakConcept": <the single concept they most need to fix, or null>,
  "strongConcept": <what they clearly did well, or null>,
  "finalAnswerCorrect": <true|false>,
  "summary": <2-3 sentence honest verdict for the student>,
  "flashcards": [<up to 5 objects {"front": "...", "back": "..."} built from their mistakes, key formulas and tricky steps>]
}`,
}

// ── routes ─────────────────────────────────────────────────────────────────
router.post('/analyze', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.ip || 'anon'
  if (rateLimited(String(ip))) {
    return res.status(429).json({ error: 'Slow down a moment — too many frames analysed.' , rateLimited: true })
  }

  const { image, mode = 'detect', context = {} } = req.body || {}
  if (!image || typeof image !== 'string') return res.status(400).json({ error: 'image required' })
  if (image.length > 6_000_000) return res.status(413).json({ error: 'frame too large' })
  const build = PROMPTS[mode]
  if (!build) return res.status(400).json({ error: `unknown mode "${mode}"` })

  const wantJson = mode !== 'explain'
  try {
    const { text, provider } = await vision(build(context), image, { devKey: readDevKey(req), mode })
    if (!wantJson) {
      const markdown = stripThinking(text)
      // Never answer 200 with an empty explanation — that is what made the app
      // tell students their lighting was bad when the model had simply been
      // truncated mid-reasoning.
      if (!markdown) {
        console.error('[camera/analyze] empty explain after strip; raw len =', String(text || '').length)
        return res.status(502).json({
          error: 'The explanation came back empty — the model ran out of room. Try again.',
          mode, provider,
        })
      }
      return res.json({ mode, provider, markdown })
    }

    const data = parseJsonLoose(text)
    if (!data) {
      // The model answered but not with usable JSON. That is a model/prompt
      // problem, not a lighting problem — say so, and log the actual reply so
      // this is diagnosable instead of guesswork.
      console.error('[camera/analyze] unparseable reply', mode, provider, JSON.stringify(String(text || '').slice(0, 300)))
      return res.status(502).json({
        error: text
          ? `The ${provider} vision model returned an unreadable response. It may be overloaded — try again.`
          : `The ${provider} vision model returned nothing. It may be down or rate limited.`,
        mode, provider,
      })
    }
    return res.json({ mode, provider, ...data })
  } catch (e) {
    console.error('[camera/analyze]', mode, e.message)
    // Turn the common upstream failures into something a student can act on.
    const raw = String(e.message || 'vision failed')
    const friendly =
      /no live groq keys/i.test(raw) ? 'Vision service is not configured (no AI key on the server).'
      : /\b429\b|rate limit/i.test(raw) ? 'Too many requests right now — wait a few seconds and try again.'
      : /\b(404|decommissioned|does not exist|not found)\b/i.test(raw) ? 'The vision model is no longer available — this needs a server update.'
      : /\b(500|502|503|529)\b|overload/i.test(raw) ? 'The vision service is overloaded — try again in a moment.'
      : /abort|timeout/i.test(raw) ? 'The vision service timed out — try again.'
      : raw.slice(0, 160)
    return res.status(502).json({ error: friendly, mode, detail: raw.slice(0, 200) })
  }
})

// Voice: student speaks a question -> Groq Whisper -> text
router.post('/transcribe', async (req, res) => {
  const { audio, mime = 'audio/webm' } = req.body || {}
  if (!audio || typeof audio !== 'string') return res.status(400).json({ error: 'audio required' })
  if (audio.length > 8_000_000) return res.status(413).json({ error: 'clip too long' })
  const key = readDevKey(req) || groqPool.next()
  if (!key) return res.status(503).json({ error: 'no live Groq keys' })

  try {
    const b64 = audio.replace(/^data:[^,]+,/, '')
    const buf = Buffer.from(b64, 'base64')
    const form = new FormData()
    form.append('file', new Blob([buf], { type: mime }), 'clip.webm')
    form.append('model', 'whisper-large-v3-turbo')
    form.append('response_format', 'json')

    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form,
    })
    if (!r.ok) throw new Error(`whisper ${r.status}: ${(await r.text()).slice(0, 160)}`)
    const d = await r.json()
    res.json({ text: (d.text || '').trim() })
  } catch (e) {
    console.error('[camera/transcribe]', e.message)
    res.status(502).json({ error: (e.message || 'transcription failed').slice(0, 200) })
  }
})

// ── Voice out ──────────────────────────────────────────────────────────────
// The phone's built-in voice sounds robotic, so we try real TTS services in
// order. All are free and keyless except Groq (which needs a one-time terms
// acceptance). If every provider fails the client falls back to the system voice.
const TTS_TIMEOUT = 9000

async function fetchAudio(url, init = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TTS_TIMEOUT)
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal })
    if (!r.ok) throw new Error(`${r.status}`)
    const mime = (r.headers.get('content-type') || '').toLowerCase()
    const buf = Buffer.from(await r.arrayBuffer())
    // guard: these endpoints return a text/JSON error body on failure
    if (!/audio|mpeg|wav|ogg/.test(mime) || buf.length < 1200) throw new Error(`not audio (${mime || 'none'}, ${buf.length}b)`)
    return { buf, mime: mime.split(';')[0] }
  } finally { clearTimeout(t) }
}

// Accent codes for the Google TTS voice (verified working, free, no key).
const GT_LANG = { indian_f: 'en-IN', indian_m: 'en-IN', uk_m: 'en-GB', us_f: 'en-US', us_m: 'en-US', au: 'en-AU' }

// That endpoint caps at ~200 chars, so split on sentence boundaries and
// concatenate the MP3 chunks (MP3 frames join cleanly for playback).
function chunkText(text, max = 185) {
  const parts = []
  let cur = ''
  for (const piece of String(text).split(/(?<=[.!?,;:])\s+/)) {
    for (const seg of (piece.length > max ? piece.match(new RegExp(`.{1,${max}}(\\s|$)`, 'g')) || [piece] : [piece])) {
      if ((cur + ' ' + seg).trim().length > max) { if (cur.trim()) parts.push(cur.trim()); cur = seg }
      else cur = (cur + ' ' + seg).trim()
    }
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts.slice(0, 6)
}

const TTS_PROVIDERS = [
  {
    name: 'google',
    run: async (text, key) => {
      const tl = GT_LANG[key] || 'en-IN'
      const chunks = chunkText(text)
      const bufs = []
      for (const c of chunks) {
        const { buf } = await fetchAudio(
          `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}&q=${encodeURIComponent(c)}`,
          { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36', 'Referer': 'https://translate.google.com/' } })
        bufs.push(buf)
      }
      if (!bufs.length) throw new Error('no chunks')
      return { buf: Buffer.concat(bufs), mime: 'audio/mpeg' }
    },
  },
  {
    name: 'groq-orpheus',
    run: async (text, _key, groqKey) => {
      if (!groqKey) throw new Error('no groq key')
      const r = await fetch('https://api.groq.com/openai/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'canopylabs/orpheus-v1-english', voice: 'hannah', input: text.slice(0, 600), response_format: 'wav' }),
      })
      if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 90)}`)
      return { buf: Buffer.from(await r.arrayBuffer()), mime: 'audio/wav' }
    },
  },
]

router.post('/speak', async (req, res) => {
  const { text, voice = 'indian_f' } = req.body || {}
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text required' })
  const groqKey = readDevKey(req) || groqPool.next()

  const tried = []
  for (const p of TTS_PROVIDERS) {
    try {
      const { buf, mime } = await p.run(text, voice, groqKey)
      return res.json({ audio: `data:${mime};base64,` + buf.toString('base64'), provider: p.name, voice })
    } catch (e) {
      tried.push(`${p.name}: ${(e.message || 'fail').slice(0, 60)}`)
    }
  }
  console.warn('[camera/speak] all TTS failed —', tried.join(' | '))
  res.status(502).json({ error: 'no tts provider available', tried })
})

router.get('/status', (_req, res) => {
  const pool = groqPool.status()
  res.json({
    provider: 'groq',
    visionModel: GROQ_VISION,
    sttModel: 'whisper-large-v3-turbo',
    groqKeysLive: pool.live,
    maxFramesPerMinute: MAX_PER_WINDOW,
  })
})

export default router
