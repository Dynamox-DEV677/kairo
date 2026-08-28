/**
 * Screen-view instrumentation (audit tasks 9 + 11).
 *
 * Two sinks, both cheap:
 *  - a local ring buffer (kyno:usage:screens) so per-module usage counts can
 *    be read on-device — this is what the task-11 nav restructuring will be
 *    argued from;
 *  - a fire-and-forget beacon to /api/analytics/screen so aggregate usage is
 *    measurable in production logs. No PII beyond the screen id.
 */
import { getRaw, setRaw } from './storage'
import { authToken } from './storage'

const KEY = 'kyno:usage:screens'
const CAP = 1000

/**
 * The beacon is the one outbound flow a student can switch off, so the switch
 * has to be real. Settings lists this flow as optional; if this preference
 * stopped being honoured, that listing would become the next false claim.
 * Default on — it is disclosed in Settings rather than assumed.
 */
const TELEMETRY_KEY = 'kyno:privacy:telemetry'

export function telemetryEnabled(): boolean {
  try { return getRaw(TELEMETRY_KEY) !== '0' } catch { return true }
}

export function setTelemetryEnabled(on: boolean): void {
  try { setRaw(TELEMETRY_KEY, on ? '1' : '0') } catch {}
}

interface ScreenHit { s: string; ts: number }

export function logScreenView(screen: string): void {
  try {
    const list: ScreenHit[] = JSON.parse(getRaw(KEY) || '[]')
    const last = list[list.length - 1]
    // A remount or hash round-trip is not a second visit.
    if (last && last.s === screen && Date.now() - last.ts < 5_000) return
    list.push({ s: screen, ts: Date.now() })
    setRaw(KEY, JSON.stringify(list.slice(-CAP)))
  } catch {}

  // Local counting above is on-device and always fine. Only the beacon leaves.
  if (!telemetryEnabled()) return

  try {
    const body = JSON.stringify({ screen, ts: Date.now() })
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/screen', new Blob([body], { type: 'application/json' }))
    } else {
      fetch('/api/analytics/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken() || ''}` },
        body, keepalive: true,
      }).catch(() => {})
    }
  } catch {}
}

/** Visits per screen over the last N days — the task-11 evidence. */
export function usageSummary(days = 14): { screen: string; visits: number }[] {
  try {
    const since = Date.now() - days * 86_400_000
    const list: ScreenHit[] = JSON.parse(getRaw(KEY) || '[]')
    const counts = new Map<string, number>()
    for (const h of list) if (h.ts >= since) counts.set(h.s, (counts.get(h.s) || 0) + 1)
    return [...counts.entries()].map(([screen, visits]) => ({ screen, visits }))
      .sort((a, b) => b.visits - a.visits)
  } catch { return [] }
}
