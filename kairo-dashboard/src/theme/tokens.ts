// Kyno gamified dark theme — the single source of truth for the palette.
// Mirrors the CSS variables declared in src/index.css (:root).
//   • Inline-style components:  import { KYNO } from '../theme/tokens'
//   • CSS / className:          var(--kyno-violet), var(--kyno-cyan), …
// Keep the two in sync when a value changes.

export const KYNO = {
  // Surfaces
  bg:         '#0A0D16',   // deep navy-black base (already app-wide)
  surface:    '#141A2B',   // elevated cards / surfaces
  surface2:   '#1E2740',   // higher elevation / hover / nested

  // Accents
  violet:     '#7C5CFF',   // PRIMARY — buttons, active nav icon, level ring
  violetDeep: '#5B3FD0',   // pressed state + the darker underside of chunky buttons
  cyan:       '#22D3EE',   // SECONDARY / celebration — XP fills, correct answers, completions
  gold:       '#FFB020',   // streak / reward
  error:      '#FF5C5C',   // wrong answer

  // Text
  text:       '#FAFAFA',
  textMuted:  '#9AA3B2',

  // Lines
  border:     'rgba(255,255,255,0.08)',

  // Hero-only gradients (level ring, primary CTA) — never on every element.
  heroGradient:     'linear-gradient(135deg, #7C5CFF 0%, #22D3EE 100%)',
  heroGradientSoft: 'linear-gradient(135deg, rgba(124,92,255,0.18) 0%, rgba(34,211,238,0.14) 100%)',

  // Rounded, friendly display font for headings + big numbers.
  display:    "'Nunito', 'Baloo 2', system-ui, sans-serif",
} as const

// Translucent accent tints (for soft fills / glows) built from the accents above.
export const KYNO_TINT = {
  violet08: 'rgba(124,92,255,0.08)',
  violet16: 'rgba(124,92,255,0.16)',
  violet28: 'rgba(124,92,255,0.28)',
  cyan10:   'rgba(34,211,238,0.10)',
  cyan18:   'rgba(34,211,238,0.18)',
  gold14:   'rgba(255,176,32,0.14)',
  error12:  'rgba(255,92,92,0.12)',
} as const

export type KynoColor = keyof typeof KYNO
