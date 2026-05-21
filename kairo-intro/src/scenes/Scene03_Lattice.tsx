/**
 * Scene 03 — Lattice (14-22s)
 *
 * The first line spawns more lines. Each becomes an orbital path
 * (elliptical, tilted) and they nest around an emerging centre.
 *
 * Camera orbit is handled by lib/camera.ts (yaw rotates) — this scene
 * just renders the geometry; the rotation transform is applied by the
 * KairoIntro shell.
 *
 * 12 orbits by default (configurable via MOTION.LATTICE_LINE_COUNT).
 * Each orbit has its own:
 *   - radius      (logarithmic-ish distribution)
 *   - tilt        (random, from a seeded PRNG)
 *   - rotate      (golden-angle distribution for visual balance)
 *   - draw delay  (staggered over the first 60% of the scene)
 */
import { useCurrentFrame } from 'remotion'
import { useMemo } from 'react'
import { sceneProgress } from '../config/timing'
import { MOTION } from '../config/motion'
import { APPLE, CINEMATIC, sub } from '../lib/easings'
import { mulberry32 } from '../lib/rng'
import { WIDTH, HEIGHT } from '../config/timing'
import OrbitalPath  from '../primitives/OrbitalPath'
import ParticleField from '../primitives/ParticleField'
import DepthFog      from '../primitives/DepthFog'

interface Orbit {
  radius:    number
  tilt:      number
  rotate:    number
  delay:     number // 0-1 — when in scene this orbit begins drawing
  speed:     number // particle trail speed
  hue:       'primary' | 'secondary'
}

export default function Scene03_Lattice() {
  const frame = useCurrentFrame()
  const p     = sceneProgress('lattice', frame)

  const orbits = useMemo<Orbit[]>(() => {
    const r = mulberry32(0xC0FFEE)
    const n = MOTION.LATTICE_LINE_COUNT
    const minR = 80
    const maxR = 360
    const GOLDEN = 137.5  // golden angle in degrees — even visual coverage
    return Array.from({ length: n }, (_, i) => ({
      radius: minR + (maxR - minR) * (i / (n - 1)),
      tilt:   0.18 + r() * 0.42,
      rotate: (i * GOLDEN) % 360,
      delay:  (i / n) * 0.55,            // stagger draw-ins over 55% of scene
      speed:  0.55 + r() * 0.45,
      hue:    r() > 0.55 ? 'primary' : 'secondary',
    }))
  }, [])

  return (
    <>
      <DepthFog vignette={0.65} tint={0.45} />
      <ParticleField mode="lattice" intensity={APPLE(p)} />
      <svg
        width={WIDTH} height={HEIGHT}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        {orbits.map((o, i) => {
          // Each orbit draws over a 30% window starting at its delay
          const drawT = CINEMATIC(sub(p, o.delay, o.delay + 0.30))
          // Trail particle marches along the perimeter once drawn
          const trail = ((frame * o.speed) / 240) % 1
          return (
            <OrbitalPath
              key={i}
              radius={o.radius}
              tilt={o.tilt}
              rotate={o.rotate}
              progress={drawT}
              trailAngle={trail}
              hue={o.hue}
              opacity={Math.min(1, p / 0.20)}
            />
          )
        })}
      </svg>
    </>
  )
}
