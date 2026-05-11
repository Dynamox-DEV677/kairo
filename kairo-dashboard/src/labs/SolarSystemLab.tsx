/**
 * Solar System Lab — clickable planets orbiting the sun.
 * Procedural — no GLB needed. Planet radii/colours stylised for clarity, not
 * to scale (true scale would make most planets invisible specks).
 */
import { useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { AnimatePresence } from 'framer-motion'
import * as THREE from 'three'
import LabShell from './LabShell'
import LabScene from './LabScene'
import { PartInfoCard, PartHoverChip, PartIdleHint, LAB_PALETTE, type PartCatalog } from './LabKit'

interface Body {
  id:     string
  label:  string
  color:  string
  emissive?: string
  radius: number      // visual size
  orbit:  number      // orbit radius around the sun
  period: number      // seconds per full revolution (visual, not real)
  hasRings?: boolean
}

const BODIES: Body[] = [
  { id: 'sun',     label: 'Sun',     color: '#fbbf24', emissive: '#fde047', radius: 1.2, orbit: 0,    period: 0   },
  { id: 'mercury', label: 'Mercury', color: '#a8a29e',                       radius: 0.15, orbit: 2.0,  period: 8   },
  { id: 'venus',   label: 'Venus',   color: '#facc15',                       radius: 0.25, orbit: 2.8,  period: 13  },
  { id: 'earth',   label: 'Earth',   color: '#3b82f6',                       radius: 0.28, orbit: 3.8,  period: 18  },
  { id: 'mars',    label: 'Mars',    color: '#dc2626',                       radius: 0.20, orbit: 4.7,  period: 25  },
  { id: 'jupiter', label: 'Jupiter', color: '#fb923c',                       radius: 0.65, orbit: 6.5,  period: 50  },
  { id: 'saturn',  label: 'Saturn',  color: '#fcd34d',                       radius: 0.55, orbit: 8.0,  period: 70, hasRings: true },
  { id: 'uranus',  label: 'Uranus',  color: '#67e8f9',                       radius: 0.40, orbit: 9.5,  period: 95  },
  { id: 'neptune', label: 'Neptune', color: '#3b82f6',                       radius: 0.40, orbit: 10.8, period: 120 },
]

const PARTS: PartCatalog = {
  sun: {
    id: 'sun', label: 'Sun', color: '#fbbf24',
    function: 'A G-type main-sequence star — fuses hydrogen into helium in its core, releasing energy.',
    whyItMatters: 'Provides 99.86% of the solar system\'s mass and ALL of the energy that drives Earth\'s climate, weather, and life.',
    analogy: 'The reactor core of the solar system.',
    related: ['Nuclear fusion', 'Solar wind', 'Sunspots'],
  },
  mercury: {
    id: 'mercury', label: 'Mercury', color: '#a8a29e',
    function: 'The smallest and innermost planet. No atmosphere → temperature swings from −173°C to +427°C.',
    whyItMatters: 'Mercury\'s tiny iron core takes up 60% of its mass — odd, and a clue to early solar-system collisions.',
    analogy: 'Like a scorched cannonball racing close to the Sun.',
    related: ['Tidal locking', 'Cratered surface', 'Caloris Basin'],
  },
  venus: {
    id: 'venus', label: 'Venus', color: '#facc15',
    function: 'Similar in size to Earth but with a thick CO₂ atmosphere → runaway greenhouse effect, surface 462°C.',
    whyItMatters: 'A warning of what extreme greenhouse gases can do to a planet\'s climate.',
    analogy: 'Earth\'s evil twin.',
    related: ['Greenhouse effect', 'Sulfuric acid clouds', 'Retrograde rotation'],
  },
  earth: {
    id: 'earth', label: 'Earth', color: '#3b82f6',
    function: 'The only known planet with liquid water at the surface and life.',
    whyItMatters: 'It\'s the only home we have.',
    analogy: 'The blue marble.',
    related: ['Plate tectonics', 'Magnetic field', 'Goldilocks zone'],
  },
  mars: {
    id: 'mars', label: 'Mars', color: '#dc2626',
    function: 'The "red planet" — iron oxide dust gives it that colour. Thin CO₂ atmosphere, polar ice caps.',
    whyItMatters: 'Strong evidence of ancient water flow → the best candidate for past microbial life in the solar system.',
    analogy: 'A frozen, dusty version of Earth — minus the oceans.',
    related: ['Olympus Mons', 'Polar caps', 'Mars rovers'],
  },
  jupiter: {
    id: 'jupiter', label: 'Jupiter', color: '#fb923c',
    function: 'The largest planet — a gas giant of mostly hydrogen and helium. Has a 350-year-old storm (Great Red Spot).',
    whyItMatters: 'Jupiter\'s gravity acts as the solar system\'s "vacuum cleaner", deflecting comets that might hit Earth.',
    analogy: 'Solar system bodyguard + king of the gas giants.',
    related: ['Great Red Spot', 'Galilean moons', 'Magnetosphere'],
  },
  saturn: {
    id: 'saturn', label: 'Saturn', color: '#fcd34d',
    function: 'A gas giant famous for its bright ring system — billions of ice and rock particles in orbit.',
    whyItMatters: 'The rings are young (~100 million years) → a reminder that planetary systems keep evolving.',
    analogy: 'The solar system\'s show-off.',
    related: ['Ring system', 'Titan moon', 'Hexagonal storm'],
  },
  uranus: {
    id: 'uranus', label: 'Uranus', color: '#67e8f9',
    function: 'An ice giant tilted nearly 90° on its side — likely from a massive ancient collision.',
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
}

function PlanetMesh({ body, isHover, isSelected, onHover, onSelect }: {
  body: Body
  isHover: boolean
  isSelected: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}) {
  const ref = useRef<THREE.Mesh>(null)
  const tRef = useRef(Math.random() * Math.PI * 2)
  useFrame((_, dt) => {
    if (body.period === 0) return
    tRef.current += (Math.PI * 2 / body.period) * dt
    if (ref.current) {
      ref.current.position.x = Math.cos(tRef.current) * body.orbit
      ref.current.position.z = Math.sin(tRef.current) * body.orbit
      ref.current.rotation.y += dt * 0.5
    }
  })
  const glow = isHover || isSelected
  return (
    <group>
      <mesh ref={ref} position={[body.orbit, 0, 0]}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(body.id); document.body.style.cursor='pointer' }}
        onPointerOut={() => { onHover(null); document.body.style.cursor='default' }}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(body.id) }}>
        <sphereGeometry args={[body.radius, 32, 32]} />
        <meshStandardMaterial
          color={body.color}
          emissive={body.emissive || body.color}
          emissiveIntensity={body.id === 'sun' ? 1.4 : (glow ? 1.2 : 0.2)}
          roughness={body.id === 'sun' ? 1 : 0.6}
        />
        {body.hasRings && (
          <mesh rotation={[Math.PI / 2.2, 0, 0]}>
            <ringGeometry args={[body.radius * 1.4, body.radius * 2.2, 64]} />
            <meshBasicMaterial color="#facc15" side={THREE.DoubleSide} transparent opacity={0.55} />
          </mesh>
        )}
      </mesh>
    </group>
  )
}

function OrbitRing({ radius }: { radius: number }) {
  const points = []
  const N = 96
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2
    points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius))
  }
  const geom = new THREE.BufferGeometry().setFromPoints(points)
  return (
    <line>
      <primitive object={geom} attach="geometry" />
      <lineBasicMaterial color="#3f3f46" transparent opacity={0.35} />
    </line>
  )
}

function SolarSim({ playing }: { params: any; playing: boolean }) {
  const [hovered, setHovered]   = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <LabScene cameraPos={[0, 8, 14]} cameraFov={55} tint={LAB_PALETTE.space} particles={0} stars={false}>
        <Stars radius={120} depth={50} count={3000} factor={4} saturation={0} fade speed={0.1} />
        {/* Big central sun light */}
        <pointLight position={[0, 0, 0]} intensity={3} color="#fde047" distance={20} />

        {BODIES.filter(b => b.orbit > 0).map(b => <OrbitRing key={b.id} radius={b.orbit} />)}
        {BODIES.map(b => (
          <PlanetMesh
            key={b.id} body={b}
            isHover={hovered === b.id}
            isSelected={selected === b.id}
            onHover={setHovered} onSelect={setSelected}
          />
        ))}

        <OrbitControls enablePan={false} minDistance={6} maxDistance={40} autoRotate={!hovered && !selected} autoRotateSpeed={0.2} />
      </LabScene>

      <PartHoverChip hovered={hovered} selected={selected} catalog={PARTS} />
      <PartIdleHint hovered={hovered} selected={selected} hint="Click any planet or the Sun" />
      <AnimatePresence>
        {selected && PARTS[selected] && (
          <PartInfoCard part={PARTS[selected]} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

export default function SolarSystemLab({ onBack }: { onBack?: () => void }) {
  return (
    <LabShell
      title="Solar System" subject="Space" topic="Astronomy · Class 6-12"
      description="Eight planets orbiting the Sun. Sizes and orbital speeds are stylised — true scale would make most planets invisible specks. Click any body to learn what makes it unique."
      Sim={SolarSim}
      defaultParams={{}}
      controls={[]}
      aiPrompt={() => `Interactive 3D solar system — 8 planets + the Sun orbiting on stylised orbital paths. Cover the Sun first (fusion-powered star, 99.86% of mass), then walk through inner rocky planets (Mercury → Mars), then gas/ice giants (Jupiter → Neptune). Mention what makes each unique. End with the Goldilocks zone and why Earth has life.`}
      onBack={onBack}
    />
  )
}
