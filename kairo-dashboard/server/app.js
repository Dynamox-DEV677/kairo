import 'dotenv/config'
import express from 'express'
import { apiLimiter } from './middleware/rateLimit.js'

// ── AI chat proxy (no auth — key stays server-side) ──────────────────────────
import aiChatRoutes from './routes/aiChat.js'

// ── Ops / status (public — Cowork & uptime monitors poll this) ───────────────
import opsRoutes from './routes/ops.js'

// ── v1 routes (fee reminder system) ───────────────────────────────────────────
import credentialRoutes    from './routes/credentials.js'
import studentRoutes       from './routes/students.js'
import feeRoutes           from './routes/fees.js'
import emailRoutes         from './routes/emails.js'

// ── v2 routes (SaaS platform) ─────────────────────────────────────────────────
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

// ── v3 routes (extended features) ─────────────────────────────────────────────
import writingRoutes       from './routes/writing.js'
import conceptRoutes       from './routes/concept.js'
import formulaRoutes       from './routes/formula.js'
import quizRoutes          from './routes/quiz.js'
import analyticsRoutes     from './routes/analytics.js'
import announcementRoutes  from './routes/announcement.js'
import gradingRoutes       from './routes/grading.js'
import gamificationRoutes  from './routes/gamification.js'

// ── v4 routes (Supabase multi-tenant SaaS) ────────────────────────────────────
import schoolRoutes        from './routes/schools.js'
import usersV2Routes       from './routes/usersV2.js'
import passwordResetRoutes from './routes/passwordReset.js'
import passcodeRoutes      from './routes/passcode.js'
import notesRoutes         from './routes/notes.js'
import notificationsRoutes from './routes/notifications.js'

// ── Dev / ops: email template preview (gated by env) ──────────────────────────
import devEmailPreviewRoutes from './routes/devEmailPreview.js'

// ── v5 routes (School Management Core) ────────────────────────────────────────
import tasksRoutes         from './routes/tasks.js'
import networkRulesRoutes  from './routes/networkRules.js'

// ── v6 routes (Parent Mode + Marks) ──────────────────────────────────────────
import marksRoutes         from './routes/marks.js'
import parentRoutes        from './routes/parent.js'

// ── v7 routes (AI Memory Brain) ──────────────────────────────────────────────
import memoryRoutes        from './routes/memory.js'

// ── v8 routes (School Health Monitor) ────────────────────────────────────────
import schoolHealthRoutes  from './routes/schoolHealth.js'

// ── v9 routes (AI Notebook / Second Brain) ───────────────────────────────────
import notebookRoutes      from './routes/notebook.js'

// ── v10 routes (Battle Mode — daily challenge + leaderboard) ─────────────────
import battleRoutes        from './routes/battle.js'

// ── v11 routes (Knowledge Graph Engine) ──────────────────────────────────────
import knowledgeRoutes     from './routes/knowledge.js'

// ── v12 routes (Payments + Subscriptions) ────────────────────────────────────
import paymentRoutes       from './routes/payments.js'

// ── Twin routes — used for cross-device sync (/api/twin/snapshot) ───────────
// Most twin data lives in the browser (src/lib/twin.ts), but the GET/POST/DELETE
// /api/twin/snapshot endpoints are needed so the user's twin can travel
// between devices. Re-enabled — see kairo_signup_setup.sql + twin_snapshot_schema.sql.
import twinRoutes          from './routes/twin.js'

// ─── Validate env ─────────────────────────────────────────────────────────────
if (!process.env.ENCRYPTION_SECRET || process.env.ENCRYPTION_SECRET.length < 32) {
  // Use a fallback so the server doesn't crash — set ENCRYPTION_SECRET in prod for real security
  process.env.ENCRYPTION_SECRET = 'kairo-default-secret-key-change-in-production-please-set-env-var-now'
  console.warn('⚠️  ENCRYPTION_SECRET not set — using insecure default. Set it in Vercel env vars.')
}
if (!process.env.OPENROUTER_API_KEY) {
  console.warn('⚠️   OPENROUTER_API_KEY not set — AI features will fail.')
}

// ─── App ──────────────────────────────────────────────────────────────────────
const app = express()

app.use(express.json({ limit: '10mb' }))
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
app.use('/api/ai',             aiChatRoutes)
app.use('/api/ops',            opsRoutes)
app.use('/api/credentials',    credentialRoutes)
app.use('/api/students',       studentRoutes)
app.use('/api/fees',           feeRoutes)
app.use('/api/emails',         emailRoutes)

// v2 — SaaS platform
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
app.use('/api/users',          passwordResetRoutes)    // forgot-password, reset-password (mounted first so /forgot-password resolves before any catch-alls)
app.use('/api/users',          usersV2Routes)
app.use('/api/passcode',       passcodeRoutes)         // 6-digit OTP for Kairo OS device passcode reset
app.use('/api/notes',          notesRoutes)
app.use('/api/notifications',  notificationsRoutes)

// Dev / ops — email previews (no auth, 404 in prod unless KAIRO_ALLOW_EMAIL_PREVIEW=1)
app.use('/api/dev/emails',     devEmailPreviewRoutes)

// v5 — School Management Core
app.use('/api/tasks',          tasksRoutes)
app.use('/api/network-rules',  networkRulesRoutes)

// v6 — Parent Mode + Marks
app.use('/api/marks',          marksRoutes)
app.use('/api/parent',         parentRoutes)

// v7 — AI Memory Brain
app.use('/api/memory',         memoryRoutes)

// v8 — School Health Monitor (admin)
app.use('/api/school-health',  schoolHealthRoutes)

// v9 — AI Notebook (Second Brain)
app.use('/api/notebook',       notebookRoutes)

// v10 — Battle Mode (daily challenge + leaderboard)
app.use('/api/battle',         battleRoutes)

// v11 — Knowledge Graph Engine
app.use('/api/knowledge',      knowledgeRoutes)

// v12 — Payments + subscription lifecycle
app.use('/api/payments',       paymentRoutes)

// Kairo OS · Twin — only the /api/twin/snapshot endpoints are used now
// (GET/POST/DELETE) for cross-device sync.
app.use('/api/twin',           twinRoutes)

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    version:   '3.0.0',
    service:   'Kairo Education Platform Backend',
    serverless: !!process.env.VERCEL,
    features: [
      'fee-reminders', 'auth', 'flashcards-srs', 'study-plans',
      'essay-grader', 'exam-predictor', 'mock-tests', 'question-paper',
      'lesson-plan', 'parent-message', 'admission-bot',
      'attendance-alerts', 'timetable',
      'schools-multitenant', 'users-v2', 'notes-pdf', 'notifications-rbac',
      'tasks-homework', 'network-rules-wifi', 'school-admin-rbac',
    ],
    timestamp: new Date().toISOString(),
  })
})

// ─── API reference ────────────────────────────────────────────────────────────
app.get('/api', (_req, res) => {
  res.json({
    version: '3.0.0',
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
      schools: [
        'POST /api/schools/register',
        'GET  /api/schools/:id',
        'GET  /api/schools/by-name/:name',
        'GET  /api/schools/:id/members',
        'GET  /api/schools/:id/stats',
        'POST /api/schools/:id/regenerate-passcode',
        'POST /api/schools/:id/teachers',
        'POST /api/schools/:id/approve/:userId',
        'POST /api/schools/:id/suspend/:userId',
        'POST /api/schools/:id/reinstate/:userId',
        'DELETE /api/schools/:id/members/:userId',
        'POST /api/schools/:id/upload-logo',
      ],
      users_v2: [
        'POST /api/users/register',
        'POST /api/users/register-personal',
        'POST /api/users/login',
        'POST /api/users/forgot-password',
        'POST /api/users/reset-password',
        'GET  /api/users/profile',
        'PUT  /api/users/profile',
        'POST /api/users/join-school',
        'GET  /api/users/school-members',
        'POST /api/users/logout',
      ],
      dev_emails: [
        'GET /api/dev/emails',
        'GET /api/dev/emails/:id',
        'GET /api/dev/emails/:id?fmt=text',
        'GET /api/dev/emails/:id?raw=1',
      ],
      notes:  ['POST /api/notes', 'GET /api/notes', 'GET /api/notes/:id', 'PUT /api/notes/:id', 'DELETE /api/notes/:id', 'GET /api/notes/:id/pdf', 'GET /api/notes/subjects'],
      notifications: ['POST /api/notifications', 'GET /api/notifications', 'GET /api/notifications/all', 'DELETE /api/notifications/:id'],
      tasks: [
        'POST /api/tasks',
        'GET  /api/tasks',
        'GET  /api/tasks/:id',
        'PUT  /api/tasks/:id',
        'DELETE /api/tasks/:id',
        'POST /api/tasks/:id/submit',
        'GET  /api/tasks/:id/submissions',
        'PUT  /api/tasks/:id/submissions/:sid/grade',
      ],
      network_rules: [
        'POST /api/network-rules',
        'GET  /api/network-rules',
        'GET  /api/network-rules/check',
        'PUT  /api/network-rules/:id',
        'DELETE /api/network-rules/:id',
      ],
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

export default app
