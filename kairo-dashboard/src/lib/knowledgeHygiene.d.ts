/** Types for knowledgeHygiene.js. The implementation stays plain JS so the
 *  test suite imports the real module rather than a transpiled copy. */

export interface CanonicalTopic {
  /** Stable lowercase key — compare on this. */
  key: string
  /** Title-cased name for the UI. */
  display: string
}

/** A chat turn's kind. Only 'question' may be stored as a doubt. */
export type TurnKind = 'question' | 'command' | 'attempt' | 'other' | 'empty'

export const DEDUPE_WINDOW_MS: number

export function normalizeTopicText(s: string | null | undefined): string

/** null when the string is not a topic at all — "Ai", "General", a sentence. */
export function canonicalTopic(raw: string | null | undefined): CanonicalTopic | null

export function classifyChatTurn(text: string | null | undefined): TurnKind

/** Sorted set of the symbols a formula relates, so rearrangements match. */
export function formulaSignature(expr: string | null | undefined): string

export function isSameFormula(
  a: { expr?: string; topic?: string } | null | undefined,
  b: { expr?: string; topic?: string } | null | undefined,
): boolean

export function findRecentDuplicate<T extends { ts?: number }>(
  existing: T[] | null | undefined,
  candidate: unknown,
  sameFn: (item: T, candidate: any) => boolean,
  now?: number,
  windowMs?: number,
): T | null

export function sameText(a: string | null | undefined, b: string | null | undefined): boolean
