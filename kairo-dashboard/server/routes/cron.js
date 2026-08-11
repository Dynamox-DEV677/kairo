import express from 'express'
import { runAllCleanup } from '../jobs/cleanup.js'

const router = express.Router()

router.get('/cleanup', async (req, res) => {
  const secret = process.env.CRON_SECRET
  // Fails CLOSED. `if (secret && ...)` meant that forgetting the env var left
  // the cron endpoints open to anyone, which is the opposite of what a guard
  // is for -- and a missing env var is exactly when you least notice.
  if (!secret || (req.headers.authorization || '') !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  try {
    await runAllCleanup()
    res.json({ ok: true, ranAt: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
