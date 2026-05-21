/**
 * Scene 07 — Zoom + Final Pulse (44-48s)
 *
 * Camera dollies in (handled by the cam.z value in lib/camera.ts).
 * The whole composition scales up slightly. At BEATS.finalPulse a
 * final 6% pulse hits, then the frame freezes for the last 30 frames
 * (≈0.5s) on a held premium end-frame.
 *
 * Nothing else moves. The viewer's reading the final tableau.
 */
import { useCurrentFrame } from 'remotion'
import { sceneProgress, BEATS } from '../config/timing'
import { MOTION } from '../config/motion'
import { COLORS } from '../config/colors'
import { CINEMATIC, PULSE, sub } from '../lib/easings'
import KairoMark     from '../primitives/KairoMark'
import ParticleField from '../primitives/ParticleField'
import DepthFog      from '../primitives/DepthFog'

const WORDMARK = 'KAIRO'
const TAGLINE  = 'YOUR AI EDUCATION SYSTEM'

export default function Scene07_Zoom({ globalFrame }: { globalFrame: number }) {
  const frame = useCurrentFrame()
  const p     = sceneProgress('zoom', frame)

  // Overall composition zoom — applied as a wrapper scale on top of
  // the camera's natural dolly.
  const zoom = 1 + CINEMATIC(p) * (MOTION.FINAL_ZOOM_FACTOR - 1)

  // Final pulse — fires at BEATS.finalPulse, lasts ~24f
  const pulseElapsed = globalFrame - BEATS.finalPulse
  const pulseT       = clamp01(pulseElapsed / 24)
  const finalPulse   = (pulseElapsed >= 0)
    ? 0.06 * (1 - PULSE(pulseT))
    : 0

  // Particles slow + fade just slightly as we settle
  const orbitalIntensity = 1 - sub(p, 0.55, 1.0) * 0.30

  return (
    <>
      <DepthFog vignette={0.65} tint={0.45} />
      <ParticleField mode="orbital" intensity={orbitalIntensity} />

      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 56,
        transform: `scale(${zoom})`,
        transformOrigin: '50% 50%',
        pointerEvents: 'none',
      }}>
        <KairoMark
          drawProgress={1}
          fillProgress={1}
          size={MOTION.LOGO_SIZE_PX}
          pulse={finalPulse}
        />
        <div style={{ textAlign: 'center' }}>
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

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
