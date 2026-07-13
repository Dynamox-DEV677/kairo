import express from 'express'
import { runAllCleanup } from '../jobs/cleanup.js'

const router = express.Router()

router.get('/cleanup', async (req, res) => {
  const secret = process.env.CRON_SECRET
  if (secret && (req.headers.authorization || '') !== `Bearer ${secret}`) {
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
