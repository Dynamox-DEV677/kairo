/**
 * /api/ai/chat      — OpenRouter proxy
 * /api/ai/visualize — Nano Banana image generation (legacy, used as fallback)
 * /api/ai/solver    — Kyno's Solver: classify + image search + AI explanation
 */
import express from 'express'
import { searchManyParallel } from '../services/imageSearch.js'
import { supabaseAdmin } from '../services/supabase.js'
import groqPool from '../services/groqPool.js'

const router = express.Router()
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions'

// ── L1: in-memory cache (per-function-instance) ────────────────────────────
// First line of defense — same Vercel function warm window hits this. Fast,
// no network roundtrip. 24h TTL, 300 entries.
const SOLVER_CACHE = new Map()
const SOLVER_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const SOLVER_CACHE_MAX = 300

function cacheGet(key) {
  const entry = SOLVER_CACHE.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > SOLVER_CACHE_TTL_MS) {
    SOLVER_CACHE.delete(key)
    return null
  }
  return entry.data
}

function cacheSet(key, data) {
  if (SOLVER_CACHE.size >= SOLVER_CACHE_MAX) {
    const oldest = SOLVER_CACHE.keys().next().value
    if (oldest) SOLVER_CACHE.delete(oldest)
  }
  SOLVER_CACHE.set(key, { ts: Date.now(), data })
}

// ── L2: persistent cache in Supabase (shared across instances/users) ───────
// Survives deploys, shared by every student. Lookup is ~50ms. Write is
// best-effort (failures don't block the response).
async function dbCacheGet(questionKey) {
  try {
    const { data, error } = await supabaseAdmin
      .from('solver_cache')
      .select('plan, model_used, source, hit_count')
      .eq('question_key', questionKey)
      .maybeSingle()
    if (error || !data) return null
    return data
  } catch { return null }
}

async function dbCacheSet(questionKey, questionRaw, plan, source) {
  try {
    await supabaseAdmin.from('solver_cache').upsert({
      question_key: questionKey,
      question_raw: questionRaw.slice(0, 500),
      plan,
      model_used: plan.modelUsed || null,
      source,                                    // 'ai' or 'wikipedia'
      hit_count: 0,
    }, { onConflict: 'question_key' })
  } catch (e) {
    console.warn('[solver] dbCacheSet failed:', e.message)
  }
}

async function dbCacheBumpHit(questionKey) {
  // Best-effort — no await needed; don't block the response.
  supabaseAdmin
    .rpc('increment_solver_hit', { qk: questionKey })
    .then(() => {}, () => {
      // RPC may not exist yet — fall back to direct update
      supabaseAdmin.from('solver_cache').select('hit_count').eq('question_key', questionKey).maybeSingle()
        .then(({ data }) => data
          ? supabaseAdmin.from('solver_cache').update({ hit_count: (data.hit_count || 0) + 1 }).eq('question_key', questionKey)
          : null)
        .then(() => {}, () => {})
    })
}

/** Normalize a question for cache keying. Lowercase, strip filler words, collapse whitespace. */
function normalizeKey(question) {
  return question
    .toLowerCase()
    .replace(/[?!.,;:'"]/g, '')
    .replace(/\b(please|can you|could you|i want to|i need to|tell me about|tell me|explain|describe|what is|what are|what's|how does|how do|how to|why is|why does|in detail|in depth|step by step|simply|simple terms|for class \d+|for students)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Looks at the last user message to decide whether it's a knowledge question
 * we can answer with Wikipedia (e.g. "what is photosynthesis", "explain DNA")
 * vs. a context-dependent request (e.g. "rewrite my notebook with bullets",
 * "make a quiz from this", "translate this to Hindi"). Wikipedia can only
 * help with the first kind.
 */
function isKnowledgeQuestion(text) {
  if (!text || typeof text !== 'string') return false
  const t = text.toLowerCase().trim()
  if (t.length < 6 || t.length > 240) return false
  // Positive signals — looks like a "what / why / how / who / when" question
  if (/^(what|why|how|who|when|where|which|explain|describe|tell me about|define|summari[sz]e)\b/.test(t)) return true
  if (/^.{1,80}\?$/.test(t)) return true   // short single-sentence question
  return false
}

/**
 * Strip role/instruction noise and pull the actual student question out of the
 * messages array. Picks the LAST user message, since multi-turn chats usually
 * land on the actual ask there.
 */
function lastUserText(messages) {
  if (!Array.isArray(messages)) return ''
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m?.role === 'user' && typeof m.content === 'string') return m.content
  }
  return ''
}

/**
 * Format a Wikipedia-sourced fallback as an OpenAI-shaped chat completion so
 * the frontend treats it like any other response. The `_fallback` flag lets
 * the UI render a small "AI was busy — Wikipedia answer" hint.
 */
function asChatCompletion(model, content, fallback = false) {
  return {
    id: 'kairo-fallback-' + Date.now(),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      finish_reason: 'stop',
      message: { role: 'assistant', content },
    }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    _fallback: fallback,
  }
}

/**
 * Build a Wikipedia-sourced markdown answer for a knowledge question. Returns
 * null when no article can be found. Re-uses the same wiki helpers Solver
 * uses so the answer style stays consistent across Kyno.
 */
async function chatWikipediaFallback(question) {
  try {
    const cleaned = cleanQuestionForSearch(question)
    let title = await wikiSearchFirstTitle(cleaned)
    if (!title) title = await wikiSearchFirstTitle(question)
    if (!title) return null

    const extractsUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|info&exsentences=8&explaintext=1&inprop=url&titles=${encodeURIComponent(title)}&origin=*`
    const r = await fetch(extractsUrl, { headers: { 'User-Agent': 'KairoEdu/1.0' } })
    if (!r.ok) return null
    const d = await r.json()
    const page = Object.values(d?.query?.pages || {})[0]
    const extract = page?.extract
    if (!extract) return null
    const pageUrl = page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`
    return [
      `## ${title}`,
      ``,
      extract,
      ``,
      `---`,
      `*AI is busy right now — this answer is sourced from Wikipedia. [Read the full article →](${pageUrl})*`,
    ].join('\n')
  } catch {
    return null
  }
}

// ── Groq-only chat proxy ─────────────────────────────────────────────────────
// Every in-app AI helper (Notebook builder, Essay Grader, Camera Study, …)
// goes through here. OpenRouter was slow + 429-happy on the free tier, so the
// whole app now runs on the Groq key pool (~1s responses, 10 rotating keys).
const CHAT_MODELS_TEXT   = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
// Groq's multimodal Llama-4 models accept OpenAI-style image_url content —
// this is what powers Camera Study now.
const CHAT_MODELS_VISION = ['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct']

const messagesHaveImages = (messages) =>
  messages.some(m => Array.isArray(m?.content) && m.content.some(p => p?.type === 'image_url'))

router.post('/chat', async (req, res) => {
  const { messages, model, stream = false } = req.body

  if (!messages?.length) {
    return res.status(400).json({ error: 'messages array required' })
  }

  const wantVision = messagesHaveImages(messages)
  let order = wantVision ? [...CHAT_MODELS_VISION] : [...CHAT_MODELS_TEXT]
  // Honor a requested Groq model id; legacy OpenRouter ids (":free") are ignored.
  if (typeof model === 'string' && model && !model.endsWith(':free') && !wantVision) {
    order = [model, ...order.filter(m => m !== model)]
  }

  // Wrap the full attempt so any failure can fall through to Wikipedia / a
  // friendly degraded message — never a raw 5xx + stack trace for the user.
  try {
    let upstream = null
    let lastErr  = null
    for (const m of order) {
      const key = groqPool.next()
      if (!key) { lastErr = new Error('no live Groq keys (all cooling or none configured)'); break }
      try {
        const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: m, messages, stream, max_tokens: 2048 }),
        })
        if (!r.ok) {
          if (r.status === 429 || r.status >= 500) {
            try { groqPool.markBad(key, r.status) } catch { /* ignore */ }
          }
          const text = await r.text().catch(() => '')
          throw new Error(`groq/${m} ${r.status}: ${text.slice(0, 160)}`)
        }
        upstream = r
        break
      } catch (e) {
        lastErr = e
        console.warn('[aiChat/chat] model failed, trying next:', e.message)
      }
    }
    if (!upstream) {
      throw lastErr || new Error('all Groq models failed')
    }

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
    console.warn('[aiChat] upstream failed, attempting fallback:', err.message)

    // ── Fallback path ──────────────────────────────────────────────────
    // 1. If the user asked a knowledge question, try Wikipedia.
    // 2. Otherwise return a graceful "AI is busy" message shaped like a
    //    chat completion so the frontend renders it inline.
    // Streaming requests can't fall back cleanly mid-stream — only fall
    // back if we haven't started writing the SSE headers yet.
    if (res.headersSent) {
      return res.end()
    }

    const userQ = lastUserText(messages)
    if (isKnowledgeQuestion(userQ)) {
      const wiki = await chatWikipediaFallback(userQ)
      if (wiki) {
        return res.json(asChatCompletion('wikipedia-fallback', wiki, true))
      }
    }

    // Final graceful message — shaped as a normal chat completion so the
    // UI doesn't have to special-case it. Mark _fallback=true so it can
    // show a subtle "retry in a moment" hint if it wants to.
    return res.json(asChatCompletion(
      'busy-fallback',
      [
        '## Kyno is a little busy right now',
        '',
        "Our AI is handling a lot of requests at this moment, so I couldn't reach a model in time.",
        '',
        '**While you wait, you can:**',
        '- Try the **Solver** — it has its own backup brain and almost always works',
        '- Open **Flashcards** or the **Concept Map** — those run fully on-device',
        '- Try again in 30 seconds',
        '',
        '*This is a graceful fallback, not a real outage — your data is safe.*',
      ].join('\n'),
      true,
    ))
  }
})

// ────────────────────────────────────────────────────────────────────────────
// /api/ai/visualize  — Generate study-explainer images via Gemini 2.5 Flash
//                      Image (a.k.a. "Nano Banana"). Returns N base64 PNGs that
//                      the frontend cycles through as a slideshow.
// ────────────────────────────────────────────────────────────────────────────
const GEMINI_IMAGE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent'

router.post('/visualize', async (req, res) => {
  const { topic, count = 4, style = 'detailed textbook diagram' } = req.body
  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({ error: 'topic (string) required' })
  }
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'GEMINI_API_KEY not configured on server.' })
  }

  // Build a small set of prompt variations so the slideshow shows different
  // aspects of the same concept. The free Nano Banana tier is rate-limited per
  // request, so we fan out small (default 4) and short.
  const variations = [
    `${style} of: ${topic}. Wide hero illustration, vibrant colours, labelled key parts.`,
    `${style} of: ${topic}. Close-up cross-section view, exam-board style.`,
    `${style} of: ${topic}. Step-by-step process diagram, arrows + numbers.`,
    `${style} of: ${topic}. Real-world application or example, clean background.`,
    `${style} of: ${topic}. Comparison or contrast, side-by-side layout.`,
    `${style} of: ${topic}. Memorable mnemonic illustration, single focal point.`,
  ].slice(0, Math.max(1, Math.min(6, count)))

  try {
    // Generate in parallel — Gemini's Image endpoint accepts one prompt per call
    const results = await Promise.all(variations.map(async (prompt) => {
      try {
        const r = await fetch(`${GEMINI_IMAGE_URL}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ['IMAGE', 'TEXT'],
            },
          }),
        })
        if (!r.ok) {
          const text = await r.text()
          console.warn('[visualize] gemini error:', r.status, text.slice(0, 200))
          return null
        }
        const data = await r.json()
        // Walk the response for an inline image part
        const parts = data?.candidates?.[0]?.content?.parts || []
        for (const p of parts) {
          if (p.inlineData?.data) {
            return {
              mime: p.inlineData.mimeType || 'image/png',
              data: p.inlineData.data,    // base64
              prompt,
            }
          }
        }
        return null
      } catch (e) {
        console.warn('[visualize] fetch error:', e.message)
        return null
      }
    }))

    const images = results.filter(Boolean)
    if (images.length === 0) {
      return res.status(502).json({ error: 'No images generated. The free tier may be rate-limited — try again in a minute.' })
    }
    res.json({ topic, count: images.length, images })
  } catch (err) {
    console.error('[visualize]', err.message)
    res.status(500).json({ error: 'Image generation failed: ' + err.message })
  }
})

// ────────────────────────────────────────────────────────────────────────────
// /api/ai/solver — Kyno's Solver
//
// Single endpoint that powers the dual-panel learning experience:
//   1. Calls the LLM in JSON mode to classify the question + plan a sequential
//      visual storyboard (5-6 image search queries) + write the explanation
//   2. Fans out the image queries in parallel against Wikimedia / Pexels /
//      Unsplash (Wikimedia first — free, encyclopedic, no key)
//   3. Detects if a Kyno Lab matches (gravity, pendulum, heart, etc.) and
//      returns a labRoute the frontend uses to render an "Open in Labs" CTA
//   4. Caches the whole response by question for 1 hour
//
// Returns:
//   {
//     questionType, supports3D, labRoute,
//     textExplanation, formulas[], relatedConcepts[],
//     imageSlides: [{ url, thumb, caption, source, attribution, pageUrl }],
//     cached: boolean
//   }
// ────────────────────────────────────────────────────────────────────────────

const KAIRO_LABS = {
  gravity:    'Newton\'s laws, free fall, drop motion, weight',
  pendulum:   'simple harmonic motion, oscillation, period, Newton\'s cradle',
  projectile: 'kinematics, motion under gravity, trajectory',
  circuits:   'Ohm\'s law, current, voltage, resistance, electrical circuits',
  atom:       'atomic structure, Bohr model, electron shells',
  molecule:   'chemical bonding, molecular geometry, VSEPR',
  reaction:   'stoichiometry, combustion, balanced equations',
  heart:      'human heart anatomy, circulation, chambers',
  cell:       'cell structure, organelles, animal cell',
  vectors:    '3D vectors, dot product, cross product',
  graphs:     'function plotting, surfaces, 3D graphs of equations',
}

const SOLVER_SYSTEM = `You are Kyno's Solver — an AI that turns a student's question into a structured learning experience.

Always answer the question. No matter the topic — science, math, history, biology, geography, literature, current events — give a clear, friendly explanation aimed at Indian school students (Class 6-12, CBSE/ICSE/state).

CASUAL QUESTIONS: if the message is small-talk or a utility question rather than a STUDY topic — greetings ("hi", "how are you"), the time/date, jokes, thanks, "what's up", meta questions about Kyno itself — set questionType="casual". For casual: imageQueries=[], videoQuery="", supports3D=false, labRoute=null, formulas=[], relatedConcepts=[], geography=null, and textExplanation is a SHORT friendly note (1-3 sentences, NO ## headings, no lesson structure). Do not force a lesson out of small-talk.

Your output MUST be a single valid JSON object (no markdown fences, no commentary, no leading text). Schema:

{
  "questionType":   "physics" | "chemistry" | "biology" | "math" | "history" | "geography" | "literature" | "general" | "casual" | "quiz",
  "topicKeyword":   <ONE clean 1-3 word noun phrase that names this topic — used to look up the matching Wikipedia article. Examples: "Photosynthesis", "French Revolution", "Newton's laws", "Mitosis". Must be the most likely exact Wikipedia article title. NEVER use vague phrases like "step by step" or "explained">,
  "supports3D":     boolean,
  "labRoute":       null | one of: ${Object.keys(KAIRO_LABS).map(k => `"${k}"`).join(' | ')},
  "imageQueries":   [<5 short web-search queries for educational images, in NARRATIVE order — like a 5-slide storyboard that builds the concept from intro → mechanism → equation → real-world example. Include named figures, specific objects, concrete nouns. NOT abstract.>],
  "videoQuery":     <ONE short search query for an educational explainer video, e.g. "photosynthesis 3D animation for students" or "French Revolution causes documentary". Aim for content-creator style queries that find well-produced 5-10 minute lessons. Required>,
  "formulas":       [<key formulas as plain LaTeX strings, e.g. "F = ma" — empty array if N/A>],
  "relatedConcepts":[<3-5 related topics or follow-up questions, short strings>],
  "textExplanation": <markdown string — concise but complete. Use ## sub-headings ("What you're seeing", "How it works", "Why it matters", "Real-world example"). Aim for 200-400 words.>,
  "geography":      <null OR — only when questionType is "geography" — an object describing the location for the Map Mode UI:
                     {
                       "name":  <human-readable location name, e.g. "Amazon Rainforest", "Japan", "Nile River">,
                       "kind":  "region" | "country" | "city" | "river" | "mountain" | "desert" | "forest" | "ocean" | "continent" | "other",
                       "zoom":  <Leaflet zoom level: 3 for continents, 4-5 for countries / mega-regions, 6-7 for states / large features, 8-10 for cities, 11-13 for landmarks>,
                       "sections": <array of FIVE-EIGHT structured learning blocks. Each: { "heading": <one of "Overview"|"Climate"|"Geography"|"Importance"|"Biodiversity"|"Countries"|"Economy"|"Culture"|"Fun Facts">, "body": <markdown paragraph, 1-3 sentences> }>
                     }>,
  "action":         <null, OR — ONLY when the student EXPLICITLY asks you to create/make/add something ("make flashcards on X", "create a concept map of Y", "save a note about Z", "add this to my notebook") — an object Kyno uses to actually create the artifact in the student's tools:
                     {
                       "tool":    "flashcards" | "notebook" | "concept-map",
                       "topic":   <short clean topic name>,
                       "cards":   <flashcards only: array of 5-8 { "front": <question or term>, "back": <answer, 1-3 sentences> }>,
                       "title":   <notebook only: note title>,
                       "content": <notebook only: the full note as markdown, 150-400 words>,
                       "related": <concept-map only: 4-8 related concept names to connect to the topic>
                     }
                     Asking ABOUT a topic is NOT an action — never set action for ordinary questions. When action is set, textExplanation should be a short confirmation of what you created (2-4 sentences) — the artifact content itself lives inside action.>,
  "quizCheck":      <null, OR — ONLY when the student's new message is an ANSWER to a quiz question you asked in the previous turn — { "correct": boolean, "topic": <short topic of that question> }>
}

CONVERSATION MEMORY: the user message may include a "Conversation so far" section and a "Student profile" line. Use them — resolve pronouns ("explain that again", "make flashcards on this") against the previous turns, keep continuity, and address the student by name occasionally when natural. Answer ONLY the student's new message; the rest is context.

STUDY COACH MODE: the user message may include a "MISTAKE PROFILE" — the topics this student gets wrong, with counts and severity. You are not just an answer machine; you are their coach, and clearing that mistake list is the mission.
- When the student asks what to study, how they're doing, or about their mistakes: use the mistake profile directly — name their worst topics, say why they matter, and give a concrete attack order.
- When the student says "quiz me" / "test me" / "ask me questions" (or you're mid-quiz): set questionType="quiz". Ask EXACTLY ONE question per turn — prefer their weakest topics from the mistake profile. imageQueries=[], videoQuery="", formulas=[], relatedConcepts=[]. textExplanation = just the question (plus brief feedback on their last answer if there was one). Keep questions board-exam style for their class.
- When their new message answers your previous quiz question: set quizCheck {correct, topic}. In textExplanation give honest feedback — if wrong, a 2-3 sentence explanation of the right answer — then ask the NEXT question (stay in questionType="quiz").
- Even in normal explanations: if the topic asked about appears in their mistake profile, say so ("this is one of your weak spots — let's fix it properly") and go one level deeper on the exact confusion.

CRITICAL JSON ESCAPING RULES for textExplanation:

1. ALL backslashes MUST be doubled. \\\\rightarrow not \\rightarrow. JSON parses single-backslash sequences as control characters which destroys LaTeX.
2. Prefer Unicode arrows / symbols inline when possible: → ⇌ ⇒ ≈ ≤ ≥ × ÷ — they don't need escaping.
3. For inline math use $...$. For display math use $$...$$ on its own line. ALWAYS close every $ and $$ — an open math block consumes the rest of the answer.
4. Math examples (note the doubled backslashes):
   Correct: "$F = ma$"
   Correct: "$$E = mc^2$$"
   Correct: "$\\\\frac{1}{2}mv^2$"
   WRONG:   "$\\frac{1}{2}mv^2$"   (single backslash → JSON control char)
   WRONG:   "$\\rightarrow$"        (use → instead, or "$\\\\rightarrow$")
5. Never wrap the whole answer in $$ ... $$. Only wrap actual equations.

Lab matching guidance — set labRoute when the question's core topic matches one of these:
${Object.entries(KAIRO_LABS).map(([k, v]) => `  ${k}: ${v}`).join('\n')}

Otherwise labRoute=null.

CRITICAL: Output ONLY the JSON. Do not wrap in code fences. Do not say "Here is the JSON". Do not add any prose before or after.`

// ─── Internal: do the LLM classification, return the plan + cache it ────
// Used by both /solver/text and /solver/images so the frontend's two parallel
// calls share one cached LLM result instead of paying for it twice.
/**
 * Call Groq directly — completely separate quota from OpenRouter. Free forever
 * (14,400 req/day on the free tier), sub-second inference, no card required.
 * Only active if GROQ_API_KEY env var is set; otherwise this is dead code.
 *
 * Get a free key at: https://console.groq.com/keys
 */
// Groq's stable solver-grade models (May 2026). Llama 8B is included as a
// fast hedge: when 70B is slow under load, 8B usually still responds in <1s.
//
// NB: groq's deployment of `openai/gpt-oss-20b` was previously in this list,
// but the diagnostic showed it returns HTTP 400 "Failed to generate JSON"
// consistently — that deployment doesn't honor `response_format: json_object`
// reliably. Removed so the Promise.any race isn't slowed by its 2s failure.
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',     // primary — fast + smart
  'llama-3.1-8b-instant',        // hedge — sub-second on weak load
]

/**
 * Run one Groq model. The `apiKey` param is optional — when omitted we draw
 * a key from the rotating groqPool. When the response is a 429 (or 5xx),
 * we report the bad key back to the pool so it gets parked for 60 s and the
 * next request skips it.
 */
async function callGroqOne(model, question, apiKey, timeout = 7000) {
  // Legacy callers can still pass an explicit key (e.g. the /solver/status
  // probe). Otherwise rotate through the pool.
  const key = apiKey || groqPool.next()
  if (!key) {
    throw new Error(`groq/${model}: no live keys (all 429-cooling or none configured)`)
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SOLVER_SYSTEM },
          { role: 'user',   content: question },
        ],
        temperature: 0.3,
        max_tokens:  2000,
        response_format: { type: 'json_object' },
      }),
    })
    if (!resp.ok) {
      // Rate-limit or upstream blip → park this key so siblings can rotate.
      if (resp.status === 429 || resp.status >= 500) {
        try { groqPool.markBad(key, resp.status) } catch { /* ignore */ }
      }
      const t = await resp.text()
      throw new Error(`groq/${model} HTTP ${resp.status}: ${t.slice(0, 120)}`)
    }
    const data = await resp.json()
    const raw = data?.choices?.[0]?.message?.content || ''
    const plan = parseJsonLoose(raw)
    if (!plan || !plan.textExplanation) {
      throw new Error(`groq/${model} malformed JSON (len=${raw.length})`)
    }
    return { plan, model: `groq/${model}` }
  } finally {
    clearTimeout(timer)
  }
}

// Legacy single-model wrapper — kept so existing call sites still work, but
// the new path is callGroqAll() which races every Groq model in parallel.
async function callGroq(question, apiKey, timeout = 7000) {
  return callGroqOne(GROQ_MODELS[0], question, apiKey, timeout)
}

/** Race every Groq model in parallel. First valid JSON wins. */
function callGroqAll(question, apiKey, timeout = 7000) {
  return GROQ_MODELS.map(m => callGroqOne(m, question, apiKey, timeout))
}

/**
 * Call one specific OpenRouter model with a hard per-call timeout. Throws
 * on any failure so Promise.any can pick the first successful winner.
 */
async function callModel(model, question, apiKey, timeout = 7000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const resp = await fetch(OR_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
        'HTTP-Referer':  process.env.ALLOWED_ORIGIN || 'https://kairo-daily-edu.vercel.app',
        'X-Title':       'Kyno Solver',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SOLVER_SYSTEM },
          { role: 'user',   content: question },
        ],
        temperature: 0.3,
        max_tokens:  2000,
      }),
    })
    if (!resp.ok) {
      const t = await resp.text()
      throw new Error(`${model} HTTP ${resp.status}: ${t.slice(0, 120)}`)
    }
    const data = await resp.json()
    const raw = data?.choices?.[0]?.message?.content || ''
    const plan = parseJsonLoose(raw)
    if (!plan || !plan.textExplanation) {
      throw new Error(`${model} malformed JSON (len=${raw.length})`)
    }
    return { plan, model }
  } finally {
    clearTimeout(timer)
  }
}


async function getSolverPlan(question) {
  // Two-tier cache: L1 (memory, per-instance, fast) → L2 (Supabase, shared).
  const qKey       = normalizeKey(question)
  const cacheKey   = 'plan:' + qKey

  // L1: same Vercel function warm window — instant.
  const memHit = cacheGet(cacheKey)
  if (memHit) return memHit

  // L2: Supabase — shared across every function instance and every user.
  // ~50ms roundtrip but cuts every repeat question down from 5s+ to fast.
  const dbHit = await dbCacheGet(qKey)
  if (dbHit?.plan) {
    cacheSet(cacheKey, dbHit.plan)   // promote into L1 for next time
    dbCacheBumpHit(qKey)              // fire-and-forget
    return dbHit.plan
  }

  // Groq-only: race every Groq model in parallel — Promise.any resolves on
  // the first that returns valid JSON. Each call draws an INDEPENDENT key
  // from the rotating pool (services/groqPool.js), so two models from one
  // request never share a key's quota. OpenRouter was removed: its free pool
  // was slow and 429-throttled; Groq answers in ~1s.
  const groqStatus = groqPool.status()
  if (groqStatus.live === 0) {
    throw new Error('No live Groq keys — set GROQ_API_KEYS in env (pool: ' + groqStatus.hint + ')')
  }
  const tasks = GROQ_MODELS.map(m => callGroqOne(m, question, null, 7000))
  console.log(`[solver] racing ${GROQ_MODELS.length} Groq models (pool: ${groqStatus.hint})`)

  let winner
  try {
    winner = await Promise.any(tasks)
  } catch (aggregate) {
    const errs = aggregate.errors?.map(e => e.message).join(' · ') || 'unknown'
    console.error('[solver] all models failed:', errs)

    // GRACEFUL DEGRADE: When every AI model fails, fall back to Wikipedia's
    // article summary. Student still gets a useful answer — better than an
    // error screen. Mark the plan with modelUsed='wikipedia-fallback' so the
    // UI can show "AI is busy, this is Wikipedia's answer instead".
    try {
      const wikiPlan = await synthesizePlanFromWikipedia(question)
      if (wikiPlan) {
        cacheSet(cacheKey, wikiPlan)               // L1
        dbCacheSet(qKey, question, wikiPlan, 'wikipedia')  // L2, fire-and-forget
        return wikiPlan
      }
    } catch (e) {
      console.warn('[solver] wikipedia fallback also failed:', e.message)
    }

    // Wikipedia fallback also failed — only THEN do we surface an error.
    const all429 = aggregate.errors?.every(e => /HTTP 429/.test(e.message || ''))
    if (all429) {
      const err = new Error('Free AI is busy and Wikipedia is unreachable. Try again in a minute.')
      err.statusCode = 429
      throw err
    }
    throw new Error('All AI models failed: ' + errs.slice(0, 300))
  }

  const { plan, model } = winner
  console.log('[solver] winner:', model)

  let labRoute = plan.labRoute || null
  if (labRoute && !KAIRO_LABS[labRoute]) labRoute = null

  const normalized = {
    questionType:    plan.questionType || 'general',
    topicKeyword:    sanitizeOneLine(plan.topicKeyword || '') || null,
    supports3D:      !!plan.supports3D,
    labRoute,
    textExplanation: sanitizeMarkdown(plan.textExplanation),
    formulas:        Array.isArray(plan.formulas)
      ? plan.formulas.slice(0, 8).map(f => sanitizeOneLine(String(f)))
      : [],
    relatedConcepts: Array.isArray(plan.relatedConcepts)
      ? plan.relatedConcepts.slice(0, 6).map(c => sanitizeOneLine(String(c)))
      : [],
    imageQueries:    Array.isArray(plan.imageQueries)
      ? plan.imageQueries.slice(0, 6).map(q => sanitizeOneLine(String(q)))
      : [],
    videoQuery:      sanitizeOneLine(plan.videoQuery || plan.topicKeyword || ''),
    modelUsed:       model,
    geography:       null,    // fills in below when questionType==='geography'
    // Quiz evaluation — present only when the student just answered a question.
    quizCheck: (plan.quizCheck && typeof plan.quizCheck === 'object' && typeof plan.quizCheck.correct === 'boolean')
      ? { correct: plan.quizCheck.correct, topic: sanitizeOneLine(String(plan.quizCheck.topic || '')).slice(0, 60) }
      : null,
    // Agentic action — only when the student explicitly asked to create something.
    action: (() => {
      const a = plan.action
      if (!a || typeof a !== 'object' || !['flashcards', 'notebook', 'concept-map'].includes(a.tool)) return null
      return {
        tool:    a.tool,
        topic:   sanitizeOneLine(String(a.topic || '')).slice(0, 80),
        title:   sanitizeOneLine(String(a.title || '')).slice(0, 120),
        content: typeof a.content === 'string' ? sanitizeMarkdown(a.content).slice(0, 6000) : '',
        related: Array.isArray(a.related)
          ? a.related.slice(0, 8).map(r => sanitizeOneLine(String(r)).slice(0, 60)).filter(Boolean)
          : [],
        cards: Array.isArray(a.cards)
          ? a.cards.slice(0, 10)
              .filter(c => c && c.front && c.back)
              .map(c => ({ front: sanitizeOneLine(String(c.front)).slice(0, 200), back: String(c.back).slice(0, 400) }))
          : [],
      }
    })(),
  }

  // ── Geography enrichment ────────────────────────────────────────────────
  // When the model classifies this as geography, resolve lat/lng + bounds
  // from Wikipedia so the frontend's Map Mode can auto-zoom to the right
  // region. Fire-and-forget timing — capped at 1.5s so we never delay the
  // user-visible text response.
  if (normalized.questionType === 'geography') {
    const rawGeo = plan.geography && typeof plan.geography === 'object' ? plan.geography : null
    const sections = Array.isArray(rawGeo?.sections)
      ? rawGeo.sections.slice(0, 8)
          .filter(s => s && typeof s === 'object' && s.heading && s.body)
          .map(s => ({
            heading: sanitizeOneLine(String(s.heading)).slice(0, 40),
            body:    sanitizeMarkdown(String(s.body)).slice(0, 600),
          }))
      : []

    const geoName = sanitizeOneLine(rawGeo?.name || normalized.topicKeyword || '')
    const geoKind = ['region','country','city','river','mountain','desert','forest','ocean','continent','other']
      .includes(rawGeo?.kind) ? rawGeo.kind : 'region'
    const aiZoom  = Number.isFinite(Number(rawGeo?.zoom))
      ? Math.max(2, Math.min(14, Number(rawGeo.zoom)))
      : 5

    let coords = null
    try {
      // 3.5s budget — the old 1.5s raced Wikipedia's two round-trips and
      // lost constantly, which nulled the coords and let the frontend
      // draw pins at its India fallback (Amazon Rainforest in Hyderabad).
      coords = await Promise.race([
        wikiResolveCoords(geoName || question),
        new Promise(res => setTimeout(() => res(null), 3500)),
      ])
      // Wikipedia articles for large natural features ("Amazon rainforest")
      // often carry NO coordinates tag. Nominatim (OpenStreetMap) resolves
      // basically every named place — use it as the second source.
      if (!coords) {
        coords = await Promise.race([
          nominatimResolveCoords(geoName || question),
          new Promise(res => setTimeout(() => res(null), 3000)),
        ])
      }
    } catch { /* timeout / network — non-fatal */ }

    normalized.geography = {
      name:     geoName || (coords?.title || ''),
      kind:     geoKind,
      zoom:     aiZoom,
      lat:      coords?.lat ?? null,
      lng:      coords?.lng ?? null,
      sections,
      pageUrl:  coords?.pageUrl || null,
    }
  }

  cacheSet(cacheKey, normalized)                                  // L1
  dbCacheSet(qKey, question, normalized, 'ai').catch(() => {})    // L2 (fire-and-forget)
  return normalized
}

/**
 * Resolve a geographic name to { lat, lng, title, pageUrl } via Wikipedia.
 * Cached in-memory for the warm Vercel instance. Returns null when the
 * article has no coordinates (e.g. "Climate change" — concept, not place).
 */
/**
 * Nominatim (OpenStreetMap) geocoder — resolves any named place to lat/lng.
 * Free, no API key; requires a User-Agent and ≤1 req/s (we cache, so fine).
 */
const _nominatimCache = new Map()
async function nominatimResolveCoords(query) {
  const key = (query || '').trim().toLowerCase()
  if (!key) return null
  if (_nominatimCache.has(key)) return _nominatimCache.get(key)
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`
    const r = await fetch(url, { headers: { 'User-Agent': 'KairoEdu/1.0 (kairoindustries.cor@gmail.com)' } })
    if (!r.ok) { _nominatimCache.set(key, null); return null }
    const arr = await r.json()
    const hit = Array.isArray(arr) ? arr[0] : null
    if (!hit?.lat || !hit?.lon) { _nominatimCache.set(key, null); return null }
    const out = {
      lat:     parseFloat(hit.lat),
      lng:     parseFloat(hit.lon),
      title:   hit.display_name?.split(',')[0] || query,
      pageUrl: null,
    }
    _nominatimCache.set(key, out)
    return out
  } catch {
    _nominatimCache.set(key, null)
    return null
  }
}

const _wikiCoordCache = new Map()
async function wikiResolveCoords(query) {
  const key = (query || '').trim().toLowerCase()
  if (!key) return null
  if (_wikiCoordCache.has(key)) return _wikiCoordCache.get(key)
  try {
    // ONE round-trip: generator=search finds the best article AND returns
    // its coordinates in the same response. The old two-step (search,
    // then coords) doubled the latency and kept losing the timeout race.
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&prop=coordinates|info&inprop=url&origin=*`
    const r = await fetch(url, { headers: { 'User-Agent': 'KairoEdu/1.0' } })
    if (!r.ok) { _wikiCoordCache.set(key, null); return null }
    const d = await r.json()
    const page = Object.values(d?.query?.pages || {})[0]
    const coord = page?.coordinates?.[0]
    if (!coord || typeof coord.lat !== 'number' || typeof coord.lon !== 'number') {
      _wikiCoordCache.set(key, null)
      return null
    }
    const out = {
      lat:     coord.lat,
      lng:     coord.lon,
      title:   page?.title || query,
      pageUrl: page?.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(page?.title || query)}`,
    }
    _wikiCoordCache.set(key, out)
    return out
  } catch {
    _wikiCoordCache.set(key, null)
    return null
  }
}

// ────────────────────────────────────────────────────────────────────────────
// /api/ai/solver/text — fast path. Returns the LLM plan WITHOUT the images.
// Designed to fit Vercel's 10s function timeout: only runs the LLM call.
// ────────────────────────────────────────────────────────────────────────────
// Fold optional chat context (conversation, student profile, mistake list)
// into the question string, so getSolverPlan/caching/model calls stay
// single-string. Distinct contexts naturally get distinct cache keys.
function composeQuestion(question, history, student, mistakes) {
  const parts = []
  if (student && (student.name || student.cls)) {
    const bits = []
    if (student.name)  bits.push(`name: ${String(student.name).slice(0, 40)}`)
    if (student.cls)   bits.push(`class ${String(student.cls).slice(0, 12)}`)
    if (student.board) bits.push(String(student.board).slice(0, 24))
    parts.push(`Student profile — ${bits.join(', ')}.`)
  }
  if (Array.isArray(mistakes) && mistakes.length) {
    const rows = mistakes.slice(0, 10)
      .filter(m => m && m.topic)
      .map(m => `- ${String(m.topic).slice(0, 60)} (wrong ${m.count || 1}×${m.severity ? ', ' + String(m.severity).slice(0, 12) : ''})`)
    if (rows.length) parts.push(`MISTAKE PROFILE (this student's weak topics):\n${rows.join('\n')}`)
  }
  if (Array.isArray(history) && history.length) {
    const ctx = history
      .filter(h => h && typeof h.text === 'string' && h.text.trim())
      .slice(-8)
      .map(h => `${h.role === 'user' ? 'Student' : 'Kyno'}: ${h.text.slice(0, 500)}`)
      .join('\n')
    if (ctx) parts.push(`Conversation so far:\n${ctx}`)
  }
  parts.push(`Student's new message: ${question}`)
  return parts.length === 1 ? question : parts.join('\n\n')
}

router.post('/solver/text', async (req, res) => {
  const question = (req.body?.question || '').toString().trim()
  if (!question) return res.status(400).json({ error: 'question required' })
  // Generous cap — long pasted problems are normal in chat. Guards against
  // abuse, not against real questions.
  if (question.length > 4000) return res.status(400).json({ error: 'Question too long (max 4000 characters) — trim it down a bit.' })

  const history  = Array.isArray(req.body?.history)  ? req.body.history.slice(-8)   : []
  const student  = (req.body?.student && typeof req.body.student === 'object') ? req.body.student : null
  const mistakes = Array.isArray(req.body?.mistakes) ? req.body.mistakes.slice(0, 10) : []

  try {
    const plan = await getSolverPlan(composeQuestion(question, history, student, mistakes))
    res.json(plan)
  } catch (e) {
    console.error('[solver/text]', e.message)
    // Preserve 429 (rate limited) so the UI can render a friendly retry hint;
    // 503 if env not configured; everything else is upstream failure → 502.
    const code = e.statusCode
      || (e.message.includes('not configured') ? 503 : 502)
    res.status(code).json({ error: e.message, rateLimited: code === 429 })
  }
})

// ────────────────────────────────────────────────────────────────────────────
// /api/ai/solver/images — pure image search. NO LLM call.
//
// Body: { queries: string[] }   ← frontend gets these from /solver/text
//       { question: string }    ← legacy fallback if no queries provided
//
// Pure image search fits in ~2-3s, well under Vercel's 10s timeout.
// ────────────────────────────────────────────────────────────────────────────
router.post('/solver/images', async (req, res) => {
  const queries = Array.isArray(req.body?.queries)
    ? req.body.queries.filter(q => typeof q === 'string' && q.trim()).slice(0, 6)
    : []
  // Prefer the AI-extracted topicKeyword (clean noun like "Photosynthesis")
  // over the verbose question. Wikipedia's relevance algorithm misroutes
  // long phrases like "photosynthesis step by step" to wrong articles.
  const topic = (req.body?.topicKeyword || req.body?.topic || req.body?.question || '').toString().trim()

  // No queries provided? Fall back to question-based path (slower — runs LLM).
  if (queries.length === 0) {
    if (!topic) return res.status(400).json({ error: 'queries[] or topic required' })

    const fullCacheKey = 'images:' + topic.toLowerCase()
    const cachedSlides = cacheGet(fullCacheKey)
    if (cachedSlides) return res.json({ imageSlides: cachedSlides, cached: true })

    try {
      const plan = await getSolverPlan(topic)
      const slides = await searchManyParallel(plan.imageQueries, topic)
      cacheSet(fullCacheKey, slides)
      return res.json({ imageSlides: slides, cached: false })
    } catch (e) {
      console.error('[solver/images:fallback]', e.message)
      const code = e.message.includes('not configured') ? 503 : 502
      return res.status(code).json({ error: e.message })
    }
  }

  // Fast path: search the queries directly + Wikipedia topic fallback batch.
  const cacheKey = 'imagesByQ:' + (topic + '|' + queries.slice().sort().join('|')).toLowerCase()
  const cached = cacheGet(cacheKey)
  if (cached) return res.json({ imageSlides: cached, cached: true })

  try {
    const slides = await searchManyParallel(queries, topic)
    cacheSet(cacheKey, slides)
    res.json({ imageSlides: slides, cached: false })
  } catch (e) {
    console.error('[solver/images]', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ────────────────────────────────────────────────────────────────────────────
// /api/ai/solver/video — find one educational video for the topic.
// No API key — scrapes the public search results page for the first video ID.
// Cached 24h. Frontend embeds it via youtube-nocookie + modestbranding so it
// reads as "the Kyno lesson video" rather than a third-party embed.
// ────────────────────────────────────────────────────────────────────────────
router.post('/solver/video', async (req, res) => {
  const query = (req.body?.query || req.body?.topicKeyword || req.body?.question || '').toString().trim()
  if (!query) return res.status(400).json({ error: 'query required' })

  const cacheKey = 'video:' + query.toLowerCase()
  const cached = cacheGet(cacheKey)
  if (cached !== null && cached !== undefined) return res.json({ ...cached, cached: true })

  try {
    const videoId = await findEducationalVideoId(query)
    const payload = { videoId, cached: false }
    cacheSet(cacheKey, { videoId })
    res.json(payload)
  } catch (e) {
    console.warn('[solver/video]', e.message)
    res.json({ videoId: null, error: e.message })
  }
})

/**
 * Scrape the first reasonable-looking video ID from a search results page.
 * No API key required — uses the public HTML search endpoint. Results are
 * keyed by ytInitialData embedded in the page.
 */
async function findEducationalVideoId(query) {
  const enriched = query + ' educational explanation for students'
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(enriched)}`
  const r = await fetch(url, {
    headers: {
      'User-Agent':      'Mozilla/5.0 (compatible; KairoEdu/1.0)',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!r.ok) return null
  const html = await r.text()

  // The page contains many "videoId":"<ID>" strings. The first few are the
  // top results. Pick the first one that isn't an obvious short/ad placeholder.
  const ids = []
  const re = /"videoId":"([a-zA-Z0-9_-]{11})"/g
  let m
  while ((m = re.exec(html)) !== null && ids.length < 10) {
    if (!ids.includes(m[1])) ids.push(m[1])
  }
  if (ids.length === 0) return null

  // Prefer videos that aren't already in the cache as known-bad (future use).
  // For now just return the first hit — search results are already ranked.
  return ids[0]
}

// ────────────────────────────────────────────────────────────────────────────
// /api/ai/solver — legacy combined endpoint, kept for backwards compat.
// New frontend code should use /solver/text + /solver/images in parallel.
// This endpoint is timeout-prone on Vercel Hobby — see memory:vercel_timeouts.
// ────────────────────────────────────────────────────────────────────────────
router.post('/solver', async (req, res) => {
  const question = (req.body?.question || '').toString().trim()
  if (!question) return res.status(400).json({ error: 'question required' })
  if (question.length > 4000) return res.status(400).json({ error: 'Question too long (max 4000 characters) — trim it down a bit.' })

  try {
    const plan = await getSolverPlan(question)
    const slides = await searchManyParallel(plan.imageQueries)
    const { imageQueries, ...publicFields } = plan
    res.json({ ...publicFields, imageSlides: slides, cached: false })
  } catch (e) {
    console.error('[solver]', e.message)
    const code = e.message.includes('not configured') ? 503 : 502
    res.status(code).json({ error: e.message })
  }
})

// Strip filler words that make Wikipedia search match the wrong article.
// "Photosynthesis step by step" → "photosynthesis" so the relevance
// algorithm doesn't fixate on "step" and drag us to "The Natural Step".
function cleanQuestionForSearch(q) {
  return q
    .toLowerCase()
    .replace(/\b(step[s]? by step|step[- ]?by[- ]?step)\b/g, '')
    .replace(/\b(explain|describe|tell me about|what is|what are|how does|how do|why is|why does|can you|please)\b/g, '')
    .replace(/\b(in detail|in depth|for class \d+|for students|simple terms|simply)\b/g, '')
    .replace(/[?.,!]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function wikiSearchFirstTitle(query) {
  if (!query) return null
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&origin=*`
    const r = await fetch(url, { headers: { 'User-Agent': 'KairoEdu/1.0' } })
    if (!r.ok) return null
    const d = await r.json()
    return d?.query?.search?.[0]?.title || null
  } catch { return null }
}

/**
 * GRACEFUL DEGRADE: build a solver plan from Wikipedia when every AI model
 * fails (rate limited, provider down, etc.). Student gets a real answer
 * sourced from the article — kept short, with a clear "AI was busy" prefix.
 */
async function synthesizePlanFromWikipedia(question) {
  // Strip filler words so the Wikipedia search matches on the actual topic.
  const cleaned = cleanQuestionForSearch(question)

  // 1. Search Wikipedia — try the cleaned form first, fall back to raw.
  let title = await wikiSearchFirstTitle(cleaned)
  if (!title) title = await wikiSearchFirstTitle(question)
  if (!title) return null

  // 2. Pull a LONGER extract — 12 sentences vs the summary endpoint's 2.
  //    Plus the article's link list for related-concept chips.
  const extractsUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|info|pageprops&exsentences=12&explaintext=1&inprop=url&titles=${encodeURIComponent(title)}&origin=*`
  const exr = await fetch(extractsUrl, { headers: { 'User-Agent': 'KairoEdu/1.0' } })
  if (!exr.ok) return null
  const exd = await exr.json()
  const page = Object.values(exd?.query?.pages || {})[0]
  const extract = page?.extract
  if (!extract) return null

  const pageUrl = page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`

  // 3. Detect if any Kyno Lab matches.
  let labRoute = null
  const lower = title.toLowerCase() + ' ' + extract.toLowerCase()
  for (const [k, hints] of Object.entries(KAIRO_LABS)) {
    const tokens = hints.toLowerCase().split(/[\s,]+/).filter(t => t.length > 4)
    if (tokens.some(t => lower.includes(t))) { labRoute = k; break }
  }

  // 4. Pull a few related article titles for the "Explore further" chips.
  let relatedConcepts = []
  try {
    const linksUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=links&pllimit=10&plnamespace=0&titles=${encodeURIComponent(title)}&origin=*`
    const lr = await fetch(linksUrl, { headers: { 'User-Agent': 'KairoEdu/1.0' } })
    if (lr.ok) {
      const ld = await lr.json()
      const links = Object.values(ld?.query?.pages || {})[0]?.links || []
      relatedConcepts = links
        .map(l => l.title)
        .filter(t => t && !/(list of|disambiguation)/i.test(t))
        .slice(0, 5)
    }
  } catch { /* non-fatal */ }

  // 5. Split the extract into nice paragraphs and pick the first 2-3 as the
  //    "What it is" body, then surface the rest behind a "More" link.
  const paragraphs = extract.split(/\n\n+/).filter(p => p.trim().length > 20)
  const intro = paragraphs.slice(0, 2).join('\n\n') || extract.slice(0, 800)
  const moreDetail = paragraphs.slice(2, 5).join('\n\n')

  return {
    questionType:    'general',
    topicKeyword:    title,
    supports3D:      !!labRoute,
    labRoute,
    textExplanation: [
      `## ${title}`,
      ``,
      intro,
      ``,
      moreDetail ? `## More detail` : '',
      moreDetail,
      ``,
      `---`,
      `*Sourced from Wikipedia · [Read the full article →](${pageUrl})*`,
    ].filter(Boolean).join('\n'),
    formulas:        [],
    relatedConcepts,
    imageQueries:    [title],
    videoQuery:      title + ' explained',
    modelUsed:       'wikipedia-fallback',
  }
}

/**
 * Repair LaTeX/markdown that came back through JSON.parse with single-backslash
 * sequences interpreted as control chars. The classic example:
 *
 *   AI emits "$\rightarrow$"  →  JSON.parse turns \r into a CR  →  string becomes
 *   "$<CR>ightarrow$" which renders as "ightarrow" with a stray carriage return.
 *
 * We restore the most common LaTeX commands by mapping the control char back
 * to a backslash whenever it's followed by alpha characters.
 *
 * Also: drop any orphan trailing "$$" that has no matching opener — those eat
 * the rest of the markdown and are a common AI mistake.
 */
function sanitizeMarkdown(s) {
  if (!s || typeof s !== 'string') return ''
  let out = s
    // CR followed by letters: \rightarrow, \rho, \rangle, etc.
    .replace(/\r([a-zA-Z])/g, '\\$1')
    // Backspace followed by letters: \beta, \boxed, \bar, \binom, \bullet
    .replace(/\x08([a-zA-Z])/g, '\\$1')
    // Form-feed followed by letters: \frac, \forall, \frown
    .replace(/\x0c([a-zA-Z])/g, '\\$1')
    // Vertical tab: \vec, \varphi, \vee
    .replace(/\x0b([a-zA-Z])/g, '\\$1')
    // Stray null / control chars elsewhere — drop
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')

  // Balance $$ blocks: if the count is odd, append a closing $$ on its own line.
  const ddCount = (out.match(/\$\$/g) || []).length
  if (ddCount % 2 === 1) out += '\n$$\n'

  // Same for $: a stray single $ in the middle of prose tends to consume rest.
  // Strip a lone $ that doesn't have a matching close in the same paragraph.
  // Cheap heuristic: count $ inside each paragraph; if odd, neutralize the orphan.
  out = out.split('\n\n').map(para => {
    const dollars = (para.match(/\$/g) || []).length - (para.match(/\$\$/g) || []).length * 2
    if (dollars % 2 === 1) {
      // Strip the LAST orphan single $ in this paragraph
      const idx = para.lastIndexOf('$')
      if (idx >= 0) return para.slice(0, idx) + para.slice(idx + 1)
    }
    return para
  }).join('\n\n')

  return out
}

/** Same idea, but for short single-line strings (formulas, search queries). */
function sanitizeOneLine(s) {
  if (!s || typeof s !== 'string') return ''
  return s
    .replace(/\r([a-zA-Z])/g, '\\$1')
    .replace(/\x08([a-zA-Z])/g, '\\$1')
    .replace(/\x0c([a-zA-Z])/g, '\\$1')
    .replace(/\x0b([a-zA-Z])/g, '\\$1')
    .replace(/[\x00-\x1f]/g, ' ')
    .trim()
    .slice(0, 200)
}

/**
 * Some models prepend "```json" or trailing prose. This pulls out the first
 * balanced { ... } object and JSON.parses it.
 */
function parseJsonLoose(text) {
  if (!text) return null
  // Strip markdown code fences if present
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence ? fence[1] : text

  // Find the first { and the matching closing }
  const start = candidate.indexOf('{')
  if (start < 0) return null
  let depth = 0
  for (let i = start; i < candidate.length; i++) {
    if (candidate[i] === '{') depth++
    else if (candidate[i] === '}') {
      depth--
      if (depth === 0) {
        try { return JSON.parse(candidate.slice(start, i + 1)) }
        catch { return null }
      }
    }
  }
  return null
}

// ────────────────────────────────────────────────────────────────────────────
// /api/ai/solver/status — diagnostic. Returns per-provider health so you can
// see exactly which AI providers are available + working from a browser tab.
//
// Public endpoint — exposes which providers exist (yes/no) but never any keys.
// ────────────────────────────────────────────────────────────────────────────
router.get('/solver/status', async (_req, res) => {
  const hasOR    = !!process.env.OPENROUTER_API_KEY
  const groqInfo = groqPool.status()
  const hasGroq  = groqInfo.total > 0
  const hasModel = !!process.env.SOLVER_MODEL

  // Tiny probe question — picks up any classification issues without burning quota.
  const probe = 'What is photosynthesis?'

  async function probeProvider(label, taskFn) {
    const t0 = Date.now()
    try {
      const { plan, model } = await Promise.race([
        taskFn(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('probe timeout')), 6000)),
      ])
      return {
        provider: label,
        ok:       true,
        model,
        latency_ms: Date.now() - t0,
        sample_topic: plan.topicKeyword || null,
      }
    } catch (e) {
      return {
        provider:   label,
        ok:         false,
        error:      (e.message || '').slice(0, 200),
        latency_ms: Date.now() - t0,
      }
    }
  }

  const probes = []
  if (hasOR) {
    probes.push(probeProvider('openrouter:gpt-oss-20b', () =>
      callModel('openai/gpt-oss-20b:free', probe, process.env.OPENROUTER_API_KEY, 5000)
    ))
  }
  if (hasGroq) {
    for (const m of GROQ_MODELS) {
      // Pass null so the probe draws from the pool too — gives a realistic
      // health check of what real requests will see.
      probes.push(probeProvider(`groq:${m}`, () =>
        callGroqOne(m, probe, null, 5000)
      ))
    }
  }
  // Wikipedia fallback probe
  probes.push((async () => {
    const t0 = Date.now()
    try {
      const plan = await synthesizePlanFromWikipedia(probe)
      return { provider: 'wikipedia-fallback', ok: !!plan, latency_ms: Date.now() - t0, sample_topic: plan?.topicKeyword || null }
    } catch (e) {
      return { provider: 'wikipedia-fallback', ok: false, error: (e.message || '').slice(0, 200), latency_ms: Date.now() - t0 }
    }
  })())

  const results = await Promise.all(probes)
  const anyOk = results.some(r => r.ok)

  res.json({
    overall: anyOk ? 'healthy' : 'degraded',
    env: {
      OPENROUTER_API_KEY_set: hasOR,
      GROQ_API_KEY_set:       hasGroq,
      SOLVER_MODEL_override:  hasModel ? process.env.SOLVER_MODEL : null,
    },
    groq_pool: {
      total_keys:    groqInfo.total,
      live_keys:     groqInfo.live,
      cooling_keys:  groqInfo.cooling,
      hint:          groqInfo.hint,
    },
    providers: results,
    hint: anyOk
      ? 'At least one provider is responding. The Solver will use the fastest one.'
      : 'No providers responded. Check that OPENROUTER_API_KEY and/or GROQ_API_KEYS are set in Vercel env vars and that you have redeployed since adding them.',
  })
})

export default router

