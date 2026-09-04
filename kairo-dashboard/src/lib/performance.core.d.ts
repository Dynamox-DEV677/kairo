export type ErrType = 'conceptual' | 'formula' | 'calculation' | 'careless' | 'incomplete'
export type Source = 'quiz' | 'written' | 'mock' | 'flashcard' | 'doubt'

export const TYPES: ErrType[]
export const TYPE_GLOSS: Record<ErrType, string>
export const PATTERN_MIN: number

export interface SignatureInfo {
  id: string
  type: ErrType | null
  name: string
  fix: string | null
  code: string
  cost: string | null
}
export const SIGNATURES: Record<string, Omit<SignatureInfo, 'id'>>
export function humanise(sig: string): string
export function signatureInfo(sig: string): SignatureInfo

export interface MistakeRecord {
  id: string
  ts: number
  topic: string | null
  subject: string | null
  source: Source
  type: ErrType
  signature: string
  marksLost: number
  question: string | null
  studentAnswer: string | null
  correctAnswer: string | null
  divergedAt: number | null
  lines: string[] | null
  why: string | null
  stepTitle?: string | null
  stepReason?: string | null
}

export function classifyEvent(e: unknown): MistakeRecord[]
export function mistakeRecords(events?: unknown[]): MistakeRecord[]
export function weeklySparkline(records?: MistakeRecord[], now?: number): number[]

export interface PatternRow {
  signature: string
  name: string
  type: ErrType
  count: number
  marksLost: number
  lastAt: number
  firstAt: number
  trend: 'active' | 'improving' | 'beaten'
  trendLabel: string
  sparkline: number[]
  occurrences: MistakeRecord[]
  isPattern: boolean
}
export interface Patterns { live: PatternRow[]; beaten: PatternRow[]; forming: PatternRow[]; all: PatternRow[] }
export function patterns(records?: MistakeRecord[], now?: number): Patterns

export type Summary =
  | { state: 'empty'; headline: string; sub: string }
  | { state: 'early'; headline: string; sub: string; recent: MistakeRecord[]; patterns: Patterns }
  | { state: 'ready'; headline: string; patterns: Patterns }
export function summarize(records?: MistakeRecord[], now?: number): Summary
export function beatenCopy(p: Patterns, now?: number): { title: string; sub: string; real: boolean } | null

export interface Impact {
  mockTs: number
  mockName: string
  scored: number
  total: number
  totalLost: number
  segments: Array<{ type: ErrType; marks: number; count: number }>
  reframe: { headline: string; body: string } | null
  cheapest: Array<{ type: ErrType; marks: number; label: string; cost: string }>
}
export function impact(records?: MistakeRecord[], events?: unknown[], now?: number): Impact | null

export interface TopicRow {
  topic: string
  mastery: number | null
  count: number
  marksLost: number
  share: Record<ErrType, number>
  dominant: ErrType
  group: 'relearn' | 'tighten'
  advice: string
  recent3w: number
}
export function topicGroups(records?: MistakeRecord[], mastery?: unknown[], now?: number): { relearn: TopicRow[]; tighten: TopicRow[] }

export function crossCut(occurrences?: MistakeRecord[]): string | null
export function habitTitle(sig: string): string
export function occurrenceContext(o: MistakeRecord): string
export function shortDate(ts: number): string
export function sinceLine(row: PatternRow): string
