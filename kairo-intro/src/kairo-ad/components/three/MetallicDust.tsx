/**
 * Atmospheric metal dust — and the particles that assemble the mark.
 *
 * One InstancedMesh drives both jobs. Each particle interpolates between a
 * deterministic drift position and a point sampled on the logo's contour, so the
 * same system that gives the frame its atmosphere is what packs into the logo.
 *
 * Everything is derived from `hash(i)` and the current frame — no state, no
 * Math.random, no useFrame — so parallel render workers stay in lockstep.
 */
import { useMemo, useRef, useLayoutEffect } from 'react'
import { useCurrentFrame } from 'remotion'
import * as THREE from 'three'
import { sampleLogoOutline } from '../../lib/logoGeometry'
import { COLOR } from '../../constants/theme'
import { SCENE, FPS } from '../../constants/timeline'
import { progress, ramp, CINEMA, DRIFT, hash } from '../../lib/easing'

const COUNT = 1400
/** How many of them are recruited into the logo (the rest stay as atmosphere). */
const ASSEMBLERS = 900

export default function MetallicDust() {
  const frame = useCurrentFrame()
  const t = frame / FPS
  const ref = useRef<THREE.InstancedMesh>(null)

  const targets = useMemo(() => sampleLogoOutline(ASSEMBLERS), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Free-drift home position for every particle (a loose shell around origin).
  const homes = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => {
        const th = hash(i * 1.7) * Math.PI * 2
        const ph = Math.acos(2 * hash(i * 4.3) - 1)
        const r = 3.1 + hash(i * 8.9) * 5.4
        return new THREE.Vector3(
          Math.sin(ph) * Math.cos(th) * r,
          Math.sin(ph) * Math.sin(th) * r * 0.72,
          Math.cos(ph) * r * 0.85 - 1.2,
        )
      }),
    [],
  )

  // Dust appears with the first light, streams into the mark, then the
  // survivors thin out so the metal is never fighting a snowstorm.
  const emerge = progress(frame, 1.6, 5.2, CINEMA)
  const gather = progress(frame, SCENE.assemble.from + 0.3, SCENE.assemble.to - 0.9, CINEMA)
  const thin = ramp(frame, SCENE.assemble.to - 0.6, SCENE.seat.from + 1.4, 1, 0.34, CINEMA)
  // Scene 5: particles are released again as each verb dissolves.
  const release = ramp(frame, SCENE.words.from, SCENE.words.to, 0, 1, DRIFT)
  // Scene 6: clear the air. A field this dense over the endplate reads as
  // snow and fights the wordmark — the last shot must be still and quiet.
  const settle = ramp(frame, SCENE.signoff.from - 0.6, SCENE.signoff.from + 2.4, 1, 0.12, CINEMA)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return

    for (let i = 0; i < COUNT; i++) {
      const home = homes[i]
      // Slow independent orbit so the field never feels frozen.
      const sp = 0.06 + hash(i * 2.1) * 0.14
      const wob = new THREE.Vector3(
        Math.sin(t * sp + hash(i) * 6.28) * 0.42,
        Math.cos(t * sp * 0.83 + hash(i * 3.7) * 6.28) * 0.36,
        Math.sin(t * sp * 0.61 + hash(i * 5.9) * 6.28) * 0.3,
      )
      const drifting = home.clone().add(wob)

      let pos = drifting
      if (i < ASSEMBLERS) {
        const target = targets[i]
        // Per-particle stagger so the silhouette fills in progressively.
        const own = Math.min(1, Math.max(0, (gather - hash(i * 6.1) * 0.34) / 0.66))
        const eased = own * own * (3 - 2 * own)
        // …and let them scatter back out under the verbs.
        const back = release * (0.35 + hash(i * 7.7) * 0.65)
        const k = Math.max(0, eased - back)
        pos = drifting.clone().lerp(target, k)
      }

      dummy.position.copy(pos)

      const near = i < ASSEMBLERS ? gather : 0
      const base = 0.012 + hash(i * 9.3) * 0.026
      const scale =
        base *
        emerge *
        settle *
        (i < ASSEMBLERS ? 1 : thin) *
        // Assembled particles shrink as the solid geometry takes over, so the
        // silhouette doesn't double up and read fuzzy.
        (1 - near * 0.72)

      dummy.scale.setScalar(Math.max(0.0001, scale))
      dummy.rotation.set(t * sp * 2.2, t * sp * 1.7, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      {/* Octahedron: reads as a metal fleck rather than a soft sprite blob. */}
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color={COLOR.titaniumLift}
        metalness={0.95}
        roughness={0.34}
        emissive={new THREE.Color(COLOR.light)}
        emissiveIntensity={0.35}
        transparent
        opacity={0.92}
      />
    </instancedMesh>
  )
}
