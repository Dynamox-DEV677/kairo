export function pickBlank(sentence: string): string | null
export function buildClozeCards(text: unknown, opts?: { max?: number }): Array<{ front: string; back: string }>
export function clauses(sentence: string): string[]
export function clozeForTerm(term: string, context: string, opts?: { max?: number }): Array<{ front: string; back: string }>
export function dropLeadingHeading(sentence: string): string
