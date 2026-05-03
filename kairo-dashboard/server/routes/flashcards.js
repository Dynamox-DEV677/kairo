/**
 * Flashcard Routes — AI-generated cards with SM-2 spaced repetition
 *
 * POST   /api/flashcards/generate        Generate cards from topic/text
 * GET    /api/flashcards                 List all cards (with optional filters)
 * GET    /api/flashcards/due             Cards due for review today
 * POST   /api/flashcards/:id/review      Submit quality rating (0–5), get next date
 * DELETE /api/flashcards/:id             Delete a card
 * POST   /api/flashcards/bulk-delete     Delete all cards for a deck
 */
import { Router } from 'express'
import { db } from '../db/index.js'
import { aiCall, parseJSON } from '../utils/ai.js'
import { sm2, getDueCards, freshCardState } from '../utils/srs.js'

const router = Router()

// ── Generate cards from topic ──────────────────────────────────────────────────
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
        school_id: req.body?.school_id || req.query?.school_id || 'demo_school',
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

// ── List cards ─────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { subject, topic } = req.query
  const q = { school_id: req.body?.school_id || req.query?.school_id || 'demo_school' }
  if (subject) q.subject = subject
  if (topic)   q.topic = { $regex: new RegExp(topic, 'i') }

  try {
    const cards = await db.flashcards.findAsync(q).sort({ created_at: -1 })
    res.json(cards)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Due cards for review ───────────────────────────────────────────────────────
router.get('/due', async (req, res) => {
  try {
    const all = await db.flashcards.findAsync({ school_id: req.body?.school_id || req.query?.school_id || 'demo_school' })
    const due = getDueCards(all)
    res.json({ total_due: due.length, cards: due })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Submit review rating ───────────────────────────────────────────────────────
router.post('/:id/review', async (req, res) => {
  const { quality } = req.body
  if (quality === undefined || quality < 0 || quality > 5)
    return res.status(400).json({ error: 'quality must be 0–5.' })

  try {
    const card = await db.flashcards.findOneAsync({ _id: req.params.id, school_id: req.body?.school_id || req.query?.school_id || 'demo_school' })
    if (!card) return res.status(404).json({ error: 'Card not found.' })

    const updated = sm2(card, Number(quality))
    await db.flashcards.updateAsync({ _id: card._id }, { $set: { ...updated, last_reviewed: new Date().toISOString() } })

    res.json({ message: 'Review recorded.', nextReview: updated.nextReview, interval: updated.interval })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Delete card ────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  await db.flashcards.removeAsync({ _id: req.params.id, school_id: req.body?.school_id || req.query?.school_id || 'demo_school' }, {})
  res.json({ message: 'Card deleted.' })
})

// ── Bulk delete (by topic/subject) ────────────────────────────────────────────
router.post('/bulk-delete', async (req, res) => {
  const { subject, topic } = req.body
  if (!subject && !topic) return res.status(400).json({ error: 'subject or topic required.' })
  const q = { school_id: req.body?.school_id || req.query?.school_id || 'demo_school' }
  if (subject) q.subject = subject
  if (topic)   q.topic   = topic
  const { numRemoved } = await db.flashcards.removeAsync(q, { multi: true })
  res.json({ message: `${numRemoved} cards deleted.` })
})

export default router
