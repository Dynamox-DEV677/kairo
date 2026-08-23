export const MIN_STREAK_SESSION_MS: number
export const HISTORY_CAP: number

export interface FocusSegment { start: number; end?: number | null }
export interface FocusRecord {
  ts: number
  focusedMs: number
  plannedMs?: number
  drifts?: number
  goal?: string
  /** total ms spent drifted away mid-session */
  driftMs?: number
  /** the commitment contract: what the student banned for this session */
  banned?: string[]
  /** what the twin log says was studied inside the session window */
  receipt?: import('./focusReceipt.core').Receipt
}

export function sessionFocusedMs(segments: FocusSegment[] | unknown, now?: number): number
export function parseHistory(raw: unknown): FocusRecord[]
export function appendSession(history: FocusRecord[] | unknown, record: FocusRecord): FocusRecord[]
export function dayKey(ts: number): string
export function focusStreakDays(history: FocusRecord[] | unknown, now: number): number
export function weekMinutes(history: FocusRecord[] | unknown, now: number): number
export function sessionHeadline(record: FocusRecord, history: FocusRecord[] | unknown, now: number): string
