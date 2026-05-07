// Auth-aware API client — auto-attaches Bearer token, refreshes on 401.
import { supabase } from './supabase'

const BASE = '/api'

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  // Single-flight: collapse concurrent 401s into one refresh
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    const refresh_token = localStorage.getItem('kairo_refresh')
    if (!refresh_token) return null
    try {
      const { data, error } = await supabase.auth.refreshSession({ refresh_token })
      if (error || !data?.session) return null
      localStorage.setItem('kairo_token',   data.session.access_token)
      localStorage.setItem('kairo_refresh', data.session.refresh_token)
      return data.session.access_token
    } catch {
      return null
    } finally {
      // Reset after a tick so retries within the same flow don't loop
      setTimeout(() => { refreshPromise = null }, 0)
    }
  })()
  return refreshPromise
}

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

  // On 401, try refreshing once and retry the original request
  if (res.status === 401 && localStorage.getItem('kairo_refresh')) {
    const fresh = await refreshAccessToken()
    if (fresh) {
      const headers = await buildHeaders(options.headers)
      res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: { ...headers, Authorization: `Bearer ${fresh}` },
      })
    } else {
      clearAuthAndNotify()
    }
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`)
  return data
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
