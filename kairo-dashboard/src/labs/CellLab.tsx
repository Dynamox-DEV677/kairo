/**
 * Cell Lab — interactive premium 3D animal cell.
 *
 * Loads a real animal_cell.glb model. The GLB has material names that map
 * 1:1 to organelles (Nucleus_Shell, Mitochondria_Material, ...), so we
 * group meshes by material at load time and use that mapping to:
 *
 *   - highlight on hover (emissive glow on every mesh sharing the material)
 *   - open an info card on click (name + function + analogy + related processes)
 *   - drive subtle per-organelle animations (nucleus pulse, ER flow)
 *
 * No procedural geometry — everything is the real model with overlay UI.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, useGLTF, Html, ContactShadows } from '@react-three/drei'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles } from 'lucide-react'
import * as THREE from 'three'
import LabShell from './LabShell'
import LabScene from './LabScene'

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/Dynamox-DEV677/kairo@main/models-cdn/animal_cell.glb'

// ─── Organelle catalogue ────────────────────────────────────────────────────
// Keys are material names as they appear in the GLB (lowercased + trimmed).
// Add more aliases if the source asset gets re-exported with different names.

interface OrganelleInfo {
  id:           string
  label:        string
  color:        string        // highlight emissive
  function:     string
  whyItMatters: string
  analogy:      string
  related:      string[]
}

const ORGANELLES: Record<string, OrganelleInfo> = {
  nucleus: {
    id: 'nucleus', label: 'Nucleus', color: '#a78bfa',
    function: 'Stores the cell\'s DNA and controls every activity — protein synthesis, growth, division.',
    whyItMatters: 'Without the nucleus, the cell has no instruction manual. It\'s the command centre.',
    analogy: 'Like the control room of a factory — every machine takes its orders from here.',
    related: ['DNA replication', 'Transcription', 'mRNA export through nuclear pores'],
  },
  mitochondria: {
    id: 'mitochondria', label: 'Mitochondria', color: '#dc2626',
    function: 'Produces ATP energy by breaking down glucose with oxygen (cellular respiration).',
    whyItMatters: 'ATP is the cell\'s currency for energy. No mitochondria = no power = no life.',
    analogy: 'The power plant of the cell. The folded inner membrane (cristae) is like extra-long extension cords — more surface for ATP factories.',
    related: ['Krebs cycle', 'Electron transport chain', 'Oxidative phosphorylation'],
  },
  er: {
    id: 'er', label: 'Endoplasmic Reticulum', color: '#fbbf24',
    function: 'Folds and modifies proteins (rough ER, studded with ribosomes) and synthesises lipids (smooth ER).',
    whyItMatters: 'Newly made proteins start as floppy chains here — folded, checked, and shipped out.',
    analogy: 'The cell\'s assembly line + quality-control conveyor.',
    related: ['Protein folding', 'Lipid synthesis', 'Detoxification'],
  },
  golgi: {
    id: 'golgi', label: 'Golgi Apparatus', color: '#34d399',
    function: 'Packages proteins from the ER, tags them with addresses, and ships them in vesicles.',
    whyItMatters: 'Without the Golgi, finished proteins never reach where they\'re needed.',
    analogy: 'The cell\'s post office — sorts, labels, and dispatches every package.',
    related: ['Vesicle budding', 'Glycosylation', 'Secretory pathway'],
  },
  lysosome: {
    id: 'lysosome', label: 'Lysosome', color: '#f472b6',
    function: 'Breaks down waste, worn-out organelles, and engulfed bacteria using digestive enzymes.',
    whyItMatters: 'Without lysosomes, cellular debris piles up and the cell dies of its own junk.',
    analogy: 'The cell\'s recycling and digestion plant.',
    related: ['Autophagy', 'Phagocytosis', 'Apoptosis (programmed death)'],
  },
  vacuole: {
    id: 'vacuole', label: 'Vacuole', color: '#67e8f9',
    function: 'Storage sac for water, nutrients, and waste. Smaller in animal cells than plant cells.',
    whyItMatters: 'Keeps the cell\'s internal contents organised and stable.',
    analogy: 'Like the cell\'s pantry + waste bin in one bag.',
    related: ['Osmotic balance', 'Endocytosis', 'Storage of metabolites'],
  },
  centrioles: {
    id: 'centrioles', label: 'Centrioles', color: '#cbd5e1',
    function: 'A pair of perpendicular microtubule cylinders that organise the mitotic spindle during cell division.',
    whyItMatters: 'They make sure each daughter cell gets exactly one copy of every chromosome.',
    analogy: 'Like the conductor at a chromosome orchestra during mitosis.',
    related: ['Mitosis', 'Spindle assembly', 'Microtubule organising centre (MTOC)'],
  },
  vesicle: {
    id: 'vesicle', label: 'Transport Vesicle', color: '#86efac',
    function: 'Small membrane-bound bubbles that ferry cargo between organelles (ER → Golgi → cell membrane).',
    whyItMatters: 'Without vesicle traffic, the cell can\'t deliver hormones, enzymes, or building blocks where they\'re needed.',
    analogy: 'The delivery trucks of the cell — pickup from ER, drop-off at the Golgi or membrane.',
    related: ['Exocytosis', 'Endocytosis', 'COPII-coated transport'],
  },
  cytoskeleton: {
    id: 'cytoskeleton', label: 'Cytoskeleton', color: '#fde68a',
    function: 'Network of protein fibres that gives the cell shape, anchors organelles, and enables movement.',
    whyItMatters: 'Without the cytoskeleton, the cell collapses like a tent without poles.',
    analogy: 'The scaffolding + railway system of the cell.',
    related: ['Microtubules', 'Actin filaments', 'Intermediate filaments'],
  },
  membrane: {
    id: 'membrane', label: 'Cell Membrane', color: '#fbbf24',
    function: 'Selectively permeable phospholipid bilayer — controls what enters and leaves the cell.',
    whyItMatters: 'The membrane is the cell\'s skin and its border control.',
    analogy: 'Like a smart wall with doormen at every gate.',
    related: ['Diffusion', 'Active transport', 'Receptor signalling'],
  },
}

/** Material-name → organelle-id lookup. Handles typos in the source asset
 *  ("Recticulum", "Vacoule") and the generic "Material" → cell membrane. */
const MATERIAL_TO_ORGANELLE: Record<string, string> = {
  'nucleus_shell':              'nucleus',
  'mitochondria_material':      'mitochondria',
  'endoplasmic_recticulum_mat': 'er',         // sic — asset has the typo
  'endoplasmic_reticulum_mat':  'er',
  'golgi_apparatus_mat':        'golgi',
  'lysosome':                   'lysosome',
  'vacoule':                    'vacuole',    // sic — asset typo
  'vacuole':                    'vacuole',
  'centrioles':                 'centrioles',
  'vesicleshell_mat':           'vesicle',
  'cytoskeleton':               'cytoskeleton',
  'material':                   'membrane',
  'nutrients_color':            'vesicle',    // small inner spheres act as cargo
}

// ────────────────────────────────────────────────────────────────────────────

interface SimProps { params: any; playing: boolean }

function CellSim({ playing }: SimProps) {
  const [hovered,  setHovered]  = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <LabScene
        cameraPos={[5, 3.5, 7.5]}
        cameraFov={50}
        tint="#1a1830"
        fogColor="#0a0a18"
        fogNear={20}
        fogFar={60}
        particles={120}    // more particles — feels like cytoplasm + extracellular
        stars={false}      // we're INSIDE a cell, not in space
      >
        <Suspense fallback={null}>
          <Cell
            hovered={hovered}
            selected={selected}
            onHover={setHovered}
            onSelect={setSelected}
            playing={playing}
          />
        </Suspense>

        {/* Soft floor shadow for grounding */}
        <ContactShadows position={[0, -2.5, 0]} opacity={0.35} scale={10} blur={2.5} far={4} />

        {/* Cinematic ATP particles — small dots flying near the mitochondria */}
        {playing && <AtpParticles />}

        <OrbitControls
          enablePan={false}
          minDistance={4}
          maxDistance={18}
          enableDamping
          dampingFactor={0.08}
          autoRotate={!selected && !hovered}
          autoRotateSpeed={0.4}
        />
      </LabScene>

      {/* Top-left hovered chip */}
      <AnimatePresence>
        {hovered && !selected && (
          <motion.div
            key={hovered}
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              position: 'absolute', top: 14, left: 14, zIndex: 10,
              padding: '7px 13px', borderRadius: 8,
              background: 'rgba(13,13,13,0.85)', backdropFilter: 'blur(10px)',
              border: `1px solid ${ORGANELLES[hovered]?.color || '#444'}44`,
              fontSize: 11, color: '#fafafa', fontWeight: 700, letterSpacing: 0.4,
              pointerEvents: 'none',
            }}>
            {ORGANELLES[hovered]?.label || hovered} <span style={{ color: '#71717a', fontWeight: 500, marginLeft: 8 }}>· click to learn more</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty-state hint */}
      {!hovered && !selected && (
        <div style={{
          position: 'absolute', top: 14, left: 14, zIndex: 5,
          padding: '6px 12px', borderRadius: 7,
          background: 'rgba(13,13,13,0.55)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(99,102,241,0.25)',
          fontSize: 10.5, color: '#a5b4fc', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: 1.5,
          pointerEvents: 'none',
        }}>
          <Sparkles size={10} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
          Hover any organelle · click for details
        </div>
      )}

      {/* Organelle info side panel */}
      <AnimatePresence>
        {selected && ORGANELLES[selected] && (
          <OrganelleCard
            info={ORGANELLES[selected]}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── The cell model itself ──────────────────────────────────────────────────

function Cell({ hovered, selected, onHover, onSelect, playing }: {
  hovered: string | null; selected: string | null
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
  playing: boolean
}) {
  const { scene } = useGLTF(MODEL_URL)
  const groupRef = useRef<THREE.Group>(null)

  // Clone the scene so multiple lab mounts don't share state.
  // Then traverse and: (a) fit to target size, (b) group meshes by organelle.
  const { cloned, meshesByOrganelle } = useMemo(() => {
    const cloned = scene.clone(true)
    cloned.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
        // Save original emissive so hover-out can restore it.
        if (o.material && !o.userData.origEmissive) {
          o.userData.origEmissive          = o.material.emissive ? o.material.emissive.clone() : new THREE.Color('#000')
          o.userData.origEmissiveIntensity = o.material.emissiveIntensity ?? 0
          // Make all materials slightly translucent for that biological glow
          if ('transparent' in o.material) {
            o.material.transparent = true
            if (o.material.opacity === undefined || o.material.opacity === 1) {
              const orgId = MATERIAL_TO_ORGANELLE[(o.material.name || '').toLowerCase()]
              // Cell membrane slightly see-through so we can see inside
              if (orgId === 'membrane') o.material.opacity = 0.18
              else o.material.opacity = 0.95
            }
          }
          // Bump up base emissive so even un-hovered organelles glow subtly
          if (o.material.emissive) {
            o.material.emissive = o.material.color?.clone().multiplyScalar(0.25) || new THREE.Color('#222')
            o.material.emissiveIntensity = 0.3
          }
        }
      }
    })

    // Mesh-only bounds + fit to target size (avoids the "tiny model" bug
    // when GLBs have skeletal bones inflating Box3).
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
    cloned.scale.setScalar(5.0 / longest)
    const scaledBox = new THREE.Box3()
    cloned.traverse((o: any) => { if (o.isMesh && o.geometry) scaledBox.union(new THREE.Box3().setFromObject(o)) })
    const center = new THREE.Vector3()
    scaledBox.getCenter(center)
    cloned.position.sub(center)

    // Group meshes by organelle id
    const meshesByOrganelle: Record<string, THREE.Mesh[]> = {}
    cloned.traverse((o: any) => {
      if (o.isMesh && o.material) {
        const matKey = (o.material.name || '').toLowerCase()
        const orgId  = MATERIAL_TO_ORGANELLE[matKey]
        if (orgId) {
          meshesByOrganelle[orgId] ??= []
          meshesByOrganelle[orgId].push(o)
        }
      }
    })

    return { cloned, meshesByOrganelle }
  }, [scene])

  // Apply hover/selected highlight whenever they change.
  useEffect(() => {
    Object.entries(meshesByOrganelle).forEach(([orgId, meshes]) => {
      const isHover    = orgId === hovered
      const isSelected = orgId === selected
      const isDimmed   = !!selected && !isSelected   // dim non-selected when something is selected
      const info       = ORGANELLES[orgId]
      meshes.forEach((m: any) => {
        if (!m.material) return
        if (isHover || isSelected) {
          m.material.emissive          = new THREE.Color(info?.color || '#ffffff')
          m.material.emissiveIntensity = isSelected ? 1.8 : 1.0
          m.material.opacity           = orgId === 'membrane' ? 0.25 : 1.0
        } else {
          m.material.emissive          = m.userData.origEmissive || new THREE.Color('#000')
          m.material.emissiveIntensity = m.userData.origEmissiveIntensity ?? 0
          if (m.material.transparent) {
            m.material.opacity = orgId === 'membrane'
              ? (isDimmed ? 0.10 : 0.18)
              : (isDimmed ? 0.4 : 0.95)
          }
        }
      })
    })
  }, [hovered, selected, meshesByOrganelle])

  // Subtle ambient animations: gentle whole-cell sway + nucleus pulse
  useFrame((state, dt) => {
    if (!playing || !groupRef.current) return
    const t = state.clock.elapsedTime
    // Gentle Y bob
    groupRef.current.position.y = Math.sin(t * 0.6) * 0.05
    // Pulse the nucleus
    const nucleusMeshes = meshesByOrganelle['nucleus']
    if (nucleusMeshes) {
      const pulse = 1 + Math.sin(t * 1.3) * 0.022
      nucleusMeshes.forEach(m => m.scale.setScalar(pulse))
    }
    // Slowly rotate the ER ribbon for "flow" feeling
    const erMeshes = meshesByOrganelle['er']
    if (erMeshes) {
      erMeshes.forEach(m => { m.rotation.y += dt * 0.04 })
    }
  })

  // Pointer handlers — translate raycast hits → organelle id.
  function pickOrganelleId(obj: any): string | null {
    if (!obj?.material) return null
    return MATERIAL_TO_ORGANELLE[(obj.material.name || '').toLowerCase()] || null
  }

  return (
    <group
      ref={groupRef}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        const id = pickOrganelleId(e.object)
        if (id) {
          onHover(id)
          document.body.style.cursor = 'pointer'
        }
      }}
      onPointerOut={() => {
        onHover(null)
        document.body.style.cursor = 'default'
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        const id = pickOrganelleId(e.object)
        if (id) onSelect(id)
      }}
    >
      <primitive object={cloned} />
    </group>
  )
}

// ─── ATP particle decoration ────────────────────────────────────────────────
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

// ─── Organelle info card (the click-to-learn panel) ─────────────────────────
function OrganelleCard({ info, onClose }: { info: OrganelleInfo; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'absolute', left: 16, bottom: 16, zIndex: 10,
        width: 'min(340px, calc(100% - 32px))',
        background: 'rgba(13,13,13,0.92)', backdropFilter: 'blur(14px)',
        border: `1px solid ${info.color}55`,
        borderRadius: 14,
        boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 24px ${info.color}22`,
        padding: 16,
        color: '#fafafa',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: info.color, boxShadow: `0 0 12px ${info.color}`,
        }} />
        <div style={{ flex: 1, fontSize: 16, fontWeight: 800, letterSpacing: '-0.3px' }}>
          {info.label}
        </div>
        <button onClick={onClose} aria-label="Close"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#71717a', padding: 4, display: 'flex',
          }}>
          <X size={15} />
        </button>
      </div>

      <Field label="Function" body={info.function} />
      <Field label="Why it matters" body={info.whyItMatters} />
      <Field label="Real-world analogy" body={info.analogy} />

      <div style={{
        fontSize: 10, color: '#a5b4fc', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: 1, marginTop: 12, marginBottom: 4,
      }}>
        Related processes
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {info.related.map(r => (
          <span key={r} style={{
            padding: '3px 8px', borderRadius: 100,
            background: `${info.color}14`, border: `1px solid ${info.color}33`,
            color: info.color, fontSize: 10.5, fontWeight: 600,
          }}>{r}</span>
        ))}
      </div>
    </motion.div>
  )
}

function Field({ label, body }: { label: string; body: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        fontSize: 10, color: '#71717a', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2,
      }}>{label}</div>
      <p style={{ fontSize: 12.5, color: '#e4e4e7', margin: 0, lineHeight: 1.55 }}>{body}</p>
    </div>
  )
}

// Preload the model so the lab opens fast.
useGLTF.preload(MODEL_URL)

// ─── Lab page ───────────────────────────────────────────────────────────────
export default function CellLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Animal Cell" subject="Biology" topic="Cell Structure · Class 9"
      description="A real 3D animal cell model. Hover any organelle to see its name, click for a full breakdown — function, why it matters, real-world analogy, and related processes. The cell breathes, the nucleus pulses, ATP particles drift past the mitochondria."
      Sim={CellSim}
      defaultParams={{}}
      controls={[]}
      aiPrompt={() => `An interactive 3D animal cell — students can hover and click each organelle. Cover the cell as a whole system: how the nucleus, mitochondria, ER, Golgi, lysosomes, vacuole, centrioles, vesicles, and cytoskeleton work TOGETHER. Mention the cell membrane's role as the gatekeeper. End with how a plant cell differs.`}
      onBack={onBack}
    />
  )
}
