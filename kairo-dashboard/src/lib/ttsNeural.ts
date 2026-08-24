/**
 * Neural voice — Kokoro-82M running ON THIS DEVICE via kokoro-js.
 * The "download something" answer done right: one ~90 MB model download
 * (cached by the browser), then studio-quality speech forever — offline,
 * no server, no rate limits.
 *
 * The library is dynamically imported so the main bundle never carries it;
 * nothing loads until the student actually picks the Neural voice.
 */
import { wavBytesFromFloat32 } from './wav.core'

export const NEURAL_VOICES = ['af_heart', 'af_bella', 'bf_emma', 'bm_fable'] as const
export const NEURAL_VOICE_LABELS: Record<string, string> = {
  af_heart: 'Heart (US)', af_bella: 'Bella (US)', bf_emma: 'Emma (UK)', bm_fable: 'Fable (UK, male)',
}
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'

type Status = 'idle' | 'downloading' | 'ready' | 'error'
let status: Status = 'idle'
let progressPct = 0
let engine: any = null
let enginePromise: Promise<any> | null = null
let lastError = ''

const CACHE = new Map<string, string>() // voice|text -> object URL
const CACHE_CAP = 30
let current: HTMLAudioElement | null = null

export function neuralStatus(): { status: Status; progress: number; error: string; device: string } {
  return { status, progress: progressPct, error: lastError, device: deviceKind() }
}

function deviceKind(): string {
  // One deliberate path: q8 on WASM. The WebGPU route needs the full fp32
  // model (~330 MB) — more than 3× the download for a quality gap card-length
  // clips don't justify, and "one ~90 MB download" must stay TRUE on every
  // device. WASM q8 runs card scripts in a couple of seconds anywhere.
  return 'wasm'
}

/** Load (and download on first use) the model. Safe to call repeatedly. */
export function loadNeural(): Promise<any> {
  if (engine) return Promise.resolve(engine)
  if (enginePromise) return enginePromise
  status = 'downloading'; progressPct = 0; lastError = ''
  enginePromise = (async () => {
    const { KokoroTTS } = await import('kokoro-js')
    const device = deviceKind()
    const tts = await KokoroTTS.from_pretrained(MODEL_ID, {
      dtype: 'q8',
      device: device as any,
      progress_callback: (info: any) => {
        if (info?.status === 'progress' && typeof info.progress === 'number') {
          progressPct = Math.round(info.progress)
        }
      },
    })
    engine = tts
    status = 'ready'; progressPct = 100
    return tts
  })().catch(e => {
    status = 'error'
    lastError = e?.message || 'failed to load'
    enginePromise = null
    throw e
  })
  return enginePromise
}

async function clipUrl(text: string, voice: string): Promise<string> {
  const key = `${voice}|${text}`
  const hit = CACHE.get(key)
  if (hit) return hit

  const tts = await loadNeural()
  const audio = await tts.generate(text, { voice })
  // RawAudio has toBlob() in the browser; the WAV encoder is the safety net.
  let blob: Blob
  if (typeof audio?.toBlob === 'function') blob = audio.toBlob()
  else {
    const bytes = wavBytesFromFloat32(audio.audio, audio.sampling_rate)
    blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/wav' })
  }
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

/** Speak one script neurally; throws if the model can't load or generate. */
export async function speakNeural(text: string, opts: { voice?: string; rate?: number; onend?: () => void } = {}): Promise<void> {
  const url = await clipUrl(text, opts.voice || NEURAL_VOICES[0])
  stopNeural()
  const a = new Audio(url)
  a.playbackRate = opts.rate ?? 1
  a.onended = () => { if (current === a) current = null; opts.onend?.() }
  a.onerror = () => { if (current === a) current = null; opts.onend?.() }
  current = a
  await a.play()
}

export function stopNeural(): void {
  if (current) {
    try { current.onended = null; current.onerror = null; current.pause() } catch {}
    current = null
  }
}
export function pauseNeural(): void { try { current?.pause() } catch {} }
export function resumeNeural(): void { try { current?.play() } catch {} }
export function isNeuralActive(): boolean { return current != null }
