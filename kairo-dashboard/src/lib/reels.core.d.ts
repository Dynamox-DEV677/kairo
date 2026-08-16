export interface ReelCard {
  id: string
  kind: 'formula' | 'flashcard'
  subject: string
  topic: string | null
  front: string
  back: string
  variants: string[]
  ts: number
  due: boolean
}

export function buildDeck(
  data: { formulas?: unknown; flashcards?: unknown },
  opts?: { now?: number },
): ReelCard[]
export function deckSubjects(deck: readonly ReelCard[] | unknown): Array<{ subject: string; count: number }>
export function readPositions(raw: unknown): Record<string, string>
export function positionFor(deck: readonly ReelCard[] | unknown, positions: Record<string, string> | null | undefined, subject: string | null): number
export function withPosition(positions: Record<string, string> | null | undefined, subject: string | null, cardId: string): Record<string, string>
