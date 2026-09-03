/**
 * Scene 4 — the interior.
 *
 * Deliberate creative call: NO literal floating books, notebooks or holograms.
 * Rendered in WebGL those read as 2010 screensaver, which would break the
 * brief's own "no clichés / must feel expensive" rule. Instead the inside of the
 * mark is an architectural lattice — machined nodes wired together, resolving
 * out of the dark as the camera passes through. It reads as structured knowledge
 * without ever illustrating a book.
 *
 * Nodes sit on a deterministic 3D lace so the structure looks designed rather
 * than scattered, and only near-neighbour pairs are wired.
 */
import { useMemo, useRef, useLayoutEffect } from 'react'
import { useCurrentFrame } from 'remotion'
import * as THREE from 'three'
import { COLOR } from '../../constants/theme'
import { SCENE, FPS } from '../../constants/timeline'
import { progress, envelope, CINEMA, hash } from '../../lib/easing'

const NODES = 150
const MAX_LINKS = 210
const LINK_DIST = 2.05
/** The lattice lives behind the mark, along the camera's flight path. */
const DEPTH_FROM = -2.2
const DEPTH_TO = -16.0

export default function KnowledgeLattice() {
  const frame = useCurrentFrame()
  const t = frame / FPS
  const nodeRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  /** Deterministic node cloud, biased into a corridor the camera flies down. */
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < NODES; i++) {
      const zt = i / NODES
      const z = DEPTH_FROM + (DEPTH_TO - DEPTH_FROM) * zt
      // radius widens with depth so the corridor opens up as we travel
      const r = 0.75 + zt * 3.5 + hash(i * 5.1) * 1.15
      const a = hash(i * 2.7) * Math.PI * 2 + zt * 2.4
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.78, z + (hash(i * 8.3) - 0.5) * 0.9))
    }
    return pts
  }, [])

  /** Wire only near neighbours — a fully-connected graph looks like noise. */
  const linkGeometry = useMemo(() => {
    const verts: number[] = []
    let made = 0
    for (let i = 0; i < points.length && made < MAX_LINKS; i++) {
      for (let j = i + 1; j < points.length && made < MAX_LINKS; j++) {
        if (points[i].distanceTo(points[j]) < LINK_DIST) {
          verts.push(points[i].x, points[i].y, points[i].z, points[j].x, points[j].y, points[j].z)
          made++
        }
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    return g
  }, [points])

  // The lattice only exists while we're inside — it resolves in, holds under the
  // verbs, and is gone before the endplate.
  const alive = envelope(frame, SCENE.interior.from - 0.4, SCENE.words.to + 0.5, 1.5, 1.2)
  const build = progress(frame, SCENE.interior.from - 0.2, SCENE.interior.to + 0.6, CINEMA)

  useLayoutEffect(() => {
    const mesh = nodeRef.current
    if (!mesh) return
    for (let i = 0; i < NODES; i++) {
      const p = points[i]
      // per-node stagger, front of the corridor resolves first
      const own = Math.min(1, Math.max(0, (build - (i / NODES) * 0.55) / 0.45))
      const e = own * own * (3 - 2 * own)
      const breathe = 1 + Math.sin(t * 0.5 + hash(i) * 6.28) * 0.16
      dummy.position.set(p.x, p.y, p.z)
      dummy.scale.setScalar(Math.max(0.0001, 0.032 * e * breathe * alive))
      dummy.rotation.set(t * 0.12 + hash(i) * 3, t * 0.09, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  if (alive < 0.001) return null

  return (
    <group>
      <instancedMesh ref={nodeRef} args={[undefined, undefined, NODES]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={COLOR.titaniumLift}
          metalness={0.92}
          roughness={0.3}
          emissive={new THREE.Color(COLOR.light)}
          emissiveIntensity={0.5}
        />
      </instancedMesh>

      {/* Filaments. Additive + very low opacity so they glow without hazing. */}
      <lineSegments geometry={linkGeometry}>
        <lineBasicMaterial
          color={COLOR.coldBounce}
          transparent
          opacity={0.20 * alive * build}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  )
}
