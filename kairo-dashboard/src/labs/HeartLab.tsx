/**
 * Heart Lab — anatomical 3D heart with great vessels, pulsing in time with BPM.
 * Built from an extruded heart-curve silhouette plus tube-geometry vessels.
 */
import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Text } from '@react-three/drei'
import * as THREE from 'three'
import LabShell from './LabShell'

interface SimProps {
  params: { bpm: number }
  playing: boolean
}

function HeartSim({ params, playing }: SimProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [3, 1.2, 6.5], fov: 50 }}
      style={{ background: 'radial-gradient(circle at center, #1c0a14 0%, #0a0a18 70%)' }}
    >
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 6, 5]} intensity={1.1} color="#fde68a" castShadow />
      <pointLight position={[-4, -2, 3]} intensity={0.6} color="#f87171" />
      <pointLight position={[3, -3, -3]} intensity={0.4} color="#a78bfa" />
      <Stars radius={50} depth={20} count={400} factor={2} fade />

      <AnatomicalHeart bpm={params.bpm} playing={playing} />

      <Text position={[0, -3.5, 0]} fontSize={0.4} color="#fafafa">{params.bpm} BPM</Text>
      <OrbitControls enablePan={false} minDistance={4} maxDistance={20} />
    </Canvas>
  )
}

/** Build the iconic 2D heart silhouette using bezier curves, ready for extrusion. */
function makeHeartShape(scale = 1): THREE.Shape {
  const s = new THREE.Shape()
  s.moveTo( 0,    0.5 * scale)
  // Right lobe
  s.bezierCurveTo( 0.15 * scale,  0.95 * scale,    0.8 * scale,  1.1 * scale,    1.0 * scale,  0.35 * scale)
  s.bezierCurveTo( 1.2 * scale, -0.2 * scale,    0.6 * scale, -0.85 * scale,    0.0 * scale, -1.5 * scale)
  // Left lobe
  s.bezierCurveTo(-0.6 * scale, -0.85 * scale,  -1.2 * scale, -0.2 * scale,   -1.0 * scale,  0.35 * scale)
  s.bezierCurveTo(-0.8 * scale,  1.1 * scale,   -0.15 * scale, 0.95 * scale,   0,             0.5 * scale)
  return s
}

function AnatomicalHeart({ bpm, playing }: { bpm: number; playing: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const tRef = useRef(0)

  // Heart silhouette extruded into 3D — gives a real cardiac shape, not a sphere.
  const heartGeom = useMemo(() => {
    const shape = makeHeartShape(1.1)
    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: 1.4, bevelEnabled: true,
      bevelSegments: 6, steps: 4, bevelSize: 0.35, bevelThickness: 0.35,
      curveSegments: 24,
    })
    geom.center()
    geom.computeVertexNormals()
    return geom
  }, [])

  // Septum (line between left and right halves of the heart) — flat plane subtly visible
  // Aortic arch — tube curving up and to the side
  const aorticArch = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3( 0.1,  0.7,  0.0),
      new THREE.Vector3( 0.2,  1.4,  0.0),
      new THREE.Vector3( 0.0,  2.0,  0.0),
      new THREE.Vector3(-0.7,  2.2,  0.0),
      new THREE.Vector3(-1.2,  1.7,  0.0),
    ])
    return new THREE.TubeGeometry(curve, 30, 0.18, 12, false)
  }, [])

  // Pulmonary trunk — curves the other way, slightly behind
  const pulmonaryTrunk = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.3,  0.7, -0.1),
      new THREE.Vector3(-0.2,  1.5, -0.1),
      new THREE.Vector3( 0.5,  1.9, -0.1),
      new THREE.Vector3( 1.0,  1.5, -0.1),
    ])
    return new THREE.TubeGeometry(curve, 30, 0.16, 12, false)
  }, [])

  // Superior + inferior vena cava — vertical tubes (deoxygenated, blue)
  const svc = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3( 0.85, 0.9,  0.1),
      new THREE.Vector3( 0.95, 1.7,  0.1),
      new THREE.Vector3( 1.0,  2.4,  0.1),
    ])
    return new THREE.TubeGeometry(curve, 20, 0.18, 12, false)
  }, [])
  const ivc = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3( 0.7, -0.7,  0.1),
      new THREE.Vector3( 0.85, -1.4, 0.1),
      new THREE.Vector3( 1.0, -2.1,  0.1),
    ])
    return new THREE.TubeGeometry(curve, 20, 0.18, 12, false)
  }, [])

  // Pulmonary veins — 4 small tubes feeding LA (left side)
  const pulmonaryVeins = useMemo(() => {
    const make = (sx: number, sz: number) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.85 + sx * 0.1, 1.1 + sz * 0.1, 0.0),
        new THREE.Vector3(-1.4 + sx, 1.5 + sz, sx * 0.5),
        new THREE.Vector3(-1.9 + sx * 1.4, 1.8 + sz * 1.2, sx * 0.7),
      ])
      return new THREE.TubeGeometry(curve, 16, 0.09, 10, false)
    }
    return [
      make(-0.2, 0.1), make(-0.3, -0.2), make(-0.1, -0.3), make(0.0, 0.2),
    ]
  }, [])

  // Coronary artery — wraps across the front of the heart
  const coronary = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.7,  0.4, 0.85),
      new THREE.Vector3( 0.0,  0.2, 0.95),
      new THREE.Vector3( 0.7,  0.0, 0.85),
      new THREE.Vector3( 0.5, -0.8, 0.85),
      new THREE.Vector3(-0.2, -1.1, 0.85),
    ])
    return new THREE.TubeGeometry(curve, 50, 0.05, 8, false)
  }, [])

  // Pulse animation
  useFrame((_, dt) => {
    if (!playing || !groupRef.current) return
    tRef.current += dt
    const period = 60 / bpm
    const phase = (tRef.current % period) / period
    // Lub (atrial+ventricular contract) then dub (semilunar valves close)
    let scale = 1
    if (phase < 0.18) scale = 1 + 0.16 * Math.sin((phase / 0.18) * Math.PI)
    else if (phase > 0.28 && phase < 0.46) scale = 1 + 0.08 * Math.sin(((phase - 0.28) / 0.18) * Math.PI)
    groupRef.current.scale.setScalar(scale)
  })

  return (
    <group ref={groupRef} rotation={[0, 0, -0.15]}>
      {/* Main heart muscle (myocardium) — extruded heart silhouette */}
      <mesh geometry={heartGeom} castShadow receiveShadow>
        <meshStandardMaterial
          color="#9f1239" emissive="#7f1d1d" emissiveIntensity={0.18}
          roughness={0.55} metalness={0.05}
        />
      </mesh>

      {/* Subtle fatty epicardium highlight */}
      <mesh geometry={heartGeom} scale={[1.02, 1.02, 1.02]}>
        <meshStandardMaterial color="#fbbf24" transparent opacity={0.08} roughness={1} />
      </mesh>

      {/* Subtle septum line (left/right divide) — thin dark plane */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.04, 2.2, 1.5]} />
        <meshStandardMaterial color="#450a0a" roughness={1} />
      </mesh>

      {/* Aortic arch — bright red */}
      <mesh geometry={aorticArch} castShadow>
        <meshStandardMaterial color="#dc2626" emissive="#7f1d1d" emissiveIntensity={0.12} roughness={0.45} />
      </mesh>

      {/* Pulmonary trunk — slightly darker red (low-O₂ blood goes to lungs) */}
      <mesh geometry={pulmonaryTrunk} castShadow>
        <meshStandardMaterial color="#7e22ce" emissive="#3b0764" emissiveIntensity={0.15} roughness={0.5} />
      </mesh>

      {/* Vena cavae — blue (deoxygenated) */}
      <mesh geometry={svc} castShadow>
        <meshStandardMaterial color="#1e3a8a" emissive="#1e3a8a" emissiveIntensity={0.12} roughness={0.5} />
      </mesh>
      <mesh geometry={ivc} castShadow>
        <meshStandardMaterial color="#1e3a8a" emissive="#1e3a8a" emissiveIntensity={0.12} roughness={0.5} />
      </mesh>

      {/* Pulmonary veins — bright red (oxygenated, despite being veins) */}
      {pulmonaryVeins.map((g, i) => (
        <mesh key={i} geometry={g} castShadow>
          <meshStandardMaterial color="#dc2626" emissive="#7f1d1d" emissiveIntensity={0.1} roughness={0.5} />
        </mesh>
      ))}

      {/* Coronary artery */}
      <mesh geometry={coronary}>
        <meshStandardMaterial color="#fbbf24" emissive="#92400e" emissiveIntensity={0.3} roughness={0.4} metalness={0.3} />
      </mesh>

      {/* Chamber labels (front-facing) */}
      <Text position={[-1.5,  0.7, 0.9]} fontSize={0.18} color="#93c5fd" anchorX="right">RA</Text>
      <Text position={[-1.4, -0.6, 0.9]} fontSize={0.18} color="#93c5fd" anchorX="right">RV</Text>
      <Text position={[ 1.5,  0.7, 0.9]} fontSize={0.18} color="#fca5a5" anchorX="left">LA</Text>
      <Text position={[ 1.4, -0.6, 0.9]} fontSize={0.18} color="#fca5a5" anchorX="left">LV</Text>

      {/* Vessel labels */}
      <Text position={[-1.4,  2.5, 0]} fontSize={0.13} color="#fca5a5" anchorX="right">Aorta</Text>
      <Text position={[ 1.3,  2.0, 0]} fontSize={0.13} color="#d8b4fe" anchorX="left">Pulm. trunk</Text>
      <Text position={[ 1.4,  2.5, 0]} fontSize={0.12} color="#93c5fd" anchorX="left">SVC</Text>
      <Text position={[ 1.4, -2.2, 0]} fontSize={0.12} color="#93c5fd" anchorX="left">IVC</Text>
    </group>
  )
}

export default function HeartLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Human Heart" subject="Biology" topic="Circulation · Class 10"
      description="Anatomical heart with the four chambers, septum, aortic arch, pulmonary trunk, vena cavae, pulmonary veins, and a coronary artery. Pulses in time with the BPM you set."
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
