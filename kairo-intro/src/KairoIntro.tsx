/**
 * KairoIntro — the top-level composition.
 *
 * Sequences the 7 scenes, applies the virtual camera (yaw + dolly),
 * and runs the global background. Every scene receives the
 * *current absolute frame* via `globalFrame` so beats anchored in
 * BEATS (which are absolute frame indices) line up regardless of
 * each <Sequence>'s own clock.
 *
 * Scene cross-fades are handled by overlapping <Sequence> ranges
 * with OVERLAP_F — each scene fades its first/last OVERLAP_F frames
 * so adjacent scenes overlap visually without a hard cut.
 */
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion'
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
 * Wraps a scene with the camera transform (yaw rotation + scaled
 * dolly) so individual scenes don't have to re-apply them.
 */
function CameraStage({ children }: { children: React.ReactNode }) {
  const frame = useCurrentFrame()
  const cam   = cameraAt(frame)
  // Map cam.z to a scale — the closer (less negative z), the larger
  const scale = 800 / (800 - cam.z)
  return (
    <div style={{
      position: 'absolute', inset: 0,
      transform: `rotate(${cam.yaw}deg) scale(${scale})`,
      transformOrigin: '50% 50%',
      willChange: 'transform',
    }}>
      {children}
    </div>
  )
}

/**
 * Scene wrapper — adds the cross-fade on entry/exit and forwards
 * the global frame to children that need it.
 */
function SceneWrap({
  scene, children,
}: {
  scene: keyof typeof SCENES
  children: (globalFrame: number) => React.ReactNode
}) {
  const frame = useCurrentFrame()
  const { start, end } = SCENES[scene]
  // Fade in over OVERLAP_F at scene start, out at scene end
  const fadeIn  = Math.min(1, (frame - start) / OVERLAP_F)
  const fadeOut = Math.min(1, (end - frame)  / OVERLAP_F)
  const opacity = Math.max(0, Math.min(fadeIn, fadeOut))
  return (
    <div style={{ position: 'absolute', inset: 0, opacity }}>
      {children(frame)}
    </div>
  )
}

export default function KairoIntro() {
  return (
    <AbsoluteFill style={{ background: COLORS.bg, width: WIDTH, height: HEIGHT }}>
      <CameraStage>
        {/* Scene durations are derived from SCENES anchors — no magic numbers
            here. Add new scenes by adding to SCENES + registering below. */}
        <Sequence from={SCENES.dawn.start}      durationInFrames={SCENES.dawn.end      - SCENES.dawn.start}>
          <SceneWrap scene="dawn">{() => <Scene01_Dawn />}</SceneWrap>
        </Sequence>

        <Sequence from={SCENES.firstLine.start} durationInFrames={SCENES.firstLine.end - SCENES.firstLine.start}>
          <SceneWrap scene="firstLine">{() => <Scene02_FirstLine />}</SceneWrap>
        </Sequence>

        <Sequence from={SCENES.lattice.start}   durationInFrames={SCENES.lattice.end   - SCENES.lattice.start}>
          <SceneWrap scene="lattice">{() => <Scene03_Lattice />}</SceneWrap>
        </Sequence>

        <Sequence from={SCENES.assembly.start}  durationInFrames={SCENES.assembly.end  - SCENES.assembly.start}>
          <SceneWrap scene="assembly">{() => <Scene04_Assembly />}</SceneWrap>
        </Sequence>

        <Sequence from={SCENES.reveal.start}    durationInFrames={SCENES.reveal.end    - SCENES.reveal.start}>
          <SceneWrap scene="reveal">{(g) => <Scene05_Reveal globalFrame={g} />}</SceneWrap>
        </Sequence>

        <Sequence from={SCENES.breathe.start}   durationInFrames={SCENES.breathe.end   - SCENES.breathe.start}>
          <SceneWrap scene="breathe">{(g) => <Scene06_Breathe globalFrame={g} />}</SceneWrap>
        </Sequence>

        <Sequence from={SCENES.zoom.start}      durationInFrames={SCENES.zoom.end      - SCENES.zoom.start}>
          <SceneWrap scene="zoom">{(g) => <Scene07_Zoom globalFrame={g} />}</SceneWrap>
        </Sequence>
      </CameraStage>
    </AbsoluteFill>
  )
}
