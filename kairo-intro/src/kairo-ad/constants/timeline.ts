/**
 * Shot timing for the KAIRO launch film.
 *
 * One source of truth: every scene, camera move and type reveal reads its
 * boundaries from here, so re-pacing the film is a single edit rather than a
 * hunt through components.
 *
 * 60fps is a deliberate choice — the camera moves are slow and continuous, and
 * at 30fps the micro-drift strobes on gradients.
 */

export const FPS = 60
export const WIDTH = 1080
export const HEIGHT = 1920

/** seconds → frames */
export const s = (sec: number) => Math.round(sec * FPS)

/**
 * Scene boundaries in SECONDS. Deliberately unequal: the assemble and the
 * signoff get room to breathe, the interior pass stays short so it never
 * outstays its welcome.
 */
export const SCENE = {
  /** 1 · pure black → a single light is born → first dust */
  awaken:   { from: 0.0,  to: 5.4 },
  /** 2 · dust streams in and packs into the mark; energy → titanium */
  assemble: { from: 5.4,  to: 12.6 },
  /** 3 · the cap seats, a hard specular sweep rakes the metal */
  seat:     { from: 12.6, to: 17.8 },
  /** 4 · camera passes THROUGH the mark into a knowledge lattice */
  interior: { from: 17.8, to: 22.2 },
  /**
   * 5 · Learn · Create · Think · Imagine · Build
   * 7.2s for five verbs = 1.44s each. Anything tighter and the reveal/fade
   * envelope can't complete inside a single beat — the words never reach full
   * opacity and the scene reads as empty.
   */
  words:    { from: 22.2, to: 29.4 },
  /** 6 · the mark alone, camera retreats, endplate, fade */
  signoff:  { from: 29.4, to: 33.6 },
} as const

export const DURATION_S = SCENE.signoff.to
export const DURATION_F = s(DURATION_S)

/** The five verbs. Each gets its own beat; none of them share the frame. */
export const WORDS = ['Learn', 'Create', 'Think', 'Imagine', 'Build'] as const

/** Per-word window inside SCENE.words, with a hold before the next dissolves in. */
export const WORD_BEATS = WORDS.map((word, i) => {
  const span = (SCENE.words.to - SCENE.words.from) / WORDS.length
  const from = SCENE.words.from + i * span
  return { word, from, to: from + span * 0.92 }
})

/**
 * Audio cue sheet (seconds). No music is bundled — these are the marks a
 * composer/editor drops sound onto. Documented so the edit and the score
 * can be built independently and still land together.
 */
export const AUDIO_CUES = [
  { at: 0.0,  cue: 'sub-bass swell in, -30dB, 4s ramp' },
  { at: 5.4,  cue: 'granular dust rise as particles begin streaming' },
  { at: 12.2, cue: 'deep cinematic boom — the mark solidifies' },
  { at: 13.1, cue: 'tiny metallic impact (cap seats)' },
  { at: 14.0, cue: 'specular sweep whoosh, low-passed' },
  { at: 17.8, cue: 'air-pressure drop as camera enters the mark' },
  { at: 23.6, cue: 'soft synth pad enters under the verbs' },
  { at: 29.4, cue: 'pad resolves; leave the last 2s nearly silent' },
] as const
