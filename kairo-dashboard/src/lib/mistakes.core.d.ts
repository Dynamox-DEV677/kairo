export const FAST_FRACTION: number
export const SLOW_MULTIPLE: number
export const STRONG_MASTERY: number
export const CATEGORIES: Record<string, { label: string; fix: string }>
export interface MistakeCategory {
  key: string; label: string; fix: string; count: number
  topics: Array<{ topic: string; count: number }>
}
export function classifyMistakes(
  events: unknown,
  mastery?: any[],
  opts?: { windowDays?: number; now?: number },
): { categories: MistakeCategory[]; total: number; timedShare: number }
