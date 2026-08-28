export type AiErrorCode =
  | 'AUTH_EXPIRED' | 'RATE_LIMITED' | 'TIMEOUT' | 'OFFLINE'
  | 'SERVER_FAULT' | 'NOT_CONFIGURED' | 'BAD_RESPONSE' | 'UNKNOWN'

export declare class AiError extends Error {
  readonly code: AiErrorCode
  readonly retryable: boolean
  readonly retryAfter?: number
  readonly cause?: unknown
  constructor(code: AiErrorCode, cause?: unknown)
  static from(e: unknown): AiError
}

export function studentMessage(e: unknown): string
