// Local development server — NOT used by Vercel (see api/index.js)
import app from './app.js'
import { startScheduler }  from './services/schedulerService.js'
import { startCleanupJob } from './jobs/cleanup.js'

const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
  console.log(`\n🚀 Kora Backend v2.0 running on http://localhost:${PORT}`)
  console.log(`   API reference: http://localhost:${PORT}/api`)
  console.log(`   Health:        http://localhost:${PORT}/health\n`)
  startScheduler()
  startCleanupJob()
})
