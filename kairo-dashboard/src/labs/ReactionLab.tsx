/**
 * Chemical Reactions Lab — animated combustion of methane.
 * CH4 + 2 O2 → CO2 + 2 H2O
 * Atoms physically rearrange when "reaction" param triggers.
 */
import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Text } from '@react-three/drei'
import * as THREE from 'three'
import LabShell from './LabShell'

interface SimProps {
  params: { temperature: number; speed: number }
  playing: boolean
}

// Reactant + product positions for each atom (lerped over time)
type AtomState = { sym: string; color: string; r: number; reactant: [number, number, number]; product: [number, number, number] }

const ATOMS: AtomState[] = [
  // CH4 (left side)
  { sym: 'C', color: '#374151', r: 0.45, reactant: [-3, 0, 0],         product: [1.5, 0.5, 0] },     // becomes C in CO2
  { sym: 'H', color: '#fafafa', r: 0.25, reactant: [-3.7, 0.7, 0],    product: [4.5, 1.5, 0] },     // → H in H2O #1
  { sym: 'H', color: '#fafafa', r: 0.25, reactant: [-2.3, 0.7, 0],    product: [3.7, 1.5, 0] },     // → H in H2O #1
  { sym: 'H', color: '#fafafa', r: 0.25, reactant: [-3.7, -0.7, 0.7], product: [4.5, -1.5, 0] },    // → H in H2O #2
  { sym: 'H', color: '#fafafa', r: 0.25, reactant: [-2.3, -0.7, -0.7],product: [3.7, -1.5, 0] },    // → H in H2O #2
  // 2 O2 (right side)
  { sym: 'O', color: '#ef4444', r: 0.4, reactant: [3, 0.5, 0],         product: [2.4, 0.5, 0] },    // → O in CO2
  { sym: 'O', color: '#ef4444', r: 0.4, reactant: [3.8, 0.5, 0],       product: [0.6, 0.5, 0] },    // → O in CO2
  { sym: 'O', color: '#ef4444', r: 0.4, reactant: [3, -0.5, 0],        product: [4.1, 1.5, 0] },    // → O in H2O #1
  { sym: 'O', color: '#ef4444', r: 0.4, reactant: [3.8, -0.5, 0],      product: [4.1, -1.5, 0] },   // → O in H2O #2
]

function ReactionSim({ params, playing }: SimProps) {
  return (
    <Canvas camera={{ position: [0, 1.5, 9], fov: 55 }} style={{ background: 'radial-gradient(circle at center, #1a0a18 0%, #0a0a18 70%)' }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 6, 4]} intensity={1.2} color="#a5b4fc" />
      <pointLight position={[0, 0, 0]} intensity={params.temperature / 200} color="#fb923c" distance={8} />
      <Stars radius={40} depth={20} count={500} factor={2} fade />
      <ReactionAtoms params={params} playing={playing} />
      <Text position={[-3, -3, 0]} fontSize={0.4} color="#a1a1aa">CH₄ + 2O₂</Text>
      <Text position={[0, -3, 0]} fontSize={0.4} color="#fbbf24">→</Text>
      <Text position={[3, -3, 0]} fontSize={0.4} color="#a1a1aa">CO₂ + 2H₂O</Text>
      <OrbitControls enablePan={false} minDistance={6} maxDistance={20} />
    </Canvas>
  )
}

function ReactionAtoms({ params, playing }: SimProps) {
  const groupRef = useRef<THREE.Group>(null)
  const tRef = useRef(0)   // 0 → 1 → 0 oscillating

  useFrame((_, dt) => {
    if (!playing) return
    // Speed scales with temperature
    const cycleSpeed = (params.temperature / 600) * params.speed
    tRef.current += dt * cycleSpeed
    if (tRef.current > 2) tRef.current = 0
    const t = tRef.current
    // 0..1 = forward, 1..2 = back
    const lerpT = t < 1 ? smoothstep(t) : smoothstep(2 - t)

    if (!groupRef.current) return
    groupRef.current.children.forEach((child, i) => {
      const a = ATOMS[i]
      if (!a) return
      const x = a.reactant[0] + (a.product[0] - a.reactant[0]) * lerpT
      const y = a.reactant[1] + (a.product[1] - a.reactant[1]) * lerpT
      const z = a.reactant[2] + (a.product[2] - a.reactant[2]) * lerpT
      child.position.set(x, y, z)
    })
  })

  return (
    <group ref={groupRef}>
      {ATOMS.map((a, i) => (
        <group key={i} position={a.reactant}>
          <mesh>
            <sphereGeometry args={[a.r, 16, 16]} />
            <meshStandardMaterial color={a.color} roughness={0.4} emissive={a.color} emissiveIntensity={params.temperature / 1500} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function smoothstep(x: number) { return x * x * (3 - 2 * x) }

export default function ReactionLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Combustion of Methane" subject="Chemistry" topic="Stoichiometry · Class 10-12"
      description="CH₄ + 2O₂ → CO₂ + 2H₂O. Atoms rearrange but never disappear. Higher temperature speeds up the reaction."
      Sim={ReactionSim}
      defaultParams={{ temperature: 400, speed: 1 }}
      controls={[
        { key: 'temperature', label: 'Temperature', type: 'slider', value: 400, min: 100, max: 1500, step: 50, unit: 'K' },
        { key: 'speed',       label: 'Anim speed',  type: 'slider', value: 1,   min: 0.2, max: 3,    step: 0.1, unit: '×' },
      ]}
      aiPrompt={p => `Combustion of methane (CH₄ + 2O₂ → CO₂ + 2H₂O) at ${p.temperature} K. Explain conservation of atoms (no atoms appear or disappear), why this is exothermic, the activation energy concept, and where in real life this reaction matters (LPG stoves, natural gas heating).`}
      onBack={onBack}
    />
  )
}
