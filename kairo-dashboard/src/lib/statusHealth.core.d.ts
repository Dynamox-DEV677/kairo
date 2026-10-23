export type Health = 'ok' | 'degraded' | 'down'
export interface ServiceRow { id: string; label: string; body: string; health: Health }
export function parsePool(pool: unknown): { live: number; total: number } | null
export function readHealth(payload: unknown, roundTripMs: number): {
  services: ServiceRow[]
  overall: Health
  stats: { calls: number; failRate: number | null; p95ms: number | null }
  checkedAt: number
}
