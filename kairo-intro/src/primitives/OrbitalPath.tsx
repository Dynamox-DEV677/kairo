/**
 * OrbitalPath — an elliptical orbit that draws itself, with optional
 * particle trail moving along it. Scene 03 places several of these
 * around the forming centre.
 *
 * The ellipse is positioned + rotated so it looks like a tilted
 * orbit in 3D (we don't actually do 3D maths for the ring — a 2D
 * ellipse with the right aspect ratio reads as a tilted disc).
 */
import { COLORS } from '../config/colors'
import { WIDTH, HEIGHT } from '../config/timing'

interface Props {
  /** Radius along the major axis, in px. */
  radius:     number
  /** Tilt — short-axis / long-axis ratio (0.2 = quite tilted, 1.0 = flat circle). */
  tilt:       number
  /** Degrees the ellipse is rotated in the screen plane. */
  rotate:     number
  /** 0-1 — how much of the orbit is drawn. */
  progress:   number
  /** 0-1 — where the trailing particle currently sits along the orbit. */
  trailAngle: number
  hue?:       'primary' | 'secondary'
  opacity?:   number
}

export default function OrbitalPath({
  radius, tilt, rotate,
  progress, trailAngle,
  hue     = 'primary',
  opacity = 1,
}: Props) {
  const cx = WIDTH  / 2
  const cy = HEIGHT / 2
  const rx = radius
  const ry = radius * tilt
  const stroke = hue === 'primary' ? COLORS.primary : COLORS.secondary

  // Perimeter approximation for stroke-dasharray
  const perim = Math.PI * (3 * (rx + ry) -
    Math.sqrt((3 * rx + ry) * (rx + 3 * ry)))
  const drawn = perim * progress

  // Trail particle position
  const angle = trailAngle * Math.PI * 2
  const tx    = cx + Math.cos(angle) * rx
  const ty    = cy + Math.sin(angle) * ry

  return (
    <g transform={`rotate(${rotate} ${cx} ${cy})`} opacity={opacity}>
      {/* Halo */}
      <ellipse
        cx={cx} cy={cy} rx={rx} ry={ry}
        fill="none"
        stroke={stroke}
        strokeWidth={4}
        opacity={Math.min(0.18, 0.10 + progress * 0.08)}
        style={{ filter: 'blur(6px)' }}
        strokeDasharray={`${drawn} ${perim}`}
      />
      {/* Crisp ring */}
      <ellipse
        cx={cx} cy={cy} rx={rx} ry={ry}
        fill="none"
        stroke={stroke}
        strokeWidth={0.8}
        opacity={0.52}
        strokeDasharray={`${drawn} ${perim}`}
      />
      {/* Trailing particle — only visible once the orbit is mostly drawn */}
      {progress > 0.45 && (
        <circle
          cx={tx}
          cy={ty}
          r={2.2}
          fill={stroke}
          opacity={Math.min(1, (progress - 0.45) * 3)}
          style={{ filter: `drop-shadow(0 0 6px ${stroke})` }}
        />
      )}
    </g>
  )
}
