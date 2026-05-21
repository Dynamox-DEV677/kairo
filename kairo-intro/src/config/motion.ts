/**
 * Motion defaults — particle counts, glow intensity, camera curve
 * shape, stagger timing. These are the "art direction" dials.
 *
 * If the intro feels too soft, raise `GLOW_CEILING`. If it feels too
 * busy, lower `PARTICLE_COUNT`. If text reveals feel sluggish, drop
 * `LETTER_STAGGER_MS`.
 */
export const MOTION = {
  // ── Particle field ──────────────────────────────────────────────
  PARTICLE_COUNT:       240,   // visible at any time. 180 = sparse, 320 = dense
  PARTICLE_MIN_SIZE:    0.6,   // px — far particles (high z)
  PARTICLE_MAX_SIZE:    2.8,   // px — near particles (low z)
  PARTICLE_DEPTH_RANGE: [-800, -200] as const,  // z bounds for projection
  PARTICLE_SEED:        20260521, // change for a different deterministic field

  // ── Glow ────────────────────────────────────────────────────────
  // Hard ceiling — refinement pass keeps every blue glow at or under
  // this alpha. The intro respects the same rule so the brand reads
  // consistently between the launch video and the app.
  GLOW_CEILING:         0.32,

  // ── Camera ──────────────────────────────────────────────────────
  // The intro uses a virtual camera (see lib/camera.ts). Z values
  // are arbitrary units — larger = farther.
  CAMERA_Z_DAWN_IN:     -900,
  CAMERA_Z_DAWN_OUT:    -700,
  CAMERA_Z_LATTICE:     -600,
  CAMERA_Z_ASSEMBLY:    -500,
  CAMERA_Z_REVEAL:      -480,
  CAMERA_Z_BREATHE:     -480,
  CAMERA_Z_FINAL:       -380,

  // Scene 03's orbit — degrees the camera rotates over the scene
  ORBIT_DEGREES:        18,

  // ── Lines ───────────────────────────────────────────────────────
  LINE_DRAW_DURATION_F: 240,   // scene 02 line draw, in frames (4s @ 60)
  LINE_STROKE_WIDTH:    1.2,
  LATTICE_LINE_COUNT:   12,    // scene 03 orbital path count

  // ── Text reveal ─────────────────────────────────────────────────
  LETTER_STAGGER_MS:    70,    // ms between letter reveals in KAIRO
  LETTER_DURATION_MS:   620,   // total per-letter sweep
  TAGLINE_LETTER_MS:    30,    // tagline letters are smaller, faster

  // ── Logo ────────────────────────────────────────────────────────
  LOGO_SIZE_PX:         320,   // K mark side length
  LOGO_LOCK_PULSE_AMP:  0.04,  // pulse amplitude at lock — 4% scale
  BREATHE_AMP:          0.018, // ongoing breathing — 1.8% scale

  // ── Final zoom ──────────────────────────────────────────────────
  FINAL_ZOOM_FACTOR:    1.14,  // ending scale of the K + caption block
} as const
