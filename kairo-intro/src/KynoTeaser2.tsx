/**
 * KynoTeaser2 — ~22-second YouTube teaser for Kyno.
 *
 * (Named `Teaser2` to avoid colliding with the existing Kairo
 * `KairoTeaser.tsx` — this file is fully self-contained, no shared
 * imports, so the original Kairo renders are untouched.)
 *
 * Timeline (660 frames @ 30fps = 22.00s):
 *   0.0 – 2.0s   particles drift in, black
 *   1.6 – 4.6s   mark + "Kyno" wordmark reveal (compressed sting)
 *   4.6 – 8.6s   feature card 1 — "Solve any doubt."
 *   8.6 – 12.6s  feature card 2 — "Fix your mistakes."
 *   12.6 – 16.6s feature card 3 — "Stay motivated."
 *   16.6 – 19.6s tagline card — "Learn faster. Think smarter."
 *   19.6 – 22.0s logo lock + sign-off, fade to black
 */
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

export const KYNO_TEASER2_FPS = 30
export const KYNO_TEASER2_DURATION_S = 22
export const KYNO_TEASER2_DURATION_F = KYNO_TEASER2_FPS * KYNO_TEASER2_DURATION_S
const W = 1920
const H = 1080

const PURPLE = '#7C5CFF'
const CYAN   = '#4FD8E8'
const GOLD   = '#ffb020'
const BG     = '#050505'
const FONT   = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

function hash(i: number) {
  const s = Math.sin(i * 12.9898) * 43758.5453
  return s - Math.floor(s)
}
const PARTICLES = Array.from({ length: 90 }, (_, i) => ({
  x: hash(i) * W,
  y: hash(i + 500) * H,
  r: 1 + hash(i + 1000) * 2.2,
  phase: hash(i + 2000) * Math.PI * 2,
  speed: 0.3 + hash(i + 3000) * 0.7,
  color: hash(i + 4000) < 0.5 ? PURPLE : CYAN,
}))
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

function ParticlesLayer({ frame, intensity }: { frame: number; intensity: number }) {
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
      {PARTICLES.map((p, i) => {
        const dy = Math.sin(frame / 60 * p.speed + p.phase) * 14
        const dx = Math.cos(frame / 70 * p.speed + p.phase) * 10
        const alpha = 0.45 * intensity * (0.4 + hash(i + 9000) * 0.6)
        return <circle key={i} cx={p.x + dx} cy={p.y + dy} r={p.r} fill={p.color} opacity={alpha} />
      })}
    </svg>
  )
}

/** A feature beat: bold headline + supporting line, fades/slides in and out within [from, to]. */
function FeatureCard({
  frame, fps, from, to, headline, sub, accent,
}: { frame: number; fps: number; from: number; to: number; headline: string; sub: string; accent: string }) {
  const fadeIn  = interpolate(frame, [from, from + fps * 0.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const fadeOut = interpolate(frame, [to - fps * 0.5, to], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const opacity = Math.min(fadeIn, fadeOut)
  const slideY  = interpolate(frame, [from, from + fps * 0.5], [22, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  if (frame < from - fps * 0.2 || frame > to + fps * 0.2) return null
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', opacity }}>
      <div style={{
        width: 10, height: 10, borderRadius: 5, background: accent, marginBottom: 22,
        boxShadow: `0 0 20px ${accent}`, transform: `translateY(${slideY}px)`,
      }} />
      <div style={{
        fontFamily: FONT, fontWeight: 800, fontSize: 64, color: '#FFFFFF',
        letterSpacing: '-0.02em', textAlign: 'center', maxWidth: 1200,
        transform: `translateY(${slideY}px)`,
      }}>
        {headline}
      </div>
      <div style={{
        marginTop: 16, fontFamily: FONT, fontWeight: 500, fontSize: 26, color: 'rgba(255,255,255,0.62)',
        textAlign: 'center', maxWidth: 900, transform: `translateY(${slideY}px)`,
      }}>
        {sub}
      </div>
    </AbsoluteFill>
  )
}

export default function KynoTeaser2() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = (n: number) => fps * n

  const particleIntensity = clamp01(frame / s(2))

  // Opening mark + wordmark (compressed)
  const openOpacity = interpolate(frame, [0, s(4.6)], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  })
  const markSpring = spring({ frame: frame - s(1.6), fps, config: { damping: 14, stiffness: 95, mass: 0.85 } })
  const markOpacity = interpolate(frame, [s(1.6), s(2.3)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const wordmarkOpacity = interpolate(frame, [s(2.6), s(3.2)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const showOpening = frame < s(4.8)

  const showTagline = frame >= s(16.6) && frame < s(19.8)
  const taglineOpacity = interpolate(frame, [s(16.6), s(17.1), s(19.1), s(19.6)], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  })

  const showSignoff = frame >= s(19.6)
  const signoffMarkSpring = spring({ frame: frame - s(19.6), fps, config: { damping: 16, stiffness: 100 } })
  const signoffOpacity = interpolate(frame, [s(19.6), s(20.3)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  const endFadeStart = KYNO_TEASER2_DURATION_F - fps * 0.7
  const masterFade = interpolate(frame, [endFadeStart, KYNO_TEASER2_DURATION_F], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ background: BG, opacity: masterFade }}>
      <ParticlesLayer frame={frame} intensity={particleIntensity} />

      {showOpening && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', opacity: openOpacity }}>
          <div style={{
            width: 180, height: 180, opacity: markOpacity, transform: `scale(${markSpring})`,
            filter: `drop-shadow(0 0 40px ${PURPLE}aa)`, borderRadius: 40, overflow: 'hidden',
          }}>
            <Img src={staticFile('kyno_mark.png')} style={{ width: '100%', height: '100%', display: 'block' }} />
          </div>
          <div style={{
            marginTop: 26, opacity: wordmarkOpacity, fontFamily: FONT, fontWeight: 800,
            fontSize: 60, letterSpacing: '-0.02em', color: '#FFFFFF',
          }}>
            Kyno
          </div>
        </AbsoluteFill>
      )}

      <FeatureCard frame={frame} fps={fps} from={s(4.6)} to={s(8.6)} accent={PURPLE}
        headline="Solve any doubt." sub="Type it or snap a photo — Kyno explains it step by step." />
      <FeatureCard frame={frame} fps={fps} from={s(8.6)} to={s(12.6)} accent={CYAN}
        headline="Fix your mistakes." sub="Every wrong answer becomes real understanding." />
      <FeatureCard frame={frame} fps={fps} from={s(12.6)} to={s(16.6)} accent={GOLD}
        headline="Stay motivated." sub="Earn XP, keep your streak, climb the weekly League." />

      {showTagline && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: taglineOpacity }}>
          <div style={{
            fontFamily: FONT, fontWeight: 800, fontSize: 58, color: '#FFFFFF',
            letterSpacing: '-0.02em', textAlign: 'center', maxWidth: 1100,
          }}>
            Learn faster. Think smarter.
          </div>
        </AbsoluteFill>
      )}

      {showSignoff && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', opacity: signoffOpacity }}>
          <div style={{
            width: 150, height: 150, transform: `scale(${signoffMarkSpring})`,
            filter: `drop-shadow(0 0 36px ${PURPLE}aa)`, borderRadius: 34, overflow: 'hidden',
          }}>
            <Img src={staticFile('kyno_mark.png')} style={{ width: '100%', height: '100%', display: 'block' }} />
          </div>
          <div style={{ marginTop: 22, fontFamily: FONT, fontWeight: 800, fontSize: 52, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
            Kyno
          </div>
          <div style={{ marginTop: 8, fontFamily: FONT, fontWeight: 600, fontSize: 22, color: CYAN }}>
            by Kairo Industries
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}
