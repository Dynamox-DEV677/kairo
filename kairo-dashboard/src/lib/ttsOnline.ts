/**
 * HD voice — Groq Orpheus TTS through /api/tts. Always optional: every caller
 * must keep the device voice as fallback, because offline is a first-class
 * Kyno state. Clips are cached in memory so replaying a card costs nothing.
 */

const CACHE = new Map<string, string>() // text|voice -> object URL
const CACHE_CAP = 30

let current: HTMLAudioElement | null = null

export const HD_VOICES = ['hannah', 'troy', 'austin'] as const
export type HdVoice = typeof HD_VOICES[number]

async function fetchClip(text: string, voice: string): Promise<string> {
  const key = `${voice}|${text}`
  const hit = CACHE.get(key)
  if (hit) return hit

  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('kairo_token') || ''}`,
    },
    body: JSON.stringify({ text, voice }),
  })
  if (!res.ok) throw new Error(`tts ${res.status}`)
  const blob = await res.blob()
  if (!blob.type.startsWith('audio/')) throw new Error('tts bad payload')
  const url = URL.createObjectURL(blob)

  CACHE.set(key, url)
  if (CACHE.size > CACHE_CAP) {
    const oldest = CACHE.keys().next().value as string
    const old = CACHE.get(oldest)
    CACHE.delete(oldest)
    if (old) URL.revokeObjectURL(old)
  }
  return url
}

/**
 * Speak one script in HD. Resolves true when playback STARTED (onend fires
 * later); throws when HD is unavailable so the caller can fall back.
 */
export async function speakOnline(text: string, opts: { voice?: string; rate?: number; onend?: () => void } = {}): Promise<void> {
  const url = await fetchClip(text, opts.voice || HD_VOICES[0])
  stopOnline()
  const a = new Audio(url)
  a.playbackRate = opts.rate ?? 1
  a.onended = () => { if (current === a) current = null; opts.onend?.() }
  a.onerror = () => { if (current === a) current = null; opts.onend?.() }
  current = a
  await a.play()
}

export function stopOnline(): void {
  if (current) {
    try { current.onended = null; current.onerror = null; current.pause() } catch {}
    current = null
  }
}

export function pauseOnline(): void { try { current?.pause() } catch {} }
export function resumeOnline(): void { try { current?.play() } catch {} }
export function isOnlineActive(): boolean { return current != null }
