import { Router } from 'express'
import { supabaseAdmin, requireSupabase } from '../services/supabase.js'
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'
import { resolveTopic, isInScope } from '../utils/syllabus.js'

const router = Router()
router.use(requireSupabase)
router.use(requireSupabaseAuth)

function isMissingTable(err) {
  const msg = String(err?.message || err || '').toLowerCase()
  return msg.includes('does not exist')
      || msg.includes('schema cache')
      || msg.includes('ai_memory')
}

const EMPTY_MEMORY = {
  total:       0,
  weak:        [],
  strong:      [],
  mistakes:    [],
  improved:    [],
  preferences: [],
  all:         [],
}

/** Types that feed the weak/strong lists. Anything unresolvable in one of
 *  these is demoted rather than stored as a topic. */
const CLASSIFYING = new Set(['weak_topic', 'strong_topic', 'mistake', 'quiz_answer'])

router.post('/track', async (req, res) => {
  try {
    const { type, subject, content, signal, hits, topicId, board, class: cls } = req.body || {}
    let { topic } = req.body || {}
    if (!type) return res.json({ message: 'no-op (no type)' })

    // A topic is never free text. Whatever the student typed used to be stored
    // verbatim, which is how "wat is ur name" and "camera study problem" became
    // weak topics and then got fed back into every prompt as context.
    //
    // An explicit topicId is trusted only if it is actually in the map.
    let resolved = null
    if (topicId && isInScope(topicId, board || 'cbse', cls)) {
      resolved = resolveTopic(topicId, board || 'cbse', cls)
    } else if (topic) {
      resolved = resolveTopic(topic, board || 'cbse', cls)
    }

    // Below the confidence floor the event still gets recorded -- throwing it
    // away loses a real signal -- but as `unclassified`, which the weak/strong
    // builders skip. A guessed weakness is worse than a missing one.
    const finalType = (!resolved && CLASSIFYING.has(type)) ? 'unclassified' : type
    if (resolved) topic = resolved.name

    const { data, error } = await supabaseAdmin
      .from('ai_memory')
      .insert({
        user_id: req.user.id,
        type: finalType,
        subject: resolved?.subject || subject,
        topic,
        topic_id: resolved?.topicId || null,
        content,
        signal: signal ?? 0, hits: hits ?? 1,
        last_seen: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      if (isMissingTable(error)) return res.json({ message: 'no-op (table missing)' })
      throw new Error(error.message)
    }
    res.status(201).json({ message: 'Tracked', id: data.id })
  } catch (e) {
    if (isMissingTable(e)) return res.json({ message: 'no-op (table missing)' })
    res.status(500).json({ error: e.message })
  }
})

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_memory')
      .select('*')
      .eq('user_id', req.user.id)
      .order('last_seen', { ascending: false })
      .limit(200)

    if (error) {
      if (isMissingTable(error)) return res.json(EMPTY_MEMORY)
      throw new Error(error.message)
    }

    const weak = [], strong = [], mistakes = [], prefs = []
    for (const m of data) {
      if (m.type === 'weak_topic' || (m.type === 'mistake' && m.signal < -0.3)) weak.push(m)
      else if (m.type === 'strong_topic') strong.push(m)
      else if (m.type === 'preference') prefs.push(m)
      if (m.type === 'mistake') mistakes.push(m)
    }
    weak.sort((a, b) => a.signal - b.signal)
    strong.sort((a, b) => b.signal - a.signal)
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
    if (isMissingTable(e)) return res.json(EMPTY_MEMORY)
    res.status(500).json({ error: e.message })
  }
})

router.get('/context', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_memory')
      .select('type, subject, topic, topic_id, signal, hits, last_seen')
      .eq('user_id', req.user.id)
      .order('last_seen', { ascending: false })
      .limit(40)

    if (error) {
      if (isMissingTable(error)) return res.json(EMPTY_CONTEXT)
      throw new Error(error.message)
    }
    res.json(buildContext(data || []))
  } catch (e) {
    if (isMissingTable(e)) return res.json(EMPTY_CONTEXT)
    res.status(500).json({ error: e.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('ai_memory')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
    if (error && !isMissingTable(error)) throw new Error(error.message)
    res.json({ message: 'Forgotten' })
  } catch (e) {
    if (isMissingTable(e)) return res.json({ message: 'no-op' })
    res.status(500).json({ error: e.message })
  }
})

router.post('/clear', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('ai_memory')
      .delete()
      .eq('user_id', req.user.id)
    if (error && !isMissingTable(error)) throw new Error(error.message)
    res.json({ message: 'Memory cleared.' })
  } catch (e) {
    if (isMissingTable(e)) return res.json({ message: 'no-op' })
    res.status(500).json({ error: e.message })
  }
})

const EMPTY_CONTEXT = { weakTopics: [], strongTopics: [], recentMistakes: [], counts: { total: 0, unclassified: 0 } }

/**
 * Returns structured JSON, not a sentence.
 *
 * This used to emit one flat string -- "Weak topics: wat is ur name, sin30=...,
 * quadratic equations, vectors, quadratic equations, periodic table · Strong
 * topics: periodic table, vectors, vectors" -- which was then pasted straight
 * into the prompt for every AI call. Note the same topic appearing twice in one
 * list and in both lists at once. Formatting is the prompt builder's job; this
 * endpoint's job is to be correct.
 *
 * Three rules enforced here:
 *   - unclassified rows never appear (they have no resolved topicId)
 *   - one row per topicId, aggregated, so nothing repeats
 *   - a topic is weak or strong, never both -- net signal decides
 */
function buildContext(rows) {
  if (!rows?.length) return EMPTY_CONTEXT

  const byTopic = new Map()
  let unclassified = 0

  for (const r of rows) {
    if (r.type === 'unclassified' || !r.topic_id) { unclassified++; continue }
    const cur = byTopic.get(r.topic_id) || {
      topicId: r.topic_id, name: r.topic, subject: r.subject,
      net: 0, attempts: 0, lastSeen: r.last_seen,
    }
    cur.net += Number(r.signal || 0) * Math.max(1, Number(r.hits || 1))
    cur.attempts += Number(r.hits || 1)
    if (r.last_seen > cur.lastSeen) cur.lastSeen = r.last_seen
    byTopic.set(r.topic_id, cur)
  }

  const all = [...byTopic.values()].map(t => ({
    ...t,
    // Squashed to 0..1 so it reads as a mastery estimate rather than a raw
    // tally. A6 replaces this with proper Bayesian tracing.
    mastery: 1 / (1 + Math.exp(-t.net / Math.max(1, t.attempts))),
  }))

  return {
    weakTopics:   all.filter(t => t.mastery < 0.45).sort((a, b) => a.mastery - b.mastery).slice(0, 12),
    strongTopics: all.filter(t => t.mastery > 0.65).sort((a, b) => b.mastery - a.mastery).slice(0, 8),
    recentMistakes: rows
      .filter(r => r.type === 'mistake' && r.topic_id)
      .slice(0, 5)
      .map(r => ({ topicId: r.topic_id, name: r.topic, at: r.last_seen })),
    counts: { total: rows.length, unclassified },
  }
}

export default router
