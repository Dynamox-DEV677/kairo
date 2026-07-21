// Developer Mode — "bring your own Groq key" (BYOK).
//
// When a student turns Developer Mode on and pastes their own Groq API key,
// EVERY AI request from this device carries that key in the `x-groq-key`
// header. The server then uses ONLY that key and never touches Kyno's shared
// pool. The key lives only in this browser's localStorage — it is never
// synced, uploaded, or logged.

const KEY_STORE = 'kyno_dev_groq_key'
const MODE_STORE = 'kyno_dev_mode'

/** Groq keys look like `gsk_...` — reject anything that doesn't. */
export function looksLikeGroqKey(k: string): boolean {
  return /^gsk_[A-Za-z0-9]{20,}$/.test((k || '').trim())
}

export function isDevMode(): boolean {
  try { return localStorage.getItem(MODE_STORE) === '1' } catch { return false }
}

export function setDevMode(on: boolean): void {
  try { localStorage.setItem(MODE_STORE, on ? '1' : '0') } catch {  }
}

/** The raw stored key, for the Settings editor — regardless of whether dev mode is on. */
export function getDevKeyRaw(): string {
  try { return (localStorage.getItem(KEY_STORE) || '').trim() } catch { return '' }
}

export function setDevKey(key: string): void {
  try { localStorage.setItem(KEY_STORE, (key || '').trim()) } catch {  }
}

/** The key to actually send — only when dev mode is ON and the key is well-formed. */
export function activeDevGroqKey(): string {
  if (!isDevMode()) return ''
  const k = getDevKeyRaw()
  return looksLikeGroqKey(k) ? k : ''
}

/** Merge into the `headers` of any `/api/ai/*` fetch. Empty object when dev mode is off. */
export function aiHeaders(): Record<string, string> {
  const k = activeDevGroqKey()
  return k ? { 'x-groq-key': k } : {}
}
