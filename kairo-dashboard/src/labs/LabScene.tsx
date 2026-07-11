/**
 * LabScene — premium <Canvas> wrapper with cinematic defaults.
 *
 * Replaces raw <Canvas> in each lab to give the whole set a consistent
 * "science-museum exhibit" feel:
 *   · three-point studio lighting (key + fill + rim)
 *   · soft volumetric fog
 *   · drifting ambient particles
 *   · ACESFilmic tone mapping + sRGB output
 *   · graceful default camera + DPR clamp
 *
 * Each lab passes its own children — typically a model + sim physics + an
 * OrbitControls. The scene defaults can be overridden via the `tint`,
 * `cameraPos`, `fogColor`, `particles` props.
 */
import { useMemo, useRef, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'

interface LabSceneProps {
  children:   ReactNode
  cameraPos?: [number, number, number]
  cameraFov?: number
  /** Background gradient anchor colour. The corner glow fades toward black. */
  tint?:      string
  /** Optional fog colour for distance fade (subtle, atmospheric). */
  fogColor?:  string
  fogNear?:   number
  fogFar?:    number
  /** Drifting ambient particles count. 0 disables. */
  particles?: number
  /** Cinematic distance stars on/off. */
  stars?:     boolean
  /** Override default shadow settings. */
  shadows?:   boolean
  /** Extra raw props passed to Canvas (for advanced use). */
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
  // Pause the WebGL render loop when the canvas is off-screen (e.g. the user
  // navigated away — the Labs page stays mounted but hidden). Stops the
  // GPU/battery drain of a 3D scene rendering behind display:none.
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
      {/* Volumetric-ish fog — gives every scene a sense of atmosphere */}
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />

      {/* Three-point studio lighting */}
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

      {/* Cinematic backdrop stars */}
      {stars && (
        <Stars radius={80} depth={40} count={1200} factor={3} saturation={0} fade speed={0.25} />
      )}

      {/* Subtle drifting particles for depth */}
      {particles > 0 && <AmbientParticles count={particles} />}

      {children}
    </Canvas>
    </div>
  )
}

/** Slow-drifting points scattered in a sphere around the scene origin. Creates
 *  the sense of motion + depth without overwhelming the actual subject. */
function AmbientParticles({ count }: { count: number }) {
  const pointsRef = useRef<THREE.Points>(null)

  // Generate positions once
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

  // Slow drift along Y so the scene feels alive even when paused
  useFrame((_, dt) => {
    if (!pointsRef.current) return
    pointsRef.current.rotation.y += dt * 0.015
    pointsRef.current.rotation.x = Math.sin(performance.now() * 0.0001) * 0.08
  })

  // Build BufferGeometry imperatively to dodge the typed-elements <bufferAttribute>
  // surface, which got stricter in @react-three/fiber 9.x.
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
