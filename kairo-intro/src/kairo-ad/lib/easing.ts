/**
 * Cinematic easing + timing helpers.
 *
 * House rule for this film: nothing moves linearly and nothing overshoots.
 * Overshoot reads as "motion graphics template"; a long ease-out reads as
 * mass being moved by a real camera operator.
 */
import { interpolate, Easing } from 'remotion'
import { FPS } from '../constants/timeline'

/** Slow-in, long slow-out. The default for camera pushes and dollies. */
export const CINEMA = Easing.bezier(0.22, 0.9, 0.16, 1.0)
/** Even longer tail — used where a move should feel like it never quite stops. */
export const DRIFT = Easing.bezier(0.16, 0.84, 0.10, 1.0)
/** Type reveals: quick to legible, then settles. */
export const TYPE_IN = Easing.bezier(0.18, 0.86, 0.22, 1.0)
/** Exits are faster than entrances — audiences forgive a quick leave. */
export const TYPE_OUT = Easing.bezier(0.5, 0.0, 0.78, 0.4)

/** Map a frame onto 0→1 across a window given in SECONDS. */
export const progress = (
  frame: number,
  fromSec: number,
  toSec: number,
  easing = CINEMA,
) =>
  interpolate(frame, [fromSec * FPS, toSec * FPS], [0, 1], {
    easing,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

/** Ramp a value across a window in SECONDS. */
export const ramp = (
  frame: number,
  fromSec: number,
  toSec: number,
  a: number,
  b: number,
  easing = CINEMA,
) =>
  interpolate(frame, [fromSec * FPS, toSec * FPS], [a, b], {
    easing,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

/**
 * Fade in, hold, fade out — as one call. `hold` is the fully-opaque span.
 * Asymmetric by default because that's how real edits are cut.
 */
export const envelope = (
  frame: number,
  fromSec: number,
  toSec: number,
  fadeIn = 0.55,
  fadeOut = 0.42,
) => {
  const t = frame / FPS
  if (t <= fromSec || t >= toSec) return 0
  const up = Math.min(1, (t - fromSec) / fadeIn)
  const down = Math.min(1, (toSec - t) / fadeOut)
  const v = Math.min(up, down)
  return v * v * (3 - 2 * v) // smoothstep
}

/**
 * Deterministic hash → [0,1). Every particle and every micro-drift derives from
 * this, so the render is bit-identical on every machine and every re-render.
 * (Math.random() would desync between the preview and the final render.)
 */
export const hash = (i: number) => {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453123
  return v - Math.floor(v)
}

/**
 * Handheld micro-drift. Two incommensurable sine terms so the motion never
 * visibly loops. Amplitude is tiny by design — this should register as
 * "operator breathing", not as camera shake.
 */
export const microDrift = (frame: number, seed = 0, amp = 1) => {
  const t = frame / FPS
  return {
    x: (Math.sin(t * 0.31 + seed) * 0.62 + Math.sin(t * 0.11 + seed * 2.3) * 0.38) * amp,
    y: (Math.cos(t * 0.27 + seed * 1.7) * 0.58 + Math.sin(t * 0.09 + seed) * 0.42) * amp,
  }
}

/** Lerp along a smoothstepped t — for camera targets that must not snap. */
export const smoothLerp = (a: number, b: number, t: number) => {
  const k = Math.max(0, Math.min(1, t))
  return a + (b - a) * (k * k * (3 - 2 * k))
}
