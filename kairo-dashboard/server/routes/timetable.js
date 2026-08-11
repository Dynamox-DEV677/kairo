import { Router } from 'express'
import { db } from '../db/index.js'
import { aiCall, parseJSON } from '../utils/ai.js'

import { requireSupabaseAuth, requireRole } from '../middleware/supabaseAuth.js'

const router = Router()

// Phase 0: served school data to anyone who guessed an integer school_id.
// No UI ships for these in v1, so the role check is the only guard.
router.use(requireSupabaseAuth)
router.use(requireRole('teacher', 'admin'))
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

async function detectClashes(schoolId, newSlot, excludeId = null) {
  const clashes = []
  const existing = await db.timetable.findAsync({ school_id: schoolId, day: newSlot.day, period: newSlot.period })
  for (const slot of existing) {
    if (excludeId && slot._id === excludeId) continue
    if (slot.class === newSlot.class)
      clashes.push({ type: 'class_clash', message: `Class ${newSlot.class} already has period ${newSlot.period} on ${newSlot.day}`, conflict: slot })
    if (newSlot.teacher && slot.teacher === newSlot.teacher)
      clashes.push({ type: 'teacher_clash', message: `${newSlot.teacher} already assigned period ${newSlot.period} on ${newSlot.day}`, conflict: slot })
    if (newSlot.room && slot.room === newSlot.room)
      clashes.push({ type: 'room_clash', message: `Room ${newSlot.room} occupied at period ${newSlot.period} on ${newSlot.day}`, conflict: slot })
  }
  return clashes
}

router.post('/', async (req, res) => {
  const { school_id, class: cls, subject, teacher, room, day, period, start_time, end_time, force = false } = req.body
  if (!school_id || !cls || !subject || !day || !period)
    return res.status(400).json({ error: 'school_id, class, subject, day, period are required.' })
  if (!DAYS.includes(day))
    return res.status(400).json({ error: `day must be one of: ${DAYS.join(', ')}` })
  try {
    const clashes = await detectClashes(school_id, { class: cls, teacher, room, day, period })
    if (clashes.length > 0 && !force)
      return res.status(409).json({ error: 'Clash detected. Use force:true to override.', clashes })
    const slot = await db.timetable.insertAsync({
      school_id, class: cls, subject,
      teacher: teacher || null, room: room || null,
      day, period: Number(period),
      start_time: start_time || null, end_time: end_time || null,
      has_clash: clashes.length > 0,
      created_at: new Date().toISOString(),
    })
    res.status(201).json({ slot, clashes: clashes.length > 0 ? clashes : undefined })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/', async (req, res) => {
  const { school_id, class: cls, teacher, day } = req.query
  if (!school_id) return res.status(400).json({ error: 'school_id required.' })
  const q = { school_id }
  if (cls)     q.class   = cls
  if (teacher) q.teacher = teacher
  if (day)     q.day     = day
  try {
    const slots = await db.timetable.findAsync(q).sort({ day: 1, period: 1 })
    const grouped = {}
    for (const s of slots) {
      if (!grouped[s.class]) grouped[s.class] = {}
      if (!grouped[s.class][s.day]) grouped[s.class][s.day] = []
      grouped[s.class][s.day].push(s)
    }
    res.json({ slots, grouped })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id', async (req, res) => {
  const { school_id, subject, teacher, room, start_time, end_time, force = false } = req.body
  if (!school_id) return res.status(400).json({ error: 'school_id required.' })
  try {
    const existing = await db.timetable.findOneAsync({ _id: req.params.id, school_id })
    if (!existing) return res.status(404).json({ error: 'Slot not found.' })
    const updated = { ...existing, subject: subject || existing.subject, teacher: teacher || existing.teacher, room: room || existing.room }
    const clashes = await detectClashes(school_id, updated, existing._id)
    if (clashes.length > 0 && !force) return res.status(409).json({ error: 'Clash detected.', clashes })
    const u = { updated_at: new Date().toISOString(), has_clash: clashes.length > 0 }
    if (subject)    u.subject    = subject
    if (teacher)    u.teacher    = teacher
    if (room)       u.room       = room
    if (start_time) u.start_time = start_time
    if (end_time)   u.end_time   = end_time
    await db.timetable.updateAsync({ _id: existing._id }, { $set: u })
    res.json({ message: 'Slot updated.' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', async (req, res) => {
  const { school_id } = req.query
  await db.timetable.removeAsync({ _id: req.params.id, ...(school_id ? { school_id } : {}) }, {})
  res.json({ message: 'Slot deleted.' })
})

router.get('/clashes', async (req, res) => {
  const { school_id } = req.query
  if (!school_id) return res.status(400).json({ error: 'school_id required.' })
  try {
    const slots = await db.timetable.findAsync({ school_id, has_clash: true })
    res.json({ count: slots.length, clashed_slots: slots })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/generate', async (req, res) => {
  const { school_id, class: cls, subjects, periods_per_day = 8, working_days = ['Monday','Tuesday','Wednesday','Thursday','Friday'] } = req.body
  if (!cls || !subjects?.length) return res.status(400).json({ error: 'class and subjects[] required.' })
  try {
    const prompt = `Create a clash-free school timetable for Class ${cls}.
Subjects: ${subjects.map(s => `${s.name} (Teacher: ${s.teacher || 'TBD'}, ${s.periods_per_week} periods/week)`).join(', ')}
Periods per day: ${periods_per_day}, Working days: ${working_days.join(', ')}
Rules: No teacher double-booked. Science/Maths in morning (periods 1-4). No subject > 2 consecutive periods.
Return ONLY valid JSON: { "class": "${cls}", "timetable": { "Monday": [{ "period": 1, "subject": "...", "teacher": "..." }], "Tuesday": [...], "Wednesday": [...], "Thursday": [...], "Friday": [...] }, "notes": "..." }
No markdown.`
    const raw = await aiCall({ taskType: 'lesson_plan', messages: [{ role: 'user', content: prompt }], maxTokens: 2000, temperature: 0.5 })
    res.json(parseJSON(raw))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

export default router
