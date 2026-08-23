/**
 * Focus Lock, part 2 — the ban list and the session receipt.
 *
 * The ban list is a COMMITMENT CONTRACT, and the copy must never pretend
 * otherwise: a web app cannot force-close Instagram. What Kyno can do is
 * witness the contract — any drift out of the app freezes the clock, gets
 * timed, and shows up on the receipt. Accountability, honestly framed.
 *
 * The receipt is the part blockers don't have: because every study action in
 * Kyno already lands in the twin event log with a timestamp, a focus session
 * window [start, end] can be answered with "what did I actually do in there?"
 * — real questions answered, cards flipped, notes made, topics touched.
 * Computed from the log, never self-reported.
 */

/* ── ban list ─────────────────────────────────────────────────────────────── */

export const SUGGESTED_BANS = ['Instagram', 'YouTube', 'WhatsApp', 'Snapchat', 'Games', 'Discord']
export const MAX_BANS = 12

export function parseBanList(raw) {
  try {
    const l = JSON.parse(raw)
    if (!Array.isArray(l)) return []
    return [...new Set(l.map(s => String(s).trim()).filter(Boolean))].slice(0, MAX_BANS)
  } catch { return [] }
}

export function toggleBan(list, name) {
  const n = String(name || '').trim()
  if (!n) return list
  const has = list.some(x => x.toLowerCase() === n.toLowerCase())
  if (has) return list.filter(x => x.toLowerCase() !== n.toLowerCase())
  if (list.length >= MAX_BANS) return list
  return [...list, n]
}

/* ── the receipt ──────────────────────────────────────────────────────────── */

/** Event types that count as "studying", and what to call them. */
const STUDY_TYPES = {
  quiz_answered: 'questions',
  flashcard_review: 'cards',
  note_created: 'notes',
  concept_viewed: 'concepts',
  essay_graded: 'essays',
  lab_opened: 'labs',
}

/**
 * What actually happened inside [startTs, endTs], from the twin event log.
 * Returns null-safe zeros; topics are unique subject·topic pairs with counts,
 * busiest first.
 */
export function sessionReceipt(events, startTs, endTs) {
  const inWindow = (events || []).filter(e =>
    e && typeof e.ts === 'number' && e.ts >= startTs && e.ts <= endTs && STUDY_TYPES[e.type])

  const counts = { questions: 0, correct: 0, cards: 0, notes: 0, concepts: 0, essays: 0, labs: 0 }
  const topicMap = new Map()

  for (const e of inWindow) {
    const bucket = STUDY_TYPES[e.type]
    counts[bucket]++
    if (e.type === 'quiz_answered' && e.correct === true) counts.correct++
    if (e.topic) {
      const key = `${e.subject || 'General'}|${e.topic}`
      const t = topicMap.get(key) || { subject: e.subject || 'General', topic: e.topic, count: 0 }
      t.count++
      topicMap.set(key, t)
    }
  }

  return {
    ...counts,
    actions: inWindow.length,
    topics: [...topicMap.values()].sort((a, b) => b.count - a.count),
  }
}

/** One line for the live strip: "4 questions · 2 cards · 2 topics". */
export function receiptLine(r) {
  if (!r || r.actions === 0) return null
  const bits = []
  if (r.questions) bits.push(`${r.questions} question${r.questions === 1 ? '' : 's'}${r.questions ? ` (${r.correct} right)` : ''}`)
  if (r.cards) bits.push(`${r.cards} card${r.cards === 1 ? '' : 's'}`)
  if (r.notes) bits.push(`${r.notes} note${r.notes === 1 ? '' : 's'}`)
  if (r.concepts) bits.push(`${r.concepts} concept${r.concepts === 1 ? '' : 's'}`)
  if (r.essays) bits.push(`${r.essays} essay${r.essays === 1 ? '' : 's'}`)
  if (r.labs) bits.push(`${r.labs} lab${r.labs === 1 ? '' : 's'}`)
  if (r.topics.length) bits.push(`${r.topics.length} topic${r.topics.length === 1 ? '' : 's'}`)
  return bits.join(' · ')
}

/* ── today, for the Home / Kyno OS card ───────────────────────────────────── */

const DAY = 86_400_000

function sameLocalDay(a, b) {
  const da = new Date(a), db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

/**
 * Today's focus story for the dashboard cards: sessions, focused minutes,
 * drifts, and the merged receipt. `history` records may carry a stored
 * `receipt`; totals also re-merge topics across sessions.
 */
export function todaysFocus(history, now) {
  const today = (history || []).filter(r => r && typeof r.ts === 'number' && sameLocalDay(r.ts, now))
  if (!today.length) return null

  const focusedMin = Math.round(today.reduce((a, r) => a + (r.focusedMs || 0), 0) / 60000)
  const drifts = today.reduce((a, r) => a + (r.drifts || 0), 0)
  const driftMin = Math.round(today.reduce((a, r) => a + (r.driftMs || 0), 0) / 60000)

  const topicMap = new Map()
  let questions = 0, correct = 0, cards = 0, notes = 0
  for (const r of today) {
    const rec = r.receipt
    if (!rec) continue
    questions += rec.questions || 0
    correct += rec.correct || 0
    cards += rec.cards || 0
    notes += rec.notes || 0
    for (const t of rec.topics || []) {
      const key = `${t.subject}|${t.topic}`
      const cur = topicMap.get(key) || { ...t, count: 0 }
      cur.count += t.count
      topicMap.set(key, cur)
    }
  }

  return {
    sessions: today.length,
    focusedMin,
    drifts,
    driftMin,
    questions, correct, cards, notes,
    topics: [...topicMap.values()].sort((a, b) => b.count - a.count).slice(0, 4),
  }
}
