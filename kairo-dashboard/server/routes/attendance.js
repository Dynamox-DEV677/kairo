/**
 * Attendance Routes (no auth — school_id from body/query)
 */
import { Router } from 'express'
import { db } from '../db/index.js'
import { aiCall } from '../utils/ai.js'

const router = Router()
const sid = req => req.body?.school_id || req.query?.school_id

router.post('/log', async (req, res) => {
  const { school_id, student_id, date, status, subject, period } = req.body
  if (!school_id || !student_id || !date || !status)
    return res.status(400).json({ error: 'school_id, student_id, date, status required.' })
  const valid = ['present', 'absent', 'late', 'excused']
  if (!valid.includes(status))
    return res.status(400).json({ error: `status must be: ${valid.join(', ')}` })
  try {
    const q = { student_id, date, school_id }
    if (subject) q.subject = subject
    if (period)  q.period  = period
    const existing = await db.attendance.findOneAsync(q)
    if (existing) {
      await db.attendance.updateAsync({ _id: existing._id }, { $set: { status, updated_at: new Date().toISOString() } })
      return res.json({ message: 'Attendance updated.' })
    }
    await db.attendance.insertAsync({ ...q, status, created_at: new Date().toISOString() })
    res.status(201).json({ message: 'Attendance logged.' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/bulk', async (req, res) => {
  const { school_id, date, records, subject } = req.body
  if (!school_id || !date || !records?.length)
    return res.status(400).json({ error: 'school_id, date, records[] required.' })
  try {
    let logged = 0
    for (const r of records) {
      const q = { student_id: r.student_id, date, school_id }
      if (subject) q.subject = subject
      const existing = await db.attendance.findOneAsync(q)
      if (existing) {
        await db.attendance.updateAsync({ _id: existing._id }, { $set: { status: r.status } })
      } else {
        await db.attendance.insertAsync({ ...q, status: r.status, created_at: new Date().toISOString() })
      }
      logged++
    }
    res.json({ message: `Attendance logged for ${logged} students.` })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/', async (req, res) => {
  const { school_id, student_id, date, from, to, subject, status } = req.query
  if (!school_id) return res.status(400).json({ error: 'school_id required.' })
  const q = { school_id }
  if (student_id) q.student_id = student_id
  if (date)       q.date       = date
  if (subject)    q.subject    = subject
  if (status)     q.status     = status
  if (from || to) { q.date = {}; if (from) q.date.$gte = from; if (to) q.date.$lte = to }
  try {
    const records = await db.attendance.findAsync(q).sort({ date: -1 }).limit(500)
    res.json(records)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/at-risk', async (req, res) => {
  const { school_id, threshold = 75, from, to } = req.query
  if (!school_id) return res.status(400).json({ error: 'school_id required.' })
  const pct = Number(threshold)
  try {
    const q = { school_id }
    if (from || to) { q.date = {}; if (from) q.date.$gte = from; if (to) q.date.$lte = to }
    const records  = await db.attendance.findAsync(q)
    const students = await db.students.findAsync({ school_id, active: true })
    const atRisk = []
    for (const s of students) {
      const sRecords = records.filter(r => r.student_id === s._id)
      const total    = sRecords.length
      const present  = sRecords.filter(r => r.status === 'present' || r.status === 'late').length
      const percentage = total > 0 ? Math.round((present / total) * 100) : null
      if (percentage !== null && percentage < pct)
        atRisk.push({ student_id: s._id, student_name: s.name, class: s.class, parent_email: s.parent_email, total_days: total, present_days: present, absent_days: total - present, percentage })
    }
    atRisk.sort((a, b) => a.percentage - b.percentage)
    res.json({ count: atRisk.length, threshold: pct, students: atRisk })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/stats/:studentId', async (req, res) => {
  const { school_id } = req.query
  try {
    const q = { student_id: req.params.studentId }
    if (school_id) q.school_id = school_id
    const records  = await db.attendance.findAsync(q).sort({ date: 1 })
    const total    = records.length
    const present  = records.filter(r => r.status === 'present').length
    const absent   = records.filter(r => r.status === 'absent').length
    const late     = records.filter(r => r.status === 'late').length
    const excused  = records.filter(r => r.status === 'excused').length
    const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0
    res.json({ total, present, absent, late, excused, percentage, records })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/alert', async (req, res) => {
  const { student_name, percentage, total_days, absent_days, class: cls, school_name } = req.body
  if (!student_name || !percentage) return res.status(400).json({ error: 'student_name, percentage required.' })
  try {
    const prompt = `Write a brief professional attendance alert for parent. Student: ${student_name}, Class: ${cls || ''}. Attendance: ${percentage}% (Absent ${absent_days} of ${total_days} days). School: ${school_name || 'School'}. Return JSON: { "subject": "...", "message": "2-3 sentences", "whatsapp_version": "under 200 chars" }`
    const raw = await aiCall({ taskType: 'attendance_alert', messages: [{ role: 'user', content: prompt }], maxTokens: 400 })
    res.json(JSON.parse(raw.replace(/```json|```/g, '').trim()))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

export default router
