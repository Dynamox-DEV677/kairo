/**
 * KAIRO INDUSTRIES — launch film. Composition root.
 *
 * Layer order (back → front):
 *   1. ThreeCanvas — the physical world: mark, dust, lattice, studio lighting
 *   2. Grade       — filmic vignette + a whisper of cold/warm split-tone
 *   3. Type        — DOM typography, composited over the render
 *
 * Post FX (bloom / DOF) are opt-in via the `heavyFx` prop. They are genuinely
 * expensive on integrated GPUs, and the film is designed to read without them —
 * so previews stay responsive and the final pass can turn them on.
 */
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { ThreeCanvas } from '@remotion/three'
import { EffectComposer, Bloom, DepthOfField, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'

import StudioRig from './components/three/StudioRig'
import TitaniumLogo from './components/three/TitaniumLogo'
import MetallicDust from './components/three/MetallicDust'
import KnowledgeLattice from './components/three/KnowledgeLattice'
import CameraRig from './components/three/CameraRig'
import CinematicType from './components/ui/CinematicType'

import { WIDTH, HEIGHT, SCENE, FPS } from './constants/timeline'
import { COLOR } from './constants/theme'
import { ramp, envelope, CINEMA } from './lib/easing'

interface Props {
  /** Bloom + depth-of-field. Off for fast preview, on for the final render. */
  heavyFx?: boolean
}

export default function KairoAd({ heavyFx = true }: Props) {
  const frame = useCurrentFrame()
  const t = frame / FPS

  // Focus distance tracks the dolly so the mark stays the sharp plane while the
  // dust in front of and behind it falls off.
  const focus = t < SCENE.interior.from ? 0.021 : 0.055

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.void }}>
      <ThreeCanvas
        width={WIDTH}
        height={HEIGHT}
        camera={{ fov: 34, position: [0, 2.1, 15.5], near: 0.05, far: 120 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
          alpha: false,
        }}
        style={{ backgroundColor: COLOR.void }}
      >
        <CameraRig />
        <StudioRig />

        {/* Volumetric feel without a volumetric solver: exponential fog pulls the
            lattice into the dark and keeps the black background truly black. */}
        <fogExp2 attach="fog" args={[COLOR.void, 0.038]} />

        <MetallicDust />
        <KnowledgeLattice />
        {/* The shell is hidden once we're through it, and returns for the endplate. */}
        <TitaniumLogo visible={t < SCENE.interior.to - 0.6 || t > SCENE.signoff.from - 0.3} />

        {heavyFx && (
          <EffectComposer multisampling={4}>
            {/* Bloom only on genuine speculars — threshold kept high on purpose. */}
            <Bloom intensity={0.62} luminanceThreshold={0.72} luminanceSmoothing={0.28} mipmapBlur radius={0.72} />
            <DepthOfField focusDistance={focus} focalLength={0.055} bokehScale={3.1} height={720} />
            <Vignette eskil={false} offset={0.22} darkness={0.82} />
          </EffectComposer>
        )}
      </ThreeCanvas>

      {/* ── grade ── a subtle cold/warm split-tone. Sells "colour graded" without
          tinting the metal, which must stay neutral to read as titanium. */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          mixBlendMode: 'soft-light',
          opacity: 0.34,
          background:
            `radial-gradient(120% 80% at 28% 18%, ${COLOR.warmFill}22 0%, transparent 55%),` +
            `radial-gradient(120% 90% at 78% 82%, ${COLOR.coldBounce}2e 0%, transparent 58%)`,
        }}
      />

      {/* film-grade falloff at the extremes of the frame */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: 'radial-gradient(115% 82% at 50% 44%, transparent 42%, rgba(0,0,0,0.62) 100%)',
        }}
      />

      <CinematicType />

      {/* Scene 1 holds pure black a beat longer than the 3D layer so the film
          opens on silence, not on a canvas clear. */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          backgroundColor: COLOR.void,
          opacity: ramp(frame, 0.0, 1.5, 1, 0, CINEMA),
        }}
      />

      {/* A single hairline flash at the boom (12.2s) — one frame of light on the
          impact. Used exactly once in the film. */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          backgroundColor: COLOR.light,
          opacity: envelope(frame, 12.18, 12.46, 0.06, 0.22) * 0.16,
        }}
      />
    </AbsoluteFill>
  )
}
