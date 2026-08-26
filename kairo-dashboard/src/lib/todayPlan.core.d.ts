import type { RankedRow } from './syllabusRank.core'
import type { GraphNode } from './syllabusGraph.core'

export const COST_MINUTES: { review: number; coverage: number; repair: number }
export const DEFAULT_DAILY_MINUTES: number

export interface TodayItem {
  kind: 'repair' | 'review' | 'coverage'
  id: string
  title: string
  why: string
  minutes: number
  partial?: boolean
  count?: number
  marks?: number
  to: string
}

export interface TodayPlan {
  phase: string
  daysToExam: number | null
  note: string
  items: TodayItem[]
  plannedMinutes: number
  budgetMinutes: number
}

export function todayPlan(args?: {
  dueCards?: unknown[]
  ranked?: RankedRow[]
  fading?: GraphNode[]
  daysToExam?: number | null
  dailyMinutes?: number
  now?: number
}): TodayPlan
