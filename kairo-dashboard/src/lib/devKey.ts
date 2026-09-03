// Developer Mode — "bring your own Groq key" (BYOK).
import { authToken, setAuthToken } from '../lib/storage'
import { supabase } from './supabase'
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
 * Is this JWT past its expiry?
 *
 * Treats anything unparseable as expired. A token we cannot read is a token we
 * cannot vouch for, and sending it produces exactly the 401 this is here to
 * prevent. The 30s skew covers the request being in flight when it lapses.
 */
function isExpired(jwt: string): boolean {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]))
    if (!payload?.exp) return true
    return payload.exp * 1000 - Date.now() < 30_000
  } catch {
    return true
  }
}

/** The Supabase SDK's own storage key holds the live session it auto-refreshes. */
function tokenFromSdkStorage(): string | null {
  try {
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

/**
 * The current Supabase access token, synchronously.
 *
 * ORDER MATTERS, and getting it wrong took most of the AI offline.
 *
 * kyno:token is a SNAPSHOT written at sign-in. The Supabase SDK auto-refreshes
 * roughly hourly and writes the new token to sb-<ref>-auth-token — nothing
 * updates the snapshot. This used to return the snapshot first and without an
 * expiry check, so about an hour after signing in it shadowed the live session
 * with a dead token, and every AI route 401'd while everything routed through
 * api.ts (which asks the SDK) kept working. That split is what made it look
 * like an outage rather than an auth bug.
 *
 * So: the SDK's storage is the source of truth, the snapshot is the fallback,
 * and an expired token is never returned from either.
 */
export function sessionToken(): string | null {
  const live = tokenFromSdkStorage()
  if (live && !isExpired(live)) return live

  try {
    const cached = authToken()
    if (cached && !isExpired(cached)) return cached
  } catch { /* storage blocked */ }

  return null
}

/**
 * Headers for any AI-route fetch: the bring-your-own Groq key when dev mode is
 * on, and ALWAYS a session token that is actually valid.
 *
 * THE TOKEN HALF IS NOT OPTIONAL. /api/ai/*, /api/camera/*, /api/document/*,
 * /api/council and /api/topic-architect sit behind requireSupabaseAuth, because
 * they were once reachable with no auth at all and anyone could burn the Groq
 * quota. Call sites send the headers built here and nothing else, so a missing
 * Authorization header is not a degraded request -- it is a 401 and a dead
 * feature.
 *
 * There used to be a synchronous aiHeaders() beside this. It read the token
 * from storage, and when that token had expired it returned an object with no
 * Authorization key at all -- so the server answered "Missing Bearer token."
 * and the Solver stopped working about an hour after signing in, while
 * everything routed through api.ts kept working and hid it. It is deleted:
 * every caller can await, so nothing needs a version that fails this way.
 *
 * getSession() returns the SDK's live session and refreshes it when it is near
 * expiry, so this cannot send a stale token. It re-seeds kyno:token too, which
 * keeps the snapshot honest for anything that still reads it.
 */
export async function aiHeadersAsync(): Promise<Record<string, string>> {
  const h: Record<string, string> = {}

  const k = activeDevGroqKey()
  if (k) h['x-groq-key'] = k

  try {
    const { data } = await supabase.auth.getSession()
    const t = data?.session?.access_token
    if (t) {
      try { setAuthToken(t) } catch { /* storage blocked */ }
      h.Authorization = `Bearer ${t}`
      return h
    }
  } catch { /* fall through to the sync path */ }

  const fallback = sessionToken()
  if (fallback) h.Authorization = `Bearer ${fallback}`
  return h
}
