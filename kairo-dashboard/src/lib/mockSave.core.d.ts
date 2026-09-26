export const MOCK_KEY: string
export const MOCK_VERSION: number
export const ABANDON_AFTER_MS: number

export interface MockSnapshot<Q = unknown> {
  v: number
  subject: string
  questions: Q[]
  answers: (number | null)[]
  flags: number[]
  i: number
  startedAt: number
  totalMs: number
  savedAt: number
}

export interface RestoredMock<Q = unknown> {
  subject: string
  questions: Q[]
  answers: (number | null)[]
  flags: Set<number>
  i: number
  startedAt: number
  totalMs: number
  msLeft: number
  expired: boolean
}

export function snapshotMock<Q>(
  state: { subject: string; questions: Q[]; answers: (number | null)[]; flags: Iterable<number>; i: number; startedAt: number; totalMs: number },
  now?: number,
): MockSnapshot<Q>
export function readMock<Q = unknown>(raw: unknown, subject: string | null, now?: number): RestoredMock<Q> | null
export function peekMock(raw: unknown, now?: number): { subject: string; msLeft: number; expired: boolean; answered: number; total: number } | null
