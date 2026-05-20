/**
 * Saturn V Lab — the rocket that took humans to the Moon.
 *
 * The Sketchfab GLB has only one material (so no material-name routing),
 * so we lay invisible click-boxes over each stage along the rocket's Y axis.
 * Click a stage → side info card explains what it did.
 */
import { Suspense, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, useGLTF, ContactShadows, Html } from '@react-three/drei'
import { AnimatePresence } from 'framer-motion'
import * as THREE from 'three'
import LabShell from './LabShell'
import LabScene from './LabScene'
import { PartInfoCard, PartHoverChip, PartIdleHint, type PartCatalog } from './LabKit'

const SATURN_V_URL = 'https://cdn.jsdelivr.net/gh/Dynamox-DEV677/kairo@main/models-cdn/saturn_v.glb'
const TARGET_SIZE = 8.5

// ─── Stage catalog ──────────────────────────────────────────────────────────
const PARTS: PartCatalog = {
  f1_engines: {
    id: 'f1_engines', label: 'F-1 Engines (×5)', color: '#f97316',
    function: 'Five F-1 engines, each burning 2,500 kg of kerosene + liquid oxygen per second to produce 6.7 million pounds of thrust at liftoff.',
    whyItMatters: 'The most powerful single-chamber engines ever built. Each one produced more thrust than the entire Space Shuttle main engine cluster.',
    analogy: 'Imagine the combined power of 30 jumbo jets pointing straight down.',
    related: ['Combustion', 'Newton\'s third law', 'Specific impulse'],
  },
  s_ic: {
    id: 's_ic', label: 'S-IC First Stage', color: '#4F7CFF',
    function: 'The 42-metre tall first stage. Burned for 2 minutes 41 seconds, lifting the entire 2,800-tonne stack to 67 km altitude before separating.',
    whyItMatters: 'Solving the "tyranny of the rocket equation" — most of the rocket\'s mass is fuel just to lift the rest of the fuel.',
    analogy: 'The freight train that gets the moon-mission out of Earth\'s thickest air.',
    related: ['Rocket equation', 'Staging', 'Kerosene (RP-1)'],
  },
  s_ii: {
    id: 's_ii', label: 'S-II Second Stage', color: '#fcd34d',
    function: 'Liquid-hydrogen + liquid-oxygen second stage. Burned for 6 minutes, pushing the stack from 67 km to 185 km — the edge of space.',
    whyItMatters: 'Liquid hydrogen is harder to handle than kerosene but gives much more thrust per kg of fuel — the trade-off that made the Moon shot possible.',
    analogy: 'The high-efficiency middle gear of the rocket\'s transmission.',
    related: ['Liquid hydrogen', 'Cryogenic fuel', 'Vacuum-optimised nozzles'],
  },
  s_ivb: {
    id: 's_ivb', label: 'S-IVB Third Stage', color: '#fde047',
    function: 'Did two burns. First: a 2.5-min burn to reach Earth orbit. Second: a 5.5-min burn to push Apollo onto a trajectory toward the Moon (Trans-Lunar Injection).',
    whyItMatters: 'The "reignitable" stage — the engine that left Earth\'s orbit and aimed for the Moon.',
    analogy: 'The slingshot that launches Apollo across the void.',
    related: ['Trans-lunar injection', 'Orbital mechanics', 'J-2 engine'],
  },
  apollo: {
    id: 'apollo', label: 'Apollo Spacecraft', color: '#a3e635',
    function: 'The Command Module (3 astronauts), Service Module (propulsion + supplies), and stowed Lunar Module — what actually went to the Moon and back.',
    whyItMatters: 'Everything below this point existed only to get this part to lunar orbit. The crew rode here for 8 days.',
    analogy: 'The passenger cabin of a rocket the size of a 36-storey building.',
    related: ['Command Module', 'Lunar Module', 'Heat shield'],
  },
  les: {
    id: 'les', label: 'Launch Escape System', color: '#ef4444',
    function: 'A solid-fuel rocket tower mounted on the very top. If the Saturn V failed during launch, this would yank the Command Module away to safety.',
    whyItMatters: 'A "fire alarm + parachute" combined — the redundancy that protected the astronauts from a launch-pad disaster.',
    analogy: 'An ejector seat the size of a school bus.',
    related: ['Abort modes', 'Solid rocket motors', 'Astronaut safety'],
  },
}

// Stages laid out by *normalised* height (0 = bottom, 1 = top of the model).
// The GLB is fit to TARGET_SIZE on the Y axis after centering, so these ranges
// translate directly into world-space click-boxes.
type StageBox = { id: string; from: number; to: number }
const STAGES: StageBox[] = [
  { id: 'f1_engines', from: 0.00, to: 0.06 },
  { id: 's_ic',       from: 0.06, to: 0.42 },
  { id: 's_ii',       from: 0.42, to: 0.66 },
  { id: 's_ivb',      from: 0.66, to: 0.80 },
  { id: 'apollo',     from: 0.80, to: 0.93 },
  { id: 'les',        from: 0.93, to: 1.00 },
]

interface SimProps {
  params: { rotate: boolean }
  playing: boolean
}

function SaturnVSim({ playing }: SimProps) {
  const [hovered,  setHovered]  = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <LabScene cameraPos={[0, 1, 9]} cameraFov={48} tint="#0a0a1a" fogColor="#000010" particles={45} stars>
        <Suspense fallback={<RocketFallback />}>
          <Rocket
            playing={playing}
            hovered={hovered}
            selected={selected}
            onHover={setHovered}
            onSelect={setSelected}
          />
        </Suspense>
        <ContactShadows position={[0, -4.5, 0]} opacity={0.4} scale={12} blur={2.6} far={5} />
        <OrbitControls enablePan={false} minDistance={6} maxDistance={22}
          autoRotate={playing && !hovered && !selected} autoRotateSpeed={0.6}
          minPolarAngle={Math.PI / 6} maxPolarAngle={Math.PI - Math.PI / 6} />
      </LabScene>

      <PartHoverChip hovered={hovered} selected={selected} catalog={PARTS} />
      <PartIdleHint hovered={hovered} selected={selected} hint="Click any stage of the rocket — engines, fuel tanks, Apollo, or escape tower" />
      <AnimatePresence>
        {selected && PARTS[selected] && (
          <PartInfoCard part={PARTS[selected]} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function RocketFallback() {
  return (
    <Html center>
      <div style={{
        background: 'rgba(13,13,13,0.85)', border: '1px solid rgba(79, 124, 255, 0.14)',
        borderRadius: 10, padding: '10px 16px', fontFamily: 'inherit',
        fontSize: 12, color: '#4F7CFF', whiteSpace: 'nowrap',
      }}>
        Loading Saturn V…
      </div>
    </Html>
  )
}

function Rocket({ playing, hovered, selected, onHover, onSelect }: {
  playing: boolean
  hovered:  string | null
  selected: string | null
  onHover:  (id: string | null) => void
  onSelect: (id: string | null) => void
}) {
  const { scene } = useGLTF(SATURN_V_URL)
  const groupRef = useRef<THREE.Group>(null)

  // Clone, auto-orient (longest axis → Y), fit to TARGET_SIZE, center on origin.
  // This GLB has its long axis on Z (Sketchfab Maya/FBX export quirk) — without
  // this rotation the rocket renders lying on its side pointing at the camera.
  const { cloned, height, halfX } = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((obj: any) => {
      if (obj.isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
      }
    })

    // 1. Measure mesh-only bounds in source orientation.
    const meshBox = new THREE.Box3()
    let meshes = 0
    c.traverse((obj: any) => {
      if (obj.isMesh && obj.geometry) {
        meshBox.union(new THREE.Box3().setFromObject(obj))
        meshes++
      }
    })
    const sourceBox = meshes > 0 ? meshBox : new THREE.Box3().setFromObject(c)
    const srcSize = new THREE.Vector3()
    sourceBox.getSize(srcSize)

    // 2. Detect longest axis. If it's not Y, rotate so it becomes Y (up).
    //    Z-longest is common in Maya/FBX exports → rotate -90° around X.
    //    X-longest is rare but possible → rotate -90° around Z.
    if (srcSize.z > srcSize.y && srcSize.z > srcSize.x) {
      c.rotateX(-Math.PI / 2)        // +Z → +Y (stand up)
    } else if (srcSize.x > srcSize.y && srcSize.x > srcSize.z) {
      c.rotateZ(Math.PI / 2)         // +X → +Y
    }

    // 3. Re-measure after rotation, then fit + center.
    c.updateMatrixWorld(true)
    const rotatedBox = new THREE.Box3()
    c.traverse((obj: any) => {
      if (obj.isMesh && obj.geometry) rotatedBox.union(new THREE.Box3().setFromObject(obj))
    })
    const rotSize = new THREE.Vector3()
    rotatedBox.getSize(rotSize)
    const longest = Math.max(rotSize.x, rotSize.y, rotSize.z) || 1
    const factor = TARGET_SIZE / longest
    c.scale.setScalar(factor)

    // 4. Recompute, center on origin.
    c.updateMatrixWorld(true)
    const scaledBox = new THREE.Box3()
    c.traverse((obj: any) => {
      if (obj.isMesh && obj.geometry) scaledBox.union(new THREE.Box3().setFromObject(obj))
    })
    const center = new THREE.Vector3()
    scaledBox.getCenter(center)
    c.position.sub(center)

    const finalSize = new THREE.Vector3()
    scaledBox.getSize(finalSize)
    return { cloned: c, height: finalSize.y, halfX: Math.max(finalSize.x, finalSize.z) / 2 }
  }, [scene])

  // Gentle idle wobble when not auto-rotating
  useFrame((state) => {
    if (!groupRef.current || !playing) return
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.15) * 0.05
  })

  // Position the click-boxes along the rocket's Y axis using the STAGES table.
  // The rocket is centered on origin, so its Y range is [-height/2 .. +height/2].
  const yBottom = -height / 2
  const boxRadius = halfX * 1.8     // wider than the rocket so clicks always land

  return (
    <group ref={groupRef}>
      <primitive object={cloned} />

      {/* Per-stage clickable invisible boxes */}
      {STAGES.map(stage => {
        const yLo = yBottom + stage.from * height
        const yHi = yBottom + stage.to * height
        const yMid = (yLo + yHi) / 2
        const boxH = Math.max(yHi - yLo, 0.05)
        const isLit = hovered === stage.id || selected === stage.id

        return (
          <group key={stage.id} position={[0, yMid, 0]}>
            {/* Invisible hit volume — captures pointer events */}
            <mesh
              onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(stage.id); document.body.style.cursor='pointer' }}
              onPointerOut={() => { onHover(null); document.body.style.cursor='default' }}
              onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(stage.id) }}>
              <cylinderGeometry args={[boxRadius, boxRadius, boxH, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* Glow ring that appears when this stage is hovered or selected */}
            {isLit && (
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[halfX * 1.25, 0.04, 8, 48]} />
                <meshBasicMaterial color={PARTS[stage.id].color} transparent opacity={0.85} />
              </mesh>
            )}
            {isLit && (
              <mesh position={[halfX * 2.2, 0, 0]}>
                <sphereGeometry args={[0.07, 12, 12]} />
                <meshBasicMaterial color={PARTS[stage.id].color} />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}

useGLTF.preload(SATURN_V_URL)

export default function SaturnVLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Saturn V" subject="Space" topic="Rocketry · Class 9-12"
      description="The 111-metre rocket that took humans to the Moon. Click each stage to see what it did, from the F-1 engines at the base to the launch-escape tower at the tip."
      Sim={SaturnVSim}
      defaultParams={{ rotate: true }}
      controls={[
        { key: 'rotate', label: 'Auto-rotate', type: 'toggle', value: true },
      ]}
      aiPrompt={() => `The Saturn V rocket — the most powerful machine ever flown by humans. Walk through the five stages of an Apollo Moon mission: F-1 engines (kerosene + LOX), S-IC first stage, S-II second stage (liquid hydrogen), S-IVB third stage (Trans-Lunar Injection), Apollo Spacecraft (CM + SM + LM), and the Launch Escape System. Explain the rocket equation, why staging is needed, and why liquid hydrogen replaces kerosene in the upper stages.`}
      onBack={onBack}
    />
  )
}
