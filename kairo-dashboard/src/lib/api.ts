import { supabase } from './supabase'
import { AiError } from './aiError.core'
import { authToken, clearAuthTokens, refreshTokenRaw, setAuthToken, setRefreshToken } from '../lib/storage'

const BASE = '/api'

let refreshPromise: Promise<RefreshResult> | null = null

type RefreshResult =
  | { ok: true;  token: string }
  | { ok: false; reason: 'auth'    }
  | { ok: false; reason: 'network' }

function isNetworkError(err: any): boolean {
  if (!err) return false
  const msg = (err.message || err.name || String(err)).toLowerCase()
  return /failed to fetch|network|err_network|err_internet|abort|load failed/.test(msg)
}

export async function refreshAccessToken(): Promise<RefreshResult> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    const refresh_token = refreshTokenRaw()
    if (!refresh_token) return { ok: false, reason: 'auth' } as const

    let lastErr: any = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data, error } = await supabase.auth.refreshSession({ refresh_token })
        if (error) {
          if (isNetworkError(error)) { lastErr = error; await wait(800 * (attempt + 1)); continue }
          return { ok: false, reason: 'auth' } as const
        }
        if (!data?.session) return { ok: false, reason: 'auth' } as const
        setAuthToken(   data.session.access_token)
        setRefreshToken( data.session.refresh_token)
        return { ok: true, token: data.session.access_token } as const
      } catch (e) {
        lastErr = e
        if (!isNetworkError(e)) return { ok: false, reason: 'auth' } as const
        await wait(800 * (attempt + 1))
      }
    }
    console.warn('[api/auth] refresh failed after 3 attempts (network):', lastErr?.message)
    return { ok: false, reason: 'network' } as const
  })().finally(() => {
    setTimeout(() => { refreshPromise = null }, 0)
  })
  return refreshPromise
}

function wait(ms: number) { return new Promise(res => setTimeout(res, ms)) }

function clearAuthAndNotify() {
  clearAuthTokens()
  clearAuthTokens()
  window.dispatchEvent(new CustomEvent('kairo:auth-expired'))
}

async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    if (data?.session?.access_token) {
      setAuthToken(   data.session.access_token)
      setRefreshToken( data.session.refresh_token)
      return data.session.access_token
    }
  } catch {  }
  return authToken()
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

  if (res.status === 401 && refreshTokenRaw()) {
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
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Routes disagree on the error shape: auth.js sends {error:{code,message}}
    // while the rest send {error:'string'}. Passing the object straight to
    // Error() rendered "[object Object]" on screen.
    const detail = typeof data?.error === 'string'
      ? data.error
      : (data?.error?.message || data?.error?.code)
    const err: any = new Error(detail || `HTTP ${res.status}`)
    err.status = res.status
    err.upstream = data
    throw err
  }
  return data
}

/**
 * Kept for the call sites that already import it — now backed by AiError, so
 * it can no longer return a raw status or claim load for a server fault.
 *
 * It used to map every 5xx to "Kyno's servers are busy right now", and to
 * `return msg` verbatim for anything it did not recognise. Both are how debug
 * strings and false explanations reached students.
 */
export function friendlyError(e: any): string {
  return AiError.from(e).message
}

export const get  = (path: string) => api(path)
export const post = (path: string, body: any) => api(path, { method: 'POST', body: JSON.stringify(body) })
export const put  = (path: string, body: any) => api(path, { method: 'PUT',  body: JSON.stringify(body) })
export const del  = (path: string) => api(path, { method: 'DELETE' })

export async function refreshIfStale(): Promise<void> {
  const token = authToken()
  if (!token) return
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const expMs = payload.exp * 1000
    const msLeft = expMs - Date.now()
    if (msLeft < 5 * 60 * 1000) await refreshAccessToken()
  } catch {  }
}
