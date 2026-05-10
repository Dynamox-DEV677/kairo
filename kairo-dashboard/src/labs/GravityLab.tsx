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
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Grid, useGLTF, Html } from '@react-three/drei'
import LabShell from './LabShell'
import * as THREE from 'three'

// jsDelivr CDN — keeps GLBs out of the Vercel build pipeline.
const TREE_MODEL_URL  = 'https://cdn.jsdelivr.net/gh/Dynamox-DEV677/kairo@main/models-cdn/maple_tree.glb'
const APPLE_MODEL_URL = 'https://cdn.jsdelivr.net/gh/Dynamox-DEV677/kairo@main/models-cdn/red_apple.glb'
const TREE_HEIGHT = 6
const APPLE_BRANCH_Y_OFFSET = 0.5  // apple sits slightly inside the foliage

/** Clone a GLB scene and uniformly scale it so its longest axis equals targetSize. */
function useFittedClone(url: string, targetSize: number) {
  const { scene } = useGLTF(url)
  return useMemo(() => {
    const cloned = scene.clone(true)
    cloned.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
    const box = new THREE.Box3().setFromObject(cloned)
    const size = new THREE.Vector3()
    box.getSize(size)
    const longest = Math.max(size.x, size.y, size.z) || 1
    const factor = targetSize / longest
    cloned.scale.setScalar(factor)
    // Re-center on origin so the base of the tree is at y=0 / apple at center
    box.setFromObject(cloned)
    const center = new THREE.Vector3()
    box.getCenter(center)
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
    <Canvas
      shadows
      camera={{ position: [10, 6, 10], fov: 50 }}
      style={{ background: 'linear-gradient(180deg, #0a0a18 0%, #0a0a0a 60%, #1a1a2e 100%)' }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[8, 12, 5]}
        intensity={1.2}
        color="#a5b4fc"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-5, 3, -5]} intensity={0.4} color="#7c3aed" />

      {/* Stars background — atmospheric */}
      <Stars radius={50} depth={30} count={1500} factor={3} saturation={0} fade speed={0.3} />

      {/* Ground */}
      <Ground />

      <Suspense fallback={<LoaderChip />}>
        {/* Tree (left side) — real maple GLB */}
        <Tree treeHeight={params.start_height} />

        {/* Falling apple — real apple GLB */}
        <FallingApple
          gravity={params.gravity}
          airDrag={params.air_drag}
          startHeight={params.start_height}
          playing={playing}
        />
      </Suspense>

      {/* Drop guide */}
      <DropGuide startHeight={params.start_height} />

      {/* Camera controls — touch/mouse */}
      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={30}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
      />
    </Canvas>
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
        sectionSize={5} sectionThickness={1} sectionColor="#3f3f46"
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
        background: 'rgba(13,13,13,0.85)', border: '1px solid rgba(99,102,241,0.4)',
        borderRadius: 10, padding: '8px 14px', fontFamily: 'inherit',
        fontSize: 11, color: '#a5b4fc', whiteSpace: 'nowrap',
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
  const meshRef = useRef<THREE.Mesh>(null)
  const trailRef = useRef<{ y: number }>({ y: startHeight })
  const stateRef = useRef({ y: startHeight, v: 0, time: 0 })

  // Reset when params change
  useEffect(() => {
    stateRef.current = { y: startHeight, v: 0, time: 0 }
    trailRef.current.y = startHeight
  }, [startHeight, gravity, airDrag])

  useFrame((_, delta) => {
    if (!playing) return
    const dt = Math.min(delta, 0.05)
    const s = stateRef.current

    // Stop when on ground (apple radius ~ 0.25)
    if (s.y <= 0.25) {
      s.y = 0.25; s.v = 0
      // Auto-restart loop after 1.5s rest
      s.time += dt
      if (s.time > 2.0) {
        stateRef.current = { y: startHeight, v: 0, time: 0 }
      }
      if (meshRef.current) meshRef.current.position.y = s.y
      return
    }

    // a = g - airDrag * v (simplified linear drag)
    const accel = gravity - airDrag * s.v
    s.v += accel * dt
    s.y -= s.v * dt
    s.time += dt
    if (s.y < 0.25) s.y = 0.25

    if (meshRef.current) {
      meshRef.current.position.y = s.y
      // tiny x wobble for visual life
      meshRef.current.rotation.x += s.v * dt * 0.3
    }
  })

  // Real apple GLB, scaled so it's roughly fist-sized in scene units.
  const { cloned } = useFittedClone(APPLE_MODEL_URL, 0.55)

  return (
    <group ref={meshRef as any} position={[-3, startHeight, 0]}>
      <primitive object={cloned} />
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
          <meshBasicMaterial color="#a5b4fc" transparent opacity={0.4} />
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
      border: '1px solid rgba(99,102,241,0.3)',
      fontFamily: 'Consolas, monospace', fontSize: 11,
      color: '#a5b4fc', minWidth: 130,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: '#71717a' }}>velocity</span>
        <span style={{ color: '#fafafa', fontWeight: 700 }}>{readout.v.toFixed(2)} m/s</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: '#71717a' }}>height</span>
        <span style={{ color: '#fafafa', fontWeight: 700 }}>{readout.y.toFixed(2)} m</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#71717a' }}>time</span>
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
