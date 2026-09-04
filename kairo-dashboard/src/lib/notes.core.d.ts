export function provenanceLabel(source: string | null | undefined, kind?: string): string
export function originLine(entry: { createdAt?: number; source?: string | null; kind?: string } | null | undefined): string
export function returnLabel(dueAt: number | null | undefined, now?: number): string | null

export type CardIndex = Record<string, string[]>
export function attachCards(index: CardIndex | null | undefined, noteId: string, cardIds: string[]): CardIndex

export interface NoteStats { cards: number; nextDue: number | null; nextLabel: string | null; right: number; total: number }
export function noteStats(noteId: string, index?: CardIndex, flashcards?: unknown[], events?: unknown[], now?: number): NoteStats

export function cardsForNote(title: string, content: string, opts?: { max?: number }): Array<{ front: string; back: string }>

export interface SearchRow { kind: 'note' | 'formula' | 'doubt'; id: string; title: string; sub: string; ts: number; score: number }
export function unifiedSearch(query: string, sources?: { notes?: unknown[]; formulas?: unknown[]; doubts?: unknown[] }, opts?: { max?: number }): SearchRow[]

export function dueSummary(flashcards?: unknown[], index?: CardIndex, now?: number): { count: number; notes: number; headline: string; sub: string; ids: string[] } | null

export const TRIGGERS: string[]
export function boldTriggers(text: string): Array<{ text: string; bold: boolean }>
export function splitBody(content: string): Array<{ kind: 'prose' | 'eq' | 'heading'; text: string }>

export interface SheetFormula { id: string; chapter: string; chapterName: string; name: string; expr: string; when: string; signatures: string[] }
export function formulaFlags(formulas?: SheetFormula[], records?: Array<{ signature?: string | null; marksLost?: number | null; chapter?: string | null }>): Map<string, { signature: string; marks: number; count: number; line: string }>
export function chapterChips(formulas?: SheetFormula[]): Array<{ name: string; count: number }>

export interface Clip { id: string; kind: string; subject: string; topic: string | null; front: string; back: string; due: boolean; ts: number; why: string; type: string; weakRank: number }
export function pickClips(deck?: unknown[], weak?: Array<{ topic: string; marksLost?: number; dominant?: string; recent3w?: number } | string>, opts?: { max?: number; patterns?: unknown[] }): { items: Clip[]; general: boolean; totalMinutes: number }

export function wordJudgement(text: string, marks?: number): { words: number; target: number; verdict: string; line: string }
export interface Requirement { point: string; marks: number; keywords: string[] }
export function schemeCheck(text: string, requirements?: Requirement[]): { rows: Array<Requirement & { present: boolean }>; have: number; total: number; line: string }
