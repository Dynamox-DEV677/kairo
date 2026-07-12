
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

export async function aiCall({ taskType = 'speed', messages, maxTokens = 1024, temperature = 0.7 }) {
  const models = getModels(taskType)
  let lastError = null

  for (const gModel of models) {
    const key = groqPool.next()
    if (!key) break
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
