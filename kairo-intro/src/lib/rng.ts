/**
 * Deterministic pseudo-random number generator.
 *
 * Mulberry32 — small, fast, good enough distribution for particle
 * placement and stagger jitter. The intro is fully reproducible:
 * same seed → same particle field, same frame-for-frame.
 *
 * Why not `Math.random()`? Renders need to be byte-stable across
 * machines and re-runs (especially for review cycles where "is this
 * frame different on purpose?" matters).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Helper — pull `n` floats in [0,1) from a seeded generator. */
export const seededArray = (seed: number, n: number) => {
  const r = mulberry32(seed)
  return Array.from({ length: n }, () => r())
}

/** Map a [0,1) random to a [min, max) range. */
export const rangeRand = (r: () => number, min: number, max: number) =>
  min + r() * (max - min)
