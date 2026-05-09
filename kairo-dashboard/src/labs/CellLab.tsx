/**
 * Cell Lab — animal cell with clickable organelles.
 * No sliders; just exploration. Hover an organelle to see its name + function.
 */
import { useState, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Text } from '@react-three/drei'
import * as THREE from 'three'
import LabShell from './LabShell'

interface Organelle {
  id: string
  name: string
  fn: string
  pos: [number, number, number]
  scale: [number, number, number]
  color: string
  shape: 'sphere' | 'box' | 'torus'
}

const ORGANELLES: Organelle[] = [
  { id: 'nucleus',      name: 'Nucleus',      fn: 'Stores DNA, controls activity',         pos: [0, 0, 0],          scale: [1.2, 1.2, 1.2], color: '#a78bfa', shape: 'sphere' },
  { id: 'mito1',        name: 'Mitochondrion',fn: 'Powerhouse — makes ATP energy',          pos: [-2.2, 0.5, 0.5],   scale: [0.5, 0.3, 0.3], color: '#ef4444', shape: 'box' },
  { id: 'mito2',        name: 'Mitochondrion',fn: 'Powerhouse — makes ATP energy',          pos: [2.0, -1.2, 0.3],   scale: [0.55, 0.32, 0.32], color: '#ef4444', shape: 'box' },
  { id: 'mito3',        name: 'Mitochondrion',fn: 'Powerhouse — makes ATP energy',          pos: [-1.5, -1.8, -0.5], scale: [0.48, 0.28, 0.28], color: '#ef4444', shape: 'box' },
  { id: 'er',           name: 'Endoplasmic Reticulum', fn: 'Folds proteins, makes lipids',  pos: [1.5, 0.8, -0.5],   scale: [0.9, 0.5, 0.4], color: '#fbbf24', shape: 'torus' },
  { id: 'golgi',        name: 'Golgi Apparatus', fn: 'Packages + ships proteins',           pos: [-2.0, 1.5, 0],     scale: [0.7, 0.3, 0.3], color: '#34d399', shape: 'torus' },
  { id: 'ribo1',        name: 'Ribosome',     fn: 'Builds proteins from mRNA',              pos: [1.0, 1.8, 0.6],    scale: [0.18, 0.18, 0.18], color: '#38bdf8', shape: 'sphere' },
  { id: 'ribo2',        name: 'Ribosome',     fn: 'Builds proteins from mRNA',              pos: [-0.8, 2.0, -0.5],  scale: [0.18, 0.18, 0.18], color: '#38bdf8', shape: 'sphere' },
  { id: 'ribo3',        name: 'Ribosome',     fn: 'Builds proteins from mRNA',              pos: [0.5, -2.2, 0.4],   scale: [0.18, 0.18, 0.18], color: '#38bdf8', shape: 'sphere' },
  { id: 'lyso',         name: 'Lysosome',     fn: 'Digests waste with enzymes',             pos: [2.3, 1.0, 0.8],    scale: [0.32, 0.32, 0.32], color: '#f472b6', shape: 'sphere' },
  { id: 'vac',          name: 'Vacuole',      fn: 'Stores water, nutrients, waste',         pos: [-1.8, -0.8, 1.0],  scale: [0.45, 0.45, 0.45], color: '#67e8f9', shape: 'sphere' },
]

interface SimProps { params: any; playing: boolean }

function CellSim({ playing }: SimProps) {
  const [hover, setHover] = useState<string | null>(null)
  const hovered = ORGANELLES.find(o => o.id === hover)

  return (
    <Canvas camera={{ position: [4, 3, 7], fov: 55 }} style={{ background: 'radial-gradient(circle at center, #0a1a18 0%, #0a0a18 70%)' }}>
      <ambientLight intensity={0.55} />
      <pointLight position={[5, 6, 4]} intensity={1.4} color="#a5b4fc" />
      <Stars radius={40} depth={20} count={400} factor={2} fade />

      {/* Cell membrane (translucent outer sphere) */}
      <mesh>
        <sphereGeometry args={[3.5, 48, 48]} />
        <meshPhysicalMaterial
          color="#34d399" transparent opacity={0.06}
          roughness={0.2} transmission={0.9} thickness={0.5}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[3.5, 32, 32]} />
        <meshBasicMaterial color="#34d399" wireframe transparent opacity={0.08} />
      </mesh>

      <Cytoplasm playing={playing} />

      {ORGANELLES.map(o => {
        const isHover = hover === o.id
        return (
          <group key={o.id} position={o.pos}
            onPointerOver={(e) => { e.stopPropagation(); setHover(o.id); document.body.style.cursor = 'pointer' }}
            onPointerOut={() => { setHover(null); document.body.style.cursor = 'default' }}>
            {o.shape === 'sphere' && (
              <mesh scale={o.scale}>
                <sphereGeometry args={[1, 24, 24]} />
                <meshStandardMaterial color={o.color} roughness={0.3}
                  emissive={o.color} emissiveIntensity={isHover ? 0.6 : 0.15} />
              </mesh>
            )}
            {o.shape === 'box' && (
              <mesh scale={o.scale}>
                <capsuleGeometry args={[1, 1.6, 6, 12]} />
                <meshStandardMaterial color={o.color} roughness={0.3}
                  emissive={o.color} emissiveIntensity={isHover ? 0.6 : 0.15} />
              </mesh>
            )}
            {o.shape === 'torus' && (
              <mesh scale={o.scale}>
                <torusGeometry args={[1, 0.4, 8, 24]} />
                <meshStandardMaterial color={o.color} roughness={0.3}
                  emissive={o.color} emissiveIntensity={isHover ? 0.6 : 0.15} />
              </mesh>
            )}
          </group>
        )
      })}

      {hovered && (
        <Text position={[hovered.pos[0], hovered.pos[1] + 0.6, hovered.pos[2]]}
          fontSize={0.18} color="#fafafa" anchorX="center"
          outlineWidth={0.02} outlineColor="#000">
          {hovered.name}
        </Text>
      )}

      <OrbitControls enablePan={false} minDistance={5} maxDistance={20} />
    </Canvas>
  )
}

function Cytoplasm({ playing }: { playing: boolean }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (ref.current && playing) ref.current.rotation.y += dt * 0.05 })
  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[3.4, 32, 32]} />
        <meshStandardMaterial color="#0f766e" transparent opacity={0.04} side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

export default function CellLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Animal Cell" subject="Biology" topic="Cell Structure · Class 9"
      description="Hover any organelle to see its name. The translucent green sphere is the cell membrane. The purple core is the nucleus."
      Sim={CellSim}
      defaultParams={{}}
      controls={[]}
      aiPrompt={() => `An animal cell with these organelles: nucleus, mitochondria, endoplasmic reticulum, golgi apparatus, ribosomes, lysosomes, vacuole. Explain the function of each, why the cell needs each one, and the difference between this and a plant cell.`}
      onBack={onBack}
    />
  )
}
