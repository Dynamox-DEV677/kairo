/**
 * Performance — the pure half.
 *
 * Organise around ERROR PATTERNS, not chapters. A student does not "get
 * vectors wrong"; they drop the ½ when substituting, or never write units.
 * Naming the repeating error is the product, and it needs months of THIS
 * student's history -- which is exactly what the twin event log is.
 *
 * SOURCE OF TRUTH IS THE EVENT LOG. There is no second mistake table to keep
 * in sync. Every wrong quiz_answered, every 'mistake' event, every graded
 * written answer is turned into a mistake record HERE, by a deterministic
 * classifier. That is the "backfill pass" the brief asks for: it runs over
 * old rows on every load, needs no AI, and cannot drift from the source.
 *
 * Everything on the patterns, impact and topics screens is computed here.
 * Only the diagnosis prose is generated, elsewhere, and the screens render
 * without it.
 */

/* ── taxonomy ────────────────────────────────────────────────────────────── */

export const TYPES = ['conceptual', 'formula', 'calculation', 'careless', 'incomplete']

/** The plain-language gloss that teaches the taxonomy while showing the data. */
export const TYPE_GLOSS = {
  conceptual:  'you did not know it',
  formula:     'knew it, or picked the wrong one, and did not write it',
  calculation: 'the arithmetic or algebra slipped',
  careless:    'units, signs, copying',
  incomplete:  'ran out of time or did not attempt',
}

/**
 * Controlled vocabulary. A signature is a stable string; this map gives each
 * one a plain-language name, its type, and a fix small enough to actually
 * adopt. "Be more careful" is not a fix. "Write the substitution on its own
 * line" is a habit a person can pick up on Tuesday.
 */
export const SIGNATURES = {
  'drops-half-in-suvat': {
    type: 'calculation',
    name: 'Dropping the ½ in s = ut + ½at²',
    fix: 'Write the substitution on its own line before you multiply anything.',
    code: 's = ut + ½at²\ns = 0 + ½ × 9.8 × 4      ← write this line\ns = 19.6 m',
    cost: 'three seconds, and it earns a method mark even when the answer is wrong',
  },
  'omits-units': {
    type: 'careless',
    name: 'Leaving units off the answer',
    fix: 'Put the unit on the answer line before you write the number.',
    code: 'v = ___ m/s     ← unit first\nv = 19.6 m/s',
    cost: 'one second, one mark, every numerical',
  },
  'sign-flip': {
    type: 'careless',
    name: 'Sign errors',
    fix: 'Draw an arrow for the positive direction before the first line of working.',
    code: '↑ +ve\na = −9.8 m/s²   ← decided once, up top',
    cost: 'one arrow, and every sign after it is decided for you',
  },
  'formula-not-written': {
    type: 'formula',
    name: 'Substituting without writing the formula',
    fix: 'Formula first, in symbols, on its own line. Then the numbers.',
    code: 'F = ma            ← the line you skip\nF = 2 × 3 = 6 N',
    cost: 'one line, and the method mark is yours even if the arithmetic goes wrong',
  },
  'wrong-formula-picked': {
    type: 'formula',
    name: 'Picking the wrong formula',
    fix: 'List what you know and what you want before choosing an equation.',
    code: 'know: u, a, t   want: s\n→ s = ut + ½at²   (has all four, no v)',
    cost: 'ten seconds of listing, and the equation chooses itself',
  },
  'no-vector-resolution': {
    type: 'conceptual',
    name: 'Adding vectors like numbers',
    fix: 'Split every vector into x and y before you add anything.',
    code: 'F₁ = (3, 0)  F₂ = (0, 4)\nR  = (3, 4)  →  |R| = 5',
    cost: 'two components, and Pythagoras does the rest',
  },
  'arithmetic-slip': {
    type: 'calculation',
    name: 'Arithmetic slips',
    fix: 'Do the multiplication on the line, not in your head, when there is a decimal.',
    code: '0.5 × 9.8 × 4\n= 4.9 × 4       ← one step per line\n= 19.6',
    cost: 'one extra line, and the number you carry forward is right',
  },
  'copy-error': {
    type: 'careless',
    name: 'Copying a number wrong',
    fix: 'Re-read the question once after writing your knowns.',
    code: 'given: s = 20 m   ← copied, then checked against the question',
    cost: 'five seconds, before the whole answer is built on the wrong number',
  },
  'unit-conversion': {
    type: 'careless',
    name: 'Mixing units',
    fix: 'Convert everything to SI in the knowns list, before any formula.',
    code: 'v = 72 km/h = 20 m/s   ← converted here, once',
    cost: 'one conversion up front instead of a wrong answer at the end',
  },
  'skipped-step': {
    type: 'incomplete',
    name: 'Jumping to the answer',
    fix: 'One operation per line. If two things happened, that is two lines.',
    code: 't² = 4.08\nt  = 2.02 s       ← the square root gets its own line',
    cost: 'a line each, and every step can earn its mark',
  },
  'ran-out-of-time': {
    type: 'incomplete',
    name: 'Not finishing',
    fix: 'Flag and move on after two minutes on a 1-mark question.',
    code: '',
    cost: 'the marks you left blank at the end were easier than the one you stuck on',
  },
  'rushed-mcq': {
    type: 'careless',
    name: 'Answering MCQs too fast',
    fix: 'Read every option before you pick, even when A looks right.',
    code: '',
    cost: 'five seconds, on questions you already know',
  },
}

/** "you-drop-the-half" → "You drop the half". Fallback name for unknown signatures. */
export function humanise(sig) {
  const t = String(sig || '').replace(/[-_]+/g, ' ').trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Unnamed slip'
}

export function signatureInfo(sig) {
  const known = SIGNATURES[sig]
  if (known) return { id: sig, ...known }
  return { id: sig, type: null, name: humanise(sig), fix: null, code: '', cost: null }
}

/* ── classification ──────────────────────────────────────────────────────── */

const RUBRIC_TYPE = { method: 'formula', substitution: 'calculation', answer: 'calculation', units: 'careless', presentation: 'careless' }
const FAST_MS = 8_000

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

/** Do two option strings differ only by sign, or only by unit? */
function optionsDifferBy(a, b) {
  const x = String(a || '').trim(), y = String(b || '').trim()
  if (!x || !y) return null
  const num = /^[-+]?\d+(\.\d+)?/
  const nx = x.match(num), ny = y.match(num)
  if (nx && ny) {
    if (Math.abs(parseFloat(nx[0])) === Math.abs(parseFloat(ny[0])) && parseFloat(nx[0]) !== parseFloat(ny[0])) return 'sign'
    if (parseFloat(nx[0]) === parseFloat(ny[0]) && x !== y) return 'unit'
    const r = Math.abs(parseFloat(nx[0])) / Math.max(1e-9, Math.abs(parseFloat(ny[0])))
    if ([10, 100, 1000, 0.1, 0.01, 0.001].some(k => Math.abs(r - k) < 1e-6)) return 'unit'
  }
  return null
}

/**
 * One event → zero or more mistake records.
 *
 * Explicit fields win: a writer that already emitted type + signature (the
 * grader, the solver) is believed. Otherwise a deterministic heuristic decides,
 * and where it cannot decide it says 'conceptual' with a topic-scoped
 * signature rather than inventing a specific habit it has no evidence for.
 */
export function classifyEvent(e) {
  if (!e || typeof e !== 'object') return []
  const p = e.payload || {}
  const topic = e.topic || null
  const base = {
    id: `${e.ts}-${slug(topic)}`,
    ts: e.ts || 0,
    topic,
    subject: e.subject || null,
    question: p.q ? String(p.q) : null,
    studentAnswer: null,
    correctAnswer: null,
    divergedAt: null,
    lines: null,
    why: p.why ? String(p.why) : (p.habit ? String(p.habit) : null),
  }

  // ── graded written answer: one record per LOST rubric step ──
  if (e.type === 'essay_graded' && Array.isArray(p.steps)) {
    const out = []
    for (const s of p.steps) {
      if (!s || s.awarded >= s.marks) continue
      const type = TYPES.includes(s.type) ? s.type : (RUBRIC_TYPE[s.type] || 'calculation')
      const signature = s.signature || (s.type === 'method' ? 'formula-not-written' : s.type === 'units' ? 'omits-units' : s.type === 'presentation' ? 'skipped-step' : 'arithmetic-slip')
      out.push({
        ...base,
        id: `${base.id}-${slug(signature)}`,
        source: 'written',
        type: TYPES.includes(signatureInfo(signature).type || '') ? signatureInfo(signature).type : type,
        signature,
        marksLost: Math.max(0, (s.marks | 0) - (s.awarded | 0)),
        divergedAt: Number.isInteger(s.line) ? s.line : null,
        lines: Array.isArray(p.lines) ? p.lines.map(String) : null,
        why: s.habit ? String(s.habit) : base.why,
        stepTitle: s.title || null,
        stepReason: s.reason || null,
      })
    }
    return out
  }

  // ── explicit 'mistake' event (chat quiz, manual) ──
  if (e.type === 'mistake') {
    const type = TYPES.includes(p.errType) ? p.errType : 'conceptual'
    const signature = p.signature ? slug(p.signature) : `concept-${slug(topic) || 'general'}`
    return [{
      ...base,
      source: p.source || 'doubt',
      type: signatureInfo(signature).type || type,
      signature,
      marksLost: Number.isFinite(p.marksLost) ? p.marksLost : 1,
      studentAnswer: p.studentAnswer ? String(p.studentAnswer) : null,
      correctAnswer: p.correctAnswer ? String(p.correctAnswer) : null,
    }]
  }

  // ── wrong MCQ ──
  if (e.type === 'quiz_answered' && e.correct === false) {
    const opts = Array.isArray(p.options) ? p.options : null
    const chosen = Number.isInteger(p.chosenIndex) ? p.chosenIndex : null
    const right = Number.isInteger(p.correctIndex) ? p.correctIndex : null
    const studentAnswer = opts && chosen != null ? String(opts[chosen] ?? '') : null
    const correctAnswer = opts && right != null ? String(opts[right] ?? '') : null

    let type = 'conceptual'
    let signature = `concept-${slug(topic) || 'general'}`
    if (chosen == null && opts) {
      type = 'incomplete'; signature = 'ran-out-of-time'
    } else {
      const diff = optionsDifferBy(studentAnswer, correctAnswer)
      if (diff === 'sign') { type = 'careless'; signature = 'sign-flip' }
      else if (diff === 'unit') { type = 'careless'; signature = 'unit-conversion' }
      else if (typeof e.durationMs === 'number' && e.durationMs > 0 && e.durationMs < FAST_MS && (e.difficulty ?? 0.5) <= 0.45) {
        type = 'careless'; signature = 'rushed-mcq'
      }
    }
    return [{
      ...base,
      source: p.mock ? 'mock' : 'quiz',
      type, signature,
      marksLost: Number.isFinite(p.marks) ? p.marks : 1,
      studentAnswer, correctAnswer,
    }]
  }

  // ── flashcard 'Again' ──
  if (e.type === 'flashcard_review' && e.correct === false) {
    return [{
      ...base,
      source: 'flashcard',
      type: 'conceptual',
      signature: `recall-${slug(topic) || 'general'}`,
      marksLost: 0,
    }]
  }

  return []
}

/** Every mistake record in the log, newest first. */
export function mistakeRecords(events = []) {
  if (!Array.isArray(events)) return []
  const out = []
  for (const e of events) for (const r of classifyEvent(e)) out.push(r)
  return out.sort((a, b) => b.ts - a.ts)
}

/* ── patterns ────────────────────────────────────────────────────────────── */

export const PATTERN_MIN = 3
const DAY = 86_400_000
const BEATEN_DAYS = 21

/** Five weekly buckets, oldest first. */
export function weeklySparkline(records = [], now = Date.now()) {
  const bars = [0, 0, 0, 0, 0]
  for (const r of records) {
    const w = Math.floor((now - r.ts) / (7 * DAY))
    if (w >= 0 && w < 5) bars[4 - w] += 1
  }
  return bars
}

/**
 * A PATTERN is a signature with >= 3 occurrences. Group, count, sum marks,
 * sort by marks -- marks are the currency a student cares about, not
 * frequency. No ML.
 */
export function patterns(records = [], now = Date.now()) {
  const by = new Map()
  for (const r of records) {
    if (!r.signature || r.signature.startsWith('recall-')) continue
    if (!by.has(r.signature)) by.set(r.signature, [])
    by.get(r.signature).push(r)
  }
  const rows = []
  for (const [sig, list] of by) {
    const info = signatureInfo(sig)
    const marks = list.reduce((s, r) => s + (r.marksLost || 0), 0)
    const recent = list.filter(r => now - r.ts <= 14 * DAY).length
    const prior = list.filter(r => now - r.ts > 14 * DAY && now - r.ts <= 28 * DAY).length
    const last = Math.max(...list.map(r => r.ts))
    const trend = now - last > BEATEN_DAYS * DAY ? 'beaten' : recent < prior ? 'improving' : 'active'
    rows.push({
      signature: sig,
      name: info.name,
      type: info.type || list[0].type,
      count: list.length,
      marksLost: marks,
      lastAt: last,
      firstAt: Math.min(...list.map(r => r.ts)),
      trend,
      trendLabel: trend === 'beaten' ? `gone ${Math.floor((now - last) / DAY)} days` : trend === 'improving' ? 'getting better' : 'still happening',
      sparkline: weeklySparkline(list, now),
      occurrences: list.slice().sort((a, b) => b.ts - a.ts),
      isPattern: list.length >= PATTERN_MIN,
    })
  }
  const live = rows.filter(r => r.isPattern && r.trend !== 'beaten').sort((a, b) => b.marksLost - a.marksLost || b.count - a.count)
  const beaten = rows.filter(r => r.isPattern && r.trend === 'beaten').sort((a, b) => b.lastAt - a.lastAt)
  const forming = rows.filter(r => !r.isPattern).sort((a, b) => b.count - a.count)
  return { live, beaten, forming, all: rows }
}

/**
 * The state the screen is in. Honest empty and early states -- this space is
 * worthless until there is history, and it must not look broken before then.
 */
export function summarize(records = [], now = Date.now()) {
  if (!records.length) return { state: 'empty', headline: 'Nothing to analyse yet', sub: 'Answer some questions and Kyno will start spotting what repeats.' }
  const p = patterns(records, now)
  if (!p.live.length && !p.beaten.length) {
    const top = p.forming[0]
    const sub = top
      ? `A pattern needs ${PATTERN_MIN}. You have ${top.count} of one so far.`
      : `A pattern needs ${PATTERN_MIN} of the same slip.`
    return { state: 'early', headline: 'No patterns yet', sub, recent: records.slice(0, 8), patterns: p }
  }
  const n = p.live.length
  const words = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six']
  const headline = n === 0 ? 'Every pattern is beaten' : `${words[Math.min(n, 6)] || n} mistake${n === 1 ? '' : 's'} keep${n === 1 ? 's' : ''} coming back`
  return { state: 'ready', headline, patterns: p }
}

/** The beaten card copy -- or the closest thing to it, never nothing. */
export function beatenCopy(p, now = Date.now()) {
  if (p.beaten.length) {
    const names = p.beaten.slice(0, 2).map(b => b.name.replace(/^./, c => c.toLowerCase()))
    const days = Math.min(...p.beaten.map(b => Math.floor((now - b.lastAt) / DAY)))
    return { title: `${p.beaten.length} pattern${p.beaten.length === 1 ? '' : 's'} beaten`, sub: `${names.join(' and ')} — gone ${days} days`, real: true }
  }
  const improving = p.live.filter(r => r.trend === 'improving').sort((a, b) => a.sparkline[4] - b.sparkline[4])[0]
  if (improving) return { title: 'Closest to beaten', sub: `${improving.name} — ${improving.sparkline[4]} this week, down from ${improving.sparkline[2] + improving.sparkline[3]}`, real: false }
  return null
}

/* ── impact ──────────────────────────────────────────────────────────────── */

/**
 * Where the marks went in the most recent mock, by type.
 *
 * Returns null when no mock exists -- the screen hides rather than charting
 * nothing. The reframe is only produced when non-conceptual losses exceed
 * conceptual: if the student genuinely has concept gaps, it says that.
 * Never manufacture the encouraging version.
 */
export function impact(records = [], events = [], now = Date.now()) {
  const mocks = (events || []).filter(e => e && e.type === 'quiz_completed' && e.payload && e.payload.mock && typeof e.score === 'number')
  if (!mocks.length) return null
  const mock = mocks.sort((a, b) => b.ts - a.ts)[0]
  const windowStart = mock.ts - 4 * 3600_000
  const rows = records.filter(r => r.source === 'mock' && r.ts >= windowStart && r.ts <= mock.ts + 60_000)
  const byType = Object.fromEntries(TYPES.map(t => [t, { marks: 0, count: 0 }]))
  for (const r of rows) { byType[r.type].marks += r.marksLost || 0; byType[r.type].count += 1 }
  const totalLost = Object.values(byType).reduce((s, v) => s + v.marks, 0)
  const conceptual = byType.conceptual.marks
  const nonConceptual = totalLost - conceptual
  const segments = TYPES.map(t => ({ type: t, marks: byType[t].marks, count: byType[t].count })).filter(s => s.marks > 0)
  const total = Number.isFinite(mock.payload?.total) ? mock.payload.total : 100
  const scored = Math.round(mock.score)
  return {
    mockTs: mock.ts,
    mockName: mock.payload?.name || 'Mock',
    scored,
    total,
    totalLost,
    segments: segments.sort((a, b) => b.marks - a.marks),
    reframe: totalLost > 0 && nonConceptual > conceptual
      ? {
          headline: `${nonConceptual} of those ${totalLost} marks were not about knowing the subject.`,
          body: `Units, formulas you knew but did not write, and arithmetic. You understand more than ${scored} makes it look. Fixing habits is faster than relearning chapters.`,
        }
      : totalLost > 0
        ? {
            headline: `${conceptual} of those ${totalLost} marks were ideas that are not there yet.`,
            body: 'That is the honest read. Habits will not fix these — the chapter will. Start there, then drill.',
          }
        : null,
    cheapest: segments
      .filter(s => s.type !== 'conceptual')
      .map(s => ({ type: s.type, marks: s.marks, label: `${TYPE_GLOSS[s.type].charAt(0).toUpperCase()}${TYPE_GLOSS[s.type].slice(1)}`, cost: s.type === 'careless' ? 'costs you 2 seconds a question' : s.type === 'formula' ? 'costs you one written line' : s.type === 'calculation' ? 'costs you one line per step' : 'costs you flagging and moving on' }))
      .slice(0, 3),
  }
}

/* ── topics ──────────────────────────────────────────────────────────────── */

/**
 * Two topics can both be at 40% for completely different reasons. RELEARN
 * when conceptual is more than 60% of that topic's losses; TIGHTEN UP
 * otherwise. Sorted by what would actually fix them, not by a single rank.
 */
export function topicGroups(records = [], mastery = [], now = Date.now()) {
  const by = new Map()
  for (const r of records) {
    if (!r.topic) continue
    const k = String(r.topic).toLowerCase()
    if (!by.has(k)) by.set(k, { topic: r.topic, list: [] })
    by.get(k).list.push(r)
  }
  const mm = new Map((mastery || []).filter(m => m && m.topic).map(m => [String(m.topic).toLowerCase(), m]))
  const rows = []
  for (const [k, { topic, list }] of by) {
    const byType = Object.fromEntries(TYPES.map(t => [t, 0]))
    for (const r of list) byType[r.type] += Math.max(1, r.marksLost || 0)
    const total = Object.values(byType).reduce((s, v) => s + v, 0)
    const share = Object.fromEntries(TYPES.map(t => [t, total ? byType[t] / total : 0]))
    const dominant = TYPES.slice().sort((a, b) => byType[b] - byType[a])[0]
    const recent3w = list.filter(r => now - r.ts <= 21 * DAY).length
    const m = mm.get(k)
    const masteryPct = m && typeof m.mastery === 'number' ? Math.round(m.mastery * 100) : null
    const group = share.conceptual > 0.6 ? 'relearn' : 'tighten'
    let advice
    if (group === 'relearn') advice = 'Almost every loss is conceptual — start from the chapter, not from questions'
    else if (recent3w >= 3 && (m?.mastery ?? 0) < 0.5) advice = 'Drilling has not moved it in 3 weeks — try teaching it back instead'
    else if (dominant === 'careless') advice = 'You understand it. The marks go on units, signs and copying'
    else if (dominant === 'formula') advice = 'You understand it. The marks go on formula lines you skip'
    else if (dominant === 'calculation') advice = 'You understand it. The marks go on arithmetic mid-working'
    else advice = 'You understand it. The marks go on unfinished answers'
    rows.push({ topic, mastery: masteryPct, count: list.length, marksLost: list.reduce((s, r) => s + (r.marksLost || 0), 0), share, dominant, group, advice, recent3w })
  }
  const sortFn = (a, b) => b.marksLost - a.marksLost || b.count - a.count
  return {
    relearn: rows.filter(r => r.group === 'relearn').sort(sortFn),
    tighten: rows.filter(r => r.group === 'tighten').sort(sortFn),
  }
}

/* ── pattern detail ──────────────────────────────────────────────────────── */

/**
 * The cross-cutting observation, or null. Only render when a REAL pattern
 * exists across sources -- never invent an insight to fill the slot.
 */
export function crossCut(occurrences = []) {
  const list = (occurrences || []).filter(Boolean)
  if (list.length < PATTERN_MIN) return null
  const sources = new Set(list.map(o => o.source))
  if (sources.size === 1) {
    const s = [...sources][0]
    const label = { written: 'a written answer', mock: 'a mock', quiz: 'a quiz', doubt: 'a chat quiz', flashcard: 'a flashcard' }[s] || s
    const never = s === 'written' ? 'It has never happened in an MCQ.' : s === 'mock' || s === 'quiz' ? 'It has never happened in a written answer.' : ''
    return `Every single one was ${label}. ${never}`.trim()
  }
  const written = list.filter(o => o.source === 'written').length
  if (written >= Math.ceil(list.length * 0.8)) return `${written} of ${list.length} were written answers — this is a working-on-paper habit, not a knowledge gap.`
  return null
}

/** "You drop the ½ when you substitute" — second person, states the habit. */
export function habitTitle(sig) {
  const info = signatureInfo(sig)
  const map = {
    'drops-half-in-suvat': 'You drop the ½ when you substitute',
    'omits-units': 'You leave the unit off the answer',
    'sign-flip': 'You lose the sign mid-working',
    'formula-not-written': 'You substitute without writing the formula',
    'wrong-formula-picked': 'You reach for the wrong equation',
    'no-vector-resolution': 'You add vectors like plain numbers',
    'arithmetic-slip': 'Your arithmetic slips mid-working',
    'copy-error': 'You copy a number wrong from the question',
    'unit-conversion': 'You mix units inside one calculation',
    'skipped-step': 'You jump from the setup to the answer',
    'ran-out-of-time': 'You run out of time before the last questions',
    'rushed-mcq': 'You answer MCQs before reading every option',
  }
  return map[sig] || `You keep making the same slip: ${info.name.replace(/^./, c => c.toLowerCase())}`
}

export function occurrenceContext(o) {
  const src = { written: 'Written answer', mock: 'Mock', quiz: 'Quiz', doubt: 'Kyno chat', flashcard: 'Flashcard' }[o.source] || 'Practice'
  return o.topic ? `${src} · ${o.topic}` : src
}

export function shortDate(ts) {
  try { return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) } catch { return '' }
}

/** Since-when copy: "6 times since June · 5 marks lost". */
export function sinceLine(row) {
  let since = ''
  try { since = new Date(row.firstAt).toLocaleDateString('en-IN', { month: 'long' }) } catch { /* ignore */ }
  return `${row.count} times${since ? ` since ${since}` : ''} · ${row.marksLost} mark${row.marksLost === 1 ? '' : 's'} lost`
}
