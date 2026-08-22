export interface StreamMeta { label: string; blurb: string }
export const STREAMS: Record<'science'|'commerce'|'arts', StreamMeta>
export interface StreamQuizItem { q: string; options: { label: string; signal: 'science'|'commerce'|'arts' }[] }
export const STREAM_QUIZ: StreamQuizItem[]
export const PERF_WEIGHT: number
export const QUIZ_WEIGHT: number
export function performanceScores(mastery: any[]): { scores: Record<string, number>; distinctSubjects: number }
export function quizScores(signals: string[]): Record<'science'|'commerce'|'arts', number>
export interface StreamSuggestion {
  ranked: { stream: string; label: string; score: number; perfPart: number; quizPart: number }[]
  top: string
  reasons: string[]
  dataStrength: 'none' | 'low' | 'ok'
  close: boolean
}
export function suggestStream(args?: { mastery?: any[]; signals?: string[] }): StreamSuggestion
