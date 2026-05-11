/**
 * Eye Anatomy Lab — procedural human eye with clickable parts.
 * Cross-section friendly: the sclera is a translucent shell so the lens,
 * iris, retina and optic nerve are visible from any angle.
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
  cornea: {
    id: 'cornea', label: 'Cornea', color: '#67e8f9',
    function: 'The transparent dome at the front of the eye — does about 65% of the eye\'s focusing.',
    whyItMatters: 'Most of the bending of light happens here, BEFORE it reaches the lens.',
    analogy: 'The fixed front lens on a camera — most of the focus is built in.',
    related: ['Refraction', 'Astigmatism', 'LASIK surgery'],
  },
  iris: {
    id: 'iris', label: 'Iris', color: '#34d399',
    function: 'The coloured ring around the pupil — controls how much light enters by changing pupil size.',
    whyItMatters: 'Acts like an automatic camera aperture — wide in the dark, narrow in bright light.',
    analogy: 'Camera aperture + the source of your eye colour.',
    related: ['Pupillary reflex', 'Melanin pigment', 'Iridology myths'],
  },
  lens: {
    id: 'lens', label: 'Lens', color: '#fbbf24',
    function: 'A flexible biconvex lens — fine-tunes focus by changing shape (accommodation).',
    whyItMatters: 'Lets you switch focus from a book to a distant tree without thinking.',
    analogy: 'The autofocus mechanism of the eye.',
    related: ['Accommodation', 'Presbyopia', 'Cataracts'],
  },
  retina: {
    id: 'retina', label: 'Retina', color: '#a78bfa',
    function: 'The light-sensitive layer at the back — contains rods (low-light) and cones (colour).',
    whyItMatters: 'Without the retina, photons would hit a wall and nothing would happen — no vision.',
    analogy: 'The camera sensor of the eye.',
    related: ['Rods and cones', 'Macula', 'Retinal detachment'],
  },
  optic_nerve: {
    id: 'optic_nerve', label: 'Optic Nerve', color: '#f472b6',
    function: 'A bundle of ~1 million axons that carry electrical signals from the retina to the brain.',
    whyItMatters: 'The blind spot exists where the optic nerve exits — no photoreceptors there.',
    analogy: 'The HDMI cable from camera (eye) to monitor (brain).',
    related: ['Blind spot', 'Visual cortex', 'Glaucoma'],
  },
  sclera: {
    id: 'sclera', label: 'Sclera', color: '#fafafa',
    function: 'The tough white outer wall of the eye — protects internal structures.',
    whyItMatters: 'Without the sclera, the eye would deform and lose its precise optical shape.',
    analogy: 'The eye\'s leather case.',
    related: ['Eye protection', 'Episcleritis', 'Scleritis'],
  },
  vitreous: {
    id: 'vitreous', label: 'Vitreous Humour', color: '#22d3ee',
    function: 'A clear jelly filling the back chamber — holds the retina in place and the eye\'s shape.',
    whyItMatters: 'Floaters you see in your vision are debris drifting in the vitreous.',
    analogy: 'The clear filling of a glass paperweight.',
    related: ['Floaters', 'Posterior vitreous detachment', 'Eye pressure'],
  },
}

function EyeSim({ playing }: { params: any; playing: boolean }) {
  const [hovered,  setHovered]  = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const groupRef = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (!playing || !groupRef.current || hovered || selected) return
    groupRef.current.rotation.y += dt * 0.18
  })

  const isHover = (id: string) => hovered === id || selected === id
  const isDim   = (id: string) => !!selected && selected !== id

  function partProps(id: string) {
    return {
      onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered(id); document.body.style.cursor='pointer' },
      onPointerOut:  () => { setHovered(null); document.body.style.cursor='default' },
      onClick:       (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setSelected(id) },
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <LabScene cameraPos={[3, 0.5, 4]} cameraFov={45} tint={LAB_PALETTE.biology} particles={50} stars={false}>
        <group ref={groupRef}>
          {/* Sclera — see-through outer shell so we can see inside */}
          <mesh {...partProps('sclera')}>
            <sphereGeometry args={[1.5, 64, 64]} />
            <meshPhysicalMaterial color={PARTS.sclera.color} transparent
              opacity={isHover('sclera') ? 0.32 : (isDim('sclera') ? 0.06 : 0.14)}
              roughness={0.3} transmission={0.5}
              emissive={isHover('sclera') ? PARTS.sclera.color : '#000'}
              emissiveIntensity={isHover('sclera') ? 0.8 : 0} />
          </mesh>

          {/* Vitreous body — fills most of the inside */}
          <mesh position={[-0.1, 0, 0]} {...partProps('vitreous')}>
            <sphereGeometry args={[1.3, 48, 48]} />
            <meshPhysicalMaterial color={PARTS.vitreous.color} transparent
              opacity={isHover('vitreous') ? 0.45 : (isDim('vitreous') ? 0.04 : 0.12)}
              roughness={0.1} transmission={0.85}
              emissive={isHover('vitreous') ? PARTS.vitreous.color : '#000'}
              emissiveIntensity={isHover('vitreous') ? 0.8 : 0} />
          </mesh>

          {/* Retina — inner back surface */}
          <mesh position={[-0.2, 0, 0]} rotation={[0, Math.PI, 0]} {...partProps('retina')}>
            <sphereGeometry args={[1.25, 48, 32, 0, Math.PI * 1.4, 0, Math.PI]} />
            <meshStandardMaterial color={PARTS.retina.color} side={THREE.BackSide}
              emissive={PARTS.retina.color}
              emissiveIntensity={isHover('retina') ? 1.4 : 0.3}
              roughness={0.55}
              opacity={isDim('retina') ? 0.3 : 1} transparent />
          </mesh>

          {/* Cornea — bulging dome on the front */}
          <mesh position={[1.35, 0, 0]} rotation={[0, 0, -Math.PI / 2]} {...partProps('cornea')}>
            <sphereGeometry args={[0.6, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshPhysicalMaterial color={PARTS.cornea.color} transparent
              opacity={isHover('cornea') ? 0.6 : 0.30}
              roughness={0.05} transmission={0.9}
              emissive={PARTS.cornea.color}
              emissiveIntensity={isHover('cornea') ? 1.3 : 0.2} />
          </mesh>

          {/* Iris — flat ring behind the cornea */}
          <mesh position={[1.15, 0, 0]} rotation={[0, 0, Math.PI / 2]} {...partProps('iris')}>
            <ringGeometry args={[0.18, 0.5, 48]} />
            <meshStandardMaterial color={PARTS.iris.color}
              side={THREE.DoubleSide}
              emissive={PARTS.iris.color}
              emissiveIntensity={isHover('iris') ? 1.4 : 0.5}
              roughness={0.4} />
          </mesh>

          {/* Pupil (just a dark disc — not a separate "part") */}
          <mesh position={[1.16, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <circleGeometry args={[0.18, 32]} />
            <meshBasicMaterial color="#0a0a0a" />
          </mesh>

          {/* Lens — biconvex behind the iris */}
          <mesh position={[1.0, 0, 0]} {...partProps('lens')}>
            <sphereGeometry args={[0.35, 32, 32]} />
            <meshPhysicalMaterial color={PARTS.lens.color} transparent
              opacity={isHover('lens') ? 0.85 : 0.55}
              roughness={0.1} transmission={0.65}
              emissive={PARTS.lens.color}
              emissiveIntensity={isHover('lens') ? 1.2 : 0.25} />
          </mesh>

          {/* Optic nerve — cylinder exiting from the back */}
          <mesh position={[-1.7, -0.15, 0]} rotation={[0, 0, Math.PI / 2]} {...partProps('optic_nerve')}>
            <cylinderGeometry args={[0.18, 0.22, 0.7, 16]} />
            <meshStandardMaterial color={PARTS.optic_nerve.color}
              emissive={PARTS.optic_nerve.color}
              emissiveIntensity={isHover('optic_nerve') ? 1.4 : 0.4}
              roughness={0.5} />
          </mesh>
        </group>
        <OrbitControls enablePan={false} minDistance={3} maxDistance={12} />
      </LabScene>

      <PartHoverChip hovered={hovered} selected={selected} catalog={PARTS} />
      <PartIdleHint hovered={hovered} selected={selected} hint="Click any part of the eye" />
      <AnimatePresence>
        {selected && PARTS[selected] && (
          <PartInfoCard part={PARTS[selected]} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

export default function EyeLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Human Eye" subject="Biology" topic="Sense Organs · Class 10-12"
      description="A cross-section of the human eye. The sclera and vitreous humour are translucent so you can see the cornea, iris, lens, retina, and optic nerve from any angle. Click any part to learn how it works."
      Sim={EyeSim}
      defaultParams={{}}
      controls={[]}
      aiPrompt={() => `An interactive 3D human eye cross-section — students click each part. Cover: cornea (does most refraction), iris + pupil (light control like aperture), lens (autofocus via accommodation), vitreous humour (jelly filler), retina (rods + cones, photoreceptors), optic nerve (carries signals to brain — blind spot). End with how all parts work together to form a sharp inverted image on the retina that the brain flips upright.`}
      onBack={onBack}
    />
  )
}
