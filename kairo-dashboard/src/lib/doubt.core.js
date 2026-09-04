/**
 * Doubt Solving — the pure half.
 *
 * Everything here is a function of data the app already holds: the solver's
 * plan, the twin's doubt log, the mistake rows. No React, no fetch, no
 * storage. That is what lets node --test run it against real solver output
 * instead of a mock.
 *
 * The interesting problem is splitSteps(): the solver returns
 * `textExplanation` as markdown prose, and the answer screen reveals one step
 * at a time. Something has to turn one into the other, and it has to degrade
 * honestly when the prose has no steps in it at all.
 */

/* ── time ─────────────────────────────────────────────────────────────────── */

/**
 * "3m ago" / "2h ago" / "yesterday" / "12 Mar".
 *
 * Deliberately coarse. A doubt from 40 minutes ago and one from 45 are the
 * same thing to a student deciding which to resume.
 */
export function relativeTime(ts, now = Date.now()) {
  if (!ts || typeof ts !== 'number') return ''
  const s = Math.max(0, Math.floor((now - ts) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  try {
    return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  } catch {
    return `${d}d ago`
  }
}

/* ── the context chip ─────────────────────────────────────────────────────── */

/**
 * "Class 10 · CBSE · Physics" — and every piece is optional.
 *
 * A student who signed up without a board still gets a usable chip rather
 * than "undefined · undefined". The subject is the last one they solved in,
 * not a guess.
 */
export function contextLabel(profile = {}, subject = '') {
  const parts = []
  const cls = profile?.cls ?? profile?.class_level ?? profile?.className
  if (cls) {
    const n = String(cls).replace(/^class\s*/i, '').trim()
    if (n) parts.push(`Class ${n}`)
  }
  const board = profile?.board ?? profile?.board_name
  if (board) parts.push(String(board).trim())
  if (subject) parts.push(String(subject).trim())
  return parts.join(' · ')
}

/** Is the chip carrying enough to actually change an answer? */
export function contextIsUseful(profile = {}, subject = '') {
  return Boolean((profile?.cls || profile?.board) && true) || Boolean(subject)
}

/* ── step splitting ───────────────────────────────────────────────────────── */

/**
 * Does this line carry the working rather than the explanation?
 *
 * Three signals, in order of how much they mean:
 *   - a display-math block ($$...$$) is unambiguous
 *   - inline math ($...$) covering most of the line
 *   - an equals sign with something either side, which is how most of the
 *     solver's arithmetic actually arrives
 *
 * Prose containing "=" in passing (rare) costs a line in the wrong bucket,
 * which is a cosmetic error, not a wrong answer.
 */
export function looksLikeWorking(line) {
  const t = String(line || '').trim()
  if (!t) return false
  if (/^\$\$.*\$\$$/.test(t)) return true
  if (/^\$.*\$$/.test(t)) return true
  if (/[=≈⇒→]/.test(t) && /\d/.test(t) && t.length < 160) return true
  return false
}

const HEADING = /^#{2,4}\s+(.+?)\s*$/
const NUMBERED = /^(?:\*\*)?(?:step\s*)?(\d{1,2})[).:]\s*(?:\*\*)?\s*(.+?)(?:\*\*)?\s*$/i

/** Strip markdown emphasis so a title reads as a title. */
function cleanTitle(s) {
  return String(s || '')
    .replace(/\*\*/g, '')
    .replace(/^#+\s*/, '')
    .replace(/^step\s*\d+\s*[:.)-]?\s*/i, '')
    .replace(/[:：]\s*$/, '')
    .trim()
}

/**
 * Turn one block of lines into a step.
 *
 * `working` gets the equations, `why` gets the plain-language reasoning. The
 * split matters: the answer screen renders working in mono and why in prose,
 * and putting an equation in the prose slot makes it unreadable on a phone.
 */
function buildStep(title, lines) {
  const working = []
  const why = []
  for (const raw of lines) {
    const t = String(raw).trim()
    if (!t) continue
    if (looksLikeWorking(t)) working.push(t)
    else why.push(t)
  }
  return {
    title: cleanTitle(title) || 'Step',
    working: working.join('\n').trim(),
    why: why.join(' ').replace(/\s+/g, ' ').trim(),
  }
}

/**
 * Split a solver explanation into revealable steps.
 *
 * Order of preference:
 *   1. A `steps` array on the plan — once the backend returns structured
 *      steps this is the only path that runs, and the rest is dead weight we
 *      keep for cached plans generated before that change.
 *   2. Markdown ## headings.
 *   3. "1." / "Step 1:" numbered lines.
 *   4. Nothing — one step holding the whole answer.
 *
 * Case 4 is not a failure. An answer that genuinely has one step should be
 * one step, and inventing four out of a paragraph would be lying about the
 * structure of the maths.
 */
export function splitSteps(plan) {
  if (!plan) return []

  // 1. already structured
  if (Array.isArray(plan.steps) && plan.steps.length) {
    return plan.steps
      .filter(s => s && (s.title || s.working || s.why))
      .map(s => ({
        title: cleanTitle(s.title) || 'Step',
        working: String(s.working || '').trim(),
        why: String(s.why || '').trim(),
      }))
  }

  const text = String(plan.textExplanation || plan.text || '').trim()
  if (!text) return []

  const lines = text.split('\n')

  // 2. headings
  const headed = []
  let cur = null
  for (const line of lines) {
    const m = line.match(HEADING)
    if (m) {
      if (cur) headed.push(cur)
      cur = { title: m[1], body: [] }
    } else if (cur) {
      cur.body.push(line)
    }
  }
  if (cur) headed.push(cur)
  if (headed.length >= 2) return headed.map(h => buildStep(h.title, h.body))

  // 3. numbered
  const numbered = []
  cur = null
  for (const line of lines) {
    const m = line.match(NUMBERED)
    if (m) {
      if (cur) numbered.push(cur)
      cur = { title: m[2], body: [] }
    } else if (cur) {
      cur.body.push(line)
    }
  }
  if (cur) numbered.push(cur)
  if (numbered.length >= 2) return numbered.map(n => buildStep(n.title, n.body))

  // 4. one step
  return [buildStep('The answer', lines)]
}

/* ── the weakness suggestion ──────────────────────────────────────────────── */

const WEEK = 7 * 24 * 60 * 60 * 1000

/**
 * The one suggestion card on the entry screen, or null.
 *
 * Null is a real answer and the screen must handle it: a student with no
 * mistake history has nothing to be nudged about, and inventing a weakness
 * for them would be the app being confidently wrong about a person it has
 * never seen work.
 *
 * Requires at least two wrong answers in the last week. One mistake is a bad
 * day, not a weak topic.
 */
/**
 * Topics are stored lowercase — normalizeTopic() in twin.ts lowercases every
 * one on the way in, so "Vectors" and "vectors" cannot become two weaknesses.
 * Correct for storage, wrong at the start of a sentence: the card read
 * "vectors keeps tripping you up".
 *
 * First letter only. Title-casing the whole string would turn "pH" into "Ph"
 * and "DNA" into "Dna".
 */
export function sentenceCase(s) {
  const t = String(s || '').trim()
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function weaknessSuggestion(mistakes = [], now = Date.now()) {
  if (!Array.isArray(mistakes) || !mistakes.length) return null

  const recent = mistakes.filter(m =>
    m && m.topic && typeof m.lastAt === 'number' && now - m.lastAt < WEEK && (m.count || 0) >= 2)

  if (!recent.length) return null

  const top = recent.slice().sort((a, b) => (b.severity || 0) - (a.severity || 0))[0]
  const n = top.count || 2
  return {
    topic: top.topic,
    subject: top.subject || '',
    count: n,
    headline: `${sentenceCase(top.topic)} keeps tripping you up`,
    detail: `${n} wrong this week — ask one now`,
    prompt: `Explain ${top.topic} to me from the start, and give me one practice question on it.`,
  }
}

/**
 * The closing line in chat that references their own history — the thing a
 * generic chatbot cannot say.
 *
 * Returns null unless the topic genuinely appears in their mistakes. A line
 * like "you've struggled with this before" aimed at someone who has not is
 * both false and discouraging, which is the exact opposite of the point.
 */
export function ownMistakeLine(topic, mistakes = [], now = Date.now()) {
  if (!topic || !Array.isArray(mistakes)) return null
  const key = String(topic).toLowerCase().trim()
  if (!key) return null

  const hit = mistakes.find(m =>
    m && m.topic && (
      String(m.topic).toLowerCase() === key ||
      String(m.topic).toLowerCase().includes(key) ||
      key.includes(String(m.topic).toLowerCase())
    ))
  if (!hit || (hit.count || 0) < 2) return null

  const days = Math.floor((now - (hit.lastAt || now)) / 86400000)
  const when = days <= 31 ? 'this month' : 'before'
  return `You've slipped on ${hit.topic} ${hit.count} times ${when} — worth slowing down here.`
}

/* ── recents ──────────────────────────────────────────────────────────────── */

/**
 * The "pick up where you left" cards.
 *
 * Only doubts with a question survive; a row with no question text renders as
 * an empty tappable card, which looks like a bug to the student.
 */
export function recentDoubtCards(doubts = [], limit = 2, now = Date.now()) {
  if (!Array.isArray(doubts)) return []
  return doubts
    .filter(d => d && typeof d.question === 'string' && d.question.trim())
    .slice(0, limit)
    .map(d => ({
      id: d.id,
      question: d.question.trim(),
      subject: d.subject || d.topic || '',
      when: relativeTime(d.ts, now),
      meta: [d.subject || d.topic, relativeTime(d.ts, now)].filter(Boolean).join(' · '),
      saved: Boolean(d.answer),
    }))
}
