import type { Graph, GraphNode, NodeState } from './syllabusGraph.core'

export const HISTORY_WINDOW_DAYS: number
export const MIN_HISTORY_DAYS: number
export const DEFAULT_TARGET: number
export const DEFAULT_SESSION_MIN: number

export function dayKey(ts: number): string
export function startOfDay(ts: number): number

export interface FocusRecordLike { ts: number; focusedMs: number; [k: string]: unknown }
export interface TimeStoreLike { rows?: Record<string, { ms?: number; days?: Record<string, number> }> }

export interface DailyMinutes {
  byDay: Map<string, number>
  days: number
  /** null until MIN_HISTORY_DAYS days carry data */
  median: number | null
  sessionMedian: number
}
export function dailyMinutes(args?: { focusHistory?: FocusRecordLike[]; timeStore?: TimeStoreLike | null; now?: number }): DailyMinutes

export interface CoverageSplit { solidPct: number; shakyPct: number; untouchedPct: number; totalMarks: number }
export function coverageSplit(graph: Graph | null | undefined, states: Map<string, NodeState> | null | undefined): CoverageSplit
export function minutesNeeded(graph: Graph | null | undefined, states: Map<string, NodeState> | null | undefined): number

export interface Projection {
  projected: number | null
  required: number | null
  reachable: number
  gap: number
  daysLeft: number | null
  haveHistory: boolean
  perMinute?: number
}
export function project(args?: { solidPct?: number; needMinutes?: number; dailyMedian?: number | null; daysLeft?: number | null; target?: number }): Projection
export function honestLine(p: Projection | null | undefined, dailyMedian: number | null, target?: number): string

export interface WeekTile { ts: number; label: string; state: 'done' | 'missed' | 'today' | 'future'; minutes: number }
export function weekStrip(byDay: Map<string, number> | null | undefined, now?: number): { tiles: WeekTile[]; done: number; header: string }
export function missedRun(byDay: Map<string, number> | null | undefined, now?: number): number

export interface ChapterRow {
  id: string; name: string; marks: number; state: NodeState['state']; mastery: number
  solidPct: number; shakyPct: number; needMinutes: number; sessions: number; status: string
  atRisk: boolean; score: number; done: boolean
}
export function chapterRows(graph: Graph | null | undefined, states: Map<string, NodeState> | null | undefined, opts?: { sessionMin?: number }): { open: ChapterRow[]; done: ChapterRow[] }
export function untouchedCallout(rows: ChapterRow[]): { headline: string; sub: string; marks: number } | null

export interface PlanSession { kind: 'LEARN' | 'PRACTISE' | 'TEST'; minutes: number; day: number; what: string; why: string }
export interface TopicPlan { sessions: PlanSession[]; totalMinutes: number; spanDays: number; finish: number; framing: string }
export function defaultTopicPlan(node: GraphNode | null | undefined, opts?: { needMinutes?: number | null; sessionMin?: number; daysLeft?: number | null; now?: number }): TopicPlan

export interface AdjustOption { id: 'more' | 'skip' | 'keep'; title: string; to: number; tone: 'recommended' | 'neutral'; detail: string }
export function adjustOptions(args?: { p?: Projection | null; dailyMedian?: number | null; rows?: ChapterRow[]; target?: number }): { was: number; now: number; options: AdjustOption[] } | null

export interface FocusSession { startedAt: number; plannedMs: number; pausedMs?: number; pausedAt?: number | null; task?: string; drifts?: number; driftMs?: number }
export function elapsedMs(session: FocusSession | null | undefined, now?: number): number
export function remainingMs(session: FocusSession | null | undefined, now?: number): number
export function driftLine(drifts?: number, driftMs?: number): { left: string; lost: string } | null
