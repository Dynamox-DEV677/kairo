export type MarkColor = 'yellow' | 'green' | 'pink'
export interface MarkRect { x: number; y: number; w: number; h: number }
export interface ClientRectLike { left: number; top: number; right?: number; bottom?: number; width: number; height: number }

export const MARK_COLORS: MarkColor[]
export const MARK_FILL: Record<MarkColor, string>
export const MARK_LABEL: Record<MarkColor, string>
export const MARK_SWATCH: Record<MarkColor, string>
export const MAX_RECTS: number

export function selectionRects(rects: ArrayLike<ClientRectLike> | ClientRectLike[], box: { left: number; top: number; width: number; height: number }, opts?: { max?: number }): MarkRect[]
export function validRects(rects: unknown): MarkRect[]
export function marksOnPage<T extends { action: string; page?: number; color?: string; rects?: MarkRect[] }>(highlights: T[], page: number): T[]
export function bookMarks<T extends { action: string; page?: number; color?: string; rects?: MarkRect[] }>(highlights: T[]): T[]
