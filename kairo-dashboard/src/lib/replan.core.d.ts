export const TYPE_PRIORITY: string[]
export const MAX_CARRY_PER_DAY: number

export interface CarriedBlock { time?: string; subject?: string; topic?: string; type?: string; carried?: boolean; from?: { week: number; day: string; idx: number } }

export function blockKey(week: number, day: string, idx: number): string
export function flattenDays(weeklySchedule: unknown): Array<{ week: number; day: string; dayIndex: number; blocks: any[] }>
export function planDayIndex(createdAtMs: number, nowMs: number): number
export function missedBlocks(plan: unknown, completion: Record<string, true> | null | undefined, todayIdx: number): CarriedBlock[]
export function readjustPlan(plan: any, completion: Record<string, true> | null | undefined, todayIdx: number): {
  plan: any; moved: number; overflow: CarriedBlock[]; changed: boolean
}
