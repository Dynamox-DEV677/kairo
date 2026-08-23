/**
 * A thin, safe wrapper over the browser's Speech Synthesis. Free, offline,
 * no API — the same Web Speech tech the JARVIS side of the family uses.
 * One utterance at a time; callers chain via onend.
 */

export function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** Prefer an Indian-English voice when the device has one. */
function pickVoice(): SpeechSynthesisVoice | null {
  try {
    const voices = window.speechSynthesis.getVoices() || []
    return (
      voices.find(v => /en[-_]IN/i.test(v.lang)) ||
      voices.find(v => /^en/i.test(v.lang)) ||
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
