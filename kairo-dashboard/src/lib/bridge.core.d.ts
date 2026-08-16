export interface TopicRow {
  name: string
  chapter?: string
  subject?: string
  topicId?: string
  matchedWith?: string
  confidence?: number
}

export interface BridgeSide { label: string; cls: string | null; total: number }

export interface BridgeUnavailable {
  unavailable: true
  reason: string
  missing: string[]
}

export interface BridgeResult {
  unavailable: false
  from: BridgeSide
  to: BridgeSide
  covered: TopicRow[]
  toLearn: TopicRow[]
  canDrop: TopicRow[]
  readiness: number
}

export interface BridgeInputSide {
  label: string
  cls: string | null
  syllabusBoard: string | null
  /** Class keys to union — everything covered so far, not just this year. */
  classes?: string[]
}

export const MATCH_FLOOR: number

export function classesUpTo(cls: unknown): string[]
export function tokenise(s: unknown): Set<string>
export function similarity(a: unknown, b: unknown): number
export function subjectsAlign(a: unknown, b: unknown): boolean
export function compareTopics(
  oldTopics: readonly TopicRow[] | unknown,
  newTopics: readonly TopicRow[] | unknown,
  opts?: { floor?: number },
): { covered: TopicRow[]; toLearn: TopicRow[]; canDrop: TopicRow[] }
export function buildBridge(args: {
  from: BridgeInputSide
  to: BridgeInputSide
  lookup: (board: string, cls?: string | null) => TopicRow[]
}): BridgeResult | BridgeUnavailable
export function groupRows(rows: readonly TopicRow[] | unknown): Array<{
  subject: string
  chapters: Array<{ chapter: string; topics: TopicRow[] }>
}>
