export interface DoubtStep {
  title: string
  /** Equations and arithmetic, rendered in mono. May be empty. */
  working: string
  /** Plain-language reasoning. May be empty. */
  why: string
}

export interface SolverPlanLike {
  textExplanation?: string
  text?: string
  steps?: Array<{ title?: string; working?: string; why?: string }>
  [k: string]: unknown
}

export interface MistakeRowLike {
  topic?: string
  subject?: string
  count?: number
  lastAt?: number
  severity?: number
  [k: string]: unknown
}

export interface DoubtLike {
  id?: string
  ts?: number
  question?: string
  answer?: string
  topic?: string
  subject?: string
  [k: string]: unknown
}

export interface WeaknessSuggestion {
  topic: string
  subject: string
  count: number
  headline: string
  detail: string
  /** Ready to send straight to the solver when the card is tapped. */
  prompt: string
}

export interface RecentDoubtCard {
  id?: string
  question: string
  subject: string
  when: string
  meta: string
  saved: boolean
}

export function sentenceCase(s: string): string
export function relativeTime(ts: number, now?: number): string
export function contextLabel(profile?: Record<string, unknown>, subject?: string): string
export function contextIsUseful(profile?: Record<string, unknown>, subject?: string): boolean
export function looksLikeWorking(line: string): boolean
export function splitSteps(plan: SolverPlanLike | null | undefined): DoubtStep[]
export function weaknessSuggestion(mistakes?: MistakeRowLike[], now?: number): WeaknessSuggestion | null
export function ownMistakeLine(topic: string, mistakes?: MistakeRowLike[], now?: number): string | null
export function recentDoubtCards(doubts?: DoubtLike[], limit?: number, now?: number): RecentDoubtCard[]
