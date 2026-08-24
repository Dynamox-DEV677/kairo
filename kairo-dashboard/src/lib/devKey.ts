// Developer Mode — "bring your own Groq key" (BYOK).
import { authToken } from '../lib/storage'
//
// When a student turns Developer Mode on and pastes their own Groq API key,
// EVERY AI request from this device carries that key in the `x-groq-key`
// header. The server then uses ONLY that key and never touches Kyno's shared
// pool. The key lives only in this browser's localStorage — it is never
// synced, uploaded, or logged.

const KEY_STORE = 'kyno_dev_groq_key'
const MODE_STORE = 'kyno_dev_mode'

/** Groq keys look like `gsk_...` — reject anything that doesn't. */
export function looksLikeGroqKey(k: string): boolean {
  return /^gsk_[A-Za-z0-9]{20,}$/.test((k || '').trim())
}

export function isDevMode(): boolean {
  try { return localStorage.getItem(MODE_STORE) === '1' } catch { return false }
}

export function setDevMode(on: boolean): void {
  try { localStorage.setItem(MODE_STORE, on ? '1' : '0') } catch {  }
}

/** The raw stored key, for the Settings editor — regardless of whether dev mode is on. */
export function getDevKeyRaw(): string {
  try { return (localStorage.getItem(KEY_STORE) || '').trim() } catch { return '' }
}

export function setDevKey(key: string): void {
  try { localStorage.setItem(KEY_STORE, (key || '').trim()) } catch {  }
}

/** The key to actually send — only when dev mode is ON and the key is well-formed. */
export function activeDevGroqKey(): string {
  if (!isDevMode()) return ''
  const k = getDevKeyRaw()
  return looksLikeGroqKey(k) ? k : ''
}

/**
 * Headers for any AI-route fetch: the bring-your-own Groq key when dev mode is
 * on, and ALWAYS the session token.
 *
 * The token half is not optional. /api/ai/*, /api/camera/*, /api/document/*,
 * /api/council and /api/topic-architect used to be reachable with no auth at
 * all — anyone could burn the Groq quota — so they were put behind
 * requireSupabaseAuth. These call sites send headers built here and nothing
 * else, so without the Authorization header every one of them 401s and the
 * Solver stops answering.
 *
 * kairo_token holds the Supabase access_token (set on every login path in
 * Login.tsx and refreshed by lib/api.ts), which is exactly what the server
 * verifies.
 */
export function aiHeaders(): Record<string, string> {
  const h: Record<string, string> = {}

  const k = activeDevGroqKey()
  if (k) h['x-groq-key'] = k

  const token = sessionToken()
  if (token) h.Authorization = `Bearer ${token}`

  return h
}

/**
 * The current Supabase access token, synchronously.
 *
 * kairo_token alone is not enough. It is written by the login paths in
 * Login.tsx, so a session the Supabase SDK restored on its own — a returning
 * user who never re-logged-in — has no kairo_token at all, and every AI route
 * 401s. That is exactly what happened in production.
 *
 * The SDK's own storage key is the real source of truth, so fall back to it.
 * Reading it directly rather than calling getSession() because that is async
 * and this is used inline in header objects.
 */
export function sessionToken(): string | null {
  try {
    const direct = authToken()
    if (direct) return direct
  } catch { /* storage blocked; try the SDK key below */ }

  try {
    // supabase-js v2 stores under sb-<project-ref>-auth-token.
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith('sb-') || !k.endsWith('-auth-token')) continue
      const raw = localStorage.getItem(k)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      const t = parsed?.access_token || parsed?.currentSession?.access_token
      if (t) return t
    }
  } catch (e) {
    console.warn('[ai] could not read the Supabase session:', e)
  }

  return null
}
