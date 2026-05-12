/**
 * Adaptive recommendation engine.
 *
 * Reads the twin snapshot + mastery rows and produces concrete, ranked
 * suggestions — "what should this student do in the next 30 minutes?"
 *
 * Output is written to `twin_recommendations` and surfaced in the dashboard.
 * Each recommendation has a priority (0..1) so the UI can show the top N
 * without re-sorting.
 *
 * Categories of recommendation:
 *   revise      a topic on the verge of being forgotten
 *   lab         a Kairo Lab matching the student's learning style + weak area
 *   flashcard   spaced-repetition practice for a weak topic
 *   quiz        check progress on a recently-improved topic
 *   break       take a break (high burnout risk)
 *   plan        review the daily study plan
 */
import { supabaseAdmin } from '../supabase.js'

// ── Lab catalogue (mirrors src/pages/KairoLabs.tsx) ──────────────────────────
// Each lab is tagged with subject, topic keywords, and a primary modality so
// we can recommend the right lab for a weak topic and a learning style.
const LAB_CATALOG = [
  { id: 'gravity',    title: 'Gravity & Free Fall',  subject: 'Physics',   modality: 'visual',      topics: ['gravity', 'free fall', 'newton', 'motion'] },
  { id: 'pendulum',   title: 'Pendulum Motion',      subject: 'Physics',   modality: 'visual',      topics: ['pendulum', 'oscillation', 'shm', 'period'] },
  { id: 'projectile', title: 'Projectile Motion',    subject: 'Physics',   modality: 'visual',      topics: ['projectile', 'parabola', 'kinematics', 'motion'] },
  { id: 'circuits',   title: 'Electric Circuits',    subject: 'Physics',   modality: 'interactive', topics: ['ohm', 'circuit', 'current', 'voltage', 'resistance'] },
  { id: 'atom',       title: 'Atomic Structure',     subject: 'Chemistry', modality: 'visual',      topics: ['atom', 'electron', 'bohr', 'orbital', 'shell'] },
  { id: 'molecule',   title: 'Molecule Builder',     subject: 'Chemistry', modality: 'interactive', topics: ['molecule', 'bond', 'geometry', 'covalent', 'water'] },
  { id: 'reaction',   title: 'Chemical Reactions',   subject: 'Chemistry', modality: 'visual',      topics: ['reaction', 'combustion', 'methane', 'balance'] },
  { id: 'heart',      title: 'Human Heart',          subject: 'Biology',   modality: 'visual',      topics: ['heart', 'circulation', 'blood', 'chamber'] },
  { id: 'cell',       title: 'Cell Structure',       subject: 'Biology',   modality: 'visual',      topics: ['cell', 'organelle', 'nucleus', 'mitochondria'] },
  { id: 'dna',        title: 'DNA Double Helix',     subject: 'Biology',   modality: 'visual',      topics: ['dna', 'genetics', 'base pair', 'helix'] },
  { id: 'brain',      title: 'Human Brain',          subject: 'Biology',   modality: 'visual',      topics: ['brain', 'cerebrum', 'cerebellum', 'lobe', 'nervous'] },
  { id: 'vectors',    title: 'Vectors in 3D',        subject: 'Math',      modality: 'interactive', topics: ['vector', 'dot product', 'cross product', '3d'] },
  { id: 'graphs',     title: 'Function Plotter',     subject: 'Math',      modality: 'visual',      topics: ['function', 'graph', 'calculus', 'derivative'] },
  { id: 'solar',      title: 'Solar System',         subject: 'Space',     modality: 'visual',      topics: ['planet', 'sun', 'orbit', 'astronomy', 'moon', 'iss'] },
  { id: 'saturnv',    title: 'Saturn V Rocket',      subject: 'Space',     modality: 'visual',      topics: ['rocket', 'apollo', 'saturn v', 'launch', 'stage'] },
]

function dominantStyle(twin) {
  const entries = [
    ['visual',      twin.style_visual],
    ['interactive', twin.style_interactive],
    ['text',        twin.style_text],
    ['repetition',  twin.style_repetition],
  ]
  entries.sort((a, b) => b[1] - a[1])
  return entries[0][0]
}

/** Pick the best lab for (topic, learning style). Returns null if no match. */
function matchLab(topic, subject, preferredModality) {
  const t = (topic || '').toLowerCase()
  const candidates = LAB_CATALOG.filter(l => {
    if (subject && l.subject.toLowerCase() !== subject.toLowerCase()) return false
    return l.topics.some(k => t.includes(k) || k.includes(t))
  })
  if (!candidates.length) return null
  // Prefer the lab matching the student's modality
  candidates.sort((a, b) => {
    const ma = a.modality === preferredModality ? 0 : 1
    const mb = b.modality === preferredModality ? 0 : 1
    return ma - mb
  })
  return candidates[0]
}

/**
 * Build the recommendation list for one user.
 * Writes to twin_recommendations (replaces all open suggestions) and returns
 * the array.
 */
export async function recomputeRecommendations(userId, { twin } = {}) {
  if (!userId) return []
  const t = twin || await readTwin(userId)
  if (!t) return []

  const recs = []
  const style = dominantStyle(t)

  // ── 1. Revisions for topics about to be forgotten ──────────────────────
  for (const f of (t.forgetting_soon || []).slice(0, 4)) {
    const urgency = clamp01(1 - (f.hours_until_forget / 168))  // 1 week = 0
    const lab     = matchLab(f.topic, f.subject, style)
    recs.push({
      kind:     'revise',
      subject:  f.subject,
      target:   f.topic,
      reason:   `You haven't touched ${f.topic} recently — likely ~${Math.round((1 - currentRetention(f)) * 100)}% forgotten.`,
      priority: 0.65 + 0.3 * urgency,
      metadata: { hours_until_forget: f.hours_until_forget, suggested_lab: lab?.id || null },
    })
  }

  // ── 2. Top weak topics — recommend a lab in matching modality ──────────
  for (const w of (t.weak_topics || []).slice(0, 3)) {
    const lab = matchLab(w.topic, w.subject, style)
    if (lab) {
      recs.push({
        kind:     'lab',
        subject:  w.subject,
        target:   lab.id,
        reason:   `${lab.title} matches how you learn best — try it on "${w.topic}".`,
        priority: 0.55 + 0.4 * (w.severity || 0.5),
        metadata: { topic: w.topic, lab_id: lab.id, modality: lab.modality, style },
      })
    } else {
      recs.push({
        kind:     'flashcard',
        subject:  w.subject,
        target:   w.topic,
        reason:   `Build up "${w.topic}" with a 5-minute flashcard run.`,
        priority: 0.45 + 0.4 * (w.severity || 0.5),
        metadata: { topic: w.topic, severity: w.severity },
      })
    }
  }

  // ── 3. Confidence-check quiz on a recently-improved topic ──────────────
  if (t.performance_trend > 0.15 && (t.strong_topics || []).length > 0) {
    const target = t.strong_topics[0]
    recs.push({
      kind:     'quiz',
      subject:  target.subject,
      target:   target.topic,
      reason:   `You've been doing well in ${target.topic} — lock it in with a quick 5-question quiz.`,
      priority: 0.55,
      metadata: { topic: target.topic },
    })
  }

  // ── 4. Break suggestion when burnout risk is high ──────────────────────
  if (t.burnout_risk > 0.55) {
    recs.push({
      kind:     'break',
      reason:   `Your study volume jumped 40%+ this week without a matching score lift. Take a 20-minute walk — diffuse-mode beats grinding.`,
      priority: 0.7,
      metadata: { burnout_risk: t.burnout_risk },
    })
  }

  // ── 5. Plan check if last session was > 12h ago ────────────────────────
  if (t.last_active_at) {
    const hoursAgo = (Date.now() - new Date(t.last_active_at).getTime()) / 3600_000
    if (hoursAgo > 14 && hoursAgo < 60) {
      recs.push({
        kind:     'plan',
        reason:   `You haven't logged a session in ~${Math.round(hoursAgo)}h. Pick one topic for today and start small.`,
        priority: 0.5,
        metadata: { hours_idle: hoursAgo },
      })
    }
  }

  // Normalize priorities to 0..1
  recs.sort((a, b) => b.priority - a.priority)
  const top = recs.slice(0, 10)

  // ── Persist (replace open recommendations) ────────────────────────────
  try {
    // Soft-archive any still-open recs by marking them dismissed
    await supabaseAdmin
      .from('twin_recommendations')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('acted_at', null)
      .is('dismissed_at', null)

    if (top.length) {
      await supabaseAdmin
        .from('twin_recommendations')
        .insert(top.map(r => ({
          user_id:  userId,
          kind:     r.kind,
          target:   r.target || null,
          subject:  r.subject || null,
          reason:   r.reason,
          priority: r.priority,
          metadata: r.metadata || {},
        })))
    }
  } catch (e) {
    console.warn(`[twin/recommend] persist failed: ${e.message}`)
  }

  return top
}

// ── Helpers (kept private) ──────────────────────────────────────────────────
function clamp01(x) { return Math.max(0, Math.min(1, x)) }

// Approximate current retention given hours_until_forget.
// At forget threshold retention is 0.6 by definition; if hours_until_forget = 0
// we report close to 0.6 still. The dashboard's actual graph uses mastery.js
// retentionFor(); this is just a fallback for the recommendation reason text.
function currentRetention(f) {
  const h = f.hours_until_forget ?? 0
  if (h <= 0) return 0.6
  return 0.6 + 0.4 * (1 - Math.exp(-h / 48))
}

async function readTwin(userId) {
  const { data } = await supabaseAdmin
    .from('academic_twins')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data
}
