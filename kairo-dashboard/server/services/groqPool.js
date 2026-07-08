/**
 * Groq API key rotation pool.
 *
 * Why this exists
 *   Groq's free tier is rate-limited per account (30 req/min for Llama 3.3 70B).
 *   When Kora gets a burst — judges/teachers/students all hitting at once —
 *   a single key tops out fast and every subsequent request fails with 429.
 *
 *   This module pools many Groq keys (one per Google/Outlook/Yahoo account
 *   Darshan registered) and rotates through them per-request. When a key
 *   hits 429, it's parked in a cooldown set for 60 s and skipped by the
 *   rotation, then re-admitted automatically. When every key is in cooldown,
 *   the caller falls through to the Wikipedia fallback Solver already has.
 *
 * Configuration
 *   The pool reads two env vars, in priority order:
 *     1. GROQ_API_KEYS  — comma-separated list of keys. The expected form.
 *     2. GROQ_API_KEY   — legacy single key. Used as a fallback so existing
 *                          deploys that only set the singular var keep working.
 *
 *   Whitespace and trailing commas are tolerated. Duplicate keys collapse.
 *
 * Thread-safety
 *   Vercel functions are single-threaded per instance. Multiple parallel
 *   requests inside one warm window do share state — that's a feature, not
 *   a bug: it means a 429 on one request immediately benefits every later
 *   request in the same window.
 *
 *   Cold starts re-initialise the pool from env (state is intentionally
 *   per-instance). That's fine: cooldowns from a previous instance don't
 *   carry over, so a fresh function picks up where the dead keys may have
 *   already recovered upstream.
 */

const COOLDOWN_MS_DEFAULT = 60_000   // park a 429'd key for 60 s
const COOLDOWN_MS_5XX     = 30_000   // shorter for transient 5xx errors

let _keys = null                      // string[] | null — lazy loaded
let _cursor = 0                       // round-robin index
const _deadUntil = new Map()          // key → epoch ms when it's allowed again

function loadKeys() {
  if (_keys) return _keys
  const raw = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || ''
  const list = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  // Dedupe while preserving order
  const seen = new Set()
  _keys = list.filter(k => (seen.has(k) ? false : (seen.add(k), true)))
  return _keys
}

/**
 * Pick the next key that's not in cooldown. Returns null when every key is
 * parked — caller should fall through to the Wikipedia fallback.
 */
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

/**
 * Mark a key as throttled. Caller passes the HTTP status code so we can pick
 * an appropriate cooldown — 429 gets the full minute, transient 5xx gets 30 s
 * so we recover from upstream blips fast.
 */
function markBad(key, statusCode) {
  if (!key) return
  const ms = statusCode === 429 ? COOLDOWN_MS_DEFAULT : COOLDOWN_MS_5XX
  _deadUntil.set(key, Date.now() + ms)
}

/** Public diagnostic snapshot — read by /solver/status. */
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
