/**
 * Brand palette for the intro.
 *
 * Every scene + primitive reads its colours from this file. Don't
 * inline hex codes inside scenes — that's how a recolour turns into
 * 47 PR comments. Edit here, the whole intro reskins.
 *
 * Alphas use the same `rgba()` strings the dashboard codebase uses,
 * so colour values can be lifted directly into Kairo's web UI without
 * a translation pass.
 */
export const COLORS = {
  // Canvas — true near-black. Avoid pure #000; it crushes depth.
  bg:           '#050505',
  bgPanel:      '#0E1117',

  // Brand
  primary:      '#4F7CFF',  // electric blue
  secondary:    '#66D9FF',  // cyan
  highlight:    '#A5B4FC',  // soft indigo — use sparingly, < 12% alpha
  ultramarine:  '#2A4FE0',  // deeper royal blue — used in halos

  // Type
  text:         '#FFFFFF',
  textMuted:    'rgba(255, 255, 255, 0.62)',
  textGhost:    'rgba(255, 255, 255, 0.32)',

  // Translucents — pre-baked so they can drop into SVG fills cleanly
  primaryGlow12:  'rgba(79, 124, 255, 0.12)',
  primaryGlow24:  'rgba(79, 124, 255, 0.24)',
  primaryGlow32:  'rgba(79, 124, 255, 0.32)',   // hard ceiling per refinement spec
  secondaryGlow12:'rgba(102, 217, 255, 0.12)',
  secondaryGlow24:'rgba(102, 217, 255, 0.24)',

  // Hairlines
  hairline:     'rgba(255, 255, 255, 0.06)',
  hairlineWarm: 'rgba(165, 180, 252, 0.10)',
} as const

export type Color = keyof typeof COLORS
