/**
 * A thin, safe wrapper over the browser's Speech Synthesis. Free, offline,
 * no API — the same Web Speech tech the JARVIS side of the family uses.
 * One utterance at a time; callers chain via onend.
 */

export function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

const VOICE_PREF_KEY = 'kyno:listen:voice'

export function listVoices(): { name: string; lang: string }[] {
  try {
    return (window.speechSynthesis.getVoices() || [])
      .filter(v => /^en/i.test(v.lang))
      .map(v => ({ name: v.name, lang: v.lang }))
  } catch { return [] }
}

export function setPreferredVoice(name: string | null): void {
  try {
    if (name) localStorage.setItem(VOICE_PREF_KEY, name)
    else localStorage.removeItem(VOICE_PREF_KEY)
  } catch {}
}

export function getPreferredVoice(): string | null {
  try { return localStorage.getItem(VOICE_PREF_KEY) } catch { return null }
}

/**
 * The student's saved pick first; otherwise the best voice the device has —
 * the "Natural/Neural/Online" voices (Edge ships free neural ones, Android
 * has Google's) sound far better than the old robotic defaults.
 */
function pickVoice(): SpeechSynthesisVoice | null {
  try {
    const voices = window.speechSynthesis.getVoices() || []
    const saved = getPreferredVoice()
    if (saved) {
      const v = voices.find(x => x.name === saved)
      if (v) return v
    }
    const en = voices.filter(v => /^en/i.test(v.lang))
    return (
      en.find(v => /natural|neural|online/i.test(v.name) && /en[-_]IN/i.test(v.lang)) ||
      en.find(v => /natural|neural|online/i.test(v.name)) ||
      en.find(v => /google/i.test(v.name)) ||
      en.find(v => /en[-_]IN/i.test(v.lang)) ||
      en[0] ||
      null
    )
  } catch { return null }
}

export function speak(text: string, opts: { rate?: number; onend?: () => void; onerror?: () => void } = {}): boolean {
  if (!ttsAvailable() || !text) return false
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.rate = opts.rate ?? 1
    const v = pickVoice()
    if (v) u.voice = v
    u.onend = () => opts.onend?.()
    u.onerror = () => (opts.onerror || opts.onend)?.()
    window.speechSynthesis.cancel() // never overlap
    window.speechSynthesis.speak(u)
    return true
  } catch { return false }
}

export function stopSpeaking(): void {
  try { if (ttsAvailable()) window.speechSynthesis.cancel() } catch {}
}

export function pauseSpeaking(): void {
  try { if (ttsAvailable()) window.speechSynthesis.pause() } catch {}
}

export function resumeSpeaking(): void {
  try { if (ttsAvailable()) window.speechSynthesis.resume() } catch {}
}
