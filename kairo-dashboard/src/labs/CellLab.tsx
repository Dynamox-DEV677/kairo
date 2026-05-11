/**
 * Cell Lab — Animal Cell, built on the LabKit pattern.
 *
 * This is the REFERENCE lab — the shortest possible code for a new lab
 * once LabKit handles the heavy lifting:
 *   - Model URL              (jsDelivr GLB)
 *   - MaterialMap            (GLB material name → part id)
 *   - PartCatalog            (part id → display + educational copy)
 *   - Optional animators     (per-part frame hooks)
 *
 * Total domain code in this file: ~150 lines for 10 organelles.
 * Adding a new biology/chemistry/physics lab now takes 30 minutes of
 * copywriting, not 3 hours of scene wiring.
 */
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import LabShell from './LabShell'
import InteractiveGLBLab, { LAB_PALETTE, type MaterialMap, type PartCatalog, type PartAnimator } from './LabKit'

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/Dynamox-DEV677/kairo@main/models-cdn/animal_cell.glb'

// Material names in the GLB → our internal part ids.
// Asset has two typos ("Recticulum", "Vacoule") — we map both to the right id.
const MATERIAL_MAP: MaterialMap = {
  'nucleus_shell':              'nucleus',
  'mitochondria_material':      'mitochondria',
  'endoplasmic_recticulum_mat': 'er',
  'endoplasmic_reticulum_mat':  'er',
  'golgi_apparatus_mat':        'golgi',
  'lysosome':                   'lysosome',
  'vacoule':                    'vacuole',
  'vacuole':                    'vacuole',
  'centrioles':                 'centrioles',
  'vesicleshell_mat':           'vesicle',
  'cytoskeleton':               'cytoskeleton',
  'material':                   'membrane',
  'nutrients_color':            'vesicle',
}

const CATALOG: PartCatalog = {
  nucleus: {
    id: 'nucleus', label: 'Nucleus', color: LAB_PALETTE.nucleus,
    function: 'Stores the cell\'s DNA and controls every activity — protein synthesis, growth, division.',
    whyItMatters: 'Without the nucleus, the cell has no instruction manual. It\'s the command centre.',
    analogy: 'Like the control room of a factory — every machine takes its orders from here.',
    related: ['DNA replication', 'Transcription', 'mRNA export'],
  },
  mitochondria: {
    id: 'mitochondria', label: 'Mitochondria', color: LAB_PALETTE.power,
    function: 'Produces ATP energy by breaking down glucose with oxygen (cellular respiration).',
    whyItMatters: 'ATP is the cell\'s currency for energy. No mitochondria = no power = no life.',
    analogy: 'The cell\'s power plant. The folded inner membrane (cristae) is like extra-long extension cords — more surface for ATP factories.',
    related: ['Krebs cycle', 'Electron transport chain', 'Oxidative phosphorylation'],
  },
  er: {
    id: 'er', label: 'Endoplasmic Reticulum', color: '#fbbf24',
    function: 'Folds and modifies proteins (rough ER, studded with ribosomes); synthesises lipids (smooth ER).',
    whyItMatters: 'Newly made proteins start as floppy chains here — folded, checked, and shipped out.',
    analogy: 'The cell\'s assembly line + quality-control conveyor.',
    related: ['Protein folding', 'Lipid synthesis', 'Detoxification'],
  },
  golgi: {
    id: 'golgi', label: 'Golgi Apparatus', color: LAB_PALETTE.shipping,
    function: 'Packages proteins from the ER, tags them with addresses, and ships them in vesicles.',
    whyItMatters: 'Without the Golgi, finished proteins never reach where they\'re needed.',
    analogy: 'The cell\'s post office — sorts, labels, and dispatches every package.',
    related: ['Vesicle budding', 'Glycosylation', 'Secretory pathway'],
  },
  lysosome: {
    id: 'lysosome', label: 'Lysosome', color: LAB_PALETTE.digestion,
    function: 'Breaks down waste, worn-out organelles, and engulfed bacteria using digestive enzymes.',
    whyItMatters: 'Without lysosomes, cellular debris piles up and the cell dies of its own junk.',
    analogy: 'The cell\'s recycling and digestion plant.',
    related: ['Autophagy', 'Phagocytosis', 'Apoptosis'],
  },
  vacuole: {
    id: 'vacuole', label: 'Vacuole', color: LAB_PALETTE.storage,
    function: 'Storage sac for water, nutrients, and waste. Smaller in animal cells than plant cells.',
    whyItMatters: 'Keeps the cell\'s internal contents organised and stable.',
    analogy: 'The cell\'s pantry + waste bin in one bag.',
    related: ['Osmotic balance', 'Endocytosis', 'Storage of metabolites'],
  },
  centrioles: {
    id: 'centrioles', label: 'Centrioles', color: LAB_PALETTE.control,
    function: 'A pair of perpendicular microtubule cylinders that organise the mitotic spindle.',
    whyItMatters: 'They ensure each daughter cell gets exactly one copy of every chromosome.',
    analogy: 'The conductor of the chromosome orchestra during mitosis.',
    related: ['Mitosis', 'Spindle assembly', 'Microtubule organising centre'],
  },
  vesicle: {
    id: 'vesicle', label: 'Transport Vesicle', color: LAB_PALETTE.energy,
    function: 'Membrane-bound bubbles that ferry cargo between organelles (ER → Golgi → cell membrane).',
    whyItMatters: 'Without vesicle traffic, hormones, enzymes, and building blocks never reach their target.',
    analogy: 'The delivery trucks of the cell.',
    related: ['Exocytosis', 'Endocytosis', 'COPII transport'],
  },
  cytoskeleton: {
    id: 'cytoskeleton', label: 'Cytoskeleton', color: LAB_PALETTE.structure,
    function: 'Protein-fibre network that gives the cell shape, anchors organelles, and enables movement.',
    whyItMatters: 'Without the cytoskeleton, the cell collapses like a tent without poles.',
    analogy: 'The scaffolding + railway system of the cell.',
    related: ['Microtubules', 'Actin filaments', 'Intermediate filaments'],
  },
  membrane: {
    id: 'membrane', label: 'Cell Membrane', color: LAB_PALETTE.signal,
    function: 'Selectively permeable phospholipid bilayer — controls what enters and leaves.',
    whyItMatters: 'The membrane is the cell\'s skin and its border control.',
    analogy: 'Like a smart wall with doormen at every gate.',
    related: ['Diffusion', 'Active transport', 'Receptor signalling'],
  },
}

// Per-part animation hooks: gentle pulse on nucleus, slow rotation on ER ribbon.
const ANIMATORS: Record<string, PartAnimator> = {
  nucleus: (meshes, t) => {
    const pulse = 1 + Math.sin(t * 1.3) * 0.022
    meshes.forEach(m => m.scale.setScalar(pulse))
  },
  er: (meshes, _t, dt) => {
    meshes.forEach(m => { m.rotation.y += dt * 0.04 })
  },
}

// ─── Sim ──────────────────────────────────────────────────────────────────
function CellSim({ playing }: { params: any; playing: boolean }) {
  return (
    <InteractiveGLBLab
      url={MODEL_URL}
      materialMap={MATERIAL_MAP}
      catalog={CATALOG}
      membraneId="membrane"
      cameraPos={[5, 3.5, 7.5]}
      cameraFov={50}
      tint={LAB_PALETTE.biology}
      particles={120}
      stars={false}
      autoRotate
      playing={playing}
      animators={ANIMATORS}
      extraScene={playing && <AtpParticles />}
      hint="Hover any organelle · click for details"
    />
  )
}

// Optional flair: ATP particles orbit the cell (lab-specific, lives here)
function AtpParticles() {
  const N = 24
  const ref = useRef<THREE.InstancedMesh>(null)
  const seeds = useMemo(() => Array.from({ length: N }).map((_, i) => ({
    angle: (i / N) * Math.PI * 2,
    r:     1.5 + Math.random() * 1.5,
    speed: 0.3 + Math.random() * 0.4,
    yPhase: Math.random() * Math.PI * 2,
  })), [])

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    const tmp = new THREE.Object3D()
    seeds.forEach((s, i) => {
      const x = Math.cos(s.angle + t * s.speed * 0.4) * s.r
      const z = Math.sin(s.angle + t * s.speed * 0.4) * s.r
      const y = Math.sin(t * 1.2 + s.yPhase) * 1.0
      tmp.position.set(x, y, z)
      tmp.scale.setScalar(0.7 + Math.sin(t * 2 + i) * 0.3)
      tmp.updateMatrix()
      ref.current!.setMatrixAt(i, tmp.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]}>
      <sphereGeometry args={[0.04, 8, 8]} />
      <meshBasicMaterial
        color="#fbbf24"
        transparent opacity={0.7}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────
export default function CellLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Animal Cell" subject="Biology" topic="Cell Structure · Class 9"
      description="A real 3D animal cell. Hover any organelle to see its name, click for a full breakdown — function, why it matters, real-world analogy, and related processes. The cell breathes, the nucleus pulses, ATP particles drift past the mitochondria."
      Sim={CellSim}
      defaultParams={{}}
      controls={[]}
      aiPrompt={() => `An interactive 3D animal cell — students can hover and click each organelle. Cover the cell as a whole system: how the nucleus, mitochondria, ER, Golgi, lysosomes, vacuole, centrioles, vesicles, and cytoskeleton work TOGETHER. Mention the cell membrane's role as the gatekeeper. End with how a plant cell differs.`}
      onBack={onBack}
    />
  )
}
