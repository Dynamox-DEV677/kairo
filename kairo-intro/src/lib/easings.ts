/**
 * Bezier easing registry.
 *
 * Every easing in the intro pulls from here — no one-off inline
 * curves. The premium feel of the whole piece comes from the small
 * number of carefully-tuned curves being applied consistently.
 *
 * Each export is a function `(t: number) => number` that maps linear
 * t ∈ [0,1] to eased t ∈ [0,1]. Drop into `interpolate(frame, [0, N],
 * [0, 1], { easing: APPLE })` directly.
 */
import { Easing } from 'remotion'

// Apple Material — the workhorse. Slight overshoot-free in/out.
export const APPLE     = Easing.bezier(0.4, 0, 0.2, 1)

// Linear-app reveal — snappy, slightly overshooting decel.
export const LINEAR_R  = Easing.bezier(0.16, 1, 0.3, 1)

// Cinematic — slow-in, slow-out. For scene-level fades.
export const CINEMATIC = Easing.bezier(0.65, 0.05, 0.36, 1)

// Breathing — sinusoidal-ish, never feels mechanical.
export const BREATHE   = Easing.bezier(0.45, 0, 0.55, 1)

// Ink — for stroke draw-ins. Slow start, hard finish.
export const INK       = Easing.bezier(0.83, 0, 0.17, 1)

// Pulse — quick pop, slow decay. Logo lock + final pulse use this.
export const PULSE     = Easing.bezier(0.34, 1.56, 0.64, 1)

// Standard exit. Subtle.
export const EXIT      = Easing.bezier(0.7, 0, 0.84, 0)

/**
 * Convenience: smooth-step a 0-1 progress through a sub-window of the
 * scene. Use to keep sub-animations clean in scene code:
 *
 *   const t = sub(progress, 0.1, 0.4)  // active during 10%-40% of scene
 *   opacity = APPLE(t)
 */
export const sub = (p: number, from: number, to: number) => {
  if (p <= from) return 0
  if (p >= to)   return 1
  return (p - from) / (to - from)
}
