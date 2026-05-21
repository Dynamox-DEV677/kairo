/**
 * Scene 01 — Dawn (0-6s)
 *
 * Pure darkness. Tiny particles fade in based on each particle's
 * individual phase, drifting slowly upward. Camera dollies forward
 * (handled in lib/camera.ts). Vignette intensifies subtly to focus
 * the eye toward centre, where the first line will appear.
 *
 * The intent is "void with a heartbeat" — the viewer should feel
 * something is *about* to happen but nothing yet has.
 */
import { useCurrentFrame } from 'remotion'
import { sceneProgress } from '../config/timing'
import { APPLE } from '../lib/easings'
import ParticleField from '../primitives/ParticleField'
import DepthFog      from '../primitives/DepthFog'

export default function Scene01_Dawn() {
  const frame    = useCurrentFrame()
  const p        = sceneProgress('dawn', frame)
  // Fade the field in over the first 60% of the scene
  const intensity = APPLE(Math.min(1, p / 0.6))

  return (
    <>
      <DepthFog vignette={0.5 + p * 0.20} tint={0.20 + p * 0.20} />
      <ParticleField mode="dawn" intensity={intensity} />
    </>
  )
}
