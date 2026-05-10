/**
 * Ops / Status API — public read endpoint that Claude Cowork (or any
 * monitoring tool) can poll to see Kairo's live state.
 *
 *   GET  /api/ops/status   → JSON snapshot of deploy + DB + errors + features
 *   POST /api/ops/error    → frontend reports unhandled errors here
 *   GET  /api/ops/health   → tiny liveness ping for uptime monitors
 */
import { Router } from 'express'
import { supabaseAdmin } from '../services/supabase.js'

const router = Router()

// In-memory rolling error log. Capped at 50 entries.
// Cowork or the /ops page reads this; survives within one Vercel cold-start
// window. Persistent error tracking would need a Supabase table — fine for v1.
const ERROR_LOG = []
const ERROR_LOG_MAX = 50

const FEATURES = [
  // Each feature: id, label, route, audience
  { id: 'solver',         label: "Kairo's Solver",         route: 'doubt',         audience: 'student' },
  { id: 'memory',         label: 'AI Memory Brain',        route: 'memory',        audience: 'student' },
  { id: 'labs',           label: 'Kairo Labs (3D sims)',   route: 'labs',          audience: 'student' },
  { id: 'flashcards',     label: 'Flashcards & SRS',       route: 'flashcards',    audience: 'student' },
  { id: 'study-plan',     label: 'Study Plan',             route: 'study-plan',    audience: 'student' },
  { id: 'predictor',      label: 'Exam Predictor',         route: 'predictor',     audience: 'student' },
  { id: 'mistakes',       label: 'Mistake Analysis',       route: 'mistakes',      audience: 'student' },
  { id: 'simulator',      label: 'Revision Simulator',     route: 'simulator',     audience: 'student' },
  { id: 'notebook',       label: 'AI Notebook',            route: 'notebook',      audience: 'student' },
  { id: 'concept-map',    label: 'Concept Map',            route: 'concept-map',   audience: 'student' },
  { id: 'knowledge',      label: 'Knowledge Graph',        route: 'knowledge',     audience: 'student' },
  { id: 'adaptive',       label: 'Adaptive Path',          route: 'adaptive',      audience: 'student' },
  { id: 'focus',          label: 'Focus Mode',             route: 'focus',         audience: 'student' },
  { id: 'panic',          label: 'Exam Panic Mode',        route: 'panic',         audience: 'student' },
  { id: 'camera',         label: 'Camera Study',           route: 'camera',        audience: 'student' },
  { id: 'voice',          label: 'Voice Tutor',            route: 'voice',         audience: 'student' },
  { id: 'battle',         label: 'Battle Mode',            route: 'battle',        audience: 'student' },
  { id: 'pomodoro',       label: 'Pomodoro Timer',         route: 'pomodoro',      audience: 'student' },
  { id: 'gamification',   label: 'Progress / XP',          route: 'gamification',  audience: 'student' },
  { id: 'essay',          label: 'Essay Grader',           route: 'essay',         audience: 'student' },
  { id: 'writing',        label: 'Writing Tools',          route: 'writing',       audience: 'student' },
  { id: 'quiz',           label: 'Adaptive Quiz',          route: 'quiz',          audience: 'student' },
  { id: 'school-hub',     label: 'School Hub',             route: 'school',        audience: 'admin' },
  { id: 'attendance',     label: 'Attendance',             route: 'attendance',    audience: 'teacher,admin' },
  { id: 'timetable',      label: 'Timetable',              route: 'timetable',     audience: 'teacher,admin' },
  { id: 'announcement',   label: 'Announcements',          route: 'announcement',  audience: 'teacher,admin' },
  { id: 'fee-reminder',   label: 'Fee Reminder',           route: 'fee-reminder',  audience: 'admin' },
  { id: 'admission',      label: 'Admission Bot',          route: 'admission',     audience: 'admin' },
  { id: 'analytics',      label: 'Analytics',              route: 'analytics',     audience: 'admin' },
  { id: 'lesson-plan',    label: 'Lesson Plan',            route: 'lesson-plan',   audience: 'teacher' },
  { id: 'question-paper', label: 'Question Paper',         route: 'question-paper',audience: 'teacher' },
  { id: 'parent-message', label: 'Parent Message',         route: 'parent-message',audience: 'teacher,admin' },
  { id: 'parent',         label: 'Parent Dashboard',       route: 'parent',        audience: 'parent' },
  { id: 'teacher',        label: 'Teacher Assistant',      route: 'teacher',       audience: 'teacher' },
  { id: 'health',         label: 'School Health Monitor',  route: 'health',        audience: 'admin' },
]

// ─── /api/ops/status ───────────────────────────────────────────────────────
router.get('/status', async (_req, res) => {
  const snapshot = {
    project:        'kairo-dashboard',
    timestamp:      new Date().toISOString(),
    deploy:         readDeployInfo(),
    users:          { total: null, students: null, teachers: null, admins: null, parents: null, activeLast24h: null },
    schools:        { total: null, active: null },
    database:       { reachable: false, recentLogins24h: null, recentRegistrations7d: null },
    errors: {
      totalLogged: ERROR_LOG.length,
      recent:      ERROR_LOG.slice(-10).reverse(),
    },
    features: {
      total:    FEATURES.length,
      list:     FEATURES,
      byAudience: countByAudience(FEATURES),
    },
    env: {
      hasOpenRouter:   !!process.env.OPENROUTER_API_KEY,
      hasGemini:       !!process.env.GEMINI_API_KEY,
      hasPexels:       !!process.env.PEXELS_API_KEY,
      hasUnsplash:     !!process.env.UNSPLASH_ACCESS_KEY,
      hasSupabase:     !!process.env.SUPABASE_URL || !!process.env.VITE_SUPABASE_URL,
      hasServiceRole:  !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasRazorpay:     !!process.env.RAZORPAY_KEY_ID,
      pwaEnabled:      process.env.ENABLE_PWA === 'true',
    },
  }

  // DB stats — best-effort, never blocks the response
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const since7d  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [
      { count: total },
      { count: students },
      { count: teachers },
      { count: admins },
      { count: parents },
      { count: activeLast24h },
      { count: schoolsTotal },
      { count: schoolsActive },
      { count: logins24h },
      { count: regs7d },
    ] = await Promise.all([
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'parent'),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).gt('last_login_at', since24h),
      supabaseAdmin.from('schools').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('schools').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('login_logs').select('*', { count: 'exact', head: true }).gt('created_at', since24h),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).gt('created_at', since7d),
    ])

    snapshot.users = { total, students, teachers, admins, parents, activeLast24h }
    snapshot.schools = { total: schoolsTotal, active: schoolsActive }
    snapshot.database = {
      reachable:              true,
      recentLogins24h:        logins24h,
      recentRegistrations7d:  regs7d,
    }
  } catch (e) {
    snapshot.database.reachable = false
    snapshot.database.error = e.message
  }

  // Cache 30s on edge so Cowork polling doesn't hammer Supabase
  res.set('Cache-Control', 'public, max-age=30, s-maxage=30')
  res.json(snapshot)
})

// ─── /api/ops/health — minimal uptime ping ─────────────────────────────────
router.get('/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() })
})

// ─── /api/ops/error — frontend reports unhandled errors ────────────────────
router.post('/error', (req, res) => {
  const { message, stack, source, line, col, page, userAgent } = req.body || {}
  if (!message) return res.status(400).json({ error: 'message required' })

  const entry = {
    ts:       new Date().toISOString(),
    message:  String(message).slice(0, 500),
    stack:    stack ? String(stack).slice(0, 1000) : undefined,
    source:   source ? String(source).slice(0, 200) : undefined,
    line, col,
    page:     page ? String(page).slice(0, 200) : undefined,
    userAgent: userAgent ? String(userAgent).slice(0, 200) : undefined,
  }

  ERROR_LOG.push(entry)
  if (ERROR_LOG.length > ERROR_LOG_MAX) ERROR_LOG.shift()

  console.warn('[ops/error]', entry.message, '@', entry.page)
  res.json({ ok: true, queueSize: ERROR_LOG.length })
})

// ─── helpers ───────────────────────────────────────────────────────────────
function readDeployInfo() {
  // Vercel sets these env vars on every deployment
  return {
    commit:        process.env.VERCEL_GIT_COMMIT_SHA || null,
    commitShort:   (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null,
    commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
    branch:        process.env.VERCEL_GIT_COMMIT_REF || null,
    repo:          process.env.VERCEL_GIT_REPO_SLUG || null,
    owner:         process.env.VERCEL_GIT_REPO_OWNER || null,
    deploymentId:  process.env.VERCEL_DEPLOYMENT_ID || null,
    region:        process.env.VERCEL_REGION || null,
    env:           process.env.VERCEL_ENV || 'development',
    url:           process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    nodeVersion:   process.version,
    uptimeSeconds: Math.floor(process.uptime()),
  }
}

function countByAudience(features) {
  const counts = {}
  for (const f of features) {
    for (const a of f.audience.split(',')) {
      counts[a.trim()] = (counts[a.trim()] || 0) + 1
    }
  }
  return counts
}

export default router
