export interface SpaceMeta { id: string; label: string; sub: string }
export const SPACE_META: SpaceMeta[]
export const SPACE_IDS: ReadonlySet<string>
export const SPACE_ALIASES: Readonly<Record<string, string>>
export const SPACE_VIEW_EVENT: string
export const SPACE_VIEW_CHANGED: string
export const SPACE_HOME_VIEW: Readonly<Record<string, string>>
export function publishSpaceView(space: string, view: string | null | undefined): void

/** An alias may name a screen inside a space, as "space/view". */
export function resolveRoute(id: string, role?: string): { space: string; view: string | null }
export function resolveSpace(id: string, role?: string): string
