export const USERNAME_RE: RegExp
export const ADJECTIVES: string[]
export const NOUNS: string[]
export const TILE_HUES: string[]

export function normaliseUsername(raw: unknown): string
export function validateUsername(raw: unknown): { ok: true; username: string } | { ok: false; reason: string }
export function generateUsername(rand?: () => number): string
export function fallbackHandle(userId: unknown, salt?: number): string
export function tileHue(username: unknown): string
export function tileLetter(username: unknown): string
