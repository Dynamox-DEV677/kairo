/**
 * Twin event ingestion.
 *
 * recordEvent() is the single entry point. Every other Kora route that wants
 * the Academic Twin to "see" what happened calls this. Fire-and-forget — never
 * blocks the caller, never throws.
 *
 * Event types intentionally kept small. Add new ones sparingly so the
 * downstream compute logic stays interpretable.
 */
import { supabaseAdmin } from '../supabase.js'

// ── Valid event types ────────────────────────────────────────────────────────
// kind            modality       has_score   has_correct   notes
// ─────────────────────────────────────────────────────────────────────────────
// quiz_answered   interactive    yes (0..100) yes          one row per question
// quiz_completed  interactive    yes          —             aggregate, fires once per session
// lab_opened      visual         —            —             which Kora Lab they entered
// lab_explored    visual         —            —             interacted with a part / control
// flashcard_review repetition    —            yes          SRS review
// essay_graded    text           yes          —             grader output
// note_created    text           —            —             notebook entry
// concept_viewed  visual|text    —            —             concept map / formula sheet
// session_start   —              —            —             user becomes active
// session_end     —              —            —             ~10 min inactivity
// mistake         —              —            no            generic mistake (legacy)
// mastery_up      —              —            —             topic moved past threshold
// mastery_down    —              —            —             topic regressed
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

/**
 * Normalize a topic string so the same idea always lands in the same row.
 * e.g. "Quadratic Equations", "quadratic-equations", "QUADRATIC equations"
 * all become "quadratic equations".
 */
export function normalizeTopic(s) {
  if (!s || typeof s !== 'string') return null
  return s.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').slice(0, 80)
}

/**
 * Record one event. Returns the inserted row id (or null on failure).
 *
 *   await recordEvent({
 *     userId:     'uuid',
 *     schoolId:   'uuid' | null,
 *     eventType:  'quiz_answered',
 *     subject:    'Math',
 *     topic:      'quadratic equations',
 *     score:      80,
 *     correct:    true,
 *     durationMs: 12000,
 *     payload:    { questionId: 'q-42', difficulty: 'hard' },
 *   })
 */
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
      // Most likely cause: twin_schema.sql hasn't been applied to the Supabase
      // project yet. Log once, don't crash the caller.
      console.warn(`[twin/events] insert failed (${eventType}): ${error.message}`)
      return null
    }
    return data?.id || null
  } catch (e) {
    console.warn(`[twin/events] exception (${eventType}): ${e.message}`)
    return null
  }
}

/**
 * Fire-and-forget wrapper. Drop this into any route to log an event without
 * worrying about latency or errors propagating.
 */
export function logEvent(args) {
  recordEvent(args).catch(() => {})
}
