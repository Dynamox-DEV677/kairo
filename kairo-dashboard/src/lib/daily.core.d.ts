export interface DailyTask {
  kind: 'revise' | 'practice' | 'flashcards' | 'plan' | 'stretch'
  topic: string | null
  subject: string | null
  title: string
  why: string
  /** Sidebar route id to jump to. */
  to: string
}

export function todaysThree(args: {
  twin?: unknown
  dueCards?: number
  examDates?: Array<{ name?: string; date?: string }>
  now?: number
}): DailyTask[]

export const MIN_ATTEMPTS: number
export function growthStat(events: unknown, now: number):
  | { ready: false; needed: number; recentCount: number; beforeCount: number }
  | { ready: true; accNow: number; accBefore: number; deltaPts: number; recentCount: number; beforeCount: number }

export const DIFF_ORDER: string[]
export const MIN_SIGNAL: number
export function nextDifficulty(
  results: unknown,
  current?: string,
): { level: string; changed: boolean; reason: string; accuracy: number | null }
