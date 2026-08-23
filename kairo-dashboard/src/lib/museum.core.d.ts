export const FIX_STREAK: number
export const FAST_MS: number
export const SLOW_MS: number

export interface MuseumEntry {
  id: string
  ts: number
  subject: string | null
  topic: string | null
  question: string
  options: string[] | null
  correctIndex: number | null
  chosenIndex: number | null
  explanation: string | null
  why: 'careless' | 'concept' | 'timing'
  misses: number
  fixed: boolean
  correctStreak: number
}

export interface LegacyGroup { subject: string | null; topic: string; count: number; lastTs: number }

export function questionKey(q: unknown): string
export function museumEntries(events: unknown): { entries: MuseumEntry[]; legacy: LegacyGroup[] }
export function drillDeck(entries: MuseumEntry[] | unknown, opts?: { max?: number }): MuseumEntry[]
export function rotatedOptions(entry: MuseumEntry): { options: string[]; correctIndex: number }
export function museumStats(entries: MuseumEntry[] | unknown): {
  open: number
  fixed: number
  bySubject: Record<string, number>
  byWhy: { careless: number; concept: number; timing: number }
}
export function cleanOption(opt: unknown): string
