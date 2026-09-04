export interface SpaceMeta { id: string; label: string; sub: string }
export const SPACE_META: SpaceMeta[]
export const SPACE_IDS: ReadonlySet<string>
export const SPACE_ALIASES: Readonly<Record<string, string>>
export const SPACE_VIEW_EVENT: string

/** An alias may name a screen inside a space, as "space/view". */
export function resolveRoute(id: string): { space: string; view: string | null }
export function resolveSpace(id: string): string
