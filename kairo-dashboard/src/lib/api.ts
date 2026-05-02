/**
 * Backend API helper
 * In dev: http://localhost:4000/api
 * In prod: set VITE_API_BASE in Vercel → Environment Variables
 */

const BASE = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:4000/api'

export async function api(
  path: string,
  options: RequestInit = {}
): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`)
  return data
}

export const get  = (path: string) => api(path)
export const post = (path: string, body: any) => api(path, { method: 'POST', body: JSON.stringify(body) })
export const put  = (path: string, body: any) => api(path, { method: 'PUT',  body: JSON.stringify(body) })
export const del  = (path: string) => api(path, { method: 'DELETE' })
