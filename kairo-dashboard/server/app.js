import 'dotenv/config'
import express from 'express'
import { apiLimiter, aiLimiter } from './middleware/rateLimit.js'

import aiChatRoutes from './routes/aiChat.js'
import cameraLiveRoutes from './routes/cameraLive.js'

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

if (!process.env.ENCRYPTION_SECRET || process.env.ENCRYPTION_SECRET.length < 32) {
  process.env.ENCRYPTION_SECRET = 'kairo-default-secret-key-change-in-production-please-set-env-var-now'
  console.warn('⚠️  ENCRYPTION_SECRET not set — using insecure default. Set it in Vercel env vars.')
}
if (!process.env.GROQ_API_KEYS && !process.env.GROQ_API_KEY) {
  console.warn('⚠️   GROQ_API_KEYS not set — AI features will fail.')
}

const app = express()

app.use(express.json({ limit: '10mb' }))
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
app.use('/api/camera',         cameraLiveRoutes)
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

app.use('/api/dev/emails',     devEmailPreviewRoutes)

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

app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    version:   '3.0.0',
    service:   'Kyno Education Platform Backend',
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

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found. Visit /api for full endpoint list.' })
})

app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message)
  res.status(500).json({ error: 'Internal server error.' })
})

export default app
