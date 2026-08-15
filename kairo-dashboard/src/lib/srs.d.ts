/** Types for srs.js — implementation stays plain JS so tests import the real
 *  module. Mirrors server/utils/mastery.js; srs tests pin them together. */
export interface SrsCard { ease?: number; interval?: number; reps?: number; lapses?: number }
export interface SrsResult { ease: number; interval: number; reps: number; lapses: number; dueAt: number }
export type DueLabel = 'unscheduled' | 'overdue' | 'due' | 'scheduled'

export function sm2(card: SrsCard | null | undefined, quality: number, now?: number): SrsResult
export function qualityFrom(correct: boolean, difficulty?: number): number
export function dueState(dueAt: number | null | undefined, now?: number): { state: DueLabel; hours: number | null; label: string }
export function revisionQueue(
  rows: any[] | null | undefined,
  opts?: { now?: number; withinHours?: number; max?: number },
): Array<{ topic: string; subject: string; mastery: number; dueAt: number; state: DueLabel; hours: number | null; label: string }>
