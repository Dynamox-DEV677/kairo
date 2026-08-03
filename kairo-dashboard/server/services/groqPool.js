
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
  // everything is cooling — better to retry the least-recently-benched key
  // than to hand the caller nothing
  return reviveIfAllDead()
}

function markBad(key, statusCode) {
  if (!key) return
  let ms = statusCode === 429 ? COOLDOWN_MS_DEFAULT : COOLDOWN_MS_5XX

  // With a small pool, benching a key for a full minute is self-inflicted
  // downtime: one 429 can take the whole service offline. Scale the cooldown
  // to how much slack we actually have.
  const poolSize = loadKeys().length
  if (poolSize <= 1)      ms = Math.min(ms, 4_000)
  else if (poolSize <= 3) ms = Math.min(ms, 12_000)

  _deadUntil.set(key, Date.now() + ms)
}

/** Emergency valve: if every key is cooling, revive the one free soonest. */
function reviveIfAllDead() {
  const keys = loadKeys()
  if (!keys.length) return null
  const now = Date.now()
  if (keys.some(k => (_deadUntil.get(k) || 0) <= now)) return null
  let best = keys[0]
  for (const k of keys) {
    if ((_deadUntil.get(k) || 0) < (_deadUntil.get(best) || 0)) best = k
  }
  _deadUntil.delete(best)
  return best
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
export { next, markBad, status, reviveIfAllDead }
