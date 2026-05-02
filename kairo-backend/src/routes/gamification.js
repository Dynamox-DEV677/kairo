/**
 * Gamification Routes
 *
 * GET  /api/gamification/profile    Get XP, level, badges
 * POST /api/gamification/xp         Add XP for an action
 * GET  /api/gamification/leaderboard School leaderboard
 * GET  /api/gamification/badges     All badges + earned status
 */
import { Router } from 'express'
import { db } from '../db/index.js'

const router = Router()
const sid = req => req.body?.school_id || req.query?.school_id || 'demo_school'

const LEVELS = [
  { level: 1,  title: 'Beginner',    xp_required: 0    },
  { level: 2,  title: 'Student',     xp_required: 100  },
  { level: 3,  title: 'Learner',     xp_required: 250  },
  { level: 4,  title: 'Scholar',     xp_required: 500  },
  { level: 5,  title: 'Achiever',    xp_required: 800  },
  { level: 6,  title: 'Expert',      xp_required: 1200 },
  { level: 7,  title: 'Master',      xp_required: 1800 },
  { level: 8,  title: 'Champion',    xp_required: 2500 },
  { level: 9,  title: 'Legend',      xp_required: 3500 },
  { level: 10, title: 'Topper',      xp_required: 5000 },
]

const ALL_BADGES = [
  { id: 'first_flashcard',   name: 'First Flash',       desc: 'Created your first flashcard',   icon: '⚡', xp_needed: 10 },
  { id: 'quiz_10',           name: 'Quiz Starter',      desc: 'Completed 10 quizzes',            icon: '🎯', quizzes_needed: 10 },
  { id: 'essay_5',           name: 'Writer',            desc: 'Graded 5 essays',                 icon: '✍️', essays_needed: 5 },
  { id: 'streak_7',          name: '7-Day Streak',      desc: 'Studied 7 days in a row',         icon: '🔥', streak_needed: 7 },
  { id: 'perfect_quiz',      name: 'Perfect Score',     desc: 'Got 100% on a quiz',              icon: '💯', perfect_quiz: true },
  { id: 'xp_500',            name: 'XP Hunter',         desc: 'Earned 500 XP',                   icon: '⭐', xp_needed: 500 },
  { id: 'xp_1000',           name: 'XP Master',         desc: 'Earned 1000 XP',                  icon: '🌟', xp_needed: 1000 },
  { id: 'formula_3',         name: 'Formula Wizard',    desc: 'Generated 3 formula sheets',      icon: '📐', formulas_needed: 3 },
  { id: 'doubts_10',         name: 'Curious Mind',      desc: 'Asked 10 doubts',                 icon: '🤔', doubts_needed: 10 },
  { id: 'study_plan',        name: 'Planner',           desc: 'Created a study plan',            icon: '📅', plans_needed: 1 },
]

function getLevel(xp) {
  let current = LEVELS[0]
  for (const l of LEVELS) {
    if (xp >= l.xp_required) current = l
    else break
  }
  const nextLevel = LEVELS[LEVELS.indexOf(current) + 1] || null
  const progress = nextLevel
    ? Math.round(((xp - current.xp_required) / (nextLevel.xp_required - current.xp_required)) * 100)
    : 100
  return { ...current, next_level: nextLevel, progress_to_next: progress }
}

// ── Get Profile ────────────────────────────────────────────────────────────────
router.get('/profile', async (req, res) => {
  const schoolId = sid(req)
  const { user_id = 'default' } = req.query
  try {
    let profile = await db.gamification?.findOneAsync?.({ school_id: schoolId, user_id }) || {
      school_id: schoolId, user_id, xp: 0, quizzes_completed: 0,
      essays_graded: 0, flashcards_created: 0, doubts_asked: 0,
      formula_sheets: 0, study_plans: 0, streak: 0,
      perfect_quizzes: 0, badges: [], last_active: null,
    }

    const levelInfo = getLevel(profile.xp || 0)

    // Check badges
    const earnedBadges = ALL_BADGES.filter(b => {
      if (b.xp_needed && (profile.xp || 0) >= b.xp_needed) return true
      if (b.quizzes_needed && (profile.quizzes_completed || 0) >= b.quizzes_needed) return true
      if (b.essays_needed && (profile.essays_graded || 0) >= b.essays_needed) return true
      if (b.streak_needed && (profile.streak || 0) >= b.streak_needed) return true
      if (b.perfect_quiz && (profile.perfect_quizzes || 0) > 0) return true
      if (b.formulas_needed && (profile.formula_sheets || 0) >= b.formulas_needed) return true
      if (b.doubts_needed && (profile.doubts_asked || 0) >= b.doubts_needed) return true
      if (b.plans_needed && (profile.study_plans || 0) >= b.plans_needed) return true
      return false
    }).map(b => b.id)

    res.json({ ...profile, level: levelInfo, badges_earned: earnedBadges })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Add XP ─────────────────────────────────────────────────────────────────────
router.post('/xp', async (req, res) => {
  const { xp = 10, action = 'activity', user_id = 'default' } = req.body
  const schoolId = sid(req)

  const XP_AMOUNTS = {
    flashcard_review: 5, quiz_complete: 20, essay_graded: 15,
    study_plan: 30, doubt_asked: 5, formula_sheet: 10,
    perfect_quiz: 50, login: 2,
  }
  const xpToAdd = XP_AMOUNTS[action] || xp

  try {
    const existing = await db.gamification?.findOneAsync?.({ school_id: schoolId, user_id })
    if (existing) {
      await db.gamification?.updateAsync?.(
        { school_id: schoolId, user_id },
        { $inc: { xp: xpToAdd }, $set: { last_active: new Date().toISOString() } }
      )
    } else {
      await db.gamification?.insertAsync?.({
        school_id: schoolId, user_id, xp: xpToAdd,
        quizzes_completed: 0, essays_graded: 0, flashcards_created: 0,
        doubts_asked: 0, formula_sheets: 0, study_plans: 0,
        streak: 0, perfect_quizzes: 0, badges: [],
        last_active: new Date().toISOString(),
      })
    }

    const updated = await db.gamification?.findOneAsync?.({ school_id: schoolId, user_id })
    res.json({ xp_added: xpToAdd, total_xp: updated?.xp || xpToAdd, level: getLevel(updated?.xp || xpToAdd) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Leaderboard ────────────────────────────────────────────────────────────────
router.get('/leaderboard', async (req, res) => {
  const schoolId = sid(req)
  try {
    const profiles = await db.gamification?.findAsync?.({ school_id: schoolId }) || []
    const leaderboard = profiles
      .map(p => ({ user_id: p.user_id, xp: p.xp || 0, level: getLevel(p.xp || 0) }))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 20)
    res.json(leaderboard)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Badges List ────────────────────────────────────────────────────────────────
router.get('/badges', async (req, res) => {
  const { user_id = 'default' } = req.query
  const schoolId = sid(req)
  try {
    const profile = await db.gamification?.findOneAsync?.({ school_id: schoolId, user_id }) || {}
    const badges = ALL_BADGES.map(b => {
      let earned = false
      if (b.xp_needed && (profile.xp || 0) >= b.xp_needed) earned = true
      if (b.quizzes_needed && (profile.quizzes_completed || 0) >= b.quizzes_needed) earned = true
      if (b.essays_needed && (profile.essays_graded || 0) >= b.essays_needed) earned = true
      if (b.streak_needed && (profile.streak || 0) >= b.streak_needed) earned = true
      if (b.perfect_quiz && (profile.perfect_quizzes || 0) > 0) earned = true
      if (b.formulas_needed && (profile.formula_sheets || 0) >= b.formulas_needed) earned = true
      if (b.doubts_needed && (profile.doubts_asked || 0) >= b.doubts_needed) earned = true
      if (b.plans_needed && (profile.study_plans || 0) >= b.plans_needed) earned = true
      return { ...b, earned }
    })
    res.json(badges)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export { LEVELS, getLevel }
export default router
