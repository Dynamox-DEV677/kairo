/**
 * KynoSting — 8-second clean brand sting for Kyno.
 *
 * Fully self-contained (no imports from the Kairo intro's config/
 * primitives/lib) so this never touches the existing KairoIntro /
 * KairoTeaser renders. Uses Kyno's real app icon + real web palette
 * (`--c-purple` #7C5CFF / `--c-cyan` #4FD8E8) so it's pixel-consistent
 * with the actual app and Play Store listing.
 *
 * Timeline (240 frames @ 30fps = 8.00s):
 *   0.0 – 1.2s  particles drift in, black
 *   0.6 – 2.4s  mark scales/fades in with a soft glow pulse
 *   2.1 – 4.2s  "Kyno" wordmark draws in
 *   3.8 – 6.2s  tagline fades in
 *   6.2 – 8.0s  hold + gentle breathing glow, soft fade to black
 */
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

export const KYNO_STING_FPS = 30
export const KYNO_STING_DURATION_S = 8
export const KYNO_STING_DURATION_F = KYNO_STING_FPS * KYNO_STING_DURATION_S
const W = 1920
const H = 1080

const PURPLE = '#7C5CFF'
const CYAN   = '#4FD8E8'
const BG     = '#050505'

// Deterministic pseudo-random (no external rng dep) — same output every render.
function hash(i: number) {
  const s = Math.sin(i * 12.9898) * 43758.5453
  return s - Math.floor(s)
}

const PARTICLES = Array.from({ length: 70 }, (_, i) => ({
  x: hash(i) * W,
  y: hash(i + 500) * H,
  r: 1 + hash(i + 1000) * 2.4,
  phase: hash(i + 2000) * Math.PI * 2,
  speed: 0.4 + hash(i + 3000) * 0.8,
  color: hash(i + 4000) < 0.55 ? PURPLE : CYAN,
}))

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

export default function KynoSting() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const particleIn = clamp01(frame / (fps * 1.2))

  const markSpring = spring({
    frame: frame - fps * 0.6,
    fps,
    config: { damping: 14, stiffness: 90, mass: 0.9 },
  })
  const markOpacity = interpolate(frame, [fps * 0.6, fps * 1.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  const wordmarkOpacity = interpolate(frame, [fps * 2.1, fps * 2.9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const wordmarkY = interpolate(frame, [fps * 2.1, fps * 2.9], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  const taglineOpacity = interpolate(frame, [fps * 3.8, fps * 4.6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  const breathe = 1 + Math.sin((frame - fps * 4.6) / fps * 2.2) * 0.02
  const glowPulse = 0.6 + Math.sin((frame - fps * 4.6) / fps * 2.2) * 0.25

  const endFadeStart = KYNO_STING_DURATION_F - fps * 0.6
  const endFade = interpolate(frame, [endFadeStart, KYNO_STING_DURATION_F], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ background: BG, opacity: endFade }}>
      {/* Ambient particles */}
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
        {PARTICLES.map((p, i) => {
          const dy = Math.sin(frame / 60 * p.speed + p.phase) * 14
          const dx = Math.cos(frame / 70 * p.speed + p.phase) * 10
          const alpha = 0.55 * particleIn * (0.4 + hash(i + 9000) * 0.6)
          return (
            <circle key={i} cx={p.x + dx} cy={p.y + dy} r={p.r} fill={p.color} opacity={alpha} />
          )
        })}
      </svg>

      {/* Centre stack: mark + wordmark + tagline */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div
          style={{
            width: 220,
            height: 220,
            opacity: markOpacity,
            transform: `scale(${markSpring * breathe})`,
            filter: `drop-shadow(0 0 ${44 * glowPulse}px ${PURPLE}aa) drop-shadow(0 0 ${20 * glowPulse}px ${CYAN}66)`,
            borderRadius: 48,
            overflow: 'hidden',
          }}
        >
          <Img src={staticFile('kyno_mark.png')} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>

        <div
          style={{
            marginTop: 34,
            opacity: wordmarkOpacity,
            transform: `translateY(${wordmarkY}px)`,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            fontWeight: 800,
            fontSize: 76,
            letterSpacing: '-0.02em',
            color: '#FFFFFF',
          }}
        >
          Kyno
        </div>

        <div
          style={{
            marginTop: 14,
            opacity: taglineOpacity,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            fontWeight: 600,
            fontSize: 28,
            letterSpacing: '0.01em',
            color: CYAN,
          }}
        >
          Your AI Study Buddy
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
