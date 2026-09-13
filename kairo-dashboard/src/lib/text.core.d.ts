export function titleCase(input: string | null | undefined): string
/** Returns the count AND the noun: plural(1,'mark') === '1 mark'. */
export function plural(n: number, singular: string, pluralForm?: string): string
/** Returns the noun only, for when the number is already rendered separately. */
export function pluralWord(n: number, singular: string, pluralForm?: string): string
