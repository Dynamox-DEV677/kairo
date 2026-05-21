/**
 * Scene 06 — Breathe (38-44s)
 *
 * The logo holds with a subtle scale breathing pulse (±1.8%). A small
 * cluster of "intelligent" particles orbits around it on a single
 * fast ring — they don't trail, they don't burst — they just hold
 * pattern, the way a server cluster's status lights do when idle.
 *
 * Camera holds. The viewer's eye should settle on the K + caption
 * block. This is the breathing room before the final zoom.
 */
import { useCurrentFrame } from 'remotion'
import { sceneProgress, BEATS } from '../config/timing'
import { MOTION } from '../config/motion'
import { COLORS } from '../config/colors'
import { BREATHE, APPLE, sub } from '../lib/easings'
import KairoMark     from '../primitives/KairoMark'
import ParticleField from '../primitives/ParticleField'
import DepthFog      from '../primitives/DepthFog'

const WORDMARK = 'KAIRO'
const TAGLINE  = 'YOUR AI EDUCATION SYSTEM'

export default function Scene06_Breathe() {
  // useCurrentFrame() returns the absolute video frame now that
  // <Sequence> has been removed from the composition shell.
  const frame = useCurrentFrame()
  const p     = sceneProgress('breathe', frame)

  // Breathing — sinusoidal ±BREATHE_AMP scale, ~4s per cycle
  const breath = BREATHE(0.5 + 0.5 * Math.sin(frame / 36)) // ~4.2s period
  const pulseScale = (breath - 0.5) * 2 * MOTION.BREATHE_AMP // -amp..+amp

  // Orbital particles fade in over first 20% of scene
  const orbitalIntensity = APPLE(sub(p, 0, 0.20))

  // Caption holds full-opacity throughout (carried from scene 05)
  const captionOpacity = 1

  void BEATS.orbitalParticleIn

  return (
    <>
      <DepthFog vignette={0.60} tint={0.50} />
      <ParticleField mode="orbital" intensity={orbitalIntensity} />

      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 56,
        pointerEvents: 'none',
      }}>
        <KairoMark
          drawProgress={1}
          fillProgress={1}
          size={MOTION.LOGO_SIZE_PX}
          pulse={pulseScale}
        />
        <div style={{ textAlign: 'center', opacity: captionOpacity }}>
          <div style={{
            fontFamily: 'var(--kairo-font)',
            fontSize: 94, fontWeight: 800, letterSpacing: -2.4,
            color: COLORS.text, lineHeight: 1,
          }}>
            {WORDMARK}
          </div>
          <div style={{ height: 22 }} />
          <div style={{
            fontFamily: 'var(--kairo-font)',
            fontSize: 14, fontWeight: 600, letterSpacing: 6.4,
            color: 'rgba(255, 255, 255, 0.78)',
            textTransform: 'uppercase',
          }}>
            {TAGLINE}
          </div>
        </div>
      </div>
    </>
  )
}
