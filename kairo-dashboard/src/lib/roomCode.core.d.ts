export const CODE_LENGTH: number
export const CODE_TTL_MS: number
export function makeRoomCode(rng?: () => number): string
export function normalizeCode(input: unknown): string
export function isValidCodeShape(code: unknown): boolean
export function codeExpired(openedAt: unknown, now?: number): boolean
export function channelForCode(code: string): string
export function minutesLeft(openedAt: unknown, now?: number): number
