import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import LabScene from './LabScene'
import * as THREE from 'three'
import LabShell from './LabShell'

interface SimProps {
  params: { angle: number; velocity: number; gravity: number }
  playing: boolean
}

function ProjectileSim({ params, playing }: SimProps) {
  return (
    <LabScene cameraPos={[12, 7, 14]} cameraFov={55} tint="#0c1428" particles={45}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      <Grid args={[60, 60]} cellSize={1} cellColor="#27272a" sectionSize={5} sectionColor="#4B5563"
        fadeDistance={40} infiniteGrid position={[0, 0.001, 0]} />
      <Cannon angle={params.angle} />
      <Projectile {...params} playing={playing} />
      <OrbitControls enablePan={false} minDistance={8} maxDistance={50} />
    </LabScene>
  )
}

function Cannon({ angle }: { angle: number }) {
  return (
    <group position={[-10, 0.4, 0]}>
      <mesh>
        <cylinderGeometry args={[0.5, 0.5, 0.8, 16]} />
        <meshStandardMaterial color="#6B7280" />
      </mesh>
      <group rotation={[0, 0, (angle * Math.PI) / 180]}>
        <mesh position={[0.8, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.25, 0.3, 1.6, 16]} />
          <meshStandardMaterial color="#4B5563" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>
    </group>
  )
}

function Projectile({ angle, velocity, gravity, playing }: any) {
  const ballRef = useRef<THREE.Mesh>(null)
  const trailRef = useRef<THREE.Points>(null)
  const trailGeom = useMemo(() => new THREE.BufferGeometry(), [])
  const stateRef = useRef({ x: -10, y: 0.4, vx: 0, vy: 0, t: 0, points: [] as number[] })

  useEffect(() => {
    const a = (angle * Math.PI) / 180
    stateRef.current = {
      x: -10, y: 0.4,
      vx: velocity * Math.cos(a), vy: velocity * Math.sin(a),
      t: 0, points: [],
    }
  }, [angle, velocity, gravity])

  useFrame((_, dt) => {
    if (!playing) return
    const s = stateRef.current
    const step = Math.min(dt, 0.04)
    if (s.y > 0.4 || s.t === 0) {
      s.vy -= gravity * step
      s.x += s.vx * step
      s.y += s.vy * step
      s.t += step
      if (s.y < 0.4 && s.t > 0.1) {
        if (s.t < 60) {
          s.t = 100   
        }
      }
      if (ballRef.current) ballRef.current.position.set(s.x, Math.max(s.y, 0.4), 0)
      s.points.push(s.x, Math.max(s.y, 0.4), 0)
      if (s.points.length > 600) s.points.splice(0, 3)
      if (trailGeom) trailGeom.setAttribute('position', new THREE.Float32BufferAttribute(s.points, 3))
    } else if (s.t === 100) {
      s.t = 100.5 + step
    } else if (s.t > 102) {
      const a = (angle * Math.PI) / 180
      stateRef.current = {
        x: -10, y: 0.4,
        vx: velocity * Math.cos(a), vy: velocity * Math.sin(a),
        t: 0, points: [],
      }
    } else {
      s.t += step
    }
  })

  return (
    <group>
      <mesh ref={ballRef} position={[-10, 0.4, 0]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color="#7C6BF6" emissive="#7C6BF6" emissiveIntensity={0.4} />
      </mesh>
      <points ref={trailRef} geometry={trailGeom}>
        <pointsMaterial color="#C7D2E8" size={0.12} transparent opacity={0.7} />
      </points>
    </group>
  )
}

export default function ProjectileLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Projectile Motion" subject="Physics" topic="Kinematics · Class 11"
      description="Fire a projectile at any angle and velocity. Trail traces the parabolic path. Maximum range happens at 45°."
      Sim={ProjectileSim}
      defaultParams={{ angle: 45, velocity: 18, gravity: 9.8 }}
      controls={[
        { key: 'angle',     label: 'Launch angle', type: 'slider', value: 45, min: 5,  max: 85,  step: 1,   unit: '°' },
        { key: 'velocity',  label: 'Velocity',     type: 'slider', value: 18, min: 5,  max: 35,  step: 0.5, unit: 'm/s' },
        { key: 'gravity',   label: 'Gravity',      type: 'slider', value: 9.8, min: 1, max: 25,  step: 0.1, unit: 'm/s²' },
      ]}
      aiPrompt={p => `A projectile is fired at ${p.angle}° with initial velocity ${p.velocity} m/s under gravity ${p.gravity} m/s². Explain horizontal vs vertical motion, why range = (v²·sin(2θ))/g, and why 45° gives maximum range.`}
      onBack={onBack}
    />
  )
}
