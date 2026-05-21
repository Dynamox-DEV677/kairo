/**
 * KairoMark — the brand K, rendered as three SVG paths so each can
 * draw itself independently during scene 04's assembly.
 *
 * Geometry: a clean geometric K inside a 320×320 viewbox. Three paths:
 *   1. spine     — vertical bar, left side
 *   2. upper arm — diagonal from spine top-mid to top-right
 *   3. lower arm — diagonal from spine bot-mid to bot-right
 *
 * Fill is a `<radialGradient>` from electric-blue centre to deep-blue
 * edge — kicks in at scene 05 when the K "locks".
 */
import { COLORS } from '../config/colors'

interface Props {
  /** 0-1 — overall draw progress. 0 = invisible, 1 = fully assembled. */
  drawProgress: number
  /** 0-1 — gradient fill opacity (kicks in once the mark is mostly drawn). */
  fillProgress: number
  /** Multiplier applied to all opacities (scene-level fade). */
  opacity?: number
  /** Pixel size — mark side length. */
  size?: number
  /** Whether the mark should pulse subtly (scene 05's lock). */
  pulse?: number
}

const VIEW = 320

// Path definitions for the K — tuned for visual balance, not for
// matching the dashboard `kairo_logo.png` exactly. If you need
// pixel-perfect match, export the dashboard logo to SVG and paste
// the `d=` strings here.
const SPINE_D     = `M 70 28 L 70 292`
const UPPER_ARM_D = `M 70 160 L 240 28`
const LOWER_ARM_D = `M 70 160 L 240 292`

// Approximate path lengths (computed once, used for dash maths).
// If you change the geometry above, recompute these via
// `document.querySelector('path').getTotalLength()` in dev tools.
const LEN_SPINE     = 264
const LEN_UPPER     = 215
const LEN_LOWER     = 215

export default function KairoMark({
  drawProgress,
  fillProgress,
  opacity = 1,
  size    = 320,
  pulse   = 0,
}: Props) {
  // Stagger the three strokes so the K assembles spine-first, then
  // upper, then lower — feels intentional rather than uniform.
  const tSpine = stage(drawProgress, 0,    0.45)
  const tUpper = stage(drawProgress, 0.30, 0.75)
  const tLower = stage(drawProgress, 0.55, 1.00)

  const scale = 1 + pulse

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      style={{
        display: 'block',
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: '50% 50%',
        // Drop-shadow ceiling per refinement spec
        filter: fillProgress > 0
          ? `drop-shadow(0 0 ${24 * fillProgress}px ${COLORS.primaryGlow32})`
          : undefined,
      }}
    >
      <defs>
        {/* Centre-to-edge brand gradient — for the fill once the
            mark "locks". */}
        <radialGradient id="kairo-grad" cx="50%" cy="50%" r="62%">
          <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="40%"  stopColor={COLORS.secondary} stopOpacity="0.85" />
          <stop offset="80%"  stopColor={COLORS.primary}   stopOpacity="0.85" />
          <stop offset="100%" stopColor={COLORS.ultramarine} stopOpacity="0.92" />
        </radialGradient>

        {/* Stroke gradient — slight white-hot tip so the draw-in
            has a leading edge, like a pen nib. */}
        <linearGradient id="kairo-stroke" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"  stopColor={COLORS.primary} />
          <stop offset="60%" stopColor={COLORS.secondary} />
          <stop offset="100%" stopColor="#FFFFFF" />
        </linearGradient>
      </defs>

      {/* Stroked paths (the assembly look). Fade their stroke as the
          fill takes over so we don't double-bright the silhouette. */}
      <g
        fill="none"
        stroke="url(#kairo-stroke)"
        strokeWidth={6}
        strokeLinecap="round"
        opacity={1 - Math.min(1, fillProgress * 1.2)}
      >
        <path
          d={SPINE_D}
          strokeDasharray={`${LEN_SPINE * tSpine} ${LEN_SPINE}`}
        />
        <path
          d={UPPER_ARM_D}
          strokeDasharray={`${LEN_UPPER * tUpper} ${LEN_UPPER}`}
        />
        <path
          d={LOWER_ARM_D}
          strokeDasharray={`${LEN_LOWER * tLower} ${LEN_LOWER}`}
        />
      </g>

      {/* Filled mark — same three paths thickened to form a body.
          Visible once `fillProgress` ramps up. */}
      <g
        fill="url(#kairo-grad)"
        opacity={fillProgress}
        // Add small stroke for clean edges at any scale
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={0.6}
      >
        {/* Spine as a rect */}
        <rect x="52" y="20" width="36" height="280" rx="4" />
        {/* Upper arm — a quadrilateral */}
        <polygon points="70,140 240,12 240,52 88,180" />
        {/* Lower arm */}
        <polygon points="70,180 240,308 240,268 88,140" />
      </g>
    </svg>
  )
}

/** Map a [0,1] progress through a sub-window, clamped. */
function stage(p: number, from: number, to: number) {
  if (p <= from) return 0
  if (p >= to)   return 1
  return (p - from) / (to - from)
}
