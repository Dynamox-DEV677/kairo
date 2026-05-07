/**
 * AI Memory Brain — every student has a persistent memory
 *
 * - Mistakes (wrong answers, low-scored answers)
 * - Weak topics (concepts the student struggles with)
 * - Strong topics (mastered concepts)
 * - Preferences (learning style hints)
 *
 * Used by AI features to personalize responses (e.g. Doubt Solver injects
 * "this student is weak in 'quadratic equations'" into the system prompt).
 *
 * Routes:
 *   POST   /api/memory/track     Record an observation (mistakes, scores, etc.)
 *   GET    /api/memory           Read my memory (weak / strong / recent)
 *   GET    /api/memory/context   Compact prompt-ready summary for AI calls
 *   DELETE /api/memory/:id       Forget an entry
 *   POST   /api/memory/clear     Wipe all my memory
 */
import { Router } from 'express'
import { supabaseAdmin, requireSupabase } from '../services/supabase.js'
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'

const router = Router()
router.use(requireSupabase)
router.use(requireSupabaseAuth)

const VALID_TYPES = ['mistake', 'weak_topic', 'strong_topic', 'preference', 'note']

// ── Track an observation ─────────────────────────────────────────────────────
router.post('/track', async (req, res) => {
  const { type, subject, topic, content, signal } = req.body || {}
  if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` })
  }
  if (!topic && !content) return res.status(400).json({ error: 'topic or content is required' })

  const numSignal = typeof signal === 'number' ? Math.max(-1, Math.min(1, signal)) :
    type === 'mistake' || type === 'weak_topic' ? -0.4 :
    type === 'strong_topic' ? 0.5 : 0

  try {
    // Upsert by (user_id, type, topic) — increment hits if already exists
    const key = (topic || content || '').toLowerCase().trim()
    const { data: existing } = await supabaseAdmin
      .from('ai_memory')
      .select('id, hits, signal')
      .eq('user_id', req.user.id)
      .eq('type', type)
      .ilike('topic', key)
      .maybeSingle()

    if (existing) {
      // Reinforce: weighted average of signal, increment hits, refresh last_seen
      const newSignal = Math.max(-1, Math.min(1,
        (existing.signal * existing.hits + numSignal) / (existing.hits + 1)
      ))
      const { error } = await supabaseAdmin
        .from('ai_memory')
        .update({
          hits: existing.hits + 1,
          signal: newSignal,
          last_seen: new Date().toISOString(),
          content: content || undefined,
        })
        .eq('id', existing.id)
      if (error) throw new Error(error.message)
      return res.json({ message: 'Updated', id: existing.id, hits: existing.hits + 1 })
    }

    const { data, error } = await supabaseAdmin
      .from('ai_memory')
      .insert({
        user_id:   req.user.id,
        school_id: req.schoolId || null,
        type,
        subject:   subject?.trim() || null,
        topic:     key || null,
        content:   content?.trim() || null,
        signal:    numSignal,
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)
    res.status(201).json({ message: 'Tracked', id: data.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Read my memory ────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_memory')
      .select('*')
      .eq('user_id', req.user.id)
      .order('last_seen', { ascending: false })
      .limit(200)

    if (error) throw new Error(error.message)

    // Bucketize for the UI
    const weak     = []
    const strong   = []
    const mistakes = []
    const prefs    = []
    for (const m of data) {
      if (m.type === 'weak_topic'   || (m.type === 'mistake' && m.signal < -0.3)) weak.push(m)
      else if (m.type === 'strong_topic') strong.push(m)
      else if (m.type === 'preference') prefs.push(m)
      if (m.type === 'mistake') mistakes.push(m)
    }
    weak.sort((a, b) => a.signal - b.signal)
    strong.sort((a, b) => b.signal - a.signal)

    // Recently improved: things that used to be weak but the latest signal is positive
    const improved = data.filter(m => m.signal > 0.3 && m.hits > 1).slice(0, 6)

    res.json({
      total:    data.length,
      weak:     weak.slice(0, 12),
      strong:   strong.slice(0, 8),
      mistakes: mistakes.slice(0, 20),
      improved,
      preferences: prefs,
      all:      data,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Compact prompt-ready summary (used internally + by frontend if it wants) ──
router.get('/context', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_memory')
      .select('type, subject, topic, signal, hits')
      .eq('user_id', req.user.id)
      .order('last_seen', { ascending: false })
      .limit(40)

    if (error) throw new Error(error.message)
    res.json({ context: buildPromptContext(data || []) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Forget an entry ───────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from('ai_memory')
      .select('user_id')
      .eq('id', req.params.id)
      .single()
    if (!existing || existing.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your memory entry.' })
    }

    const { error } = await supabaseAdmin
      .from('ai_memory')
      .delete()
      .eq('id', req.params.id)
    if (error) throw new Error(error.message)
    res.json({ message: 'Forgotten' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Wipe all memory for the current user ──────────────────────────────────────
router.post('/clear', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('ai_memory')
      .delete()
      .eq('user_id', req.user.id)
    if (error) throw new Error(error.message)
    res.json({ message: 'Memory cleared.' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Helpers ──────────────────────────────────────────────────────────────────
export function buildPromptContext(memories) {
  if (!memories?.length) return ''
  const weak = memories.filter(m =>
    (m.type === 'weak_topic' || m.type === 'mistake') && (m.signal ?? 0) < -0.2
  ).slice(0, 6).map(m => `${m.topic}${m.subject ? ' (' + m.subject + ')' : ''}`)
  const strong = memories.filter(m => m.type === 'strong_topic' && (m.signal ?? 0) > 0.3)
    .slice(0, 4).map(m => m.topic)
  const lines = []
  if (weak.length)   lines.push(`Student struggles with: ${weak.join(', ')}.`)
  if (strong.length) lines.push(`Student is strong in: ${strong.join(', ')}.`)
  if (!lines.length) return ''
  return `\n\n[Personalization context — use this to tailor your response]\n${lines.join(' ')}\nWhen the question relates to weak areas, explain extra carefully and connect to what they already know.`
}

// ── Server-side helper used by other routes (quiz, grader) to track silently ──
export async function trackMemory(userId, schoolId, observation) {
  const { type, subject, topic, content, signal } = observation
  if (!userId || !type || !VALID_TYPES.includes(type)) return null
  if (!topic && !content) return null

  const key = (topic || content || '').toLowerCase().trim()
  const numSignal = typeof signal === 'number' ? Math.max(-1, Math.min(1, signal)) :
    type === 'mistake' || type === 'weak_topic' ? -0.4 :
    type === 'strong_topic' ? 0.5 : 0

  try {
    const { data: existing } = await supabaseAdmin
      .from('ai_memory')
      .select('id, hits, signal')
      .eq('user_id', userId)
      .eq('type', type)
      .ilike('topic', key)
      .maybeSingle()

    if (existing) {
      const newSignal = Math.max(-1, Math.min(1,
        (existing.signal * existing.hits + numSignal) / (existing.hits + 1)
      ))
      await supabaseAdmin.from('ai_memory').update({
        hits: existing.hits + 1,
        signal: newSignal,
        last_seen: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await supabaseAdmin.from('ai_memory').insert({
        user_id: userId, school_id: schoolId || null,
        type, subject: subject || null, topic: key, content: content || null,
        signal: numSignal,
      })
    }
  } catch (e) {
    console.warn('[trackMemory]', e.message)
  }
}

export default router
