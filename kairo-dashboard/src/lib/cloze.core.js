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

  for (const s of sentences(text)) {
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
