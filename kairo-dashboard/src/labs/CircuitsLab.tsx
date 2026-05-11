/**
 * Circuits Lab — battery, resistor, bulb in series.
 * Animated dots show "current" flowing. Bulb brightness scales with I = V/R.
 */
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import LabShell from './LabShell'
import LabScene from './LabScene'

interface SimProps {
  params: { voltage: number; resistance: number }
  playing: boolean
}

function CircuitsSim({ params, playing }: SimProps) {
  return (
    <LabScene
      cameraPos={[0, 0, 9]}
      cameraFov={50}
      tint="#0c1428"
      fogColor="#0a0a18"
      particles={40}
      stars={false}
    >
      <Wire />
      <Battery voltage={params.voltage} />
      <Resistor resistance={params.resistance} />
      <Bulb current={params.voltage / params.resistance} />
      <CurrentDots {...params} playing={playing} />
      <OrbitControls enablePan={false} minDistance={6} maxDistance={20} />
    </LabScene>
  )
}

const PATH_POINTS = (() => {
  // Rectangular loop, anti-clockwise from bottom-left
  const w = 5, h = 3
  const pts = []
  const N = 100
  for (let i = 0; i < N / 4; i++) pts.push([-w + (2 * w * i) / (N / 4), -h, 0])         // bottom
  for (let i = 0; i < N / 4; i++) pts.push([w, -h + (2 * h * i) / (N / 4), 0])           // right
  for (let i = 0; i < N / 4; i++) pts.push([w - (2 * w * i) / (N / 4), h, 0])            // top
  for (let i = 0; i < N / 4; i++) pts.push([-w, h - (2 * h * i) / (N / 4), 0])           // left
  return pts as [number, number, number][]
})()

function Wire() {
  const points = useMemo(() => PATH_POINTS.map(p => new THREE.Vector3(...p)), [])
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points])
  return <line>
    <primitive object={geometry} attach="geometry" />
    <lineBasicMaterial color="#52525b" linewidth={2} />
  </line>
}

function Battery({ voltage }: { voltage: number }) {
  return (
    <group position={[-5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <mesh><boxGeometry args={[1.4, 0.6, 0.5]} /><meshStandardMaterial color="#1f2937" /></mesh>
      <mesh position={[0, 0.4, 0]}><boxGeometry args={[1.5, 0.04, 0.55]} /><meshBasicMaterial color="#fbbf24" /></mesh>
      <mesh position={[0, -0.4, 0]}><boxGeometry args={[1.5, 0.04, 0.55]} /><meshBasicMaterial color="#a1a1aa" /></mesh>
      <mesh position={[0, 0, 0.32]}>
        <planeGeometry args={[1.0, 0.4]} />
        <meshBasicMaterial color="#000" />
      </mesh>
    </group>
  )
}

function Resistor({ resistance }: { resistance: number }) {
  return (
    <group position={[0, -3, 0]}>
      <mesh><boxGeometry args={[1.6, 0.6, 0.4]} /><meshStandardMaterial color="#a3a3a3" /></mesh>
      <mesh position={[-0.5, 0.34, 0]}><boxGeometry args={[0.1, 0.08, 0.42]} /><meshBasicMaterial color="#7c2d12" /></mesh>
      <mesh position={[-0.2, 0.34, 0]}><boxGeometry args={[0.1, 0.08, 0.42]} /><meshBasicMaterial color="#fbbf24" /></mesh>
      <mesh position={[0.1, 0.34, 0]}><boxGeometry args={[0.1, 0.08, 0.42]} /><meshBasicMaterial color="#dc2626" /></mesh>
      <mesh position={[0.4, 0.34, 0]}><boxGeometry args={[0.1, 0.08, 0.42]} /><meshBasicMaterial color="#a3a3a3" /></mesh>
    </group>
  )
}

function Bulb({ current }: { current: number }) {
  const intensity = Math.min(1, current / 5)
  return (
    <group position={[0, 3, 0]}>
      <mesh>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshStandardMaterial
          color="#fbbf24" emissive="#fbbf24"
          emissiveIntensity={intensity * 1.2}
          transparent opacity={0.4 + intensity * 0.5}
        />
      </mesh>
      <pointLight position={[0, 0, 0]} intensity={intensity * 4} color="#fbbf24" distance={6} />
      <mesh position={[0, -0.55, 0]}><cylinderGeometry args={[0.2, 0.25, 0.3, 12]} /><meshStandardMaterial color="#52525b" /></mesh>
    </group>
  )
}

function CurrentDots({ voltage, resistance, playing }: any) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const haloRef = useRef<THREE.InstancedMesh>(null)
  const offsetRef = useRef(0)
  const I = voltage / resistance
  const N = 36

  // Bigger dots + glow halo when current is higher
  const dotScale  = Math.min(1.4, 0.7 + I * 0.08)
  const haloScale = dotScale * 2.2
  // Hue shifts cool (blue) → warm (yellow) as current rises
  const dotColor  = new THREE.Color().lerpColors(
    new THREE.Color('#22d3ee'), new THREE.Color('#fbbf24'),
    Math.min(1, I / 8)
  )

  useFrame((_, dt) => {
    if (!ref.current || !playing) return
    // Current speed proportional to I — faster current at high voltage / low R
    offsetRef.current += dt * Math.min(1.2, I * 0.06)
    if (offsetRef.current > 1) offsetRef.current %= 1
    const tmp = new THREE.Object3D()
    for (let i = 0; i < N; i++) {
      const t = (i / N + offsetRef.current) % 1
      const idx = Math.floor(t * PATH_POINTS.length)
      const p = PATH_POINTS[idx]
      // Main dot
      tmp.position.set(p[0], p[1], p[2] + 0.06)
      tmp.scale.setScalar(dotScale)
      tmp.updateMatrix()
      ref.current.setMatrixAt(i, tmp.matrix)
      // Halo at same position, larger + transparent
      if (haloRef.current) {
        tmp.scale.setScalar(haloScale)
        tmp.updateMatrix()
        haloRef.current.setMatrixAt(i, tmp.matrix)
      }
    }
    ref.current.instanceMatrix.needsUpdate = true
    if (haloRef.current) haloRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      {/* Outer glow halo — additive blending, larger */}
      <instancedMesh ref={haloRef} args={[undefined, undefined, N]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial
          color={dotColor}
          transparent opacity={0.18}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
      {/* Core electron dot — bright, emissive */}
      <instancedMesh ref={ref} args={[undefined, undefined, N]}>
        <sphereGeometry args={[0.06, 10, 10]} />
        <meshStandardMaterial
          color={dotColor}
          emissive={dotColor}
          emissiveIntensity={1.4}
          roughness={0.2}
        />
      </instancedMesh>
    </>
  )
}

export default function CircuitsLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Electric Circuits" subject="Physics" topic="Ohm's Law · Class 10-12"
      description="A simple series circuit. Tweak voltage and resistance — watch the current speed up, the bulb glow brighter. I = V / R."
      Sim={CircuitsSim}
      defaultParams={{ voltage: 9, resistance: 5 }}
      controls={[
        { key: 'voltage',    label: 'Voltage',    type: 'slider', value: 9, min: 1, max: 24, step: 0.5, unit: 'V' },
        { key: 'resistance', label: 'Resistance', type: 'slider', value: 5, min: 1, max: 20, step: 0.5, unit: 'Ω' },
      ]}
      aiPrompt={p => `A series circuit with a ${p.voltage}V battery and ${p.resistance}Ω resistor. Compute the current I = V/R, explain Ohm's Law, why the bulb gets brighter with higher current, and give a real-world example (e.g. household appliances).`}
      onBack={onBack}
    />
  )
}
