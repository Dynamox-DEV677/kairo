
const COOLDOWN_MS_DEFAULT = 60_000
const COOLDOWN_MS_5XX     = 30_000

let _keys = null
let _cursor = 0
const _deadUntil = new Map()

function loadKeys() {
  if (_keys) return _keys
  const raw = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || ''
  const list = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const seen = new Set()
  _keys = list.filter(k => (seen.has(k) ? false : (seen.add(k), true)))
  return _keys
}

function next() {
  const keys = loadKeys()
  if (keys.length === 0) return null

  const now = Date.now()
  for (let attempts = 0; attempts < keys.length; attempts++) {
    const idx = _cursor % keys.length
    _cursor = (_cursor + 1) % Math.max(1, keys.length)
    const k = keys[idx]
    const until = _deadUntil.get(k) || 0
    if (until <= now) return k
  }
  return null
}

function markBad(key, statusCode) {
  if (!key) return
  const ms = statusCode === 429 ? COOLDOWN_MS_DEFAULT : COOLDOWN_MS_5XX
  _deadUntil.set(key, Date.now() + ms)
}

function status() {
  const keys = loadKeys()
  const now  = Date.now()
  const live    = keys.filter(k => (_deadUntil.get(k) || 0) <= now).length
  const cooling = keys.length - live
  return {
    total:    keys.length,
    live,
    cooling,
    cursor:   _cursor,
    hint:     keys.length === 0
      ? 'No Groq keys configured. Set GROQ_API_KEYS in env (comma-separated).'
      : `${live}/${keys.length} keys live, ${cooling} in cooldown`,
  }
}

export default { next, markBad, status }
export { next, markBad, status }
