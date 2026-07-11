/**
 * Kyno Game Engine — the Duolingo-style habit loop.
 *
 *   XP        every study action earns XP (awardXP)
 *   Levels    quadratic curve — early levels fast, later ones earned
 *   Quests    3 daily quests, rotating deterministically by date
 *   Streak    a day counts when you earn ANY xp that day
 *   Badges    computed achievements
 *   League    weekly leaderboard — XP syncs to /api/league (Supabase)
 *
 * Storage goes through lib/storage (SQLite in Electron, localStorage on
 * web). Server sync is fire-and-forget — the game never blocks on it.
 *
 * UI listens via  window.addEventListener('kairo:xp', e => ...)  which
 * fires on every award with { amount, reason, total, level, levelUp }.
 */
import { getRaw, setRaw } from './storage'

const KEY = 'kairo:game:v1'

// ── XP amounts per action ──────────────────────────────────────────────
export const XP_ACTIONS: Record<string, { xp: number; label: string }> = {
  chat_answer:    { xp: 10, label: 'Asked Kyno' },
  flashcard_gen:  { xp: 10, label: 'Generated flashcards' },
  flashcard_rev:  { xp: 5,  label: 'Reviewed a card' },
  topic_plan:     { xp: 15, label: 'Planned a topic' },
  exam_plan:      { xp: 20, label: 'Built an exam plan' },
  quiz_done:      { xp: 15, label: 'Finished a quiz' },
  lab_open:       { xp: 8,  label: 'Explored a lab' },
  note_built:     { xp: 8,  label: 'Built a note' },
}

// ── Daily quest pool (3 picked per day, deterministic) ────────────────
interface QuestDef { id: string; label: string; action: string; target: number; bonus: number }
const QUEST_POOL: QuestDef[] = [
  { id: 'ask3',    label: 'Ask Kyno 3 questions',   action: 'chat_answer',   target: 3,  bonus: 30 },
  { id: 'rev10',   label: 'Review 10 flashcards',    action: 'flashcard_rev', target: 10, bonus: 40 },
  { id: 'plan1',   label: 'Plan 1 topic',            action: 'topic_plan',    target: 1,  bonus: 25 },
  { id: 'quiz1',   label: 'Complete a quiz',         action: 'quiz_done',     target: 1,  bonus: 30 },
  { id: 'lab1',    label: 'Open a 3D lab',           action: 'lab_open',      target: 1,  bonus: 20 },
  { id: 'ask5',    label: 'Ask Kyno 5 questions',   action: 'chat_answer',   target: 5,  bonus: 50 },
  { id: 'note2',   label: 'Build 2 notebook notes',  action: 'note_built',    target: 2,  bonus: 25 },
]

interface GameState {
  totalXP: number
  todayXP: number
  todayKey: string                    // YYYY-MM-DD the daily counters belong to
  weekXP: number
  weekKey: string                     // ISO week key for league
  streak: number
  lastActive: string                  // YYYY-MM-DD of last XP earn
  actionsToday: Record<string, number>
  questsDone: string[]                // quest ids completed today
  lifetime: Record<string, number>    // total per action — powers badges
}

function fresh(): GameState {
  return {
    totalXP: 0, todayXP: 0, todayKey: today(), weekXP: 0, weekKey: weekKey(),
    streak: 0, lastActive: '', actionsToday: {}, questsDone: [], lifetime: {},
  }
}

// Local YYYY-MM-DD — NOT toISOString(), which is UTC and rolls the "day" at
// 05:30 in IST (UTC+5:30), resetting streaks/quests mid-morning. Using the
// device's local date makes the day boundary local midnight everywhere.
function localYMD(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function today() { return localYMD() }
function weekKey() {
  const d = new Date()
  // Monday-based week key: YYYY-MM-DD of the local Monday
  const day = (d.getDay() + 6) % 7
  const monday = new Date(d); monday.setDate(d.getDate() - day)
  return localYMD(monday)          // week identified by its Monday (local)
}

export function loadGame(): GameState {
  try {
    const raw = getRaw(KEY)
    if (raw) {
      const s = { ...fresh(), ...JSON.parse(raw) } as GameState
      rollover(s)
      return s
    }
  } catch { /* corrupted — start fresh */ }
  return fresh()
}

function save(s: GameState) {
  try { setRaw(KEY, JSON.stringify(s)) } catch { /* quota */ }
}

// Reset daily/weekly counters when the date rolls.
function rollover(s: GameState) {
  const t = today()
  if (s.todayKey !== t) {
    // streak bookkeeping: yesterday active → streak continues on next earn;
    // gap of 2+ days → streak broken.
    const y = new Date(); y.setDate(y.getDate() - 1)
    const yest = localYMD(y)
    if (s.lastActive !== yest && s.lastActive !== t) s.streak = 0
    s.todayKey = t
    s.todayXP = 0
    s.actionsToday = {}
    s.questsDone = []
  }
  const w = weekKey()
  if (s.weekKey !== w) { s.weekKey = w; s.weekXP = 0 }
}

// ── Levels: cumulative cost grows 100, 200, 300… per level ────────────
export function levelFromXP(xp: number): { level: number; into: number; need: number } {
  let level = 1, need = 100, rest = xp
  while (rest >= need) { rest -= need; level++; need = level * 100 }
  return { level, into: rest, need }
}

// ── Today's 3 quests (deterministic by date) ──────────────────────────
export function questsForToday(): QuestDef[] {
  const seedStr = today()
  let h = 0
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0
  const picked: QuestDef[] = []
  const pool = [...QUEST_POOL]
  while (picked.length < 3 && pool.length) {
    h = (h * 1664525 + 1013904223) >>> 0
    picked.push(pool.splice(h % pool.length, 1)[0])
  }
  return picked
}

// ── Badges (computed) ─────────────────────────────────────────────────
export interface Badge { id: string; label: string; desc: string; earned: boolean }
export function badges(s: GameState): Badge[] {
  const life = s.lifetime
  const { level } = levelFromXP(s.totalXP)
  return [
    { id: 'first',   label: 'First Step',   desc: 'Earn your first XP',            earned: s.totalXP > 0 },
    { id: 'lvl5',    label: 'Scholar',      desc: 'Reach level 5',                 earned: level >= 5 },
    { id: 'lvl10',   label: 'Sage',         desc: 'Reach level 10',                earned: level >= 10 },
    { id: 'streak7', label: 'On Fire',      desc: '7-day streak',                  earned: s.streak >= 7 },
    { id: 'ask50',   label: 'Curious Mind', desc: 'Ask Kyno 50 questions',        earned: (life.chat_answer || 0) >= 50 },
    { id: 'rev100',  label: 'Memory Master',desc: 'Review 100 flashcards',         earned: (life.flashcard_rev || 0) >= 100 },
  ]
}

// ── The core: award XP ────────────────────────────────────────────────
export function awardXP(action: keyof typeof XP_ACTIONS) {
  const def = XP_ACTIONS[action]
  if (!def) return
  const s = loadGame()
  rollover(s)

  const before = levelFromXP(s.totalXP).level
  let gained = def.xp

  // counters
  s.actionsToday[action] = (s.actionsToday[action] || 0) + 1
  s.lifetime[action] = (s.lifetime[action] || 0) + 1

  // streak — first XP of the day extends it
  const t = today()
  if (s.lastActive !== t) {
    s.streak = s.streak + 1
    s.lastActive = t
  }

  // quest completion check → bonus XP
  for (const q of questsForToday()) {
    if (s.questsDone.includes(q.id)) continue
    if (q.action === action && (s.actionsToday[action] || 0) >= q.target) {
      s.questsDone.push(q.id)
      gained += q.bonus
    }
  }

  s.totalXP += gained
  s.todayXP += gained
  s.weekXP  += gained
  const after = levelFromXP(s.totalXP)
  save(s)

  // Notify UI (toast + bars)
  try {
    window.dispatchEvent(new CustomEvent('kairo:xp', {
      detail: { amount: gained, reason: def.label, total: s.totalXP, level: after.level, levelUp: after.level > before, streak: s.streak },
    }))
  } catch { /* SSR */ }

  // League sync — fire-and-forget
  syncLeague(s)
}

/**
 * Award a specific XP amount for actions whose XP is computed elsewhere
 * (Battle Mode = score × per-correct, adaptive quiz, etc.). Flows into the
 * same level / streak / weekly-league economy and fires the same `kairo:xp`
 * toast as awardXP, so a battle win now moves the Home level ring and league.
 */
export function awardXPAmount(amount: number, label: string) {
  const gained = Math.round(amount)
  if (!gained || gained <= 0) return
  const s = loadGame()
  rollover(s)

  const before = levelFromXP(s.totalXP).level

  // streak — first XP of the day extends it
  const t = today()
  if (s.lastActive !== t) {
    s.streak = s.streak + 1
    s.lastActive = t
  }

  s.totalXP += gained
  s.todayXP += gained
  s.weekXP  += gained
  const after = levelFromXP(s.totalXP)
  save(s)

  try {
    window.dispatchEvent(new CustomEvent('kairo:xp', {
      detail: { amount: gained, reason: label, total: s.totalXP, level: after.level, levelUp: after.level > before, streak: s.streak },
    }))
  } catch { /* SSR */ }

  syncLeague(s)
}

// ── Weekly league sync ────────────────────────────────────────────────
function userIdentity(): { id: string; name: string } {
  let id = '', name = 'Student'
  try {
    const p = JSON.parse(localStorage.getItem('kairo_profile') || '{}')
    id = p.id || p.user_id || ''
    name = p.name || p.full_name || 'Student'
  } catch { /* ignore */ }
  if (!id) {
    // stable anonymous device id
    id = getRaw('kairo:device-id') || ''
    if (!id) {
      id = 'dev-' + Math.random().toString(36).slice(2, 10)
      try { setRaw('kairo:device-id', id) } catch { /* ignore */ }
    }
  }
  return { id, name }
}

let _syncTimer: any = null
function syncLeague(s: GameState) {
  // debounce — batch rapid awards into one POST
  clearTimeout(_syncTimer)
  _syncTimer = setTimeout(() => {
    const { id, name } = userIdentity()
    fetch('/api/league/xp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: id, name, week: s.weekKey, xp: s.weekXP }),
    }).catch(() => { /* offline / not configured — fine */ })
  }, 1500)
}

export async function fetchLeaderboard(): Promise<{ rank: number; rows: { name: string; xp: number; you: boolean }[] } | null> {
  try {
    const { id } = userIdentity()
    const r = await fetch(`/api/league/board?week=${encodeURIComponent(weekKey())}&user_id=${encodeURIComponent(id)}`)
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

// Local YYYY-MM for the month leaderboard window.
export function monthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export interface LeagueBoard {
  rank: number
  total: number
  rows: { name: string; xp: number; you: boolean }[]
  youXp?: number
  offline?: boolean
}

/** Range-aware league fetch for the full League page (week | month | all). */
export async function fetchLeagueBoard(range: 'week' | 'month' | 'all' = 'week'): Promise<LeagueBoard | null> {
  try {
    const { id } = userIdentity()
    const params = new URLSearchParams({ range, user_id: id })
    if (range === 'week')  params.set('week', weekKey())
    if (range === 'month') params.set('month', monthKey())
    const r = await fetch(`/api/league/board?${params.toString()}`)
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}
