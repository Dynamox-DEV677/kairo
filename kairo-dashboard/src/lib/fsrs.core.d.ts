export const W: number[]
export const TARGET_RETENTION: number
export const RATINGS: { AGAIN: 1; HARD: 2; GOOD: 3; EASY: 4 }
export const PHASES: { id: string; min: number; factor: number }[]

export interface FsrsCard {
  stability: number
  difficulty: number
  reps: number
  lapses: number
}

export function retrievability(elapsedDays: number, stability: number): number
export function intervalFor(stability: number, targetRetention?: number): number
export function initCard(rating: 1 | 2 | 3 | 4): FsrsCard
export function reviewCard(card: FsrsCard, rating: 1 | 2 | 3 | 4, elapsedDays: number): FsrsCard
export function phaseFor(daysToExam: number | null | undefined): 'FAR' | 'MID' | 'NEAR' | 'FINAL'
export function nextInterval(card: FsrsCard, opts?: { daysToExam?: number | null; targetRetention?: number }): {
  intervalDays: number
  phase: string
  baseIntervalDays: number
}
export function phasePolicy(daysToExam: number | null | undefined): {
  phase: string
  newAllowed: boolean
  reviewShare: number
  newMarksFloor?: number
  note: string
}
