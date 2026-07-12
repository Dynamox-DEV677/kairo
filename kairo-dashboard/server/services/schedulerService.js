import cron from 'node-cron'
import { db } from '../db/index.js'
import { sendFeeReminder, retryFailed } from './emailService.js'

let jobs = []

export function startScheduler() {
  const daily = cron.schedule('0 8 * * *', async () => {
    console.log('[Scheduler] Daily reminder run…')
    await runDailyReminders()
  }, { timezone: 'Asia/Kolkata' })

  const retry = cron.schedule('0 */6 * * *', async () => {
    console.log('[Scheduler] Retry failed emails…')
    await runRetries()
  }, { timezone: 'Asia/Kolkata' })

  jobs = [daily, retry]
  console.log('[Scheduler] Started — daily at 08:00 IST, retries every 6h')
}

export function stopScheduler() { jobs.forEach(j => j.destroy()); jobs = [] }

export async function runDailyReminders() {
  const configs = await db.config.findAsync({ enabled: true })
  const today = todayISO()
  let totalSent = 0

  for (const config of configs) {
    const schoolId = config.school_id
    const afterDaysArr = (config.after_due_days || '1,3,7').split(',').map(Number).filter(Boolean)

    const fees = await db.fees.findAsync({ school_id: schoolId, status: 'pending' })

    for (const fee of fees) {
      const student = await db.students.findOneAsync({ _id: fee.student_id, active: true })
      if (!student) continue

      const daysUntil = diffDays(today, fee.due_date)
      const daysAfter = -daysUntil

      let trigger = null
      if (daysUntil === (config.before_due_days ?? 3)) trigger = 'before_due'
      else if (daysUntil === 0 && config.on_due !== false)  trigger = 'on_due'
      else if (daysAfter > 0 && afterDaysArr.includes(daysAfter)) trigger = 'after_due'

      if (!trigger) continue

      const startOfDay = today + 'T00:00:00.000Z'
      const alreadySent = await db.emailLogs.findOneAsync({
        fee_id: fee._id, trigger, status: 'sent', created_at: { $gt: startOfDay },
      })
      if (alreadySent) continue

      try {
        await sendFeeReminder({ schoolId, studentId: student._id, feeId: fee._id, trigger, tone: config.tone || 'friendly' })
        totalSent++
      } catch (err) {
        console.error(`[Scheduler] Error for fee ${fee._id}:`, err.message)
      }
    }
  }

  console.log(`[Scheduler] Done — ${totalSent} emails sent`)
  return { totalSent }
}

async function runRetries() {
  const schools = await db.credentials.findAsync({ verified: true })
  let total = { retried: 0, recovered: 0 }
  for (const s of schools) {
    const r = await retryFailed(s.school_id, 3)
    total.retried += r.retried; total.recovered += r.recovered
  }
  console.log(`[Scheduler] Retry — ${total.recovered}/${total.retried} recovered`)
}

const todayISO = () => new Date().toISOString().slice(0, 10)
const diffDays = (from, to) => Math.round((new Date(to) - new Date(from)) / 86400000)
