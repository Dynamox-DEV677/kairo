/**
 * Demo Mode -- one rule, shared by every place that offers it.
 *
 * seedDemo() APPENDS a fortnight of sample quizzes, mistakes and cards to the
 * student's real history, which then syncs to their account. Offered to anyone
 * with real activity, it would mix fake scores into their predictions for
 * good. So demo data may only ever go into an account with nothing in it --
 * and both the first-run prompt and the Performance empty state ask here.
 */
import { seedDemo, loadState } from './twin'
import { authToken } from './storage'

/** Per-account key, so dismissing or accepting the offer sticks per student. */
export function promptStorageKey(): string {
  if (typeof window === 'undefined') return 'kyno:demo-prompt-shown:_local'
  try {
    const tok = authToken()
    if (tok) {
      const payload = JSON.parse(atob(tok.split('.')[1]))
      if (payload?.sub) {
        let h = 0x811c9dc5
        const s = String(payload.sub)
        for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
        return 'kyno:demo-prompt-shown:' + ((h >>> 0).toString(36)).padStart(7, '0')
      }
    }
  } catch { /* fall through */ }
  return 'kyno:demo-prompt-shown:_local'
}

/** True only for an account with no activity at all. */
export function demoAvailable(): boolean {
  try { return (loadState().events || []).length === 0 } catch { return false }
}

/** Fill the (empty) account with the sample fortnight and reload. */
export function loadDemo(): void {
  if (!demoAvailable()) throw new Error('Demo data is only for an empty account.')
  seedDemo()
  try { localStorage.setItem(promptStorageKey(), 'accepted:' + Date.now()) } catch { /* ignore */ }
  window.location.reload()
}
