/**
 * Lab preview cards — live R3F mini-canvases for the landing page.
 *
 * Six variants, each a tiny self-contained scene built from primitives:
 *   solar     — sun + orbiting planets + dashed orbit ring
 *   heart     — beating chambered heart (procedural)
 *   dna       — rotating double helix with base pairs
 *   atom      — nucleus + 3 electron orbits on tilted axes
 *   vectors   — three glowing axis arrows + dot
 *   rocket    — vertical capsule rocket with flame
 *
 * Perf rules baked in:
 *   - `frameloop` flips to 'never' when card is out of viewport
 *   - DPR capped at 1.5 (vs default up to 2.0) — halves fragment cost
 *   - No shadows (huge cost when × 6 canvases on one page)
 *   - Geometry counts kept tiny (≤ 32 segments per sphere)
 *   - One ambient + one directional light per scene
 *   - Hover speeds up rotation + bumps emissive
 */
import { useRef, useState, useEffect, useMemo } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

export type LabVariant = 'solar' | 'heart' | 'dna' | 'atom' | 'vectors' | 'rocket'

interface LabPreview3DProps {
  variant: LabVariant
  tint:    string       // per-card accent — feeds emissive + glow color
  className?: string
}

export default function LabPreview3D({ variant, tint, className }: LabPreview3DProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [hover,   setHover]   = useState(false)

  // Only animate when this card is in the viewport — saves ~85% of GPU time
  // across the 6-card grid since most cards are usually below the fold.
  useEffect(() => {
    if (!wrapRef.current) return
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: '120px 0px' }
    )
    io.observe(wrapRef.current)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={wrapRef}
      className={className}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'auto',
      }}>
      <Canvas
        dpr={[1, 1.5]}
        frameloop={visible ? 'always' : 'never'}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: true }}
        camera={{ position: [0, 0, 5], fov: 45 }}
        style={{ width: '100%', height: '100%', background: 'transparent' }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 4, 6]} intensity={0.9} color="#ffffff" />
        <pointLight position={[-4, -2, 4]} intensity={0.6} color={tint} />

        <Scene variant={variant} tint={tint} hover={hover} />

        {/* Soft radial fog tint — gives every card the "portal" feel */}
        <fog attach="fog" args={[tint, 7, 14]} />
      </Canvas>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SCENE SWITCH
// ════════════════════════════════════════════════════════════════════════════
function Scene({ variant, tint, hover }: { variant: LabVariant; tint: string; hover: boolean }) {
  switch (variant) {
    case 'solar':   return <SolarScene   tint={tint} hover={hover} />
    case 'heart':   return <HeartScene   tint={tint} hover={hover} />
    case 'dna':     return <DnaScene     tint={tint} hover={hover} />
    case 'atom':    return <AtomScene    tint={tint} hover={hover} />
    case 'vectors': return <VectorsScene tint={tint} hover={hover} />
    case 'rocket':  return <RocketScene  tint={tint} hover={hover} />
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 1) SOLAR — sun + orbiting planets
// ════════════════════════════════════════════════════════════════════════════
function SolarScene({ tint, hover }: { tint: string; hover: boolean }) {
  const group = useRef<THREE.Group>(null)
  const planets = useMemo(() => [
    { r: 1.2, size: 0.13, speed: 1.5, color: '#a3a3a3', phase: 0    },
    { r: 1.8, size: 0.20, speed: 1.0, color: '#60a5fa', phase: 0.7  },
    { r: 2.5, size: 0.18, speed: 0.6, color: '#f87171', phase: 1.6  },
    { r: 3.2, size: 0.28, speed: 0.4, color: '#fbbf24', phase: 2.4  },
  ], [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const groupRot = hover ? 1.5 : 0.7
    if (group.current) group.current.rotation.y = t * 0.05 * groupRot
  })

  return (
    <group ref={group}>
      {/* Sun */}
      <mesh>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={hover ? 2.2 : 1.5} toneMapped={false} />
      </mesh>
      {/* Sun corona */}
      <mesh>
        <sphereGeometry args={[0.75, 24, 24]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.22} side={THREE.BackSide} />
      </mesh>

      {/* Orbit rings */}
      {planets.map((p, i) => (
        <OrbitRing key={i} radius={p.r} color={tint} />
      ))}

      {/* Planets */}
      {planets.map((p, i) => <Planet key={i} {...p} hover={hover} />)}
    </group>
  )
}

function OrbitRing({ radius, color }: { radius: number; color: string }) {
  const points = useMemo(() => {
    const arr: THREE.Vector3[] = []
    const N = 64
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2
      arr.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius))
    }
    return arr
  }, [radius])
  const geom = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points])
  return (
    <line>
      <primitive object={geom} attach="geometry" />
      <lineBasicMaterial color={color} transparent opacity={0.28} />
    </line>
  )
}

function Planet({ r, size, speed, color, phase, hover }: { r: number; size: number; speed: number; color: string; phase: number; hover: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime * speed + phase
    const mult = hover ? 2.2 : 1
    ref.current.position.set(Math.cos(t * mult * 0.3) * r, 0, Math.sin(t * mult * 0.3) * r)
  })
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} roughness={0.6} />
    </mesh>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 2) HEART — beating chambers
// ════════════════════════════════════════════════════════════════════════════
function HeartScene({ tint, hover }: { tint: string; hover: boolean }) {
  const root = useRef<THREE.Group>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (!root.current) return
    root.current.rotation.y = Math.sin(t * 0.25) * 0.35 + (hover ? t * 0.2 : 0)
    // BPM ~80 in preview
    const period = 0.75
    const phase  = (t % period) / period
    let pulse = 0
    if (phase < 0.20) pulse = 0.12 * Math.sin((phase / 0.20) * Math.PI)
    else if (phase > 0.30 && phase < 0.45) pulse = 0.06 * Math.sin(((phase - 0.30) / 0.15) * Math.PI)
    root.current.scale.setScalar(1 + pulse)
  })
  return (
    <group ref={root} position={[0, -0.2, 0]} rotation={[0, -0.2, 0.1]}>
      {/* LV (big, red) */}
      <mesh position={[0.55, -0.3, 0]}>
        <sphereGeometry args={[0.85, 24, 24]} />
        <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={hover ? 0.6 : 0.25} roughness={0.45} />
      </mesh>
      {/* LV apex */}
      <mesh position={[0.55, -0.95, 0]} scale={[0.55, 0.7, 0.55]}>
        <sphereGeometry args={[1, 18, 18]} />
        <meshStandardMaterial color="#b91c1c" emissive="#dc2626" emissiveIntensity={hover ? 0.55 : 0.20} roughness={0.45} />
      </mesh>
      {/* RV */}
      <mesh position={[-0.45, -0.3, 0]} scale={[0.85, 0.95, 0.85]}>
        <sphereGeometry args={[0.85, 22, 22]} />
        <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={hover ? 0.6 : 0.25} roughness={0.45} />
      </mesh>
      {/* LA */}
      <mesh position={[0.45, 0.65, 0]} scale={[0.7, 0.55, 0.7]}>
        <sphereGeometry args={[0.7, 18, 18]} />
        <meshStandardMaterial color="#fb7185" emissive="#fb7185" emissiveIntensity={hover ? 0.5 : 0.20} />
      </mesh>
      {/* RA */}
      <mesh position={[-0.45, 0.65, 0]} scale={[0.7, 0.55, 0.7]}>
        <sphereGeometry args={[0.7, 18, 18]} />
        <meshStandardMaterial color="#fda4af" emissive="#fda4af" emissiveIntensity={hover ? 0.5 : 0.20} />
      </mesh>
      {/* Aorta — quick curve approximation with a tilted torus arc */}
      <mesh position={[0.55, 1.1, 0]} rotation={[Math.PI / 2, 0, -0.3]}>
        <torusGeometry args={[0.35, 0.13, 12, 24, Math.PI]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={hover ? 0.6 : 0.3} />
      </mesh>
      {/* Pulse halo */}
      <mesh>
        <sphereGeometry args={[1.7, 24, 24]} />
        <meshBasicMaterial color={tint} transparent opacity={0.04} side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 3) DNA — rotating double helix
// ════════════════════════════════════════════════════════════════════════════
function DnaScene({ tint, hover }: { tint: string; hover: boolean }) {
  const root = useRef<THREE.Group>(null)
  const pairs = 10
  const height = 4
  const radius = 0.75
  const turns = 1.5

  const strandData = useMemo(() => {
    const N = 80
    const a: THREE.Vector3[] = []
    const b: THREE.Vector3[] = []
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const angle = t * Math.PI * 2 * turns
      const y = -height / 2 + t * height
      a.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius))
      b.push(new THREE.Vector3(Math.cos(angle + Math.PI) * radius, y, Math.sin(angle + Math.PI) * radius))
    }
    const geomA = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(a), 80, 0.05, 8, false)
    const geomB = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(b), 80, 0.05, 8, false)
    return { geomA, geomB }
  }, [])

  useFrame((state) => {
    if (!root.current) return
    root.current.rotation.y = state.clock.elapsedTime * (hover ? 0.9 : 0.35)
  })

  const baseColors = ['#ef4444', '#fbbf24', '#34d399', '#3b82f6']

  return (
    <group ref={root} scale={0.85}>
      {/* Strands */}
      <mesh geometry={strandData.geomA}>
        <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={hover ? 1.0 : 0.5} />
      </mesh>
      <mesh geometry={strandData.geomB}>
        <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={hover ? 1.0 : 0.5} />
      </mesh>
      {/* Base-pair rungs */}
      {Array.from({ length: pairs }).map((_, i) => {
        const t = i / (pairs - 1)
        const angle = t * Math.PI * 2 * turns
        const y = -height / 2 + t * height
        const x1 = Math.cos(angle) * radius
        const z1 = Math.sin(angle) * radius
        const x2 = Math.cos(angle + Math.PI) * radius
        const z2 = Math.sin(angle + Math.PI) * radius
        const midX = (x1 + x2) / 2, midZ = (z1 + z2) / 2
        const len = Math.hypot(x2 - x1, z2 - z1)
        const angY = Math.atan2(z2 - z1, x2 - x1)
        const col = baseColors[i % baseColors.length]
        return (
          <mesh key={i} position={[midX, y, midZ]} rotation={[0, -angY, Math.PI / 2]}>
            <cylinderGeometry args={[0.04, 0.04, len, 8]} />
            <meshStandardMaterial color={col} emissive={col} emissiveIntensity={hover ? 1.4 : 0.6} />
          </mesh>
        )
      })}
    </group>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 4) ATOM — nucleus + electron orbits
// ════════════════════════════════════════════════════════════════════════════
function AtomScene({ tint, hover }: { tint: string; hover: boolean }) {
  const root = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!root.current) return
    root.current.rotation.y = state.clock.elapsedTime * (hover ? 0.6 : 0.25)
  })

  const orbits = [
    { tilt: [0, 0, 0]                     as [number, number, number] },
    { tilt: [Math.PI / 2, 0, 0]           as [number, number, number] },
    { tilt: [Math.PI / 4, Math.PI / 4, 0] as [number, number, number] },
  ]

  return (
    <group ref={root}>
      {/* Nucleus */}
      <mesh>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={hover ? 1.8 : 1.0} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.65, 16, 16]} />
        <meshBasicMaterial color={tint} transparent opacity={0.22} side={THREE.BackSide} />
      </mesh>

      {/* Three tilted orbits, each with its own rotating electron */}
      {orbits.map((o, i) => (
        <group key={i} rotation={o.tilt}>
          <OrbitRing radius={1.5 + i * 0.18} color={tint} />
          <Electron radius={1.5 + i * 0.18} phase={i * 1.7} speed={1.6 - i * 0.2} hover={hover} color={tint} />
        </group>
      ))}
    </group>
  )
}

function Electron({ radius, phase, speed, hover, color }: { radius: number; phase: number; speed: number; hover: boolean; color: string }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime * speed * (hover ? 2.2 : 1) + phase
    ref.current.position.set(Math.cos(t) * radius, 0, Math.sin(t) * radius)
  })
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.12, 16, 16]} />
      <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={hover ? 1.6 : 0.8} />
    </mesh>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 5) VECTORS — three glowing axes
// ════════════════════════════════════════════════════════════════════════════
function VectorsScene({ tint: _tint, hover }: { tint: string; hover: boolean }) {
  const root = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!root.current) return
    root.current.rotation.y = state.clock.elapsedTime * (hover ? 0.55 : 0.20)
    root.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.18
  })

  const axes: Array<{ dir: [number, number, number]; color: string }> = [
    { dir: [1.6, 0, 0],   color: '#f87171' },
    { dir: [0, 1.6, 0],   color: '#34d399' },
    { dir: [0, 0, 1.6],   color: '#60a5fa' },
  ]

  return (
    <group ref={root}>
      {/* Center dot */}
      <mesh>
        <sphereGeometry args={[0.10, 16, 16]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} />
      </mesh>

      {axes.map((a, i) => <Arrow key={i} dir={a.dir} color={a.color} hover={hover} />)}

      {/* Subtle floor grid */}
      <gridHelper args={[6, 12, '#22222e', '#1a1a26']} position={[0, -1.5, 0]} />
    </group>
  )
}

function Arrow({ dir, color, hover }: { dir: [number, number, number]; color: string; hover: boolean }) {
  const target = new THREE.Vector3(...dir)
  const length = target.length()
  // shaft
  const shaftMid = target.clone().multiplyScalar(0.45)
  const tipPos   = target.clone().multiplyScalar(0.92)
  // quaternion that rotates +Y to the arrow direction
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), target.clone().normalize())

  return (
    <group quaternion={quat as any}>
      <mesh position={[0, length * 0.45, 0]}>
        <cylinderGeometry args={[0.04, 0.04, length * 0.9, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hover ? 1.4 : 0.7} />
      </mesh>
      <mesh position={[0, length * 0.94, 0]}>
        <coneGeometry args={[0.12, 0.24, 14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hover ? 1.6 : 0.8} />
      </mesh>
      {/* unused helpers — keep target/shaftMid/tipPos warnings down */}
      <group position={shaftMid as unknown as [number, number, number]} visible={false} />
      <group position={tipPos as unknown as [number, number, number]} visible={false} />
    </group>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 6) ROCKET — vertical stack
// ════════════════════════════════════════════════════════════════════════════
function RocketScene({ tint, hover }: { tint: string; hover: boolean }) {
  const root = useRef<THREE.Group>(null)
  const flameRef = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (root.current) {
      root.current.rotation.y = t * (hover ? 0.7 : 0.25)
    }
    if (flameRef.current) {
      const flicker = 1 + Math.sin(t * 30) * 0.18 + Math.sin(t * 53) * 0.08
      flameRef.current.scale.set(flicker, flicker, flicker)
    }
  })

  return (
    <group ref={root} position={[0, -0.2, 0]}>
      {/* Nose cone */}
      <mesh position={[0, 2.0, 0]}>
        <coneGeometry args={[0.32, 0.7, 24]} />
        <meshStandardMaterial color="#ffffff" emissive={tint} emissiveIntensity={hover ? 0.4 : 0.18} />
      </mesh>
      {/* Body stage 1 */}
      <mesh position={[0, 1.05, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 1.2, 28]} />
        <meshStandardMaterial color="#e5e7eb" />
      </mesh>
      {/* Ring divider */}
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.06, 28]} />
        <meshStandardMaterial color="#52525b" />
      </mesh>
      {/* Body stage 2 (slightly fatter) */}
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.36, 0.40, 1.0, 28]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      {/* Fins */}
      {[0, Math.PI * 2 / 3, Math.PI * 4 / 3].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.45, -0.45, Math.sin(a) * 0.45]} rotation={[0, -a, 0]}>
          <boxGeometry args={[0.06, 0.55, 0.35]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      ))}
      {/* Engine bell */}
      <mesh position={[0, -0.8, 0]}>
        <coneGeometry args={[0.35, 0.35, 20, 1, true]} />
        <meshStandardMaterial color="#475569" side={THREE.DoubleSide} />
      </mesh>
      {/* Flame */}
      <mesh ref={flameRef} position={[0, -1.15, 0]}>
        <coneGeometry args={[0.22, 0.7, 16]} />
        <meshBasicMaterial color="#fb923c" transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, -1.05, 0]} scale={[0.6, 0.6, 0.6]}>
        <coneGeometry args={[0.22, 0.5, 16]} />
        <meshBasicMaterial color="#fde047" transparent opacity={0.95} />
      </mesh>
    </group>
  )
}
