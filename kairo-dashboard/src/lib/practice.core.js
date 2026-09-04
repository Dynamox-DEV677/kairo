/**
 * Practice — the pure half.
 *
 * The student picks TIME. Kyno picks FORMAT. Everything that decides what a
 * 15-minute session contains lives here, as functions of data the app already
 * holds: due flashcards, the mistake rows, the mastery table. No React, no
 * fetch, no storage, so node --test can run the builder against realistic
 * inputs and prove the one rule that matters — a 15- or 30-minute session is
 * never a single format.
 *
 * "Adaptive Quiz or Revision Simulator?" is a question no student can answer.
 * Those are internal names. "How long have you got?" is a question a
 * fifteen-year-old answers without thinking.
 */

/* ── per-item time estimates, in seconds ─────────────────────────────────── */

export const ESTIMATE = {
  card:     15,
  question: 70,
  written:  120,   // includes photographing and grading
  teach:    90,
}

/** Budget presets. The only three the picker offers. */
export const BUDGETS = [5, 15, 30]

/**
 * How each budget is split across formats.
 *
 *   5 min  → cards only. Five minutes is not long enough to photograph an
 *            answer and read a grade; pretending otherwise makes a rushed,
 *            worse session.
 *  15 min  → 40% cards · 45% questions · one written answer
 *  30 min  → 30% cards · 40% questions · one written · one teach-back
 */
export const ALLOCATION = {
  5:  { cards: 1.0,  questions: 0,    written: 0, teach: 0 },
  15: { cards: 0.40, questions: 0.45, written: 1, teach: 0 },
  30: { cards: 0.30, questions: 0.40, written: 1, teach: 1 },
}

/* ── sources ─────────────────────────────────────────────────────────────── */

/**
 * Due cards, oldest overdue first.
 *
 * "Due" is dueAt <= now — the same test Flashcards.tsx and Home use, so the
 * "24 cards due" on this screen is the same 24 the student saw on Home. Two
 * screens disagreeing on that number is the bug this app has had before.
 */
export function dueCards(cards = [], now = Date.now()) {
  if (!Array.isArray(cards)) return []
  return cards
    .filter(c => c && typeof c.dueAt === 'number' && c.dueAt <= now && c.front && c.back)
    .slice()
    .sort((a, b) => a.dueAt - b.dueAt)
}

/**
 * The topic the questions should target: the most severe recent mistake row.
 * Falls back to the weakest mastery row, then to null. Null means "no history
 * yet" and the caller asks for mixed questions rather than inventing a weak
 * topic for someone the app has never seen work.
 */
export function targetTopic(mistakes = [], mastery = []) {
  const m = Array.isArray(mistakes) ? mistakes.filter(r => r && r.topic) : []
  if (m.length) {
    const top = m.slice().sort((a, b) => (b.severity || 0) - (a.severity || 0))[0]
    return { topic: top.topic, subject: top.subject || null, why: 'mistakes' }
  }
  const rows = Array.isArray(mastery) ? mastery.filter(r => r && r.topic && (r.attempts || 0) >= 2) : []
  if (rows.length) {
    const low = rows.slice().sort((a, b) => (a.mastery || 0) - (b.mastery || 0))[0]
    return { topic: low.topic, subject: low.subject || null, why: 'mastery' }
  }
  return null
}

/* ── the builder ─────────────────────────────────────────────────────────── */

/**
 * Turn a budget into a plan: how many of each item, in what order, and the
 * one-line preview the home screen shows before the student commits.
 *
 * Counts are derived from the time share and the per-item estimate, then
 * clamped to what actually exists (you cannot review 24 due cards if 9 are
 * due). Time freed by a clamp flows into questions, because questions are
 * generated on demand and cards are not.
 *
 * INVARIANT, tested: at 15 and 30 minutes the plan always has at least two
 * formats. A session that is only flashcards is Anki; the point of this space
 * is that it is not.
 */
export function buildSession(opts = {}) {
  const {
    minutes = 15,
    cards = [],
    mistakes = [],
    mastery = [],
    now = Date.now(),
    /** formats the caller knows are unavailable right now (grader down, no mic) */
    disabled = [],
  } = opts

  const budget = BUDGETS.includes(minutes) ? minutes : 15
  const alloc = ALLOCATION[budget]
  const off = new Set(disabled)
  const total = budget * 60

  const due = dueCards(cards, now)
  const target = targetTopic(mistakes, mastery)

  // ── fixed-count items first, so their time is known ──
  const written = off.has('written') ? 0 : alloc.written
  const teach   = off.has('teach')   ? 0 : alloc.teach
  const fixed   = written * ESTIMATE.written + teach * ESTIMATE.teach

  // ── proportional items share what is left ──
  const remaining = Math.max(0, total - fixed)
  const share = alloc.cards + alloc.questions || 1
  let cardSecs = remaining * (alloc.cards / share)
  let qSecs    = remaining * (alloc.questions / share)

  let nCards = Math.floor(cardSecs / ESTIMATE.card)
  if (nCards > due.length) {
    // Not enough due. At 15/30 the surplus flows into questions, which are
    // generated on demand. At 5 it does NOT: five minutes is cards only, and a
    // short deck means a short session, not a surprise quiz.
    if (alloc.questions > 0) qSecs += (nCards - due.length) * ESTIMATE.card
    nCards = due.length
  }
  let nQ = off.has('questions') ? 0 : Math.floor(qSecs / ESTIMATE.question)

  // ── the invariant: never one format at 15/30 ──
  if (budget >= 15) {
    const formats = [nCards > 0, nQ > 0, written > 0, teach > 0].filter(Boolean).length
    if (formats < 2) {
      if (nQ === 0 && !off.has('questions')) nQ = Math.max(2, Math.floor(total * 0.4 / ESTIMATE.question))
      else if (nCards === 0 && due.length) nCards = Math.min(due.length, 6)
    }
  }
  // a 5-minute session with nothing due still needs to do something
  if (budget === 5 && nCards === 0 && !off.has('questions')) nQ = 3

  const items = []
  for (let i = 0; i < nCards; i++) items.push({ kind: 'card', card: due[i] })
  for (let i = 0; i < nQ; i++)     items.push({ kind: 'question', topic: target?.topic || null, subject: target?.subject || null })
  if (written) items.push({ kind: 'written', topic: target?.topic || null, subject: target?.subject || null })
  if (teach)   items.push({ kind: 'teach',   topic: target?.topic || null, subject: target?.subject || null })

  const estSecs = nCards * ESTIMATE.card + nQ * ESTIMATE.question + written * ESTIMATE.written + teach * ESTIMATE.teach

  return {
    minutes: budget,
    items,
    counts: { cards: nCards, questions: nQ, written, teach },
    target,
    estimatedMinutes: Math.max(1, Math.round(estSecs / 60)),
    preview: previewRows({ cards: nCards, questions: nQ, written, teach }, target),
  }
}

/** The "KYNO WILL BUILD YOU" rows. Only rows with a count. */
export function previewRows(counts, target) {
  const rows = []
  const min = (s) => Math.max(1, Math.round(s / 60))
  if (counts.cards) rows.push({
    kind: 'card',
    label: `${counts.cards} card${counts.cards === 1 ? '' : 's'} due for review`,
    minutes: min(counts.cards * ESTIMATE.card),
  })
  if (counts.questions) rows.push({
    kind: 'question',
    label: target?.topic
      ? `${counts.questions} question${counts.questions === 1 ? '' : 's'} on ${target.topic}`
      : `${counts.questions} mixed question${counts.questions === 1 ? '' : 's'}`,
    minutes: min(counts.questions * ESTIMATE.question),
  })
  if (counts.written) rows.push({
    kind: 'written',
    label: `${counts.written} written answer, graded`,
    minutes: min(counts.written * ESTIMATE.written),
  })
  if (counts.teach) rows.push({
    kind: 'teach',
    label: `${counts.teach} teach-back`,
    minutes: min(counts.teach * ESTIMATE.teach),
  })
  return rows
}

/**
 * Degraded state: a format failed mid-session. Drop every remaining item of
 * that kind and return the rest. The student sees the session shorten by a
 * couple of minutes, not an error — which is the brief's requirement that
 * they cannot tell the AI layer is struggling.
 */
export function rebuildWithout(items = [], kind, fromIndex = 0) {
  if (!Array.isArray(items)) return []
  return items.filter((it, i) => i < fromIndex || it.kind !== kind)
}

/**
 * The plan asked for N questions; the API returned fewer.
 *
 * /api/quiz/start caps at 15 and a model routinely returns 8 when asked for
 * 9. Without this, item 9 renders "Writing your questions..." forever -- the
 * failure path only covered the fetch failing, not the fetch succeeding short.
 * Keep the first `available` question items; every other kind is untouched.
 */
export function trimQuestions(items = [], available = 0) {
  if (!Array.isArray(items)) return []
  let seen = 0
  return items.filter(it => {
    if (!it || it.kind !== 'question') return true
    seen += 1
    return seen <= Math.max(0, available | 0)
  })
}

/* ── in-session helpers ──────────────────────────────────────────────────── */

/** "11:42" from milliseconds. Never negative. */
export function clock(ms) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

/**
 * The label under each grading button — the REAL next interval, from the
 * scheduler's output, not a placeholder.
 */
export function intervalLabel(days) {
  const d = Number(days)
  if (!Number.isFinite(d) || d <= 0) return '1 min'
  if (d < 1) {
    const h = Math.round(d * 24)
    return h <= 1 ? '1 hr' : `${h} hrs`
  }
  if (d < 1.5) return '1 day'
  if (d < 30) return `${Math.round(d)} days`
  const mo = Math.round(d / 30)
  return mo <= 1 ? '1 month' : `${mo} months`
}

/**
 * "You got this wrong 3 days ago" — or null.
 *
 * Null is the honest answer for a card with no miss on record, and the strip
 * hides. Showing "you got this wrong" to a student who did not is worse than
 * showing nothing.
 */
export function lastMissLine(card, events = [], now = Date.now()) {
  if (!card?.topic || !Array.isArray(events)) return null
  const key = String(card.topic).toLowerCase()
  const misses = events.filter(e =>
    e && e.correct === false && e.topic && String(e.topic).toLowerCase() === key && typeof e.ts === 'number')
  if (!misses.length) return null
  const last = Math.max(...misses.map(e => e.ts))
  const days = Math.floor((now - last) / 86400000)
  if (days <= 0) return 'You got this wrong today'
  if (days === 1) return 'You got this wrong yesterday'
  if (days < 30) return `You got this wrong ${days} days ago`
  return 'You got this wrong last month'
}

/* ── results: movement, not scores ───────────────────────────────────────── */

/**
 * One row per topic touched, before → after mastery.
 *
 * A topic that did not move says so. The brief is explicit: most study apps
 * hide the flat ones; naming them is what routes the student to a different
 * format next time.
 */
export function movementRows(before = [], after = [], touched = []) {
  const idx = (rows) => {
    const m = new Map()
    for (const r of Array.isArray(rows) ? rows : []) {
      if (r && r.topic) m.set(String(r.topic).toLowerCase(), r)
    }
    return m
  }
  const b = idx(before), a = idx(after)
  const topics = Array.from(new Set((touched || []).filter(Boolean).map(t => String(t).toLowerCase())))

  return topics.map(key => {
    const from = Math.round(((b.get(key)?.mastery) ?? 0) * 100)
    const to   = Math.round(((a.get(key)?.mastery) ?? (b.get(key)?.mastery) ?? 0) * 100)
    const delta = to - from
    const display = a.get(key)?.topic || b.get(key)?.topic || key
    return {
      topic: display,
      from, to, delta,
      moved: Math.abs(delta) >= 3,
      label: Math.abs(delta) >= 3 ? `${from}% → ${to}%` : 'no change',
    }
  }).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
}

/**
 * The results headline names the biggest change, and the sub-line counts the
 * weak topics that did and did not improve.
 */
export function resultsHeadline(rows = [], weakTopics = []) {
  const moved = rows.filter(r => r.moved && r.delta > 0)
  const weakKeys = new Set((weakTopics || []).map(t => String(t).toLowerCase()))
  const weakRows = rows.filter(r => weakKeys.has(String(r.topic).toLowerCase()))
  const weakUp = weakRows.filter(r => r.delta > 0).length
  const weakFlat = weakRows.length - weakUp

  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s
  let headline
  if (moved.length) headline = `${cap(moved[0].topic)} moved.`
  else if (rows.length) headline = 'Nothing moved yet.'
  else headline = 'Session done.'

  let sub = ''
  if (weakRows.length) {
    const n = (k) => ['no', 'one', 'two', 'three', 'four', 'five'][k] ?? String(k)
    sub = `${cap(n(weakUp))} of your ${n(weakRows.length)} weak topic${weakRows.length === 1 ? '' : 's'} improved.`
    if (weakFlat) sub += ` ${cap(n(weakFlat))} did not.`
  } else if (!moved.length && rows.length) {
    sub = 'Mastery shifts after a few sessions, not one — come back tomorrow.'
  }
  return { headline, sub }
}

/**
 * XP for a session. Small, flat, and mostly for finishing — the level system
 * already rewards correctness elsewhere, and paying big for volume here would
 * teach students to grind cards instead of attempting the written answer.
 */
export function xpFor(summary = {}) {
  const { cards = 0, questions = 0, correct = 0, written = 0, teach = 0, finished = true } = summary
  let xp = finished ? 20 : 0
  xp += Math.min(cards, 30) * 1
  xp += Math.min(questions, 20) * 2
  xp += Math.min(correct, 20) * 2
  xp += written * 15
  xp += teach * 15
  return xp
}

/** The follow-up card that suggests a different format for a flat topic. */
export function flatTopicNudge(rows = []) {
  const flat = rows.find(r => !r.moved)
  if (!flat) return null
  return {
    topic: flat.topic,
    headline: `${flat.topic.charAt(0).toUpperCase() + flat.topic.slice(1)} did not budge`,
    detail: 'Try teaching it back instead of drilling',
  }
}
