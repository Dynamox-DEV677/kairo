/**
 * C28 — mistake-pattern analyser. Why a student got things wrong, because the
 * fix for each cause is different: a careless slip needs a slow-down habit, a
 * conceptual gap needs re-learning, time pressure needs pacing practice.
 *
 * Reads ONLY real quiz_answered events (correct, difficulty, durationMs, topic)
 * plus the student's mastery rows. Every category is earned from that data —
 * and where the data can't support a call (e.g. no timing on old attempts) it
 * says "unclear" rather than inventing a reason. Tone: a category is paired
 * with a next step, never a bare diagnosis (Global Rule 6).
 */

/** Below this fraction of the median time on a topic, a wrong answer was rushed. */
export const FAST_FRACTION = 0.5
/** Above this multiple of the median, it was a slow struggle. */
export const SLOW_MULTIPLE = 1.6
/** Mastery at or above this means the student generally KNOWS the topic. */
export const STRONG_MASTERY = 0.6

export const CATEGORIES = {
  careless: {
    label: 'Careless slips',
    fix: 'You know these — you rushed. Before locking an answer, re-read the question once.',
  },
  conceptual: {
    label: 'Concept gaps',
    fix: 'These need re-learning, not more attempts. Revisit the concept, then drill it.',
  },
  timing: {
    label: 'Time pressure',
    fix: 'You got there but slowly. Practise these against a timer to build speed.',
  },
  unclear: {
    label: 'Worth another look',
    fix: 'Not enough signal to call the cause yet — another short quiz will sharpen it.',
  },
}

function median(nums) {
  const a = nums.filter(n => Number.isFinite(n)).sort((x, y) => x - y)
  if (!a.length) return null
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}

/** mastery rows → { normalisedTopic: mastery }. */
function masteryMap(mastery) {
  const m = new Map()
  for (const row of mastery || []) {
    if (row && row.topic && typeof row.mastery === 'number') m.set(String(row.topic).toLowerCase(), row.mastery)
  }
  return m
}

/**
 * Classify each recent WRONG answer, and roll them up by category.
 *
 * Returns { categories: [{ key, label, fix, count, topics }], total, timedShare }.
 * `timedShare` is how many of the wrongs had timing data — surfaced so the UI
 * can be honest that timing-based calls only cover part of the picture on old
 * attempts.
 */
export function classifyMistakes(events, mastery = [], { windowDays = 30, now = 0 } = {}) {
  const cutoff = now - windowDays * 86_400_000
  const answers = (events || []).filter(
    e => e && e.type === 'quiz_answered' && typeof e.correct === 'boolean' && e.ts >= cutoff,
  )

  // Median time per topic, from that topic's answers that carry timing.
  const timesByTopic = new Map()
  for (const e of answers) {
    if (typeof e.durationMs !== 'number' || e.durationMs <= 0) continue
    const k = String(e.topic || '').toLowerCase()
    if (!timesByTopic.has(k)) timesByTopic.set(k, [])
    timesByTopic.get(k).push(e.durationMs)
  }
  const medByTopic = new Map([...timesByTopic].map(([k, arr]) => [k, median(arr)]))
  const mMap = masteryMap(mastery)

  const wrongs = answers.filter(e => !e.correct)
  const buckets = { careless: new Map(), conceptual: new Map(), timing: new Map(), unclear: new Map() }
  let timed = 0

  for (const e of wrongs) {
    const topic = e.topic || 'a topic'
    const key = String(topic).toLowerCase()
    const mastery0 = mMap.get(key)
    const strong = typeof mastery0 === 'number' && mastery0 >= STRONG_MASTERY
    const easy = typeof e.difficulty === 'number' && e.difficulty <= 0.4
    const med = medByTopic.get(key)
    const dur = typeof e.durationMs === 'number' && e.durationMs > 0 ? e.durationMs : null
    if (dur != null) timed++

    let cat
    if (dur != null && med) {
      if (dur <= med * FAST_FRACTION && (strong || easy)) cat = 'careless'
      else if (dur >= med * SLOW_MULTIPLE) cat = 'timing'
      else cat = strong || easy ? 'careless' : 'conceptual'
    } else {
      // No timing: fall back to what mastery/difficulty alone can support.
      if (strong || easy) cat = 'careless'
      else if (typeof mastery0 === 'number' && mastery0 < 0.4) cat = 'conceptual'
      else cat = 'unclear'
    }
    buckets[cat].set(topic, (buckets[cat].get(topic) || 0) + 1)
  }

  const categories = Object.keys(buckets)
    .map(key => {
      const topics = [...buckets[key].entries()].sort((a, b) => b[1] - a[1])
      const count = topics.reduce((s, [, c]) => s + c, 0)
      return { key, label: CATEGORIES[key].label, fix: CATEGORIES[key].fix, count, topics: topics.map(([t, c]) => ({ topic: t, count: c })) }
    })
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count)

  return { categories, total: wrongs.length, timedShare: wrongs.length ? timed / wrongs.length : 0 }
}
