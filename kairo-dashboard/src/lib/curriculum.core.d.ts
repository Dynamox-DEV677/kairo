export type CurriculumId = 'ncert' | 'cambridge' | 'icse' | 'ib' | 'generic'

export interface BoardOption {
  value: string
  label: string
  hint: string
}

export interface CurriculumProfile {
  id: CurriculumId
  label: string
  /** Key into src/data/syllabus/<board>.json, or null when no verified map exists. */
  syllabusBoard: string | null
  region: string | null
  currency: string | null
  cls: string | null
  isCambridge: boolean
}

export interface CommandWordSpec {
  marksTypically: string
  shape: string
  why: string
}

export const BOARD_OPTIONS: BoardOption[]
export const COMMAND_WORDS: Record<string, CommandWordSpec>

export function normaliseBoard(board: unknown): CurriculumId
export function getCurriculum(id: string): { id: CurriculumId; label: string; syllabusBoard: string | null; region: string | null; currency: string | null; style: string[]; exam: string[]; examples: string[] }
export function resolveCurriculum(board: unknown, cls?: unknown): CurriculumProfile
export function curriculumDirective(board: unknown, cls?: unknown, opts?: { scope?: string[] }): string
export function detectCommandWord(text: unknown): string | null
export function commandWordDirective(word: unknown): string
