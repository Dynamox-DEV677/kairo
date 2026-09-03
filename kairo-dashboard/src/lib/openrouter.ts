import { aiHeadersAsync } from './devKey'

import { AiError } from './aiError.core'

const PROXY_URL = '/api/ai/chat'

export const FREE_MODELS = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B',    provider: 'Groq', color: '#A5B4FC', badge: 'Smart' },
  { id: 'llama-3.1-8b-instant',    name: 'Llama 8B Instant', provider: 'Groq', color: '#34d399', badge: 'Fast' },
]

export const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

const FALLBACK_CHAIN = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
]

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatOptions {
  model?: string
  messages: Message[]
  onChunk?: (token: string, full: string) => void
  signal?: AbortSignal
}

async function callModel(
  model: string,
  messages: Message[],
  onChunk?: ChatOptions['onChunk'],
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    signal,
    // await, so the SDK hands back a live token rather than the stale
    // kyno:token snapshot that used to 401 every AI route after an hour
    headers: { 'Content-Type': 'application/json', ...(await aiHeadersAsync()) },
    body: JSON.stringify({ model, messages, stream: !!onChunk }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    // Carry the status on the error object. AiError classifies on it, and the
    // string form is never shown to a student.
    const detail = typeof body?.error === 'string' ? body.error : body?.error?.message
    const err: any = new Error(detail || `HTTP ${res.status}`)
    err.status = res.status
    err.upstream = body
    throw err
  }

  if (!onChunk) {
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || ''
    if (!content) throw new Error('Empty response')
    return content
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))
    for (const line of lines) {
      const data = line.slice(6)
      if (data === '[DONE]') break
      try {
        const token = JSON.parse(data)?.choices?.[0]?.delta?.content || ''
        if (token) { full += token; onChunk(token, full) }
      } catch {  }
    }
  }

  return full
}

/**
 * An auth failure is not a model failure.
 *
 * This used to walk the whole fallback chain on ANY error, so a 401 was retried
 * once per model — each with its own timeout — before surfacing. That is why a
 * broken session read as "the button does nothing" rather than as an error: the
 * student was waiting out two dead requests. Switching models cannot fix
 * credentials, so auth errors leave the loop immediately.
 */
function isAuthError(e: any): boolean {
  const m = String(e?.message || '')
  return e?.status === 401 || e?.status === 403 || /(401|403)/.test(m) ||
    /missing bearer|invalid or expired token|not authenticated/i.test(m)
}

export async function chat({ model = DEFAULT_MODEL, messages, onChunk, signal }: ChatOptions): Promise<string> {
  const chain = Array.from(new Set([model, ...FALLBACK_CHAIN]))
  let lastErr: any = null

  for (const m of chain) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      return await callModel(m, messages, onChunk, signal)
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e
      lastErr = e

      if (isAuthError(e)) {
        // One forced refresh, then one retry on the SAME model. If the session
        // is genuinely gone, fail now rather than after the whole chain.
        try {
          const { refreshAccessToken } = await import('./api')
          const r = await refreshAccessToken()
          if (r?.ok) return await callModel(m, messages, onChunk, signal)
        } catch { /* fall through to the throw below */ }
        throw new AiError('AUTH_EXPIRED', e)
      }

      console.warn(`[Kyno] ${m} failed: ${e?.message || e}`)
    }
  }

  throw AiError.from(lastErr)
}
