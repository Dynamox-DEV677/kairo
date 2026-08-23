export interface Marking { correct: number; wrong: number }

export interface PaperPreset {
  id: string
  label: string
  note: string
  questions: number
  minutes: number
  marking: Marking
  pickSubject: boolean
  subjects: string[] | null
}

export const PAPER_PRESETS: PaperPreset[]
export const LEAK_MULTIPLE: number

export interface ExamQuestion {
  q: string
  options: string[]
  correctIndex: number
  explanation?: string | null
  subject?: string | null
  topic?: string | null
  difficulty?: string | null
}

export function remainingMs(startedAt: number, totalMs: number, now: number): number
export function paletteStates(total: number, answers: (number | null)[] | unknown, flags: Iterable<number> | unknown): ('done' | 'flag' | 'blank')[]
export function scorePaper(questions: ExamQuestion[] | unknown, answers: (number | null)[] | unknown, marking: Marking): {
  correct: number; wrong: number; blank: number; marks: number; maxMarks: number; negLost: number
}
export function postMortem(args: {
  questions?: ExamQuestion[]; answers?: (number | null)[]; times?: number[]; marking: Marking
}): {
  per: { i: number; subject: string | null; topic: string | null; correct: boolean; answered: boolean; timeMs: number; marks: number }[]
  avgTimeMs: number
  totalTimeMs: number
  leaks: { i: number; subject: string | null; topic: string | null; timeMs: number; marks: number; correct: boolean; answered: boolean }[]
  bySubject: Record<string, { attempted: number; correct: number; timeMs: number }>
} | null
export function splitCounts(total: number, subjects: unknown[]): number[]
export function clockLabel(ms: number): string
