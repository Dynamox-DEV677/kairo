import { useMemo, useRef, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'

interface LabSceneProps {
  children:   ReactNode
  cameraPos?: [number, number, number]
  cameraFov?: number
  tint?:      string
  fogColor?:  string
  fogNear?:   number
  fogFar?:    number
  particles?: number
  stars?:     boolean
  shadows?:   boolean
  className?: string
}

export default function LabScene({
  children,
  cameraPos = [6, 4, 8],
  cameraFov = 50,
  tint      = '#1a1a2e',
  fogColor  = '#05050f',
  fogNear   = 18,
  fogFar    = 50,
  particles = 80,
  stars     = true,
  shadows   = true,
  className,
}: LabSceneProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio > 0),
      { threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%' }}>
    <Canvas
      frameloop={visible ? 'always' : 'never'}
      shadows={shadows}
      camera={{ position: cameraPos, fov: cameraFov, near: 0.1, far: 200 }}
      dpr={[1, 1.6]}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      style={{
        background: `radial-gradient(circle at 30% 25%, ${tint} 0%, #0a0a18 60%, #050510 100%)`,
      }}
      className={className}
    >
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />

      <ambientLight intensity={0.45} />
      <directionalLight
        position={[8, 12, 6]} intensity={1.4} color="#fde68a"
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12} shadow-camera-right={12}
        shadow-camera-top={12} shadow-camera-bottom={-12}
        shadow-camera-near={0.5} shadow-camera-far={40}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-7, 4, -5]} intensity={0.7} color="#A5B4FC" />
      <pointLight position={[3, -3, 4]} intensity={0.4} color="#ec4899" />

      {stars && (
        <Stars radius={80} depth={40} count={1200} factor={3} saturation={0} fade speed={0.25} />
      )}

      {particles > 0 && <AmbientParticles count={particles} />}

      {children}
    </Canvas>
    </div>
  )
}

function AmbientParticles({ count }: { count: number }) {
  const pointsRef = useRef<THREE.Points>(null)

  const { positions, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const sizes     = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const r     = 8 + Math.random() * 18
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.cos(phi) - 1
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
      sizes[i] = 0.5 + Math.random() * 1.5
    }
    return { positions, sizes }
  }, [count])

  useFrame((_, dt) => {
    if (!pointsRef.current) return
    pointsRef.current.rotation.y += dt * 0.015
    pointsRef.current.rotation.x = Math.sin(performance.now() * 0.0001) * 0.08
  })

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('size',     new THREE.BufferAttribute(sizes,     1))
    return g
  }, [positions, sizes])

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.05}
        sizeAttenuation
        color="#A5B4FC"
        transparent
        opacity={0.7}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
