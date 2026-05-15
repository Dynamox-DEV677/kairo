/**
 * Aura — the slow-panning purple radial glow that sits behind every scene,
 * exactly like the Canva file's diagonal purple wash.
 */
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { C } from '../theme'

export const Aura: React.FC<{ intensity?: number }> = ({ intensity = 1 }) => {
  const frame = useCurrentFrame()
  // Slow side-to-side drift over ~6 s
  const xDrift = Math.sin(frame / 60) * 8
  const yDrift = Math.cos(frame / 80) * 6
  // Soft breathing 0.7 ↔ 1
  const breath = 0.75 + 0.25 * Math.sin(frame / 40)

  return (
    <>
      {/* Base black */}
      <AbsoluteFill style={{ background: C.bg }} />
      {/* Primary purple aura — top-left */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${30 + xDrift}% ${30 + yDrift}%,
                       rgba(124, 58, 237, ${0.35 * breath * intensity}) 0%,
                       transparent 50%)`,
        }}
      />
      {/* Secondary cooler glow — bottom-right */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${70 - xDrift}% ${70 - yDrift}%,
                       rgba(196, 181, 253, ${0.18 * breath * intensity}) 0%,
                       transparent 55%)`,
        }}
      />
    </>
  )
}
