import { supabaseAdmin } from '../supabase.js'

export const EVENT_TYPES = new Set([
  'quiz_answered', 'quiz_completed',
  'lab_opened', 'lab_explored',
  'flashcard_review',
  'essay_graded',
  'note_created',
  'concept_viewed',
  'session_start', 'session_end',
  'mistake',
  'mastery_up', 'mastery_down',
])

const MODALITY_BY_DEFAULT = {
  quiz_answered:    'interactive',
  quiz_completed:   'interactive',
  lab_opened:       'visual',
  lab_explored:     'visual',
  flashcard_review: 'repetition',
  essay_graded:     'text',
  note_created:     'text',
  concept_viewed:   'visual',
}

export function normalizeTopic(s) {
  if (!s || typeof s !== 'string') return null
  return s.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').slice(0, 80)
}

export async function recordEvent({
  userId,
  schoolId,
  eventType,
  subject,
  topic,
  score,
  correct,
  durationMs,
  modality,
  payload,
}) {
  if (!userId)               return null
  if (!EVENT_TYPES.has(eventType)) {
    console.warn(`[twin/events] unknown event_type: ${eventType}`)
    return null
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('twin_events')
      .insert({
        user_id:     userId,
        school_id:   schoolId    || null,
        event_type:  eventType,
        subject:     subject     || null,
        topic:       normalizeTopic(topic),
        score:       typeof score === 'number' ? score : null,
        correct:     typeof correct === 'boolean' ? correct : null,
        duration_ms: typeof durationMs === 'number' ? durationMs : null,
        modality:    modality || MODALITY_BY_DEFAULT[eventType] || null,
        payload:     payload || {},
      })
      .select('id')
      .single()

    if (error) {
      console.warn(`[twin/events] insert failed (${eventType}): ${error.message}`)
      return null
    }
    return data?.id || null
  } catch (e) {
    console.warn(`[twin/events] exception (${eventType}): ${e.message}`)
    return null
  }
}

export function logEvent(args) {
  recordEvent(args).catch(() => {})
}
