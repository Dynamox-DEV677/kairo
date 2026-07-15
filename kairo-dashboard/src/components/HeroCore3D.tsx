import { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { MotionValue } from 'framer-motion'

interface HeroCore3DProps {
  scrollProgress: MotionValue<number>
  pointerXRef:    React.MutableRefObject<number>
  pointerYRef:    React.MutableRefObject<number>
  className?:     string
}

export default function HeroCore3D({ scrollProgress, pointerXRef, pointerYRef, className }: HeroCore3DProps) {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const unsub = scrollProgress.on('change', (v) => setActive(v < 1.2))
    return () => unsub()
  }, [scrollProgress])

  const scrollRef = useRef(0)
  useEffect(() => scrollProgress.on('change', v => { scrollRef.current = v }) as any, [scrollProgress])

  return (
    <div className={className} style={{
      position: 'relative', width: '100%', height: '100%',
      pointerEvents: 'none',
    }}>
      <Canvas
        dpr={[1, 1.5]}
        frameloop={active ? 'always' : 'never'}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 8.0], fov: 36 }}
        style={{ background: 'transparent' }}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[3, 4, 5]} intensity={0.65} color="#A5B4FC" />
        <pointLight position={[-4, 2, 4]} intensity={0.8} color="#A5B4FC" />
        <pointLight position={[4, -2, 3]} intensity={0.6} color="#ffffff" />

        <CoreScene
          scrollRef={scrollRef}
          pointerXRef={pointerXRef}
          pointerYRef={pointerYRef}
        />

        <fog attach="fog" args={['#050505', 5, 14]} />
      </Canvas>
    </div>
  )
}

function CoreScene({ scrollRef, pointerXRef, pointerYRef }: {
  scrollRef:   React.MutableRefObject<number>
  pointerXRef: React.MutableRefObject<number>
  pointerYRef: React.MutableRefObject<number>
}) {
  const rootRef  = useRef<THREE.Group>(null)
  const coreRef  = useRef<THREE.Mesh>(null)
  const wireRef  = useRef<THREE.Mesh>(null)
  const ring1Ref = useRef<THREE.Mesh>(null)
  const ring2Ref = useRef<THREE.Mesh>(null)
  const haloRef  = useRef<THREE.Mesh>(null)
  const sparksRef = useRef<THREE.Points>(null)

  const sparkGeom = useMemo(() => {
    const N = 60
    const positions = new Float32Array(N * 3)
    const phases    = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const r = 1.9 + Math.random() * 1.5
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
      phases[i] = Math.random() * Math.PI * 2
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('phase',    new THREE.BufferAttribute(phases, 1))
    return g
  }, [])

  const smoothX = useRef(0)
  const smoothY = useRef(0)

  useFrame((state, dt) => {
    const t  = state.clock.elapsedTime
    const p  = scrollRef.current     
    const mp = Math.max(0, Math.min(1, p))   
    const fade = 1 - mp                       

    smoothX.current += (pointerXRef.current - smoothX.current) * Math.min(1, dt * 4)
    smoothY.current += (pointerYRef.current - smoothY.current) * Math.min(1, dt * 4)
    const px = smoothX.current
    const py = smoothY.current

    if (rootRef.current) {
      const scale = 1 - mp * 0.45
      rootRef.current.scale.setScalar(scale)
      rootRef.current.position.y = -mp * 1.1
      rootRef.current.position.z = -mp * 1.4
      const interactivity = 1 - mp * 0.85
      rootRef.current.rotation.x = -mp * 0.32  + (-py * 0.18) * interactivity
      rootRef.current.rotation.z =  mp * 0.20  + ( px * 0.12) * interactivity
    }

    if (coreRef.current) {
      const speed = 0.18 + mp * 0.9    
      coreRef.current.rotation.x += dt * speed
      coreRef.current.rotation.y += dt * speed * 1.3
      const breath = 1 + Math.sin(t * 1.2) * 0.04
      coreRef.current.scale.setScalar(breath)
      const mat = coreRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.32 * fade + 0.05
    }

    if (wireRef.current) {
      wireRef.current.rotation.x -= dt * 0.4
      wireRef.current.rotation.y += dt * 0.25
      const breath = 1.05 + Math.sin(t * 1.2 + 0.3) * 0.04
      wireRef.current.scale.setScalar(breath)
      const mat = wireRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.32 * fade           
    }

    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = t * 0.22
      const mat = ring1Ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.35 * fade           
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = -t * 0.16
      const mat = ring2Ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.25 * fade           
    }

    if (haloRef.current) {
      const pulse = 1 + Math.sin(t * 1.6) * 0.06
      haloRef.current.scale.setScalar(pulse * (1 - mp * 0.2))
      const mat = haloRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.14 * fade           
    }

    if (sparksRef.current) {
      sparksRef.current.rotation.y = t * 0.08
      const mat = sparksRef.current.material as THREE.PointsMaterial
      mat.opacity = (0.35 + 0.35 * Math.sin(t * 2.3)) * fade
      mat.size = 0.06 + Math.sin(t * 1.6) * 0.01
    }
  })

  return (
    <group ref={rootRef}>
      <mesh ref={haloRef}>
        <sphereGeometry args={[2.4, 32, 32]} />
        <meshBasicMaterial color="#A5B4FC" transparent opacity={0.35} side={THREE.BackSide} depthWrite={false} />
      </mesh>

      <mesh ref={ring1Ref} rotation={[Math.PI / 2.6, 0, 0]}>
        <torusGeometry args={[1.65, 0.012, 16, 96]} />
        <meshBasicMaterial color="#A5B4FC" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[Math.PI / 3, Math.PI / 2.8, 0]}>
        <torusGeometry args={[1.95, 0.010, 16, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} />
      </mesh>

      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1.05, 1]} />
        <meshStandardMaterial
          color="#4A2FA8"
          emissive="#A5B4FC"
          emissiveIntensity={0.9}
          roughness={0.25}
          metalness={0.55}
          flatShading
        />
      </mesh>

      <mesh ref={wireRef}>
        <icosahedronGeometry args={[1.20, 1]} />
        <meshBasicMaterial color="#A5B4FC" wireframe transparent opacity={0.55} depthWrite={false} />
      </mesh>

      <points ref={sparksRef} geometry={sparkGeom}>
        <pointsMaterial
          color="#ffffff"
          size={0.06}
          sizeAttenuation
          transparent
          opacity={0.6}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  )
}
