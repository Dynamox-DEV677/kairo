/**
 * AI Utility — Smart model selection based on task type
 * ──────────────────────────────────────────────────────
 * Routes different task types to appropriate models:
 *  - SPEED tasks  → small, fast model (quick responses)
 *  - REASON tasks → large, capable model (complex reasoning)
 *  - CODE tasks   → code-specialized model
 */

import groqPool from '../services/groqPool.js'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Groq-only (OpenRouter removed — slow + 429-throttled on the free tier).
// Task type → Groq model order: speed-y tasks lead with the sub-second 8B,
// reasoning/structured tasks lead with the smarter 70B.
const MODEL_POOLS = {
  speed:  ['llama-3.1-8b-instant',    'llama-3.3-70b-versatile'],
  reason: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  code:   ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
}

// Which task types map to which pool
const TASK_POOL_MAP = {
  // Speed tasks
  parent_message:    'speed',
  doubt_answer:      'speed',
  admission_chat:    'speed',
  attendance_alert:  'speed',
  // Reasoning tasks
  essay_grade:       'reason',
  exam_predict:      'reason',
  study_plan:        'reason',
  exam_planner:      'reason',
  exam_planner_replan: 'reason',
  lesson_plan:       'reason',
  // Code/structured output tasks
  flashcard_gen:     'reason',
  question_paper:    'reason',
  insight:           'speed',
}

function getModels(taskType) {
  const pool = TASK_POOL_MAP[taskType] || 'speed'
  return MODEL_POOLS[pool]
}

function isUnavailable(msg) {
  const m = (msg || '').toLowerCase()
  return (
    m.includes('no endpoint') ||
    m.includes('no endpoints') ||
    m.includes('provider') ||
    m.includes('model not found') ||
    m.includes('rate limit') ||
    m.includes('overloaded')
  )
}

/**
 * Call AI with automatic model fallback.
 *
 * @param {object} opts
 * @param {string} opts.taskType   - one of the TASK_POOL_MAP keys
 * @param {Array}  opts.messages   - OpenAI-format messages array
 * @param {number} [opts.maxTokens=1024]
 * @param {number} [opts.temperature=0.7]
 * @returns {Promise<string>}      - raw content string from AI
 */
export async function aiCall({ taskType = 'speed', messages, maxTokens = 1024, temperature = 0.7 }) {
  const models = getModels(taskType)
  let lastError = null

  for (const gModel of models) {
    const key = groqPool.next()
    if (!key) break   // no keys configured / all cooling down
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: gModel, messages, temperature, max_tokens: maxTokens }),
      })
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) {
          try { groqPool.markBad(key, res.status) } catch {}
        }
        throw new Error(`groq ${res.status}`)
      }
      const data = await res.json()
      const content = data.choices?.[0]?.message?.content
      if (content) return content
      throw new Error('groq empty')
    } catch (err) {
      lastError = err
      console.warn(`[AI] Groq ${gModel} failed (${err.message}), trying next…`)
    }
  }

  throw new Error(
    'Groq AI unavailable. Check GROQ_API_KEYS is set in env and redeployed ' +
    '(pool: ' + groqPool.status().hint + '). ' +
    'Last error: ' + (lastError?.message || 'unknown')
  )
}

/**
 * Parse JSON from AI response robustly.
 * Handles: markdown fences, trailing text, bad escape sequences,
 * smart quotes, literal newlines inside strings.
 */
export function parseJSON(raw) {
  // 1. Strip markdown fences
  let cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  // 2. Extract just the JSON object or array (first { ... } or [ ... ] block)
  const objMatch = cleaned.match(/\{[\s\S]*\}/)
  const arrMatch = cleaned.match(/\[[\s\S]*\]/)
  if (objMatch || arrMatch) {
    // Pick whichever appears first
    const objIdx = objMatch ? cleaned.indexOf(objMatch[0]) : Infinity
    const arrIdx = arrMatch ? cleaned.indexOf(arrMatch[0]) : Infinity
    cleaned = objIdx <= arrIdx ? objMatch[0] : arrMatch[0]
  }

  // 3. Try a direct parse first (fastest path)
  try {
    return JSON.parse(cleaned)
  } catch (_) {}

  // 4. Repair common AI JSON mistakes and try again
  const repaired = cleaned
    // Smart/curly quotes → straight quotes
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    // Bad escape: backslash before a non-special char (e.g. \' → ', \% → %)
    .replace(/\\([^"\\/bfnrtu])/g, '$1')
    // Literal tab / newline / carriage-return inside JSON string values → escaped
    .replace(/\t/g, '\\t')
    .replace(/\r\n/g, '\\n')
    .replace(/\r/g, '\\n')
    // Trailing commas before } or ]
    .replace(/,\s*([}\]])/g, '$1')

  try {
    return JSON.parse(repaired)
  } catch (e) {
    // Last resort: log the bad response to help debug
    console.error('[parseJSON] Failed to parse AI response:', cleaned.slice(0, 300))
    throw new Error(`AI returned invalid JSON: ${e.message}`)
  }
}
