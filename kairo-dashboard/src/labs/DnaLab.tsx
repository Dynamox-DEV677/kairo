/**
 * DNA Lab — procedural double helix with clickable base pairs.
 * No GLB needed; the geometry is generated from the helix parametric form.
 */
import { useMemo, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import { AnimatePresence } from 'framer-motion'
import * as THREE from 'three'
import LabShell from './LabShell'
import LabScene from './LabScene'
import { PartInfoCard, PartHoverChip, PartIdleHint, LAB_PALETTE, type PartCatalog } from './LabKit'

const PARTS: PartCatalog = {
  adenine: {
    id: 'adenine', label: 'Adenine (A)', color: '#ef4444',
    function: 'A nitrogenous base — one of the four letters of DNA. Always pairs with thymine via two hydrogen bonds.',
    whyItMatters: 'The A-T pair is one of two "letters" the genetic code is written in.',
    analogy: 'Like a puzzle piece that only fits with its T-shaped partner.',
    related: ['A-T base pair', 'Purine', 'Hydrogen bonding'],
  },
  thymine: {
    id: 'thymine', label: 'Thymine (T)', color: '#fbbf24',
    function: 'Pairs with adenine via two hydrogen bonds. Unique to DNA (replaced by uracil in RNA).',
    whyItMatters: 'Thymine\'s methyl group helps DNA repair enzymes detect damage.',
    analogy: 'The T-shaped twin of adenine.',
    related: ['A-T base pair', 'Pyrimidine', 'DNA vs RNA'],
  },
  guanine: {
    id: 'guanine', label: 'Guanine (G)', color: '#34d399',
    function: 'Pairs with cytosine via three hydrogen bonds — a stronger bond than A-T.',
    whyItMatters: 'Regions rich in G-C are more stable and harder to unzip during replication.',
    analogy: 'The triple-locked door of the base pairs.',
    related: ['G-C base pair', 'Purine', 'GC content'],
  },
  cytosine: {
    id: 'cytosine', label: 'Cytosine (C)', color: '#3b82f6',
    function: 'Pairs with guanine via three hydrogen bonds. Can be methylated to silence genes.',
    whyItMatters: 'Methylated cytosine is the basis of "epigenetic" memory — how cells remember their identity.',
    analogy: 'The information-storage letter of the genome.',
    related: ['G-C base pair', 'Pyrimidine', 'Methylation'],
  },
  backbone: {
    id: 'backbone', label: 'Sugar-Phosphate Backbone', color: LAB_PALETTE.structure,
    function: 'Alternating deoxyribose sugar + phosphate group — the two long rails of the helix.',
    whyItMatters: 'The backbone holds the bases in order; without it the genetic letters scatter.',
    analogy: 'Like the spine of a book holding the pages in sequence.',
    related: ['Phosphodiester bond', 'Deoxyribose', '5\' and 3\' ends'],
  },
}

// Standard base-pair sequence — repeating motif, 12 pairs
const SEQUENCE = ['A', 'T', 'G', 'C', 'A', 'T', 'G', 'C', 'A', 'T', 'G', 'C']
const BASE_ID: Record<string, string> = { A: 'adenine', T: 'thymine', G: 'guanine', C: 'cytosine' }
const BASE_COMPLEMENT: Record<string, string> = { A: 'T', T: 'A', G: 'C', C: 'G' }

function DnaSim({ playing }: { params: any; playing: boolean }) {
  const [hovered,  setHovered]  = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const helixHeight = 8
  const radius      = 1.1
  const turns       = 1.6
  const pairs       = SEQUENCE.length

  // Backbone curve — two intertwined sin/cos strands
  const strandPoints = useMemo(() => {
    const N = 200
    const a: THREE.Vector3[] = []
    const b: THREE.Vector3[] = []
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const angle = t * Math.PI * 2 * turns
      const y = -helixHeight / 2 + t * helixHeight
      a.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius))
      b.push(new THREE.Vector3(Math.cos(angle + Math.PI) * radius, y, Math.sin(angle + Math.PI) * radius))
    }
    return { a, b }
  }, [])

  const strandAGeom = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strandPoints.a), 220, 0.09, 8, false), [strandPoints])
  const strandBGeom = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strandPoints.b), 220, 0.09, 8, false), [strandPoints])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <LabScene cameraPos={[5, 0, 8]} cameraFov={50} tint={LAB_PALETTE.biology} particles={70} stars={false}>
        <group rotation={[0, 0, 0]}>
          {/* Two backbones */}
          <mesh
            geometry={strandAGeom}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered('backbone'); document.body.style.cursor='pointer' }}
            onPointerOut={() => { setHovered(null); document.body.style.cursor='default' }}
            onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setSelected('backbone') }}>
            <meshStandardMaterial color={PARTS.backbone.color} emissive={PARTS.backbone.color}
              emissiveIntensity={hovered === 'backbone' || selected === 'backbone' ? 1.0 : 0.25}
              roughness={0.4} metalness={0.1} />
          </mesh>
          <mesh
            geometry={strandBGeom}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered('backbone'); document.body.style.cursor='pointer' }}
            onPointerOut={() => { setHovered(null); document.body.style.cursor='default' }}
            onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setSelected('backbone') }}>
            <meshStandardMaterial color={PARTS.backbone.color} emissive={PARTS.backbone.color}
              emissiveIntensity={hovered === 'backbone' || selected === 'backbone' ? 1.0 : 0.25}
              roughness={0.4} metalness={0.1} />
          </mesh>

          {/* Base pairs — rungs of the ladder */}
          {SEQUENCE.map((base, i) => {
            const t = i / (pairs - 1)
            const angle = t * Math.PI * 2 * turns
            const y = -helixHeight / 2 + t * helixHeight
            const x1 = Math.cos(angle) * radius
            const z1 = Math.sin(angle) * radius
            const x2 = Math.cos(angle + Math.PI) * radius
            const z2 = Math.sin(angle + Math.PI) * radius
            const midX = (x1 + x2) / 2, midZ = (z1 + z2) / 2
            const dx = x2 - x1, dz = z2 - z1
            const rungLen = Math.sqrt(dx*dx + dz*dz)
            const rungAng = Math.atan2(dz, dx)

            const baseId = BASE_ID[base]
            const complement = BASE_COMPLEMENT[base]
            const compId = BASE_ID[complement]

            const baseHover = hovered === baseId || selected === baseId
            const compHover = hovered === compId || selected === compId

            return (
              <group key={i}>
                {/* Base half 1 */}
                <mesh position={[(x1 + midX) / 2, y, (z1 + midZ) / 2]} rotation={[0, -rungAng, Math.PI/2]}
                  onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered(baseId); document.body.style.cursor='pointer' }}
                  onPointerOut={() => { setHovered(null); document.body.style.cursor='default' }}
                  onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setSelected(baseId) }}>
                  <cylinderGeometry args={[0.06, 0.06, rungLen / 2, 10]} />
                  <meshStandardMaterial color={PARTS[baseId].color}
                    emissive={PARTS[baseId].color}
                    emissiveIntensity={baseHover ? 1.6 : 0.5}
                    roughness={0.4} />
                </mesh>
                {/* Base half 2 (complement) */}
                <mesh position={[(midX + x2) / 2, y, (midZ + z2) / 2]} rotation={[0, -rungAng, Math.PI/2]}
                  onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered(compId); document.body.style.cursor='pointer' }}
                  onPointerOut={() => { setHovered(null); document.body.style.cursor='default' }}
                  onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setSelected(compId) }}>
                  <cylinderGeometry args={[0.06, 0.06, rungLen / 2, 10]} />
                  <meshStandardMaterial color={PARTS[compId].color}
                    emissive={PARTS[compId].color}
                    emissiveIntensity={compHover ? 1.6 : 0.5}
                    roughness={0.4} />
                </mesh>
              </group>
            )
          })}

          {/* Slow rotation for "alive" feel */}
          <RotateGroup playing={playing} />
        </group>

        <ContactShadows position={[0, -4.5, 0]} opacity={0.3} scale={10} blur={2.5} />
        <OrbitControls enablePan={false} minDistance={5} maxDistance={20} autoRotate={!hovered && !selected} autoRotateSpeed={0.5} />
      </LabScene>

      <PartHoverChip hovered={hovered} selected={selected} catalog={PARTS} />
      <PartIdleHint hovered={hovered} selected={selected} hint="Click any base or backbone strand" />
      <AnimatePresence>
        {selected && PARTS[selected] && (
          <PartInfoCard part={PARTS[selected]} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function RotateGroup({ playing }: { playing: boolean }) {
  useFrame((state) => {
    if (!playing) return
    // The whole helix gently sways - the group's parent is the orbit controls auto-rotate
    state.scene.rotation.y += 0   // placeholder so we keep useFrame for future
  })
  return null
}

export default function DnaLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="DNA Double Helix" subject="Biology" topic="Genetics · Class 10-12"
      description="Click any base (A, T, G, C) or the sugar-phosphate backbone to learn how the genetic code is stored. Adenine pairs with thymine (2 H-bonds); guanine pairs with cytosine (3 H-bonds, stronger)."
      Sim={DnaSim}
      defaultParams={{}}
      controls={[]}
      aiPrompt={() => `An interactive 3D DNA double helix. Cover: structure (two anti-parallel sugar-phosphate backbones twisted into a right-handed helix), base pairing (A-T with 2 hydrogen bonds, G-C with 3), why the structure matters for replication, transcription, and mutation. End with the elegance of the complementary code.`}
      onBack={onBack}
    />
  )
}
