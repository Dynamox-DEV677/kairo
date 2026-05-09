/**
 * Pendulum Lab — Simple Harmonic Motion.
 * Bob on a string. Swings under gravity with optional damping.
 */
import { useRef, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import LabShell from './LabShell'

interface SimProps {
  params: { length: number; gravity: number; damping: number; angle: number }
  playing: boolean
}

function PendulumSim({ params, playing }: SimProps) {
  return (
    <Canvas camera={{ position: [0, 1, 8], fov: 55 }}
      style={{ background: 'linear-gradient(180deg,#0a0a18 0%,#0a0a0a 70%)' }}>
      <ambientLight intensity={0.45} />
      <directionalLight position={[5, 8, 5]} intensity={1} color="#a5b4fc" />
      <Stars radius={40} depth={20} count={800} factor={3} fade speed={0.2} />
      <Pivot />
      <Pendulum {...params} playing={playing} />
      <OrbitControls enablePan={false} minDistance={5} maxDistance={20} />
    </Canvas>
  )
}

function Pivot() {
  return (
    <mesh position={[0, 4, 0]}>
      <boxGeometry args={[1.5, 0.15, 0.3]} />
      <meshStandardMaterial color="#52525b" />
    </mesh>
  )
}

function Pendulum({ length, gravity, damping, angle, playing }: any) {
  const stringRef = useRef<THREE.Mesh>(null)
  const bobRef = useRef<THREE.Mesh>(null)
  const stateRef = useRef({ theta: (angle * Math.PI) / 180, omega: 0 })

  useEffect(() => { stateRef.current = { theta: (angle * Math.PI) / 180, omega: 0 } }, [angle, length])

  useFrame((_, dt) => {
    if (!playing) return
    const s = stateRef.current
    const step = Math.min(dt, 0.05)
    // Pendulum equation: theta'' = -(g/L) sin(theta) - damping * theta'
    const accel = -(gravity / length) * Math.sin(s.theta) - damping * s.omega
    s.omega += accel * step
    s.theta += s.omega * step

    const bobX = length * Math.sin(s.theta)
    const bobY = 4 - length * Math.cos(s.theta)
    if (bobRef.current) {
      bobRef.current.position.set(bobX, bobY, 0)
    }
    if (stringRef.current) {
      stringRef.current.position.set(bobX / 2, (4 + bobY) / 2, 0)
      stringRef.current.rotation.z = -s.theta
      stringRef.current.scale.y = length / 1
    }
  })

  return (
    <group>
      <mesh ref={stringRef} position={[0, 4 - length / 2, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1, 6]} />
        <meshBasicMaterial color="#a1a1aa" />
      </mesh>
      <mesh ref={bobRef} position={[0, 4 - length, 0]} castShadow>
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.2} />
      </mesh>
    </group>
  )
}

export default function PendulumLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Pendulum Motion" subject="Physics" topic="Simple Harmonic Motion · Class 11"
      description="A classic pendulum. Adjust length, gravity, and damping. Period depends only on length and gravity, not mass — a counterintuitive result Galileo discovered."
      Sim={PendulumSim}
      defaultParams={{ length: 3, gravity: 9.8, damping: 0.05, angle: 30 }}
      controls={[
        { key: 'length',   label: 'String length', type: 'slider', value: 3,    min: 1, max: 5,    step: 0.1, unit: 'm' },
        { key: 'gravity',  label: 'Gravity',        type: 'slider', value: 9.8,  min: 1, max: 25,   step: 0.1, unit: 'm/s²' },
        { key: 'damping',  label: 'Air damping',    type: 'slider', value: 0.05, min: 0, max: 0.5,  step: 0.01 },
        { key: 'angle',    label: 'Initial angle',  type: 'slider', value: 30,   min: 5, max: 80,   step: 1,   unit: '°' },
      ]}
      aiPrompt={p => `A pendulum of length ${p.length} m swings under gravity ${p.gravity} m/s² with damping ${p.damping} and initial angle ${p.angle}°. Explain SHM, the period formula T = 2π√(L/g), why mass doesn't appear, and the small-angle approximation.`}
      onBack={onBack}
    />
  )
}
