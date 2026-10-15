import type { SearchIndex } from './search.core'

export const PAGE_BUDGET: number
export const HISTORY_BUDGET: number
export type ExplainMode = 'explain' | 'summarise'
export const MODES: Record<ExplainMode, { label: string; first: string }>
export const QUICK: Array<{ id: string; label: string; ask: string }>

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

export function pageText(index: SearchIndex | null | undefined, page: number, budget?: number): string
export function looksLikeQuestion(text: string): boolean
export function systemPrompt(o: { title: string; page: number; quote: string; context?: string }): string
export function buildMessages(o: { title: string; page: number; quote: string; context?: string; history: ChatTurn[]; ask: string }): Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
export function solveSeed(quote: string): string
