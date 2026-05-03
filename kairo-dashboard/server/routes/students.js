import { Router } from 'express'
import { db } from '../db/index.js'

const router = Router()

router.get('/', async (req, res) => {
  const { school_id } = req.query
  if (!school_id) return res.status(400).json({ error: 'school_id is required.' })
  const students = await db.students.findAsync({ school_id, active: true }).sort({ name: 1 })

  // Enrich with pending fee counts
  const enriched = await Promise.all(students.map(async s => {
    const fees = await db.fees.findAsync({ student_id: s._id, status: 'pending' })
    return { ...s, pending_fees: fees.length, pending_amount: fees.reduce((a, f) => a + f.amount, 0) }
  }))
  res.json(enriched)
})

router.post('/', async (req, res) => {
  const { school_id, name, class: cls, parent_email, phone } = req.body
  if (!school_id || !name || !cls || !parent_email)
    return res.status(400).json({ error: 'school_id, name, class, parent_email are required.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parent_email))
    return res.status(400).json({ error: 'Invalid parent_email.' })

  const doc = await db.students.insertAsync({ school_id, name: name.trim(), class: cls.trim(), parent_email: parent_email.trim(), phone: phone || null, active: true, created_at: new Date().toISOString() })
  res.status(201).json({ id: doc._id, message: 'Student added.' })
})

router.put('/:id', async (req, res) => {
  const { name, class: cls, parent_email, phone, active } = req.body
  const update = {}
  if (name !== undefined)         update.name         = name
  if (cls !== undefined)          update.class         = cls
  if (parent_email !== undefined) update.parent_email  = parent_email
  if (phone !== undefined)        update.phone         = phone
  if (active !== undefined)       update.active        = active
  await db.students.updateAsync({ _id: req.params.id }, { $set: update })
  res.json({ message: 'Student updated.' })
})

router.delete('/:id', async (req, res) => {
  await db.students.updateAsync({ _id: req.params.id }, { $set: { active: false } })
  res.json({ message: 'Student deactivated.' })
})

export default router
