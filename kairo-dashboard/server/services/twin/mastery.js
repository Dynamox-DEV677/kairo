import { supabaseAdmin } from '../supabase.js'
import { normalizeTopic } from './events.js'

const ALPHA = 0.28

const RETENTION_THRESHOLD = 0.6
function forgetHours(strength) {
  return Math.max(1, strength * 24 * 0.511)
}

export async function applyToMastery({
  userId, subject, topic, correct, score, difficulty = 0.5,
}) {
  const normTopic = normalizeTopic(topic)
  if (!userId || !normTopic) return null

  try {
    const { data: existing } = await supabaseAdmin
      .from('knowledge_mastery')
      .select('*')
      .eq('user_id', userId)
      .eq('subject', subject || 'General')
      .eq('topic', normTopic)
      .maybeSingle()

    const now = new Date()

    let signal
    if (typeof correct === 'boolean') {
      signal = correct ? 1 : 0
    } else if (typeof score === 'number') {
      signal = Math.max(0, Math.min(1, score / 100))
    } else {
      signal = null
    }

    let mastery   = existing?.mastery   ?? 0.4
    let strength  = existing?.strength  ?? 1.0
    let attempts  = (existing?.attempts ?? 0) + (signal != null ? 1 : 0)
    let correctN  = (existing?.correct  ?? 0) + (signal != null && signal >= 0.5 ? 1 : 0)

    if (signal != null) {
      const weighted = signal * (0.6 + 0.4 * difficulty)
      mastery = (1 - ALPHA) * mastery + ALPHA * weighted

      if (signal >= 0.5) {
        strength = Math.min(strength * (1.6 + 1.2 * difficulty), 90)
      } else {
        strength = Math.max(strength * 0.5, 0.25)
      }
    }

    const forgetAt = new Date(now.getTime() + forgetHours(strength) * 3600_000)
    const lastCorrect = signal != null && signal >= 0.5 ? now.toISOString() : existing?.last_correct_at

    const row = {
      user_id:         userId,
      subject:         subject || 'General',
      topic:           normTopic,
      mastery:         Number(mastery.toFixed(4)),
      attempts,
      correct:         correctN,
      last_studied_at: now.toISOString(),
      last_correct_at: lastCorrect,
      forget_at:       forgetAt.toISOString(),
      strength:        Number(strength.toFixed(4)),
      difficulty_pref: Number((existing?.difficulty_pref ?? 0.5).toFixed(4)),
      updated_at:      now.toISOString(),
    }

    const { error } = await supabaseAdmin
      .from('knowledge_mastery')
      .upsert(row, { onConflict: 'user_id,subject,topic' })

    if (error) {
      console.warn(`[twin/mastery] upsert failed for ${normTopic}: ${error.message}`)
      return null
    }
    return row
  } catch (e) {
    console.warn(`[twin/mastery] exception: ${e.message}`)
    return null
  }
}

export function retentionFor(row, atTime = new Date()) {
  if (!row || !row.last_studied_at || !row.strength) return 0
  const hoursSince = (atTime.getTime() - new Date(row.last_studied_at).getTime()) / 3600_000
  return Math.max(0, Math.exp(-hoursSince / Math.max(0.5, row.strength)))
}
