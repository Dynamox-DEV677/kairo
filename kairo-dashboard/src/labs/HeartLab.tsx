/**
 * Heart Lab — stylized 4-chamber pulsing heart with flowing blood particles.
 * BPM slider controls beat rate.
 */
import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Text } from '@react-three/drei'
import * as THREE from 'three'
import LabShell from './LabShell'

interface SimProps {
  params: { bpm: number }
  playing: boolean
}

function HeartSim({ params, playing }: SimProps) {
  return (
    <Canvas camera={{ position: [4, 2, 7], fov: 55 }} style={{ background: 'radial-gradient(circle at center, #1a0a14 0%, #0a0a18 70%)' }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[3, 4, 4]} intensity={1.4} color="#fbbf24" />
      <pointLight position={[-3, -2, 3]} intensity={0.8} color="#ef4444" />
      <Stars radius={40} depth={20} count={400} factor={2} fade />
      <PulsingHeart bpm={params.bpm} playing={playing} />
      <BloodFlow bpm={params.bpm} playing={playing} />
      <Text position={[0, -3.5, 0]} fontSize={0.4} color="#fafafa">{params.bpm} BPM</Text>
      <OrbitControls enablePan={false} minDistance={4} maxDistance={20} />
    </Canvas>
  )
}

function PulsingHeart({ bpm, playing }: { bpm: number; playing: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const tRef = useRef(0)

  useFrame((_, dt) => {
    if (!playing || !groupRef.current) return
    tRef.current += dt
    const period = 60 / bpm
    const phase = (tRef.current % period) / period
    // Two beats per cycle: lub (0.0-0.15) + dub (0.3-0.45)
    let scale = 1
    if (phase < 0.15) scale = 1 + 0.18 * Math.sin((phase / 0.15) * Math.PI)
    else if (phase > 0.3 && phase < 0.45) scale = 1 + 0.12 * Math.sin(((phase - 0.3) / 0.15) * Math.PI)
    groupRef.current.scale.setScalar(scale)
  })

  return (
    <group ref={groupRef}>
      {/* Right atrium */}
      <mesh position={[-0.7, 1, 0]}>
        <sphereGeometry args={[0.65, 24, 24]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.4} emissive="#1e40af" emissiveIntensity={0.2} />
      </mesh>
      {/* Right ventricle */}
      <mesh position={[-0.6, -0.4, 0]}>
        <sphereGeometry args={[0.85, 24, 24]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.4} emissive="#1e3a8a" emissiveIntensity={0.3} />
      </mesh>
      {/* Left atrium */}
      <mesh position={[0.7, 1, 0]}>
        <sphereGeometry args={[0.65, 24, 24]} />
        <meshStandardMaterial color="#ef4444" roughness={0.4} emissive="#b91c1c" emissiveIntensity={0.25} />
      </mesh>
      {/* Left ventricle */}
      <mesh position={[0.6, -0.4, 0]}>
        <sphereGeometry args={[0.95, 24, 24]} />
        <meshStandardMaterial color="#dc2626" roughness={0.4} emissive="#7f1d1d" emissiveIntensity={0.3} />
      </mesh>
      {/* Aorta */}
      <mesh position={[0.5, 1.8, 0]} rotation={[0, 0, -0.3]}>
        <cylinderGeometry args={[0.22, 0.22, 1.5, 12]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
      {/* Vena cava */}
      <mesh position={[-0.5, 1.8, 0]} rotation={[0, 0, 0.3]}>
        <cylinderGeometry args={[0.22, 0.22, 1.5, 12]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>

      {/* Labels */}
      <Text position={[-1.7, 1.3, 0]} fontSize={0.16} color="#93c5fd" anchorX="right">RA</Text>
      <Text position={[-1.7, -0.4, 0]} fontSize={0.16} color="#93c5fd" anchorX="right">RV</Text>
      <Text position={[1.7, 1.3, 0]} fontSize={0.16} color="#fca5a5" anchorX="left">LA</Text>
      <Text position={[1.7, -0.4, 0]} fontSize={0.16} color="#fca5a5" anchorX="left">LV</Text>
    </group>
  )
}

function BloodFlow({ bpm, playing }: { bpm: number; playing: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const tRef = useRef(0)
  const N = 50

  // Circular path through chambers
  const path = useMemo(() => {
    const pts: [number, number, number][] = []
    const steps = 200
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2
      pts.push([Math.cos(t) * 1.4, Math.sin(t) * 1.0, Math.sin(t * 2) * 0.3])
    }
    return pts
  }, [])

  useFrame((_, dt) => {
    if (!ref.current || !playing) return
    tRef.current += dt * (bpm / 60)
    const tmp = new THREE.Object3D()
    for (let i = 0; i < N; i++) {
      const t = ((i / N) + tRef.current * 0.1) % 1
      const idx = Math.floor(t * path.length)
      const p = path[idx]
      tmp.position.set(p[0], p[1], p[2])
      tmp.updateMatrix()
      ref.current.setMatrixAt(i, tmp.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]}>
      <sphereGeometry args={[0.05, 6, 6]} />
      <meshBasicMaterial color="#fca5a5" />
    </instancedMesh>
  )
}

export default function HeartLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Human Heart" subject="Biology" topic="Circulation · Class 10"
      description="Watch the four chambers contract in rhythm. Blue chambers handle deoxygenated blood (right side), red chambers oxygenated (left side). Particles trace the flow."
      Sim={HeartSim}
      defaultParams={{ bpm: 72 }}
      controls={[
        { key: 'bpm', label: 'Heart rate', type: 'slider', value: 72, min: 40, max: 180, step: 1, unit: 'bpm' },
      ]}
      aiPrompt={p => `A human heart beating at ${p.bpm} BPM. Explain the four chambers (RA, RV, LA, LV), the path of blood through pulmonary and systemic circulation, why the left ventricle has thicker walls, and what BPM ranges mean (resting, exercising, abnormal).`}
      onBack={onBack}
    />
  )
}
