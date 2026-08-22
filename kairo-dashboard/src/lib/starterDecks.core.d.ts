import type { StarterDeck } from '../data/starterDecks'
export interface StarterCardPayload { front: string; back: string; subject: string; topic: string; source: 'starter' }
export function decksForCurriculum(decks: StarterDeck[] | unknown, opts?: { board?: unknown; cls?: unknown }): StarterDeck[]
export function cardKey(subject: unknown, front: unknown): string
export function newCardsForDeck(deck: StarterDeck, existingFlashcards?: any[]): StarterCardPayload[]
export function deckAlreadyAdded(deck: StarterDeck, existingFlashcards?: any[]): boolean
export function deckRemainingCount(deck: StarterDeck, existingFlashcards?: any[]): number
