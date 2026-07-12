import { db } from '../db/index.js'
import { getTransporter } from './credentialService.js'
import { generateEmailContent } from './aiService.js'

export async function sendFeeReminder({ schoolId, studentId, feeId, trigger = 'manual', tone = 'friendly' }) {
  const student = await db.students.findOneAsync({ _id: studentId, school_id: schoolId, active: true })
  if (!student) throw new Error(`Student ${studentId} not found`)

  const fee = await db.fees.findOneAsync({ _id: feeId, school_id: schoolId })
  if (!fee) throw new Error(`Fee ${feeId} not found`)

  if (fee.status === 'paid') return { success: false, message: 'Fee already paid — skipping.' }

  const log = await db.emailLogs.insertAsync({
    school_id: schoolId, student_id: studentId, fee_id: feeId,
    recipient: student.parent_email, subject: '', tone, trigger,
    status: 'pending', attempts: 0, created_at: new Date().toISOString(),
  })

  return _deliver({ schoolId, student, fee, trigger, tone, logId: log._id })
}

export async function sendBulkReminders({ schoolId, trigger = 'manual', tone = 'friendly' }) {
  const fees = await db.fees.findAsync({ school_id: schoolId, status: 'pending' })
  if (!fees.length) return { sent: 0, failed: 0, skipped: 0, skip_reasons: [], message: 'No pending fees found for this school. Add fees in the Fees tab first.' }
  let sent = 0, failed = 0, skipped = 0
  const skipReasons = []
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString()

  for (const fee of fees) {
    const student = await db.students.findOneAsync({ _id: fee.student_id })
    if (!student) {
      skipReasons.push({ fee_id: fee._id, reason: `Student ${fee.student_id} not found in DB` })
      skipped++; continue
    }
    if (student.active === false) {
      skipReasons.push({ student: student.name, reason: 'Student is deactivated' })
      skipped++; continue
    }
    if (!student.parent_email) {
      skipReasons.push({ student: student.name, reason: 'No parent email on file' })
      skipped++; continue
    }

    const recent = await db.emailLogs.findOneAsync({
      fee_id: fee._id, trigger, status: 'sent',
      created_at: { $gt: oneDayAgo },
    })
    if (recent) {
      skipReasons.push({ student: student.name, reason: 'Already sent in last 24h — prevents spam' })
      skipped++; continue
    }

    const log = await db.emailLogs.insertAsync({
      school_id: schoolId, student_id: student._id, fee_id: fee._id,
      recipient: student.parent_email, subject: '', tone, trigger,
      status: 'pending', attempts: 0, created_at: new Date().toISOString(),
    })

    const result = await _deliver({ schoolId, student, fee, trigger, tone, logId: log._id })
    result.success ? sent++ : failed++
    await sleep(400)
  }

  return { sent, failed, skipped, skip_reasons: skipReasons }
}

export async function retryFailed(schoolId, maxAttempts = 3) {
  const failed = await db.emailLogs.findAsync({ school_id: schoolId, status: 'failed', attempts: { $lt: maxAttempts } })
  let retried = 0, recovered = 0

  for (const log of failed) {
    const student = await db.students.findOneAsync({ _id: log.student_id })
    const fee     = await db.fees.findOneAsync({ _id: log.fee_id })
    if (!student || !fee) continue

    const result = await _deliver({ schoolId, student, fee, trigger: log.trigger, tone: log.tone, logId: log._id })
    retried++
    if (result.success) recovered++
    await sleep(600)
  }

  return { retried, recovered }
}

async function _deliver({ schoolId, student, fee, trigger, tone, logId }) {
  try {
    const { gmail, transporter } = await getTransporter(schoolId)

    const { subject, body } = await generateEmailContent({
      studentName: student.name, className: student.class,
      parentEmail: student.parent_email, feeAmount: fee.amount,
      dueDate: fee.due_date, trigger, tone,
    })

    const fullBody = `Dear Parent,\n\n${body}`

    await transporter.sendMail({
      from: `"Kyno School Admin" <${gmail}>`,
      to: student.parent_email,
      subject,
      text: fullBody,
      html: toHtml(fullBody, subject),
    })

    await db.emailLogs.updateAsync({ _id: logId }, {
      $set: { status: 'sent', subject, sent_at: new Date().toISOString() },
      $inc: { attempts: 1 },
    })

    console.log(`[Email] ✓ Sent → ${student.parent_email} (${trigger})`)
    return { success: true, logId }

  } catch (err) {
    await db.emailLogs.updateAsync({ _id: logId }, {
      $set: { status: 'failed', error: err.message },
      $inc: { attempts: 1 },
    })
    console.error(`[Email] ✗ Failed → ${student.parent_email}: ${err.message}`)
    return { success: false, logId, error: err.message }
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

function toHtml(text, subject) {
  const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{font-family:Arial,sans-serif;background:#f5f5f5;padding:20px}
.card{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,.08)}
.logo{font-size:20px;font-weight:800;color:#6366f1;margin-bottom:20px}
.body{font-size:15px;color:#333;line-height:1.7}
.footer{margin-top:28px;font-size:12px;color:#aaa;border-top:1px solid #eee;padding-top:14px}</style>
</head><body><div class="card">
<div class="logo">📚 Kyno</div>
<div class="body">${escaped}</div>
<div class="footer">Automated message from Kyno School Management. Do not reply.</div>
</div></body></html>`
}
