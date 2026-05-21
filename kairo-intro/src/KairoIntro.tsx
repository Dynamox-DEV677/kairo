/**
 * KairoIntro — the top-level composition.
 *
 * IMPORTANT — Why we don't use <Sequence>:
 *
 * Remotion's <Sequence> shifts the child's clock — useCurrentFrame()
 * inside a Sequence returns the frame *relative to the sequence
 * start*, not the absolute video frame. Our SCENES anchors + BEATS
 * (in config/timing.ts) are absolute frame numbers, so a Sequence
 * would mean every `sceneProgress()` and BEATS comparison silently
 * computes against the wrong clock.
 *
 * Instead, we mount every scene at the root level and gate visibility
 * with opacity (and a hard null when the scene is far out of its
 * window — keeps render cost down). Every component then sees the
 * same absolute frame and the timing config Just Works.
 */
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { COLORS } from './config/colors'
import { WIDTH, HEIGHT, SCENES, OVERLAP_F } from './config/timing'
import { cameraAt } from './lib/camera'

import Scene01_Dawn      from './scenes/Scene01_Dawn'
import Scene02_FirstLine from './scenes/Scene02_FirstLine'
import Scene03_Lattice   from './scenes/Scene03_Lattice'
import Scene04_Assembly  from './scenes/Scene04_Assembly'
import Scene05_Reveal    from './scenes/Scene05_Reveal'
import Scene06_Breathe   from './scenes/Scene06_Breathe'
import Scene07_Zoom      from './scenes/Scene07_Zoom'

/**
 * Wraps the entire scene tree in the virtual-camera transform.
 *
 * Only the YAW rotation is applied at this layer — the dolly is
 * already handled per-element:
 *
 *   - particles: lib/camera.ts `project()` scales each particle by
 *     `FOCAL / (FOCAL - cam.z + world.z)` so depth reads correctly
 *     without a global canvas scale
 *   - logo / text: Scene07 applies its own zoom multiplier; the
 *     intermediate scenes don't need a dolly because their content
 *     is centred and the depth illusion comes from the particles
 *
 * If the CameraStage applied a global scale, the canvas itself
 * would visibly shrink (a "screen within a screen" with black
 * letterbox borders), which kills the cinematic feel.
 */
function CameraStage({ children }: { children: React.ReactNode }) {
  const frame = useCurrentFrame()
  const cam   = cameraAt(frame)
  return (
    <div style={{
      position: 'absolute', inset: 0,
      transform: `rotate(${cam.yaw}deg)`,
      transformOrigin: '50% 50%',
      willChange: 'transform',
    }}>
      {children}
    </div>
  )
}

/**
 * Gates a scene by opacity around its [start, end] window with a
 * soft cross-fade of OVERLAP_F frames at each edge.
 *
 * Returns null when the scene is far out of its window — saves the
 * cost of running its particle field + SVGs every frame.
 */
function SceneSlot({
  scene,
  children,
}: {
  scene: keyof typeof SCENES
  children: React.ReactNode
}) {
  const frame = useCurrentFrame()
  const { start, end } = SCENES[scene]
  if (frame < start - OVERLAP_F || frame >= end + OVERLAP_F) return null
  const fadeIn  = Math.min(1, Math.max(0, (frame - start) / OVERLAP_F))
  const fadeOut = Math.min(1, Math.max(0, (end - frame)   / OVERLAP_F))
  const opacity = Math.min(fadeIn, fadeOut)
  return (
    <div style={{ position: 'absolute', inset: 0, opacity }}>
      {children}
    </div>
  )
}

export default function KairoIntro() {
  return (
    <AbsoluteFill style={{ background: COLORS.bg, width: WIDTH, height: HEIGHT }}>
      <CameraStage>
        <SceneSlot scene="dawn">      <Scene01_Dawn /></SceneSlot>
        <SceneSlot scene="firstLine"> <Scene02_FirstLine /></SceneSlot>
        <SceneSlot scene="lattice">   <Scene03_Lattice /></SceneSlot>
        <SceneSlot scene="assembly">  <Scene04_Assembly /></SceneSlot>
        <SceneSlot scene="reveal">    <Scene05_Reveal /></SceneSlot>
        <SceneSlot scene="breathe">   <Scene06_Breathe /></SceneSlot>
        <SceneSlot scene="zoom">      <Scene07_Zoom /></SceneSlot>
      </CameraStage>
    </AbsoluteFill>
  )
}
