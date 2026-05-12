/**
 * Kairo OS · Academic Twin REST API.
 *
 *   GET  /api/twin                      twin snapshot (current user)
 *   POST /api/twin/refresh              force recompute (twin + recs + obs)
 *   GET  /api/twin/dashboard            one-shot bundle for the KairoOS UI
 *
 *   GET  /api/twin/mastery              all per-topic mastery rows
 *   GET  /api/twin/retention            forgetting curves for the dashboard
 *
 *   GET  /api/twin/recommendations      open suggestions, ranked
 *   POST /api/twin/recommendations/:id/act       mark as acted
 *   POST /api/twin/recommendations/:id/dismiss   user dismissed
 *
 *   GET  /api/twin/observations         recent supportive insights
 *   POST /api/twin/observations/:id/ack mark as seen
 *
 *   GET  /api/twin/timeline             recent events for the timeline UI
 *   POST /api/twin/event                manual event ingestion
 */
import { Router } from 'express'
import { supabaseAdmin, requireSupabase } from '../services/supabase.js'
import { requireSupabaseAuth }            from '../middleware/supabaseAuth.js'
import {
  recordEvent,
  applyToMastery,
  recomputeTwin,
  getTwin,
  refreshTwinAll,
  retentionFor,
} from '../services/twin/index.js'

const router = Router()
router.use(requireSupabase)
router.use(requireSupabaseAuth)

// ── Helpers ─────────────────────────────────────────────────────────────────
async function readOpenRecs(userId, limit = 10) {
  const { data = [] } = await supabaseAdmin
    .from('twin_recommendations')
    .select('*')
    .eq('user_id', userId)
    .is('acted_at', null)
    .is('dismissed_at', null)
    .order('priority', { ascending: false })
    .limit(limit)
  return data
}

async function readRecentObs(userId, limit = 10) {
  const now = new Date().toISOString()
  const { data = [] } = await supabaseAdmin
    .from('twin_observations')
    .select('*')
    .eq('user_id', userId)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('importance', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  return data
}

// ── GET /api/twin ───────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const twin = await getTwin(req.user.id)
    res.json({ twin })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── POST /api/twin/refresh ──────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const twin = await refreshTwinAll(req.user.id)
    res.json({ twin, refreshed_at: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /api/twin/dashboard ─────────────────────────────────────────────────
// Bundles everything the KairoOS UI needs in one round-trip.
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user.id
    const twin   = await getTwin(userId)

    const [
      { data: mastery = [] },
      recommendations,
      observations,
      { data: recentEvents = [] },
      { data: sessions = [] },
    ] = await Promise.all([
      supabaseAdmin.from('knowledge_mastery').select('*').eq('user_id', userId),
      readOpenRecs(userId, 8),
      readRecentObs(userId, 8),
      supabaseAdmin
        .from('twin_events')
        .select('event_type, subject, topic, score, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabaseAdmin
        .from('study_sessions')
        .select('started_at, duration_min, focus_score')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(14),
    ])

    // Attach current retention to each mastery row (helps the heatmap)
    const masteryWithRet = mastery.map(m => ({
      ...m,
      retention_now: +retentionFor(m).toFixed(3),
    }))

    res.json({
      twin,
      mastery:        masteryWithRet,
      recommendations,
      observations,
      recent_events:  recentEvents,
      sessions,
      generated_at:   new Date().toISOString(),
    })
  } catch (e) {
    console.error('[twin/dashboard]', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── GET /api/twin/mastery ───────────────────────────────────────────────────
router.get('/mastery', async (req, res) => {
  try {
    const { data = [] } = await supabaseAdmin
      .from('knowledge_mastery')
      .select('*')
      .eq('user_id', req.user.id)
      .order('mastery', { ascending: false })
    res.json({ mastery: data.map(m => ({ ...m, retention_now: +retentionFor(m).toFixed(3) })) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /api/twin/retention ─────────────────────────────────────────────────
// Returns a [days × topics] grid of predicted retention for the next 7 days.
router.get('/retention', async (req, res) => {
  try {
    const { data: rows = [] } = await supabaseAdmin
      .from('knowledge_mastery')
      .select('subject, topic, last_studied_at, strength, mastery')
      .eq('user_id', req.user.id)
      .order('mastery', { ascending: false })
      .limit(20)

    const now = new Date()
    const days = []
    for (let d = 0; d < 7; d++) {
      const at = new Date(now.getTime() + d * 86_400_000)
      const day = {
        day_offset: d,
        date:       at.toISOString().slice(0, 10),
        topics:     rows.map(r => ({
          subject:   r.subject,
          topic:     r.topic,
          retention: +retentionFor(r, at).toFixed(3),
        })),
      }
      days.push(day)
    }
    res.json({ days, topic_count: rows.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /api/twin/recommendations ───────────────────────────────────────────
router.get('/recommendations', async (req, res) => {
  try {
    const open = await readOpenRecs(req.user.id, 12)
    res.json({ recommendations: open })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/recommendations/:id/act', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('twin_recommendations')
      .update({ acted_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
    if (error) throw new Error(error.message)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/recommendations/:id/dismiss', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('twin_recommendations')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
    if (error) throw new Error(error.message)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── GET /api/twin/observations ──────────────────────────────────────────────
router.get('/observations', async (req, res) => {
  try {
    const obs = await readRecentObs(req.user.id, 10)
    res.json({ observations: obs })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/observations/:id/ack', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('twin_observations')
      .update({ acknowledged: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
    if (error) throw new Error(error.message)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── GET /api/twin/timeline ──────────────────────────────────────────────────
// Recent activity for the learning timeline visualization.
router.get('/timeline', async (req, res) => {
  try {
    const { data = [] } = await supabaseAdmin
      .from('twin_events')
      .select('event_type, subject, topic, score, correct, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(60)
    res.json({ events: data })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── POST /api/twin/event ────────────────────────────────────────────────────
// Manual event ingestion — useful for the frontend to log lab opens,
// concept views, etc. directly. Triggers an async refresh.
router.post('/event', async (req, res) => {
  try {
    const {
      event_type, subject, topic, score, correct,
      duration_ms, modality, payload,
    } = req.body || {}

    // 1. Record the event
    const id = await recordEvent({
      userId:     req.user.id,
      schoolId:   req.user.school_id,
      eventType:  event_type,
      subject, topic, score, correct,
      durationMs: duration_ms, modality, payload,
    })

    // 2. If the event carries a learning signal, update topic mastery
    if (topic && (typeof correct === 'boolean' || typeof score === 'number')) {
      await applyToMastery({
        userId:     req.user.id,
        subject:    subject || 'General',
        topic,
        correct,
        score,
        difficulty: (payload?.difficulty ?? 0.5),
      })
    }

    // 3. Background refresh — don't make the user wait on it
    refreshTwinAll(req.user.id).catch(() => {})

    res.status(201).json({ ok: true, id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
