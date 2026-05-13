/**
 * Heart Lab — fully procedural anatomical heart, no GLB.
 *
 * Built from Three.js primitives so it's lightweight, always visible, and
 * each chamber is independently clickable + colorable. Replaces the old
 * GLB-based lab which loaded a model that was tiny and hard to read.
 *
 * Anatomy on screen (viewer's perspective, NOT patient's mirror — easier
 * for students to read):
 *
 *           ┌─ aorta ─┐    ┌─ pulm. artery ─┐
 *           ▼         │    │                ▼
 *      ┌── SVC ──┐  ┌──┴────┴──┐  ┌── pulm. veins ──┐
 *      │         │  │  ATRIA   │  │                 │
 *      └────┬────┘  ▼          ▼  └────┬────────────┘
 *           │     ┌──┐       ┌──┐      │
 *           └────►│RA│       │LA│◄─────┘
 *                 └─┬┘       └─┬┘
 *                ┌──┴──┐    ┌──┴──┐
 *                │ RV  │    │ LV  │
 *                └──┬──┘    └──┬──┘
 *                   ▼          ▼
 *                  (apex of the heart)
 *
 * Pulse animation: ventricles contract harder ("lub") then atria
 * contract ("dub") in sync with the BPM control.
 */
import { useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Text, ContactShadows } from '@react-three/drei'
import { AnimatePresence } from 'framer-motion'
import * as THREE from 'three'
import LabShell from './LabShell'
import LabScene from './LabScene'
import { PartInfoCard, PartHoverChip, PartIdleHint, type PartCatalog } from './LabKit'

// ─── Part catalog ──────────────────────────────────────────────────────────
const PARTS: PartCatalog = {
  left_ventricle: {
    id: 'left_ventricle', label: 'Left Ventricle (LV)', color: '#dc2626',
    function: 'The strongest pumping chamber. Sends oxygen-rich blood out through the aorta to the entire body.',
    whyItMatters: "The LV's walls are 3× thicker than the right ventricle's — it has to push blood through 100,000+ km of blood vessels.",
    analogy: "The heart's main engine.",
    related: ['Aorta', 'Systemic circulation', 'Cardiac output'],
  },
  right_ventricle: {
    id: 'right_ventricle', label: 'Right Ventricle (RV)', color: '#f43f5e',
    function: 'Pumps oxygen-poor blood to the lungs through the pulmonary artery.',
    whyItMatters: "Only has to push blood a short distance to the lungs — so its walls are thinner than the LV.",
    analogy: "The lung-loop pump.",
    related: ['Pulmonary artery', 'Pulmonary circulation'],
  },
  left_atrium: {
    id: 'left_atrium', label: 'Left Atrium (LA)', color: '#fb7185',
    function: 'Receives oxygen-rich blood from the lungs and squeezes it into the LV.',
    whyItMatters: "Acts as a holding chamber so the LV always has blood ready to pump on the next beat.",
    analogy: "The waiting room before the engine.",
    related: ['Pulmonary veins', 'Mitral valve'],
  },
  right_atrium: {
    id: 'right_atrium', label: 'Right Atrium (RA)', color: '#fda4af',
    function: 'Receives oxygen-poor blood from the body via the vena cavae and squeezes it into the RV.',
    whyItMatters: "Contains the SA node — your heart's natural pacemaker that times every beat.",
    analogy: "The body's return inbox AND the heart's metronome.",
    related: ['Vena cava', 'SA node', 'Tricuspid valve'],
  },
  aorta: {
    id: 'aorta', label: 'Aorta', color: '#ef4444',
    function: 'The body\'s largest artery. Carries oxygen-rich blood from the LV to every organ.',
    whyItMatters: "Every cell in your body gets its oxygen via this single 30 mm-wide tube.",
    analogy: "The main highway out of the heart.",
    related: ['Systemic arteries', 'Blood pressure'],
  },
  pulmonary_artery: {
    id: 'pulmonary_artery', label: 'Pulmonary Artery', color: '#a78bfa',
    function: 'Carries oxygen-poor blood from the RV to the lungs to pick up oxygen.',
    whyItMatters: "The ONLY artery in your body that carries deoxygenated blood. Most arteries carry oxygen.",
    analogy: "The lung-bound exit ramp.",
    related: ['Pulmonary circulation', 'Gas exchange'],
  },
  vena_cava: {
    id: 'vena_cava', label: 'Vena Cava', color: '#60a5fa',
    function: 'The two large veins (superior + inferior) that return deoxygenated blood from the body to the right atrium.',
    whyItMatters: "Collects blood from every cell in your body — about 5 litres returning to the heart per minute at rest.",
    analogy: "The body's main return pipe.",
    related: ['Venous return', 'Superior + inferior'],
  },
}

interface SimProps {
  params: { bpm: number }
  playing: boolean
}

function HeartSim({ params, playing }: SimProps) {
  const [hovered,  setHovered]  = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <LabScene
        cameraPos={[0, 1.2, 8]}
        cameraFov={45}
        tint="#180a14"
        fogColor="#0a0a14"
        particles={45}
      >
        <Heart
          bpm={params.bpm}
          playing={playing}
          hovered={hovered}
          selected={selected}
          onHover={setHovered}
          onSelect={setSelected}
        />

        <Text position={[0, -4.0, 0]} fontSize={0.4} color="#fafafa" anchorX="center"
          outlineWidth={0.025} outlineColor="#000">
          {params.bpm} BPM
        </Text>

        <ContactShadows position={[0, -3.6, 0]} opacity={0.45} scale={11} blur={2.6} far={5} />

        <OrbitControls enablePan={false} minDistance={5} maxDistance={18}
          autoRotate={!hovered && !selected} autoRotateSpeed={0.35}
          minPolarAngle={Math.PI / 5} maxPolarAngle={Math.PI - Math.PI / 5} />
      </LabScene>

      <PartHoverChip hovered={hovered} selected={selected} catalog={PARTS} />
      <PartIdleHint hovered={hovered} selected={selected}
        hint="Click any chamber, the aorta, the pulmonary artery, or the vena cava" />
      <AnimatePresence>
        {selected && PARTS[selected] && (
          <PartInfoCard part={PARTS[selected]} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── The Heart ──────────────────────────────────────────────────────────────
function Heart({ bpm, playing, hovered, selected, onHover, onSelect }: {
  bpm: number; playing: boolean
  hovered: string | null; selected: string | null
  onHover: (id: string | null) => void
  onSelect: (id: string | null) => void
}) {
  const root      = useRef<THREE.Group>(null)
  const ventricleRef = useRef<THREE.Group>(null)
  const atrialRef    = useRef<THREE.Group>(null)
  const tRef = useRef(0)

  // Two-phase lub-dub: ventricles squeeze first (the "lub"), then atria fill +
  // squeeze ("dub"). Driven by phase 0..1 within each cardiac cycle.
  useFrame((_, dt) => {
    if (!playing) return
    tRef.current += dt
    const period = 60 / bpm           // seconds per cycle
    const phase  = (tRef.current % period) / period

    // Ventricles: deep contract during phase 0..0.20 (systole)
    let vScale = 1
    if (phase < 0.20) vScale = 1 - 0.13 * Math.sin((phase / 0.20) * Math.PI)
    if (ventricleRef.current) ventricleRef.current.scale.setScalar(vScale)

    // Atria: smaller contraction during phase 0.30..0.45
    let aScale = 1
    if (phase > 0.30 && phase < 0.45) {
      aScale = 1 - 0.08 * Math.sin(((phase - 0.30) / 0.15) * Math.PI)
    }
    if (atrialRef.current) atrialRef.current.scale.setScalar(aScale)

    // Whole heart gentle scale wobble
    if (root.current) {
      const pulse = 1 + 0.02 * Math.sin(phase * Math.PI * 2)
      root.current.scale.setScalar(pulse)
    }
  })

  // Helper to apply hover/select emissive lift
  function lit(id: string) {
    return hovered === id || selected === id
  }

  return (
    <group ref={root} position={[0, 0.4, 0]}>
      {/* ─── VENTRICLES — bottom half ──────────────────────────────────── */}
      <group ref={ventricleRef} position={[0, -0.6, 0]}>
        {/* Left Ventricle (viewer's right) — biggest, thick-walled */}
        <ClickyMesh
          id="left_ventricle" onHover={onHover} onSelect={onSelect}
          position={[1.0, 0, 0]} rotation={[0, 0, -0.08]}>
          <sphereGeometry args={[1.4, 32, 32]} />
          <meshStandardMaterial
            color="#dc2626"
            roughness={0.4} metalness={0.05}
            emissive={lit('left_ventricle') ? '#dc2626' : '#000'}
            emissiveIntensity={lit('left_ventricle') ? 0.45 : 0.05}
          />
        </ClickyMesh>
        {/* Apex bulge for LV — gives the heart its pointed bottom */}
        <ClickyMesh
          id="left_ventricle" onHover={onHover} onSelect={onSelect}
          position={[0.95, -1.05, 0.05]} scale={[0.62, 0.85, 0.62]} rotation={[0, 0, -0.4]}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshStandardMaterial color="#b91c1c" roughness={0.4}
            emissive={lit('left_ventricle') ? '#dc2626' : '#000'}
            emissiveIntensity={lit('left_ventricle') ? 0.45 : 0.06}/>
        </ClickyMesh>

        {/* Right Ventricle (viewer's left) — slightly smaller, thinner walls */}
        <ClickyMesh
          id="right_ventricle" onHover={onHover} onSelect={onSelect}
          position={[-0.85, 0.0, 0.05]} scale={[0.95, 1, 0.92]}>
          <sphereGeometry args={[1.3, 32, 32]} />
          <meshStandardMaterial
            color="#f43f5e" roughness={0.45} metalness={0.05}
            emissive={lit('right_ventricle') ? '#f43f5e' : '#000'}
            emissiveIntensity={lit('right_ventricle') ? 0.45 : 0.05}/>
        </ClickyMesh>
      </group>

      {/* ─── ATRIA — top half ──────────────────────────────────────────── */}
      <group ref={atrialRef} position={[0, 1.05, 0]}>
        {/* Left Atrium (viewer's right) */}
        <ClickyMesh
          id="left_atrium" onHover={onHover} onSelect={onSelect}
          position={[0.85, 0, -0.05]} scale={[0.85, 0.7, 0.85]}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshStandardMaterial
            color="#fb7185" roughness={0.5}
            emissive={lit('left_atrium') ? '#fb7185' : '#000'}
            emissiveIntensity={lit('left_atrium') ? 0.45 : 0.05}/>
        </ClickyMesh>

        {/* Right Atrium (viewer's left) */}
        <ClickyMesh
          id="right_atrium" onHover={onHover} onSelect={onSelect}
          position={[-0.85, 0, 0]} scale={[0.85, 0.7, 0.85]}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshStandardMaterial
            color="#fda4af" roughness={0.5}
            emissive={lit('right_atrium') ? '#fda4af' : '#000'}
            emissiveIntensity={lit('right_atrium') ? 0.45 : 0.05}/>
        </ClickyMesh>

        {/* Septum line down the middle (visual cue separating L/R) */}
        <mesh position={[0, -0.05, 0.7]} scale={[0.04, 0.55, 0.05]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#7f1d1d" />
        </mesh>
      </group>

      {/* ─── AORTA — big curved tube from top of LV ───────────────────── */}
      <Aorta lit={lit('aorta')} onHover={onHover} onSelect={onSelect} />

      {/* ─── PULMONARY ARTERY — from top of RV, arcs left ─────────────── */}
      <PulmonaryArtery lit={lit('pulmonary_artery')} onHover={onHover} onSelect={onSelect} />

      {/* ─── VENA CAVA — vertical blue tube into right atrium ─────────── */}
      <VenaCava lit={lit('vena_cava')} onHover={onHover} onSelect={onSelect} />
    </group>
  )
}

// ─── Reusable clickable mesh ────────────────────────────────────────────────
function ClickyMesh({
  id, onHover, onSelect, children, ...meshProps
}: any) {
  return (
    <mesh
      {...meshProps}
      castShadow receiveShadow
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(id); document.body.style.cursor='pointer' }}
      onPointerOut={() => { onHover(null); document.body.style.cursor='default' }}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(id) }}>
      {children}
    </mesh>
  )
}

// ─── Aorta — quadratic curve through TubeGeometry ──────────────────────────
function Aorta({ lit, onHover, onSelect }: { lit: boolean; onHover: any; onSelect: any }) {
  // Curve: start at top of LV, go up, arch to the right
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.95, 1.8, 0.1),
    new THREE.Vector3(0.95, 2.6, 0.1),
    new THREE.Vector3(0.6,  3.4, 0.1),
    new THREE.Vector3(-0.3, 3.55, 0.1),
    new THREE.Vector3(-1.4, 3.2,  0.1),
    new THREE.Vector3(-1.7, 2.4,  0.1),
  ])
  const geom = new THREE.TubeGeometry(curve, 64, 0.26, 16, false)
  return (
    <mesh
      geometry={geom} castShadow receiveShadow
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover('aorta'); document.body.style.cursor='pointer' }}
      onPointerOut={() => { onHover(null); document.body.style.cursor='default' }}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect('aorta') }}>
      <meshStandardMaterial
        color="#ef4444" roughness={0.35} metalness={0.1}
        emissive={lit ? '#ef4444' : '#000'} emissiveIntensity={lit ? 0.5 : 0.08}/>
    </mesh>
  )
}

// ─── Pulmonary artery — smaller arc to the LEFT ────────────────────────────
function PulmonaryArtery({ lit, onHover, onSelect }: { lit: boolean; onHover: any; onSelect: any }) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.85, 1.8, 0.15),
    new THREE.Vector3(-1.0,  2.3, 0.15),
    new THREE.Vector3(-1.3,  2.7, 0.15),
    new THREE.Vector3(-1.6,  3.0, 0.15),
  ])
  const geom = new THREE.TubeGeometry(curve, 32, 0.22, 16, false)
  return (
    <mesh
      geometry={geom} castShadow receiveShadow
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover('pulmonary_artery'); document.body.style.cursor='pointer' }}
      onPointerOut={() => { onHover(null); document.body.style.cursor='default' }}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect('pulmonary_artery') }}>
      <meshStandardMaterial
        color="#a78bfa" roughness={0.4}
        emissive={lit ? '#a78bfa' : '#000'} emissiveIntensity={lit ? 0.6 : 0.1}/>
    </mesh>
  )
}

// ─── Vena cava — superior + inferior cylinders into RA ─────────────────────
function VenaCava({ lit, onHover, onSelect }: { lit: boolean; onHover: any; onSelect: any }) {
  const matProps = {
    color: '#60a5fa',
    roughness: 0.45,
    emissive: lit ? '#60a5fa' : '#000',
    emissiveIntensity: lit ? 0.5 : 0.08,
  } as any
  const onOver  = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover('vena_cava'); document.body.style.cursor='pointer' }
  const onOut   = () => { onHover(null); document.body.style.cursor='default' }
  const onClick = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect('vena_cava') }

  return (
    <group>
      {/* Superior vena cava — goes UP from right atrium */}
      <mesh position={[-1.45, 2.2, -0.05]} rotation={[0, 0, -0.15]} castShadow receiveShadow
        onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        <cylinderGeometry args={[0.22, 0.22, 1.6, 24]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      {/* Inferior vena cava — comes UP from below into right atrium */}
      <mesh position={[-1.05, -0.6, -0.05]} castShadow receiveShadow
        onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        <cylinderGeometry args={[0.20, 0.20, 1.1, 24]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
    </group>
  )
}

// ─── Lab wrapper ───────────────────────────────────────────────────────────
export default function HeartLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Human Heart" subject="Biology" topic="Circulation · Class 9–10"
      description="A procedural anatomical heart. Two ventricles, two atria, the aorta, the pulmonary artery, and the vena cava — all clickable. Drag to rotate, slow the BPM to study, speed it up for cardio."
      Sim={HeartSim}
      defaultParams={{ bpm: 72 }}
      controls={[
        { key: 'bpm', label: 'Heart rate', type: 'slider', value: 72, min: 40, max: 180, step: 1, unit: 'bpm' },
      ]}
      aiPrompt={p => `An interactive 3D human heart beating at ${p.bpm} BPM. Cover: the four chambers (RA, RV, LA, LV), the path of blood through pulmonary and systemic circulation, why the LV walls are 3× thicker than the RV, and what BPM ranges mean (resting 60-100, athletes 40-60, exercising 120-180). End with the SA node as the pacemaker that times every beat.`}
      onBack={onBack}
    />
  )
}
