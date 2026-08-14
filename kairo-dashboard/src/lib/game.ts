import { getRaw, setRaw } from './storage'
import { addNotification } from './notifications'
import { post } from './api'

import { FLAGS, type FlagName } from '../config/flags'

const KEY = 'kairo:game:v1'
const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365]

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

/**
 * `requires` names the flag that has to be on for this quest to have somewhere
 * to go. A quest whose destination does not exist is worse than no quest: the
 * student cannot clear it, so the day's list never completes and the streak
 * they are chasing looks broken through no fault of theirs.
 */
interface QuestDef {
  id: string; label: string; action: string; target: number; bonus: number
  requires?: FlagName
}

const QUEST_POOL: QuestDef[] = [
  { id: 'ask3',    label: 'Ask Kyno 3 questions',   action: 'chat_answer',   target: 3,  bonus: 30 },
  { id: 'rev10',   label: 'Review 10 flashcards',    action: 'flashcard_rev', target: 10, bonus: 40 },
  { id: 'plan1',   label: 'Plan 1 topic',            action: 'topic_plan',    target: 1,  bonus: 25 },
  { id: 'quiz1',   label: 'Complete a quiz',         action: 'quiz_done',     target: 1,  bonus: 30 },
  // LABS_3D is off for v1, so this one is filtered out rather than deleted --
  // turning the flag back on should restore the quest without an edit here.
  { id: 'lab1',    label: 'Open a 3D lab',           action: 'lab_open',      target: 1,  bonus: 20, requires: 'LABS_3D' },
  { id: 'ask5',    label: 'Ask Kyno 5 questions',   action: 'chat_answer',   target: 5,  bonus: 50 },
  { id: 'note2',   label: 'Build 2 notebook notes',  action: 'note_built',    target: 2,  bonus: 25 },
]

/** Only quests the student can actually reach today. */
export function availableQuests(): QuestDef[] {
  return QUEST_POOL.filter(q => !q.requires || FLAGS[q.requires])
}

interface GameState {
  totalXP: number
  todayXP: number
  todayKey: string
  weekXP: number
  weekKey: string
  streak: number
  lastActive: string
  actionsToday: Record<string, number>
  questsDone: string[]
  lifetime: Record<string, number>
}

function fresh(): GameState {
  return {
    totalXP: 0, todayXP: 0, todayKey: today(), weekXP: 0, weekKey: weekKey(),
    streak: 0, lastActive: '', actionsToday: {}, questsDone: [], lifetime: {},
  }
}

function localYMD(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function today() { return localYMD() }
function weekKey() {
  const d = new Date()
  const day = (d.getDay() + 6) % 7
  const monday = new Date(d); monday.setDate(d.getDate() - day)
  return localYMD(monday)
}

export function loadGame(): GameState {
  try {
    const raw = getRaw(KEY)
    if (raw) {
      const s = { ...fresh(), ...JSON.parse(raw) } as GameState
      rollover(s)
      return s
    }
  } catch {  }
  return fresh()
}

function save(s: GameState) {
  try { setRaw(KEY, JSON.stringify(s)) } catch {  }
}

function rollover(s: GameState) {
  const t = today()
  if (s.todayKey !== t) {
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

// --- Cross-device sync helpers -------------------------------------------
// XP / streak / lifetime totals live in a device-local blob (kairo:game:v1)
// that the Twin cloud sync historically ignored — so a freshly signed-in
// device always read 0 XP even when the account had hundreds. These let the
// Twin backup/restore (cloud + manual JSON) carry game state across devices.

export function exportGameState(): GameState | null {
  try {
    const raw = getRaw(KEY)
    if (!raw) return null
    return { ...fresh(), ...JSON.parse(raw) } as GameState
  } catch { return null }
}

function mergeLifetime(a: Record<string, number> = {}, b: Record<string, number> = {}): Record<string, number> {
  const out: Record<string, number> = { ...a }
  for (const k of Object.keys(b)) out[k] = Math.max(out[k] || 0, b[k] || 0)
  return out
}

export function importGameState(
  incoming: Partial<GameState> | null | undefined,
  mode: 'replace' | 'merge' = 'replace',
): boolean {
  if (!incoming || typeof incoming !== 'object') return false
  const inXP     = Number(incoming.totalXP || 0)
  const inLife   = incoming.lifetime && typeof incoming.lifetime === 'object' ? incoming.lifetime : {}
  const inStreak = Number(incoming.streak || 0)
  // Never let an empty/zero cloud copy wipe real local progress.
  if (inXP <= 0 && inStreak <= 0 && Object.keys(inLife).length === 0) return false

  try {
    const cur = loadGame()
    let next: GameState
    if (mode === 'merge') {
      const sameWeek = cur.weekKey === incoming.weekKey
      next = {
        ...cur,
        totalXP:  Math.max(cur.totalXP, inXP),
        streak:   Math.max(cur.streak, inStreak),
        weekXP:   sameWeek ? Math.max(cur.weekXP, Number(incoming.weekXP || 0)) : cur.weekXP,
        lifetime: mergeLifetime(cur.lifetime, inLife),
      }
    } else {
      // Replace: trust the incoming snapshot; rollover() normalizes day/week on load.
      next = { ...fresh(), ...incoming } as GameState
    }
    rollover(next)
    save(next)
    // Refresh XP-driven UI (GameBar, Home, Kyno OS) without a full reload.
    try { window.dispatchEvent(new CustomEvent('kairo:xp', { detail: { total: next.totalXP, level: levelFromXP(next.totalXP).level } })) } catch {  }
    return true
  } catch { return false }
}

export function levelFromXP(xp: number): { level: number; into: number; need: number } {
  let level = 1, need = 100, rest = xp
  while (rest >= need) { rest -= need; level++; need = level * 100 }
  return { level, into: rest, need }
}

export function questsForToday(): QuestDef[] {
  const seedStr = today()
  let h = 0
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0
  const picked: QuestDef[] = []
  const pool = availableQuests()
  while (picked.length < 3 && pool.length) {
    h = (h * 1664525 + 1013904223) >>> 0
    picked.push(pool.splice(h % pool.length, 1)[0])
  }
  return picked
}

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

export function awardXP(action: keyof typeof XP_ACTIONS) {
  const def = XP_ACTIONS[action]
  if (!def) return
  const s = loadGame()
  rollover(s)

  const before = levelFromXP(s.totalXP).level
  let gained = def.xp

  s.actionsToday[action] = (s.actionsToday[action] || 0) + 1
  s.lifetime[action] = (s.lifetime[action] || 0) + 1

  const t = today()
  if (s.lastActive !== t) {
    s.streak = s.streak + 1
    s.lastActive = t
    if (STREAK_MILESTONES.includes(s.streak)) addNotification(`${s.streak}-day streak! Keep it going.`, '🔥')
  }

  for (const q of questsForToday()) {
    if (s.questsDone.includes(q.id)) continue
    if (q.action === action && (s.actionsToday[action] || 0) >= q.target) {
      s.questsDone.push(q.id)
      gained += q.bonus
      addNotification(`Quest complete: ${q.label} (+${q.bonus} XP)`, '🎯')
    }
  }

  s.totalXP += gained
  s.todayXP += gained
  s.weekXP  += gained
  const after = levelFromXP(s.totalXP)
  if (after.level > before) addNotification(`You reached Level ${after.level}!`, '⭐')
  save(s)

  try {
    window.dispatchEvent(new CustomEvent('kairo:xp', {
      detail: { amount: gained, reason: def.label, total: s.totalXP, level: after.level, levelUp: after.level > before, streak: s.streak },
    }))
  } catch {  }

  syncLeague(s)
}

export function awardXPAmount(amount: number, label: string) {
  const gained = Math.round(amount)
  if (!gained || gained <= 0) return
  const s = loadGame()
  rollover(s)

  const before = levelFromXP(s.totalXP).level

  const t = today()
  if (s.lastActive !== t) {
    s.streak = s.streak + 1
    s.lastActive = t
    if (STREAK_MILESTONES.includes(s.streak)) addNotification(`${s.streak}-day streak! Keep it going.`, '🔥')
  }

  s.totalXP += gained
  s.todayXP += gained
  s.weekXP  += gained
  const after = levelFromXP(s.totalXP)
  if (after.level > before) addNotification(`You reached Level ${after.level}!`, '⭐')
  save(s)

  try {
    window.dispatchEvent(new CustomEvent('kairo:xp', {
      detail: { amount: gained, reason: label, total: s.totalXP, level: after.level, levelUp: after.level > before, streak: s.streak },
    }))
  } catch {  }

  syncLeague(s)
}

function userIdentity(): { id: string; name: string } {
  let id = '', name = 'Student'
  try {
    const p = JSON.parse(localStorage.getItem('kairo_profile') || '{}')
    id = p.id || p.user_id || ''
    name = p.name || p.full_name || 'Student'
  } catch {  }
  if (!id) {
    id = getRaw('kairo:device-id') || ''
    if (!id) {
      id = 'dev-' + Math.random().toString(36).slice(2, 10)
      try { setRaw('kairo:device-id', id) } catch {  }
    }
  }
  return { id, name }
}

let _syncTimer: any = null
function syncLeague(s: GameState) {
  clearTimeout(_syncTimer)
  _syncTimer = setTimeout(() => {
    const { id, name } = userIdentity()
    // Use the api helper so the auth token is attached — the server now takes
    // the identity from the token, not from a body field anyone could forge.
    post('/league/xp', { user_id: id, name, week: s.weekKey, xp: s.weekXP })
      .catch(() => {  })   // leaderboard sync is best-effort, never blocks play
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
