export const ROUND: { questions: number; seconds: number; waitSeconds: number; opponentTimeoutMs: number; graceMs: number }
export const SUBJECTS: string[]

export interface BankQuestion { id: string; subject: string; kind: string; text: string; options: string[]; answer: number }
export type PublicQuestion = Omit<BankQuestion, 'answer'>

export function subjectOfChapter(chapterId: string): string | null
export function hashSeed(str: string): number
export function buildBank(formulas?: unknown[], graph?: unknown): BankQuestion[]
export function publicQuestion(q: BankQuestion | null | undefined): PublicQuestion | null
export function pickQuestions(bank: BankQuestion[], subject: string, seed: string, n?: number): BankQuestion[]
export function subjectCounts(bank: BankQuestion[]): Record<string, number>
export function scoreAnswer(correct: boolean, elapsedMs: number, opts?: { base?: number; bonusMax?: number; perQuestionMs?: number }): number
export function outcome(myScore: number, oppScore: number): 'won' | 'lost' | 'draw'
export function masteryBand(avgMastery: number): 1 | 2 | 3

/** Kyno as the opponent: deterministic, calibrated to the student's band. */
export const KYNO_ACCURACY: Readonly<Record<number, number>>
export const KYNO_OPPONENT_NAME: string
export function kynoPlay(
  questionCount: number,
  opts?: { band?: number; seed?: number; accuracy?: number | null },
): Array<{ correct: boolean; elapsedMs: number }>
export function kynoScoreAfter(play: Array<{ correct: boolean; elapsedMs: number }>, answered: number): number

/** Topic options that work with or without a verified syllabus. */
export const FALLBACK_TOPICS: readonly string[]
export function topicChoices(chapters?: Array<{ id: string; name: string }>): {
  source: 'syllabus' | 'fallback'
  items: Array<{ id: string; name: string }>
}
