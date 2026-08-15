export interface UpdateEntry {
  /** Sequential, starting at 1. This is the identity of the update. */
  n: number
  /** "Kyno Update 3" — stored, not derived, so it can be renamed later. */
  title: string
  /** ISO YYYY-MM-DD. */
  date: string
  /** Short, student-visible lines. Never internal refactors. */
  changes: string[]
}

export function latestUpdateNumber(entries: readonly UpdateEntry[] | unknown): number
export function readLastSeen(raw: unknown): number
export function pendingUpdates(entries: readonly UpdateEntry[] | unknown, lastSeenRaw: unknown): UpdateEntry[]
export function seenAfterDismiss(shown: readonly UpdateEntry[] | unknown, currentLastSeen: unknown): number
export function validateUpdates(entries: readonly UpdateEntry[] | unknown): string[]
