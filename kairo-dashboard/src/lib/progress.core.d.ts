import type { Graph, GraphNode, NodeState } from './syllabusGraph.core'

export const MAX_NODES: number
export const RAMP: { solid: string; shaky: string; untouched: string; untouchedStroke: string }
export const FADE: { ring: string; fill: string; dimFill: string; dimStroke: string; edge: string }
export const EDGE: string
export const GROUP_SIZE: number
export const MIN_GROUP: number

export interface ChapterGroup { id: string; label: string; chapters: GraphNode[] }
export function chapterGroups(graph: Graph | null | undefined): ChapterGroup[]

export function nodeRadius(marks: number | undefined, minMarks?: number, maxMarks?: number): number

export interface LaidNode { id: string; name: string; marks: number; x: number; y: number; r: number }
export function layoutGroup(chapters: GraphNode[], opts?: { w?: number; h?: number; pad?: number }): { w: number; h: number; nodes: LaidNode[] }
export function edgesFor(chapters: GraphNode[]): Array<{ from: string; to: string }>

export function paintFor(state: NodeState | null | undefined): { key: 'solid' | 'shaky' | 'untouched'; fill: string; stroke: string | null }
export function mapIsEmpty(states: Map<string, NodeState> | null | undefined): boolean

export function fadingByChapter(graph: Graph | null | undefined, flashcards?: unknown[], now?: number, opts?: { withinDays?: number }): Map<string, number>
export function numberWord(n: number): string
export function fadingCallout(count: number): { headline: string; body: string; action: string } | null

export function weekStart(now?: number): number
export function weekMinutes(input?: { focusHistory?: unknown[]; timeStore?: unknown; now?: number }): number
export function effortBand(minutes: number): 1 | 2 | 3 | 4
export function leagueSections<T extends { xp?: number }>(rows?: T[]): { movingUp: Array<T & { rank: number }>; stayingPut: Array<T & { rank: number }> }
export function timeLeftLabel(now?: number): string
export function roomMinutes(joinedAt: number | undefined, now?: number): number
