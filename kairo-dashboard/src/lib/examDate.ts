/**
 * The one place that answers "how many days to the nearest exam?" — the
 * scheduler's first-class input. Reads the same student profile the Home
 * brief uses (kyno:student_profile). Null when no exam date is set: the
 * scheduler treats null as FAR and applies no compression.
 */
import { getJSON } from './storage'

interface ExamDate { name?: string; date?: string }

export function nearestExamDays(now = Date.now()): number | null {
  try {
    const p = getJSON<{ examDates?: ExamDate[] }>('kyno:student_profile')
    const days = (p?.examDates || [])
      .map(e => Date.parse(e?.date || ''))
      .filter(t => Number.isFinite(t))
      .map(t => (t + 86_400_000 - now) / 86_400_000) // exam day counts until it ends
      .filter(d => d > 0)
    if (!days.length) return null
    return Math.floor(Math.min(...days))
  } catch { return null }
}
