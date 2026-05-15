/**
 * theme.ts — Kairo design tokens, matched 1:1 with the Canva file.
 *
 * Palette = pure black + purple gradient + white sparkles.
 * Font    = Inter (bold) — same family used across the dashboard.
 */

export const C = {
  bg:         '#06060a',
  bgDeep:     '#000000',
  text:       '#ffffff',
  textDim:    '#a1a1aa',
  textFaint:  '#71717a',

  // Purple gradient stops
  purpleSoft: '#e9d5ff',
  purpleLite: '#c4b5fd',
  purple:     '#a78bfa',
  purpleHi:   '#7c3aed',
  purpleDeep: '#5b21b6',
  purpleDark: '#3b0764',
} as const

export const GRAD = {
  // Used for the "kairo" wordmark and all big-deal text beats
  primary:   'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 35%, #7c3aed 65%, #5b21b6 100%)',
  soft:      'linear-gradient(135deg, #e9d5ff 0%, #c4b5fd 100%)',
  // Used for the radial purple aura behind every scene
  aura:      'radial-gradient(at 50% 50%, rgba(124,58,237,0.35) 0%, transparent 55%)',
} as const

export const FONT = {
  family: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  bold:   '900',
  semi:   '700',
} as const

// Frame helpers — 30 fps everywhere.
export const FPS = 30
export const sec = (s: number) => Math.round(s * FPS)
