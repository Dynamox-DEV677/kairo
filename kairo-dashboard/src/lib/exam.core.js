/**
 * Exam-hall mode — a mock under real conditions: a clock that never pauses,
 * OMR answers, auto-submit, then a post-mortem that shows where marks LEAKED
 * (time vs marks), not just the score.
 *
 * Presets are honest minis: real marking ratios (JEE/NEET 4 right, minus 1
 * wrong) and real per-question pace, scaled to a sit-able length — and
 * labelled "mini" so nobody mistakes 24 questions for a full JEE paper.
 * Free generation can't produce 90 exam-grade questions in one sitting;
 * pretending otherwise would make the feature a lie.
 */

export const PAPER_PRESETS = [
  {
    id: 'boards',
    label: 'Boards pattern',
    note: 'One subject · 1 mark each · no negative marking',
    questions: 20, minutes: 40,
    marking: { correct: 1, wrong: 0 },
    pickSubject: true, subjects: null,
  },
  {
    id: 'jee',
    label: 'JEE pattern · mini',
    note: 'P/C/M mixed · +4 / −1 · JEE pace (2.5 min per question)',
    questions: 24, minutes: 60,
    marking: { correct: 4, wrong: -1 },
    pickSubject: false, subjects: ['Physics', 'Chemistry', 'Mathematics'],
  },
  {
    id: 'neet',
    label: 'NEET pattern · mini',
    note: 'P/C/B mixed · +4 / −1 · NEET pace (about 1 min per question)',
    questions: 24, minutes: 26,
    marking: { correct: 4, wrong: -1 },
    pickSubject: false, subjects: ['Physics', 'Chemistry', 'Biology'],
  },
  {
    id: 'custom',
    label: 'Custom',
    note: 'Your call — pick subject, length and time',
    questions: 15, minutes: 30,
    marking: { correct: 1, wrong: 0 },
    pickSubject: true, subjects: null,
  },
]

/** The hall clock: wall-time based so hiding the tab CANNOT stop it. */
export function remainingMs(startedAt, totalMs, now) {
  return Math.max(0, (startedAt + totalMs) - now)
}

/** OMR palette states. answers: (number|null)[], flags: Set/array of indexes. */
export function paletteStates(total, answers, flags) {
  const flagged = new Set(flags || [])
  const out = []
  for (let i = 0; i < total; i++) {
    if (flagged.has(i)) out.push('flag')
    else if (answers && answers[i] != null) out.push('done')
    else out.push('blank')
  }
  return out
}

/**
 * Score under a marking scheme. Blank is NOT wrong: with negative marking the
 * difference is the whole game.
 */
export function scorePaper(questions, answers, marking) {
  let correct = 0, wrong = 0, blank = 0
  ;(questions || []).forEach((q, i) => {
    const a = answers ? answers[i] : null
    if (a == null) blank++
    else if (a === q.correctIndex) correct++
    else wrong++
  })
  const marks = correct * marking.correct + wrong * (marking.wrong || 0)
  return {
    correct, wrong, blank,
    marks,
    maxMarks: (questions || []).length * marking.correct,
    negLost: Math.abs(wrong * Math.min(0, marking.wrong || 0)),
  }
}

/**
 * The post-mortem. times[i] = ms spent on question i (accumulated across
 * visits). Finds the LEAKS: questions that ate far more than their share of
 * time and still earned nothing — the "8 minutes on a 4-mark question" that
 * sinks real exams.
 */
export function postMortem({ questions = [], answers = [], times = [], marking }) {
  const n = questions.length
  if (!n) return null
  const per = questions.map((q, i) => {
    const a = answers[i]
    const correct = a != null && a === q.correctIndex
    return {
      i,
      subject: q.subject || null,
      topic: q.topic || null,
      correct,
      answered: a != null,
      timeMs: times[i] || 0,
      marks: a == null ? 0 : correct ? marking.correct : (marking.wrong || 0),
    }
  })

  const totalTime = per.reduce((s, p) => s + p.timeMs, 0)
  const avgTimeMs = Math.round(totalTime / n)

  // A leak: no marks earned AND time ≥ LEAK_MULTIPLE × the average. Sorted by
  // time so the worst sink leads.
  const leaks = per
    .filter(p => p.marks <= 0 && p.timeMs >= LEAK_MULTIPLE * avgTimeMs && p.timeMs > 0)
    .sort((a, b) => b.timeMs - a.timeMs)
    .slice(0, 3)

  // Per-subject accuracy on ATTEMPTED questions (blanks are strategy, not error).
  const bySubject = {}
  for (const p of per) {
    const s = p.subject || 'General'
    const row = bySubject[s] || (bySubject[s] = { attempted: 0, correct: 0, timeMs: 0 })
    if (p.answered) { row.attempted++; if (p.correct) row.correct++ }
    row.timeMs += p.timeMs
  }

  return { per, avgTimeMs, totalTimeMs: totalTime, leaks, bySubject }
}

export const LEAK_MULTIPLE = 2

/** Split a paper's question count across its subjects, fairly. */
export function splitCounts(total, subjects) {
  const n = Math.max(1, (subjects || []).length)
  const base = Math.floor(total / n)
  const extra = total - base * n
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0))
}

/** mm:ss (or h:mm:ss over an hour) for the hall clock. */
export function clockLabel(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${m}:${String(ss).padStart(2, '0')}`
}
