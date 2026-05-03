import nodemailer from 'nodemailer'
import { db } from '../db/index.js'
import { encrypt, decrypt, isAppPassword, cleanAppPassword } from '../config/crypto.js'

// ─── Save & Verify ───────────────────────────────────────────────────────────

export async function saveCredentials(schoolId, gmail, rawPassword) {
  const password = cleanAppPassword(rawPassword)

  if (!isAppPassword(password)) {
    return {
      success: false,
      message: 'Invalid App Password. Must be 16 lowercase letters (get one from myaccount.google.com/apppasswords).',
    }
  }

  const verified = await testSmtp(gmail, password)
  if (!verified.ok) {
    return { success: false, message: `SMTP verification failed: ${verified.error}` }
  }

  const { enc, iv, authTag } = encrypt(password)
  const doc = { school_id: schoolId, gmail, enc_password: enc, iv, auth_tag: authTag, verified: true, updated_at: new Date().toISOString() }

  await db.credentials.updateAsync({ school_id: schoolId }, { $set: doc }, { upsert: true })

  return { success: true, message: 'Gmail credentials saved and verified.' }
}

export async function testSmtp(gmail, password) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: gmail, pass: password },
  })
  try {
    await transporter.verify()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

export async function getTransporter(schoolId) {
  const row = await db.credentials.findOneAsync({ school_id: schoolId, verified: true })
  if (!row) throw new Error(`No verified Gmail credentials for school: ${schoolId}`)

  const password = decrypt({ enc: row.enc_password, iv: row.iv, authTag: row.auth_tag })
  return {
    gmail: row.gmail,
    transporter: nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: row.gmail, pass: password },
      pool: true, maxConnections: 3, rateDelta: 1000, rateLimit: 3,
    }),
  }
}

export async function getGmail(schoolId) {
  const row = await db.credentials.findOneAsync({ school_id: schoolId })
  if (!row) return null
  return { gmail: row.gmail, verified: row.verified, updated_at: row.updated_at }
}

export async function deleteCredentials(schoolId) {
  await db.credentials.removeAsync({ school_id: schoolId }, { multi: false })
}
