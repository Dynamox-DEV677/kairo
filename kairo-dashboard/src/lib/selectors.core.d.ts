/** Types for selectors.core.js. The implementation stays plain JS so the test
 *  suite imports the real module rather than a transpiled copy of it. */
export interface EventLike { ts: number; score?: number; correct?: boolean }
export interface MasteryLike { mastery?: number; attempts?: number }
export interface GameLike { totalXP?: number; todayXP?: number; weekXP?: number }

export const MASTERY_BAR: number
export const PREDICTION_MIN_SCORED: number

export function selectStreak(events: EventLike[] | null | undefined, now?: number): number
export function selectXP(game: GameLike | null | undefined): { total: number; today: number; week: number }
export function selectLevel(totalXP: number): { level: number; into: number; need: number; pct: number }
export function selectMastered(mastery: MasteryLike[] | null | undefined): number
export function selectRetention(mastery: MasteryLike[] | null | undefined): number | null
export function selectPrediction(events: EventLike[] | null | undefined, outOf?: number): {
  ready: boolean; need?: number; reason?: string
  low?: number; high?: number; mid?: number; outOf?: number; basedOn?: number
}

export interface TopicRow {
  topicId: string | null
  /** Kept required to match twin.ts WeakTopic, which these feed directly. */
  topic: string
  subject: string
  mastery: number
  attempts: number
  severity: number
  lastStudiedAt: number | null
}
export function selectWeakTopics(mastery: any[] | null | undefined, opts?: { max?: number; minAttempts?: number }): TopicRow[]
export function selectStrongTopics(mastery: any[] | null | undefined, opts?: { max?: number; minAttempts?: number }): TopicRow[]
