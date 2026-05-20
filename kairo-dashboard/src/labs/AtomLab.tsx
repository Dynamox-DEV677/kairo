/**
 * Atom Lab — Bohr model with adjustable proton/neutron/electron count.
 * Element name updates from a small periodic-table lookup.
 */
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import LabScene from './LabScene'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import LabShell from './LabShell'

const ELEMENTS: Record<number, { sym: string; name: string }> = {
  1: { sym: 'H', name: 'Hydrogen' }, 2: { sym: 'He', name: 'Helium' },
  3: { sym: 'Li', name: 'Lithium' }, 4: { sym: 'Be', name: 'Beryllium' },
  5: { sym: 'B', name: 'Boron' }, 6: { sym: 'C', name: 'Carbon' },
  7: { sym: 'N', name: 'Nitrogen' }, 8: { sym: 'O', name: 'Oxygen' },
  9: { sym: 'F', name: 'Fluorine' }, 10: { sym: 'Ne', name: 'Neon' },
  11: { sym: 'Na', name: 'Sodium' }, 12: { sym: 'Mg', name: 'Magnesium' },
  13: { sym: 'Al', name: 'Aluminium' }, 14: { sym: 'Si', name: 'Silicon' },
  15: { sym: 'P', name: 'Phosphorus' }, 16: { sym: 'S', name: 'Sulfur' },
  17: { sym: 'Cl', name: 'Chlorine' }, 18: { sym: 'Ar', name: 'Argon' },
}

// Bohr shell capacities: 2, 8, 18, 32...
function distributeElectrons(total: number) {
  const shells: number[] = []
  let remaining = total
  let n = 1
  while (remaining > 0) {
    const cap = 2 * n * n
    const here = Math.min(remaining, cap)
    shells.push(here)
    remaining -= here
    n++
    if (n > 5) break
  }
  return shells
}

interface SimProps {
  params: { protons: number; neutrons: number }
  playing: boolean
}

function AtomSim({ params, playing }: SimProps) {
  const electronCount = params.protons   // neutral atom
  const shells = useMemo(() => distributeElectrons(electronCount), [electronCount])
  const elem = ELEMENTS[params.protons] || { sym: '?', name: 'Unknown' }

  return (
    <LabScene cameraPos={[0, 1, 9]} cameraFov={55} tint="#1a1a2e" particles={50}>
      {/* Pink nucleus glow — punches through the LabScene's neutral lighting */}
      <pointLight position={[0, 0, 0]} intensity={2.5} color="#ec4899" distance={6} />
      <Nucleus protons={params.protons} neutrons={params.neutrons} />
      {shells.map((count, i) => (
        <Shell key={i} radius={2 + i * 1.2} electrons={count} shellIdx={i} playing={playing} />
      ))}
      <Text position={[0, 4.5, 0]} fontSize={0.7} color="#fafafa" anchorX="center">
        {elem.sym}
      </Text>
      <Text position={[0, 3.8, 0]} fontSize={0.3} color="#B1B5BA" anchorX="center">
        {elem.name}
      </Text>
      <OrbitControls enablePan={false} minDistance={4} maxDistance={20} />
    </LabScene>
  )
}

function Nucleus({ protons, neutrons }: { protons: number; neutrons: number }) {
  const total = protons + neutrons
  const positions = useMemo(() => {
    const arr: [number, number, number][] = []
    for (let i = 0; i < total; i++) {
      // fibonacci sphere
      const phi = Math.acos(1 - 2 * (i + 0.5) / total)
      const theta = Math.PI * (1 + Math.sqrt(5)) * i
      const r = 0.4
      arr.push([r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi)])
    }
    return arr
  }, [total])
  return (
    <group>
      {positions.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial
            color={i < protons ? '#ef4444' : '#9CA3AF'}
            emissive={i < protons ? '#ef4444' : '#000'}
            emissiveIntensity={0.4}
          />
        </mesh>
      ))}
      {/* Outer glow */}
      <mesh>
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshBasicMaterial color="#ec4899" transparent opacity={0.08} />
      </mesh>
    </group>
  )
}

function Shell({ radius, electrons, shellIdx, playing }: any) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (ref.current && playing) {
      ref.current.rotation.y += dt * 0.4 / (shellIdx + 1)
      ref.current.rotation.x = shellIdx * 0.2
    }
  })
  return (
    <group ref={ref}>
      {/* Orbit ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.005, 4, 64]} />
        <meshBasicMaterial color="#4B5563" transparent opacity={0.5} />
      </mesh>
      {Array.from({ length: electrons }).map((_, i) => {
        const angle = (i / electrons) * Math.PI * 2
        return (
          <mesh key={i} position={[radius * Math.cos(angle), 0, radius * Math.sin(angle)]}>
            <sphereGeometry args={[0.13, 12, 12]} />
            <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.6} />
          </mesh>
        )
      })}
    </group>
  )
}

export default function AtomLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Atomic Structure" subject="Chemistry" topic="Bohr Model · Class 9-11"
      description="Drag protons in or out and watch the element transform. Electrons fill shells using the 2n² rule."
      Sim={AtomSim}
      defaultParams={{ protons: 6, neutrons: 6 }}
      controls={[
        { key: 'protons',  label: 'Protons',  type: 'slider', value: 6, min: 1, max: 18, step: 1 },
        { key: 'neutrons', label: 'Neutrons', type: 'slider', value: 6, min: 0, max: 22, step: 1 },
      ]}
      aiPrompt={p => `An atom with ${p.protons} protons and ${p.neutrons} neutrons (and ${p.protons} electrons for neutrality). Identify the element, explain the Bohr model, why electrons fill shells using the 2n² rule, and what this element is used for in real life.`}
      onBack={onBack}
    />
  )
}
