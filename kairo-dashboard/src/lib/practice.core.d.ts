export const ESTIMATE: { card: number; question: number; written: number; teach: number }
export const BUDGETS: number[]
export const ALLOCATION: Record<number, { cards: number; questions: number; written: number; teach: number }>

export type ItemKind = 'card' | 'question' | 'written' | 'teach'

export interface CardLike {
  id?: string
  front: string
  back: string
  topic?: string
  subject?: string
  dueAt: number
  [k: string]: unknown
}

export interface MistakeLike { topic?: string; subject?: string; severity?: number; count?: number; [k: string]: unknown }
export interface MasteryLike { topic?: string; subject?: string; mastery?: number; attempts?: number; [k: string]: unknown }

export interface Target { topic: string; subject: string | null; why: 'mistakes' | 'mastery' }

export type SessionItem =
  | { kind: 'card'; card: CardLike }
  | { kind: 'question'; topic: string | null; subject: string | null }
  | { kind: 'written'; topic: string | null; subject: string | null }
  | { kind: 'teach'; topic: string | null; subject: string | null }

export interface PreviewRow { kind: ItemKind; label: string; minutes: number }

export interface SessionPlan {
  minutes: number
  items: SessionItem[]
  counts: { cards: number; questions: number; written: number; teach: number }
  target: Target | null
  estimatedMinutes: number
  preview: PreviewRow[]
}

export function dueCards(cards?: CardLike[], now?: number): CardLike[]
export function targetTopic(mistakes?: MistakeLike[], mastery?: MasteryLike[]): Target | null
export function buildSession(opts?: {
  minutes?: number
  cards?: CardLike[]
  mistakes?: MistakeLike[]
  mastery?: MasteryLike[]
  now?: number
  disabled?: ItemKind[] | Array<'questions' | 'written' | 'teach'>
}): SessionPlan
export function previewRows(counts: SessionPlan['counts'], target: Target | null): PreviewRow[]
export function rebuildWithout(items: SessionItem[], kind: ItemKind, fromIndex?: number): SessionItem[]

export function clock(ms: number): string
export function intervalLabel(days: number): string
export function lastMissLine(card: CardLike | null | undefined, events?: Array<{ ts?: number; topic?: string; correct?: boolean }>, now?: number): string | null

export interface MovementRow { topic: string; from: number; to: number; delta: number; moved: boolean; label: string }
export function movementRows(before?: MasteryLike[], after?: MasteryLike[], touched?: string[]): MovementRow[]
export function resultsHeadline(rows?: MovementRow[], weakTopics?: string[]): { headline: string; sub: string }
export function xpFor(summary?: { cards?: number; questions?: number; correct?: number; written?: number; teach?: number; finished?: boolean }): number
export function flatTopicNudge(rows?: MovementRow[]): { topic: string; headline: string; detail: string } | null
