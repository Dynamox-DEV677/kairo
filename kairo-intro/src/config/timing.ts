/**
 * Single source of truth for every frame anchor in the intro.
 *
 * Change one value here and the whole timeline re-aligns — the scenes
 * are consumers, never authors, of their own frame ranges. This lets
 * you re-pace the whole piece (e.g. tighten the dawn to 4 seconds) by
 * editing one line.
 *
 * Frame ranges are inclusive-start, exclusive-end (the standard
 * Remotion convention used by `<Sequence from={} durationInFrames={}/>`).
 */
export const FPS         = 60          // cinematic; use 30 if your delivery target is web-first
export const DURATION_S  = 48          // overall length, seconds
export const DURATION_F  = FPS * DURATION_S  // 2880 frames

/** Width / height in pixels — change here only, every camera math reads it. */
export const WIDTH  = 1920
export const HEIGHT = 1080

/**
 * Scene boundaries. Each scene gets:
 *   { start: <frame inclusive>, end: <frame exclusive>, length: derived }
 *
 * A small cross-fade overlap (`OVERLAP_F`) between scenes prevents
 * hard cuts — every scene fades its outgoing layer over the first
 * frames of the next.
 */
export const OVERLAP_F = Math.round(FPS * 0.5) // 30 frames = 0.5s soft handoff

const seconds = (n: number) => Math.round(n * FPS)

export const SCENES = {
  dawn:      { start: seconds(0),  end: seconds(6)  },  // 0-6s
  firstLine: { start: seconds(6),  end: seconds(14) },  // 6-14s
  lattice:   { start: seconds(14), end: seconds(22) },  // 14-22s
  assembly:  { start: seconds(22), end: seconds(30) },  // 22-30s
  reveal:    { start: seconds(30), end: seconds(38) },  // 30-38s
  breathe:   { start: seconds(38), end: seconds(44) },  // 38-44s
  zoom:      { start: seconds(44), end: seconds(48) },  // 44-48s
} as const

export type SceneKey = keyof typeof SCENES

/** Length helper — derived from start/end so it can't drift. */
export const sceneLength = (s: SceneKey) =>
  SCENES[s].end - SCENES[s].start

/** Returns the [0, 1] progress through scene `s` for the current frame. */
export const sceneProgress = (s: SceneKey, frame: number) => {
  const { start, end } = SCENES[s]
  if (frame <= start) return 0
  if (frame >= end)   return 1
  return (frame - start) / (end - start)
}

/**
 * Micro-anchors inside scenes — sub-events the scene code reads to
 * trigger specific moments. Keeping them here means a re-time of one
 * sub-event doesn't require digging into a scene file.
 */
export const BEATS = {
  // Scene 02 — when the very first line begins to draw
  firstLineDraw:        seconds(7.5),
  // Scene 03 — first orbital line spawn
  firstOrbital:         seconds(15),
  // Scene 04 — when lattice begins to morph into the K
  morphStart:           seconds(24),
  // Scene 05 — logo locks (full opacity, gradient kicks in)
  logoLock:             seconds(31),
  // Scene 05 — KAIRO wordmark first frame
  textKairoIn:          seconds(33),
  // Scene 05 — tagline first frame
  textTaglineIn:        seconds(35.5),
  // Scene 06 — first orbital particle
  orbitalParticleIn:    seconds(39),
  // Scene 07 — final pulse kicks
  finalPulse:           seconds(46),
} as const
