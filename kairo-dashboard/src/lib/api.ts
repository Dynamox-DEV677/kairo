// Always use relative /api — never an external URL (ignores VITE_API_BASE if set in Vercel)
const BASE = '/api'

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
