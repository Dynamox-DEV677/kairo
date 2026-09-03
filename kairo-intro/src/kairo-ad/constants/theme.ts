/**
 * KAIRO INDUSTRIES — launch film design tokens.
 *
 * Monochrome by design: pure black ground, white light, brushed titanium.
 * The only chroma allowed is a cold blue bounce in the metal's reflections —
 * it reads as physically-motivated light, not as "brand colour".
 */

export const COLOR = {
  /** True black. The film opens and closes here. */
  void: '#000000',
  /** Key light / energy state of the mark before it becomes metal. */
  light: '#FFFFFF',
  /** Brushed titanium — warm-neutral grey, never silver-blue. */
  titanium: '#B8B8BC',
  titaniumDark: '#6E7075',
  titaniumLift: '#E8E9ED',
  /** Cold rim bounce. Subtle: this should be felt, not seen. */
  coldBounce: '#8FA8C8',
  /** Warm fill on the opposite side so the metal doesn't read as plastic. */
  warmFill: '#FFF2E4',
} as const

/**
 * Physically-plausible titanium. Roughness is deliberately non-zero — a
 * mirror-finish logo looks like chrome and cheapens instantly.
 */
export const MATERIAL = {
  metalness: 1.0,
  roughness: 0.28,
  /** Thin clearcoat sells "engineered part" rather than "raw metal". */
  clearcoat: 0.42,
  clearcoatRoughness: 0.16,
  /** Anisotropy = the directional streak of a brushed finish. */
  anisotropy: 0.72,
  anisotropyRotation: Math.PI * 0.25,
  envMapIntensity: 1.15,
} as const

/** Extrusion profile for the logo ribbons. Bevel is small but never zero. */
export const EXTRUDE = {
  depth: 0.115,
  bevelEnabled: true,
  bevelThickness: 0.016,
  bevelSize: 0.014,
  bevelOffset: 0,
  bevelSegments: 6,
  curveSegments: 14,
} as const

export const TYPE = {
  /**
   * Premium grotesque stack. SF Pro / Neue Haas are licence-locked so they can
   * only resolve locally; the fallbacks are chosen so the METRICS stay close
   * (tall x-height, tight apertures) and the tracking below still reads right.
   */
  stack:
    "'SF Pro Display', 'Neue Haas Grotesk Display', 'Helvetica Now Display', " +
    "'Geist', 'Satoshi', 'Inter', 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif",
  /** Display copy runs light and very wide — the Apple keynote signature. */
  displayWeight: 200,
  displayTracking: 0.42,
  /** Small print runs a touch heavier so it survives compression. */
  captionWeight: 400,
  captionTracking: 0.30,
} as const
