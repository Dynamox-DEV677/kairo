import { useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Stars, useTexture, useGLTF } from '@react-three/drei'
import { AnimatePresence } from 'framer-motion'
import * as THREE from 'three'
import LabShell from './LabShell'
import LabScene from './LabScene'
import { PartInfoCard, PartHoverChip, PartIdleHint, LAB_PALETTE, type PartCatalog } from './LabKit'

const TEX_BASE = 'https://cdn.jsdelivr.net/gh/Dynamox-DEV677/kairo@main/models-cdn/space-textures'
const ISS_MODEL_URL = 'https://cdn.jsdelivr.net/gh/Dynamox-DEV677/kairo@main/models-cdn/iss.glb'

interface Body {
  id:     string
  label:  string
  texture: string
  radius: number
  orbit:  number
  period: number          
  spin:   number          
  hasRings?: boolean
  ringTexture?: string
  emissive?: boolean
  moons?: Body[]
}

const SUN: Body = { id: 'sun', label: 'Sun', texture: `${TEX_BASE}/sunmap.jpg`, radius: 1.5, orbit: 0, period: 0, spin: 25, emissive: true }

const BODIES: Body[] = [
  { id: 'mercury', label: 'Mercury', texture: `${TEX_BASE}/mercurymap.jpg`, radius: 0.16, orbit: 2.5,  period: 8,   spin: 4 },
  { id: 'venus',   label: 'Venus',   texture: `${TEX_BASE}/venusmap.jpg`,   radius: 0.28, orbit: 3.4,  period: 13,  spin: 6 },
  {
    id: 'earth', label: 'Earth', texture: `${TEX_BASE}/earthmap1k.jpg`, radius: 0.32, orbit: 4.4, period: 18, spin: 3,
    moons: [{ id: 'moon', label: 'Moon', texture: `${TEX_BASE}/moonmap1k.jpg`, radius: 0.10, orbit: 0.6, period: 4, spin: 4 }],
  },
  { id: 'mars',    label: 'Mars',    texture: `${TEX_BASE}/marsmap1k.jpg`,    radius: 0.22, orbit: 5.4, period: 25, spin: 3 },
  { id: 'jupiter', label: 'Jupiter', texture: `${TEX_BASE}/jupitermap.jpg`,   radius: 0.75, orbit: 7.3, period: 50, spin: 1.5 },
  { id: 'saturn',  label: 'Saturn',  texture: `${TEX_BASE}/saturnmap.jpg`,    radius: 0.65, orbit: 9.0, period: 70, spin: 1.7,
    hasRings: true, ringTexture: `${TEX_BASE}/saturnringcolor.jpg` },
  { id: 'uranus',  label: 'Uranus',  texture: `${TEX_BASE}/uranusmap.jpg`,    radius: 0.46, orbit: 10.6, period: 95, spin: 2 },
  { id: 'neptune', label: 'Neptune', texture: `${TEX_BASE}/neptunemap.jpg`,   radius: 0.46, orbit: 12.0, period: 120, spin: 2 },
]

const PARTS: PartCatalog = {
  sun: {
    id: 'sun', label: 'Sun', color: '#C7D2E8',
    function: 'G-type main-sequence star — fuses hydrogen into helium, releasing 3.8 × 10²⁶ watts of energy every second.',
    whyItMatters: 'Provides 99.86% of the solar system\'s mass and ALL of the energy that drives weather, climate, and life.',
    analogy: 'The reactor core of the solar system.',
    related: ['Nuclear fusion', 'Solar wind', 'Sunspots'],
  },
  mercury: {
    id: 'mercury', label: 'Mercury', color: '#a8a29e',
    function: 'Smallest planet. No atmosphere → temperature swings from −173°C to +427°C.',
    whyItMatters: 'Its iron core is 60% of its mass — odd, and a clue to ancient solar-system collisions.',
    analogy: 'A scorched cannonball racing close to the Sun.',
    related: ['Tidal locking', 'Caloris Basin', 'No atmosphere'],
  },
  venus: {
    id: 'venus', label: 'Venus', color: '#C7D2E8',
    function: 'Earth-sized but with a thick CO₂ atmosphere → runaway greenhouse, 462°C surface.',
    whyItMatters: 'A warning of what extreme greenhouse gases can do to a planet\'s climate.',
    analogy: 'Earth\'s evil twin.',
    related: ['Greenhouse effect', 'Sulfuric acid clouds', 'Retrograde rotation'],
  },
  earth: {
    id: 'earth', label: 'Earth', color: '#3b82f6',
    function: 'The only known planet with liquid water at the surface and life. 71% ocean coverage.',
    whyItMatters: 'It\'s the only home we have.',
    analogy: 'The blue marble.',
    related: ['Plate tectonics', 'Magnetic field', 'Goldilocks zone'],
  },
  moon: {
    id: 'moon', label: 'Moon (Luna)', color: '#B1B5BA',
    function: 'Earth\'s only natural satellite. Formed ~4.5 billion years ago from a Mars-sized impactor.',
    whyItMatters: 'Stabilises Earth\'s axial tilt → keeps the seasons predictable enough for life to evolve.',
    analogy: 'Earth\'s gravitational anchor.',
    related: ['Tides', 'Tidal locking', 'Lunar phases'],
  },
  mars: {
    id: 'mars', label: 'Mars', color: '#dc2626',
    function: 'The "red planet" — iron oxide dust. Thin CO₂ atmosphere, polar ice caps, ancient riverbeds.',
    whyItMatters: 'Strong evidence of past water → the best candidate for past microbial life.',
    analogy: 'A frozen, dusty version of Earth.',
    related: ['Olympus Mons', 'Polar caps', 'Mars rovers'],
  },
  jupiter: {
    id: 'jupiter', label: 'Jupiter', color: '#7C5CFF',
    function: 'The largest planet — a gas giant of hydrogen and helium with a 350-year-old storm.',
    whyItMatters: 'Jupiter\'s gravity acts as the solar system\'s "vacuum cleaner", deflecting comets that might hit Earth.',
    analogy: 'Solar system bodyguard + king of the gas giants.',
    related: ['Great Red Spot', 'Galilean moons', 'Magnetosphere'],
  },
  saturn: {
    id: 'saturn', label: 'Saturn', color: '#fcd34d',
    function: 'Gas giant famous for its bright ring system — billions of ice and rock particles in orbit.',
    whyItMatters: 'The rings are young (~100 million years) → a reminder that planetary systems keep evolving.',
    analogy: 'The solar system\'s show-off.',
    related: ['Ring system', 'Titan moon', 'Hexagonal storm'],
  },
  uranus: {
    id: 'uranus', label: 'Uranus', color: '#67e8f9',
    function: 'Ice giant tilted nearly 90° on its side — likely from a massive ancient collision.',
    whyItMatters: 'The extreme tilt means each pole gets 42 years of sunlight then 42 years of darkness.',
    analogy: 'A planet rolling on its side around the Sun.',
    related: ['Axial tilt', 'Methane atmosphere', 'Faint ring system'],
  },
  neptune: {
    id: 'neptune', label: 'Neptune', color: '#3b82f6',
    function: 'The windiest planet — supersonic winds up to 2,100 km/h. Discovered through math, not telescope.',
    whyItMatters: 'Its existence was predicted from Uranus\'s orbital wobble — a triumph of Newtonian mechanics.',
    analogy: 'A blue, stormy ice giant at the solar system\'s edge.',
    related: ['Storm dynamics', 'Triton moon', 'Mathematical discovery'],
  },
  asteroid_belt: {
    id: 'asteroid_belt', label: 'Asteroid Belt', color: '#a3a3a3',
    function: 'A torus of rocky debris between Mars and Jupiter — leftover building blocks from the early solar system.',
    whyItMatters: 'Jupiter\'s gravity prevented these rocks from coalescing into a planet.',
    analogy: 'The solar system\'s construction-site rubble that never got finished.',
    related: ['Dwarf planet Ceres', 'Vesta', 'Near-Earth asteroids'],
  },
  comet: {
    id: 'comet', label: 'Comet', color: '#67e8f9',
    function: 'A ball of ice, rock, and dust on an elliptical orbit. When near the Sun, ice sublimates → bright tail.',
    whyItMatters: 'Comets carry pristine material from the solar system\'s formation — frozen for 4.5 billion years.',
    analogy: 'A cosmic snowball that grows a tail near the Sun.',
    related: ['Halley\'s Comet', 'Oort Cloud', 'Solar wind tail'],
  },
  iss: {
    id: 'iss', label: 'International Space Station', color: '#e2e8f0',
    function: 'A 420-tonne research lab orbiting Earth at ~400 km altitude, completing one orbit every 90 minutes.',
    whyItMatters: 'The largest object humans have ever built in space — continuously occupied by astronauts since November 2000.',
    analogy: 'A football-field-sized science lab racing around Earth at 28,000 km/h.',
    related: ['Microgravity research', 'Orbital mechanics', 'International collaboration'],
  },
}

function Planet({ body, isHover, isSelected, onHover, onSelect }: any) {
  const ref = useRef<THREE.Group>(null)
  const planetRef = useRef<THREE.Mesh>(null)
  const tRef = useRef(Math.random() * Math.PI * 2)
  const texture = useTexture(body.texture) as unknown as THREE.Texture
  const ringTex = body.hasRings ? (useTexture(body.ringTexture) as unknown as THREE.Texture) : null

  useFrame((_, dt) => {
    if (ref.current && body.period > 0) {
      tRef.current += (Math.PI * 2 / body.period) * dt
      ref.current.position.x = Math.cos(tRef.current) * body.orbit
      ref.current.position.z = Math.sin(tRef.current) * body.orbit
    }
    if (planetRef.current && body.spin > 0) {
      planetRef.current.rotation.y += (Math.PI * 2 / body.spin) * dt
    }
  })

  const isLit = isHover || isSelected

  return (
    <group ref={ref} position={[body.orbit, 0, 0]}>
      <mesh ref={planetRef}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(body.id); document.body.style.cursor='pointer' }}
        onPointerOut={() => { onHover(null); document.body.style.cursor='default' }}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(body.id) }}>
        <sphereGeometry args={[body.radius, 48, 48]} />
        {body.emissive
          ? <meshBasicMaterial map={texture} />
          : <meshStandardMaterial
              map={texture}
              roughness={0.85}
              emissive={isLit ? '#ffffff' : '#000'}
              emissiveIntensity={isLit ? 0.35 : 0}
            />}
      </mesh>
      {body.hasRings && ringTex && (
        <mesh rotation={[Math.PI / 2.2, 0, 0]}>
          <ringGeometry args={[body.radius * 1.35, body.radius * 2.3, 96]} />
          <meshBasicMaterial map={ringTex} side={THREE.DoubleSide} transparent opacity={0.85} />
        </mesh>
      )}
      {body.moons?.map((m: Body) => (
        <Planet key={m.id} body={m}
          isHover={isHover} isSelected={isSelected}
          onHover={onHover} onSelect={onSelect} />
      ))}
      {body.id === 'earth' && (
        <ISS onHover={onHover} onSelect={onSelect} />
      )}
    </group>
  )
}

function ISS({ onHover, onSelect }: any) {
  const groupRef = useRef<THREE.Group>(null)
  const tRef = useRef(Math.random() * Math.PI * 2)
  const { scene } = useGLTF(ISS_MODEL_URL)

  const cloned = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((obj: any) => {
      if (obj.isMesh) {
        obj.castShadow = false
        obj.receiveShadow = false
      }
    })
    const box = new THREE.Box3().setFromObject(c)
    const size = new THREE.Vector3()
    box.getSize(size)
    const longest = Math.max(size.x, size.y, size.z) || 1
    c.scale.setScalar(0.18 / longest)
    return c
  }, [scene])

  const ORBIT_R = 0.55
  const PERIOD  = 2.5  

  useFrame((_, dt) => {
    if (!groupRef.current) return
    tRef.current += (Math.PI * 2 / PERIOD) * dt
    groupRef.current.position.x = Math.cos(tRef.current) * ORBIT_R
    groupRef.current.position.z = Math.sin(tRef.current) * ORBIT_R
    groupRef.current.position.y = Math.sin(tRef.current * 0.7) * 0.05
    groupRef.current.rotation.y = -tRef.current + Math.PI / 2
  })

  return (
    <group ref={groupRef}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover('iss'); document.body.style.cursor='pointer' }}
      onPointerOut={() => { onHover(null); document.body.style.cursor='default' }}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect('iss') }}>
      <primitive object={cloned} />
      <mesh>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial color="#e2e8f0" transparent opacity={0.15} />
      </mesh>
    </group>
  )
}

useGLTF.preload(ISS_MODEL_URL)

function Sun({ onHover, onSelect, hovered, selected }: any) {
  const ref = useRef<THREE.Mesh>(null)
  const texture = useTexture(SUN.texture) as unknown as THREE.Texture
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += (Math.PI * 2 / SUN.spin) * dt
  })
  return (
    <group>
      <pointLight position={[0, 0, 0]} intensity={3} color="#fde047" distance={30} decay={1.5} />
      <mesh ref={ref}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover('sun'); document.body.style.cursor='pointer' }}
        onPointerOut={() => { onHover(null); document.body.style.cursor='default' }}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect('sun') }}>
        <sphereGeometry args={[SUN.radius, 48, 48]} />
        <meshBasicMaterial map={texture} />
      </mesh>
      <mesh scale={1.15}>
        <sphereGeometry args={[SUN.radius, 32, 32]} />
        <meshBasicMaterial color="#C7D2E8" transparent opacity={0.18} side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

function AsteroidBelt({ onHover, onSelect }: any) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const N = 250
  const seeds = useMemo(() => Array.from({ length: N }).map(() => ({
    angle: Math.random() * Math.PI * 2,
    r:     6.0 + Math.random() * 0.7,
    y:     (Math.random() - 0.5) * 0.2,
    scale: 0.03 + Math.random() * 0.07,
    speed: 0.15 + Math.random() * 0.08,
    rotAxis: new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize(),
  })), [])

  useFrame((_, dt) => {
    if (!ref.current) return
    const tmp = new THREE.Object3D()
    seeds.forEach((s, i) => {
      s.angle += s.speed * dt
      tmp.position.set(Math.cos(s.angle) * s.r, s.y, Math.sin(s.angle) * s.r)
      tmp.scale.setScalar(s.scale)
      tmp.rotation.set(s.angle * 2, s.angle, 0)
      tmp.updateMatrix()
      ref.current!.setMatrixAt(i, tmp.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover('asteroid_belt'); document.body.style.cursor='pointer' }}
      onPointerOut={() => { onHover(null); document.body.style.cursor='default' }}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect('asteroid_belt') }}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#a3a3a3" roughness={0.95} />
    </instancedMesh>
  )
}

function Comet({ onHover, onSelect }: any) {
  const headRef = useRef<THREE.Mesh>(null)
  const tailRef = useRef<THREE.Mesh>(null)
  const tRef = useRef(0)
  const a = 9    
  const b = 5    
  const period = 60

  useFrame((_, dt) => {
    tRef.current += (Math.PI * 2 / period) * dt
    const x = Math.cos(tRef.current) * a
    const z = Math.sin(tRef.current) * b
    if (headRef.current) headRef.current.position.set(x, 0.5, z)
    if (tailRef.current) {
      const dir = new THREE.Vector3(x, 0.5, z).normalize()
      tailRef.current.position.set(x + dir.x * 0.6, 0.5 + dir.y * 0.6, z + dir.z * 0.6)
      tailRef.current.lookAt(0, 0.5, 0)
      tailRef.current.rotateX(Math.PI / 2)
    }
  })

  return (
    <group>
      <mesh ref={headRef}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover('comet'); document.body.style.cursor='pointer' }}
        onPointerOut={() => { onHover(null); document.body.style.cursor='default' }}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect('comet') }}>
        <sphereGeometry args={[0.10, 16, 16]} />
        <meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={1.2} />
      </mesh>
      <mesh ref={tailRef}>
        <coneGeometry args={[0.05, 1.2, 12]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.55} />
      </mesh>
    </group>
  )
}

function OrbitRing({ radius }: { radius: number }) {
  const points: THREE.Vector3[] = []
  const N = 96
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2
    points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius))
  }
  const geom = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [radius])
  return (
    <line>
      <primitive object={geom} attach="geometry" />
      <lineBasicMaterial color="#4B5563" transparent opacity={0.3} />
    </line>
  )
}

function SolarSim({ playing }: { params: any; playing: boolean }) {
  const [hovered, setHovered]   = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <LabScene cameraPos={[0, 10, 16]} cameraFov={55} tint={LAB_PALETTE.space} particles={0} stars={false}>
        <Stars radius={140} depth={50} count={4000} factor={4} saturation={0} fade speed={0.1} />

        <Sun onHover={setHovered} onSelect={setSelected} hovered={hovered} selected={selected} />

        {BODIES.map(b => <OrbitRing key={`ring-${b.id}`} radius={b.orbit} />)}
        {BODIES.map(b => (
          <Planet key={b.id} body={b}
            isHover={hovered === b.id}
            isSelected={selected === b.id}
            onHover={setHovered} onSelect={setSelected} />
        ))}

        <AsteroidBelt onHover={setHovered} onSelect={setSelected} />
        <Comet onHover={setHovered} onSelect={setSelected} />

        <OrbitControls enablePan={false} minDistance={5} maxDistance={50}
          autoRotate={!hovered && !selected} autoRotateSpeed={0.15} />
      </LabScene>

      <PartHoverChip hovered={hovered} selected={selected} catalog={PARTS} />
      <PartIdleHint hovered={hovered} selected={selected} hint="Click the Sun, a planet, the Moon, the ISS, asteroid belt, or comet" />
      <AnimatePresence>
        {selected && PARTS[selected] && (
          <PartInfoCard part={PARTS[selected]} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

useTexture.preload(SUN.texture)
BODIES.forEach(b => {
  useTexture.preload(b.texture)
  if (b.ringTexture) useTexture.preload(b.ringTexture)
  b.moons?.forEach(m => useTexture.preload(m.texture))
})

export default function SolarSystemLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Solar System" subject="Space" topic="Astronomy · Class 6-12"
      description="Photo-textured planets orbit the Sun while spinning on their own axes. Earth has the Moon AND the International Space Station; Saturn has its rings; the asteroid belt drifts between Mars and Jupiter; a comet on an elliptical orbit grows a tail near the Sun. Click anything to learn what makes it unique."
      Sim={SolarSim}
      defaultParams={{}}
      controls={[]}
      aiPrompt={() => `Interactive 3D solar system with photo-textured bodies. Walk through: Sun (G-type star, fusion-powered), inner rocky planets (Mercury → Mars), the asteroid belt, gas + ice giants (Jupiter → Neptune), Earth's Moon, the International Space Station orbiting Earth, and a comet on an elliptical orbit. Cover why the inner planets are rocky vs outer being gas/ice (frost line). End with the Goldilocks zone, why Earth has life, and how the ISS is humanity's permanent foothold in space.`}
      onBack={onBack}
    />
  )
}
