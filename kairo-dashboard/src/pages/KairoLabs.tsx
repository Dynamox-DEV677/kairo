import { useState, useEffect, lazy, Suspense, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion'
import {
  Beaker, Atom, Heart, Activity, Sparkles, Lock,
  ArrowRight, Loader2, Globe, Dna, Rocket, Brain,
} from 'lucide-react'

const GravityLab    = lazy(() => import('../labs/GravityLab'))
const PendulumLab   = lazy(() => import('../labs/PendulumLab'))
const ProjectileLab = lazy(() => import('../labs/ProjectileLab'))
const CircuitsLab   = lazy(() => import('../labs/CircuitsLab'))
const AtomLab       = lazy(() => import('../labs/AtomLab'))
const MoleculeLab   = lazy(() => import('../labs/MoleculeLab'))
const ReactionLab   = lazy(() => import('../labs/ReactionLab'))
const HeartLab      = lazy(() => import('../labs/HeartLab'))
const CellLab       = lazy(() => import('../labs/CellLab'))
const VectorsLab    = lazy(() => import('../labs/VectorsLab'))
const GraphsLab     = lazy(() => import('../labs/GraphsLab'))
const DnaLab        = lazy(() => import('../labs/DnaLab'))
const SolarSystemLab = lazy(() => import('../labs/SolarSystemLab'))
const SaturnVLab    = lazy(() => import('../labs/SaturnVLab'))
const BrainLab      = lazy(() => import('../labs/BrainLab'))

interface Lab {
  id:        string
  title:     string
  topic:     string
  subject:   'Physics' | 'Chemistry' | 'Biology' | 'Math' | 'Space'
  desc:      string
  icon:      any
  ready:     boolean
  Component?: any
}

const LABS: Lab[] = [
  {
    id: 'gravity', title: 'Gravity & Free Fall', topic: 'Newton\'s Laws',
    subject: 'Physics', icon: Activity, ready: true, Component: GravityLab,
    desc: 'Apple falling from a tree. Tweak gravity, air drag, and drop height — AI explains live.',
  },
  {
    id: 'pendulum', title: 'Pendulum Motion', topic: 'Simple Harmonic Motion',
    subject: 'Physics', icon: Activity, ready: true, Component: PendulumLab,
    desc: 'Adjust length, gravity, and damping. Visualize the period of oscillation.',
  },
  {
    id: 'projectile', title: 'Projectile Motion', topic: 'Kinematics',
    subject: 'Physics', icon: Activity, ready: true, Component: ProjectileLab,
    desc: 'Fire a cannonball at any angle and velocity. Watch the parabolic trail.',
  },
  {
    id: 'circuits', title: 'Electric Circuits', topic: 'Ohm\'s Law',
    subject: 'Physics', icon: Activity, ready: true, Component: CircuitsLab,
    desc: 'Tune voltage and resistance. Watch current flow and the bulb glow.',
  },

  {
    id: 'atom', title: 'Atomic Structure', topic: 'Bohr Model',
    subject: 'Chemistry', icon: Atom, ready: true, Component: AtomLab,
    desc: 'Add protons to transform elements. Electrons fill shells using 2n² rule.',
  },
  {
    id: 'molecule', title: 'Molecule Builder', topic: 'Bonding',
    subject: 'Chemistry', icon: Atom, ready: true, Component: MoleculeLab,
    desc: '5 common molecules with proper bond angles. Single, double, triple bonds.',
  },
  {
    id: 'reaction', title: 'Chemical Reactions', topic: 'Stoichiometry',
    subject: 'Chemistry', icon: Beaker, ready: true, Component: ReactionLab,
    desc: 'Combustion of methane. Atoms physically rearrange — nothing disappears.',
  },

  {
    id: 'heart', title: 'Human Heart', topic: 'Circulation',
    subject: 'Biology', icon: Heart, ready: true, Component: HeartLab,
    desc: 'Beating 4-chamber heart. Track blood flow with particle animation.',
  },
  {
    id: 'cell', title: 'Cell Structure', topic: 'Organelles',
    subject: 'Biology', icon: Heart, ready: true, Component: CellLab,
    desc: 'Animal cell with hover-labeled organelles. See nucleus, mitochondria, ER, golgi.',
  },

  {
    id: 'vectors', title: 'Vectors in 3D', topic: 'Dot & Cross Product',
    subject: 'Math', icon: Sparkles, ready: true, Component: VectorsLab,
    desc: 'Drag two vectors. Live dot product, cross product, and angle readout.',
  },
  {
    id: 'graphs', title: 'Function Plotter', topic: 'Calculus',
    subject: 'Math', icon: Sparkles, ready: true, Component: GraphsLab,
    desc: '5 preset functions plotted as 3D surfaces. Color-coded by height.',
  },

  {
    id: 'dna', title: 'DNA Double Helix', topic: 'Genetics',
    subject: 'Biology', icon: Dna, ready: true, Component: DnaLab,
    desc: 'Click any base (A·T·G·C) or backbone strand. See A-T (2 H-bonds) vs G-C (3 H-bonds).',
  },
  {
    id: 'brain', title: 'Human Brain', topic: 'Nervous System',
    subject: 'Biology', icon: Brain, ready: true, Component: BrainLab,
    desc: 'Real anatomical 3D brain. Click frontal, parietal, temporal, occipital lobes, cerebellum, or brain stem.',
  },

  {
    id: 'solar', title: 'Solar System', topic: 'Astronomy',
    subject: 'Space', icon: Globe, ready: true, Component: SolarSystemLab,
    desc: '8 planets, the Moon, the ISS, asteroid belt, and a comet. Click any body to learn what makes it unique.',
  },
  {
    id: 'saturnv', title: 'Saturn V Rocket', topic: 'Rocketry · Apollo',
    subject: 'Space', icon: Rocket, ready: true, Component: SaturnVLab,
    desc: 'The 111-metre rocket that took humans to the Moon. Click each stage to see what it did.',
  },
]

const SUBJECT_COLORS: Record<string, string> = {
  Physics:   '#A5B4FC',
  Chemistry: '#A5B4FC',
  Biology:   '#7C5CFF',
  Math:      '#4A2FA8',
  Space:     '#8b5cf6',
}
const SUBJECT_TAGS: Record<string, string> = {
  Physics: 'force · motion · light',
  Chemistry: 'atoms · bonds · reactions',
  Biology: 'cells · genes · organs',
  Math: 'vectors · functions · proofs',
  Space: 'planets · rockets · stars',
}

export default function KairoLabs({ active = true }: { active?: boolean }) {
  const [activeLab, setActive] = useState<Lab | null>(null)
  const [filter, setFilter]    = useState<'all' | 'Physics' | 'Chemistry' | 'Biology' | 'Math' | 'Space'>('all')

  useEffect(() => {
    function onOpen(e: Event) {
      const id = (e as CustomEvent).detail?.id
      if (!id) return
      const lab = LABS.find(l => l.id === id && l.ready)
      if (lab) setActive(lab)
    }
    window.addEventListener('kairo:open-lab', onOpen)
    return () => window.removeEventListener('kairo:open-lab', onOpen)
  }, [])

  useEffect(() => {
    if (activeLab && activeLab.ready) {
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLab?.id])

  // When the Labs tab isn't the active screen, render nothing — this UNMOUNTS any
  // open 3D lab so its three.js render loop stops instead of thrashing the main
  // thread in the background. The open lab reopens when you return (state kept).
  if (!active) return null

  if (activeLab && activeLab.ready && activeLab.Component) {
    const C = activeLab.Component
    return (
      <Suspense fallback={
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <Loader2 size={28} color="#A5B4FC" style={{ animation: 'spin 0.8s linear infinite' }} />
          <p style={{ fontSize: 13, color: '#B1B5BA' }}>Loading {activeLab.title}…</p>
        </div>
      }>
        <C onBack={() => setActive(null)} />
      </Suspense>
    )
  }

  const visible = filter === 'all' ? LABS : LABS.filter(l => l.subject === filter)
  const readyCount = LABS.filter(l => l.ready).length

  const featured = visible.find(l => l.ready) || LABS.find(l => l.ready)!

  return (
    <div style={{
      padding: 'clamp(16px, 3vw, 28px) clamp(14px, 4vw, 36px) 110px', maxWidth: 1240, margin: '0 auto',
      height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      background: `
        radial-gradient(at 12% 0%, rgba(124, 92, 255, 0.10) 0%, transparent 36%),
        radial-gradient(at 88% 100%, rgba(74, 47, 168, 0.10) 0%, transparent 42%)`,
    }}>
      <style>{`@keyframes kl-glow { 0%,100% { opacity: 0.45 } 50% { opacity: 0.95 } }`}</style>

      <div style={{ position: 'relative', marginBottom: 26 }}>
        <div style={{
          position: 'absolute', top: -20, left: 30,
          width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(closest-side, rgba(124, 92, 255, 0.35), transparent 70%)',
          filter: 'blur(40px)', animation: 'kl-glow 6s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, position: 'relative' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, #A5B4FC 0%, #7C5CFF 60%, #0B1530 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 12px 36px rgba(124, 92, 255, 0.03)', flexShrink: 0,
          }}>
            <Beaker size={26} color="#000" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.2, textTransform: 'uppercase',
              background: 'linear-gradient(90deg, #A5B4FC, #A5B4FC, #7C5CFF)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
              Kyno Labs  ·  3D Simulations
            </div>
            <h1 style={{ margin: '4px 0 6px', fontSize: 'clamp(22px, 5vw, 32px)', fontWeight: 800, color: '#fafafa', letterSpacing: -0.6, lineHeight: 1.1 }}>
              Drag the apple, watch it fall.
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: '#B1B5BA', maxWidth: 640, lineHeight: 1.6 }}>
              Every lab is a real, interactive simulation — not a video. Tweak the parameters, hover for AI commentary, and feel the physics in your fingertips. {readyCount} live · ships weekly.
            </p>
          </div>
        </div>
      </div>

      {featured && (
        <FeaturedLab lab={featured} onOpen={() => setActive(featured)} />
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {([
          { id: 'all',       label: 'All',       color: '#B1B5BA' },
          { id: 'Physics',   label: 'Physics',   color: SUBJECT_COLORS.Physics },
          { id: 'Chemistry', label: 'Chemistry', color: SUBJECT_COLORS.Chemistry },
          { id: 'Biology',   label: 'Biology',   color: SUBJECT_COLORS.Biology },
          { id: 'Math',      label: 'Math',      color: SUBJECT_COLORS.Math },
          { id: 'Space',     label: 'Space',     color: SUBJECT_COLORS.Space },
        ] as const).map(t => {
          const active = filter === t.id
          return (
            <button className="kyno-chip" key={t.id} onClick={() => setFilter(t.id as any)}
              style={{
                padding: '7px 14px', borderRadius: 8,
                border: `1px solid ${active ? t.color : '#1f2532'}`,
                background: active ? `${t.color}12` : 'transparent',
                color: active ? t.color : '#9CA3AF',
                fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
              {t.label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: 18, perspective: 1200 }}>
        <AnimatePresence>
          {visible.map((lab, i) => (
            <LabCard key={lab.id} lab={lab} delay={i * 0.04} onOpen={() => lab.ready && setActive(lab)} />
          ))}
        </AnimatePresence>
      </div>

      <div style={{
        marginTop: 28, padding: '14px 18px', borderRadius: 12,
        background: 'rgba(124, 92, 255, 0.05)', border: '1px solid rgba(124, 92, 255, 0.18)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Sparkles size={14} color="#A5B4FC" />
        <p style={{ fontSize: 12, color: '#B1B5BA', margin: 0, lineHeight: 1.55 }}>
          <strong style={{ color: '#fafafa' }}>New labs ship every week.</strong>{' '}
          Drag, zoom, tweak parameters, and watch the AI explanation update live.
        </p>
      </div>
    </div>
  )
}

function LabCard({ lab, delay, onOpen }: { lab: Lab; delay: number; onOpen: () => void }) {
  const Icon = lab.icon
  const color = SUBJECT_COLORS[lab.subject] || '#A5B4FC'
  const ref = useRef<HTMLButtonElement>(null)

  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rx = useSpring(useTransform(my, [-120, 120], [9, -9]), { stiffness: 200, damping: 24 })
  const ry = useSpring(useTransform(mx, [-160, 160], [-12, 12]), { stiffness: 200, damping: 24 })
  const spotX = useTransform(mx, [-160, 160], ['0%', '100%'])
  const spotY = useTransform(my, [-120, 120], ['0%', '100%'])

  function onMove(e: React.MouseEvent<HTMLButtonElement>) {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    mx.set(e.clientX - r.left - r.width / 2)
    my.set(e.clientY - r.top - r.height / 2)
  }
  function onLeave() { mx.set(0); my.set(0) }

  return (
    <motion.button
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay, type: 'spring', stiffness: 220, damping: 26 }}
      onMouseMove={lab.ready ? onMove : undefined}
      onMouseLeave={lab.ready ? onLeave : undefined}
      onClick={onOpen}
      disabled={!lab.ready}
      style={{
        rotateX: lab.ready ? rx as any : 0,
        rotateY: lab.ready ? ry as any : 0,
        transformStyle: 'preserve-3d',
        background: 'linear-gradient(180deg, #141A2A 0%, #0A0D16 100%)',
        border: `1px solid ${lab.ready ? color + '30' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 18, padding: 0, textAlign: 'left',
        cursor: lab.ready ? 'pointer' : 'not-allowed',
        fontFamily: 'inherit',
        position: 'relative', overflow: 'hidden',
        opacity: lab.ready ? 1 : 0.55,
        minHeight: 230,
        color: 'inherit',
      }}
    >
      {lab.ready && (
        <motion.div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(360px circle at var(--spx) var(--spy), ${color}22, transparent 55%)`,
          pointerEvents: 'none',
          // @ts-expect-error CSS custom props
          '--spx': spotX, '--spy': spotY,
        }} />
      )}

      {lab.ready && (
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 160, height: 160, borderRadius: '50%',
          background: color, opacity: 0.12, filter: 'blur(50px)',
          pointerEvents: 'none',
        }} />
      )}

      <div style={{ position: 'relative', padding: '20px 22px', transform: 'translateZ(30px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 11,
            background: `linear-gradient(135deg, ${color}30, ${color}10)`,
            border: `1px solid ${color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: lab.ready ? `0 6px 20px ${color}30` : 'none',
          }}>
            <Icon size={20} color={color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 10, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.6 }}>
              {lab.subject}
            </span>
            <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{SUBJECT_TAGS[lab.subject] || ''}</div>
          </div>
          {lab.ready ? (
            <span style={{
              fontSize: 9.5, fontWeight: 700,
              padding: '3px 8px', borderRadius: 999,
              background: 'rgba(165, 180, 252, 0.14)', color: '#A5B4FC',
              textTransform: 'uppercase', letterSpacing: 1.2,
              border: '1px solid rgba(165, 180, 252, 0.3)',
            }}>● Live</span>
          ) : (
            <Lock size={12} color="#6B7280" />
          )}
        </div>

        <div style={{ fontSize: 18, fontWeight: 800, color: '#fafafa', marginBottom: 5, letterSpacing: -0.3, lineHeight: 1.2 }}>
          {lab.title}
        </div>
        <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 12, fontWeight: 600, letterSpacing: 0.3 }}>
          {lab.topic}
        </div>
        <div style={{ fontSize: 12.5, color: '#B1B5BA', lineHeight: 1.6, marginBottom: 14 }}>
          {lab.desc}
        </div>
        {lab.ready && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 8,
            background: `${color}14`, border: `1px solid ${color}30`,
            fontSize: 11.5, color, fontWeight: 700, letterSpacing: 0.4,
          }}>
            Open lab <ArrowRight size={12} />
          </div>
        )}
      </div>
    </motion.button>
  )
}

function FeaturedLab({ lab, onOpen }: { lab: Lab; onOpen: () => void }) {
  const Icon = lab.icon
  const color = SUBJECT_COLORS[lab.subject] || '#A5B4FC'
  const ref = useRef<HTMLButtonElement>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rx = useSpring(useTransform(my, [-200, 200], [4, -4]), { stiffness: 240, damping: 28 })
  const ry = useSpring(useTransform(mx, [-400, 400], [-6, 6]), { stiffness: 240, damping: 28 })

  function onMove(e: React.MouseEvent<HTMLButtonElement>) {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    mx.set(e.clientX - r.left - r.width / 2)
    my.set(e.clientY - r.top - r.height / 2)
  }
  function onLeave() { mx.set(0); my.set(0) }

  return (
    <motion.button
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onOpen}
      whileTap={{ scale: 0.99 }}
      style={{
        width: '100%', marginBottom: 28,
        rotateX: rx as any, rotateY: ry as any, transformStyle: 'preserve-3d',
        background: `linear-gradient(135deg, #141A2A 0%, #0A0D16 50%, ${color}10 100%)`,
        border: `1px solid ${color}40`,
        borderRadius: 22, padding: 0, textAlign: 'left',
        cursor: 'pointer', fontFamily: 'inherit',
        position: 'relative', overflow: 'hidden',
        boxShadow: `0 24px 60px rgba(0,0,0,0.5), 0 0 40px ${color}1a`,
        color: 'inherit',
      }}
    >
      <div style={{
        position: 'absolute', top: '-30%', right: '-10%',
        width: 380, height: 380, borderRadius: '50%',
        background: `radial-gradient(closest-side, ${color}30, transparent 70%)`,
        filter: 'blur(30px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-30%', left: '-10%',
        width: 320, height: 320, borderRadius: '50%',
        background: `radial-gradient(closest-side, ${color}24, transparent 70%)`,
        filter: 'blur(30px)', pointerEvents: 'none',
      }} />

      <div className="kl-featured-grid" style={{ position: 'relative', padding: 'clamp(18px, 4vw, 30px)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 'clamp(14px, 3vw, 24px)', alignItems: 'center', transform: 'translateZ(40px)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '4px 11px', borderRadius: 999,
              background: `${color}22`, color, border: `1px solid ${color}40`,
              textTransform: 'uppercase', letterSpacing: 1.6,
            }}>
              Featured · {lab.subject}
            </span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{lab.topic}</span>
          </div>
          <h2 style={{ margin: 0, fontSize: 'clamp(18px, 5.5vw, 30px)', fontWeight: 800, color: '#fafafa', letterSpacing: -0.6, lineHeight: 1.1 }}>
            {lab.title}
          </h2>
          <p style={{ margin: '10px 0 18px', fontSize: 14, color: '#c4c4c8', lineHeight: 1.65, maxWidth: 520 }}>
            {lab.desc}
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '11px 20px', borderRadius: 10,
            background: `linear-gradient(135deg, ${color}, #7C5CFF)`,
            color: '#000', fontWeight: 800, fontSize: 13,
            boxShadow: `0 8px 24px ${color}55`,
          }}>
            <Sparkles size={14} /> Launch lab <ArrowRight size={14} />
          </div>
        </div>

        <div className="kl-featured-plate" style={{
          width: 'clamp(96px, 22vw, 160px)', height: 'clamp(96px, 22vw, 160px)',
          borderRadius: 'clamp(18px, 4vw, 28px)', flexShrink: 0,
          background: `linear-gradient(135deg, ${color}40, ${color}08)`,
          border: `1px solid ${color}40`,
          display: 'grid', placeItems: 'center',
          boxShadow: `inset 0 0 40px ${color}30, 0 16px 40px ${color}26`,
          transform: 'translateZ(60px) rotateY(-8deg)',
        }}>
          <Icon size={64} color={color} strokeWidth={1.4} style={{ width: '50%', height: '50%' }} />
        </div>
      </div>
    </motion.button>
  )
}
