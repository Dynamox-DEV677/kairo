/**
 * Graphs Lab — 3D function plotter, MATLAB / Wolfram style.
 * - Surface mesh with vertex-color jet gradient (blue → cyan → green → yellow → red).
 * - Wireframe overlay traces every grid line.
 * - Bounding box (12-edge cube) with axis labels (x, y, z).
 * - Tick marks on the floor (xy-plane) so you can read off coordinates.
 */
import { useMemo } from 'react'
import LabScene from './LabScene'
import { OrbitControls, Text, Line } from '@react-three/drei'
import * as THREE from 'three'
import LabShell from './LabShell'

const FUNCTIONS: Record<string, { label: string; fn: (x: number, y: number) => number; latex: string }> = {
  paraboloid: { label: 'Paraboloid (x² + y²)', latex: 'z = x^2 + y^2',
    fn: (x, y) => 0.15 * (x * x + y * y) },
  saddle:     { label: 'Saddle (x² − y²)', latex: 'z = x^2 - y^2',
    fn: (x, y) => 0.18 * (x * x - y * y) },
  sinr:       { label: 'Ripple (sin(r)/r)', latex: 'z = \\frac{\\sin(r)}{r}',
    fn: (x, y) => { const r = Math.sqrt(x * x + y * y) + 0.001; return 1.5 * Math.sin(r) / r } },
  wave:       { label: 'Wave (sin x · cos y)', latex: 'z = \\sin(x)\\cos(y)',
    fn: (x, y) => 1.2 * Math.sin(x) * Math.cos(y) },
  bumps:      { label: 'Bumps (sin(x²+y²))', latex: 'z = \\sin(x^2 + y^2)',
    fn: (x, y) => Math.sin(0.6 * (x * x + y * y)) },
  gaussian:   { label: 'Gaussian peak (e^-r²)', latex: 'z = e^{-r^2}',
    fn: (x, y) => 2 * Math.exp(-(x * x + y * y) * 0.25) },
  monkey:     { label: 'Monkey saddle (x³ - 3xy²)', latex: 'z = x^3 - 3xy^2',
    fn: (x, y) => 0.04 * (x * x * x - 3 * x * y * y) },
}

interface SimProps {
  params: { fn: string; range: number; resolution: number }
  playing: boolean
}

/** Jet colormap — blue → cyan → green → yellow → red. Standard for scientific plots. */
function jetColor(t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t))
  const r = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * x - 3)))
  const g = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * x - 2)))
  const b = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * x - 1)))
  return [r, g, b]
}

function GraphsSim({ params }: SimProps) {
  const { positions, colors, indices, zMin, zMax, wireSegs } = useMemo(() => {
    const f = FUNCTIONS[params.fn]?.fn || FUNCTIONS.paraboloid.fn
    const N = Math.floor(params.resolution)
    const R = params.range

    // First pass — sample heights & find min/max for color scaling.
    const heights: number[] = []
    let zMin = Infinity, zMax = -Infinity
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const x = (i / N - 0.5) * 2 * R
        const y = (j / N - 0.5) * 2 * R
        const z = f(x, y)
        heights.push(z)
        if (z < zMin) zMin = z
        if (z > zMax) zMax = z
      }
    }
    if (zMax === zMin) zMax = zMin + 1   // avoid divide-by-zero on flat surfaces

    // Second pass — write positions + colors using normalized z.
    const positions: number[] = []
    const colors: number[] = []
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const x = (i / N - 0.5) * 2 * R
        const y = (j / N - 0.5) * 2 * R
        const z = heights[i * (N + 1) + j]
        positions.push(x, z, y)             // y-up in three.js
        const t = (z - zMin) / (zMax - zMin)
        const [r, g, b] = jetColor(t)
        colors.push(r, g, b)
      }
    }

    // Triangle indices.
    const indices: number[] = []
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const a = i * (N + 1) + j
        const b = a + 1
        const c = a + (N + 1)
        const d = c + 1
        indices.push(a, c, b, b, c, d)
      }
    }

    // Wireframe — sparse subset of grid lines (every Kth row/col so it's not too dense).
    const stride = Math.max(1, Math.floor(N / 12))
    const wireSegs: [THREE.Vector3, THREE.Vector3][] = []
    for (let i = 0; i <= N; i += stride) {
      for (let j = 0; j < N; j++) {
        const a = i * (N + 1) + j, b = a + 1
        wireSegs.push([
          new THREE.Vector3(positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2]),
          new THREE.Vector3(positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2]),
        ])
      }
    }
    for (let j = 0; j <= N; j += stride) {
      for (let i = 0; i < N; i++) {
        const a = i * (N + 1) + j, b = a + (N + 1)
        wireSegs.push([
          new THREE.Vector3(positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2]),
          new THREE.Vector3(positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2]),
        ])
      }
    }

    return { positions, colors, indices, zMin, zMax, wireSegs }
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
  const R = params.range
  const zSpan = Math.max(Math.abs(zMin), Math.abs(zMax), 1)

  return (
    <LabScene
      cameraPos={[R * 1.7, zSpan * 1.4 + 2, R * 1.7]}
      cameraFov={50}
      tint="#0c0c1f"
      particles={25}
      stars={false}
    >
      {/* Bounding box & tick marks */}
      <BoundingBox range={R} zMin={zMin} zMax={zMax} />

      {/* Filled surface */}
      <mesh geometry={geometry}>
        <meshStandardMaterial
          vertexColors flatShading={false}
          roughness={0.55} metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Wireframe overlay (line segments, not the noisy meshBasic wireframe) */}
      {wireSegs.map((seg, i) => (
        <Line key={i} points={seg} color="#0E1117" lineWidth={0.5} transparent opacity={0.55} />
      ))}

      {/* Equation label floating above */}
      <Text position={[0, zMax + 1.0, 0]} fontSize={0.42} color="#fafafa" anchorX="center"
        outlineWidth={0.02} outlineColor="#000">
        {fnDef.label}
      </Text>

      <OrbitControls enablePan={false} minDistance={4} maxDistance={40} />
    </LabScene>
  )
}

/** Box frame around the plot with x/y/z axis labels and tick marks on the floor. */
function BoundingBox({ range, zMin, zMax }: { range: number; zMin: number; zMax: number }) {
  const R = range
  // Floor a bit below zMin, ceiling a bit above zMax — clean integer-ish bounds
  const yMin = Math.floor(zMin - 0.5)
  const yMax = Math.ceil(zMax + 0.5)

  // 12 edges of a cube
  const corners: [number, number, number][] = [
    [-R, yMin, -R], [ R, yMin, -R], [ R, yMin,  R], [-R, yMin,  R],
    [-R, yMax, -R], [ R, yMax, -R], [ R, yMax,  R], [-R, yMax,  R],
  ]
  const edges: [number, number][] = [
    [0,1],[1,2],[2,3],[3,0],         // bottom square
    [4,5],[5,6],[6,7],[7,4],         // top square
    [0,4],[1,5],[2,6],[3,7],         // verticals
  ]
  const tickStep = R <= 3 ? 1 : R <= 6 ? 1 : 2

  return (
    <>
      {/* Box edges */}
      {edges.map(([a, b], i) => (
        <Line key={i} points={[corners[a], corners[b]]}
          color="#6B7280" lineWidth={0.7} transparent opacity={0.55} />
      ))}

      {/* Floor grid lines + ticks */}
      {Array.from({ length: Math.floor(2 * R / tickStep) + 1 }).map((_, k) => {
        const x = -R + k * tickStep
        return (
          <Line key={`xline-${k}`}
            points={[[x, yMin, -R], [x, yMin, R]]}
            color="#27272a" lineWidth={0.5} transparent opacity={0.5} />
        )
      })}
      {Array.from({ length: Math.floor(2 * R / tickStep) + 1 }).map((_, k) => {
        const z = -R + k * tickStep
        return (
          <Line key={`zline-${k}`}
            points={[[-R, yMin, z], [R, yMin, z]]}
            color="#27272a" lineWidth={0.5} transparent opacity={0.5} />
        )
      })}

      {/* Axis arrows + labels */}
      <Line points={[[-R, yMin, -R], [R + 0.5, yMin, -R]]} color="#ef4444" lineWidth={1.2} />
      <Line points={[[-R, yMin, -R], [-R, yMax + 0.5, -R]]} color="#10b981" lineWidth={1.2} />
      <Line points={[[-R, yMin, -R], [-R, yMin, R + 0.5]]} color="#3b82f6" lineWidth={1.2} />

      <Text position={[R + 0.8, yMin, -R]} fontSize={0.32} color="#ef4444" anchorX="left">x</Text>
      <Text position={[-R, yMax + 0.8, -R]} fontSize={0.32} color="#10b981" anchorX="center">z</Text>
      <Text position={[-R, yMin, R + 0.8]} fontSize={0.32} color="#3b82f6" anchorX="center">y</Text>

      {/* Tick labels — only on the x and y floor edges (not z height, which would clutter) */}
      {[-R, 0, R].map(v => (
        <Text key={`tx-${v}`} position={[v, yMin - 0.2, -R - 0.15]}
          fontSize={0.18} color="#9CA3AF" anchorX="center">
          {v.toFixed(0)}
        </Text>
      ))}
      {[-R, 0, R].map(v => (
        <Text key={`ty-${v}`} position={[-R - 0.2, yMin - 0.2, v]}
          fontSize={0.18} color="#9CA3AF" anchorX="center">
          {v.toFixed(0)}
        </Text>
      ))}

      {/* z-axis tick labels — every integer step */}
      {Array.from({ length: yMax - yMin + 1 }).map((_, k) => {
        const z = yMin + k
        return (
          <Text key={`tz-${z}`} position={[-R - 0.35, z, -R]}
            fontSize={0.18} color="#9CA3AF" anchorX="right">
            {z.toFixed(0)}
          </Text>
        )
      })}
    </>
  )
}

export default function GraphsLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="3D Function Plotter" subject="Math" topic="Surfaces · Class 11-12"
      description="Pick a function z = f(x, y) and rotate the surface in 3D. Color encodes height (blue valleys → red peaks). Wireframe shows the underlying mesh; bounding box gives you the x, y, z scale."
      Sim={GraphsSim}
      defaultParams={{ fn: 'paraboloid', range: 4, resolution: 60 }}
      controls={[
        { key: 'fn', label: 'Function', type: 'select', value: 'paraboloid', options: Object.entries(FUNCTIONS).map(([k, v]) => ({ value: k, label: v.label })) },
        { key: 'range',      label: 'Range',      type: 'slider', value: 4,  min: 2, max: 8,  step: 0.5 },
        { key: 'resolution', label: 'Resolution', type: 'slider', value: 60, min: 20, max: 100, step: 5 },
      ]}
      aiPrompt={p => `A 3D surface $${FUNCTIONS[p.fn]?.latex || 'f(x,y)'}$ plotted over $x, y \\in [-${p.range}, ${p.range}]$. Describe the shape, where the maxima and minima are, what its level curves look like ($z = c$), and where this function appears in real life or in calculus.`}
      onBack={onBack}
    />
  )
}
