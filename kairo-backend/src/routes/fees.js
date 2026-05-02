import { Router } from 'express'
import { db } from '../db/index.js'

const router = Router()

router.get('/', async (req, res) => {
  const { school_id, status, student_id } = req.query
  if (!school_id) return res.status(400).json({ error: 'school_id is required.' })
  const q = { school_id }
  if (status)     q.status     = status
  if (student_id) q.student_id = student_id
  const fees = await db.fees.findAsync(q).sort({ due_date: 1 })

  // Enrich with student name
  const enriched = await Promise.all(fees.map(async f => {
    const s = await db.students.findOneAsync({ _id: f.student_id })
    return { ...f, student_name: s?.name, class: s?.class, parent_email: s?.parent_email }
  }))
  res.json(enriched)
})

router.post('/', async (req, res) => {
  const { school_id, student_id, amount, due_date, label } = req.body
  if (!school_id || !student_id || !amount || !due_date)
    return res.status(400).json({ error: 'school_id, student_id, amount, due_date are required.' })
  if (Number(amount) <= 0)
    return res.status(400).json({ error: 'amount must be positive.' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due_date))
    return res.status(400).json({ error: 'due_date must be YYYY-MM-DD.' })

  const doc = await db.fees.insertAsync({ school_id, student_id, amount: Number(amount), due_date, label: label || 'Monthly Fee', status: 'pending', created_at: new Date().toISOString() })
  res.status(201).json({ id: doc._id, message: 'Fee created.' })
})

// Bulk: add same fee to ALL active students
router.post('/bulk', async (req, res) => {
  const { school_id, amount, due_date, label } = req.body
  if (!school_id || !amount || !due_date)
    return res.status(400).json({ error: 'school_id, amount, due_date are required.' })

  const students = await db.students.findAsync({ school_id, active: true })
  await Promise.all(students.map(s =>
    db.fees.insertAsync({ school_id, student_id: s._id, amount: Number(amount), due_date, label: label || 'Monthly Fee', status: 'pending', created_at: new Date().toISOString() })
  ))
  res.status(201).json({ message: `Fee added for ${students.length} students.`, count: students.length })
})

router.put('/:id', async (req, res) => {
  const { status, amount, due_date, label } = req.body
  const valid = ['pending', 'paid', 'waived']
  if (status && !valid.includes(status))
    return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` })
  const u = {}
  if (status)   u.status   = status
  if (amount)   u.amount   = Number(amount)
  if (due_date) u.due_date = due_date
  if (label)    u.label    = label
  u.updated_at = new Date().toISOString()
  await db.fees.updateAsync({ _id: req.params.id }, { $set: u })
  res.json({ message: 'Fee updated.' })
})

router.delete('/:id', async (req, res) => {
  await db.fees.removeAsync({ _id: req.params.id }, {})
  res.json({ message: 'Fee deleted.' })
})

export default router
