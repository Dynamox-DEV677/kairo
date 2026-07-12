
const PROXY_URL = '/api/ai/chat'

export const FREE_MODELS = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B',    provider: 'Groq', color: '#66D9FF', badge: 'Smart' },
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: !!onChunk }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `HTTP ${res.status}`)
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

export async function chat({ model = DEFAULT_MODEL, messages, onChunk, signal }: ChatOptions): Promise<string> {
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
