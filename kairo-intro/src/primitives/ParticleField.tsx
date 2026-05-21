/**
 * ParticleField — the deterministic 3D particle layer used across the
 * intro. Same component, different `mode` per scene:
 *
 *   'dawn'    : sparse drift, slow upward bias, fade-in by phase
 *   'lattice' : particles snap toward orbital nodes
 *   'orbital' : tight cluster orbiting the logo centre
 *   'still'   : frozen field, no drift (used in scene 02 to let the
 *                line take focus)
 *
 * One field per scene; opacity-blend between scenes via the parent's
 * <Sequence> cross-fade rather than spawning multiple fields.
 */
import { useCurrentFrame } from 'remotion'
import { useMemo } from 'react'
import { COLORS } from '../config/colors'
import { MOTION } from '../config/motion'
import { WIDTH, HEIGHT } from '../config/timing'
import { mulberry32 } from '../lib/rng'
import { noise1 } from '../lib/noise'
import { cameraAt, project } from '../lib/camera'

export type FieldMode = 'dawn' | 'lattice' | 'orbital' | 'still'

interface Props {
  mode:      FieldMode
  /** 0-1 — lets the scene fade the field in or out over its own progress. */
  intensity: number
  /** Optional override — defaults to MOTION.PARTICLE_COUNT. */
  count?:    number
  /** Optional override — defaults to MOTION.PARTICLE_SEED. */
  seed?:     number
}

interface Particle {
  /** World-space initial position. */
  x0: number
  y0: number
  z0: number
  /** Independent phase so they breathe / drift out of sync. */
  phase: number
  /** Mass / depth bucket — used for size + parallax. */
  mass: number
  /** Pre-rolled hue choice — primary or secondary. */
  hue: 'primary' | 'secondary' | 'highlight'
  /** When in [0,1] this particle becomes visible during dawn. */
  fadeIn: number
}

export default function ParticleField({
  mode,
  intensity,
  count = MOTION.PARTICLE_COUNT,
  seed  = MOTION.PARTICLE_SEED,
}: Props) {
  const frame = useCurrentFrame()
  const cam   = cameraAt(frame)

  // Particle field is *built once* per seed — keeps render cost low
  // and guarantees byte-identical output across re-runs.
  const particles = useMemo<Particle[]>(() => {
    const r = mulberry32(seed)
    return Array.from({ length: count }, () => {
      const [zMin, zMax] = MOTION.PARTICLE_DEPTH_RANGE
      const hueRoll = r()
      return {
        // Spread across a generous world rectangle that exceeds the
        // viewport so panning never reveals an empty edge.
        x0:    (r() - 0.5) * WIDTH  * 1.6,
        y0:    (r() - 0.5) * HEIGHT * 1.6,
        z0:    zMin + r() * (zMax - zMin),
        phase: r() * Math.PI * 2,
        mass:  0.35 + r() * 0.65,
        hue:
          hueRoll < 0.62 ? 'primary'   :
          hueRoll < 0.92 ? 'secondary' : 'highlight',
        fadeIn: r(),
      }
    })
  }, [count, seed])

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {particles.map((p, i) => {
        // ── Per-mode position offset ─────────────────────────────
        let dx = 0
        let dy = 0

        if (mode === 'dawn') {
          // Slow upward drift + ±4px lateral noise
          dy = -noise1(frame / 240 + p.phase, i) * 18 * p.mass
          dx =  noise1(frame / 280 + p.phase * 1.6, i + 99) * 12 * p.mass
        } else if (mode === 'lattice') {
          // Tighten radially toward centre as `intensity` grows.
          const pull = intensity * 0.35
          dx = -p.x0 * pull * 0.18
          dy = -p.y0 * pull * 0.18
        } else if (mode === 'orbital') {
          // Orbit the centre at radius 160-260 px.
          const radius = 160 + p.mass * 100
          const speed  = 0.012 + p.mass * 0.006
          dx = Math.cos(frame * speed + p.phase) * radius - p.x0 * 0.92
          dy = Math.sin(frame * speed + p.phase) * radius - p.y0 * 0.92
        }
        // 'still' = no offset

        // ── Project to screen ────────────────────────────────────
        const projected = project(
          { x: p.x0 + dx, y: p.y0 + dy, z: p.z0 },
          cam,
        )

        // ── Visual properties ────────────────────────────────────
        const sizeBase = MOTION.PARTICLE_MIN_SIZE +
          (1 - normalize(p.z0, MOTION.PARTICLE_DEPTH_RANGE)) *
          (MOTION.PARTICLE_MAX_SIZE - MOTION.PARTICLE_MIN_SIZE)
        const size = sizeBase * projected.scale

        // Depth-based opacity ceiling
        const depthAlpha = 0.30 + (1 - normalize(p.z0, MOTION.PARTICLE_DEPTH_RANGE)) * 0.55

        // Per-particle fade-in during dawn
        const fadeAlpha =
          mode === 'dawn'
            ? smoothstep(intensity, p.fadeIn, p.fadeIn + 0.35)
            : 1

        const alpha = depthAlpha * fadeAlpha * intensity

        const color = p.hue === 'primary'   ? COLORS.primary
                   :  p.hue === 'secondary' ? COLORS.secondary
                   :                          COLORS.highlight

        return (
          <circle
            key={i}
            cx={projected.x}
            cy={projected.y}
            r={size}
            fill={color}
            opacity={alpha}
            style={{
              // Tiny soft glow on the larger particles only — keeps the
              // overall feel quiet. Cap matches the refinement spec.
              filter: size > 1.8
                ? `drop-shadow(0 0 ${size * 1.4}px ${color})`
                : undefined,
            }}
          />
        )
      })}
    </svg>
  )
}

const normalize = (v: number, [a, b]: readonly [number, number]) =>
  (v - a) / (b - a)

const smoothstep = (v: number, edge0: number, edge1: number) => {
  const t = Math.max(0, Math.min(1, (v - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}
