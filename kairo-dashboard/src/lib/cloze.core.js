/**
 * Cloze ("fill in the blank") card generation — deterministic, no AI.
 *
 * Turns a passage (a solved answer, a saved note) into fill-the-gap cards: one
 * key term per sentence is blanked, front = the sentence with a blank, back =
 * the term. Because it's rule-based it works offline, costs nothing, and can't
 * fabricate — and crucially it SKIPS any sentence with no confident term to
 * blank rather than forcing an awkward "_____ objects stay at rest" card.
 */

const STOP = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'is',
  'are', 'was', 'were', 'be', 'been', 'this', 'that', 'these', 'those', 'it', 'its',
  'as', 'by', 'with', 'from', 'into', 'than', 'then', 'which', 'when', 'where', 'while',
  'they', 'their', 'them', 'we', 'you', 'he', 'she', 'his', 'her', 'so', 'if', 'not',
  'can', 'will', 'each', 'has', 'have', 'more', 'most', 'some', 'also', 'such', 'because',
])

const BLANK = '_____'

function sentences(text) {
  return String(text || '')
    // strip markdown headings, bullets, bold, math delimiters
    .replace(/[#*`>]/g, ' ')
    .replace(/\$[^$]*\$/g, ' ')       // don't blank inside math
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(Boolean)
}

/**
 * Best term to blank in a sentence, or null if none is confident.
 * Priority: a number (with optional unit) → a mid-sentence Capitalised term →
 * the longest content word. Never the first word (often "The"/"A").
 */
export function pickBlank(sentence) {
  const words = sentence.split(/\s+/)
  if (words.length < 6 || words.length > 34) return null

  // 1) a number, optionally with a unit or exponent — high-value recall.
  // Compound units (m/s, m/s²) must be matched whole and BEFORE bare "m",
  // or "9.8 m/s" blanks to just "9.8 m".
  const UNIT = '(?:m\\/s²|m\\/s|km|cm|mm|kg|mol|Hz|°C|N|J|W|V|A|K|g|m|s|%)'
  const num = sentence.match(new RegExp(`\\b\\d[\\d,.]*(?:\\s?${UNIT})?`))
  if (num && num[0].length >= 1 && !/^\d{1,2}\.$/.test(num[0])) return num[0].trim()

  // 2) a Capitalised term not at the start (proper noun / named concept).
  for (let i = 1; i < words.length; i++) {
    const w = words[i].replace(/[^A-Za-z-]/g, '')
    if (/^[A-Z][a-z]{2,}/.test(w) && !STOP.has(w.toLowerCase())) return w
  }

  // 3) the longest content word ≥ 6 chars.
  let best = null
  for (const raw of words) {
    const w = raw.replace(/[^A-Za-z-]/g, '')
    if (w.length >= 6 && !STOP.has(w.toLowerCase()) && (!best || w.length > best.length)) best = w
  }
  return best
}

const MAX_WORDS = 34

// Words a textbook sentence commonly starts with. Used only to spot where a
// sentence begins after a heading that the PDF ran straight into it.
const STARTERS = new Set([
  'The', 'A', 'An', 'In', 'On', 'At', 'We', 'You', 'It', 'This', 'These', 'That', 'Those',
  'What', 'How', 'Why', 'When', 'Where', 'Which', 'Who', 'Have', 'Has', 'Do', 'Does', 'Did',
  'Can', 'Many', 'Most', 'Some', 'All', 'Let', 'If', 'As', 'For', 'Our', 'Your', 'There',
  'Here', 'Each', 'Every', 'Such', 'Look', 'Think', 'Imagine', 'Suppose',
])

/**
 * Drop a heading the PDF glued onto the front of a sentence.
 *
 * A textbook page's text comes out as one run, so "Exploring Mixtures and
 * their Separation Chapter 5 Have you ever wondered how sugar is made from
 * sugarcane?" is a single "sentence" and the card carried the chapter title.
 * A heading ends where a common sentence-opener follows a capitalised word or
 * a number with no punctuation between them - "...Chapter 5 | Have you".
 */
export function dropLeadingHeading(sentence) {
  const words = String(sentence || '').split(/\s+/).filter(Boolean)
  let cut = 0
  for (let i = 1; i < Math.min(words.length - 4, 14); i++) {
    const prev = words[i - 1]
    if (STARTERS.has(words[i]) && /^[A-Z0-9]/.test(prev) && !/[.!?:;,]$/.test(prev)) cut = i
  }
  return cut ? words.slice(cut).join(' ') : String(sentence || '').trim()
}

/**
 * A textbook sentence longer than pickBlank accepts, cut at its own commas,
 * colons and semicolons into clauses that fit.
 *
 * Without this a long sentence produced no card at all - and a paragraph
 * selected from a PDF often has no full stop until the very end, so "Make
 * flashcards" on a whole paragraph said the selection was too short. Clauses
 * are regrouped so none falls under six words; a run with no punctuation at
 * all is cut every twenty words.
 */
export function clauses(sentence) {
  const s = String(sentence || '').trim()
  const count = (t) => t.split(/\s+/).filter(Boolean).length
  if (count(s) <= MAX_WORDS) return s ? [s] : []

  const pieces = []
  for (const part of s.split(/(?<=[,;:])\s+/)) {
    if (count(part) <= MAX_WORDS) { pieces.push(part); continue }
    const words = part.split(/\s+/)
    for (let i = 0; i < words.length; i += 20) pieces.push(words.slice(i, i + 20).join(' '))
  }

  const out = []
  let cur = ''
  for (const p of pieces) {
    const next = cur ? `${cur} ${p}` : p
    if (cur && count(next) > MAX_WORDS) { out.push(cur); cur = p } else cur = next
    if (count(cur) >= 12) { out.push(cur); cur = '' }
  }
  if (cur) {
    if (out.length && count(cur) < 6 && count(`${out[out.length - 1]} ${cur}`) <= MAX_WORDS) out[out.length - 1] += ` ${cur}`
    else out.push(cur)
  }
  return out
}

/** Replace the first whole-word occurrence of `term` with a blank. */
function maskFirst(sentence, term) {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return sentence.replace(new RegExp(`(^|\\W)${esc}(\\W|$)`), `$1${BLANK}$2`)
}

/**
 * Cloze cards from a passage. front = sentence with a blank, back = the term.
 * Deduped by the masked front; capped by opts.max (default 8).
 */
export function buildClozeCards(text, { max = 8 } = {}) {
  const out = []
  const seenFront = new Set()
  const seenTerm = new Set()

  for (const s of sentences(text).map(dropLeadingHeading).flatMap(clauses)) {
    if (out.length >= max) break
    const term = pickBlank(s)
    if (!term || term.length < 3) continue
    // Don't blank the same term twice — a deck of identical answers is useless.
    const tk = term.toLowerCase()
    if (seenTerm.has(tk)) continue
    const front = maskFirst(s, term)
    if (!front.includes(BLANK) || seenFront.has(front)) continue
    seenFront.add(front)
    seenTerm.add(tk)
    out.push({ front, back: term })
  }
  return out
}

/**
 * Cards for a key word, from the sentences around it.
 *
 * Selecting one word in the Reader - "photosynthesis" - and pressing Make
 * flashcards used to say the selection was too short, because a single word
 * has no sentence to blank. The page it sits on does. This finds the
 * sentences on that page that use the term and blanks the TERM in each, so
 * the card asks exactly what the student pointed at.
 *
 * Returns [] rather than inventing a definition when the page never uses the
 * word in a usable sentence.
 */
export function clozeForTerm(term, context, { max = 2 } = {}) {
  const t = String(term || '').replace(/\s+/g, ' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim()
  if (t.length < 2 || t.split(' ').length > 6) return []
  const pattern = t.split(' ').map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${pattern})(?=$|[^\\p{L}\\p{N}])`, 'iu')

  const out = []
  const seen = new Set()
  for (const s of sentences(context).map(dropLeadingHeading).flatMap(clauses)) {
    if (out.length >= max) break
    const n = s.split(/\s+/).length
    if (n < 5 || n > 40) continue
    const m = s.match(re)
    if (!m) continue
    const front = s.replace(re, `$1${BLANK}`)
    // The rest of the sentence has to carry the question.
    if (front.replace(BLANK, ' ').split(/\s+/).filter(Boolean).length < 4) continue
    if (seen.has(front)) continue
    seen.add(front)
    out.push({ front, back: m[2] })
  }
  return out
}
