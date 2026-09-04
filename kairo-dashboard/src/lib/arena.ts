/**
 * Client side of /api/arena. Thin: the server holds the match, the answers
 * and the score; this file only asks and shows.
 */
import { api, post, del } from './api'
import { getJSON, setJSON } from './storage'

export interface ArenaAnswer { index: number; choice: number; correct: boolean; points: number; at: number }
export interface ArenaQuestion { index: number; id: string; subject: string; kind: string; text: string; options: string[] }
export interface MatchView {
  id: string; subject: string; status: 'live' | 'done' | 'void'; startedAt: number; endsAt: number; now: number
  questions: ArenaQuestion[]
  me: { username: string; score: number; answers: ArenaAnswer[] }
  opp: { username: string | null; score: number; answered: number; connected: boolean }
}
export type QueueResult =
  | { matchId: string }
  | { waiting: true; waitedMs: number; giveUpAfterMs: number }
  | { offline: true; hint?: string }
  | { disabled: true }

export const queueForBattle = (subject: string, band: number): Promise<QueueResult> => post('/arena/queue', { subject, band })
export const leaveQueue = (): Promise<unknown> => del('/arena/queue')
export const fetchMatch = (id: string): Promise<MatchView> => api(`/arena/match/${encodeURIComponent(id)}`)
export const sendAnswer = (id: string, index: number, choice: number, elapsedMs: number): Promise<{ correct: boolean; points: number; correctIndex: number; score: number }> =>
  post(`/arena/match/${encodeURIComponent(id)}/answer`, { index, choice, elapsedMs })

export interface ArenaStats { played: number; won: number; drawn: number; offline?: boolean; fetchedAt?: number }
const STATS_KEY = 'kyno:arena:stats'
export function cachedArenaStats(): ArenaStats | null { try { return getJSON<ArenaStats>(STATS_KEY) } catch { return null } }
export async function refreshArenaStats(): Promise<ArenaStats | null> {
  try {
    const s: ArenaStats = await api('/arena/me')
    const next = { played: s.played || 0, won: s.won || 0, drawn: s.drawn || 0, fetchedAt: Date.now() }
    try { setJSON(STATS_KEY, next) } catch { /* storage blocked */ }
    return next
  } catch { return cachedArenaStats() }
}
