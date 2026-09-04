
export interface BattleResult {
  ts:         number
  score:      number
  total:      number
  difficulty: 'easy' | 'medium' | 'hard'
  topic?:     string
  subject?:   string
  daily:      boolean
}

export interface BattleStats {
  total_xp:     number
  battles:      number
  avg_accuracy: number
  streak:       number
  best:         { accuracy: number; xp: number; topic: string; difficulty: string } | null
  recent:       BattleResult[]
}

export interface DailyChallenge {
  date:           string
  challenge:      { subject: string; topic: string; difficulty: 'easy' | 'medium' | 'hard' }
  already_played: boolean
  xp_per_correct: number
  questions:      number
}

const K_STATS   = 'kyno:battle:stats'
const K_RESULTS = 'kyno:battle:results'
const K_DAILY   = 'kyno:battle:daily'

const ROTATION: Array<DailyChallenge['challenge']> = [
  { subject: 'Math',      topic: 'quadratic equations',  difficulty: 'medium' },
  { subject: 'Physics',   topic: 'newton laws',          difficulty: 'medium' },
  { subject: 'Chemistry', topic: 'periodic table',       difficulty: 'easy'   },
  { subject: 'Biology',   topic: 'cell organelles',      difficulty: 'medium' },
  { subject: 'Math',      topic: 'vectors',              difficulty: 'hard'   },
  { subject: 'English',   topic: 'tenses and modals',    difficulty: 'easy'   },
  { subject: 'Physics',   topic: 'kinematics',           difficulty: 'medium' },
  { subject: 'Chemistry', topic: 'chemical bonding',     difficulty: 'medium' },
  { subject: 'Biology',   topic: 'photosynthesis',       difficulty: 'easy'   },
  { subject: 'Math',      topic: 'trigonometry',         difficulty: 'hard'   },
  { subject: 'Physics',   topic: 'electric circuits',    difficulty: 'medium' },
  { subject: 'English',   topic: 'reading comprehension', difficulty: 'easy'  },
  { subject: 'Chemistry', topic: 'acids and bases',       difficulty: 'medium'},
  { subject: 'Biology',   topic: 'human heart',           difficulty: 'medium'},
]

function todayKey(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch { return fallback }
}

function safeWrite(key: string, value: any) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {  }
}

export function getDailyLocal(): DailyChallenge {
  const date = todayKey()
  const existing = safeRead<DailyChallenge | null>(K_DAILY, null)
  if (existing && existing.date === date) {
    return existing
  }
  const d = new Date()
  const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000)
  const challenge = ROTATION[(dayOfYear + d.getFullYear()) % ROTATION.length]
  const fresh: DailyChallenge = {
    date,
    challenge,
    already_played: false,
    xp_per_correct: 14,
    questions:      8,
  }
  safeWrite(K_DAILY, fresh)
  return fresh
}

export function getStatsLocal(): BattleStats {
  const results = safeRead<BattleResult[]>(K_RESULTS, [])
  const totalXP = results.reduce((a, r) => a + r.score * 14, 0)
  const battles = results.length
  const accs    = results.map(r => Math.round((r.score / Math.max(1, r.total)) * 100))
  const avgAcc  = accs.length ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length) : 0

  let streak = 0
  const days = new Set(results.map(r => {
    const d = new Date(r.ts); d.setHours(0, 0, 0, 0); return d.getTime()
  }))
  let cursor = new Date(); cursor.setHours(0, 0, 0, 0)
  while (days.has(cursor.getTime())) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  let best: BattleStats['best'] = null
  for (const r of results) {
    const acc = Math.round((r.score / Math.max(1, r.total)) * 100)
    const xp  = r.score * 14
    if (!best || xp > best.xp) {
      best = { accuracy: acc, xp, topic: r.topic || '—', difficulty: r.difficulty }
    }
  }

  return {
    total_xp:     totalXP,
    battles,
    avg_accuracy: avgAcc,
    streak,
    best,
    recent:       results.slice(0, 12),
  }
}

export function submitLocal(r: Omit<BattleResult, 'ts'>): void {
  const next: BattleResult = { ts: Date.now(), ...r }
  const arr = safeRead<BattleResult[]>(K_RESULTS, [])
  arr.unshift(next)
  safeWrite(K_RESULTS, arr.slice(0, 60))

  if (r.daily) {
    const daily = safeRead<DailyChallenge | null>(K_DAILY, null)
    if (daily && daily.date === todayKey()) {
      safeWrite(K_DAILY, { ...daily, already_played: true })
    }
  }
}

export interface LocalLeader {
  rank: number; user_id: string; name: string; avatar_url: string | null
  class_name: string | null; xp: number; battles: number; accuracy: number
}

export function getLeaderboardLocal(): { leaders: LocalLeader[]; you: LocalLeader } {
  const stats = getStatsLocal()
  const you: LocalLeader = {
    rank: 1, user_id: 'me',
    name: 'You', avatar_url: null,
    class_name: null,
    xp: stats.total_xp, battles: stats.battles, accuracy: stats.avg_accuracy,
  }
  // Offline there is nobody else to show, so nobody else is shown. This used
  // to invent five named "classmates" around the student's score; a fabricated
  // opponent is exactly what the social rules forbid.
  return { leaders: [you], you }
}

export function isMissingBackend(err: any): boolean {
  if (!err) return false
  const msg = String(err?.message || err || '').toLowerCase()
  return (
    msg.includes('battle_scores') ||
    msg.includes('battle_results') ||
    msg.includes('does not exist') ||
    msg.includes('relation') && msg.includes('does not exist') ||
    msg.includes('404') ||
    msg.includes('failed to fetch') ||
    msg.includes('setup_required')
  )
}
