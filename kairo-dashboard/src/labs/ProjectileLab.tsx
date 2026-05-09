/**
 * Projectile Lab — fire a cannonball at any angle/velocity.
 * Traces parabolic path with a glowing trail.
 */
import { useRef, useEffect, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Grid } from '@react-three/drei'
import * as THREE from 'three'
import LabShell from './LabShell'

interface SimProps {
  params: { angle: number; velocity: number; gravity: number }
  playing: boolean
}

function ProjectileSim({ params, playing }: SimProps) {
  return (
    <Canvas camera={{ position: [12, 7, 14], fov: 55 }}
      style={{ background: 'linear-gradient(180deg,#0a0a18 0%,#0a0a0a 70%)' }}>
      <ambientLight intensity={0.45} />
      <directionalLight position={[6, 10, 4]} intensity={1.1} color="#a5b4fc" />
      <Stars radius={50} depth={25} count={1000} factor={3} fade />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      <Grid args={[60, 60]} cellSize={1} cellColor="#27272a" sectionSize={5} sectionColor="#3f3f46"
        fadeDistance={40} infiniteGrid position={[0, 0.001, 0]} />
      <Cannon angle={params.angle} />
      <Projectile {...params} playing={playing} />
      <OrbitControls enablePan={false} minDistance={8} maxDistance={50} />
    </Canvas>
  )
}

function Cannon({ angle }: { angle: number }) {
  return (
    <group position={[-10, 0.4, 0]}>
      <mesh>
        <cylinderGeometry args={[0.5, 0.5, 0.8, 16]} />
        <meshStandardMaterial color="#52525b" />
      </mesh>
      <group rotation={[0, 0, (angle * Math.PI) / 180]}>
        <mesh position={[0.8, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.25, 0.3, 1.6, 16]} />
          <meshStandardMaterial color="#3f3f46" metalness={0.6} roughness={0.4} />
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
        // hit ground — pause for a moment then reset
        if (s.t < 60) {
          s.t = 100   // marker for "landed"
        }
      }
      if (ballRef.current) ballRef.current.position.set(s.x, Math.max(s.y, 0.4), 0)
      // trail
      s.points.push(s.x, Math.max(s.y, 0.4), 0)
      if (s.points.length > 600) s.points.splice(0, 3)
      if (trailGeom) trailGeom.setAttribute('position', new THREE.Float32BufferAttribute(s.points, 3))
    } else if (s.t === 100) {
      // landed — wait then reset
      s.t = 100.5 + step
    } else if (s.t > 102) {
      // reset
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
        <meshStandardMaterial color="#fb923c" emissive="#fb923c" emissiveIntensity={0.4} />
      </mesh>
      <points ref={trailRef} geometry={trailGeom}>
        <pointsMaterial color="#fbbf24" size={0.12} transparent opacity={0.7} />
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
