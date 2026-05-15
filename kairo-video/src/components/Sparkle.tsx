/**
 * Sparkle — the 4-point white star shape used in every corner of the Canva
 * design. Slow pulse + slow rotation + slight drift for life.
 */
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion'

interface Props {
  /** Top edge in px on a 1920×1080 canvas. */
  top:    number
  /** Left edge in px on a 1920×1080 canvas. */
  left:   number
  /** Star size in px (default 90). */
  size?:  number
  /** Pulse cycle duration in frames (default 60 — 2 s at 30 fps). */
  pulseFrames?: number
  /** Optional start-up delay in frames so each sparkle appears in sequence. */
  delay?: number
  /** Optional fill colour (default white). */
  color?: string
}

export const Sparkle: React.FC<Props> = ({
  top, left, size = 90, pulseFrames = 60, delay = 0, color = '#ffffff',
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = frame - delay

  // Spring entrance — burst from 0 to 1 in ~0.5 s
  const entrance = spring({ frame: t, fps, config: { stiffness: 240, damping: 14 } })

  // Continuous pulse — 1.0 ↔ 1.18 ↔ 1.0
  const pulse = 0.88 + 0.18 * Math.sin((t / pulseFrames) * Math.PI * 2)

  // Slow rotation — 360° every 8 s
  const rotation = (t / (fps * 8)) * 360

  // Subtle drift
  const driftY = Math.sin(t / 25) * 6
  const driftX = Math.cos(t / 30) * 4

  const opacity = interpolate(t, [0, 8], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <div
      style={{
        position: 'absolute',
        top:  top + driftY,
        left: left + driftX,
        width:  size,
        height: size,
        opacity,
        transform: `scale(${entrance * pulse}) rotate(${rotation}deg)`,
        pointerEvents: 'none',
        filter: 'drop-shadow(0 0 18px rgba(255,255,255,0.45))',
      }}
    >
      <svg viewBox="-50 -50 100 100" width={size} height={size}>
        {/* 4-point star — same proportions Canva uses for video sparkles */}
        <path
          d="M 0 -50 C 6 -14 14 -6 50 0 C 14 6 6 14 0 50 C -6 14 -14 6 -50 0 C -14 -6 -6 -14 0 -50 Z"
          fill={color}
        />
      </svg>
    </div>
  )
}
