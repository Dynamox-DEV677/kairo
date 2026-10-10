import type { SearchIndex, SearchResult } from './search.core'

export const ASK_BUDGET: number
export const DIGEST_CHUNK: number
export const STUDIO_BUDGET: number
export const MAX_RANGE: number

export type StudioKind = 'guide' | 'faq' | 'timeline' | 'mindmap'
export const STUDIO_KINDS: StudioKind[]

export interface PageText { page: number; text: string }
export interface PageRange { from: number; to: number }
export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

export function repairLatex(s: string, opts?: { newlines?: boolean }): string
export function formulaTex(input: string): string

export function pagesFromIndex(index: SearchIndex | null | undefined): PageText[]
export function pagesInRange(pages: PageText[], from: number, to: number): PageText[]
export function clampRange(from: number, to: number, pageCount: number): PageRange
export function groupPages(pages: PageText[], budget?: number): PageText[][]
export function tagPages(pages: PageText[]): string
export function planStudio(pages: PageText[]):
  | { mode: 'direct'; material: string }
  | { mode: 'digest'; groups: PageText[][] }

export function pickPassages(results: SearchResult[], budget?: number): PageText[]
export const NOT_IN_BOOK: string
export function askMessages(question: string, passages: PageText[]): ChatMessage[]
export function parseAnswer(text: string, allowedPages: number[]): { notInBook: boolean; text: string; pages: number[] }

export function digestMessages(group: PageText[]): ChatMessage[]
export function joinNotes(notes: string[], budget?: number): string
export function studioMessages(kind: StudioKind, material: string, range: PageRange): ChatMessage[]
export function parseJson(text: string): any

export interface StudyGuide {
  title: string
  overview: string
  keyConcepts: Array<{ term: string; explanation: string; page: number | null }>
  formulas: Array<{ formula: string; meaning: string; page: number | null }>
  examQuestions: Array<{ question: string; page: number | null }>
}
export interface Faq { items: Array<{ q: string; a: string; page: number | null }> }
export interface Timeline { kind: 'dates' | 'steps' | 'none'; items: Array<{ when: string; what: string; page: number | null }> }
export interface MindMapNode { label: string; page: number | null }
export interface MindMap { root: string; branches: Array<MindMapNode & { children: MindMapNode[] }> }

export type StudioResult = StudyGuide | Faq | Timeline | MindMap

export function normalizeGuide(o: unknown, range: PageRange): StudyGuide | null
export function normalizeFaq(o: unknown, range: PageRange): Faq | null
export function normalizeTimeline(o: unknown, range: PageRange): Timeline | null
export function normalizeMindMap(o: unknown, range: PageRange): MindMap | null
export function normalizeStudio(kind: StudioKind, obj: unknown, range: PageRange): StudioResult | null

export function studioKey(bookId: string, kind: StudioKind, range: PageRange): string
