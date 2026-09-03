/**
 * Lighting + environment.
 *
 * Built like a product photography set, not a game scene: one large soft key,
 * a broad cold fill for edge separation, a warm kicker so the metal doesn't go
 * blue-grey, and a hard raking light used only for the specular sweep in Scene 3.
 *
 * The environment map is generated in-memory (a gradient studio softbox) rather
 * than loaded from a CDN — the render must work offline and deterministically.
 */
import { useMemo } from 'react'
import { useCurrentFrame } from 'remotion'
import * as THREE from 'three'
import { COLOR } from '../../constants/theme'
import { SCENE, FPS } from '../../constants/timeline'
import { progress, ramp, envelope, CINEMA } from '../../lib/easing'

/**
 * A studio softbox environment, drawn to a canvas and used as the scene's
 * equirectangular env map. This is what the titanium actually reflects, so the
 * gradient is doing most of the "expensive metal" work.
 */
function useStudioEnvironment() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 512
    const ctx = c.getContext('2d')!

    ctx.fillStyle = '#050506'
    ctx.fillRect(0, 0, c.width, c.height)

    // Large overhead softbox — the primary highlight the metal picks up.
    const key = ctx.createRadialGradient(c.width * 0.30, c.height * 0.16, 10, c.width * 0.30, c.height * 0.16, 320)
    key.addColorStop(0, '#ffffff')
    key.addColorStop(0.35, '#c8ccd6')
    key.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = key
    ctx.fillRect(0, 0, c.width, c.height)

    // Cold wrap on the opposite side for edge definition.
    const cold = ctx.createRadialGradient(c.width * 0.78, c.height * 0.42, 10, c.width * 0.78, c.height * 0.42, 380)
    cold.addColorStop(0, COLOR.coldBounce)
    cold.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalAlpha = 0.5
    ctx.fillStyle = cold
    ctx.fillRect(0, 0, c.width, c.height)

    // Warm floor bounce so the underside isn't dead.
    ctx.globalAlpha = 0.22
    const warm = ctx.createLinearGradient(0, c.height * 0.62, 0, c.height)
    warm.addColorStop(0, 'rgba(0,0,0,0)')
    warm.addColorStop(1, COLOR.warmFill)
    ctx.fillStyle = warm
    ctx.fillRect(0, c.height * 0.62, c.width, c.height * 0.38)
    ctx.globalAlpha = 1

    const tex = new THREE.CanvasTexture(c)
    tex.mapping = THREE.EquirectangularReflectionMapping
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}

export default function StudioRig() {
  const frame = useCurrentFrame()
  const env = useStudioEnvironment()

  // Scene 1: the very first light is born. Everything else stays black.
  const birth = progress(frame, 0.7, 4.6, CINEMA)
  // Environment only fades up as the mark becomes metal — before that the
  // reflections would give away the shape too early.
  const envUp = ramp(frame, SCENE.assemble.from + 0.6, SCENE.assemble.to, 0, 1, CINEMA)

  // Scene 3: a hard raking light travels across the part. This is the single
  // "reveal" moment for the brushed finish.
  const sweep = envelope(frame, SCENE.seat.from + 0.7, SCENE.seat.to - 0.5, 0.7, 0.9)
  const sweepX = ramp(frame, SCENE.seat.from + 0.7, SCENE.seat.to - 0.5, -7, 7, CINEMA)

  return (
    <>
      {/* Reflections. Intensity ramps so the metal "arrives". */}
      <primitive object={env} attach="environment" />
      <ambientLight intensity={0.055 * birth} color={COLOR.light} />

      {/* Key — large, soft, high and slightly camera-left. */}
      <directionalLight
        position={[-3.4, 5.2, 4.2]}
        intensity={2.05 * birth * (0.45 + envUp * 0.55)}
        color={COLOR.light}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
      />

      {/* Cold fill, opposite side, low intensity — separation not illumination. */}
      <directionalLight position={[5.0, 1.1, -2.4]} intensity={0.62 * envUp} color={COLOR.coldBounce} />

      {/* Warm kicker from below so titanium reads warm-neutral. */}
      <directionalLight position={[1.4, -3.2, 2.0]} intensity={0.34 * envUp} color={COLOR.warmFill} />

      {/* Scene 1's single born light, sitting behind the mark's future position. */}
      <pointLight position={[0, 0, -1.6]} intensity={4.2 * birth * (1 - envUp * 0.75)} color={COLOR.light} distance={9} decay={2} />

      {/* The specular rake. Narrow and bright; only alive during Scene 3. */}
      {sweep > 0.001 && (
        <spotLight
          position={[sweepX, 2.6, 5.0]}
          target-position={[0, 0, 0]}
          angle={0.42}
          penumbra={0.92}
          intensity={13 * sweep}
          color={COLOR.titaniumLift}
          distance={22}
          decay={1.7}
        />
      )}
    </>
  )
}
