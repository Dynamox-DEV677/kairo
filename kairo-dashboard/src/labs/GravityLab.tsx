/**
 * Gravity Lab — Tree, apple, gravity. Student plays with G, mass, drag.
 *
 * R3F scene:
 *   - Ground plane with grid
 *   - Tree (trunk cylinder + foliage sphere)
 *   - Apple (sphere) starts on a branch and falls when playing
 *   - Vertical white guide line showing fall distance
 *   - HUD overlay (top-left) showing live velocity + fall time
 *
 * Bound to LabShell sliders:
 *   gravity     — 0 to 25 m/s² (Earth = 9.8, Moon = 1.62)
 *   mass        — 0.1 to 5 kg  (informational; doesn't affect motion)
 *   air_drag    — 0 (vacuum) to 1 (heavy resistance)
 *   start_height — 4 to 14 m
 */
import { Suspense, useState, useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, useGLTF, Html, Line } from '@react-three/drei'
import LabShell from './LabShell'
import LabScene from './LabScene'
import * as THREE from 'three'

// jsDelivr CDN — keeps GLBs out of the Vercel build pipeline.
const TREE_MODEL_URL  = 'https://cdn.jsdelivr.net/gh/Dynamox-DEV677/kairo@main/models-cdn/maple_tree.glb'
const APPLE_MODEL_URL = 'https://cdn.jsdelivr.net/gh/Dynamox-DEV677/kairo@main/models-cdn/red_apple.glb'
const TREE_HEIGHT = 6
const APPLE_BRANCH_Y_OFFSET = 0.5  // apple sits slightly inside the foliage

/** Clone a GLB scene and uniformly scale it so its longest VISIBLE axis
 *  equals targetSize. Bounds are computed from meshes only — rigged models
 *  often have invisible bones/empties that inflate Box3.setFromObject() and
 *  produce a fit-factor tiny enough to make the model a speck. */
function useFittedClone(url: string, targetSize: number) {
  const { scene } = useGLTF(url)
  return useMemo(() => {
    const cloned = scene.clone(true)
    cloned.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })

    // Mesh-only bounds
    const meshBox = new THREE.Box3()
    let meshCount = 0
    cloned.traverse((o: any) => {
      if (o.isMesh && o.geometry) {
        meshBox.union(new THREE.Box3().setFromObject(o))
        meshCount++
      }
    })
    const box = meshCount > 0 ? meshBox : new THREE.Box3().setFromObject(cloned)
    const size = new THREE.Vector3()
    box.getSize(size)
    const longest = Math.max(size.x, size.y, size.z) || 1
    const factor = targetSize / longest
    cloned.scale.setScalar(factor)

    // Re-center on origin using mesh-only bounds again, post-scale.
    const scaledBox = new THREE.Box3()
    cloned.traverse((o: any) => {
      if (o.isMesh && o.geometry) scaledBox.union(new THREE.Box3().setFromObject(o))
    })
    const center = new THREE.Vector3()
    scaledBox.getCenter(center)
    cloned.position.sub(center)
    return { cloned, fittedSize: size.clone().multiplyScalar(factor) }
  }, [scene, targetSize])
}

interface SimProps {
  params: {
    gravity:      number
    mass:         number
    air_drag:     number
    start_height: number
  }
  playing: boolean
}

function GravitySim({ params, playing }: SimProps) {
  return (
    <LabScene cameraPos={[10, 6, 10]} cameraFov={50} tint="#1a1a2e" particles={60}>
      {/* Ground */}
      <Ground />

      <Suspense fallback={<LoaderChip />}>
        <Tree treeHeight={params.start_height} />
        <FallingApple
          gravity={params.gravity}
          airDrag={params.air_drag}
          startHeight={params.start_height}
          playing={playing}
        />
      </Suspense>

      {/* Drop guide with metre markers */}
      <DropGuide startHeight={params.start_height} />

      {/* Camera controls — touch/mouse */}
      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={30}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
      />
    </LabScene>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────
function Ground() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.95} />
      </mesh>
      <Grid
        position={[0, 0.001, 0]}
        args={[40, 40]}
        cellSize={1} cellThickness={0.5} cellColor="#27272a"
        sectionSize={5} sectionThickness={1} sectionColor="#4B5563"
        fadeDistance={30} fadeStrength={1.5}
        infiniteGrid
      />
    </>
  )
}

function LoaderChip() {
  return (
    <Html center>
      <div style={{
        background: 'rgba(13,13,13,0.85)', border: '1px solid rgba(79, 124, 255, 0.4)',
        borderRadius: 10, padding: '8px 14px', fontFamily: 'inherit',
        fontSize: 11, color: '#A5B4FC', whiteSpace: 'nowrap',
      }}>
        Loading scene…
      </div>
    </Html>
  )
}

function Tree({ treeHeight }: { treeHeight: number }) {
  // Fit the maple GLB so its longest axis matches the chosen tree height,
  // then ground it (base at y=0).
  const { cloned, fittedSize } = useFittedClone(TREE_MODEL_URL, treeHeight)
  // useFittedClone centered the model on origin → lift it so its base sits on the ground
  cloned.position.y += fittedSize.y / 2

  return (
    <group position={[-3, 0, 0]}>
      <primitive object={cloned} />
    </group>
  )
}

function FallingApple({ gravity, airDrag, startHeight, playing }: {
  gravity: number; airDrag: number; startHeight: number; playing: boolean
}) {
  const meshRef  = useRef<THREE.Group>(null)
  const velRef   = useRef<THREE.Group>(null)   // velocity arrow group
  const gravRef  = useRef<THREE.Group>(null)   // gravity force arrow group (always points down)
  const stateRef = useRef({ y: startHeight, v: 0, time: 0 })

  // Motion-trail state: keep the last N (y) positions as little ghosts.
  const TRAIL_LEN = 10
  const trailRefs = useRef<Array<THREE.Mesh | null>>(Array(TRAIL_LEN).fill(null))
  const trailHist = useRef<number[]>(Array(TRAIL_LEN).fill(startHeight))

  // Reset when params change
  useEffect(() => {
    stateRef.current = { y: startHeight, v: 0, time: 0 }
    trailHist.current = Array(TRAIL_LEN).fill(startHeight)
  }, [startHeight, gravity, airDrag])

  useFrame((_, delta) => {
    if (!playing) return
    const dt = Math.min(delta, 0.05)
    const s = stateRef.current

    if (s.y <= 0.25) {
      s.y = 0.25; s.v = 0
      s.time += dt
      if (s.time > 2.0) {
        stateRef.current = { y: startHeight, v: 0, time: 0 }
        trailHist.current = Array(TRAIL_LEN).fill(startHeight)
      }
    } else {
      const accel = gravity - airDrag * s.v
      s.v += accel * dt
      s.y -= s.v * dt
      s.time += dt
      if (s.y < 0.25) s.y = 0.25
    }

    if (meshRef.current) {
      meshRef.current.position.y = s.y
      meshRef.current.rotation.x += s.v * dt * 0.3
    }

    // Shift trail history every other frame for a smoother look
    trailHist.current.unshift(s.y)
    trailHist.current.pop()
    trailRefs.current.forEach((m, i) => {
      if (m) {
        m.position.y = trailHist.current[i] ?? s.y
        // Fade out — older positions are smaller + more transparent
        const t = 1 - i / TRAIL_LEN
        m.scale.setScalar(0.35 + t * 0.65)
        const mat = m.material as THREE.MeshBasicMaterial
        if (mat) mat.opacity = t * 0.45
      }
    })

    // Velocity arrow: length proportional to v, points downward (the apple
    // is falling), capped at a sensible visual scale.
    if (velRef.current) {
      const vLen = Math.min(Math.abs(s.v) * 0.08, 1.4)
      velRef.current.scale.y = vLen
      velRef.current.position.y = s.y - 0.25 - vLen / 2
      velRef.current.visible = vLen > 0.05
    }
    // Gravity arrow: constant length (it's not changing in this sim),
    // sits to the right of the apple, always pointing down.
    if (gravRef.current) {
      gravRef.current.position.y = s.y
      // Hide when on the ground
      gravRef.current.visible = s.y > 0.4
    }
  })

  // Real apple GLB, scaled so it's roughly fist-sized in scene units.
  const { cloned } = useFittedClone(APPLE_MODEL_URL, 0.55)

  return (
    <group position={[-3, 0, 0]}>
      {/* Motion-trail ghosts — small spheres at past positions */}
      {Array.from({ length: TRAIL_LEN }).map((_, i) => (
        <mesh key={i} ref={el => { trailRefs.current[i] = el }} position={[0, startHeight, 0]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0} />
        </mesh>
      ))}

      {/* The apple itself */}
      <group ref={meshRef} position={[0, startHeight, 0]}>
        <primitive object={cloned} />
      </group>

      {/* Velocity arrow — magnitude follows v, points down */}
      <group ref={velRef} position={[0, startHeight, 0]}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 1, 12]} />
          <meshStandardMaterial color="#C7D2E8" emissive="#C7D2E8" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0, -0.55, 0]}>
          <coneGeometry args={[0.15, 0.3, 12]} rotation={[Math.PI, 0, 0]} />
          <meshStandardMaterial color="#C7D2E8" emissive="#C7D2E8" emissiveIntensity={0.6} />
        </mesh>
        <Html position={[0.35, -0.1, 0]} center>
          <div style={{
            background: 'rgba(13,13,13,0.85)', padding: '2px 6px', borderRadius: 4,
            fontFamily: 'monospace', fontSize: 9, color: '#C7D2E8', whiteSpace: 'nowrap',
            border: '1px solid rgba(199, 210, 232, 0.4)', pointerEvents: 'none',
          }}>v</div>
        </Html>
      </group>

      {/* Gravity arrow — constant, to the right of the apple */}
      <group ref={gravRef} position={[0.7, startHeight, 0]}>
        <mesh>
          <cylinderGeometry args={[0.04, 0.04, 0.9, 12]} />
          <meshStandardMaterial color="#ec4899" emissive="#ec4899" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0, -0.5, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.13, 0.26, 12]} />
          <meshStandardMaterial color="#ec4899" emissive="#ec4899" emissiveIntensity={0.5} />
        </mesh>
        <Html position={[0.25, -0.05, 0]} center>
          <div style={{
            background: 'rgba(13,13,13,0.85)', padding: '2px 6px', borderRadius: 4,
            fontFamily: 'monospace', fontSize: 9, color: '#ec4899', whiteSpace: 'nowrap',
            border: '1px solid rgba(236,72,153,0.4)', pointerEvents: 'none',
          }}>g</div>
        </Html>
      </group>
    </group>
  )
}

function DropGuide({ startHeight }: { startHeight: number }) {
  return (
    <group position={[-3, 0, 0]}>
      {/* Vertical thin line */}
      <mesh position={[0, startHeight / 2, 0]}>
        <cylinderGeometry args={[0.005, 0.005, startHeight, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.15} />
      </mesh>
      {/* Markers every 1m */}
      {Array.from({ length: Math.floor(startHeight) + 1 }).map((_, i) => (
        <mesh key={i} position={[0.15, i, 0]}>
          <boxGeometry args={[0.15, 0.02, 0.02]} />
          <meshBasicMaterial color="#A5B4FC" transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  )
}

// ─── Live HUD overlay (computed outside R3F since it'd remount the canvas) ──
function LiveHUD({ params, playing }: SimProps) {
  const [readout, setReadout] = useState({ v: 0, y: params.start_height, t: 0 })
  const stateRef = useRef({ y: params.start_height, v: 0, t: 0 })
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    stateRef.current = { y: params.start_height, v: 0, t: 0 }
    setReadout({ v: 0, y: params.start_height, t: 0 })
  }, [params.start_height, params.gravity, params.air_drag])

  useEffect(() => {
    let last = performance.now()
    function tick(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      if (playing) {
        const s = stateRef.current
        if (s.y > 0.25) {
          s.v += (params.gravity - params.air_drag * s.v) * dt
          s.y -= s.v * dt
          s.t += dt
          if (s.y < 0.25) s.y = 0.25
        } else {
          // hit the ground — pause readout
        }
      }
      setReadout({ v: stateRef.current.v, y: stateRef.current.y, t: stateRef.current.t })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [playing, params.gravity, params.air_drag])

  return (
    <div style={{
      position: 'absolute', top: 12, left: 12, zIndex: 5,
      padding: '10px 14px', borderRadius: 9,
      background: 'rgba(13,13,13,0.85)', backdropFilter: 'blur(10px)',
      border: '1px solid rgba(79, 124, 255, 0.3)',
      fontFamily: 'Consolas, monospace', fontSize: 11,
      color: '#A5B4FC', minWidth: 130,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: '#9CA3AF' }}>velocity</span>
        <span style={{ color: '#fafafa', fontWeight: 700 }}>{readout.v.toFixed(2)} m/s</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: '#9CA3AF' }}>height</span>
        <span style={{ color: '#fafafa', fontWeight: 700 }}>{readout.y.toFixed(2)} m</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#9CA3AF' }}>time</span>
        <span style={{ color: '#fafafa', fontWeight: 700 }}>{readout.t.toFixed(2)} s</span>
      </div>
    </div>
  )
}

// ─── Wrapped Sim with the HUD ──────────────────────────────────────────────
function GravitySimWrapped(props: SimProps) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <GravitySim {...props} />
      <LiveHUD {...props} />
    </div>
  )
}

// ─── Top-level page ────────────────────────────────────────────────────────
// Kick off downloads early so the lab opens fast.
useGLTF.preload(TREE_MODEL_URL)
useGLTF.preload(APPLE_MODEL_URL)

export default function GravityLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Gravity & Free Fall"
      subject="Physics"
      topic="Newton's Laws · Class 9-11"
      description="Watch an apple fall from a tree. Tweak gravity, air resistance, and starting height — the AI explanation updates live to match what you see."
      Sim={GravitySimWrapped}
      defaultParams={{ gravity: 9.8, mass: 0.2, air_drag: 0.0, start_height: 6 }}
      controls={[
        { key: 'gravity',      label: 'Gravity',      type: 'slider', value: 9.8, min: 0, max: 25,  step: 0.1, unit: 'm/s²' },
        { key: 'air_drag',     label: 'Air drag',     type: 'slider', value: 0.0, min: 0, max: 1,   step: 0.05 },
        { key: 'mass',         label: 'Apple mass',   type: 'slider', value: 0.2, min: 0.1, max: 5, step: 0.1, unit: 'kg' },
        { key: 'start_height', label: 'Drop height',  type: 'slider', value: 6,   min: 2, max: 14,  step: 0.5, unit: 'm' },
      ]}
      aiPrompt={p => `Simulation: an apple of mass ${p.mass} kg is falling from a tree branch at height ${p.start_height} m on a planet with gravitational acceleration ${p.gravity} m/s² (Earth is 9.8). Air drag coefficient is ${p.air_drag} (0 = vacuum). Explain what's happening in this simulation, the relevant Newtonian physics, why mass doesn't change the fall time in vacuum, and what real-world examples match these conditions.`}
      onBack={onBack}
    />
  )
}
