/**
 * Tiny 1D value-noise — enough for the particle drift in scene 01.
 *
 * Real simplex/perlin is overkill for what we need (smooth-ish
 * pseudo-random offsets in [-1, 1] over time). This linear-interpolated
 * lattice gives organic motion without an extra dependency.
 *
 *   noise1(t, seed)  →  ∈ [-1, 1], smooth as t varies
 *
 * Use:
 *   const drift = noise1(frame / 60, particle.id) * 4   // ±4px
 */
import { mulberry32 } from './rng'

const CACHE = new Map<number, number[]>()
const TABLE_SIZE = 1024

function table(seed: number): number[] {
  let t = CACHE.get(seed)
  if (t) return t
  const r = mulberry32(seed)
  t = Array.from({ length: TABLE_SIZE }, () => r() * 2 - 1)
  CACHE.set(seed, t)
  return t
}

const smooth = (t: number) => t * t * (3 - 2 * t)

export function noise1(x: number, seed: number = 0): number {
  const tbl = table(seed)
  const i   = Math.floor(x)
  const f   = x - i
  const a   = tbl[((i)     % TABLE_SIZE + TABLE_SIZE) % TABLE_SIZE]
  const b   = tbl[((i + 1) % TABLE_SIZE + TABLE_SIZE) % TABLE_SIZE]
  return a + (b - a) * smooth(f)
}
