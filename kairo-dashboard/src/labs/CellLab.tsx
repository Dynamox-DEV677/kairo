/**
 * Cell Lab — anatomically-styled 3D animal cell.
 * Each organelle has a distinct, realistic shape:
 *   - Mitochondria: oval capsule with internal cristae lines
 *   - ER: tubular network of connected spheres + cylinders, ribosomes attached
 *   - Golgi: stacked flattened discs (cisternae)
 *   - Nucleus: large sphere with a denser nucleolus inside + nuclear pores
 *   - Lysosomes: small dark spheres
 *   - Vacuole: large translucent sphere
 *   - Centrioles: pair of perpendicular tube clusters
 *   - Cytoskeleton: thin lines crossing the interior
 */
import { useState, useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Text } from '@react-three/drei'
import * as THREE from 'three'
import LabShell from './LabShell'

interface SimProps { params: any; playing: boolean }

function CellSim({ playing }: SimProps) {
  const [hover, setHover] = useState<string | null>(null)
  const handlers = (id: string) => ({
    onPointerOver: (e: any) => { e.stopPropagation(); setHover(id); document.body.style.cursor = 'pointer' },
    onPointerOut: () => { setHover(null); document.body.style.cursor = 'default' },
  })

  return (
    <Canvas camera={{ position: [5, 3.5, 8], fov: 50 }}
      style={{ background: 'radial-gradient(circle at 30% 30%, #1a1830 0%, #0a0a18 70%)' }}>
      <ambientLight intensity={0.6} />
      <pointLight position={[6, 8, 5]} intensity={1.3} color="#fde68a" />
      <pointLight position={[-6, -3, 4]} intensity={0.7} color="#a5b4fc" />
      <pointLight position={[2, -4, -4]} intensity={0.4} color="#f472b6" />
      <Stars radius={40} depth={20} count={300} factor={2} fade />

      <CellMembrane />
      <Cytoplasm playing={playing} />

      <Nucleus      onHover={handlers('nucleus')}      hovered={hover === 'nucleus'} />
      <Mitochondria onHoverFactory={handlers}          hovered={hover} />
      <Golgi        onHover={handlers('golgi')}        hovered={hover === 'golgi'} />
      <ER           onHover={handlers('er')}           hovered={hover === 'er'} />
      <Ribosomes    onHover={handlers('ribosomes')}    hovered={hover === 'ribosomes'} />
      <Lysosomes    onHoverFactory={handlers}          hovered={hover} />
      <Vacuole      onHover={handlers('vacuole')}      hovered={hover === 'vacuole'} />
      <Centrioles   onHover={handlers('centrioles')}   hovered={hover === 'centrioles'} />

      <HoverLabel hover={hover} />

      <OrbitControls enablePan={false} minDistance={5} maxDistance={22} />
    </Canvas>
  )
}

// ─── Cell membrane — phospholipid bilayer effect ────────────────────────────
function CellMembrane() {
  return (
    <>
      {/* Outer surface — soft yellow translucent */}
      <mesh>
        <sphereGeometry args={[3.6, 64, 64]} />
        <meshPhysicalMaterial
          color="#fde68a" transparent opacity={0.07}
          roughness={0.3} transmission={0.85} thickness={0.4}
          ior={1.4}
        />
      </mesh>
      {/* Inner surface — slightly smaller */}
      <mesh>
        <sphereGeometry args={[3.45, 48, 48]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.04} side={THREE.BackSide} />
      </mesh>
      {/* Subtle hex pattern via low-density wireframe */}
      <mesh>
        <sphereGeometry args={[3.55, 24, 16]} />
        <meshBasicMaterial color="#fde68a" wireframe transparent opacity={0.06} />
      </mesh>
    </>
  )
}

function Cytoplasm({ playing }: { playing: boolean }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (ref.current && playing) ref.current.rotation.y += dt * 0.04 })
  return (
    <group ref={ref}>
      {/* Soft inner glow → suggests cytosol */}
      <mesh>
        <sphereGeometry args={[3.3, 32, 32]} />
        <meshStandardMaterial color="#1e3a5f" transparent opacity={0.05} side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

// ─── Nucleus — purple sphere with nucleolus + nuclear pores ─────────────────
function Nucleus({ onHover, hovered }: any) {
  return (
    <group {...onHover} position={[0.2, 0.1, 0]}>
      {/* Outer nuclear envelope */}
      <mesh>
        <sphereGeometry args={[1.25, 48, 48]} />
        <meshStandardMaterial
          color="#8b5cf6" roughness={0.55} metalness={0.05}
          emissive="#5b21b6" emissiveIntensity={hovered ? 0.45 : 0.18}
        />
      </mesh>
      {/* Nuclear membrane translucent overlay */}
      <mesh>
        <sphereGeometry args={[1.28, 32, 32]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.12} />
      </mesh>
      {/* Nucleolus (denser dark spot inside) */}
      <mesh position={[0.3, -0.2, 0.4]}>
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshStandardMaterial color="#581c87" roughness={0.4} emissive="#581c87" emissiveIntensity={0.3} />
      </mesh>
      {/* Chromatin (small darker patches) */}
      {[
        [-0.4, 0.5, 0.5], [0.5, 0.5, -0.3], [-0.3, -0.5, -0.4], [0.6, -0.1, 0.5],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshStandardMaterial color="#6d28d9" roughness={0.6} />
        </mesh>
      ))}
      {/* Nuclear pores — small dimples around the surface */}
      {[
        [1.25, 0, 0], [-1.25, 0, 0], [0, 1.25, 0], [0, -1.25, 0],
        [0, 0, 1.25], [0, 0, -1.25], [0.9, 0.9, 0], [-0.9, 0.9, 0],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} scale={[1.0, 1.0, 0.4]}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshStandardMaterial color="#312e81" roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

// ─── Mitochondria — capsules with internal cristae ──────────────────────────
function Mitochondria({ onHoverFactory, hovered }: any) {
  const positions: { id: string; pos: [number, number, number]; rot: [number, number, number]; scale: number }[] = [
    { id: 'mito1', pos: [-2.3, 0.7, 0.6],   rot: [0, 0.5, 0.3],     scale: 1.0 },
    { id: 'mito2', pos: [2.1, -1.3, 0.4],   rot: [0, -0.4, -0.2],   scale: 1.1 },
    { id: 'mito3', pos: [-1.7, -1.9, -0.7], rot: [0.2, 1.1, 0.2],   scale: 0.9 },
    { id: 'mito4', pos: [1.6, 1.7, -0.9],   rot: [0, 0.7, -0.3],    scale: 1.0 },
  ]
  return (
    <>
      {positions.map(m => {
        const isHover = hovered === m.id
        return (
          <group key={m.id} position={m.pos} rotation={m.rot} scale={m.scale} {...onHoverFactory(m.id)}>
            {/* Outer membrane (oval capsule) */}
            <mesh scale={[0.65, 0.32, 0.32]}>
              <sphereGeometry args={[1, 24, 16]} />
              <meshStandardMaterial
                color="#dc2626" roughness={0.45}
                emissive="#7f1d1d" emissiveIntensity={isHover ? 0.5 : 0.18}
              />
            </mesh>
            {/* Cristae — internal folded lines (3 vertical rings) */}
            {[-0.3, 0, 0.3].map((zo, i) => (
              <mesh key={i} position={[zo, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <torusGeometry args={[0.18, 0.03, 6, 16]} />
                <meshStandardMaterial color="#fbbf24" roughness={0.3} emissive="#92400e" emissiveIntensity={0.3} />
              </mesh>
            ))}
          </group>
        )
      })}
    </>
  )
}

// ─── Golgi apparatus — stacked cisternae ────────────────────────────────────
function Golgi({ onHover, hovered }: any) {
  return (
    <group position={[-2.0, 1.4, 0.2]} rotation={[0.2, 0.5, 0.4]} {...onHover}>
      {/* 5 stacked flattened discs of decreasing size */}
      {[0, 1, 2, 3, 4].map(i => {
        const r = 0.55 - i * 0.05
        const offset = (i - 2) * 0.15
        return (
          <mesh key={i} position={[0, offset, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[r, 0.06, 8, 24]} />
            <meshStandardMaterial
              color="#34d399" roughness={0.35}
              emissive="#065f46" emissiveIntensity={hovered ? 0.55 : 0.2}
            />
          </mesh>
        )
      })}
      {/* Vesicles budding off */}
      {[
        [0.6, 0.3, 0], [0.7, -0.3, 0.1], [-0.65, 0.2, 0.05], [-0.5, -0.3, -0.1],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <sphereGeometry args={[0.08, 10, 10]} />
          <meshStandardMaterial color="#6ee7b7" roughness={0.4} emissive="#065f46" emissiveIntensity={0.3} />
        </mesh>
      ))}
    </group>
  )
}

// ─── Endoplasmic Reticulum — tubular network ────────────────────────────────
function ER({ onHover, hovered }: any) {
  // Build a Catmull-Rom curve weaving around the nucleus, then tube it.
  const tube = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3( 1.5, 1.0,  0.8),
      new THREE.Vector3( 1.9, 0.4,  1.4),
      new THREE.Vector3( 2.2, -0.4, 1.0),
      new THREE.Vector3( 1.8, -1.0, 0.4),
      new THREE.Vector3( 1.2, -1.2, -0.4),
      new THREE.Vector3( 0.6, -0.8, -1.2),
      new THREE.Vector3( 0.2,  0.0, -1.5),
      new THREE.Vector3( 0.6,  0.8, -1.4),
      new THREE.Vector3( 1.2,  1.4, -0.7),
      new THREE.Vector3( 1.6,  1.4,  0.2),
    ], true, 'catmullrom', 0.7)
    return new THREE.TubeGeometry(curve, 80, 0.13, 12, true)
  }, [])

  return (
    <group {...onHover}>
      <mesh geometry={tube}>
        <meshStandardMaterial
          color="#fbbf24" roughness={0.45}
          emissive="#78350f" emissiveIntensity={hovered ? 0.45 : 0.18}
        />
      </mesh>
      {/* Studded ribosomes on the ER (rough ER) */}
      {Array.from({ length: 18 }).map((_, i) => {
        const angle = (i / 18) * Math.PI * 2
        const wobble = Math.sin(i * 1.7) * 0.5
        const t = i / 18
        return (
          <mesh key={i} position={[
            Math.cos(angle * 1.3) * (1.4 + wobble * 0.3),
            Math.sin(angle * 1.5) * 0.9 + Math.cos(t * 6) * 0.3,
            Math.sin(angle) * 1.1,
          ]}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshStandardMaterial color="#1e40af" roughness={0.4} emissive="#1e3a8a" emissiveIntensity={0.3} />
          </mesh>
        )
      })}
    </group>
  )
}

// ─── Free ribosomes scattered in cytoplasm ──────────────────────────────────
function Ribosomes({ onHover, hovered }: any) {
  const positions: [number, number, number][] = [
    [-1.3, 1.8, 1.2], [-0.5, 2.4, 0.4], [-2.4, -0.5, 1.4], [2.6, 0.3, 0.5],
    [-0.3, -2.5, 0.5], [1.5, -0.5, -1.8], [-1.6, 1.0, -1.6], [0.6, 2.0, -1.0],
    [-2.5, 0.5, -0.8], [2.0, 1.5, 1.5], [-0.8, -2.2, -1.5], [1.0, -2.0, 1.0],
  ]
  return (
    <group {...onHover}>
      {positions.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.085, 12, 12]} />
          <meshStandardMaterial
            color="#1e40af" roughness={0.4}
            emissive="#1e3a8a" emissiveIntensity={hovered ? 0.5 : 0.25}
          />
        </mesh>
      ))}
    </group>
  )
}

// ─── Lysosomes — small dense spheres ────────────────────────────────────────
function Lysosomes({ onHoverFactory, hovered }: any) {
  const positions: { id: string; pos: [number, number, number] }[] = [
    { id: 'lyso1', pos: [2.4, 1.1, 0.9]   },
    { id: 'lyso2', pos: [-2.0, -1.5, 0.9] },
    { id: 'lyso3', pos: [2.0, -2.0, -0.5] },
  ]
  return (
    <>
      {positions.map(l => {
        const isHover = hovered === l.id
        return (
          <group key={l.id} position={l.pos} {...onHoverFactory(l.id)}>
            <mesh>
              <sphereGeometry args={[0.32, 18, 18]} />
              <meshStandardMaterial
                color="#f472b6" roughness={0.5}
                emissive="#9d174d" emissiveIntensity={isHover ? 0.55 : 0.25}
              />
            </mesh>
            {/* Inner enzyme texture — small white dots inside */}
            <mesh position={[0.1, 0.1, 0.1]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshBasicMaterial color="#fbcfe8" transparent opacity={0.7} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

// ─── Vacuole — large translucent water bubble ──────────────────────────────
function Vacuole({ onHover, hovered }: any) {
  return (
    <group position={[-1.8, -0.6, 1.3]} {...onHover}>
      <mesh>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshPhysicalMaterial
          color="#67e8f9" transparent opacity={0.35}
          roughness={0.1} transmission={0.7} thickness={0.5}
          emissive="#06b6d4" emissiveIntensity={hovered ? 0.4 : 0.1}
        />
      </mesh>
      {/* Highlight on water surface */}
      <mesh position={[-0.18, 0.18, 0.28]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color="#cffafe" transparent opacity={0.7} />
      </mesh>
    </group>
  )
}

// ─── Centrioles — pair of perpendicular cylinders ──────────────────────────
function Centrioles({ onHover, hovered }: any) {
  return (
    <group position={[1.3, 1.5, 1.4]} {...onHover}>
      {/* Two centrioles at 90° */}
      <mesh rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.4, 9, 1, true]} />
        <meshStandardMaterial
          color="#94a3b8" roughness={0.5}
          emissive="#1e293b" emissiveIntensity={hovered ? 0.5 : 0.2}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0.25, 0, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.4, 9, 1, true]} />
        <meshStandardMaterial
          color="#94a3b8" roughness={0.5}
          emissive="#1e293b" emissiveIntensity={hovered ? 0.5 : 0.2}
        />
      </mesh>
    </group>
  )
}

// ─── Hover label ───────────────────────────────────────────────────────────
function HoverLabel({ hover }: { hover: string | null }) {
  if (!hover) return null
  const labels: Record<string, [string, [number, number, number]]> = {
    nucleus:    ['Nucleus',          [0.2,  1.6,  0]],
    er:         ['Endoplasmic Reticulum', [1.4, 2.0,  -0.2]],
    golgi:      ['Golgi Apparatus',  [-2.0, 2.4,   0.2]],
    ribosomes:  ['Ribosomes',        [-1.3, 2.9,   1.2]],
    vacuole:    ['Vacuole',          [-1.8, 0.2,  1.3]],
    centrioles: ['Centrioles',       [1.3,  2.2,  1.4]],
    mito1:      ['Mitochondrion',    [-2.3, 1.3,  0.6]],
    mito2:      ['Mitochondrion',    [2.1, -0.7,  0.4]],
    mito3:      ['Mitochondrion',    [-1.7, -1.3,-0.7]],
    mito4:      ['Mitochondrion',    [1.6,  2.3, -0.9]],
    lyso1:      ['Lysosome',         [2.4,  1.7,  0.9]],
    lyso2:      ['Lysosome',         [-2.0,-0.9,  0.9]],
    lyso3:      ['Lysosome',         [2.0, -1.4, -0.5]],
  }
  const e = labels[hover]
  if (!e) return null
  return (
    <Text position={e[1]} fontSize={0.2} color="#fafafa" anchorX="center"
      outlineWidth={0.025} outlineColor="#000">
      {e[0]}
    </Text>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function CellLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Animal Cell" subject="Biology" topic="Cell Structure · Class 9"
      description="A 3-D animal cell with proper-shape organelles. Mitochondria show internal cristae, the Golgi has stacked cisternae, the ER weaves through the cytoplasm, ribosomes dot it. Hover any organelle to see its name."
      Sim={CellSim}
      defaultParams={{}}
      controls={[]}
      aiPrompt={() => `An animal cell rendered with anatomically-styled organelles: nucleus with nucleolus and nuclear pores, mitochondria with cristae, rough ER tubular network with bound ribosomes, Golgi apparatus with stacked cisternae, free ribosomes, lysosomes, a vacuole, and a centriole pair. For each organelle: name, function, and one quick fact. End by contrasting with a plant cell.`}
      onBack={onBack}
    />
  )
}
