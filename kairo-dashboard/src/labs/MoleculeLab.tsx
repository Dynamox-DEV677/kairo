/**
 * Molecule Lab — pick a molecule, view 3D structure with bond lines + atom labels.
 */
import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Text } from '@react-three/drei'
import * as THREE from 'three'
import LabShell from './LabShell'

interface Atom { sym: string; pos: [number, number, number]; color: string; radius: number }
interface Bond { a: number; b: number; order: 1 | 2 | 3 }
interface Molecule { name: string; formula: string; atoms: Atom[]; bonds: Bond[] }

const MOLECULES: Record<string, Molecule> = {
  water: {
    name: 'Water', formula: 'H₂O',
    atoms: [
      { sym: 'O', pos: [0, 0, 0],          color: '#ef4444', radius: 0.5 },
      { sym: 'H', pos: [0.95, 0.55, 0],    color: '#fafafa', radius: 0.3 },
      { sym: 'H', pos: [-0.95, 0.55, 0],   color: '#fafafa', radius: 0.3 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }],
  },
  methane: {
    name: 'Methane', formula: 'CH₄',
    atoms: [
      { sym: 'C', pos: [0, 0, 0],            color: '#374151', radius: 0.55 },
      { sym: 'H', pos: [1, 1, 1],            color: '#fafafa', radius: 0.3 },
      { sym: 'H', pos: [-1, -1, 1],          color: '#fafafa', radius: 0.3 },
      { sym: 'H', pos: [1, -1, -1],          color: '#fafafa', radius: 0.3 },
      { sym: 'H', pos: [-1, 1, -1],          color: '#fafafa', radius: 0.3 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 }, { a: 0, b: 4, order: 1 }],
  },
  carbon_dioxide: {
    name: 'Carbon Dioxide', formula: 'CO₂',
    atoms: [
      { sym: 'C', pos: [0, 0, 0],   color: '#374151', radius: 0.5 },
      { sym: 'O', pos: [1.5, 0, 0], color: '#ef4444', radius: 0.5 },
      { sym: 'O', pos: [-1.5, 0, 0], color: '#ef4444', radius: 0.5 },
    ],
    bonds: [{ a: 0, b: 1, order: 2 }, { a: 0, b: 2, order: 2 }],
  },
  ammonia: {
    name: 'Ammonia', formula: 'NH₃',
    atoms: [
      { sym: 'N', pos: [0, 0, 0],            color: '#3b82f6', radius: 0.5 },
      { sym: 'H', pos: [0.95, -0.4, 0],      color: '#fafafa', radius: 0.3 },
      { sym: 'H', pos: [-0.5, -0.4, 0.85],   color: '#fafafa', radius: 0.3 },
      { sym: 'H', pos: [-0.5, -0.4, -0.85],  color: '#fafafa', radius: 0.3 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 }],
  },
  ethanol: {
    name: 'Ethanol', formula: 'C₂H₆O',
    atoms: [
      { sym: 'C', pos: [-1.4, 0, 0],   color: '#374151', radius: 0.5 },
      { sym: 'C', pos: [0, 0, 0],      color: '#374151', radius: 0.5 },
      { sym: 'O', pos: [1.4, 0, 0],    color: '#ef4444', radius: 0.5 },
      { sym: 'H', pos: [2.2, 0.7, 0],  color: '#fafafa', radius: 0.3 },
      { sym: 'H', pos: [-1.9, 0.9, 0], color: '#fafafa', radius: 0.3 },
      { sym: 'H', pos: [-1.9, -0.5, 0.8], color: '#fafafa', radius: 0.3 },
      { sym: 'H', pos: [-1.9, -0.5, -0.8], color: '#fafafa', radius: 0.3 },
      { sym: 'H', pos: [0.4, 0.9, 0],  color: '#fafafa', radius: 0.3 },
      { sym: 'H', pos: [0.4, -0.9, 0], color: '#fafafa', radius: 0.3 },
    ],
    bonds: [
      { a: 0, b: 1, order: 1 }, { a: 1, b: 2, order: 1 }, { a: 2, b: 3, order: 1 },
      { a: 0, b: 4, order: 1 }, { a: 0, b: 5, order: 1 }, { a: 0, b: 6, order: 1 },
      { a: 1, b: 7, order: 1 }, { a: 1, b: 8, order: 1 },
    ],
  },
}

interface SimProps {
  params: { molecule: string }
  playing: boolean
}

function MoleculeSim({ params, playing }: SimProps) {
  const mol = MOLECULES[params.molecule] || MOLECULES.water
  return (
    <Canvas camera={{ position: [4, 3, 6], fov: 50 }} style={{ background: 'radial-gradient(circle at center, #1a1a2e 0%, #0a0a18 70%)' }}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 6, 4]} intensity={1.2} color="#a5b4fc" />
      <Stars radius={40} depth={20} count={500} factor={2} fade />
      <RotatingMolecule mol={mol} playing={playing} />
      <Text position={[0, -3, 0]} fontSize={0.45} color="#fafafa">{mol.formula}</Text>
      <OrbitControls enablePan={false} minDistance={3} maxDistance={15} autoRotate={playing} autoRotateSpeed={0.6} />
    </Canvas>
  )
}

function RotatingMolecule({ mol, playing }: { mol: Molecule; playing: boolean }) {
  return (
    <group>
      {mol.atoms.map((a, i) => (
        <group key={i} position={a.pos}>
          <mesh>
            <sphereGeometry args={[a.radius, 24, 24]} />
            <meshStandardMaterial color={a.color} roughness={0.4} metalness={0.2} />
          </mesh>
          <Text position={[0, 0, a.radius + 0.05]} fontSize={0.18} color="#000" anchorX="center" anchorY="middle">
            {a.sym}
          </Text>
        </group>
      ))}
      {mol.bonds.map((b, i) => {
        const a = new THREE.Vector3(...mol.atoms[b.a].pos)
        const c = new THREE.Vector3(...mol.atoms[b.b].pos)
        const dir = c.clone().sub(a)
        const len = dir.length()
        const mid = a.clone().add(c).multiplyScalar(0.5)
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
        const offsets = b.order === 1 ? [[0, 0, 0]]
          : b.order === 2 ? [[0.07, 0, 0], [-0.07, 0, 0]]
          : [[0.1, 0, 0], [0, 0, 0], [-0.1, 0, 0]]
        return offsets.map((off, j) => (
          <mesh key={`${i}-${j}`} position={mid.toArray()} quaternion={quat}>
            <cylinderGeometry args={[0.05, 0.05, len, 6]} />
            <meshStandardMaterial color="#a1a1aa" />
          </mesh>
        ))
      })}
    </group>
  )
}

export default function MoleculeLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Molecule Builder" subject="Chemistry" topic="Bonding · Class 9-12"
      description="3D structure of common molecules. Single bonds are one rod; double bonds are two parallel rods; triple bonds are three. Bond angles match real geometry."
      Sim={MoleculeSim}
      defaultParams={{ molecule: 'water' }}
      controls={[
        { key: 'molecule', label: 'Molecule', type: 'select', value: 'water', options: [
          { value: 'water', label: 'Water (H₂O)' },
          { value: 'methane', label: 'Methane (CH₄)' },
          { value: 'carbon_dioxide', label: 'Carbon Dioxide (CO₂)' },
          { value: 'ammonia', label: 'Ammonia (NH₃)' },
          { value: 'ethanol', label: 'Ethanol (C₂H₆O)' },
        ]},
      ]}
      aiPrompt={p => `Show the structure of ${MOLECULES[p.molecule]?.name || p.molecule} (${MOLECULES[p.molecule]?.formula || ''}). Explain its molecular geometry (bent, tetrahedral, linear, trigonal pyramidal), hybridization, polarity, and one important real-world use.`}
      onBack={onBack}
    />
  )
}
