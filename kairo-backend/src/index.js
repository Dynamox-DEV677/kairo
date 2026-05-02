import 'dotenv/config'
import express from 'express'
import { apiLimiter } from './middleware/rateLimit.js'

// ── v1 routes (fee reminder system) ───────────────────────────────────────────
import credentialRoutes  from './routes/credentials.js'
import studentRoutes     from './routes/students.js'
import feeRoutes         from './routes/fees.js'
import emailRoutes       from './routes/emails.js'

// ── v2 routes (SaaS platform) ─────────────────────────────────────────────────
import authRoutes        from './routes/auth.js'
import flashcardRoutes   from './routes/flashcards.js'
import studyPlanRoutes   from './routes/studyPlan.js'
import essayRoutes       from './routes/essay.js'
import examRoutes        from './routes/exam.js'
import questionPaperRoutes from './routes/questionPaper.js'
import lessonPlanRoutes  from './routes/lessonPlan.js'
import parentMessageRoutes from './routes/parentMessage.js'
import admissionRoutes   from './routes/admission.js'
import attendanceRoutes  from './routes/attendance.js'
import timetableRoutes   from './routes/timetable.js'

// ── v3 routes (extended features) ─────────────────────────────────────────────
import writingRoutes      from './routes/writing.js'
import conceptRoutes      from './routes/concept.js'
import formulaRoutes      from './routes/formula.js'
import quizRoutes         from './routes/quiz.js'
import analyticsRoutes    from './routes/analytics.js'
import announcementRoutes from './routes/announcement.js'
import gradingRoutes      from './routes/grading.js'
import gamificationRoutes from './routes/gamification.js'

// ── v4 routes (Supabase multi-tenant SaaS) ────────────────────────────────────
import schoolRoutes        from './routes/schools.js'
import usersV2Routes       from './routes/usersV2.js'
import notesRoutes         from './routes/notes.js'
import notificationsRoutes from './routes/notifications.js'

import { startScheduler }  from './services/schedulerService.js'
import { startCleanupJob } from './jobs/cleanup.js'

// ─── Validate env ─────────────────────────────────────────────────────────────
if (!process.env.ENCRYPTION_SECRET || process.env.ENCRYPTION_SECRET.length < 64) {
  console.error('❌  ENCRYPTION_SECRET missing or too short. See .env.example.')
  process.exit(1)
}
if (!process.env.OPENROUTER_API_KEY) {
  console.warn('⚠️   OPENROUTER_API_KEY not set — AI features will fail.')
}

// ─── App ──────────────────────────────────────────────────────────────────────
const app  = express()
const PORT = process.env.PORT || 4000

app.use(express.json({ limit: '10mb' }))  // Allow larger essay submissions
app.use(apiLimiter)

// CORS — allow localhost (dev) + *.vercel.app + custom ALLOWED_ORIGIN
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

// ─── Routes ───────────────────────────────────────────────────────────────────

// v1 — Fee reminder system
app.use('/api/credentials',    credentialRoutes)
app.use('/api/students',       studentRoutes)
app.use('/api/fees',           feeRoutes)
app.use('/api/emails',         emailRoutes)

// v2 — SaaS platform
app.use('/api/auth',           authRoutes)
app.use('/api/flashcards',     flashcardRoutes)
app.use('/api/study-plan',     studyPlanRoutes)
app.use('/api/essay',          essayRoutes)
app.use('/api/exam',           examRoutes)
app.use('/api/question-paper', questionPaperRoutes)
app.use('/api/lesson-plan',    lessonPlanRoutes)
app.use('/api/parent-message', parentMessageRoutes)
app.use('/api/admission',      admissionRoutes)
app.use('/api/attendance',     attendanceRoutes)
app.use('/api/timetable',      timetableRoutes)

// v3 — Extended features
app.use('/api/writing',        writingRoutes)
app.use('/api/concept',        conceptRoutes)
app.use('/api/formula',        formulaRoutes)
app.use('/api/quiz',           quizRoutes)
app.use('/api/analytics',      analyticsRoutes)
app.use('/api/announcement',   announcementRoutes)
app.use('/api/grading',        gradingRoutes)
app.use('/api/gamification',   gamificationRoutes)

// v4 — Supabase multi-tenant SaaS
app.use('/api/schools',        schoolRoutes)
app.use('/api/users',          usersV2Routes)     // replaces /api/auth for v4 clients
app.use('/api/notes',          notesRoutes)
app.use('/api/notifications',  notificationsRoutes)

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    service: 'Kairo Education Platform Backend',
    features: [
      'fee-reminders', 'auth', 'flashcards-srs', 'study-plans',
      'essay-grader', 'exam-predictor', 'mock-tests', 'question-paper',
      'lesson-plan', 'parent-message', 'admission-bot',
      'attendance-alerts', 'timetable',
      'schools-multitenant', 'users-v2', 'notes-pdf', 'notifications-rbac',
    ],
    timestamp: new Date().toISOString(),
  })
})

// ─── API reference ────────────────────────────────────────────────────────────
app.get('/api', (_req, res) => {
  res.json({
    version: '2.0.0',
    endpoints: {
      auth:           ['POST /api/auth/register', 'POST /api/auth/login', 'GET /api/auth/me'],
      flashcards:     ['POST /api/flashcards/generate', 'GET /api/flashcards', 'GET /api/flashcards/due', 'POST /api/flashcards/:id/review'],
      study_plan:     ['POST /api/study-plan/create', 'GET /api/study-plan', 'PUT /api/study-plan/:id/progress'],
      essay:          ['POST /api/essay/grade', 'GET /api/essay'],
      exam:           ['POST /api/exam/predict', 'POST /api/exam/mock'],
      question_paper: ['POST /api/question-paper/generate'],
      lesson_plan:    ['POST /api/lesson-plan/generate'],
      parent_message: ['POST /api/parent-message/generate', 'POST /api/parent-message/bulk'],
      admission:      ['POST /api/admission/chat', 'POST /api/admission/lead', 'GET /api/admission/leads'],
      attendance:     ['POST /api/attendance/log', 'POST /api/attendance/bulk', 'GET /api/attendance/at-risk'],
      timetable:      ['POST /api/timetable', 'GET /api/timetable', 'GET /api/timetable/clashes', 'POST /api/timetable/generate'],
      fees:           ['GET /api/fees', 'POST /api/fees', 'PUT /api/fees/:id'],
      emails:         ['POST /api/emails/send-one', 'POST /api/emails/send-bulk', 'GET /api/emails/stats'],
      schools:        ['POST /api/schools/register', 'GET /api/schools/:id', 'GET /api/schools/by-name/:name', 'POST /api/schools/:id/upload-logo', 'GET /api/schools/:id/stats'],
      users_v2:       ['POST /api/users/register', 'POST /api/users/login', 'GET /api/users/profile', 'PUT /api/users/profile', 'POST /api/users/join-school', 'POST /api/users/logout'],
      notes:          ['POST /api/notes', 'GET /api/notes', 'GET /api/notes/:id', 'PUT /api/notes/:id', 'DELETE /api/notes/:id', 'GET /api/notes/:id/pdf', 'GET /api/notes/subjects'],
      notifications:  ['POST /api/notifications', 'GET /api/notifications', 'GET /api/notifications/all', 'DELETE /api/notifications/:id'],
    },
  })
})

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found. Visit /api for full endpoint list.' })
})

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message)
  res.status(500).json({ error: 'Internal server error.' })
})

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Kairo Backend v2.0 running on http://localhost:${PORT}`)
  console.log(`   API reference: http://localhost:${PORT}/api`)
  console.log(`   Health:        http://localhost:${PORT}/health\n`)
  startScheduler()
  startCleanupJob()
})
