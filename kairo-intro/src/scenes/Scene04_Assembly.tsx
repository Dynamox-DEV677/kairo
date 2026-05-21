/**
 * Scene 04 — Assembly (22-30s)
 *
 * The orbital lattice collapses inward and the Kairo K assembles
 * from its three stroke paths. Particle trails follow the converging
 * lines, then settle around the K once it's formed.
 *
 * The lattice from scene 03 fades out over the first 30% of this
 * scene; the K's draw-in starts at 25% so there's a brief moment
 * where both coexist (the lattice feeding the K).
 */
import { useCurrentFrame } from 'remotion'
import { useMemo } from 'react'
import { sceneProgress, WIDTH, HEIGHT } from '../config/timing'
import { MOTION } from '../config/motion'
import { APPLE, INK, sub } from '../lib/easings'
import { mulberry32 } from '../lib/rng'
import OrbitalPath  from '../primitives/OrbitalPath'
import ParticleField from '../primitives/ParticleField'
import KairoMark     from '../primitives/KairoMark'
import DepthFog      from '../primitives/DepthFog'

export default function Scene04_Assembly() {
  const frame = useCurrentFrame()
  const p     = sceneProgress('assembly', frame)

  // Lattice fades + collapses over 0-40%
  const latticeAlpha = 1 - APPLE(sub(p, 0, 0.40))
  // The K draws over 25-95%
  const drawProgress = INK(sub(p, 0.25, 0.95))
  // Soft fill peeks in toward end (but real lock is scene 05)
  const fillProgress = APPLE(sub(p, 0.80, 1.0)) * 0.18

  // Lattice rings — same geometry as scene 03 but shrinking
  const orbits = useMemo(() => {
    const r = mulberry32(0xC0FFEE)
    return Array.from({ length: MOTION.LATTICE_LINE_COUNT }, (_, i) => ({
      radius: 80 + (360 - 80) * (i / (MOTION.LATTICE_LINE_COUNT - 1)),
      tilt:   0.18 + r() * 0.42,
      rotate: (i * 137.5) % 360,
      speed:  0.55 + r() * 0.45,
      hue:    (r() > 0.55 ? 'primary' : 'secondary') as 'primary' | 'secondary',
    }))
  }, [])

  return (
    <>
      <DepthFog vignette={0.62} tint={0.45} />
      <ParticleField mode="lattice" intensity={1 - p * 0.35} />

      {/* Collapsing lattice */}
      <svg
        width={WIDTH} height={HEIGHT}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        {orbits.map((o, i) => {
          // Shrink radius as scene progresses (radial inward collapse)
          const r = o.radius * (1 - p * 0.55)
          const trail = ((frame * o.speed) / 240) % 1
          return (
            <OrbitalPath
              key={i}
              radius={r}
              tilt={o.tilt}
              rotate={o.rotate + p * 6}   // small extra spin as they fall
              progress={1}
              trailAngle={trail}
              hue={o.hue}
              opacity={latticeAlpha}
            />
          )
        })}
      </svg>

      {/* The forming K */}
      <div style={{
        position: 'absolute',
        left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }}>
        <KairoMark
          drawProgress={drawProgress}
          fillProgress={fillProgress}
          size={MOTION.LOGO_SIZE_PX}
        />
      </div>
    </>
  )
}
