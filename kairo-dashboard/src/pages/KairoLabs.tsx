/**
 * Kairo Labs — interactive 3D learning simulations.
 * Lists available labs; clicking one opens the simulation full-bleed.
 */
import { useState, useEffect, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Beaker, Atom, Heart, Activity, Sparkles, Lock,
  ArrowRight, Loader2, Brain, Eye, Globe, Dna,
} from 'lucide-react'

// Lazy-load each R3F lab — only fetched when student opens it.
// This keeps the main bundle small.
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
const BrainLab      = lazy(() => import('../labs/BrainLab'))
const EyeLab        = lazy(() => import('../labs/EyeLab'))
const SolarSystemLab = lazy(() => import('../labs/SolarSystemLab'))

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
  // ─── Physics ────────────────────────────────────────────────────────────
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

  // ─── Chemistry ──────────────────────────────────────────────────────────
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

  // ─── Biology ────────────────────────────────────────────────────────────
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

  // ─── Math ───────────────────────────────────────────────────────────────
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

  // ─── Biology — new ───────────────────────────────────────────────────────
  {
    id: 'dna', title: 'DNA Double Helix', topic: 'Genetics',
    subject: 'Biology', icon: Dna, ready: true, Component: DnaLab,
    desc: 'Click any base (A·T·G·C) or backbone strand. See A-T (2 H-bonds) vs G-C (3 H-bonds).',
  },
  {
    id: 'brain', title: 'Human Brain', topic: 'Nervous System',
    subject: 'Biology', icon: Brain, ready: true, Component: BrainLab,
    desc: 'Click the 4 lobes + cerebellum + brainstem. See what each region controls.',
  },
  {
    id: 'eye', title: 'Human Eye', topic: 'Sense Organs',
    subject: 'Biology', icon: Eye, ready: true, Component: EyeLab,
    desc: 'Cross-section eye. Click the cornea, iris, lens, retina, optic nerve.',
  },

  // ─── Space ──────────────────────────────────────────────────────────────
  {
    id: 'solar', title: 'Solar System', topic: 'Astronomy',
    subject: 'Space', icon: Globe, ready: true, Component: SolarSystemLab,
    desc: '8 planets orbiting the Sun. Click any body to learn what makes it unique.',
  },
]

const SUBJECT_COLORS: Record<string, string> = {
  Physics: '#818cf8', Chemistry: '#34d399', Biology: '#f472b6', Math: '#fbbf24', Space: '#a78bfa',
}

export default function KairoLabs() {
  const [activeLab, setActive] = useState<Lab | null>(null)
  const [filter, setFilter]    = useState<'all' | 'Physics' | 'Chemistry' | 'Biology' | 'Math' | 'Space'>('all')

  // Listen for "open this lab" events from Kairo's Solver
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

  // Active lab — full-bleed
  if (activeLab && activeLab.ready && activeLab.Component) {
    const C = activeLab.Component
    return (
      <Suspense fallback={
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <Loader2 size={28} color="#a5b4fc" style={{ animation: 'spin 0.8s linear infinite' }} />
          <p style={{ fontSize: 13, color: '#a1a1aa' }}>Loading {activeLab.title}…</p>
        </div>
      }>
        <C onBack={() => setActive(null)} />
      </Suspense>
    )
  }

  const visible = filter === 'all' ? LABS : LABS.filter(l => l.subject === filter)
  const readyCount = LABS.filter(l => l.ready).length

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1100, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: 'linear-gradient(135deg, #6366f1, #ec4899)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(99,102,241,0.4)', flexShrink: 0,
        }}>
          <Beaker size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Kairo Labs</h1>
          <p style={{ fontSize: 13, color: '#52525b', marginTop: 4 }}>
            Interactive 3D simulations · AI-powered explanations · {readyCount} live · {LABS.length - readyCount} coming soon
          </p>
        </div>
      </div>

      {/* Subject filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {([
          { id: 'all',       label: 'All',       color: '#a1a1aa' },
          { id: 'Physics',   label: 'Physics',   color: SUBJECT_COLORS.Physics },
          { id: 'Chemistry', label: 'Chemistry', color: SUBJECT_COLORS.Chemistry },
          { id: 'Biology',   label: 'Biology',   color: SUBJECT_COLORS.Biology },
          { id: 'Math',      label: 'Math',      color: SUBJECT_COLORS.Math },
          { id: 'Space',     label: 'Space',     color: SUBJECT_COLORS.Space },
        ] as const).map(t => {
          const active = filter === t.id
          return (
            <button key={t.id} onClick={() => setFilter(t.id as any)}
              style={{
                padding: '7px 14px', borderRadius: 8,
                border: `1px solid ${active ? t.color : '#1e1e1e'}`,
                background: active ? `${t.color}12` : 'transparent',
                color: active ? t.color : '#71717a',
                fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Lab grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        <AnimatePresence>
          {visible.map((lab, i) => {
            const Icon = lab.icon
            const color = SUBJECT_COLORS[lab.subject] || '#a1a1aa'
            return (
              <motion.button key={lab.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ delay: i * 0.04 }}
                whileHover={{ y: lab.ready ? -3 : 0 }}
                onClick={() => lab.ready && setActive(lab)}
                disabled={!lab.ready}
                style={{
                  background: '#111', border: `1px solid ${lab.ready ? color + '30' : '#1e1e1e'}`,
                  borderRadius: 14, padding: 18, textAlign: 'left',
                  cursor: lab.ready ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                  position: 'relative', overflow: 'hidden',
                  opacity: lab.ready ? 1 : 0.55,
                }}>
                {/* Ambient color glow on hover */}
                {lab.ready && (
                  <div style={{
                    position: 'absolute', top: -30, right: -30,
                    width: 100, height: 100, borderRadius: '50%',
                    background: color, opacity: 0.12, filter: 'blur(40px)',
                    pointerEvents: 'none',
                  }} />
                )}

                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 9,
                      background: `${color}18`, border: `1px solid ${color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={16} color={color} />
                    </div>
                    <span style={{ fontSize: 10, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                      {lab.subject}
                    </span>
                    {lab.ready ? (
                      <span style={{
                        marginLeft: 'auto', fontSize: 9, fontWeight: 700,
                        padding: '2px 7px', borderRadius: 4,
                        background: 'rgba(52,211,153,0.12)', color: '#34d399',
                        textTransform: 'uppercase', letterSpacing: 1,
                      }}>Live</span>
                    ) : (
                      <Lock size={11} color="#52525b" style={{ marginLeft: 'auto' }} />
                    )}
                  </div>

                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fafafa', marginBottom: 4 }}>
                    {lab.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#71717a', marginBottom: 10, fontWeight: 500 }}>
                    {lab.topic}
                  </div>
                  <div style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.6, marginBottom: 12 }}>
                    {lab.desc}
                  </div>
                  {lab.ready && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color, fontWeight: 600 }}>
                      Open lab <ArrowRight size={11} />
                    </div>
                  )}
                </div>
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Footer note */}
      <div style={{
        marginTop: 22, padding: '12px 16px', borderRadius: 9,
        background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Sparkles size={13} color="#a5b4fc" />
        <p style={{ fontSize: 11.5, color: '#a1a1aa', margin: 0, lineHeight: 1.5 }}>
          New labs ship every week. Each one is a real interactive simulation, not a video — drag, zoom, tweak parameters, and watch the AI explanation update live.
        </p>
      </div>
    </div>
  )
}
