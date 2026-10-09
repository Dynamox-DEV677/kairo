import { aiHeadersAsync } from './devKey'

import { AiError } from './aiError.core'

const PROXY_URL = '/api/ai/chat'

export const FREE_MODELS = [
  { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', provider: 'Groq', color: '#A5B4FC', badge: 'Smart' },
  { id: 'openai/gpt-oss-20b',  name: 'GPT-OSS 20B',  provider: 'Groq', color: '#34d399', badge: 'Fast' },
]

export const DEFAULT_MODEL = 'openai/gpt-oss-120b'

const FALLBACK_CHAIN = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
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
  /** Ask for JSON mode (the caller still parses leniently). */
  json?: boolean
  /** gpt-oss reasoning effort; "low" leaves more of the 2048 tokens for the reply. */
  effort?: 'low' | 'medium' | 'high'
  /**
   * Refuse the server's stand-in replies (the "busy" message, the Wikipedia
   * extract). Anything that must come from the student's own material --
   * "Ask this book" above all -- would otherwise show one as if it were the
   * answer.
   */
  strict?: boolean
}

type CallExtras = Pick<ChatOptions, 'json' | 'effort' | 'strict'>

async function callModel(
  model: string,
  messages: Message[],
  onChunk?: ChatOptions['onChunk'],
  signal?: AbortSignal,
  extras: CallExtras = {},
): Promise<string> {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    signal,
    // await, so the SDK hands back a live token rather than the stale
    // kyno:token snapshot that used to 401 every AI route after an hour
    headers: { 'Content-Type': 'application/json', ...(await aiHeadersAsync()) },
    body: JSON.stringify({
      model, messages, stream: !!onChunk,
      ...(extras.json ? { json: true } : {}),
      ...(extras.effort ? { effort: extras.effort } : {}),
    }),
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
    if (extras.strict && data?._fallback) {
      // Carries a 503 so AiError reads it as a fault, never as "busy" load.
      const err: any = new Error('AI unavailable (stand-in reply refused)')
      err.status = 503
      throw err
    }
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

export async function chat({ model = DEFAULT_MODEL, messages, onChunk, signal, json, effort, strict }: ChatOptions): Promise<string> {
  const chain = Array.from(new Set([model, ...FALLBACK_CHAIN]))
  const extras: CallExtras = { json, effort, strict }
  let lastErr: any = null

  for (const m of chain) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      return await callModel(m, messages, onChunk, signal, extras)
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e
      lastErr = e

      if (isAuthError(e)) {
        // One forced refresh, then one retry on the SAME model. If the session
        // is genuinely gone, fail now rather than after the whole chain.
        try {
          const { refreshAccessToken } = await import('./api')
          const r = await refreshAccessToken()
          if (r?.ok) return await callModel(m, messages, onChunk, signal, extras)
        } catch { /* fall through to the throw below */ }
        throw new AiError('AUTH_EXPIRED', e)
      }

      console.warn(`[Kyno] ${m} failed: ${e?.message || e}`)
    }
  }

  throw AiError.from(lastErr)
}
