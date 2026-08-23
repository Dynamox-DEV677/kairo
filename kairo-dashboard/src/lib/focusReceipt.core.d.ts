export const SUGGESTED_BANS: string[]
export const MAX_BANS: number

export interface Receipt {
  questions: number
  correct: number
  cards: number
  notes: number
  concepts: number
  essays: number
  labs: number
  actions: number
  topics: { subject: string; topic: string; count: number }[]
}

export interface TodaysFocus {
  sessions: number
  focusedMin: number
  drifts: number
  driftMin: number
  questions: number
  correct: number
  cards: number
  notes: number
  topics: { subject: string; topic: string; count: number }[]
}

export function parseBanList(raw: unknown): string[]
export function toggleBan(list: string[], name: string): string[]
export function sessionReceipt(events: unknown, startTs: number, endTs: number): Receipt
export function receiptLine(r: Receipt | null | undefined): string | null
export function todaysFocus(history: unknown, now: number): TodaysFocus | null
