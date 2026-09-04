import { getRaw, setRaw } from './storage'
import { addNotification } from './notifications'
import { post, get } from './api'

import { FLAGS, type FlagName } from '../config/flags'
import { storedProfileRaw } from '../lib/storage'

const KEY = 'kyno:game:v1'
const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365]

/**
 * XP REWARDS THE RIGHT THING. The old table paid for asking Kyno questions
 * (farmable without learning anything, and it cost an API call per reward),
 * for opening labs, for generating cards. This table pays for what a student
 * KEEPS: cards retained at review, patterns beaten, sessions finished, written
 * answers graded, chapters crossing 70%. Nothing for opening the app, asking
 * questions, or time spent. The rules are published on the Progress screen so
 * the scoring can be checked -- see XP_RULES below.
 */
export const XP_ACTIONS = {
  card_retained:  { xp: 5,  label: 'Card kept at review' },
  pattern_beaten: { xp: 50, label: 'A mistake pattern beaten' },
  session_done:   { xp: 20, label: 'Session completed' },
  written_graded: { xp: 15, label: 'Written answer graded' },
  chapter_70:     { xp: 40, label: 'Chapter crossed 70%' },
} as const

export type XPAction = keyof typeof XP_ACTIONS

/** The published rules, in the order the Progress screen prints them. */
export const XP_RULES: Array<{ action: XPAction; xp: number; line: string }> = [
  { action: 'card_retained',  xp: 5,  line: 'card retained at review' },
  { action: 'pattern_beaten', xp: 50, line: 'mistake pattern beaten' },
  { action: 'session_done',   xp: 20, line: 'session completed' },
  { action: 'written_graded', xp: 15, line: 'written answer graded' },
  { action: 'chapter_70',     xp: 40, line: 'chapter mastery crossing 70%' },
]
export const XP_NOT_FOR = 'Nothing for opening the app, asking questions, or time spent.'

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

// Daily goals are targets, not a second XP table: the only XP in the app is
// the five actions above, so a goal carries no bonus. (The old "Ask Kyno 5
// questions" quest was farmable and paid out five API calls' worth of XP.)
const QUEST_POOL: QuestDef[] = [
  { id: 'keep10',   label: 'Keep 10 cards at review',      action: 'card_retained',  target: 10, bonus: 0 },
  { id: 'session1', label: 'Finish a practice session',    action: 'session_done',   target: 1,  bonus: 0 },
  { id: 'write1',   label: 'Get a written answer graded',  action: 'written_graded', target: 1,  bonus: 0 },
  { id: 'keep20',   label: 'Keep 20 cards at review',      action: 'card_retained',  target: 20, bonus: 0 },
  { id: 'session2', label: 'Finish two sessions',          action: 'session_done',   target: 2,  bonus: 0 },
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
  /** keys already credited once (a beaten pattern's signature, a chapter id) */
  once: string[]
}

function fresh(): GameState {
  return {
    totalXP: 0, todayXP: 0, todayKey: today(), weekXP: 0, weekKey: weekKey(),
    streak: 0, lastActive: '', actionsToday: {}, questsDone: [], lifetime: {}, once: [],
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
        once: [...new Set([...(cur.once || []), ...(Array.isArray((incoming as any).once) ? (incoming as any).once : [])])],
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
    { id: 'keep100', label: 'Memory Master',desc: 'Keep 100 cards at review',       earned: (life.card_retained || 0) >= 100 },
    { id: 'beat3',   label: 'Pattern Breaker', desc: 'Beat 3 mistake patterns',    earned: (life.pattern_beaten || 0) >= 3 },
  ]
}

export function awardXP(action: XPAction) {
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

/**
 * Credit an action ONCE for a given key -- a beaten pattern's signature, a
 * chapter id crossing 70%. Re-detecting the same beaten pattern on every
 * Performance visit must not pay again. Returns true when XP was awarded.
 */
export function awardOnce(action: XPAction, key: string): boolean {
  const k = `${action}:${key}`
  const s = loadGame()
  if ((s.once || []).includes(k)) return false
  s.once = [...(s.once || []), k].slice(-2000)
  save(s)
  awardXP(action)
  return true
}

/**
 * Chapters whose mastery has crossed 70% get their one-time credit. Fed by
 * whoever has just computed syllabus states (Plan, Progress); idempotent.
 */
export function awardMasteryCrossings(states: Map<string, { mastery?: number }> | null | undefined): number {
  if (!states) return 0
  let n = 0
  for (const [id, st] of states) {
    if (typeof st?.mastery === 'number' && st.mastery >= 0.7 && awardOnce('chapter_70', id)) n++
  }
  return n
}

// The old arbitrary-amount grant with a free-text label is gone on
// purpose: every XP grant in the app now goes through the published table.

// IDENTITY: this used to read the real name out of the stored profile and post
// it with every XP write, which is how "Sathyamoorthi K S" ended up on a
// public leaderboard. The real name never leaves this device for a social
// surface again -- the server derives the username itself.
function userIdentity(): { id: string } {
  let id = ''
  try {
    const p = JSON.parse(storedProfileRaw() || '{}')
    id = p.id || p.user_id || ''
  } catch {  }
  if (!id) {
    id = getRaw('kyno:device-id') || ''
    if (!id) {
      id = 'dev-' + Math.random().toString(36).slice(2, 10)
      try { setRaw('kyno:device-id', id) } catch {  }
    }
  }
  return { id }
}

/** Study minutes this week, reported so the league can group on effort rather than ability. Optional hook. */
let _weekMinutes: (() => number) | null = null
export function provideWeekMinutes(fn: () => number) { _weekMinutes = fn }
/** Push this week's XP and minutes now (the league groups on minutes, so they must arrive before the group is formed). */
export function pushLeagueNow() { try { syncLeague(loadGame()) } catch {  } }

let _syncTimer: any = null
function syncLeague(s: GameState) {
  clearTimeout(_syncTimer)
  _syncTimer = setTimeout(() => {
    const { id } = userIdentity()
    let minutes: number | undefined
    try { minutes = _weekMinutes ? Math.max(0, Math.round(_weekMinutes())) : undefined } catch { minutes = undefined }
    // Use the api helper so the auth token is attached — the server takes the
    // identity from the token, not from a body field anyone could forge.
    post('/league/xp', { user_id: id, week: s.weekKey, xp: s.weekXP, ...(minutes != null ? { minutes } : null) })
      .catch(() => {  })   // leaderboard sync is best-effort, never blocks play
  }, 1500)
}

export async function fetchLeaderboard(): Promise<{ rank: number; rows: { name: string; xp: number; you: boolean }[] } | null> {
  try {
    // through the api helper so the token rides along: "you" is the token's identity now
    return await get(`/league/board?week=${encodeURIComponent(weekKey())}`)
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
    const params = new URLSearchParams({ range })
    if (range === 'week')  params.set('week', weekKey())
    if (range === 'month') params.set('month', monthKey())
    return await get(`/league/board?${params.toString()}`)
  } catch { return null }
}
