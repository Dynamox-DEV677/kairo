export interface SpaceMeta { id: string; label: string; sub: string }
export const SPACE_META: SpaceMeta[]
export const SPACE_IDS: ReadonlySet<string>
export const SPACE_ALIASES: Readonly<Record<string, string>>
export function resolveSpace(id: string): string
