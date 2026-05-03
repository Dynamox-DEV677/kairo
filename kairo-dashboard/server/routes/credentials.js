import { Router } from 'express'
import { credentialLimiter } from '../middleware/rateLimit.js'
import { saveCredentials, testSmtp, getGmail, deleteCredentials } from '../services/credentialService.js'
import { isAppPassword, cleanAppPassword } from '../config/crypto.js'

const router = Router()

router.post('/save', credentialLimiter, async (req, res) => {
  const { school_id, gmail, app_password } = req.body
  if (!school_id || !gmail || !app_password)
    return res.status(400).json({ error: 'school_id, gmail, and app_password are required.' })
  if (!gmail.endsWith('@gmail.com'))
    return res.status(400).json({ error: 'Only Gmail addresses (@gmail.com) are supported.' })

  const result = await saveCredentials(school_id, gmail, app_password)
  res.status(result.success ? 200 : 400).json(result)
})

router.post('/test', credentialLimiter, async (req, res) => {
  const { gmail, app_password } = req.body
  if (!gmail || !app_password)
    return res.status(400).json({ error: 'gmail and app_password are required.' })

  const pw = cleanAppPassword(app_password)
  if (!isAppPassword(pw))
    return res.status(400).json({ error: 'Invalid App Password (must be 16 lowercase letters). Generate one at myaccount.google.com/apppasswords.' })

  const r = await testSmtp(gmail, pw)
  res.json(r.ok
    ? { success: true, message: 'SMTP verified successfully.' }
    : { success: false, message: r.error })
})

router.get('/:schoolId', async (req, res) => {
  const row = await getGmail(req.params.schoolId)
  if (!row) return res.status(404).json({ error: 'No credentials found.' })
  res.json(row)
})

router.delete('/:schoolId', async (req, res) => {
  await deleteCredentials(req.params.schoolId)
  res.json({ success: true })
})

export default router
