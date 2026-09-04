/**
 * Notes — the pure half.
 *
 * Nothing is stored without a return date. Notes in study apps are graveyards:
 * saving feels productive and nothing is reopened. So every saved item makes
 * flashcards, the cards enter the spaced-repetition schedule, and the note
 * shows when it comes back. A note you never see again is not a note.
 *
 * Everything here is a function of stored rows -- the notebook, the twin's
 * flashcards and formulas, the doubt log, the mistake records. No AI. The card
 * generator is the existing cloze builder, which is deterministic, so even the
 * "cards from a new note" path works offline.
 */

import { buildClozeCards } from './cloze.core.js'

const DAY = 86_400_000

/* ── provenance ───────────────────────────────────────────────────────────── */

/**
 * "From a doubt", "Written by you", "From teach back". Provenance is what makes
 * an old note make sense six weeks later -- always stored, always shown.
 */
export function provenanceLabel(source, kind) {
  const s = String(source || '').toLowerCase()
  if (s.includes('doubt') || s.includes('solver') || s.includes('chat')) return 'From a doubt'
  if (s.includes('teach')) return 'From teach back'
  if (s.includes('practice') || s.includes('grader') || s.includes('written')) return 'From a written answer'
  if (s.includes('camera') || s.includes('photo')) return 'From a photo'
  if (s.includes('plan')) return 'From your plan'
  if (kind === 'doubt') return 'From a doubt'
  return 'Written by you'
}

/** "Saved 12 Aug from a doubt you asked" */
export function originLine(entry) {
  if (!entry) return ''
  let when = ''
  try { when = new Date(entry.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) } catch { /* ignore */ }
  const p = provenanceLabel(entry.source, entry.kind)
  const tail = p === 'From a doubt' ? 'from a doubt you asked'
    : p === 'From teach back' ? 'from a teach-back you did'
    : p === 'From a written answer' ? 'from an answer you wrote'
    : p === 'From a photo' ? 'from a photo you took'
    : p === 'From your plan' ? 'from your plan'
    : 'by you'
  return `Saved ${when} ${tail}`
}

/* ── return dates ─────────────────────────────────────────────────────────── */

/** "due now" / "back tomorrow" / "back in 2 days" / "back in 3 weeks" */
export function returnLabel(dueAt, now = Date.now()) {
  if (typeof dueAt !== 'number') return null
  const days = Math.ceil((dueAt - now) / DAY)
  if (days <= 0) return 'due now'
  if (days === 1) return 'back tomorrow'
  if (days < 14) return `back in ${days} days`
  const weeks = Math.round(days / 7)
  return `back in ${weeks} week${weeks === 1 ? '' : 's'}`
}

/* ── the note → card index ────────────────────────────────────────────────── */

/**
 * noteId -> [flashcardId]. Kept as a plain object so it round-trips storage.
 * The flashcards themselves live in the twin; this only remembers which note
 * they came from, so a note can say "2 cards made from it".
 */
export function attachCards(index = {}, noteId, cardIds = []) {
  if (!noteId) return index || {}
  const cur = Array.isArray(index?.[noteId]) ? index[noteId] : []
  const merged = Array.from(new Set([...cur, ...cardIds.filter(Boolean)]))
  return { ...(index || {}), [noteId]: merged }
}

/**
 * What a note's cards have done since it was saved: how many, when the next
 * comes back, and right/total from flashcard_review events.
 */
export function noteStats(noteId, index = {}, flashcards = [], events = [], now = Date.now()) {
  const ids = new Set(Array.isArray(index?.[noteId]) ? index[noteId] : [])
  const cards = (flashcards || []).filter(c => c && ids.has(c.id))
  const nextDue = cards.length ? Math.min(...cards.map(c => c.dueAt || Infinity)) : null
  // reviews are keyed by topic/subject in the twin, not card id; count reviews
  // whose (topic) matches one of this note's cards, since a save is one topic
  const topics = new Set(cards.map(c => String(c.topic || '').toLowerCase()).filter(Boolean))
  const savedAt = cards.length ? Math.min(...cards.map(c => c.ts || now)) : now
  const reviews = (events || []).filter(e =>
    e && e.type === 'flashcard_review' && e.ts >= savedAt && topics.has(String(e.topic || '').toLowerCase()))
  const right = reviews.filter(e => e.correct === true).length
  return {
    cards: cards.length,
    nextDue,
    nextLabel: nextDue != null && Number.isFinite(nextDue) ? returnLabel(nextDue, now) : null,
    right,
    total: reviews.length,
  }
}

/* ── cards from a note ────────────────────────────────────────────────────── */

/**
 * Cards for a freshly saved note. Deterministic (cloze), so it works offline
 * and never needs the "cards pending" state -- the brief's fallback for an AI
 * outage is simply how this always works. A title becomes a card too, so even
 * a one-line note gets at least one return date.
 */
export function cardsForNote(title, content, { max = 4 } = {}) {
  const out = []
  const seen = new Set()
  const push = (front, back) => {
    const f = String(front || '').trim(), b = String(back || '').trim()
    if (!f || !b || seen.has(f.toLowerCase())) return
    seen.add(f.toLowerCase()); out.push({ front: f, back: b })
  }
  for (const c of buildClozeCards(content, { max })) push(c.front, c.back)
  if (out.length < max && title && content) {
    const firstSentence = String(content).replace(/[#*_`$]/g, ' ').split(/(?<=[.!?])\s+/)[0]?.trim()
    if (firstSentence && firstSentence.length >= 12 && firstSentence.length <= 220) push(`${String(title).trim()} — in one line?`, firstSentence)
  }
  return out.slice(0, max)
}

/* ── unified search ───────────────────────────────────────────────────────── */

function norm(s) {
  return String(s || '').toLowerCase()
    .replace(/½/g, ' half ').replace(/²/g, ' squared ').replace(/√/g, ' root ')
    .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokens(s) { return norm(s).split(' ').filter(t => t.length > 1) }

/**
 * One index across notes, formulas and doubts. "half gt squared" should find
 * the note, the formula and the doubt. Scored by token overlap; ties break
 * newest first.
 */
export function unifiedSearch(query, { notes = [], formulas = [], doubts = [] } = {}, { max = 20 } = {}) {
  const q = tokens(query)
  if (!q.length) return []
  const rows = []
  const score = (...fields) => {
    const hay = tokens(fields.join(' '))
    const set = new Set(hay)
    let hit = 0
    for (const t of q) if (set.has(t) || hay.some(h => h.startsWith(t) || t.startsWith(h))) hit++
    return hit / q.length
  }
  for (const n of notes || []) {
    const s = score(n.title, n.content, n.subject)
    if (s > 0) rows.push({ kind: 'note', id: n.id, title: n.title, sub: provenanceLabel(n.source, n.kind), ts: n.updatedAt || n.createdAt || 0, score: s })
  }
  for (const f of formulas || []) {
    const s = score(f.name, f.expr, f.when, f.chapterName, f.topic)
    if (s > 0) rows.push({ kind: 'formula', id: f.id, title: f.name || f.expr, sub: f.expr, ts: f.ts || 0, score: s })
  }
  for (const d of doubts || []) {
    const s = score(d.question, d.topic, d.subject)
    if (s > 0) rows.push({ kind: 'doubt', id: d.id, title: d.question, sub: 'A doubt you asked', ts: d.ts || 0, score: s })
  }
  return rows.sort((a, b) => b.score - a.score || b.ts - a.ts).slice(0, max)
}

/* ── coming back ──────────────────────────────────────────────────────────── */

/** "18 cards due today / From 6 notes you saved" -- or null. Never a zero. */
export function dueSummary(flashcards = [], index = {}, now = Date.now()) {
  const due = (flashcards || []).filter(c => c && typeof c.dueAt === 'number' && c.dueAt <= now)
  if (!due.length) return null
  const owners = new Map()
  for (const [noteId, ids] of Object.entries(index || {})) for (const id of ids || []) owners.set(id, noteId)
  const notes = new Set(due.map(c => owners.get(c.id)).filter(Boolean))
  return {
    count: due.length,
    notes: notes.size,
    headline: `${due.length} card${due.length === 1 ? '' : 's'} due today`,
    sub: notes.size ? `From ${notes.size} note${notes.size === 1 ? '' : 's'} you saved` : 'From your flashcards',
    ids: due.map(c => c.id),
  }
}

/* ── trigger words ────────────────────────────────────────────────────────── */

/** Words a student has to notice in a physics or maths question. */
export const TRIGGERS = [
  'dropped', 'from rest', 'at rest', 'released', 'starts from rest', 'comes to rest', 'uniform', 'constant',
  'vertically upward', 'vertically downward', 'thrown up', 'maximum height', 'just before', 'negligible',
  'in parallel', 'in series', 'perpendicular', 'parallel', 'right angle', 'equal', 'twice', 'half', 'doubled',
  'inverted', 'erect', 'virtual', 'real image', 'converging', 'diverging',
]

/** Split prose into [{text, bold}] so the UI can bold the triggers. */
export function boldTriggers(text) {
  const src = String(text || '')
  if (!src) return []
  const re = new RegExp(`\\b(${TRIGGERS.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi')
  const out = []
  let last = 0, m
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ text: src.slice(last, m.index), bold: false })
    out.push({ text: m[0], bold: true })
    last = m.index + m[0].length
  }
  if (last < src.length) out.push({ text: src.slice(last), bold: false })
  return out
}

/**
 * Split a note body into segments: prose paragraphs, equations (their own mono
 * block) and headings -- a `#` line such as the "## 1. Write down what you
 * know" steps a saved doubt carries, or a whole-line **bold** label. A blank
 * line ends a paragraph; a bullet stands on its own line. Without this the
 * step title used to run straight into the sentence after it.
 */
export function splitBody(content) {
  const lines = String(content || '').split('\n')
  const segs = []
  let open = false   // is the last segment a paragraph still accepting lines?
  for (const raw of lines) {
    const t = raw.trim()
    if (!t) { open = false; continue }
    const heading = /^#{1,6}\s+/.test(t) || /^\*\*[^*]+\*\*:?$/.test(t)
    const bullet = !heading && /^[-*•]\s+/.test(t)
    const isEq = !heading && !bullet && (/^\$\$?.*\$\$?$/.test(t) || (/[=≈→]/.test(t) && /\d|[a-z]\s*=/.test(t) && t.length < 120 && !/[.!?]$/.test(t)))
    if (heading) { segs.push({ kind: 'heading', text: t.replace(/^#{1,6}\s+/, '').replace(/\*\*/g, '').replace(/:$/, '').trim() }); open = false }
    else if (isEq) { segs.push({ kind: 'eq', text: t.replace(/^\$\$?|\$\$?$/g, '').trim() }); open = false }
    else if (bullet) { segs.push({ kind: 'prose', text: '• ' + t.replace(/^[-*•]\s+/, '') }); open = false }
    else if (open) segs[segs.length - 1].text += ' ' + t
    else { segs.push({ kind: 'prose', text: t }); open = true }
  }
  return segs
}

/* ── the formula sheet ────────────────────────────────────────────────────── */

/**
 * Which sheet formulas carry a flag, from the student's own mistake records.
 * A flag says how many marks they have lost to the habit that formula's line
 * fixes -- and is OMITTED entirely with no matching pattern. Never invented.
 *
 * A record counts only for the formulas of the chapter it happened in
 * (`chapter`, a syllabus-graph id the page resolves from the record's topic):
 * two skipped formula lines in Electricity flag Ohm's law, not the quadratic
 * formula. A record we cannot place is pinned on nothing -- we do not know
 * which line it was about, so the sheet says nothing.
 */
export function formulaFlags(formulas = [], records = []) {
  const byKey = new Map()   // `${chapter}|${signature}` → { count, marks }
  for (const r of records || []) {
    if (!r?.signature || !r.chapter) continue
    const key = `${r.chapter}|${r.signature}`
    const cur = byKey.get(key) || { count: 0, marks: 0 }
    cur.count += 1; cur.marks += r.marksLost || 0
    byKey.set(key, cur)
  }
  const out = new Map()
  for (const f of formulas || []) {
    let marks = 0, count = 0, sig = null
    for (const s of f.signatures || []) {
      const hit = byKey.get(`${f.chapter}|${s}`)
      if (hit && hit.count >= 2 && hit.marks > marks) { marks = hit.marks; count = hit.count; sig = s }
    }
    if (sig) {
      const verb = sig === 'formula-not-written' ? 'by not writing the formula line before substituting'
        : sig === 'wrong-formula-picked' ? 'by reaching for the wrong formula'
        : sig === 'sign-flip' ? 'to sign errors'
        : sig === 'unit-conversion' ? 'to mixed units'
        : sig === 'omits-units' ? 'by leaving the unit off the answer'
        : sig === 'skipped-step' ? 'by jumping straight to the answer'
        : sig === 'arithmetic-slip' ? 'to arithmetic slips'
        : sig === 'copy-error' ? 'by copying a value wrong'
        : `to the habit "${sig.replace(/-/g, ' ')}"`
      const where = f.chapterName ? ` in ${String(f.chapterName).replace(/ — .*$/, '')}` : ''
      out.set(f.id, { signature: sig, marks, count, line: `You have lost ${marks} mark${marks === 1 ? '' : 's'}${where} ${verb}` })
    }
  }
  return out
}

/** Chapter chips for the sheet, biggest first. */
export function chapterChips(formulas = []) {
  const m = new Map()
  for (const f of formulas || []) {
    if (!f?.chapterName) continue
    m.set(f.chapterName, (m.get(f.chapterName) || 0) + 1)
  }
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/* ── watch & listen ───────────────────────────────────────────────────────── */

/**
 * Six to eight clips, chosen from the topics the student is weak on, and then
 * the list ENDS. Never paginate, never autoplay the next one. Each item says
 * why it is here, tied to a Performance error type.
 */
export function pickClips(deck = [], weak = [], { max = 6, patterns = [] } = {}) {
  const weakKeys = (weak || []).map(w => String(w.topic || w).toLowerCase()).filter(Boolean)
  const bySigType = new Map()
  for (const p of patterns || []) for (const o of p.occurrences || []) if (o.topic) bySigType.set(String(o.topic).toLowerCase(), p.type)

  const scored = (deck || []).filter(c => c && c.front).map(c => {
    const t = String(c.topic || '').toLowerCase()
    const wi = weakKeys.findIndex(k => k && (t.includes(k) || k.includes(t)))
    const weakRank = wi >= 0 ? wi : 99
    const w = (weak || [])[wi]
    let why, type
    if (wi >= 0) {
      const marks = w && typeof w === 'object' ? w.marksLost : null
      type = bySigType.get(t) || (w && typeof w === 'object' && w.dominant) || 'conceptual'
      why = wi === 0 ? `Your weakest topic${marks ? ` · ${marks} marks lost to it` : ''}`
        : type === 'careless' ? 'You slip on this, you do not misunderstand it'
        : w && typeof w === 'object' && w.recent3w >= 3 ? 'Drilling has not moved this one'
        : `A weak topic${marks ? ` · ${marks} marks lost to it` : ''}`
    } else {
      type = 'conceptual'
      why = c.due ? 'Due for review today' : 'From your own cards'
    }
    return { ...c, why, type, weakRank }
  })
  scored.sort((a, b) => a.weakRank - b.weakRank || (b.due ? 1 : 0) - (a.due ? 1 : 0) || (b.ts || 0) - (a.ts || 0))
  const items = scored.slice(0, Math.max(6, Math.min(8, max)))
  const general = !weakKeys.length
  return { items, general, totalMinutes: Math.max(1, Math.round(items.length * 3)) }
}

/* ── writing ──────────────────────────────────────────────────────────────── */

/** "52 words · about right for 5 marks" */
export function wordJudgement(text, marks = 5) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length
  // About a dozen words per mark, floor twenty: a 5-mark answer at ~60 words is
  // "about right" -- the marks are in the points, not the length.
  const target = Math.max(20, marks * 12)
  let verdict
  if (!words) verdict = `aim for about ${target} words for ${marks} mark${marks === 1 ? '' : 's'}`
  else if (words < target * 0.55) verdict = `short for ${marks} marks — the scheme usually wants more than this`
  else if (words > target * 1.8) verdict = `long for ${marks} marks — the marks are in the points, not the length`
  else verdict = `about right for ${marks} mark${marks === 1 ? '' : 's'}`
  return { words, target, verdict, line: `${words} word${words === 1 ? '' : 's'} · ${verdict}` }
}

/**
 * Which scheme requirements the text already covers. Keyword presence, run on
 * pause not on every keystroke. Kyno shows what the scheme wants -- it never
 * writes the sentence.
 */
export function schemeCheck(text, requirements = []) {
  const hay = norm(text)
  const rows = (requirements || []).map(r => {
    const keys = (r.keywords || []).map(norm).filter(Boolean)
    const present = keys.length ? keys.some(k => hay.includes(k)) : false
    return { ...r, present }
  })
  const have = rows.filter(r => r.present).reduce((s, r) => s + (r.marks || 1), 0)
  const total = rows.reduce((s, r) => s + (r.marks || 1), 0)
  return { rows, have, total, line: `${have} of ${total}` }
}
