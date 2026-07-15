import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import LabScene from './LabScene'
import * as THREE from 'three'
import LabShell from './LabShell'

interface SimProps {
  params: { temperature: number; speed: number }
  playing: boolean
}

type AtomState = { sym: string; color: string; r: number; reactant: [number, number, number]; product: [number, number, number] }

const ATOMS: AtomState[] = [
  { sym: 'C', color: '#374151', r: 0.45, reactant: [-3, 0, 0],         product: [1.5, 0.5, 0] },     
  { sym: 'H', color: '#fafafa', r: 0.25, reactant: [-3.7, 0.7, 0],    product: [4.5, 1.5, 0] },     
  { sym: 'H', color: '#fafafa', r: 0.25, reactant: [-2.3, 0.7, 0],    product: [3.7, 1.5, 0] },     
  { sym: 'H', color: '#fafafa', r: 0.25, reactant: [-3.7, -0.7, 0.7], product: [4.5, -1.5, 0] },    
  { sym: 'H', color: '#fafafa', r: 0.25, reactant: [-2.3, -0.7, -0.7],product: [3.7, -1.5, 0] },    
  { sym: 'O', color: '#ef4444', r: 0.4, reactant: [3, 0.5, 0],         product: [2.4, 0.5, 0] },    
  { sym: 'O', color: '#ef4444', r: 0.4, reactant: [3.8, 0.5, 0],       product: [0.6, 0.5, 0] },    
  { sym: 'O', color: '#ef4444', r: 0.4, reactant: [3, -0.5, 0],        product: [4.1, 1.5, 0] },    
  { sym: 'O', color: '#ef4444', r: 0.4, reactant: [3.8, -0.5, 0],      product: [4.1, -1.5, 0] },   
]

function ReactionSim({ params, playing }: SimProps) {
  return (
    <LabScene cameraPos={[0, 1.5, 9]} cameraFov={55} tint="#1a0a18" particles={45}>
      <pointLight position={[0, 0, 0]} intensity={params.temperature / 200} color="#7C6BF6" distance={8} />
      <ReactionAtoms params={params} playing={playing} />
      <Text position={[-3, -3, 0]} fontSize={0.4} color="#B1B5BA" anchorX="center">CH4 + 2O2</Text>
      <Text position={[ 0, -3, 0]} fontSize={0.4} color="#C7D2E8" anchorX="center">→</Text>
      <Text position={[ 3, -3, 0]} fontSize={0.4} color="#B1B5BA" anchorX="center">CO2 + 2H2O</Text>
      <OrbitControls enablePan={false} minDistance={6} maxDistance={20} />
    </LabScene>
  )
}

function ReactionAtoms({ params, playing }: SimProps) {
  const groupRef = useRef<THREE.Group>(null)
  const tRef = useRef(0)   

  useFrame((_, dt) => {
    if (!playing) return
    const cycleSpeed = (params.temperature / 600) * params.speed
    tRef.current += dt * cycleSpeed
    if (tRef.current > 2) tRef.current = 0
    const t = tRef.current
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
