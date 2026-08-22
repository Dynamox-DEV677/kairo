/**
 * C27 — stream guidance (Science / Commerce / Arts) for a Class 9-10 student
 * choosing a path for 11-12.
 *
 * The spec's bar: the suggestion must be demonstrably driven by the student's
 * REAL in-app performance, not a personality quiz alone. So the blend is
 * performance-weighted (0.6 real mastery, 0.4 interest quiz), and when there is
 * little or no performance data yet it SAYS SO (dataStrength) instead of
 * dressing a quiz result up as an evidence-based verdict.
 */

export const STREAMS = {
  science:  { label: 'Science', blurb: 'Physics, Chemistry, Biology/Maths — engineering, medicine, research.' },
  commerce: { label: 'Commerce', blurb: 'Accounts, Economics, Business — finance, CA, management.' },
  arts:     { label: 'Arts / Humanities', blurb: 'History, Political Science, languages, psychology, law, design.' },
}

/** Which subjects (lowercased, matched loosely) feed each stream's performance. */
const SUBJECT_SIGNALS = {
  science:  ['physics', 'chemistry', 'biology', 'science', 'mathematics', 'math', 'maths'],
  commerce: ['mathematics', 'math', 'maths', 'economics', 'accountancy', 'accounts', 'business'],
  arts:     ['english', 'history', 'geography', 'social', 'civics', 'political', 'hindi', 'language', 'psychology'],
}

/** The short interest quiz. The PAGE renders it; each option carries a signal. */
export const STREAM_QUIZ = [
  { q: 'Which of these would you happily spend a Sunday on?',
    options: [
      { label: 'Taking apart a gadget or running an experiment', signal: 'science' },
      { label: 'Tracking prices, a small resale, or a budget', signal: 'commerce' },
      { label: 'Writing, debating, or reading about people & the past', signal: 'arts' },
    ] },
  { q: 'A problem feels satisfying to you when…',
    options: [
      { label: 'It has one exact right answer you can derive', signal: 'science' },
      { label: 'It balances numbers, cost and benefit', signal: 'commerce' },
      { label: 'It has many defensible answers you can argue', signal: 'arts' },
    ] },
  { q: 'Pick the career that sounds most like "you"',
    options: [
      { label: 'Engineer, doctor, scientist', signal: 'science' },
      { label: 'CA, entrepreneur, banker', signal: 'commerce' },
      { label: 'Lawyer, writer, designer, psychologist', signal: 'arts' },
    ] },
  { q: 'In a group project you naturally become the one who…',
    options: [
      { label: 'Figures out how it actually works', signal: 'science' },
      { label: 'Plans the resources and keeps it on budget', signal: 'commerce' },
      { label: 'Writes it up and presents it', signal: 'arts' },
    ] },
]

const KEYS = ['science', 'commerce', 'arts']

/** Mean mastery of each stream's subjects, from real mastery rows. */
export function performanceScores(mastery) {
  const rows = (mastery || []).filter(r => r && r.topic != null && typeof r.mastery === 'number')
  const scores = { science: 0, commerce: 0, arts: 0 }
  const subjectsSeen = new Set()

  for (const key of KEYS) {
    const matched = rows.filter(r => {
      const s = String(r.subject || r.topic || '').toLowerCase()
      return SUBJECT_SIGNALS[key].some(sig => s.includes(sig))
    })
    matched.forEach(r => subjectsSeen.add(String(r.subject || r.topic).toLowerCase()))
    scores[key] = matched.length ? matched.reduce((a, r) => a + r.mastery, 0) / matched.length : 0
  }
  return { scores, distinctSubjects: subjectsSeen.size }
}

/** Interest scores from the quiz signals, normalised to 0..1. */
export function quizScores(signals) {
  const counts = { science: 0, commerce: 0, arts: 0 }
  for (const s of signals || []) if (s in counts) counts[s]++
  const total = counts.science + counts.commerce + counts.arts
  if (!total) return counts
  return { science: counts.science / total, commerce: counts.commerce / total, arts: counts.arts / total }
}

export const PERF_WEIGHT = 0.6
export const QUIZ_WEIGHT = 0.4

/**
 * The suggestion. Blends real performance (0.6) with the interest quiz (0.4),
 * but drops the performance term to 0 weight when there is no data — and marks
 * dataStrength so the UI can be honest about which it leaned on.
 */
export function suggestStream({ mastery = [], signals = [] } = {}) {
  const perf = performanceScores(mastery)
  const quiz = quizScores(signals)

  // Real evidence only counts if some stream actually has performance data.
  const hasPerf = KEYS.some(k => perf.scores[k] > 0)
  const dataStrength = !hasPerf ? 'none' : perf.distinctSubjects >= 3 ? 'ok' : 'low'
  const pw = hasPerf ? PERF_WEIGHT : 0
  const qw = hasPerf ? QUIZ_WEIGHT : 1

  // Blend on RELATIVE standing, not absolute mastery. Real BKT mastery from a
  // few quizzes sits around 0.4-0.5 even on a student's best subject, so
  // blending raw magnitudes let a perfect (1.0) interest quiz overpower genuine
  // performance. Normalising each stream against the student's OWN strongest
  // stream means "science 0.47 vs arts 0" reads as the strong signal it is.
  const maxPerf = Math.max(...KEYS.map(k => perf.scores[k]))
  const normPerf = k => (maxPerf > 0 ? perf.scores[k] / maxPerf : 0)

  const ranked = KEYS.map(k => ({
    stream: k,
    label: STREAMS[k].label,
    score: pw * normPerf(k) + qw * quiz[k],
    perfPart: perf.scores[k],   // raw mastery, for the honest "X% mastery" reason
    quizPart: quiz[k],
  })).sort((a, b) => b.score - a.score)

  const top = ranked[0]
  const reasons = []
  if (hasPerf && top.perfPart > 0) {
    reasons.push(`Your quiz results in ${STREAMS[top.stream].label} subjects are your strongest so far (${Math.round(top.perfPart * 100)}% mastery).`)
  }
  if (top.quizPart > 0) {
    reasons.push(`Your answers lean ${STREAMS[top.stream].label}.`)
  }

  return {
    ranked,
    top: top.stream,
    reasons,
    dataStrength,
    // A close call is worth flagging rather than pretending certainty.
    close: ranked.length > 1 && (ranked[0].score - ranked[1].score) < 0.12,
  }
}
