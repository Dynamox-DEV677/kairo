/**
 * Heart Lab — real anatomical heart loaded from a GLB model.
 * If the model ships with a beat animation, we play it at a speed that matches
 * the BPM slider; otherwise we fall back to scaling the whole group on a
 * lub-dub timing.
 */
import { Suspense, useRef, useEffect, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Text, useGLTF, useAnimations, Center, Bounds, Html } from '@react-three/drei'
import * as THREE from 'three'
import LabShell from './LabShell'

const HEART_MODEL_URL = '/models/beating-heart.glb'

interface SimProps {
  params: { bpm: number }
  playing: boolean
}

function HeartSim({ params, playing }: SimProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [3, 1.5, 6.5], fov: 45 }}
      style={{ background: 'radial-gradient(circle at center, #1c0a14 0%, #0a0a18 70%)' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 5]} intensity={1.4} color="#fde68a" castShadow />
      <pointLight position={[-4, -2, 3]} intensity={0.8} color="#f87171" />
      <pointLight position={[3, -3, -3]} intensity={0.4} color="#a78bfa" />
      <Stars radius={50} depth={20} count={400} factor={2} fade />

      <Suspense fallback={<HeartFallback />}>
        <Bounds fit clip observe margin={1.1}>
          <HeartModel bpm={params.bpm} playing={playing} />
        </Bounds>
      </Suspense>

      <Text position={[0, -2.4, 0]} fontSize={0.32} color="#fafafa" anchorX="center"
        outlineWidth={0.02} outlineColor="#000">
        {params.bpm} BPM
      </Text>

      <OrbitControls enablePan={false} minDistance={2} maxDistance={20} />
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
  const groupRef = useRef<THREE.Group>(null)

  // Clone the scene so multiple Lab mounts don't share state.
  const cloned = useMemo(() => scene.clone(true), [scene])

  // Cast soft shadows; brighten emissive so the heart isn't dark in our scene.
  useEffect(() => {
    cloned.traverse((obj: any) => {
      if (obj.isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
        if (obj.material && 'emissiveIntensity' in obj.material) {
          obj.material.emissiveIntensity = Math.max(obj.material.emissiveIntensity || 0, 0.15)
        }
      }
    })
  }, [cloned])

  const { actions, mixer } = useAnimations(animations, cloned)

  // Play the model's built-in beat animation if it has one.
  // Speed scales with bpm (assuming animation runs at ~72 bpm by default).
  useEffect(() => {
    const names = Object.keys(actions)
    if (names.length === 0) return
    const action = actions[names[0]]!
    action.reset()
    action.setLoop(THREE.LoopRepeat, Infinity)
    if (playing) action.play()
    else action.stop()
    return () => { action.stop() }
  }, [actions, playing])

  // Animation timeScale = bpm / 72 → faster heart = faster beat
  useEffect(() => {
    const names = Object.keys(actions)
    if (names.length === 0) return
    actions[names[0]]!.timeScale = bpm / 72
  }, [actions, bpm])

  // Manual lub-dub fallback when the model has no animation.
  const tRef = useRef(0)
  const hasAnim = animations.length > 0
  useFrame((_, dt) => {
    if (!playing || !groupRef.current) return
    if (hasAnim) {
      mixer?.update(dt * (bpm / 72))
      return
    }
    tRef.current += dt
    const period = 60 / bpm
    const phase = (tRef.current % period) / period
    let scale = 1
    if (phase < 0.18) scale = 1 + 0.14 * Math.sin((phase / 0.18) * Math.PI)
    else if (phase > 0.28 && phase < 0.46) scale = 1 + 0.07 * Math.sin(((phase - 0.28) / 0.18) * Math.PI)
    groupRef.current.scale.setScalar(scale)
  })

  return (
    <group ref={groupRef}>
      <Center>
        <primitive object={cloned} />
      </Center>
    </group>
  )
}

// Preload the heart so opening the lab doesn't show the loader for long.
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
