/**
 * BigBeat — a single punchy text word that scales/blurs in and slides out.
 * Replicates the Canva "Pop" entrance + slight hang + crisp exit.
 *
 * One <BigBeat> per word the Canva file shows.
 */
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion'
import { C, FONT, GRAD } from '../theme'

interface Props {
  text:        string
  /** When this beat starts (frame). */
  start:       number
  /** How long the beat is visible (frames). Default 18 (0.6s). */
  hold?:       number
  /** Font size in px (default 280). */
  size?:       number
  /** Treat as the brand "kairo" wordmark — paints text with the purple gradient. */
  gradient?:   boolean
  /** Optional override colour (ignored if gradient=true). */
  color?:      string
  /** Lock the text inside the center 80% so wide words like SOMETHING never clip. */
  maxWidthPct?: number
}

export const BigBeat: React.FC<Props> = ({
  text, start, hold = 18, size = 280, gradient = false, color, maxWidthPct = 90,
}) => {
  const frame  = useCurrentFrame()
  const { fps } = useVideoConfig()
  const local = frame - start

  if (local < -2) return null
  if (local > hold + 16) return null

  // Spring "pop" entrance over 0.45 s
  const enter = spring({
    frame: local, fps, config: { stiffness: 360, damping: 18 }, durationInFrames: 14,
  })

  // Exit blur + scale-down + fade after `hold`
  const exitT  = Math.max(0, local - hold)
  const exit01 = interpolate(exitT, [0, 12], [0, 1], { extrapolateRight: 'clamp' })

  const scale  = enter * (1 - exit01 * 0.08)
  const opacity = interpolate(local, [0, 4, hold, hold + 12], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  })
  const blur = interpolate(local, [0, 4], [12, 0], { extrapolateRight: 'clamp' })
        + exit01 * 8
  const yEnter = interpolate(enter, [0, 1], [12, 0])

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        textAlign: 'center',
        padding: '0 5%',
      }}
    >
      <div
        style={{
          fontFamily: FONT.family,
          fontWeight: FONT.bold,
          fontSize: size,
          lineHeight: 0.95,
          letterSpacing: '-0.05em',
          opacity,
          transform: `translateY(${yEnter}px) scale(${scale})`,
          filter: `blur(${blur}px)`,
          maxWidth: `${maxWidthPct}%`,
          color: gradient ? 'transparent' : (color ?? C.text),
          ...(gradient ? {
            background: GRAD.primary,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 40px rgba(167, 139, 250, 0.45)',
          } : {
            textShadow: '0 0 30px rgba(196, 181, 253, 0.35)',
          }),
        }}
      >
        {text}
      </div>
    </div>
  )
}
