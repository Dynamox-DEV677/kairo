export const MAX_CREDIT_MS: number
export const MIN_CREDIT_MS: number
export const KEEP_DAYS: number

export interface TimeStore { v: 1; rows: Record<string, { ms: number; days: Record<string, number> }> }
export interface TopicTime { topic: string; ms: number; todayMs: number; weekMs: number }
export interface SubjectTime { subject: string; ms: number; todayMs: number; weekMs: number; topics: TopicTime[] }

export function emptyStore(): TimeStore
export function readStore(raw: unknown): TimeStore
export function dayKey(ts: number): string
export function credit(store: TimeStore, args: { subject?: string | null; topic?: string | null; ms: number; ts: number }): TimeStore
export function aggregate(store: TimeStore, now: number): { subjects: SubjectTime[]; totalMs: number; todayMs: number; weekMs: number }
export function formatMs(ms: number): string
