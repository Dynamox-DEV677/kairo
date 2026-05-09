/**
 * Heart Lab — real anatomical heart loaded from a GLB model.
 * Fits the model to a fixed size, plays any built-in animation it ships
 * with at a speed scaled by BPM, falls back to a manual lub-dub if there
 * are no embedded clips.
 */
import { Suspense, useRef, useEffect, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Text, useGLTF, useAnimations, Html } from '@react-three/drei'
import * as THREE from 'three'
import LabShell from './LabShell'

const HEART_MODEL_URL = '/models/beating-heart.glb'
const TARGET_SIZE = 3.2   // fit the heart's longest axis to this many world units

interface SimProps {
  params: { bpm: number }
  playing: boolean
}

function HeartSim({ params, playing }: SimProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 0.5, 7], fov: 45 }}
      style={{ background: 'radial-gradient(circle at center, #1c0a14 0%, #0a0a18 70%)' }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 6, 5]} intensity={1.4} color="#fde68a" castShadow />
      <directionalLight position={[-4, 2, 4]} intensity={0.6} color="#ffffff" />
      <pointLight position={[0, 3, 5]} intensity={0.8} color="#f87171" />
      <Stars radius={50} depth={20} count={400} factor={2} fade />

      <Suspense fallback={<HeartFallback />}>
        <HeartModel bpm={params.bpm} playing={playing} />
      </Suspense>

      <Text position={[0, -2.6, 0]} fontSize={0.3} color="#fafafa" anchorX="center"
        outlineWidth={0.02} outlineColor="#000">
        {params.bpm} BPM
      </Text>

      <OrbitControls enablePan={false} minDistance={3} maxDistance={20} />
    </Canvas>
  )
}

function HeartFallback() {
  return (
    <Html center>
      <div style={{
        background: 'rgba(13,13,13,0.85)', border: '1px solid rgba(248,113,113,0.4)',
        borderRadius: 10, padding: '10px 16px', fontFamily: 'inherit',
        fontSize: 12, color: '#fca5a5', whiteSpace: 'nowrap',
      }}>
        Loading heart model…
      </div>
    </Html>
  )
}

function HeartModel({ bpm, playing }: { bpm: number; playing: boolean }) {
  const { scene, animations } = useGLTF(HEART_MODEL_URL)
  // Outer group — drives the BPM pulse on top of the base fit scale
  const pulseRef = useRef<THREE.Group>(null)

  // Clone, enable shadows, and fit to TARGET_SIZE so the heart is always
  // visible regardless of the GLB's native units.
  const { cloned, fitScale } = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((obj: any) => {
      if (obj.isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
        if (obj.material && 'emissiveIntensity' in obj.material) {
          obj.material.emissiveIntensity = Math.max(obj.material.emissiveIntensity || 0, 0.18)
        }
      }
    })
    // Measure & center
    const box = new THREE.Box3().setFromObject(c)
    const size = new THREE.Vector3()
    box.getSize(size)
    const longest = Math.max(size.x, size.y, size.z) || 1
    const factor = TARGET_SIZE / longest
    c.scale.setScalar(factor)
    box.setFromObject(c)
    const center = new THREE.Vector3()
    box.getCenter(center)
    c.position.sub(center)
    return { cloned: c, fitScale: factor }
  }, [scene])

  const { actions, mixer } = useAnimations(animations, cloned)
  const hasAnim = animations.length > 0

  // Play the built-in beat animation if it exists.
  useEffect(() => {
    const names = Object.keys(actions)
    if (names.length === 0) return
    // Loop every clip the model ships with — a real heart often has multiple
    // bones animating in parallel.
    for (const name of names) {
      const action = actions[name]!
      action.reset()
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.clampWhenFinished = false
      if (playing) action.play()
      else action.stop()
    }
    return () => {
      for (const name of names) actions[name]?.stop()
    }
  }, [actions, playing])

  // Drive animation timescale by BPM (assume the clip is authored at ~60 BPM).
  useEffect(() => {
    const names = Object.keys(actions)
    if (names.length === 0) return
    for (const name of names) {
      const action = actions[name]!
      action.timeScale = bpm / 60
    }
  }, [actions, bpm])

  // useFrame:
  //   - if the model has clips, advance the mixer (drei does this automatically
  //     in newer versions but we drive it explicitly to scale by BPM-aware dt)
  //   - if not, do a manual lub-dub by scaling pulseRef
  const tRef = useRef(0)
  useFrame((_, dt) => {
    if (!playing) return
    if (hasAnim) {
      // useAnimations attaches a mixer; calling update again is harmless because
      // drei's <primitive> doesn't auto-tick the mixer for a cloned scene.
      mixer?.update(dt)
      return
    }
    if (!pulseRef.current) return
    tRef.current += dt
    const period = 60 / bpm
    const phase = (tRef.current % period) / period
    let pulse = 0
    if (phase < 0.18) pulse = 0.10 * Math.sin((phase / 0.18) * Math.PI)
    else if (phase > 0.28 && phase < 0.46) pulse = 0.05 * Math.sin(((phase - 0.28) / 0.18) * Math.PI)
    pulseRef.current.scale.setScalar(1 + pulse)
  })

  return (
    <group ref={pulseRef}>
      <primitive object={cloned} />
    </group>
  )
}

useGLTF.preload(HEART_MODEL_URL)

export default function HeartLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Human Heart" subject="Biology" topic="Circulation · Class 10"
      description="A real 3D anatomical heart model. Beats in time with the BPM slider — slow it down for resting heart rate, speed it up for cardio. Drag to rotate, scroll to zoom."
      Sim={HeartSim}
      defaultParams={{ bpm: 72 }}
      controls={[
        { key: 'bpm', label: 'Heart rate', type: 'slider', value: 72, min: 40, max: 180, step: 1, unit: 'bpm' },
      ]}
      aiPrompt={p => `A human heart beating at ${p.bpm} BPM. Explain the four chambers (RA, RV, LA, LV), the path of blood through pulmonary and systemic circulation, why the left ventricle has thicker walls, and what BPM ranges mean (resting, exercising, abnormal).`}
      onBack={onBack}
    />
  )
}
