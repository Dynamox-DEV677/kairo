/**
 * GlowLine — a single SVG line that *draws itself in* via a
 * stroke-dasharray pull, with a soft halo behind it.
 *
 * Used by scene 02 for the first line (intelligence waking up) and by
 * scene 03 for each orbital path stroke. The drawn extent is driven
 * by a 0-1 `progress` prop so the parent scene controls timing.
 */
import { COLORS } from '../config/colors'

interface Props {
  /** Endpoints in viewport space. */
  x1: number
  y1: number
  x2: number
  y2: number
  /** 0-1 — how much of the line is drawn. */
  progress: number
  /** Stroke width — overrides the motion default. */
  width?: number
  /** Tint — primary or secondary. */
  hue?: 'primary' | 'secondary'
  /** Optional opacity multiplier (for scene-level fades). */
  opacity?: number
}

export default function GlowLine({
  x1, y1, x2, y2,
  progress,
  width   = 1.2,
  hue     = 'primary',
  opacity = 1,
}: Props) {
  const length = Math.hypot(x2 - x1, y2 - y1)
  const drawn  = length * progress
  const stroke = hue === 'primary' ? COLORS.primary : COLORS.secondary
  // Halo alpha clamps at the refinement ceiling
  const haloAlpha = Math.min(0.32, 0.22 + progress * 0.10) * opacity

  return (
    <g opacity={opacity}>
      {/* Soft halo underneath — broader stroke, blurred */}
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={stroke}
        strokeWidth={width * 6}
        strokeLinecap="round"
        opacity={haloAlpha}
        style={{ filter: 'blur(8px)' }}
        strokeDasharray={`${drawn} ${length}`}
      />
      {/* Crisp foreground stroke */}
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        opacity={opacity}
        strokeDasharray={`${drawn} ${length}`}
      />
    </g>
  )
}
