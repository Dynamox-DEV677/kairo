/**
 * AI Observations — short, supportive insights generated from the twin state.
 *
 * Tone: encouraging, specific, never invasive. Each observation has a kind:
 *   insight       — discovered pattern ("you study best at 9 PM")
 *   pattern       — neutral fact about behaviour
 *   milestone     — celebration ("first 7-day streak!")
 *   concern       — supportive nudge ("burnout risk rising — take a walk")
 *   celebration   — performance win ("vectors up 23%")
 *
 * Rules-based for v1; the prompt-ready output can be LLM-rephrased async
 * without changing the wire format.
 */
import { supabaseAdmin } from '../supabase.js'

const KEEP_HOURS = 72       // surface each observation for ~3 days then expire

function isoIn(hours) {
  return new Date(Date.now() + hours * 3600_000).toISOString()
}

function buildObservations(twin, masteryRows, recentEvents) {
  const out = []

  // ── Learning style ─────────────────────────────────────────────────────
  const styleEntries = [
    ['visual',      twin.style_visual,      'You learn better when you can SEE the concept.'],
    ['interactive', twin.style_interactive, 'You retain more when you DO something with the concept.'],
    ['text',        twin.style_text,        'You absorb concepts better from reading + reflection.'],
    ['repetition',  twin.style_repetition,  'You lock concepts in via spaced flashcard review.'],
  ].sort((a, b) => b[1] - a[1])

  const [topStyleId, topStyleScore, topStyleHint] = styleEntries[0]
  if (topStyleScore > 0.42) {
    out.push({
      kind: 'insight',
      tone: 'supportive',
      title: `You're a ${topStyleId} learner`,
      body:  topStyleHint,
      importance: 0.6,
    })
  }

  // ── Best focus hour ────────────────────────────────────────────────────
  if (twin.focus_best_hour != null) {
    const h = twin.focus_best_hour
    const window = h < 6 ? 'late night'
      : h < 12 ? 'morning'
      : h < 17 ? 'afternoon'
      : h < 21 ? 'evening'
      : 'night'
    out.push({
      kind:  'pattern',
      tone:  'neutral',
      title: `You score highest around ${h}:00`,
      body:  `Your ${window} sessions consistently outperform other times. Block ${h}:00–${(h + 1) % 24}:00 for hard topics.`,
      importance: 0.5,
    })
  }

  // ── Performance trend ──────────────────────────────────────────────────
  if (twin.performance_trend > 0.18) {
    out.push({
      kind:  'celebration',
      tone:  'supportive',
      title: `Your scores are trending up`,
      body:  `Recent quiz/grade results show consistent improvement. Keep the cadence — don't change what's working.`,
      importance: 0.7,
    })
  } else if (twin.performance_trend < -0.18) {
    out.push({
      kind:  'concern',
      tone:  'caution',
      title: `Scores are dipping`,
      body:  `Recent results trend slightly downward. One bad week isn't the pattern — but pick the weakest topic below and put 25 minutes into it tonight.`,
      importance: 0.75,
    })
  }

  // ── Burnout ────────────────────────────────────────────────────────────
  if (twin.burnout_risk > 0.55) {
    out.push({
      kind:  'concern',
      tone:  'caution',
      title: `Sustainable pace > maximum pace`,
      body:  `Your study minutes spiked recently but scores aren't following. Sleep and 20-min walks are part of learning, not breaks from it.`,
      importance: 0.85,
    })
  }

  // ── Streak milestones ──────────────────────────────────────────────────
  const streakMilestones = [3, 7, 14, 30, 60, 100]
  if (streakMilestones.includes(twin.streak_days)) {
    out.push({
      kind:  'milestone',
      tone:  'supportive',
      title: `${twin.streak_days}-day streak 🔥`,
      body:  `Showing up every day is the hardest part. You've nailed it for ${twin.streak_days} days running.`,
      importance: 0.8,
    })
  }

  // ── Mastery breakthroughs ──────────────────────────────────────────────
  const newlyStrong = masteryRows.filter(m => m.mastery >= 0.75 && m.attempts >= 5)
  if (newlyStrong.length > 0) {
    const m = newlyStrong[0]
    out.push({
      kind:  'celebration',
      tone:  'supportive',
      title: `You've got ${m.topic}`,
      body:  `Mastery is ${(m.mastery * 100).toFixed(0)}% across ${m.attempts} attempts. Consider it locked in.`,
      topic: m.topic,
      importance: 0.65,
    })
  }

  // ── Weak topic awareness ───────────────────────────────────────────────
  const persistent = (twin.weak_topics || []).filter(w => (w.severity || 0) > 0.55).slice(0, 2)
  for (const w of persistent) {
    out.push({
      kind:  'pattern',
      tone:  'neutral',
      title: `"${w.topic}" needs attention`,
      body:  `You've spent time on ${w.topic} but mastery is still ${Math.round((1 - w.severity) * 100)}%. A different angle (lab / video / flashcards) often unblocks this.`,
      topic: w.topic,
      importance: 0.55,
    })
  }

  // ── Consistency callout ────────────────────────────────────────────────
  if (twin.consistency_score >= 0.65) {
    out.push({
      kind:  'pattern',
      tone:  'supportive',
      title: `Highly consistent`,
      body:  `You've shown up ${Math.round(twin.consistency_score * 14)} of the last 14 days. Consistency beats intensity at your level.`,
      importance: 0.5,
    })
  } else if (twin.consistency_score < 0.25 && recentEvents.length > 0) {
    out.push({
      kind:  'pattern',
      tone:  'neutral',
      title: `Sporadic schedule`,
      body:  `Your study days are scattered. Pick three fixed half-hour slots this week — that's the cheapest performance gain you can make.`,
      importance: 0.55,
    })
  }

  return out
}

/**
 * Recompute observations for a user.
 * Deletes the previous batch (older than 1 day) and inserts a fresh set.
 */
export async function recomputeObservations(userId) {
  if (!userId) return []
  // Pull twin + mastery + a small slice of recent events
  const [{ data: twin }, { data: masteryRows = [] }, { data: events = [] }] = await Promise.all([
    supabaseAdmin.from('academic_twins').select('*').eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('knowledge_mastery').select('*').eq('user_id', userId).order('mastery', { ascending: false }),
    supabaseAdmin.from('twin_events').select('event_type, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
  ])
  if (!twin) return []

  const obs = buildObservations(twin, masteryRows, events)
  if (!obs.length) return []

  // Expire old observations (soft delete) and insert new ones
  try {
    await supabaseAdmin
      .from('twin_observations')
      .delete()
      .eq('user_id', userId)
      .or(`expires_at.lt.${new Date().toISOString()},expires_at.is.null`)
      .lt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())

    await supabaseAdmin
      .from('twin_observations')
      .insert(obs.map(o => ({
        user_id:    userId,
        kind:       o.kind,
        tone:       o.tone || 'supportive',
        title:      o.title,
        body:       o.body,
        topic:      o.topic || null,
        importance: o.importance,
        expires_at: isoIn(KEEP_HOURS),
      })))
  } catch (e) {
    console.warn(`[twin/observe] persist failed: ${e.message}`)
  }

  return obs
}
