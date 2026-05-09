/**
 * Graphs Lab — 3D function plotter. Pick a preset z = f(x, y) and explore.
 */
import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Text } from '@react-three/drei'
import * as THREE from 'three'
import LabShell from './LabShell'

const FUNCTIONS: Record<string, { label: string; fn: (x: number, y: number) => number; latex: string }> = {
  paraboloid: { label: 'Paraboloid (x² + y²)', latex: 'z = x^2 + y^2',
    fn: (x, y) => 0.15 * (x * x + y * y) },
  saddle:     { label: 'Saddle (x² − y²)', latex: 'z = x^2 - y^2',
    fn: (x, y) => 0.18 * (x * x - y * y) },
  sinr:       { label: 'Ripple (sin(r)/r)', latex: 'z = sin(r) / r',
    fn: (x, y) => { const r = Math.sqrt(x * x + y * y) + 0.001; return 1.5 * Math.sin(r) / r } },
  wave:       { label: 'Wave (sin x · cos y)', latex: 'z = sin(x) · cos(y)',
    fn: (x, y) => 1.2 * Math.sin(x) * Math.cos(y) },
  bumps:      { label: 'Bumps (sin(x²+y²))', latex: 'z = sin(x^2 + y^2)',
    fn: (x, y) => Math.sin(0.6 * (x * x + y * y)) },
}

interface SimProps {
  params: { fn: string; range: number; resolution: number }
  playing: boolean
}

function GraphsSim({ params }: SimProps) {
  const { positions, colors, indices } = useMemo(() => {
    const f = FUNCTIONS[params.fn]?.fn || FUNCTIONS.paraboloid.fn
    const N = Math.floor(params.resolution)
    const R = params.range
    const positions: number[] = []
    const colors: number[] = []
    const indices: number[] = []
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const x = (i / N - 0.5) * 2 * R
        const y = (j / N - 0.5) * 2 * R
        const z = f(x, y)
        positions.push(x, z, y)   // (note: y is up in three)
        // Color by height
        const t = (z + 3) / 6
        const r = Math.max(0, Math.min(1, t < 0.5 ? 0.4 + t : 1 - (t - 0.5) * 0.5))
        const g = Math.max(0, Math.min(1, 0.5 - Math.abs(t - 0.5)))
        const b = Math.max(0, Math.min(1, t > 0.5 ? 0.4 + (1 - t) : 1 - (0.5 - t) * 0.6))
        colors.push(0.4, 0.5 + t * 0.5, 1 - t * 0.5)
      }
    }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const a = i * (N + 1) + j
        const b = a + 1
        const c = a + (N + 1)
        const d = c + 1
        indices.push(a, c, b, b, c, d)
      }
    }
    return { positions, colors, indices }
  }, [params.fn, params.range, params.resolution])

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    g.setIndex(indices)
    g.computeVertexNormals()
    return g
  }, [positions, colors, indices])

  const fnDef = FUNCTIONS[params.fn] || FUNCTIONS.paraboloid

  return (
    <Canvas camera={{ position: [8, 6, 8], fov: 55 }} style={{ background: 'radial-gradient(circle at center, #0a0a1a 0%, #0a0a0a 70%)' }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 8, 4]} intensity={1} />
      <directionalLight position={[-5, 3, -5]} intensity={0.4} color="#a5b4fc" />
      <Grid args={[20, 20]} cellSize={1} cellColor="#27272a" sectionSize={5} sectionColor="#3f3f46" fadeDistance={25} />
      <mesh geometry={geometry}>
        <meshStandardMaterial vertexColors flatShading roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <Text position={[0, 5, 0]} fontSize={0.35} color="#fafafa" anchorX="center">
        {fnDef.latex}
      </Text>
      <OrbitControls enablePan={false} minDistance={4} maxDistance={30} />
    </Canvas>
  )
}

export default function GraphsLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="3D Function Plotter" subject="Math" topic="Surfaces · Class 11-12"
      description="Pick a function z = f(x, y) and rotate the surface in 3D. Color encodes height — colder valleys, warmer peaks."
      Sim={GraphsSim}
      defaultParams={{ fn: 'paraboloid', range: 4, resolution: 50 }}
      controls={[
        { key: 'fn', label: 'Function', type: 'select', value: 'paraboloid', options: Object.entries(FUNCTIONS).map(([k, v]) => ({ value: k, label: v.label })) },
        { key: 'range',      label: 'Range',      type: 'slider', value: 4,  min: 2, max: 8,  step: 0.5 },
        { key: 'resolution', label: 'Resolution', type: 'slider', value: 50, min: 20, max: 100, step: 5 },
      ]}
      aiPrompt={p => `A 3D surface z = ${FUNCTIONS[p.fn]?.latex || 'f(x,y)'} plotted over x,y ∈ [-${p.range}, ${p.range}]. Describe the shape, where the maxima and minima are, what its level curves look like (z = constant), and where this function appears in real life or in calculus.`}
      onBack={onBack}
    />
  )
}
