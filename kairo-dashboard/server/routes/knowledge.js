/**
 * Knowledge Graph Engine
 *
 * Persistent graph of concept relationships PER STUDENT, derived from:
 *   - ai_memory entries (topics + their signal)
 *   - AI-extracted relationships (prerequisite-of, related-to, builds-on)
 *
 * Routes:
 *   GET  /api/knowledge/graph        Full graph (nodes + edges) for current user
 *   POST /api/knowledge/extract      AI infers relationships from a topic + adds to graph
 *   POST /api/knowledge/relate       Manually add a single concept relation
 *   DELETE /api/knowledge/relation/:id   Remove a relation
 */
import { Router } from 'express'
import { supabaseAdmin, requireSupabase } from '../services/supabase.js'
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'

const router = Router()
router.use(requireSupabase)
router.use(requireSupabaseAuth)

const VALID_KINDS = ['prerequisite_of', 'related_to', 'builds_on', 'contrasts_with', 'example_of']

// Build the graph view: nodes from ai_memory + concept_relations entries; edges from concept_relations
router.get('/graph', async (req, res) => {
  try {
    const [memRes, relRes] = await Promise.all([
      supabaseAdmin
        .from('ai_memory')
        .select('topic, subject, signal, hits, type')
        .eq('user_id', req.user.id)
        .limit(80),
      supabaseAdmin
        .from('concept_relations')
        .select('id, from_topic, to_topic, kind, confidence, created_at')
        .eq('user_id', req.user.id)
        .limit(400),
    ])
    if (memRes.error) throw new Error(memRes.error.message)
    if (relRes.error) throw new Error(relRes.error.message)

    // Build node set: every distinct topic from memory or relations
    const nodes = {}
    function addNode(topic, source) {
      if (!topic) return
      const key = topic.toLowerCase().trim()
      if (!nodes[key]) {
        nodes[key] = {
          id: key,
          label: topic,
          subject: source?.subject || null,
          signal:  source?.signal ?? 0,
          hits:    source?.hits ?? 0,
          types:   source?.type ? [source.type] : [],
        }
      } else {
        if (source?.subject && !nodes[key].subject) nodes[key].subject = source.subject
        if (source?.hits != null) nodes[key].hits = Math.max(nodes[key].hits, source.hits)
        if (source?.signal != null) {
          // Average signal weighted by hits
          const totalHits = nodes[key].hits + (source.hits || 1)
          nodes[key].signal = ((nodes[key].signal * nodes[key].hits) + (source.signal * (source.hits || 1))) / Math.max(totalHits, 1)
        }
      }
    }
    for (const m of memRes.data || []) addNode(m.topic, m)
    for (const r of relRes.data || []) {
      addNode(r.from_topic, null)
      addNode(r.to_topic, null)
    }

    const edges = (relRes.data || []).map(r => ({
      id:         r.id,
      from:       r.from_topic.toLowerCase().trim(),
      to:         r.to_topic.toLowerCase().trim(),
      kind:       r.kind,
      confidence: r.confidence,
    }))

    res.json({
      nodes: Object.values(nodes),
      edges,
      stats: {
        node_count: Object.keys(nodes).length,
        edge_count: edges.length,
      },
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// AI extract — given a topic, AI proposes 3-6 concept relations and we save them
router.post('/extract', async (req, res) => {
  const { topic, subject, relations } = req.body || {}
  if (!topic) return res.status(400).json({ error: 'topic is required' })
  if (!Array.isArray(relations)) return res.status(400).json({ error: 'relations array is required (call /api/ai/chat first to generate them)' })

  // The frontend sends pre-parsed relations from an AI call to keep token cost low.
  try {
    const rows = relations
      .filter(r => r?.to_topic && VALID_KINDS.includes(r.kind))
      .slice(0, 12)
      .map(r => ({
        user_id:    req.user.id,
        school_id:  req.schoolId || null,
        from_topic: String(topic).trim(),
        to_topic:   String(r.to_topic).trim(),
        kind:       r.kind,
        subject:    subject || null,
        confidence: typeof r.confidence === 'number' ? Math.max(0, Math.min(1, r.confidence)) : 0.7,
      }))

    if (rows.length === 0) return res.json({ message: 'No valid relations to add.', added: 0 })

    // Upsert-like behavior: try insert; on conflict skip
    let added = 0
    for (const row of rows) {
      const { data: existing } = await supabaseAdmin
        .from('concept_relations')
        .select('id')
        .eq('user_id', row.user_id)
        .ilike('from_topic', row.from_topic)
        .ilike('to_topic',   row.to_topic)
        .eq('kind', row.kind)
        .maybeSingle()
      if (existing) continue
      const { error } = await supabaseAdmin.from('concept_relations').insert(row)
      if (!error) added++
    }

    res.json({ message: `Added ${added} relations`, added })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Manual relate
router.post('/relate', async (req, res) => {
  const { from_topic, to_topic, kind = 'related_to', subject, confidence = 1 } = req.body || {}
  if (!from_topic || !to_topic) return res.status(400).json({ error: 'from_topic and to_topic required' })
  if (!VALID_KINDS.includes(kind)) return res.status(400).json({ error: `kind must be: ${VALID_KINDS.join(', ')}` })

  try {
    const { data, error } = await supabaseAdmin
      .from('concept_relations')
      .insert({
        user_id:    req.user.id,
        school_id:  req.schoolId || null,
        from_topic: from_topic.trim(),
        to_topic:   to_topic.trim(),
        kind, subject: subject || null,
        confidence: Math.max(0, Math.min(1, confidence)),
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    res.status(201).json({ id: data.id, message: 'Relation added.' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Delete a relation
router.delete('/relation/:id', async (req, res) => {
  try {
    const { data: existing } = await supabaseAdmin
      .from('concept_relations').select('user_id').eq('id', req.params.id).single()
    if (!existing || existing.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your relation.' })
    }
    const { error } = await supabaseAdmin
      .from('concept_relations').delete().eq('id', req.params.id)
    if (error) throw new Error(error.message)
    res.json({ message: 'Relation deleted.' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

export default router
