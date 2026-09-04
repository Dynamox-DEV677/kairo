import 'dotenv/config'
import { reportFault } from './services/alert.js'
import express from 'express'
import { apiLimiter, aiLimiter } from './middleware/rateLimit.js'

import aiChatRoutes from './routes/aiChat.js'
import ttsRoutes from './routes/tts.js'
import cameraLiveRoutes from './routes/cameraLive.js'
import documentRoutes from './routes/document.js'
import practiceRoutes from './routes/practice.js'

import opsRoutes from './routes/ops.js'
import cronRoutes from './routes/cron.js'

import credentialRoutes    from './routes/credentials.js'
import studentRoutes       from './routes/students.js'
import feeRoutes           from './routes/fees.js'
import emailRoutes         from './routes/emails.js'

import authRoutes          from './routes/auth.js'
import flashcardRoutes     from './routes/flashcards.js'
import studyPlanRoutes     from './routes/studyPlan.js'
import examPlannerRoutes   from './routes/examPlanner.js'
import topicArchitectRoutes from './routes/topicArchitect.js'
import councilRoutes        from './routes/council.js'
import leagueRoutes         from './routes/league.js'
import accountRoutes        from './routes/account.js'
import essayRoutes         from './routes/essay.js'
import examRoutes          from './routes/exam.js'
import questionPaperRoutes from './routes/questionPaper.js'
import lessonPlanRoutes    from './routes/lessonPlan.js'
import parentMessageRoutes from './routes/parentMessage.js'
import admissionRoutes     from './routes/admission.js'
import attendanceRoutes    from './routes/attendance.js'
import timetableRoutes     from './routes/timetable.js'

import writingRoutes       from './routes/writing.js'
import conceptRoutes       from './routes/concept.js'
import formulaRoutes       from './routes/formula.js'
import quizRoutes          from './routes/quiz.js'
import analyticsRoutes     from './routes/analytics.js'
import announcementRoutes  from './routes/announcement.js'
import gradingRoutes       from './routes/grading.js'
import gamificationRoutes  from './routes/gamification.js'

import schoolRoutes        from './routes/schools.js'
import usersV2Routes       from './routes/usersV2.js'
import passwordResetRoutes from './routes/passwordReset.js'
import passcodeRoutes      from './routes/passcode.js'
import notesRoutes         from './routes/notes.js'
import notificationsRoutes from './routes/notifications.js'

import devEmailPreviewRoutes from './routes/devEmailPreview.js'

import tasksRoutes         from './routes/tasks.js'
import networkRulesRoutes  from './routes/networkRules.js'

import marksRoutes         from './routes/marks.js'
import parentRoutes        from './routes/parent.js'

import memoryRoutes        from './routes/memory.js'

import schoolHealthRoutes  from './routes/schoolHealth.js'

import notebookRoutes      from './routes/notebook.js'

import battleRoutes        from './routes/battle.js'

import knowledgeRoutes     from './routes/knowledge.js'

import paymentRoutes       from './routes/payments.js'

import twinRoutes          from './routes/twin.js'
import studyRoutes         from './routes/study.js'

// ENCRYPTION_SECRET is NOT defaulted. It used to be overwritten here with a
// fixed string that is in the repo, which meant a deploy missing the env var
// silently encrypted stored credentials, and signed password-reset tokens,
// with a key anyone could read. Consumers now fail closed on their own:
// config/crypto.js throws, and routes/passwordReset.js refuses to issue.
if (!process.env.ENCRYPTION_SECRET || process.env.ENCRYPTION_SECRET.length < 32) {
  console.error(
    '[boot] ENCRYPTION_SECRET is not set (needs 64 hex chars). Credential ' +
    'storage and password reset are DISABLED until it is. Generate one with: ' +
    'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  )
}
if (!process.env.GROQ_API_KEYS && !process.env.GROQ_API_KEY) {
  console.warn('⚠️   GROQ_API_KEYS not set — AI features will fail.')
}

const app = express()

app.use(express.json({ limit: '10mb' }))

// Liveness probe. Exactly `{ ok: true }` — no version, no feature list, no
// build info. Registered ahead of the rate limiter so uptime pings can't
// exhaust the window and lock real users out.
app.get('/api/health', (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json({ ok: true })
})

app.use(apiLimiter)

app.use((req, res, next) => {
  const origin = req.headers.origin || ''
  const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(origin)
  const isVercel    = /^https:\/\/[^.]+\.vercel\.app$/.test(origin)
  const isAllowed   = process.env.ALLOWED_ORIGIN
    ? process.env.ALLOWED_ORIGIN.split(',').map(s => s.trim()).includes(origin)
    : false

  if (isLocalhost || isVercel || isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.use([
  '/api/ai', '/api/camera', '/api/council', '/api/quiz', '/api/notebook', '/api/essay',
  '/api/grading', '/api/exam', '/api/writing', '/api/concept', '/api/knowledge',
  '/api/topic-architect', '/api/exam-planner', '/api/study-plan', '/api/lesson-plan',
  '/api/question-paper', '/api/formula', '/api/parent-message', '/api/admission',
], aiLimiter)

app.use('/api/ai',             aiChatRoutes)
app.use('/api/tts',            ttsRoutes)
app.use('/api/camera',         cameraLiveRoutes)
app.use('/api/document',       documentRoutes)
app.use('/api/practice',       practiceRoutes)
app.use('/api/ops',            opsRoutes)
app.use('/api/cron',           cronRoutes)
app.use('/api/credentials',    credentialRoutes)
app.use('/api/students',       studentRoutes)
app.use('/api/fees',           feeRoutes)
app.use('/api/emails',         emailRoutes)

app.use('/api/auth',           authRoutes)
app.use('/api/flashcards',     flashcardRoutes)
app.use('/api/study-plan',     studyPlanRoutes)
app.use('/api/exam-planner',   examPlannerRoutes)
app.use('/api/topic-architect', topicArchitectRoutes)
app.use('/api/council',        councilRoutes)
app.use('/api/league',         leagueRoutes)
app.use('/api/account',        accountRoutes)
app.use('/api/essay',          essayRoutes)
app.use('/api/exam',           examRoutes)
app.use('/api/question-paper', questionPaperRoutes)
app.use('/api/lesson-plan',    lessonPlanRoutes)
app.use('/api/parent-message', parentMessageRoutes)
app.use('/api/admission',      admissionRoutes)
app.use('/api/attendance',     attendanceRoutes)
app.use('/api/timetable',      timetableRoutes)

app.use('/api/writing',        writingRoutes)
app.use('/api/concept',        conceptRoutes)
app.use('/api/formula',        formulaRoutes)
app.use('/api/quiz',           quizRoutes)
app.use('/api/analytics',      analyticsRoutes)
app.use('/api/announcement',   announcementRoutes)
app.use('/api/grading',        gradingRoutes)
app.use('/api/gamification',   gamificationRoutes)

app.use('/api/schools',        schoolRoutes)
app.use('/api/users',          passwordResetRoutes)
app.use('/api/users',          usersV2Routes)
app.use('/api/passcode',       passcodeRoutes)
app.use('/api/notes',          notesRoutes)
app.use('/api/notifications',  notificationsRoutes)

// Conditional registration, not a runtime guard: in production the handlers
// are never mounted, so there is no code path to reach and nothing to bypass.
// The dev email inbox shows OTPs and reset links in plaintext.
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/dev/emails',   devEmailPreviewRoutes)
}

app.use('/api/tasks',          tasksRoutes)
app.use('/api/network-rules',  networkRulesRoutes)

app.use('/api/marks',          marksRoutes)
app.use('/api/parent',         parentRoutes)

app.use('/api/memory',         memoryRoutes)

app.use('/api/school-health',  schoolHealthRoutes)

app.use('/api/notebook',       notebookRoutes)

app.use('/api/battle',         battleRoutes)

app.use('/api/knowledge',      knowledgeRoutes)

app.use('/api/payments',       paymentRoutes)

app.use('/api/twin',           twinRoutes)
app.use('/api/study',          studyRoutes)

// Bare root probe for local dev. In production Vercel rewrites everything
// that isn't /api/* to index.html, so this is unreachable there anyway — it
// used to answer with the full feature inventory regardless.
app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

// Body must stay byte-identical to the 404 in middleware/opsAuth.js, so a
// token-gated route is indistinguishable from one that doesn't exist. The old
// message pointed at GET /api, which served the entire route inventory.
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' })
})

/**
 * Anything that reaches here is a 500 a student saw. Alert on it.
 *
 * Two dead features sat in production because nothing did this — the only
 * record was a console line in Vercel that nobody was reading.
 */
app.use((err, req, res, _next) => {
  console.error('[Error]', err.message)
  reportFault({
    route: req?.originalUrl || req?.path || 'unknown',
    message: err?.message || String(err),
    stack: err?.stack,
    status: 500,
    source: 'server',
  })
  res.status(500).json({ error: 'Internal server error.' })
})

export default app
