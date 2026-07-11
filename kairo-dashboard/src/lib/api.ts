// Auth-aware API client — auto-attaches Bearer token, refreshes on 401.
import { supabase } from './supabase'

const BASE = '/api'

let refreshPromise: Promise<RefreshResult> | null = null

type RefreshResult =
  | { ok: true;  token: string }
  | { ok: false; reason: 'auth'    }    // refresh token rejected — really logged out
  | { ok: false; reason: 'network' }    // transient (ERR_NETWORK_IO_SUSPENDED etc.) — don't bounce user

/**
 * A network error here usually means the tab was suspended, the system was
 * sleeping, or there's a momentary connectivity blip. Those are NOT signs
 * that the user is logged out — the tokens are still valid, we just can't
 * reach Supabase to verify. Distinguishing them prevents the "logged out
 * after laptop wakes up" bug.
 */
function isNetworkError(err: any): boolean {
  if (!err) return false
  const msg = (err.message || err.name || String(err)).toLowerCase()
  return /failed to fetch|network|err_network|err_internet|abort|load failed/.test(msg)
}

async function refreshAccessToken(): Promise<RefreshResult> {
  // Single-flight: collapse concurrent 401s into one refresh
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    const refresh_token = localStorage.getItem('kairo_refresh')
    if (!refresh_token) return { ok: false, reason: 'auth' } as const

    // Retry up to 3 times on network errors, with backoff. Auth errors
    // fail-fast (no point retrying — the token's invalid).
    let lastErr: any = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data, error } = await supabase.auth.refreshSession({ refresh_token })
        if (error) {
          // Auth-level error (e.g. invalid refresh token) — not a network blip
          if (isNetworkError(error)) { lastErr = error; await wait(800 * (attempt + 1)); continue }
          return { ok: false, reason: 'auth' } as const
        }
        if (!data?.session) return { ok: false, reason: 'auth' } as const
        localStorage.setItem('kairo_token',   data.session.access_token)
        localStorage.setItem('kairo_refresh', data.session.refresh_token)
        return { ok: true, token: data.session.access_token } as const
      } catch (e) {
        lastErr = e
        if (!isNetworkError(e)) return { ok: false, reason: 'auth' } as const
        await wait(800 * (attempt + 1))   // 800ms, 1.6s, 2.4s
      }
    }
    console.warn('[api/auth] refresh failed after 3 attempts (network):', lastErr?.message)
    return { ok: false, reason: 'network' } as const
  })().finally(() => {
    // Clear singleton on next tick so a subsequent 401 can trigger a fresh retry
    setTimeout(() => { refreshPromise = null }, 0)
  })
  return refreshPromise
}

function wait(ms: number) { return new Promise(res => setTimeout(res, ms)) }

function clearAuthAndNotify() {
  localStorage.removeItem('kairo_token')
  localStorage.removeItem('kairo_refresh')
  // Don't nuke profile — login screen reads role to render the right form
  window.dispatchEvent(new CustomEvent('kairo:auth-expired'))
}

async function getAccessToken(): Promise<string | null> {
  // Prefer Supabase's live session (auto-refreshed by the client when stale).
  // Fall back to localStorage for the brief window before getSession resolves
  // and for backwards compatibility with older logins.
  try {
    const { data } = await supabase.auth.getSession()
    if (data?.session?.access_token) {
      // Mirror to localStorage for components that still read it directly
      localStorage.setItem('kairo_token',   data.session.access_token)
      localStorage.setItem('kairo_refresh', data.session.refresh_token)
      return data.session.access_token
    }
  } catch { /* ignore */ }
  return localStorage.getItem('kairo_token')
}

async function buildHeaders(custom?: HeadersInit): Promise<HeadersInit> {
  const token = await getAccessToken()
  const base: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) base.Authorization = `Bearer ${token}`
  return { ...base, ...(custom as Record<string, string> | undefined) }
}

export async function api(path: string, options: RequestInit = {}): Promise<any> {
  let res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: await buildHeaders(options.headers),
  })

  // On 401, try refreshing once and retry the original request.
  // Distinguish auth-failure (really logged out) from network-failure
  // (tab was suspended, system slept) — only kick the user back to login
  // when their refresh token is actually rejected.
  if (res.status === 401 && localStorage.getItem('kairo_refresh')) {
    const result = await refreshAccessToken()
    if (result.ok) {
      const headers = await buildHeaders(options.headers)
      res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: { ...headers, Authorization: `Bearer ${result.token}` },
      })
    } else if (result.reason === 'auth') {
      clearAuthAndNotify()
    }
    // result.reason === 'network': leave the user logged in; the 401 propagates
    // to the caller as a normal error and the next request will retry.
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`)
  return data
}

/**
 * Turn a raw thrown error into a calm, human message for the UI.
 * Browser network failures ("Failed to fetch"), HTML-error-page parse
 * failures ("Unexpected token '<'"), aborts and 5xx all become friendly
 * copy; server-provided readable messages (data.error) pass through.
 */
export function friendlyError(e: any): string {
  const msg = (e?.message || String(e ?? '')).trim()
  if (!msg) return 'Something went wrong. Please try again.'
  const low = msg.toLowerCase()
  if (
    low.includes('failed to fetch') || low.includes('networkerror') ||
    low.includes('network request failed') || low.includes('load failed') ||
    low.includes('unexpected token') || low.includes('aborted') ||
    low.includes('the operation was aborted') || low.includes('timeout')
  ) return 'Couldn’t reach Kyno — check your connection and try again.'
  if (/^api error 5\d\d/i.test(msg) || /\b50[234]\b/.test(msg)) {
    return 'Kyno’s servers are busy right now. Give it a moment and try again.'
  }
  return msg
}

export const get  = (path: string) => api(path)
export const post = (path: string, body: any) => api(path, { method: 'POST', body: JSON.stringify(body) })
export const put  = (path: string, body: any) => api(path, { method: 'PUT',  body: JSON.stringify(body) })
export const del  = (path: string) => api(path, { method: 'DELETE' })

// Background-refresh helper — call once on app boot to renew a token close to expiry.
export async function refreshIfStale(): Promise<void> {
  const token = localStorage.getItem('kairo_token')
  if (!token) return
  // Decode JWT exp without verification (we trust our own storage)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const expMs = payload.exp * 1000
    const msLeft = expMs - Date.now()
    // Refresh proactively if less than 5 minutes left
    if (msLeft < 5 * 60 * 1000) await refreshAccessToken()
  } catch { /* malformed token — ignore */ }
}
