export const CODE_LEN: number
export const FOCUS_MIN: number
export const BREAK_MIN: number

export interface TimerState {
  seq: number
  phase: 'idle' | 'focus' | 'break'
  endsAt: number | null
  focusMin: number
  breakMin: number
  by: string | null
}

export function newRoomCode(rand?: () => number): string
export function cleanCode(input: unknown): string
export function isValidCode(input: unknown): boolean
export function idleState(): TimerState
export function startFocus(cur: TimerState, args: { now: number; by?: string | null }): TimerState
export function startBreak(cur: TimerState, args: { now: number; by?: string | null }): TimerState
export function stopTimer(cur: TimerState, args: { by?: string | null }): TimerState
export function nextPhase(cur: TimerState, args: { now: number; by?: string | null }): TimerState
export function remainingMs(state: TimerState | null | undefined, now: number): number
export function phaseDone(state: TimerState | null | undefined, now: number): boolean
export function applyTimerEvent(current: TimerState | null | undefined, incoming: unknown): TimerState
export function clockLabel(ms: number): string
