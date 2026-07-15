import { Suspense, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, useGLTF, ContactShadows, Html } from '@react-three/drei'
import { AnimatePresence } from 'framer-motion'
import * as THREE from 'three'
import LabShell from './LabShell'
import LabScene from './LabScene'
import { PartInfoCard, PartHoverChip, PartIdleHint, type PartCatalog } from './LabKit'

const BRAIN_URL = 'https://cdn.jsdelivr.net/gh/Dynamox-DEV677/kairo@main/models-cdn/brain_realistic.glb'
const TARGET_SIZE = 6.5

const PARTS: PartCatalog = {
  frontal: {
    id: 'frontal', label: 'Frontal Lobe', color: '#f87171',
    function: 'Plans, decides, reasons, controls voluntary movement and personality.',
    whyItMatters: 'The "CEO" of your brain — fully developed only by age 25, which is why teenagers are wired to take risks.',
    analogy: 'The chief executive office that runs the whole company.',
    related: ['Prefrontal cortex', 'Motor cortex', 'Broca\'s area (speech production)'],
  },
  parietal: {
    id: 'parietal', label: 'Parietal Lobe', color: '#A78BFA',
    function: 'Processes touch, temperature, pain, body position (proprioception) and spatial navigation.',
    whyItMatters: 'How you can walk through a dark room without bumping things — this lobe keeps a 3D map of your body and surroundings.',
    analogy: 'The "sensory dashboard" of the brain.',
    related: ['Somatosensory cortex', 'Spatial reasoning', 'Number sense'],
  },
  temporal: {
    id: 'temporal', label: 'Temporal Lobe', color: '#34d399',
    function: 'Hears, processes language, recognises faces, and forms long-term memories (hippocampus is buried inside it).',
    whyItMatters: 'Damage to your temporal lobe means losing the ability to make new memories — the basis of conditions like amnesia and Alzheimer\'s.',
    analogy: 'The library + audio system of the brain.',
    related: ['Hippocampus', 'Wernicke\'s area (language comprehension)', 'Auditory cortex'],
  },
  occipital: {
    id: 'occipital', label: 'Occipital Lobe', color: '#A5B4FC',
    function: 'Processes everything you see — colour, motion, depth, and shape recognition.',
    whyItMatters: 'A surprisingly small region at the back of your head is responsible for ~30% of your brain\'s entire processing power.',
    analogy: 'The visual cortex — the brain\'s GPU.',
    related: ['Primary visual cortex (V1)', 'Colour vision', 'Motion detection'],
  },
  cerebellum: {
    id: 'cerebellum', label: 'Cerebellum', color: '#C7D2E8',
    function: 'Coordinates voluntary movement, balance, and fine motor skills. Tiny but holds ~50% of all neurons.',
    whyItMatters: 'The "little brain" is what lets you ride a bike, type without looking, or stand on one foot — all the things your conscious mind doesn\'t have to think about.',
    analogy: 'The motion-stabilisation chip that smooths every movement.',
    related: ['Motor coordination', 'Procedural memory', 'Balance'],
  },
  brain_stem: {
    id: 'brain_stem', label: 'Brain Stem', color: '#7C6BF6',
    function: 'Controls automatic life-support: heart rate, breathing, blood pressure, sleep cycles, and reflexes.',
    whyItMatters: 'You can lose huge parts of your cortex and survive, but damage to the brain stem is usually fatal — it runs the body 24/7.',
    analogy: 'The autopilot that keeps the plane flying while the pilot sleeps.',
    related: ['Medulla', 'Pons', 'Reticular activating system'],
  },
}

type RegionBox = {
  id: string
  cx: number; cy: number; cz: number
  rx: number; ry: number; rz: number    
}

const REGIONS: RegionBox[] = [
  { id: 'frontal',    cx: 0.0,  cy:  0.35, cz:  0.45, rx: 0.50, ry: 0.35, rz: 0.30 },
  { id: 'parietal',   cx: 0.0,  cy:  0.55, cz: -0.10, rx: 0.50, ry: 0.30, rz: 0.30 },
  { id: 'temporal',   cx: 0.0,  cy: -0.05, cz:  0.05, rx: 0.55, ry: 0.30, rz: 0.45 },
  { id: 'occipital',  cx: 0.0,  cy:  0.20, cz: -0.55, rx: 0.45, ry: 0.30, rz: 0.25 },
  { id: 'cerebellum', cx: 0.0,  cy: -0.30, cz: -0.55, rx: 0.40, ry: 0.30, rz: 0.25 },
  { id: 'brain_stem', cx: 0.0,  cy: -0.55, cz: -0.10, rx: 0.18, ry: 0.30, rz: 0.30 },
]

interface SimProps {
  params: { rotate: boolean }
  playing: boolean
}

function BrainSim({ playing }: SimProps) {
  const [hovered,  setHovered]  = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <LabScene cameraPos={[0, 1.2, 9]} cameraFov={42} tint="#1a0d1f" fogColor="#0a0510" particles={35}>
        <Suspense fallback={<BrainFallback />}>
          <Brain
            playing={playing}
            hovered={hovered}
            selected={selected}
            onHover={setHovered}
            onSelect={setSelected}
          />
        </Suspense>
        <ContactShadows position={[0, -3.4, 0]} opacity={0.45} scale={9} blur={2.5} far={5} />
        <OrbitControls enablePan={false} minDistance={5} maxDistance={18}
          autoRotate={playing && !hovered && !selected} autoRotateSpeed={0.5} />
      </LabScene>

      <PartHoverChip hovered={hovered} selected={selected} catalog={PARTS} />
      <PartIdleHint hovered={hovered} selected={selected} hint="Click a region — frontal, parietal, temporal, occipital, cerebellum, or brain stem" />
      <AnimatePresence>
        {selected && PARTS[selected] && (
          <PartInfoCard part={PARTS[selected]} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function BrainFallback() {
  return (
    <Html center>
      <div style={{
        background: 'rgba(13,13,13,0.85)', border: '1px solid rgba(248,113,113,0.4)',
        borderRadius: 10, padding: '10px 16px', fontFamily: 'inherit',
        fontSize: 12, color: '#fca5a5', whiteSpace: 'nowrap',
      }}>
        Loading brain model…
      </div>
    </Html>
  )
}

function Brain({ playing, hovered, selected, onHover, onSelect }: {
  playing:  boolean
  hovered:  string | null
  selected: string | null
  onHover:  (id: string | null) => void
  onSelect: (id: string | null) => void
}) {
  const { scene } = useGLTF(BRAIN_URL)
  const groupRef = useRef<THREE.Group>(null)

  const { cloned, halfExt } = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((obj: any) => {
      if (obj.isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
        if (obj.material && 'emissive' in obj.material) {
          obj.material.emissiveIntensity = Math.max(obj.material.emissiveIntensity || 0, 0.12)
        }
      }
    })
    const meshBox = new THREE.Box3()
    let n = 0
    c.traverse((obj: any) => {
      if (obj.isMesh && obj.geometry) {
        meshBox.union(new THREE.Box3().setFromObject(obj))
        n++
      }
    })
    const box = n > 0 ? meshBox : new THREE.Box3().setFromObject(c)
    const size = new THREE.Vector3()
    box.getSize(size)
    const longest = Math.max(size.x, size.y, size.z) || 1
    const factor = TARGET_SIZE / longest
    c.scale.setScalar(factor)

    const scaled = new THREE.Box3()
    c.traverse((obj: any) => {
      if (obj.isMesh && obj.geometry) scaled.union(new THREE.Box3().setFromObject(obj))
    })
    const center = new THREE.Vector3()
    scaled.getCenter(center)
    c.position.sub(center)

    const finalSize = new THREE.Vector3()
    scaled.getSize(finalSize)
    return {
      cloned: c,
      halfExt: { x: finalSize.x / 2, y: finalSize.y / 2, z: finalSize.z / 2 },
    }
  }, [scene])

  useFrame((state) => {
    if (!groupRef.current || !playing) return
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.12) * 0.04
  })

  return (
    <group ref={groupRef}>
      <primitive object={cloned} />

      {REGIONS.map(r => {
        const isLit = hovered === r.id || selected === r.id
        return (
          <group key={r.id}
            position={[r.cx * halfExt.x, r.cy * halfExt.y, r.cz * halfExt.z]}>
            <mesh
              onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(r.id); document.body.style.cursor='pointer' }}
              onPointerOut={() => { onHover(null); document.body.style.cursor='default' }}
              onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(r.id) }}>
              <boxGeometry args={[r.rx * halfExt.x * 2, r.ry * halfExt.y * 2, r.rz * halfExt.z * 2]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {isLit && (
              <mesh>
                <boxGeometry args={[r.rx * halfExt.x * 2, r.ry * halfExt.y * 2, r.rz * halfExt.z * 2]} />
                <meshBasicMaterial color={PARTS[r.id].color} wireframe transparent opacity={0.45} />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}

useGLTF.preload(BRAIN_URL)

export default function BrainAnatomyLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Human Brain" subject="Biology" topic="Nervous System · Class 9-12"
      description="A real 3D anatomical brain. Click any region — frontal lobe, parietal, temporal, occipital, cerebellum, or brain stem — to see what it does and why it matters. Drag to rotate, scroll to zoom."
      Sim={BrainSim}
      defaultParams={{ rotate: true }}
      controls={[
        { key: 'rotate', label: 'Idle sway', type: 'toggle', value: true },
      ]}
      aiPrompt={() => `An interactive 3D human brain. Walk through the four cerebral lobes (frontal: planning + motor; parietal: touch + spatial; temporal: hearing + memory; occipital: vision), the cerebellum (motor coordination + balance), and the brain stem (life-support autopilot). End with: why the prefrontal cortex finishes developing only at 25 and what that means for teenage decision-making.`}
      onBack={onBack}
    />
  )
}
