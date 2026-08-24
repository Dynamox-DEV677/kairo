
import crypto from 'node:crypto'
import groqPool from '../services/groqPool.js'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

const MODEL_POOLS = {
  speed:  ['llama-3.1-8b-instant',    'llama-3.3-70b-versatile'],
  reason: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  code:   ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
}

const TASK_POOL_MAP = {
  parent_message:    'speed',
  doubt_answer:      'speed',
  admission_chat:    'speed',
  attendance_alert:  'speed',
  essay_grade:       'reason',
  exam_predict:      'reason',
  study_plan:        'reason',
  exam_planner:      'reason',
  exam_planner_replan: 'reason',
  lesson_plan:       'reason',
  flashcard_gen:     'reason',
  question_paper:    'reason',
  insight:           'speed',
}

// ── capacity tuning (env-overridable, safe defaults for Vercel Hobby) ──
// Vercel Hobby kills a function at 10s, so we bail at 8.5s and return a
// friendly message instead of letting the platform hard-fail the request.
const CALL_TIMEOUT_MS  = Number(process.env.AI_TIMEOUT_MS      || 8500)
const MAX_CONCURRENT   = Number(process.env.AI_MAX_CONCURRENT  || 6)
const MAX_ATTEMPTS     = Number(process.env.AI_MAX_ATTEMPTS    || 4)
const CACHE_TTL_MS     = Number(process.env.AI_CACHE_TTL_MS    || 15 * 60_000)
const CACHE_MAX        = Number(process.env.AI_CACHE_MAX       || 400)

function getModels(taskType) {
  const pool = TASK_POOL_MAP[taskType] || 'speed'
  return MODEL_POOLS[pool]
}

/* ────────────────── concurrency limiter ──────────────────
 * 50 students hitting Groq simultaneously guarantees a 429 storm that
 * poisons every key. Cap outbound calls and queue the rest — a request
 * that waits 400ms and succeeds beats one that fails instantly.
 */
let active = 0
const waiting = []

export function acquire() {
  if (active < MAX_CONCURRENT) { active++; return Promise.resolve() }
  return new Promise(resolve => waiting.push(resolve))
}

export function release() {
  const next = waiting.shift()
  if (next) next()          // hand the slot straight to the next waiter
  else active = Math.max(0, active - 1)
}

/** Run fn() while holding one upstream slot. Always releases, even on throw. */
export async function withSlot(fn) {
  await acquire()
  try { return await fn() } finally { release() }
}

/* ────────────────── response cache + single-flight ──────────────────
 * Students on the same syllabus ask the same things. Caching identical
 * prompts is the single biggest free-tier multiplier we have.
 * `inflight` additionally collapses concurrent identical prompts into
 * ONE upstream call — 20 students asking the same doubt costs 1 request.
 */
const cache = new Map()      // key -> { value, exp }
const inflight = new Map()   // key -> Promise<string>

function cacheKey(model, messages, temperature, maxTokens) {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify({ model, messages, temperature, maxTokens }))
    .digest('hex')
}

function cacheGet(key) {
  const hit = cache.get(key)
  if (!hit) return null
  if (hit.exp < Date.now()) { cache.delete(key); return null }
  cache.delete(key); cache.set(key, hit)   // LRU touch
  return hit.value
}

function cacheSet(key, value) {
  cache.set(key, { value, exp: Date.now() + CACHE_TTL_MS })
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

/* ── instrumentation (audit task 3) ──────────────────────────────────────────
   One structured line per finished call, plus a rolling window so
   /api/ops/health can report the REAL failure rate in production — the
   number the audit asked for before any copy tuning. Serverless instances
   are ephemeral: counters reset per instance and that's understood. */

const OUTCOMES_MAX = 500
const outcomes = []

function recordOutcome(o) {
  const row = { ts: Date.now(), ...o }
  outcomes.push(row)
  if (outcomes.length > OUTCOMES_MAX) outcomes.shift()
  // grep-able one-liner: [ai] task=quiz_generate ok=false ms=8123 attempts=4 status=429 reason=groq 429
  console.log(
    `[ai] task=${row.task} ok=${row.ok} ms=${row.ms} attempts=${row.attempts}` +
    (row.ok ? '' : ` status=${row.status} reason=${JSON.stringify(row.reason || '')}`),
  )
}

/** Failure rate + latency percentiles over the last hour, for /api/ops/health. */
export function aiHealth(now = Date.now()) {
  const hour = outcomes.filter(o => now - o.ts <= 3_600_000)
  const fails = hour.filter(o => !o.ok)
  const lat = hour.filter(o => o.ok).map(o => o.ms).sort((a, b) => a - b)
  const pct = p => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(p * lat.length))] : null)
  const byReason = {}
  for (const f of fails) byReason[f.reason || String(f.status)] = (byReason[f.reason || String(f.status)] || 0) + 1
  return {
    windowMinutes: 60,
    calls: hour.length,
    failures: fails.length,
    failRate: hour.length ? +(fails.length / hour.length).toFixed(3) : null,
    p50ms: pct(0.5),
    p95ms: pct(0.95),
    byReason,
    pool: groqPool.status().hint,
  }
}

/** One upstream attempt. Throws on failure so the caller can rotate. */
async function attempt(model, key, messages, temperature, maxTokens, timeoutMs) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!res.ok) {
    if (res.status === 429 || res.status >= 500) {
      try { groqPool.markBad(key, res.status) } catch {}
    }
    const err = new Error(`groq ${res.status}`)
    err.status = res.status
    throw err
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('groq empty')
  return content
}

/**
 * Call Groq with caching, request collapsing, concurrency limiting,
 * key/model rotation and bounded retries.
 *
 * Public signature is unchanged. New optional flags:
 *   noCache  – skip the cache (use for anything user-specific/creative)
 *   timeout  – override the per-attempt timeout in ms
 */
export async function aiCall({
  taskType = 'speed',
  messages,
  maxTokens = 1024,
  temperature = 0.7,
  noCache = false,
  timeout = CALL_TIMEOUT_MS,
}) {
  const models = getModels(taskType)
  const key = cacheKey(models[0], messages, temperature, maxTokens)

  if (!noCache) {
    const hit = cacheGet(key)
    if (hit) return hit
    const pending = inflight.get(key)
    if (pending) return pending          // identical prompt already in flight
  }

  const run = (async () => {
    const deadline = Date.now() + timeout + 1500
    const t0 = Date.now()
    let lastError = null
    let attempts = 0

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const model = models[i % models.length]
      const apiKey = groqPool.next()
      if (!apiKey) { lastError = new Error('no live key'); break }

      const remaining = deadline - Date.now()
      if (remaining < 1200) break        // no time for another honest try

      await acquire()
      attempts++
      try {
        const content = await attempt(
          model, apiKey, messages, temperature, maxTokens,
          Math.min(timeout, remaining),
        )
        if (!noCache) cacheSet(key, content)
        recordOutcome({ task: taskType, ok: true, ms: Date.now() - t0, attempts, status: 200 })
        return content
      } catch (err) {
        lastError = err
        // 429/5xx: brief backoff then rotate key+model. Other errors rotate immediately.
        if (err.status === 429 || err.status >= 500) await sleep(150 * (i + 1))
      } finally {
        release()
      }
    }

    recordOutcome({
      task: taskType, ok: false, ms: Date.now() - t0, attempts,
      status: lastError?.status || 0, reason: lastError?.message || 'unknown',
    })
    console.warn('[AI] all attempts failed:', lastError?.message, '|', groqPool.status().hint)
    const friendly = new Error(
      'Kyno is busy right now — a lot of students are using it. Please try again in a few seconds.',
    )
    friendly.code = 'AI_UNAVAILABLE'
    friendly.internal = `${lastError?.message || 'unknown'} | pool: ${groqPool.status().hint}`
    throw friendly
  })()

  if (!noCache) {
    inflight.set(key, run)
    run.finally(() => inflight.delete(key)).catch(() => {})
  }
  return run
}

/**
 * How loaded the upstream gate is right now.
 * Routes use this to degrade gracefully: when quiet, they can afford
 * latency tricks (racing several models); when busy, they must not.
 */
export function loadLevel() {
  return {
    active,
    queued: waiting.length,
    max: MAX_CONCURRENT,
    busy: waiting.length > 0 || active >= Math.ceil(MAX_CONCURRENT * 0.6),
  }
}

/** Ops visibility: GET this from a status route to see live capacity. */
export function aiStats() {
  return {
    pool: groqPool.status(),
    concurrency: { active, queued: waiting.length, max: MAX_CONCURRENT },
    cache: { entries: cache.size, max: CACHE_MAX, ttlMs: CACHE_TTL_MS },
    inflight: inflight.size,
  }
}

export function parseJSON(raw) {
  let cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  const objMatch = cleaned.match(/\{[\s\S]*\}/)
  const arrMatch = cleaned.match(/\[[\s\S]*\]/)
  if (objMatch || arrMatch) {
    const objIdx = objMatch ? cleaned.indexOf(objMatch[0]) : Infinity
    const arrIdx = arrMatch ? cleaned.indexOf(arrMatch[0]) : Infinity
    cleaned = objIdx <= arrIdx ? objMatch[0] : arrMatch[0]
  }

  try {
    return JSON.parse(cleaned)
  } catch (_) {}

  const repaired = cleaned
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\\([^"\\/bfnrtu])/g, '$1')
    .replace(/\t/g, '\\t')
    .replace(/\r\n/g, '\\n')
    .replace(/\r/g, '\\n')
    .replace(/,\s*([}\]])/g, '$1')

  try {
    return JSON.parse(repaired)
  } catch (e) {
    console.error('[parseJSON] Failed to parse AI response:', cleaned.slice(0, 300))
    throw new Error(`AI returned invalid JSON: ${e.message}`)
  }
}
