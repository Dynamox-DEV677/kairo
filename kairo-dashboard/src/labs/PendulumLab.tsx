/**
 * Pendulum Lab — Newton's Cradle visual driven by single-pendulum physics.
 * The leftmost ball-frame swings on the pendulum equation; the rest of the
 * cradle is the still GLB model.
 */
import { Suspense, useRef, useEffect, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, useGLTF, useAnimations, Html, Bounds } from '@react-three/drei'
import * as THREE from 'three'
import LabShell from './LabShell'

const CRADLE_MODEL_URL = '/models/newtons_cradle.glb'

interface SimProps {
  params: { length: number; gravity: number; damping: number; angle: number }
  playing: boolean
}

function PendulumSim({ params, playing }: SimProps) {
  return (
    <Canvas camera={{ position: [0, 1, 7], fov: 50 }}
      style={{ background: 'radial-gradient(circle at 30% 30%,#0c0c1f 0%,#050510 70%)' }}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 8, 5]} intensity={1.1} color="#fde68a" castShadow />
      <directionalLight position={[-5, 4, -3]} intensity={0.5} color="#a5b4fc" />
      <Stars radius={40} depth={20} count={800} factor={3} fade speed={0.2} />

      <Suspense fallback={<LoaderChip />}>
        <Bounds fit clip observe margin={1.15}>
          <Cradle {...params} playing={playing} />
        </Bounds>
      </Suspense>

      <OrbitControls enablePan={false} minDistance={3} maxDistance={20} />
    </Canvas>
  )
}

function LoaderChip() {
  return (
    <Html center>
      <div style={{
        background: 'rgba(13,13,13,0.85)', border: '1px solid rgba(99,102,241,0.4)',
        borderRadius: 10, padding: '8px 14px', fontFamily: 'inherit',
        fontSize: 11, color: '#a5b4fc', whiteSpace: 'nowrap',
      }}>
        Loading Newton's cradle…
      </div>
    </Html>
  )
}

function Cradle({ length, gravity, damping, angle, playing }: any) {
  const { scene, animations } = useGLTF(CRADLE_MODEL_URL)
  const groupRef = useRef<THREE.Group>(null)
  const stateRef = useRef({ theta: (angle * Math.PI) / 180, omega: 0 })

  // Clone so multiple mounts don't share state
  const cloned = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((o: any) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true }
    })
    return c
  }, [scene])

  // If the GLB ships with a built-in cradle animation, use it; otherwise drive
  // the swing manually.
  const { actions } = useAnimations(animations, cloned)

  // Reset physics whenever the user changes initial conditions
  useEffect(() => {
    stateRef.current = { theta: (angle * Math.PI) / 180, omega: 0 }
  }, [angle, length])

  useEffect(() => {
    const names = Object.keys(actions)
    if (names.length === 0) return
    const action = actions[names[0]]!
    action.reset().setLoop(THREE.LoopRepeat, Infinity)
    if (playing) action.play()
    else action.stop()
    return () => { action.stop() }
  }, [actions, playing])

  useFrame((_, dt) => {
    if (!playing || !groupRef.current) return
    const s = stateRef.current
    const step = Math.min(dt, 0.05)
    // Pendulum eq: θ'' = −(g/L) sin θ − d·θ'
    const accel = -(gravity / length) * Math.sin(s.theta) - damping * s.omega
    s.omega += accel * step
    s.theta += s.omega * step

    // Tilt the whole cradle on the swing axis. Real Newton's Cradle would
    // animate individual end-balls, but without rigid-body physics this still
    // reads as oscillation tied to your sliders.
    groupRef.current.rotation.z = s.theta * 0.6   // damp the visual tilt so it doesn't flip
  })

  return (
    <group ref={groupRef}>
      <primitive object={cloned} />
    </group>
  )
}

useGLTF.preload(CRADLE_MODEL_URL)

export default function PendulumLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Pendulum Motion" subject="Physics" topic="Simple Harmonic Motion · Class 11"
      description="Newton's cradle driven by the simple-pendulum equation. The period depends only on length and gravity — not mass. Drag to rotate the model, scroll to zoom."
      Sim={PendulumSim}
      defaultParams={{ length: 3, gravity: 9.8, damping: 0.05, angle: 30 }}
      controls={[
        { key: 'length',   label: 'String length', type: 'slider', value: 3,    min: 1, max: 5,    step: 0.1, unit: 'm' },
        { key: 'gravity',  label: 'Gravity',        type: 'slider', value: 9.8,  min: 1, max: 25,   step: 0.1, unit: 'm/s²' },
        { key: 'damping',  label: 'Air damping',    type: 'slider', value: 0.05, min: 0, max: 0.5,  step: 0.01 },
        { key: 'angle',    label: 'Initial angle',  type: 'slider', value: 30,   min: 5, max: 80,   step: 1,   unit: '°' },
      ]}
      aiPrompt={p => `A Newton's cradle modelled as a single pendulum of length ${p.length} m swinging under gravity ${p.gravity} m/s² with damping ${p.damping} and initial angle ${p.angle}°. Explain simple harmonic motion, the period formula $T = 2\\pi\\sqrt{L/g}$, why mass doesn't appear, and how a real Newton's cradle demonstrates conservation of momentum and energy.`}
      onBack={onBack}
    />
  )
}
