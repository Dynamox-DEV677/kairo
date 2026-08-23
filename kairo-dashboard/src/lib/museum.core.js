/**
 * The Mistake Museum — every wrong answer, from anywhere in Kyno, filed in one
 * re-testable place. The topper's error log, kept automatically.
 *
 * Sources: quiz_answered events. New events carry the full question in
 * `payload` (question text, options, correctIndex) — those become rich,
 * re-askable cards. Old events from before the payload existed can't be
 * re-asked verbatim, so they group into honest topic-level rows instead of
 * pretending to remember questions they never stored.
 *
 * Retirement: answer the SAME question (matched by normalised text) correctly
 * FIX_STREAK times in a row after its last miss and it moves to "Fixed". A
 * later miss brings it back. All computed from the event log — no second
 * store to drift out of sync.
 */

export const FIX_STREAK = 2

// Per-entry "why it slipped" heuristic, from the event's own timing+difficulty.
// Same thresholds family as mistakes.core; labelled "likely" in the UI.
export const FAST_MS = 12_000
export const SLOW_MS = 60_000

export function questionKey(q) {
  return String(q || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function whyOf(e) {
  const d = typeof e.durationMs === 'number' ? e.durationMs : null
  const diff = typeof e.difficulty === 'number' ? e.difficulty : 0.5
  if (d != null && d < FAST_MS && diff <= 0.45) return 'careless'
  if (d != null && d > SLOW_MS) return 'timing'
  return 'concept'
}

/**
 * Build the museum from the raw event log.
 * Returns { entries, legacy } — entries newest-first.
 */
export function museumEntries(events) {
  const rows = (events || []).filter(e => e && e.type === 'quiz_answered' && typeof e.correct === 'boolean')

  /** per-question state, keyed by normalised question text */
  const byQ = new Map()
  const legacyByTopic = new Map()

  for (const e of rows) {
    const qText = e.payload && e.payload.q
    if (!qText) {
      if (e.correct === false) {
        const key = `${e.subject || ''}|${e.topic || 'general'}`
        const g = legacyByTopic.get(key) || { subject: e.subject || null, topic: e.topic || 'general', count: 0, lastTs: 0 }
        g.count++
        g.lastTs = Math.max(g.lastTs, e.ts || 0)
        legacyByTopic.set(key, g)
      }
      continue
    }

    const key = questionKey(qText)
    let s = byQ.get(key)
    if (!s) { s = { key, wrongs: 0, streak: 0, entry: null }; byQ.set(key, s) }

    if (e.correct === false) {
      s.wrongs++
      s.streak = 0
      // The latest miss owns the card (freshest chosen-answer + timing).
      const p = e.payload
      s.entry = {
        id: key,
        ts: e.ts || 0,
        subject: e.subject || null,
        topic: e.topic || null,
        question: String(qText),
        options: Array.isArray(p.options) ? p.options.map(String) : null,
        correctIndex: typeof p.correctIndex === 'number' ? p.correctIndex : null,
        chosenIndex: typeof p.chosenIndex === 'number' ? p.chosenIndex : null,
        explanation: p.explanation ? String(p.explanation) : null,
        why: whyOf(e),
        misses: s.wrongs,
      }
    } else if (s.entry) {
      s.streak++
    }
  }

  const entries = []
  for (const s of byQ.values()) {
    if (!s.entry) continue // never wrong with payload — not museum material
    entries.push({ ...s.entry, misses: s.wrongs, fixed: s.streak >= FIX_STREAK, correctStreak: s.streak })
  }
  entries.sort((a, b) => b.ts - a.ts)

  const legacy = [...legacyByTopic.values()].sort((a, b) => b.count - a.count)
  return { entries, legacy }
}

/** Open (unfixed), re-askable cards for a drill. Oldest miss first — the
 *  longest-standing debts get paid first. */
export function drillDeck(entries, { max = 20 } = {}) {
  return (entries || [])
    .filter(e => !e.fixed && e.options && e.options.length >= 2 && e.correctIndex != null)
    .sort((a, b) => a.ts - b.ts)
    .slice(0, max)
}

/**
 * Deterministic option rotation so a re-drill isn't answerable by remembering
 * "it was B". Rotation (not shuffle) keeps it O(1) and reversible, seeded by
 * the entry's own timestamp.
 */
export function rotatedOptions(entry) {
  const opts = entry.options || []
  const n = opts.length
  if (!n) return { options: [], correctIndex: -1 }
  const k = Math.abs(entry.ts || 0) % n
  const options = opts.map((_, i) => opts[(i + k) % n])
  return { options, correctIndex: ((entry.correctIndex - k) % n + n) % n }
}

export function museumStats(entries) {
  const open = (entries || []).filter(e => !e.fixed)
  const fixed = (entries || []).filter(e => e.fixed)
  const bySubject = {}
  const byWhy = { careless: 0, concept: 0, timing: 0 }
  for (const e of open) {
    const s = e.subject || 'General'
    bySubject[s] = (bySubject[s] || 0) + 1
    if (e.why in byWhy) byWhy[e.why]++
  }
  return { open: open.length, fixed: fixed.length, bySubject, byWhy }
}

/** Strip the "A) " style letter prefix quiz options sometimes carry. */
export function cleanOption(opt) {
  return String(opt || '').replace(/^\s*[A-Da-d][).:\-]\s*/, '').trim()
}
