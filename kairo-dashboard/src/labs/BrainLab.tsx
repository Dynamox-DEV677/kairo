/**
 * Brain Lab — stylised procedural brain with clickable lobes.
 * Each lobe is a position-offset sphere; the cerebellum + brainstem are
 * smaller spheres / cylinders attached behind / below.
 *
 * Not anatomically perfect — this is a learning aid, not a surgical model.
 */
import { useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { AnimatePresence } from 'framer-motion'
import * as THREE from 'three'
import LabShell from './LabShell'
import LabScene from './LabScene'
import { PartInfoCard, PartHoverChip, PartIdleHint, LAB_PALETTE, type PartCatalog } from './LabKit'

const PARTS: PartCatalog = {
  frontal: {
    id: 'frontal', label: 'Frontal Lobe', color: '#a78bfa',
    function: 'Decision-making, planning, voluntary movement, personality, and speech production.',
    whyItMatters: 'Damage here = changes in judgement and personality (famous case: Phineas Gage).',
    analogy: 'The CEO of the brain — sets goals and weighs consequences.',
    related: ['Prefrontal cortex', 'Motor cortex', 'Broca\'s area'],
  },
  parietal: {
    id: 'parietal', label: 'Parietal Lobe', color: '#34d399',
    function: 'Processes touch, temperature, pain, body position, and spatial awareness.',
    whyItMatters: 'Without it you literally can\'t feel a needle, find your hand in the dark, or navigate a room.',
    analogy: 'The brain\'s sensory map + GPS.',
    related: ['Somatosensory cortex', 'Proprioception', 'Spatial reasoning'],
  },
  temporal: {
    id: 'temporal', label: 'Temporal Lobe', color: '#fbbf24',
    function: 'Hearing, language comprehension, memory formation (hippocampus lives here).',
    whyItMatters: 'Houses the hippocampus — the brain\'s memory-encoding centre.',
    analogy: 'The brain\'s audio + memory department.',
    related: ['Wernicke\'s area', 'Hippocampus', 'Auditory cortex'],
  },
  occipital: {
    id: 'occipital', label: 'Occipital Lobe', color: '#f472b6',
    function: 'Vision — interprets signals from the eyes into colour, shape, and motion.',
    whyItMatters: 'Damage here can cause cortical blindness even with healthy eyes.',
    analogy: 'The brain\'s graphics card.',
    related: ['Primary visual cortex', 'Motion detection', 'Colour processing'],
  },
  cerebellum: {
    id: 'cerebellum', label: 'Cerebellum', color: '#67e8f9',
    function: 'Fine-tunes movement, balance, coordination, and motor learning.',
    whyItMatters: 'Without the cerebellum, every movement would be clumsy and uncoordinated.',
    analogy: 'The brain\'s autopilot for movement.',
    related: ['Motor learning', 'Balance', 'Smooth coordination'],
  },
  brainstem: {
    id: 'brainstem', label: 'Brainstem', color: '#dc2626',
    function: 'Controls automatic vital functions: heart rate, breathing, blood pressure, sleep cycles.',
    whyItMatters: 'You can lose massive parts of the cortex and survive — lose the brainstem and you don\'t.',
    analogy: 'The life-support system of the brain.',
    related: ['Medulla oblongata', 'Pons', 'Reticular formation'],
  },
}

interface Lobe {
  id:       string
  pos:      [number, number, number]
  scale:    [number, number, number]
  geometry: 'sphere' | 'cylinder'
}

const LOBES: Lobe[] = [
  { id: 'frontal',    pos: [ 1.1,  0.6,  0.0], scale: [1.0, 0.95, 1.1], geometry: 'sphere' },
  { id: 'parietal',   pos: [ 0.0,  1.1, -0.2], scale: [1.1, 0.85, 1.05], geometry: 'sphere' },
  { id: 'temporal',   pos: [ 0.7, -0.2,  1.0], scale: [0.85, 0.7, 0.85], geometry: 'sphere' },
  { id: 'occipital',  pos: [-1.0,  0.5, -0.2], scale: [0.9, 0.85, 0.95], geometry: 'sphere' },
  { id: 'cerebellum', pos: [-0.8, -0.7, -0.2], scale: [0.7, 0.55, 0.75], geometry: 'sphere' },
  { id: 'brainstem',  pos: [-0.3, -1.5, -0.1], scale: [0.25, 0.7, 0.25], geometry: 'cylinder' },
]

function Lobe({ lobe, isHover, isSelected, onHover, onSelect }: any) {
  const ref = useRef<THREE.Mesh>(null)
  // Subtle "thinking" pulse on hover only
  useFrame((state) => {
    if (!ref.current) return
    if (isHover || isSelected) {
      const p = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.04
      ref.current.scale.set(lobe.scale[0] * p, lobe.scale[1] * p, lobe.scale[2] * p)
    } else {
      ref.current.scale.set(...lobe.scale as [number, number, number])
    }
  })
  const color = PARTS[lobe.id].color
  return (
    <mesh ref={ref} position={lobe.pos} scale={lobe.scale}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(lobe.id); document.body.style.cursor='pointer' }}
      onPointerOut={() => { onHover(null); document.body.style.cursor='default' }}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(lobe.id) }}>
      {lobe.geometry === 'sphere'
        ? <sphereGeometry args={[1, 64, 64]} />
        : <cylinderGeometry args={[1, 1, 1, 24]} />}
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={isHover || isSelected ? 1.4 : 0.3}
        roughness={0.5}
        // Subtle bumpy "brain" feel via flat shading
        flatShading
      />
    </mesh>
  )
}

function AutoRotateGroup({ enabled, speed = 0.15, children }: { enabled: boolean; speed?: number; children: React.ReactNode }) {
  // Hooks live inside the Canvas via this wrapper component.
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (!enabled || !ref.current) return
    ref.current.rotation.y += dt * speed
  })
  return <group ref={ref}>{children}</group>
}

function BrainSim({ playing }: { params: any; playing: boolean }) {
  const [hovered, setHovered]   = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <LabScene cameraPos={[0, 1, 6]} cameraFov={50} tint={LAB_PALETTE.biology} particles={60} stars={false}>
        <AutoRotateGroup enabled={playing && !hovered && !selected}>
          {LOBES.map(lobe => (
            <Lobe key={lobe.id} lobe={lobe}
              isHover={hovered === lobe.id} isSelected={selected === lobe.id}
              onHover={setHovered} onSelect={setSelected} />
          ))}
        </AutoRotateGroup>
        <OrbitControls enablePan={false} minDistance={3.5} maxDistance={14} />
      </LabScene>

      <PartHoverChip hovered={hovered} selected={selected} catalog={PARTS} />
      <PartIdleHint hovered={hovered} selected={selected} hint="Click any lobe of the brain" />
      <AnimatePresence>
        {selected && PARTS[selected] && (
          <PartInfoCard part={PARTS[selected]} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

export default function BrainLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Human Brain" subject="Biology" topic="Nervous System · Class 10-12"
      description="A stylised 3D brain with the four cerebral lobes + cerebellum + brainstem. Click any region to learn what it controls, what happens when it\'s damaged, and which famous brain areas live inside it."
      Sim={BrainSim}
      defaultParams={{}}
      controls={[]}
      aiPrompt={() => `An interactive 3D brain — students click each lobe and the cerebellum/brainstem to learn its function. Cover: frontal lobe (decisions, personality, Broca\'s area), parietal (touch, spatial awareness), temporal (hearing, memory, hippocampus, Wernicke\'s), occipital (vision), cerebellum (coordination), brainstem (life support). End with: the brain is a parallel system — every lobe works together for any complex task.`}
      onBack={onBack}
    />
  )
}
