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

async function readOpenRecs(userId, limit = 10) {
  const res = await supabaseAdmin
    .from('twin_recommendations')
    .select('*')
    .eq('user_id', userId)
    .is('acted_at', null)
    .is('dismissed_at', null)
    .order('priority', { ascending: false })
    .limit(limit)
  return res.data || []
}

async function readRecentObs(userId, limit = 10) {
  const now = new Date().toISOString()
  const res = await supabaseAdmin
    .from('twin_observations')
    .select('*')
    .eq('user_id', userId)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('importance', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  return res.data || []
}

router.get('/', async (req, res) => {
  try {
    const twin = await getTwin(req.user.id)
    res.json({ twin })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/refresh', async (req, res) => {
  try {
    const twin = await refreshTwinAll(req.user.id)
    res.json({ twin, refreshed_at: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user.id
    const twin   = await getTwin(userId).catch(e => {
      if (e.code === 'TWIN_SCHEMA_MISSING') throw e
      console.warn('[twin/dashboard] getTwin failed:', e.message)
      return null
    })

    const [
      masteryRes,
      recommendations,
      observations,
      eventsRes,
      sessionsRes,
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

    const mastery       = masteryRes.data || []
    const recentEvents  = eventsRes.data  || []
    const sessions      = sessionsRes.data || []

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
    if (e.code === 'TWIN_SCHEMA_MISSING') {
      return res.status(503).json({
        error: e.message,
        setup_required: true,
        sql_file: 'kairo-dashboard/server/db/twin_schema.sql',
      })
    }
    res.status(500).json({ error: e.message })
  }
})

router.get('/mastery', async (req, res) => {
  try {
    const r = await supabaseAdmin
      .from('knowledge_mastery')
      .select('*')
      .eq('user_id', req.user.id)
      .order('mastery', { ascending: false })
    const data = r.data || []
    res.json({ mastery: data.map(m => ({ ...m, retention_now: +retentionFor(m).toFixed(3) })) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/retention', async (req, res) => {
  try {
    const r = await supabaseAdmin
      .from('knowledge_mastery')
      .select('subject, topic, last_studied_at, strength, mastery')
      .eq('user_id', req.user.id)
      .order('mastery', { ascending: false })
      .limit(20)
    const rows = r.data || []

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

router.get('/snapshot', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('twin_snapshots')
      .select('blob, schema_ver, events_count, device_label, updated_at')
      .eq('user_id', req.user.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return res.json({ snapshot: null })
    res.json({
      snapshot: {
        blob:         data.blob,
        schemaVer:    data.schema_ver,
        eventsCount:  data.events_count,
        deviceLabel:  data.device_label,
        updatedAt:    data.updated_at,
      },
    })
  } catch (e) {
    if (/relation .* does not exist/i.test(e.message || '')) {
      console.warn('[twin/snapshot] table missing — run twin_snapshot_schema.sql')
      return res.json({ snapshot: null, setup_required: true })
    }
    res.status(500).json({ error: e.message })
  }
})

router.post('/snapshot', async (req, res) => {
  try {
    const { blob, deviceLabel, eventsCount } = req.body || {}
    if (!blob || typeof blob !== 'object') {
      return res.status(400).json({ error: 'blob is required and must be an object' })
    }
    const sizeBytes = JSON.stringify(blob).length
    if (sizeBytes > 1_500_000) {
      return res.status(413).json({ error: 'snapshot too large', size_bytes: sizeBytes })
    }

    const { error } = await supabaseAdmin
      .from('twin_snapshots')
      .upsert({
        user_id:       req.user.id,
        blob,
        schema_ver:    'kairo-twin-backup-v1',
        device_label:  (deviceLabel || '').toString().slice(0, 120) || null,
        events_count:  Number.isFinite(+eventsCount) ? +eventsCount : null,
        updated_at:    new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (error) throw new Error(error.message)
    res.json({ ok: true, updated_at: new Date().toISOString() })
  } catch (e) {
    if (/relation .* does not exist/i.test(e.message || '')) {
      return res.status(503).json({
        error: 'twin_snapshots table not present',
        setup_required: true,
        sql_file: 'kairo-dashboard/server/db/twin_snapshot_schema.sql',
      })
    }
    res.status(500).json({ error: e.message })
  }
})

router.delete('/snapshot', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('twin_snapshots')
      .delete()
      .eq('user_id', req.user.id)
    if (error) throw new Error(error.message)
    res.json({ ok: true, deleted_at: new Date().toISOString() })
  } catch (e) {
    if (/relation .* does not exist/i.test(e.message || '')) {
      return res.json({ ok: true, deleted_at: new Date().toISOString() })
    }
    res.status(500).json({ error: e.message })
  }
})

router.post('/event', async (req, res) => {
  try {
    const {
      event_type, subject, topic, score, correct,
      duration_ms, modality, payload,
    } = req.body || {}

    const id = await recordEvent({
      userId:     req.user.id,
      schoolId:   req.user.school_id,
      eventType:  event_type,
      subject, topic, score, correct,
      durationMs: duration_ms, modality, payload,
    })

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

    refreshTwinAll(req.user.id).catch(() => {})

    res.status(201).json({ ok: true, id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
