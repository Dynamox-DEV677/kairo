/**
 * C8 / C29 / C11 — today's three tasks, the growth stat, and adaptive
 * difficulty. Pure functions over the twin store's REAL records: forgetting
 * curve, weak topics, due flashcards, exam dates, and the quiz_answered event
 * log. Nothing here invents a task or a number.
 *
 * Tone rule (Global Rule 6) is enforced at the data layer, not just the copy:
 * nothing in these outputs states a deficit without carrying the next step
 * with it — every task has a `why` AND a `to` (where in the app to do it).
 */

/* ── C8: today's 3 things ─────────────────────────────────────────────────── */

/**
 * Exactly three concrete tasks for today, each traceable to a real record.
 *
 * Priority order is deliberate:
 *   1. About to be forgotten (SRS)  — time-critical, cheapest win.
 *   2. Weakest topic with attempts  — the real gap, with evidence.
 *   3. Due flashcards, else the nearest exam, else extend a strength.
 *
 * Stable for the whole day: the pick depends only on the data and dayKey, so
 * reopening the app does not reshuffle the list — a list that changes every
 * visit reads as random and gets ignored.
 */
export function todaysThree({ twin, dueCards = 0, examDates = [], now = 0 } = {}) {
  const tasks = []
  const seen = new Set()
  // Dedupe by TOPIC, not kind+topic: when the same topic is both "about to be
  // forgotten" and "weakest", one task covers it — three tasks on one topic
  // reads as nagging, and breadth is the point of a daily three.
  const push = (t) => {
    const k = (t.topic || t.title).toLowerCase()
    if (!seen.has(k) && tasks.length < 3) { seen.add(k); tasks.push(t) }
  }

  const forgetting = (twin?.forgettingSoon || [])[0]
  if (forgetting) {
    push({
      kind: 'revise',
      topic: forgetting.topic,
      subject: forgetting.subject,
      title: `Revisit ${forgetting.topic}`,
      why: forgetting.overdue
        ? 'It has slipped past its review window — a quick pass brings it back fastest.'
        : `It comes up for review ${hoursLabel(forgetting.hoursUntilForget)} — reviewing now locks it in.`,
      to: 'reels',
    })
  }

  const weak = (twin?.weakTopics || [])[0]
  if (weak) {
    push({
      kind: 'practice',
      topic: weak.topic,
      subject: weak.subject,
      title: `Practise ${weak.topic}`,
      why: `Your last ${weak.attempts} attempts show it isn't solid yet — a short drill moves it most.`,
      to: 'revision',
    })
  }

  if (dueCards > 0) {
    push({
      kind: 'flashcards',
      topic: null,
      subject: null,
      title: `Flip ${dueCards} due card${dueCards === 1 ? '' : 's'}`,
      why: 'These are timed to just before you would forget them — five minutes now saves relearning later.',
      to: 'reels',
    })
  }

  // Nearest exam that hasn't ended, as a planning task.
  //
  // Exam dates are typed date-only, so Date.parse lands on MIDNIGHT of exam
  // day. Two consequences the naive version got wrong: an exam later today
  // parsed as "in the past" and vanished, and "3 calendar days away" rounded
  // down to 2. Keep the exam until its day is over, and count calendar days.
  const DAY = 86_400_000
  const nextExam = (examDates || [])
    .map(e => ({ ...e, t: Date.parse(e?.date || '') }))
    .filter(e => Number.isFinite(e.t) && e.t + DAY > now)
    .sort((a, b) => a.t - b.t)[0]
  if (nextExam) {
    const days = Math.max(0, Math.ceil((nextExam.t - now) / DAY))
    push({
      kind: 'plan',
      topic: null,
      subject: null,
      title: `Prep for ${nextExam.name || 'your exam'}`,
      why: days === 0
        ? 'It is today — a calm skim of your weak-topic list beats cramming anything new.'
        : `${days} day${days === 1 ? '' : 's'} out — one focused topic per day covers your gaps in time.`,
      to: 'exam-planner',
    })
  }

  // Second-weakest topic, then a strength to extend — so three real tasks
  // exist even without exams or due cards.
  const weak2 = (twin?.weakTopics || [])[1]
  if (weak2) {
    push({
      kind: 'practice', topic: weak2.topic, subject: weak2.subject,
      title: `Practise ${weak2.topic}`,
      why: 'Second on your gap list — worth ten minutes while it is small.',
      to: 'revision',
    })
  }
  const strong = (twin?.strongTopics || [])[0]
  if (strong) {
    push({
      kind: 'stretch', topic: strong.topic, subject: strong.subject,
      title: `Go deeper on ${strong.topic}`,
      why: 'You are already good at this — one harder question turns good into exam-proof.',
      to: 'solver',
    })
  }

  return tasks
}

function hoursLabel(h) {
  if (!Number.isFinite(h) || h <= 0) return 'now'
  if (h < 24) return `in about ${Math.max(1, Math.round(h))}h`
  return `in about ${Math.round(h / 24)} day${Math.round(h / 24) === 1 ? '' : 's'}`
}

/* ── C29: personal growth stat ────────────────────────────────────────────── */

const WEEK = 7 * 86_400_000

/**
 * You vs. you-three-weeks-ago, from the real quiz_answered log. Never a
 * comparison against other students.
 *
 * Returns null when either window has fewer than MIN_ATTEMPTS answers — a
 * "growth" number computed from two attempts is noise presented as insight,
 * and the honest answer is "not enough data yet".
 */
export const MIN_ATTEMPTS = 5

export function growthStat(events, now) {
  const answers = (events || []).filter(e => e && e.type === 'quiz_answered' && typeof e.correct === 'boolean')
  const recent = answers.filter(e => now - e.ts <= WEEK)
  const before = answers.filter(e => now - e.ts > WEEK && now - e.ts <= 4 * WEEK)

  if (recent.length < MIN_ATTEMPTS || before.length < MIN_ATTEMPTS) {
    return { ready: false, needed: MIN_ATTEMPTS, recentCount: recent.length, beforeCount: before.length }
  }

  const acc = rows => rows.filter(r => r.correct).length / rows.length
  const accNow = acc(recent)
  const accBefore = acc(before)

  return {
    ready: true,
    accNow: Math.round(accNow * 100),
    accBefore: Math.round(accBefore * 100),
    deltaPts: Math.round((accNow - accBefore) * 100),
    recentCount: recent.length,
    beforeCount: before.length,
  }
}

/* ── C11: adaptive difficulty ─────────────────────────────────────────────── */

export const DIFF_ORDER = ['easy', 'medium', 'hard']

/**
 * The difficulty the NEXT session should open at, from the real sequence of
 * recent answers. Steps one level at a time — accuracy is noisy, and a picker
 * that jumps easy→hard off one lucky run teaches the student to distrust it.
 *
 * ≥75% over the window steps up, ≤40% steps down, in between holds. Below
 * MIN_SIGNAL answers it holds and says so, rather than adapting to noise.
 */
export const MIN_SIGNAL = 4

export function nextDifficulty(results, current = 'medium') {
  const cur = DIFF_ORDER.includes(current) ? current : 'medium'
  const recent = (results || []).filter(r => r && typeof r.correct === 'boolean').slice(-10)

  if (recent.length < MIN_SIGNAL) {
    return { level: cur, changed: false, reason: 'not enough recent answers to adapt yet', accuracy: null }
  }

  const accuracy = recent.filter(r => r.correct).length / recent.length
  const i = DIFF_ORDER.indexOf(cur)

  if (accuracy >= 0.75 && i < DIFF_ORDER.length - 1) {
    return {
      level: DIFF_ORDER[i + 1], changed: true, accuracy: Math.round(accuracy * 100),
      reason: `you got ${Math.round(accuracy * 100)}% of your recent answers right — ready for the next level`,
    }
  }
  if (accuracy <= 0.40 && i > 0) {
    return {
      level: DIFF_ORDER[i - 1], changed: true, accuracy: Math.round(accuracy * 100),
      reason: 'recent questions have been a stretch — stepping down to rebuild speed, then back up',
    }
  }
  return {
    level: cur, changed: false, accuracy: Math.round(accuracy * 100),
    reason: `${Math.round(accuracy * 100)}% recently — this level is doing its job`,
  }
}

/* ── C19: post-test recovery plan ─────────────────────────────────────────── */

/**
 * A revisit order built from THIS test's wrong answers — never generic advice.
 *
 * Order: most-missed topic first (largest gap), ties broken by lower accuracy.
 * Topics the student got fully right are listed as anchors — starting a
 * recovery session with proof of what already works is the tone rule applied
 * to structure, not just wording.
 *
 * Input rows: { topic, subject?, correct } for each question in the attempt.
 * Returns null when nothing was wrong — no plan is manufactured for a clean
 * run.
 */
export function recoveryPlan(rows) {
  const clean = (rows || []).filter(r => r && r.topic && typeof r.correct === 'boolean')
  if (!clean.length) return null

  const byTopic = new Map()
  for (const r of clean) {
    const k = r.topic
    if (!byTopic.has(k)) byTopic.set(k, { topic: k, subject: r.subject || null, wrong: 0, total: 0 })
    const t = byTopic.get(k)
    t.total++
    if (!r.correct) t.wrong++
  }

  const all = [...byTopic.values()]
  const steps = all
    .filter(t => t.wrong > 0)
    .sort((a, b) => (b.wrong - a.wrong) || (a.total - a.wrong) / a.total - (b.total - b.wrong) / b.total)
    .map((t, i) => ({
      ...t,
      order: i + 1,
      action: t.wrong === t.total
        ? `Re-learn ${t.topic} from the concept up — every question on it missed the same ground, so the fastest fix is the idea itself, then the drill.`
        : `Redrill ${t.topic} — you got ${t.total - t.wrong} of ${t.total} right, so the method is there and practice will finish it.`,
    }))

  if (!steps.length) return null

  return {
    steps,
    solid: all.filter(t => t.wrong === 0).map(t => t.topic),
    wrongCount: clean.filter(r => !r.correct).length,
    total: clean.length,
  }
}
