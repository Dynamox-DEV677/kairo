/**
 * The mark, as an engineered metal part.
 *
 * Three separately-animated extrusions (orbit ring / mortarboard / swoosh) share
 * one brushed-titanium material. During the assemble each element travels in on
 * its own delay and its material cross-fades from emissive white "energy" into
 * physical metal — the transition the brief asks for, done on the material
 * rather than as a dissolve between two objects.
 */
import { useMemo } from 'react'
import { useCurrentFrame } from 'remotion'
import * as THREE from 'three'
import { buildLogoGeometries } from '../../lib/logoGeometry'
import { COLOR, MATERIAL } from '../../constants/theme'
import { SCENE, FPS } from '../../constants/timeline'
import { progress, ramp, CINEMA, DRIFT, microDrift, hash } from '../../lib/easing'

/** Per-element arrival offsets (seconds). Ring lands first and anchors the frame. */
const ARRIVE_DELAY = [0, 0.55, 1.05]

interface Props {
  /** Set false during the interior pass so we can hide the shell we flew through. */
  visible?: boolean
}

export default function TitaniumLogo({ visible = true }: Props) {
  const frame = useCurrentFrame()
  const t = frame / FPS
  const geos = useMemo(() => buildLogoGeometries(), [])

  // 0 → 1 across the assemble: 0 = incoming energy, 1 = seated metal.
  const solidify = progress(frame, SCENE.assemble.from + 1.2, SCENE.assemble.to - 0.4, CINEMA)

  // A slow continuous yaw. Never stops, never speeds up — the film's heartbeat.
  const baseYaw = ramp(frame, 0, SCENE.signoff.to, -0.55, 0.42, DRIFT)
  const drift = microDrift(frame, 3.1, 0.022)

  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(COLOR.titanium),
        metalness: MATERIAL.metalness,
        roughness: MATERIAL.roughness,
        clearcoat: MATERIAL.clearcoat,
        clearcoatRoughness: MATERIAL.clearcoatRoughness,
        envMapIntensity: MATERIAL.envMapIntensity,
        emissive: new THREE.Color(COLOR.light),
      }),
    [],
  )

  // Energy → metal. Emissive falls away as roughness/metalness come up, so the
  // part appears to *cool* into titanium instead of simply changing colour.
  material.emissiveIntensity = (1 - solidify) * 2.6
  material.metalness = 0.25 + solidify * (MATERIAL.metalness - 0.25)
  material.roughness = 0.06 + solidify * (MATERIAL.roughness - 0.06)
  material.color.set(COLOR.titanium).lerp(new THREE.Color(COLOR.light), 1 - solidify)

  if (!visible) return null

  return (
    <group rotation={[drift.y * 0.5, baseYaw + drift.x, 0]}>
      {geos.map((geo, i) => {
        const delay = ARRIVE_DELAY[i % ARRIVE_DELAY.length]
        const arrive = progress(
          frame,
          SCENE.assemble.from + 0.9 + delay,
          SCENE.assemble.from + 3.6 + delay,
          CINEMA,
        )

        // Each element flies in from its own vector, decelerating hard.
        const dir = hash(i * 12.7) * Math.PI * 2
        const dist = (1 - arrive) * (2.4 + hash(i * 3.3) * 1.6)
        const spin = (1 - arrive) * (0.5 + hash(i * 9.1) * 0.7)

        // Post-seat, the ring counter-rotates a hair against the group yaw so the
        // logo reads as an assembly of parts rather than one rigid block.
        const idle = i === 0 ? Math.sin(t * 0.19) * 0.028 : Math.sin(t * 0.13 + i) * 0.014

        return (
          <mesh
            key={i}
            geometry={geo}
            material={material}
            position={[Math.cos(dir) * dist, Math.sin(dir) * dist, -dist * 0.4]}
            rotation={[spin * 0.8, spin, spin * 0.35 + idle]}
            castShadow
            receiveShadow
          />
        )
      })}
    </group>
  )
}
