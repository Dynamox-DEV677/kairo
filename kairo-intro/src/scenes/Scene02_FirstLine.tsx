/**
 * Scene 02 — First Line (6-14s)
 *
 * A single thin line draws itself across the centre — left to right,
 * with a slight upward tilt so it doesn't read as a perfect axis. The
 * stroke uses the INK easing (slow start, hard finish) so it has the
 * "intentional pen-stroke" feel rather than a uniform sweep.
 *
 * Particles continue from scene 01 but in 'still' mode — frozen so
 * the line has the screen's full attention.
 */
import { useCurrentFrame } from 'remotion'
import { sceneProgress, WIDTH, HEIGHT } from '../config/timing'
import { INK, APPLE, sub } from '../lib/easings'
import ParticleField from '../primitives/ParticleField'
import GlowLine      from '../primitives/GlowLine'
import DepthFog      from '../primitives/DepthFog'

export default function Scene02_FirstLine() {
  const frame = useCurrentFrame()
  const p     = sceneProgress('firstLine', frame)

  // Line draws during the middle 70% of the scene (15-85%)
  const draw = INK(sub(p, 0.15, 0.85))

  // Hold particles still but bring a touch more depth
  const fieldIntensity = APPLE(Math.min(1, 0.85 + p * 0.15))

  // Geometry — line crosses 60% of the screen width, slightly off-axis
  const cx = WIDTH  / 2
  const cy = HEIGHT / 2
  const halfLen = WIDTH * 0.30
  const tilt    = -12   // px of vertical offset from one end to the other
  const x1 = cx - halfLen
  const y1 = cy - tilt / 2
  const x2 = cx + halfLen
  const y2 = cy + tilt / 2

  return (
    <>
      <DepthFog vignette={0.70} tint={0.40} />
      <ParticleField mode="still" intensity={fieldIntensity} />
      <svg
        width={WIDTH} height={HEIGHT}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <GlowLine
          x1={x1} y1={y1} x2={x2} y2={y2}
          progress={draw}
          width={1.4}
          hue="primary"
        />
      </svg>
    </>
  )
}
