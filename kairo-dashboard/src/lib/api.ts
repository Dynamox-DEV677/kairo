import { supabase } from './supabase'

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

async function refreshAccessToken(): Promise<RefreshResult> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    const refresh_token = localStorage.getItem('kairo_refresh')
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
        localStorage.setItem('kairo_token',   data.session.access_token)
        localStorage.setItem('kairo_refresh', data.session.refresh_token)
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
  localStorage.removeItem('kairo_token')
  localStorage.removeItem('kairo_refresh')
  window.dispatchEvent(new CustomEvent('kairo:auth-expired'))
}

async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    if (data?.session?.access_token) {
      localStorage.setItem('kairo_token',   data.session.access_token)
      localStorage.setItem('kairo_refresh', data.session.refresh_token)
      return data.session.access_token
    }
  } catch {  }
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
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`)
  return data
}

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

export async function refreshIfStale(): Promise<void> {
  const token = localStorage.getItem('kairo_token')
  if (!token) return
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const expMs = payload.exp * 1000
    const msLeft = expMs - Date.now()
    if (msLeft < 5 * 60 * 1000) await refreshAccessToken()
  } catch {  }
}
