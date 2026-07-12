import { useMemo } from 'react'
import { OrbitControls, Grid, Text } from '@react-three/drei'
import * as THREE from 'three'
import LabShell from './LabShell'
import LabScene from './LabScene'

interface SimProps {
  params: { ax: number; ay: number; az: number; bx: number; by: number; bz: number }
  playing: boolean
}

function VectorsSim({ params }: SimProps) {
  const a = useMemo(() => new THREE.Vector3(params.ax, params.ay, params.az), [params.ax, params.ay, params.az])
  const b = useMemo(() => new THREE.Vector3(params.bx, params.by, params.bz), [params.bx, params.by, params.bz])
  const cross = useMemo(() => new THREE.Vector3().crossVectors(a, b), [a, b])
  const dot = a.dot(b)
  const aLen = a.length(), bLen = b.length()
  const angle = aLen > 0 && bLen > 0 ? Math.acos(Math.min(1, Math.max(-1, dot / (aLen * bLen)))) * 180 / Math.PI : 0

  return (
    <LabScene cameraPos={[5, 4, 5]} cameraFov={55} tint="#0a0a18" particles={30} stars={false}>
      <Grid args={[20, 20]} cellSize={0.5} cellColor="#27272a" sectionSize={1} sectionColor="#4B5563" fadeDistance={20} infiniteGrid />
      <Axis dir={new THREE.Vector3(1,0,0)} color="#ef4444" label="X" />
      <Axis dir={new THREE.Vector3(0,1,0)} color="#34d399" label="Y" />
      <Axis dir={new THREE.Vector3(0,0,1)} color="#3b82f6" label="Z" />
      <Arrow vec={a} color="#C7D2E8" label="A" />
      <Arrow vec={b} color="#A5B4FC" label="B" />
      {cross.length() > 0.05 && <Arrow vec={cross} color="#f472b6" label="A×B" />}
      <Text position={[0, 4.5, 0]} fontSize={0.25} color="#fafafa" anchorX="center">
        {`A·B = ${dot.toFixed(2)}    |A×B| = ${cross.length().toFixed(2)}    θ = ${angle.toFixed(1)}°`}
      </Text>
      <OrbitControls enablePan={false} minDistance={4} maxDistance={20} />
    </LabScene>
  )
}

function Arrow({ vec, color, label }: { vec: THREE.Vector3; color: string; label: string }) {
  const len = vec.length()
  if (len < 0.05) return null
  const dir = vec.clone().normalize()
  const mid = vec.clone().multiplyScalar(0.5)
  const tip = vec.clone()
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
  return (
    <group>
      <mesh position={mid.toArray()} quaternion={quat}>
        <cylinderGeometry args={[0.04, 0.04, len, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      </mesh>
      <mesh position={tip.toArray()} quaternion={quat}>
        <coneGeometry args={[0.12, 0.3, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      <Text position={vec.clone().multiplyScalar(1.15).toArray()} fontSize={0.2} color={color} anchorX="center">
        {label}
      </Text>
    </group>
  )
}

function Axis({ dir, color, label }: any) {
  const tip = dir.clone().multiplyScalar(3)
  return (
    <group>
      <mesh position={dir.clone().multiplyScalar(1.5).toArray()}
        quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)}>
        <cylinderGeometry args={[0.015, 0.015, 3, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
      <Text position={tip.toArray()} fontSize={0.2} color={color}>{label}</Text>
    </group>
  )
}

export default function VectorsLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="3D Vectors" subject="Math" topic="Dot & Cross Product · Class 11-12"
      description="Two vectors from the origin. Yellow A, blue B, pink A×B. Watch the dot product, cross product magnitude, and angle update as you drag the sliders."
      Sim={VectorsSim}
      defaultParams={{ ax: 2, ay: 0, az: 0, bx: 0, by: 2, bz: 0 }}
      controls={[
        { key: 'ax', label: 'A.x', type: 'slider', value: 2, min: -3, max: 3, step: 0.1 },
        { key: 'ay', label: 'A.y', type: 'slider', value: 0, min: -3, max: 3, step: 0.1 },
        { key: 'az', label: 'A.z', type: 'slider', value: 0, min: -3, max: 3, step: 0.1 },
        { key: 'bx', label: 'B.x', type: 'slider', value: 0, min: -3, max: 3, step: 0.1 },
        { key: 'by', label: 'B.y', type: 'slider', value: 2, min: -3, max: 3, step: 0.1 },
        { key: 'bz', label: 'B.z', type: 'slider', value: 0, min: -3, max: 3, step: 0.1 },
      ]}
      aiPrompt={p => `Two 3D vectors: A = (${p.ax}, ${p.ay}, ${p.az}) and B = (${p.bx}, ${p.by}, ${p.bz}). Compute the dot product, cross product, magnitudes, and angle between them. Explain when dot product is zero (perpendicular) and when cross product is zero (parallel). Use $...$ for math.`}
      onBack={onBack}
    />
  )
}
