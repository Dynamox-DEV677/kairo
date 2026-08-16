export const WEAK_BAR: number
export const LOOKBACK: number

export interface PrereqGateResult {
  chapter: string
  evidence: { topic?: string; chapter?: string; mastery: number }
  message: string
}

export function prerequisitesFor(
  topicText: unknown,
  args: { board: string | null; cls?: string | null; lookup: (board: string, cls?: string | null) => any[] },
): string[]
export function prereqGate(
  topicText: unknown,
  args: { board: string | null; cls?: string | null; lookup: (board: string, cls?: string | null) => any[]; mastery?: any[] },
): PrereqGateResult | null
