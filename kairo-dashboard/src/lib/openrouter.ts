// Kairo — OpenRouter client (proxied through backend so the key stays server-side)

const VITE_OR_KEY = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined
const DIRECT_URL  = 'https://openrouter.ai/api/v1/chat/completions'
const PROXY_URL   = '/api/ai/chat'

// All confirmed working free models on OpenRouter (from kairo-ui)
export const FREE_MODELS = [
  { id: 'openai/gpt-oss-20b:free',                          name: 'GPT OSS 20B',          provider: 'OpenAI',      color: '#34d399', badge: 'Fast' },
  { id: 'openai/gpt-oss-120b:free',                         name: 'GPT OSS 120B',         provider: 'OpenAI',      color: '#818cf8', badge: 'Smart' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free',           name: 'Llama 3.3 70B',        provider: 'Meta',        color: '#a78bfa', badge: '' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free',           name: 'Nemotron 3 Super 120B',provider: 'Nvidia',      color: '#76b900', badge: 'New' },
  { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', name: 'Nemotron Omni 30B',  provider: 'Nvidia',      color: '#86efac', badge: '' },
  { id: 'google/gemma-4-31b-it:free',                       name: 'Gemma 4 31B',          provider: 'Google',      color: '#fbbf24', badge: '' },
  { id: 'qwen/qwen3-coder:free',                            name: 'Qwen3 Coder 480B',     provider: 'Alibaba',     color: '#f472b6', badge: 'Huge' },
]

// Default model + fallback chain (order matters — first available wins)
export const DEFAULT_MODEL = 'openai/gpt-oss-20b:free'

const FALLBACK_CHAIN = [
  'openai/gpt-oss-20b:free',
  'openai/gpt-oss-120b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-4-31b-it:free',
  'qwen/qwen3-coder:free',
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
  // If VITE_OPENROUTER_API_KEY is set, call OpenRouter directly (no backend needed)
  // Otherwise fall back to the backend proxy
  const useDirect = !!VITE_OR_KEY
  const url     = useDirect ? DIRECT_URL : PROXY_URL
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (useDirect) {
    headers['Authorization'] = `Bearer ${VITE_OR_KEY}`
    headers['HTTP-Referer']  = window.location.origin
    headers['X-Title']       = 'Kairo'
  }

  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers,
    body: JSON.stringify(
      useDirect
        ? { model, messages, stream: !!onChunk }
        : { model, messages, stream: !!onChunk }
    ),
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

function isModelUnavailable(msg: string) {
  const m = msg.toLowerCase()
  return m.includes('no endpoint') || m.includes('no provider') ||
    m.includes('provider returned error') || m.includes('not found') ||
    m.includes('unavailable') || m.includes('overloaded') ||
    m.includes('rate limit') || m.includes('context length')
}

export async function chat({ model = DEFAULT_MODEL, messages, onChunk, signal }: ChatOptions): Promise<string> {
  // Build fallback chain: selected model → default → rest of chain
  const chain = Array.from(new Set([model, ...FALLBACK_CHAIN]))

  let lastErr = ''

  for (const m of chain) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      console.log(`[Kairo] Trying model: ${m}`)
      return await callModel(m, messages, onChunk, signal)
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e
      lastErr = e?.message || 'Unknown error'
      console.warn(`[Kairo] ${m} failed: ${lastErr}`)
      if (!isModelUnavailable(lastErr)) throw e  // auth / network — don't retry
    }
  }

  throw new Error(`All models failed. Last error: ${lastErr}`)
}
