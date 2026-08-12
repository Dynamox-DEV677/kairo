import { Router } from 'express'
import { supabaseAdmin, requireSupabase } from '../services/supabase.js'
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'
import { decayMastery, daysBetween, band } from '../utils/mastery.js'
import { allTopics, resolveTopic } from '../utils/syllabus.js'

/**
 * The Study Engine.
 *
 * Everything here is chosen by code reading the mastery table. The model is
 * never asked "what should this student do next" -- it cannot see the data and
 * would confabulate a plan, which is what the current home screen does with
 * "AI PULSE 30->31/100" and a "+100% trend" on a three-day-old account.
 */

const router = Router()
router.use(requireSupabase)
router.use(requireSupabaseAuth)

/** The 20-minute session, in minutes. Sums to 20. */
const PHASES = [
  { id: 'warmup', label: 'Warm-up',  minutes: 2, source: 'due' },
  { id: 'repair', label: 'Repair',   minutes: 8, source: 'weakest' },
  { id: 'push',   label: 'Push',     minutes: 7, source: 'next-unseen' },
  { id: 'lockin', label: 'Lock-in',  minutes: 3, source: 'recall' },
]

function missingTable(err) {
  const m = String(err?.message || err || '').toLowerCase()
  return m.includes('does not exist') || m.includes('schema cache')
}

/** Mastery rows, aged to today. Decay is applied on read (see mastery.js). */
async function loadMastery(userId) {
  const { data, error } = await supabaseAdmin
    .from('topic_mastery')
    .select('topic_id, mastery, attempts, due_at, last_seen')
    .eq('user_id', userId)
  if (error) {
    if (missingTable(error)) return []
    throw error
  }
  return (data || []).map(r => ({
    ...r,
    mastery: decayMastery(r.mastery, daysBetween(r.last_seen)),
  }))
}

/**
 * GET /api/study/today
 *
 * Everything the home screen needs to answer "what now?" before the student
 * scrolls. One round trip.
 */
router.get('/today', async (req, res) => {
  try {
    const board = String(req.query.board || 'cbse')
    const cls   = req.query.class ? String(req.query.class) : undefined

    const rows = await loadMastery(req.user.id)
    const byId = new Map(rows.map(r => [r.topic_id, r]))
    const now = Date.now()

    const due = rows
      .filter(r => r.due_at && Date.parse(r.due_at) <= now)
      .sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at))

    const weakest = rows
      .filter(r => r.attempts > 0)
      .sort((a, b) => a.mastery - b.mastery)[0] || null

    // "Next in syllabus order the student has not touched." Ordering comes
    // from the map's own sequence, which is chapter order in the textbook --
    // that is what a student's teacher is following too.
    const nextUnseen = allTopics(board, cls).find(t => !byId.has(t.topicId)) || null

    const resumable = await loadOpenSession(req.user.id)

    // A brand-new student has no mastery rows at all. They still get a real
    // task -- an empty grid is the failure the brief is trying to remove.
    const mission = []
    if (due.length) {
      mission.push({
        kind: 'revise',
        label: `Clear ${Math.min(due.length, 3)} due card${due.length === 1 ? '' : 's'}`,
        topicIds: due.slice(0, 3).map(r => r.topic_id),
        why: 'These are scheduled for today by your revision spacing.',
      })
    }
    if (weakest) {
      mission.push({
        kind: 'repair',
        label: `Fix ${nameOf(weakest.topic_id, board, cls)}`,
        topicIds: [weakest.topic_id],
        why: `Your weakest topic — ${Math.round(weakest.mastery * 100)}% mastery over ${weakest.attempts} attempts.`,
      })
    }
    if (nextUnseen) {
      mission.push({
        kind: 'learn',
        label: `Start ${nextUnseen.name}`,
        topicIds: [nextUnseen.topicId],
        why: rows.length
          ? 'Next in your syllabus that you have not touched yet.'
          : 'A place to start — this is the first topic in your syllabus.',
      })
    }

    res.json({
      mission,
      due: due.slice(0, 10).map(r => ({
        topicId: r.topic_id,
        name: nameOf(r.topic_id, board, cls),
        mastery: round2(r.mastery),
        dueAt: r.due_at,
      })),
      weakest: weakest && {
        topicId: weakest.topic_id,
        name: nameOf(weakest.topic_id, board, cls),
        mastery: round2(weakest.mastery),
        band: band(weakest.mastery),
        attempts: weakest.attempts,
      },
      resumable,
      // Honest empty state: with no history there is nothing to be confident
      // about, and the UI needs to know that rather than rendering a 0%.
      hasHistory: rows.length > 0,
      totalTracked: rows.length,
    })
  } catch (e) {
    console.error('[study] today:', e.message)
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Could not build today\'s plan.' } })
  }
})

async function loadOpenSession(userId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('study_sessions')
      .select('id, phase, started_at, minutes_total, minutes_done')
      .eq('user_id', userId).is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1).maybeSingle()
    if (error) { if (missingTable(error)) return null; throw error }
    if (!data) return null
    return {
      sessionId: data.id,
      phase: data.phase,
      minutesLeft: Math.max(0, (data.minutes_total || 20) - (data.minutes_done || 0)),
    }
  } catch (e) {
    console.warn('[study] resume lookup failed:', e.message)
    return null
  }
}

/**
 * POST /api/study/session
 *
 * Server-owned, so closing the app mid-session and coming back on another
 * device resumes rather than restarts. Returns the existing open session
 * instead of creating a second one.
 */
router.post('/session', async (req, res) => {
  try {
    const open = await loadOpenSession(req.user.id)
    if (open) return res.json({ ...open, resumed: true, phases: PHASES })

    const { data, error } = await supabaseAdmin
      .from('study_sessions')
      .insert({
        user_id: req.user.id,
        phase: PHASES[0].id,
        minutes_total: 20,
        minutes_done: 0,
        started_at: new Date().toISOString(),
      })
      .select('id').single()
    if (error) {
      if (missingTable(error)) {
        return res.status(503).json({
          error: { code: 'NOT_SET_UP', message: 'Study sessions are not set up on this project yet.' },
          hint: 'Run server/db/study_sessions_schema.sql in Supabase.',
        })
      }
      throw error
    }

    res.status(201).json({
      sessionId: data.id, phase: PHASES[0].id, minutesLeft: 20,
      resumed: false, phases: PHASES,
    })
  } catch (e) {
    console.error('[study] session:', e.message)
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Could not start a session.' } })
  }
})

/** PATCH /api/study/session/:id — advance phase or finish. */
router.patch('/session/:id', async (req, res) => {
  const { phase, minutesDone, done } = req.body || {}
  if (phase && !PHASES.some(p => p.id === phase)) {
    return res.status(400).json({
      error: { code: 'BAD_INPUT', message: 'Unknown phase.', fields: ['phase'] },
    })
  }
  try {
    const patch = { updated_at: new Date().toISOString() }
    if (phase) patch.phase = phase
    if (typeof minutesDone === 'number') patch.minutes_done = Math.max(0, Math.floor(minutesDone))
    if (done) patch.ended_at = new Date().toISOString()

    const { error } = await supabaseAdmin
      .from('study_sessions').update(patch)
      .eq('id', req.params.id).eq('user_id', req.user.id)
    if (error && !missingTable(error)) throw error
    res.json({ ok: true })
  } catch (e) {
    console.error('[study] patch:', e.message)
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Could not update the session.' } })
  }
})

function nameOf(topicId, board, cls) {
  return resolveTopic(topicId, board, cls)?.name || topicId
}
const round2 = (n) => Math.round(n * 100) / 100

export default router
export { PHASES }
