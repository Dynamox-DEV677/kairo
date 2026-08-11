import { Router } from 'express'
import { db } from '../db/index.js'
import { aiCall, parseJSON } from '../utils/ai.js'
import { sm2, getDueCards, freshCardState } from '../utils/srs.js'

import { requireSupabaseAuth } from '../middleware/supabaseAuth.js'

const router = Router()

// PR1: these three served every row to anyone with no token at all, scoped
// only by a school_id the CALLER supplied. Identity now comes from the
// verified JWT and nothing else.
router.use(requireSupabaseAuth)

router.post('/generate', async (req, res) => {
  const { topic, subject, count = 10, class: cls, board = 'CBSE' } = req.body
  if (!topic || !subject) return res.status(400).json({ error: 'topic and subject are required.' })
  if (count < 1 || count > 30) return res.status(400).json({ error: 'count must be 1–30.' })

  try {
    const prompt = `You are an expert Indian school educator (${board}, Class ${cls || '10'}).
Generate ${count} flashcards for the topic: "${topic}" in subject: "${subject}".

Return ONLY a JSON array. Each item must have:
- "front": the question or term (concise, under 15 words)
- "back": the answer or definition (clear, 1–3 sentences, exam-relevant)
- "hint": a one-word memory hint

Example format:
[{"front":"What is Newton's First Law?","back":"An object at rest stays at rest unless acted upon by an external force.","hint":"inertia"}]

Generate exactly ${count} items. No markdown, no extra text.`

    const raw = await aiCall({
      taskType: 'flashcard_gen',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2048,
    })

    const cards = parseJSON(raw)
    if (!Array.isArray(cards)) throw new Error('AI did not return an array')

    const now = new Date().toISOString()
    const inserted = await Promise.all(
      cards.map(c => db.flashcards.insertAsync({
        school_id: req.schoolId || ('user:' + req.user.id),
        created_by: 'system',
        topic,
        subject,
        class: cls,
        board,
        front: c.front,
        back: c.back,
        hint: c.hint || '',
        ...freshCardState(),
        created_at: now,
      }))
    )

    res.status(201).json({ count: inserted.length, cards: inserted })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** Anything from the client that reaches new RegExp() is an injection and a
 *  ReDoS vector — `topic=(a+)+$` from an unauthenticated caller was enough to
 *  pin the function. Escape it and cap the length. */
function safeRegex(input) {
  return new RegExp(String(input).slice(0, 64).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
}

/** Scope comes from the verified token, never the request. */
const scopeOf = (req) => ({ school_id: req.schoolId || `user:${req.user.id}` })

router.get('/', async (req, res) => {
  const { subject, topic } = req.query
  const q = scopeOf(req)
  if (subject) q.subject = subject
  if (topic)   q.topic = { $regex: safeRegex(topic) }

  try {
    const cards = await db.flashcards.findAsync(q).sort({ created_at: -1 })
    res.json(cards)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/due', async (req, res) => {
  try {
    const all = await db.flashcards.findAsync({ school_id: req.schoolId || ('user:' + req.user.id) })
    const due = getDueCards(all)
    res.json({ total_due: due.length, cards: due })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/:id/review', async (req, res) => {
  const { quality } = req.body
  if (quality === undefined || quality < 0 || quality > 5)
    return res.status(400).json({ error: 'quality must be 0–5.' })

  try {
    const card = await db.flashcards.findOneAsync({ _id: req.params.id, school_id: req.schoolId || ('user:' + req.user.id) })
    if (!card) return res.status(404).json({ error: 'Card not found.' })

    const updated = sm2(card, Number(quality))
    await db.flashcards.updateAsync({ _id: card._id }, { $set: { ...updated, last_reviewed: new Date().toISOString() } })

    res.json({ message: 'Review recorded.', nextReview: updated.nextReview, interval: updated.interval })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/:id', async (req, res) => {
  await db.flashcards.removeAsync({ _id: req.params.id, school_id: req.schoolId || ('user:' + req.user.id) }, {})
  res.json({ message: 'Card deleted.' })
})

router.post('/bulk-delete', async (req, res) => {
  const { subject, topic } = req.body
  if (!subject && !topic) return res.status(400).json({ error: 'subject or topic required.' })
  const q = { school_id: req.schoolId || ('user:' + req.user.id) }
  if (subject) q.subject = subject
  if (topic)   q.topic   = topic
  const { numRemoved } = await db.flashcards.removeAsync(q, { multi: true })
  res.json({ message: `${numRemoved} cards deleted.` })
})

export default router
