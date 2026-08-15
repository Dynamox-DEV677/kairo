/**
 * Gatekeeping for everything written to the knowledge graph.
 *
 * The live data shows what happens without it: "Ohm's Law" saved six times in
 * two minutes as trivial rearrangements, a concept node called "Ai", 48 of 55
 * events tagged only "General", Trigonometry existing as three separate topics
 * with three different mastery numbers, and chat commands like "no create it in
 * flashcards" stored as if the student had asked a question.
 *
 * All six writers in twin.ts go through these. Pure functions over plain data
 * so the tests exercise the real implementation.
 */

/* ── topics ─────────────────────────────────────────────────────────────── */

/**
 * Aliases seen in the actual event log, plus the obvious short forms students
 * type. Maps to a canonical display name; the syllabus resolver upgrades this
 * to a real topicId where the topic exists in the map.
 */
const ALIASES = {
  trig: 'trigonometry',
  trigo: 'trigonometry',
  trignometry: 'trigonometry',
  trigonometery: 'trigonometry',
  'ohms law': "ohm's law",
  'ohm law': "ohm's law",
  'ohms-law': "ohm's law",
  maths: 'mathematics',
  math: 'mathematics',
  bio: 'biology',
  chem: 'chemistry',
  phy: 'physics',
  'quadratic equation': 'quadratic equations',
  'linear equation': 'linear equations',
  'periodic table': 'periodic classification',
  emi: 'electromagnetic induction',
  ap: 'arithmetic progressions',
}

/**
 * Strings that are not topics at all. These are in the live data as concept
 * nodes and weak topics. "General" is the big one -- 87% of events -- and it
 * carries no information, so treating it as a real subject makes every
 * downstream list useless.
 */
const JUNK = new Set([
  'ai', 'a i', 'general', 'misc', 'other', 'none', 'null', 'undefined',
  'untitled', 'unknown', 'test', 'asdf', 'n a', 'na',
])

/** Trim, collapse, lowercase, strip punctuation noise. Shape only. */
export function normalizeTopicText(s) {
  if (!s) return ''
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[.,;:!?"'`()\[\]]+/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
    .trim()
}

/**
 * A topic string -> a stable canonical form, or null if it is not a topic.
 *
 * Returning null is the important half: "Ai", "General" and a student's typed
 * command must not become nodes. The caller stores them as unclassified or
 * drops them rather than inventing a subject.
 */
export function canonicalTopic(raw) {
  const t = normalizeTopicText(raw)
  if (!t) return null
  if (t.length < 3) return null          // "Ai" and friends
  if (JUNK.has(t)) return null

  const mapped = ALIASES[t] || t

  // A topic that is really a sentence is a mis-capture -- a chat turn or an
  // answer that leaked into the topic field.
  if (mapped.split(' ').length > 8) return null

  return {
    key: mapped,
    display: mapped.replace(/\b\w/g, c => c.toUpperCase()),
  }
}

/* ── chat turn classification ───────────────────────────────────────────── */

const COMMAND_RE = new RegExp([
  '^(no,? )?(pls |please |plz )?',
  '(make|create|add|save|put|generate|build|turn|convert|store)\\b',
].join(''), 'i')

const COMMAND_HINTS = /\b(flash ?cards?|notebook|notes?|summary|quiz|pdf|deck)\b/i
const QUESTION_WORDS = /^(what|why|how|when|where|which|who|whose|explain|define|prove|derive|describe|state|give|tell|can you|is |are |does |do |did |should )/i

/**
 * Is this a real question, a command to the app, or the student's own working?
 *
 * Only 'question' may be stored as a doubt. The live log has
 * "Make Flashcard Abt This" and "No Create It In Flashcards" saved as doubts,
 * which then fed the AI as though the student were confused about flashcards.
 * It also has "R = V X I = 12 X 3 = 36 Ohms" -- a wrong answer -- stored as a
 * doubt, so the app believed the student had ASKED that.
 */
export function classifyChatTurn(text) {
  const s = String(text || '').trim()
  if (!s) return 'empty'
  if (s.length < 3) return 'empty'

  // Working: an equation chain, or an expression that is mostly maths.
  // Checked before commands so "make it 5x" is not misread.
  const eqCount = (s.match(/=/g) || []).length
  const hasDigits = /\d/.test(s)
  if (eqCount >= 1 && hasDigits && s.length < 120) {
    const words = s.split(/\s+/).filter(w => /^[a-z]{3,}$/i.test(w))
    if (words.length <= 4) return 'attempt'
  }

  if (COMMAND_RE.test(s) && (COMMAND_HINTS.test(s) || s.split(/\s+/).length <= 8)) {
    return 'command'
  }

  if (s.includes('?') || QUESTION_WORDS.test(s)) return 'question'

  // Unclear. Not stored as a doubt -- a false doubt is worse than a missing
  // one, because it becomes a permanent "weakness" in the student's profile.
  return 'other'
}

/* ── formula grouping ───────────────────────────────────────────────────── */

/**
 * The variables a formula relates, as a sorted signature.
 *
 * V=IR, V=I×R, R=V/I and I=V/R are the same physical law written four ways.
 * Comparing the expression text treats them as four formulas, which is exactly
 * what filled the Formula Sheet with six Ohm's Law cards. The set of symbols
 * is what actually identifies the relation.
 */
export function formulaSignature(expr) {
  const letters = String(expr || '')
    // Function names first, or their letters become variables.
    .replace(/\b(sin|cos|tan|log|ln|sqrt|exp)\b/gi, ' ')
    .replace(/[0-9.]+/g, ' ')
    .replace(/[^A-Za-zΔθλμπΩ]/g, ' ')

  // Split to individual characters, not whitespace tokens. School formula
  // variables are single symbols, and they get written both ways: "V = I R"
  // tokenises to three, but "V=IR" tokenises to two ("V", "IR") and the two
  // spellings then look like different formulas. Per-character is the only
  // split that treats them the same.
  const vars = new Set(letters.replace(/\s+/g, '').split(''))
  return [...vars].sort().join('|')
}

/**
 * Same formula family, for the same topic?
 * Signature match is the test; the display name is not, because the same law
 * gets typed with different names.
 */
export function isSameFormula(a, b) {
  if (!a || !b) return false
  const sigA = formulaSignature(a.expr)
  const sigB = formulaSignature(b.expr)
  if (!sigA || !sigB) return false
  if (sigA !== sigB) return false
  const ta = canonicalTopic(a.topic)?.key || null
  const tb = canonicalTopic(b.topic)?.key || null
  return ta === tb
}

/* ── generic recency dedupe ─────────────────────────────────────────────── */

export const DEDUPE_WINDOW_MS = 60 * 60 * 1000   // one hour

/**
 * Has an equivalent item been saved for this topic recently?
 *
 * `sameFn` decides equivalence so formulas can compare by signature while
 * cards and concepts compare by normalised text.
 */
export function findRecentDuplicate(existing, candidate, sameFn, now = Date.now(), windowMs = DEDUPE_WINDOW_MS) {
  for (const item of existing || []) {
    if (typeof item?.ts === 'number' && now - item.ts > windowMs) continue
    if (sameFn(item, candidate)) return item
  }
  return null
}

/** Text equivalence for cards and concepts. */
export function sameText(a, b) {
  const norm = (s) => normalizeTopicText(s)
  return !!a && !!b && norm(a) === norm(b) && norm(a).length > 0
}
