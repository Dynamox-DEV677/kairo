/**
 * HeroCore3D — the cinematic AI "core" centerpiece in the landing hero.
 *
 * What it is:
 *   A slowly rotating, breathing icosahedron with a wireframe overlay, two
 *   tilted orbit rings, and a swarm of small floating spark particles.
 *   Reads scroll progress (0 at hero top → 1 when scrolled past) and:
 *     - scales DOWN as the user scrolls (recedes into the page)
 *     - rotates faster on scroll (motion-blur feel)
 *     - dims emissive (fades out into the next section)
 *   Reads mouse position and tilts the core toward the cursor (parallax).
 *
 * Why R3F not CSS:
 *   The brief asks for "models that EMERGE OUT OF THE SCREEN" with real
 *   depth + perspective. CSS transforms can fake this, but with R3F we get
 *   actual perspective projection and the lighting reads as cinematic.
 *
 * Perf:
 *   - One canvas, one model, one wireframe overlay
 *   - DPR capped at 1.5
 *   - No shadows (would be useless on a single floating object)
 *   - frameloop "always" while hero is on screen, "never" once scrolled past
 *   - 60 particles max, billboarded
 */
import { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { MotionValue } from 'framer-motion'

interface HeroCore3DProps {
  /** 0 at hero top → 1 when scrolled past. From Framer's useScroll. */
  scrollProgress: MotionValue<number>
  /** -1..+1 mouse normalised X position (from window center) */
  pointerXRef:    React.MutableRefObject<number>
  /** -1..+1 mouse normalised Y position (from window center) */
  pointerYRef:    React.MutableRefObject<number>
  className?:     string
}

export default function HeroCore3D({ scrollProgress, pointerXRef, pointerYRef, className }: HeroCore3DProps) {
  const [active, setActive] = useState(true)

  // Subscribe to scroll progress and shut down the canvas once we're well past
  // the hero — saves the GPU while the user reads the rest of the page.
  useEffect(() => {
    const unsub = scrollProgress.on('change', (v) => setActive(v < 1.2))
    return () => unsub()
  }, [scrollProgress])

  // We snapshot scrollProgress into a ref because useFrame can't read motion
  // values directly (they're outside R3F's render scope).
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
        <directionalLight position={[3, 4, 5]} intensity={0.65} color="#c4b5fd" />
        <pointLight position={[-4, 2, 4]} intensity={0.8} color="#a78bfa" />
        <pointLight position={[4, -2, 3]} intensity={0.6} color="#ffffff" />

        <CoreScene
          scrollRef={scrollRef}
          pointerXRef={pointerXRef}
          pointerYRef={pointerYRef}
        />

        <fog attach="fog" args={['#06060a', 5, 14]} />
      </Canvas>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Scene
// ════════════════════════════════════════════════════════════════════════════
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

  // Pre-compute spark positions
  const sparkGeom = useMemo(() => {
    const N = 60
    const positions = new Float32Array(N * 3)
    const phases    = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      // Spherical shell distribution around the core
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

  // Smoothed mouse interpolation
  const smoothX = useRef(0)
  const smoothY = useRef(0)

  useFrame((state, dt) => {
    const t  = state.clock.elapsedTime
    const p  = scrollRef.current     // 0..1+ as user scrolls past hero
    const mp = Math.max(0, Math.min(1, p))   // clamp for visuals
    const fade = 1 - mp                       // 1 visible → 0 faded

    // ── Mouse parallax ─────────────────────────────────────────
    // Lerp toward target so the motion is creamy, not snappy
    smoothX.current += (pointerXRef.current - smoothX.current) * Math.min(1, dt * 4)
    smoothY.current += (pointerYRef.current - smoothY.current) * Math.min(1, dt * 4)
    const px = smoothX.current
    const py = smoothY.current

    // ── Root group: cinematic recede + tumble on scroll ──────
    //  • Scale falls 1 → 0.55 (more dramatic depth recession)
    //  • Drifts up + slightly back (Z-axis recede)
    //  • Tumbles forward on X axis (15° tilt) as if camera is craning over
    //  • Mouse tilt layered on top, multiplied by (1 - mp) so it fades as
    //    the user scrolls — preventing fights with the scroll-tumble
    if (rootRef.current) {
      const scale = 1 - mp * 0.45
      rootRef.current.scale.setScalar(scale)
      rootRef.current.position.y = -mp * 1.1
      rootRef.current.position.z = -mp * 1.4
      const interactivity = 1 - mp * 0.85
      rootRef.current.rotation.x = -mp * 0.32  + (-py * 0.18) * interactivity
      rootRef.current.rotation.z =  mp * 0.20  + ( px * 0.12) * interactivity
    }

    // ── Core mesh: continuous rotation, breath, fade.
    //    Emissive dropped from 0.9 to 0.32 + base 0.05 so the core stays
    //    visible but doesn't wash out the white headline that sits on top.
    if (coreRef.current) {
      const speed = 0.18 + mp * 0.9    // spins faster as it leaves
      coreRef.current.rotation.x += dt * speed
      coreRef.current.rotation.y += dt * speed * 1.3
      const breath = 1 + Math.sin(t * 1.2) * 0.04
      coreRef.current.scale.setScalar(breath)
      const mat = coreRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.32 * fade + 0.05
    }

    // ── Wireframe overlay: counter-rotates slightly ─────────────
    if (wireRef.current) {
      wireRef.current.rotation.x -= dt * 0.4
      wireRef.current.rotation.y += dt * 0.25
      const breath = 1.05 + Math.sin(t * 1.2 + 0.3) * 0.04
      wireRef.current.scale.setScalar(breath)
      const mat = wireRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.32 * fade           // was 0.55 — softer wireframe so it sits behind text
    }

    // ── Tilted orbit rings ──────────────────────────────────────
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = t * 0.22
      const mat = ring1Ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.35 * fade           // was 0.6
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = -t * 0.16
      const mat = ring2Ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.25 * fade           // was 0.4
    }

    // ── Soft halo — pulled WAY down so it doesn't bloom into the text ──
    if (haloRef.current) {
      const pulse = 1 + Math.sin(t * 1.6) * 0.06
      haloRef.current.scale.setScalar(pulse * (1 - mp * 0.2))
      const mat = haloRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.14 * fade           // was 0.35
    }

    // ── Sparks: orbit subtly + twinkle ──────────────────────────
    if (sparksRef.current) {
      sparksRef.current.rotation.y = t * 0.08
      const mat = sparksRef.current.material as THREE.PointsMaterial
      mat.opacity = (0.35 + 0.35 * Math.sin(t * 2.3)) * fade
      mat.size = 0.06 + Math.sin(t * 1.6) * 0.01
    }
  })

  return (
    <group ref={rootRef}>
      {/* Soft halo backplate */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[2.4, 32, 32]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.35} side={THREE.BackSide} depthWrite={false} />
      </mesh>

      {/* Tilted orbit rings */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 2.6, 0, 0]}>
        <torusGeometry args={[1.65, 0.012, 16, 96]} />
        <meshBasicMaterial color="#c4b5fd" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[Math.PI / 3, Math.PI / 2.8, 0]}>
        <torusGeometry args={[1.95, 0.010, 16, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} />
      </mesh>

      {/* The core — solid icosahedron with emissive gradient */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1.05, 1]} />
        <meshStandardMaterial
          color="#5b21b6"
          emissive="#a78bfa"
          emissiveIntensity={0.9}
          roughness={0.25}
          metalness={0.55}
          flatShading
        />
      </mesh>

      {/* Wireframe overlay — gives the core that "AI mesh" feel */}
      <mesh ref={wireRef}>
        <icosahedronGeometry args={[1.20, 1]} />
        <meshBasicMaterial color="#c4b5fd" wireframe transparent opacity={0.55} depthWrite={false} />
      </mesh>

      {/* Spark particle swarm */}
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
