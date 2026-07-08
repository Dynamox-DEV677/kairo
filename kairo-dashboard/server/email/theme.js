/**
 * Kyno email design tokens.
 *
 * One source of truth for colors, spacing, typography. Templates and
 * components import from here so the visual identity stays consistent
 * across every email.
 *
 * Email-safe constraints baked in:
 *   - Hex colors only (no hsl/oklch in older clients)
 *   - Font stack starts with -apple-system + BlinkMacSystemFont (web fonts
 *     are unreliable; let the OS pick the closest match)
 *   - Spacing values are absolute px (rem/em fail in Outlook)
 */

export const THEME = {
  // ── Brand palette ────────────────────────────────────────────────────────
  brand: {
    purple:    '#4F7CFF',   // primary
    purpleLite:'#66D9FF',
    blue:      '#2563eb',
    cyan:      '#06b6d4',
    pink:      '#ec4899',
    indigo:    '#4F7CFF',
  },

  // ── Status semantic colors ───────────────────────────────────────────────
  status: {
    success:   '#34d399',
    warning:   '#C7D2E8',
    danger:    '#f87171',
    info:      '#60a5fa',
  },

  // ── Neutrals — dark theme baseline ───────────────────────────────────────
  bg: {
    page:      '#050505',   // outermost background
    card:      '#0f0f15',   // primary card surface
    cardDeep:  '#050505',   // sunken section (footer in-card)
    surface:   '#15151f',   // raised inner elements (info chips)
    border:    'rgba(255,255,255,0.08)',   // visible 1px borders
    borderSoft:'#1a1a24',
  },

  text: {
    primary:   '#fafafa',
    secondary: '#d4d4d8',
    muted:     '#B1B5BA',
    dim:       '#9CA3AF',
    faint:     '#6B7280',
  },

  // ── Signature gradients (the AI / cinematic feel) ────────────────────────
  gradient: {
    hero:      'linear-gradient(135deg, #4F7CFF 0%, #2046C2 35%, #1e3a8a 75%, #06b6d4 100%)',
    cta:       'linear-gradient(135deg, #4F7CFF 0%, #4f46e5 50%, #2563eb 100%)',
    ctaHover:  'linear-gradient(135deg, #8b5cf6 0%, #4F7CFF 50%, #3b82f6 100%)',
    accent:    'linear-gradient(90deg, transparent 0%, #4F7CFF 35%, #06b6d4 65%, transparent 100%)',
    divider:   'linear-gradient(90deg, transparent 0%, rgba(79, 124, 255, 0.32) 50%, transparent 100%)',
    surface:   'linear-gradient(135deg, rgba(79, 124, 255, 0.06) 0%, rgba(37,99,235,0.06) 100%)',
  },

  // ── Glow / shadow tokens (box-shadow strings) ────────────────────────────
  glow: {
    soft:      '0 8px 32px rgba(79, 124, 255, 0.18), 0 2px 8px rgba(0,0,0,0.4)',
    medium:    '0 14px 48px rgba(79, 124, 255, 0.35), 0 4px 16px rgba(37,99,235,0.18)',
    strong:    '0 20px 60px rgba(79, 124, 255, 0.32), 0 6px 20px rgba(37,99,235,0.32)',
    ring:      '0 0 0 1px rgba(79, 124, 255, 0.14), 0 12px 40px rgba(79, 124, 255, 0.35)',
  },

  // ── Typography ───────────────────────────────────────────────────────────
  font: {
    family:    `-apple-system, BlinkMacSystemFont, 'Inter', 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
    mono:      `'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace`,
  },

  // ── Sizing ───────────────────────────────────────────────────────────────
  maxWidth:   600,
  radius: {
    sm:        '6px',
    md:        '10px',
    lg:        '14px',
    xl:        '18px',
    pill:      '999px',
  },
}

/** Build the Kyno public app URL — used in CTA links. */
export function appUrl() {
  const raw = process.env.ALLOWED_ORIGIN || 'https://kairo-daily-edu.vercel.app'
  // ALLOWED_ORIGIN may be a comma-separated list; take the first.
  return raw.split(',')[0].trim()
}

/** Format an ISO timestamp into a friendly "12 May 2026 · 14:32 IST" style. */
export function formatTimestamp(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  const day   = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const time  = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${day} · ${time} IST`
}
