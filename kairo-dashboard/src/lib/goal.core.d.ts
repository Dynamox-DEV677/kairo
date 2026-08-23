export const MIN_ATTEMPTS: number
export const ON_TRACK_TOLERANCE: number
export const MARKS_PER_SUBJECT: number
export const TARGET_PRESETS: number[]

export interface SubjectProjection {
  projected: number | null
  attempts: number
  correct: number
  confidence: 'none' | 'low' | 'ok'
}

export interface LeverTopic {
  topic: string
  subject: string
  wrong: number
  attempts: number
  gainEstimate: number
}

export interface GoalSubject extends SubjectProjection {
  subject: string
  targetPer: number
  gap: number | null
  onTrack: boolean
  levers: LeverTopic[]
}

export interface GoalPlan {
  total: number
  outOf: number
  subjects: GoalSubject[]
  ready: boolean
  subjectsWithData: number
  paceTotal: number | null
  topLever: LeverTopic | null
}

export interface GoalTarget { total: number; subjects: string[] }

export function subjectProjection(mastery: unknown, subject: string): SubjectProjection
export function leverTopics(mastery: unknown, subject: string, gap: number, opts?: { max?: number }): LeverTopic[]
export function goalPlan(args: { mastery?: unknown; target?: GoalTarget | null }): GoalPlan | null
export function parseGoal(raw: unknown): GoalTarget | null
export function suggestSubjects(mastery: unknown, opts?: { max?: number }): string[]
