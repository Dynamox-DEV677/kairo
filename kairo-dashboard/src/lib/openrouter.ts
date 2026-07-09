// Kyno — AI chat client. Groq-only, ALWAYS proxied through the backend
// (/api/ai/chat → rotating Groq key pool). The old direct-from-browser
// OpenRouter path was slow and constantly 429-throttled; it's gone.

const PROXY_URL = '/api/ai/chat'

// Groq models exposed in the model picker. Both answer in ~1s.
export const FREE_MODELS = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B',    provider: 'Groq', color: '#66D9FF', badge: 'Smart' },
  { id: 'llama-3.1-8b-instant',    name: 'Llama 8B Instant', provider: 'Groq', color: '#34d399', badge: 'Fast' },
]

// Default model + fallback chain (order matters — first available wins)
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: !!onChunk }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `HTTP ${res.status}`)
  }

  // Non-streaming
  if (!onChunk) {
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || ''
    if (!content) throw new Error('Empty response')
    return content
  }

  // Streaming SSE
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
      } catch { /* skip malformed SSE */ }
    }
  }

  return full
}

export async function chat({ model = DEFAULT_MODEL, messages, onChunk, signal }: ChatOptions): Promise<string> {
  // The server proxy already falls back across the Groq pool internally
  // (70B → 8B, rotating keys), so one call is enough. Walk the local chain
  // once more only if the whole proxy call fails (cold pool, network blip).
  const chain = Array.from(new Set([model, ...FALLBACK_CHAIN]))
  let lastErr = ''
  for (const m of chain) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      return await callModel(m, messages, onChunk, signal)
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e
      lastErr = e?.message || 'Unknown error'
      console.warn(`[Kyno] ${m} failed: ${lastErr}`)
    }
  }
  throw new Error(`AI request failed. Last error: ${lastErr}`)
}
