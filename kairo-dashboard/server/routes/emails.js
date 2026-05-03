import { Router } from 'express'
import { emailLimiter } from '../middleware/rateLimit.js'
import { sendFeeReminder, sendBulkReminders, retryFailed } from '../services/emailService.js'
import { runDailyReminders } from '../services/schedulerService.js'
import { db } from '../db/index.js'

const router = Router()
const TONES = ['friendly', 'formal', 'urgent']

router.post('/send-one', emailLimiter, async (req, res) => {
  const { school_id, student_id, fee_id, trigger = 'manual', tone = 'friendly' } = req.body
  if (!school_id || !student_id || !fee_id)
    return res.status(400).json({ error: 'school_id, student_id, fee_id are required.' })
  if (!TONES.includes(tone))
    return res.status(400).json({ error: `tone must be: ${TONES.join(', ')}` })
  try {
    res.json(await sendFeeReminder({ schoolId: school_id, studentId: student_id, feeId: fee_id, trigger, tone }))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/send-bulk', emailLimiter, async (req, res) => {
  const { school_id, trigger = 'manual', tone = 'friendly' } = req.body
  if (!school_id) return res.status(400).json({ error: 'school_id is required.' })
  try {
    res.json(await sendBulkReminders({ schoolId: school_id, trigger, tone }))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/retry', async (req, res) => {
  const { school_id, max_attempts = 3 } = req.body
  if (!school_id) return res.status(400).json({ error: 'school_id is required.' })
  try { res.json(await retryFailed(school_id, max_attempts)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/run-scheduler', async (_req, res) => {
  try { res.json({ message: 'Done.', ...(await runDailyReminders()) }) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/logs', async (req, res) => {
  const { school_id, status } = req.query
  if (!school_id) return res.status(400).json({ error: 'school_id is required.' })
  const q = { school_id }
  if (status) q.status = status
  const logs = await db.emailLogs.findAsync(q).sort({ created_at: -1 }).limit(100)
  res.json(logs)
})

router.get('/stats', async (req, res) => {
  const { school_id } = req.query
  if (!school_id) return res.status(400).json({ error: 'school_id is required.' })
  const logs = await db.emailLogs.findAsync({ school_id })
  const fees = await db.fees.findAsync({ school_id })

  res.json({
    emails: {
      total: logs.length,
      sent:  logs.filter(l => l.status === 'sent').length,
      failed: logs.filter(l => l.status === 'failed').length,
      pending: logs.filter(l => l.status === 'pending').length,
    },
    fees: {
      total: fees.length,
      pending: fees.filter(f => f.status === 'pending').length,
      paid: fees.filter(f => f.status === 'paid').length,
      pending_amount: fees.filter(f => f.status === 'pending').reduce((a, f) => a + f.amount, 0),
    },
  })
})

router.get('/config/:schoolId', async (req, res) => {
  const row = await db.config.findOneAsync({ school_id: req.params.schoolId })
  res.json(row || { message: 'No config — defaults will be used.', before_due_days: 3, on_due: true, after_due_days: '1,3,7', tone: 'friendly' })
})

router.put('/config/:schoolId', async (req, res) => {
  const { before_due_days, on_due, after_due_days, tone, enabled } = req.body
  const u = { school_id: req.params.schoolId, updated_at: new Date().toISOString() }
  if (before_due_days !== undefined) u.before_due_days = before_due_days
  if (on_due !== undefined)          u.on_due = on_due
  if (after_due_days !== undefined)  u.after_due_days = after_due_days
  if (tone !== undefined)            u.tone = tone
  if (enabled !== undefined)         u.enabled = enabled
  await db.config.updateAsync({ school_id: req.params.schoolId }, { $set: u }, { upsert: true })
  res.json({ message: 'Config saved.' })
})

export default router
