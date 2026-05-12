/**
 * Kairo — landing page.
 *
 * Cinematic, dark, premium. Built for the "this isn't another edtech app"
 * first impression. 9 sections, all scroll-revealed via Framer Motion,
 * no external dependencies beyond what's already in package.json.
 *
 * Sections (top → bottom):
 *   1. Hero            massive headline + animated bg + dual CTA
 *   2. Strip           "trusted by" / proof-of-life signals
 *   3. Problem         3 emotional cards
 *   4. Kairo OS        the intelligence engine reveal
 *   5. Solver          left/right split with mock UI
 *   6. Labs            3D simulation showcase grid
 *   7. Adaptation      "Kairo Learns YOU" — animated graph
 *   8. Roles           Students / Teachers / Parents / Schools
 *   9. Features        12-tile grid
 *  10. Future          emotional pause section
 *  11. Final CTA       large cinematic ending
 */
import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import {
  ArrowRight, Sparkles, Cpu, Beaker, Brain, Eye, MousePointerClick,
  BookOpen, Repeat, GraduationCap, Users, Building2, ShieldCheck,
  Zap, Atom, Activity, Layers, Target, Mic, Camera, Network,
  TrendingUp, Bot, Heart, Globe, FunctionSquare, Compass,
} from 'lucide-react'

// ════════════════════════════════════════════════════════════════════════════
// TOKENS
// ════════════════════════════════════════════════════════════════════════════
const C = {
  bg:       '#06060a',
  panel:    '#0e0e16',
  panel2:   '#13131d',
  border:   '#222232',
  borderSoft:'#1a1a26',
  text:     '#fafafa',
  textDim:  '#a1a1aa',
  textFaint:'#71717a',
  textVery: '#52525b',
  purple:   '#a78bfa',
  purpleHi: '#7c3aed',
  blue:     '#60a5fa',
  cyan:     '#22d3ee',
  green:    '#34d399',
  amber:    '#fbbf24',
  pink:     '#ec4899',
}

const GRAD = {
  hero:  'linear-gradient(135deg, #7c3aed 0%, #5b21b6 35%, #1e3a8a 75%, #06b6d4 100%)',
  pill:  'linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #2563eb 100%)',
  text:  'linear-gradient(90deg, #c4b5fd 0%, #60a5fa 50%, #22d3ee 100%)',
  textWarm: 'linear-gradient(90deg, #fbbf24 0%, #ec4899 100%)',
}

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif"

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

interface LandingProps {
  onGetStarted: () => void   // routes to Login (Sign Up / Sign In)
}

export default function Landing({ onGetStarted }: LandingProps) {
  return (
    // Owns its own scroll context — the global `body { overflow: hidden }`
    // on mobile (from index.css, used to pin the in-app bottom nav) would
    // otherwise prevent the marketing page from scrolling.
    <div style={{
      background: C.bg, color: C.text, fontFamily: FONT,
      width: '100%',
      height: '100dvh',
      overflowX: 'hidden',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      <GlobalKeyframes />

      <TopNav onGetStarted={onGetStarted} />

      <HeroSection onGetStarted={onGetStarted} />

      <ProofStrip />

      <ProblemSection />

      <OSSection />

      <SolverSection />

      <LabsSection />

      <AdaptationSection />

      <RolesSection />

      <FeaturesSection />

      <FutureSection />

      <FinalCTASection onGetStarted={onGetStarted} />

      <Footer />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SHARED PRIMITIVES
// ════════════════════════════════════════════════════════════════════════════

function GlobalKeyframes() {
  return (
    <style>{`
      @keyframes kr-spin   { to { transform: rotate(360deg) } }
      @keyframes kr-glow   { 0%,100% { opacity: .55 } 50% { opacity: .95 } }
      @keyframes kr-pulse  { 0%,100% { transform: scale(1); opacity: .9 } 50% { transform: scale(1.05); opacity: 1 } }
      @keyframes kr-float  { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-14px) } }
      @keyframes kr-drift  { 0% { transform: translate3d(0,0,0); } 100% { transform: translate3d(40px, -120px, 0); } }
      @keyframes kr-shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
      .kr-grad-text {
        background: ${GRAD.text};
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        -webkit-text-fill-color: transparent;
      }
      .kr-grad-text-warm {
        background: ${GRAD.textWarm};
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        -webkit-text-fill-color: transparent;
      }
      .kr-noise {
        position: absolute; inset: 0; pointer-events: none; opacity: .04;
        background-image: url("data:image/svg+xml;utf8,<svg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 1, 0 0 0 0 1, 0 0 0 0 1, 0 0 0 1 0'/></filter><rect width='256' height='256' filter='url(%23n)'/></svg>");
        mix-blend-mode: overlay;
      }
      .kr-card {
        background: ${C.panel};
        border: 1px solid ${C.border};
        border-radius: 16px;
        position: relative;
        overflow: hidden;
        transition: transform .3s ease, border-color .3s ease, box-shadow .3s ease;
      }
      .kr-card:hover {
        transform: translateY(-3px);
        border-color: rgba(124,58,237,0.55);
        box-shadow: 0 18px 48px rgba(124,58,237,0.18);
      }
      .kr-btn-glow {
        position: relative;
        overflow: hidden;
        transition: all .25s ease;
      }
      .kr-btn-glow::before {
        content: '';
        position: absolute; inset: 0;
        background: linear-gradient(120deg, transparent 35%, rgba(255,255,255,0.18) 50%, transparent 65%);
        background-size: 200% 100%;
        background-position: -200% 0;
        transition: background-position .6s ease;
        pointer-events: none;
      }
      .kr-btn-glow:hover::before { background-position: 200% 0; }
      .kr-btn-glow:hover { transform: translateY(-1px); box-shadow: 0 18px 44px rgba(124,58,237,0.6); }

      /* Mobile-friendly type scaling */
      @media (max-width: 768px) {
        .kr-h1 { font-size: 44px !important; line-height: 1.05 !important; }
        .kr-h2 { font-size: 32px !important; line-height: 1.1 !important; }
        .kr-section { padding: 64px 20px !important; }
        .kr-2col { grid-template-columns: 1fr !important; gap: 32px !important; }
        .kr-features-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)) !important; }
      }
    `}</style>
  )
}

function Section({ children, style = {}, id }: { children: React.ReactNode; style?: React.CSSProperties; id?: string }) {
  return (
    <section
      id={id}
      className="kr-section"
      style={{
        padding: '120px 32px',
        position: 'relative',
        maxWidth: 1280,
        margin: '0 auto',
        ...style,
      }}>
      {children}
    </section>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'inline-block',
      padding: '6px 14px',
      borderRadius: 999,
      border: `1px solid ${C.border}`,
      background: 'rgba(124,58,237,0.04)',
      fontSize: 11, fontWeight: 700, color: C.purple,
      textTransform: 'uppercase', letterSpacing: 2,
      marginBottom: 18,
    }}>
      {children}
    </div>
  )
}

function fadeUp(delay = 0) {
  return {
    initial:    { opacity: 0, y: 24 },
    whileInView:{ opacity: 1, y: 0 },
    viewport:   { once: true, amount: 0.2 },
    transition: { duration: 0.7, delay, ease: [0.21, 0.86, 0.41, 1] as any },
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TOP NAV
// ════════════════════════════════════════════════════════════════════════════
function TopNav({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      padding: '14px 32px',
      background: 'rgba(6,6,10,0.6)',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      borderBottom: `1px solid ${C.borderSoft}`,
    }}>
      <div style={{
        maxWidth: 1280, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <KairoLogo size={32} />
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.4 }}>Kairo</span>
        </div>
        <button
          onClick={onGetStarted}
          className="kr-btn-glow"
          style={{
            padding: '9px 18px', borderRadius: 10,
            background: GRAD.pill,
            color: '#fff', fontWeight: 700, fontSize: 13,
            border: 'none', cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(124,58,237,0.35)',
            fontFamily: 'inherit',
          }}>
          Sign in
        </button>
      </div>
    </div>
  )
}

function KairoLogo({ size = 32 }: { size?: number }) {
  const id = `klg-${Math.random().toString(36).slice(2, 7)}`
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`${id}-s`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#c4b5fd"/>
          <stop offset="50%"  stopColor="#7c3aed"/>
          <stop offset="100%" stopColor="#22d3ee"/>
        </linearGradient>
        <radialGradient id={`${id}-h`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#7c3aed" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#${id}-h)`}/>
      <circle cx="32" cy="32" r="22" fill="none" stroke={`url(#${id}-s)`} strokeWidth="1.4" strokeOpacity="0.6">
        <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="22s" repeatCount="indefinite"/>
      </circle>
      <g stroke={`url(#${id}-s)`} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M22 17 L22 47"/>
        <path d="M22 32 L36 17"/>
        <path d="M22 32 L36 47"/>
      </g>
      <circle cx="42" cy="32" r="2.5" fill="#c4b5fd">
        <animate attributeName="opacity" values="0.35;1;0.35" dur="2.4s" repeatCount="indefinite"/>
      </circle>
    </svg>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// HERO
// ════════════════════════════════════════════════════════════════════════════
function HeroSection({ onGetStarted }: { onGetStarted: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const heroY     = useTransform(scrollYProgress, [0, 1], ['0%', '40%'])
  const heroFade  = useTransform(scrollYProgress, [0, 0.6], [1, 0])

  return (
    <section ref={ref} style={{
      position: 'relative',
      minHeight: '100vh',
      paddingTop: 110,
      display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* Layered backdrops */}
      <ParticleField />
      <AuroraLayer />
      <GridFloor />
      <div className="kr-noise" />

      <motion.div style={{ y: heroY, opacity: heroFade, textAlign: 'center', maxWidth: 1100, padding: '0 24px', position: 'relative', zIndex: 2 }}>
        {/* Brand badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
          <span style={{
            padding: '6px 14px', borderRadius: 999,
            border: `1px solid ${C.border}`,
            background: 'rgba(124,58,237,0.06)',
            backdropFilter: 'blur(10px)',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 12, fontWeight: 600, color: C.purple,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: C.green,
              boxShadow: `0 0 12px ${C.green}`,
              animation: 'kr-pulse 2.4s ease-in-out infinite',
            }} />
            New  ·  Kairo OS is live
          </span>
        </motion.div>

        {/* Massive headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.21,0.86,0.41,1] as any }}
          className="kr-h1"
          style={{
            margin: 0,
            fontSize: 92, lineHeight: 1.02, fontWeight: 800,
            letterSpacing: -2.5,
            color: C.text,
          }}>
          The future of <br/>
          <span className="kr-grad-text">intelligent education.</span>
        </motion.h1>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.7 }}
          style={{
            marginTop: 26, marginBottom: 0,
            fontSize: 19, color: C.textDim,
            maxWidth: 700, marginLeft: 'auto', marginRight: 'auto',
            lineHeight: 1.55, fontWeight: 400,
          }}>
          Kairo combines AI tutoring, adaptive learning, immersive 3D simulations,
          and school intelligence into one connected ecosystem.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.7 }}
          style={{
            marginTop: 38, display: 'flex', gap: 14,
            justifyContent: 'center', flexWrap: 'wrap',
          }}>
          <button
            onClick={onGetStarted}
            className="kr-btn-glow"
            style={{
              padding: '15px 30px', borderRadius: 12,
              background: GRAD.pill,
              color: '#fff', fontWeight: 700, fontSize: 15,
              border: 'none', cursor: 'pointer',
              boxShadow: '0 14px 40px rgba(124,58,237,0.45)',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontFamily: 'inherit', letterSpacing: 0.2,
            }}>
            Start Learning <ArrowRight size={16} />
          </button>
          <a
            href="#labs"
            className="kr-btn-glow"
            style={{
              padding: '15px 28px', borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              color: C.text, fontWeight: 600, fontSize: 15,
              border: `1px solid ${C.border}`, cursor: 'pointer',
              textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontFamily: 'inherit', backdropFilter: 'blur(10px)',
            }}>
            <Beaker size={16} color={C.purple} /> Explore Kairo Labs
          </a>
        </motion.div>

        {/* Floating UI preview */}
        <motion.div
          initial={{ opacity: 0, y: 48 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.95, duration: 1.0, ease: [0.21,0.86,0.41,1] as any }}
          style={{
            marginTop: 80,
            position: 'relative',
            maxWidth: 980, margin: '80px auto 0',
            padding: 0,
            animation: 'kr-float 7s ease-in-out infinite',
          }}>
          <HeroDashboardMock />
        </motion.div>
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        animate={{ y: [0, 8, 0] }} transition={{ duration: 1.8, repeat: Infinity }}
        style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          color: C.textFaint, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
          fontWeight: 600,
        }}>
        Scroll  ↓
      </motion.div>
    </section>
  )
}

// Particles — pure CSS, no R3F (keeps Hero light + fast)
function ParticleField() {
  const stars = Array.from({ length: 50 }, (_, i) => {
    const left = Math.random() * 100
    const top  = Math.random() * 100
    const size = 1 + Math.random() * 2.5
    const dur  = 8 + Math.random() * 10
    const delay = -Math.random() * 10
    return { i, left, top, size, dur, delay }
  })
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {stars.map(s => (
        <div key={s.i} style={{
          position: 'absolute',
          left: `${s.left}%`, top: `${s.top}%`,
          width: s.size, height: s.size,
          borderRadius: '50%',
          background: 'rgba(196,181,253,0.7)',
          boxShadow: `0 0 ${s.size * 3}px rgba(124,58,237,0.6)`,
          animation: `kr-drift ${s.dur}s linear ${s.delay}s infinite`,
          opacity: 0.7,
        }} />
      ))}
    </div>
  )
}

function AuroraLayer() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      background:
        `radial-gradient(at 14% 18%, rgba(124,58,237,0.28) 0%, transparent 38%),
         radial-gradient(at 86% 30%, rgba(37,99,235,0.22) 0%, transparent 42%),
         radial-gradient(at 50% 100%, rgba(34,211,238,0.16) 0%, transparent 50%)`,
    }} />
  )
}

function GridFloor() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      backgroundImage:
        `linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px),
         linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)`,
      backgroundSize: '64px 64px',
      maskImage: 'radial-gradient(ellipse 80% 60% at 50% 60%, #000 25%, transparent 80%)',
      WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 60%, #000 25%, transparent 80%)',
    }} />
  )
}

// Mock dashboard UI shown floating in the hero
function HeroDashboardMock() {
  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(20,20,30,0.96) 0%, rgba(10,10,16,0.94) 100%)',
      border: `1px solid ${C.border}`,
      borderRadius: 18,
      padding: 22,
      boxShadow: '0 32px 100px rgba(124,58,237,0.30), 0 0 0 1px rgba(255,255,255,0.02) inset',
      backdropFilter: 'blur(20px)',
      position: 'relative',
    }}>
      {/* Window chrome */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#3f3f46' }}/>
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#3f3f46' }}/>
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#3f3f46' }}/>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: C.textFaint, letterSpacing: 1.5, fontWeight: 600 }}>kairo.app / dashboard</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14, alignItems: 'start' }}>
        {/* Left panel — Pulse ring */}
        <div style={{
          background: 'rgba(15,15,22,0.7)',
          border: `1px solid ${C.borderSoft}`,
          borderRadius: 12,
          padding: 18,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, letterSpacing: 1.6, color: C.textFaint, fontWeight: 700, textTransform: 'uppercase' }}>AI Pulse</div>
          <div style={{ margin: '14px auto', width: 120, height: 120, position: 'relative' }}>
            <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%' }}>
              <defs>
                <linearGradient id="ringg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%"  stopColor="#c4b5fd"/>
                  <stop offset="50%" stopColor="#7c3aed"/>
                  <stop offset="100%" stopColor="#22d3ee"/>
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r="48" fill="none" stroke={C.borderSoft} strokeWidth="9"/>
              <circle cx="60" cy="60" r="48" fill="none" stroke="url(#ringg)" strokeWidth="9" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 48}
                strokeDashoffset={2 * Math.PI * 48 * 0.22}
                transform="rotate(-90 60 60)"/>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.text }}>76</div>
            </div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.green, letterSpacing: 1.4, textTransform: 'uppercase' }}>● Thriving</div>
        </div>

        {/* Right — stats + bars */}
        <div style={{ display: 'grid', gap: 12 }}>
          {/* Top tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { l: 'STREAK',     v: '10', s: 'days' },
              { l: 'RETENTION',  v: '99%',s: 'avg' },
              { l: 'PREDICTED',  v: '65%',s: 'Grade B' },
            ].map((t, i) => (
              <div key={i} style={{
                background: 'rgba(15,15,22,0.7)', border: `1px solid ${C.borderSoft}`,
                borderRadius: 10, padding: '10px 12px',
              }}>
                <div style={{ fontSize: 9, color: C.textFaint, fontWeight: 700, letterSpacing: 1.4 }}>{t.l}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginTop: 4 }}>{t.v}</div>
                <div style={{ fontSize: 10, color: C.textFaint }}>{t.s}</div>
              </div>
            ))}
          </div>

          {/* Style bar */}
          <div style={{
            background: 'rgba(15,15,22,0.7)', border: `1px solid ${C.borderSoft}`,
            borderRadius: 10, padding: 12,
          }}>
            <div style={{ fontSize: 10, color: C.textFaint, fontWeight: 700, letterSpacing: 1.4, marginBottom: 8 }}>LEARNING STYLE</div>
            <div style={{ display: 'flex', height: 8, borderRadius: 8, overflow: 'hidden' }}>
              <span style={{ width: '29%', background: C.purple }}/>
              <span style={{ width: '50%', background: C.blue }}/>
              <span style={{ width: '7%',  background: C.cyan }}/>
              <span style={{ width: '14%', background: C.green }}/>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: C.textDim }}>
              <span>Visual 29</span><span>Interactive 50</span><span>Reading 7</span><span>Repetition 14</span>
            </div>
          </div>

          {/* Heatmap row */}
          <div style={{
            background: 'rgba(15,15,22,0.7)', border: `1px solid ${C.borderSoft}`,
            borderRadius: 10, padding: 12,
          }}>
            <div style={{ fontSize: 10, color: C.textFaint, fontWeight: 700, letterSpacing: 1.4, marginBottom: 8 }}>WEAKNESS HEATMAP</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {[
                { t: 'vectors',         m: 0.32 },
                { t: 'electrolysis',    m: 0.41 },
                { t: 'quadratic eq.',   m: 0.48 },
                { t: 'photosynthesis',  m: 0.65 },
                { t: 'newton laws',     m: 0.78 },
                { t: 'cell biology',    m: 0.84 },
              ].map(t => {
                const col = t.m < 0.4 ? C.red : t.m < 0.7 ? C.amber : C.green
                return (
                  <span key={t.t} style={{
                    padding: '3px 8px', borderRadius: 6,
                    background: `${col}1a`, border: `1px solid ${col}44`,
                    fontSize: 10, color: col, fontWeight: 600,
                    textTransform: 'capitalize',
                  }}>{t.t} {Math.round(t.m * 100)}%</span>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PROOF STRIP — "in numbers"
// ════════════════════════════════════════════════════════════════════════════
function ProofStrip() {
  const items = [
    { v: '40+',  l: 'AI features' },
    { v: '15',   l: '3D simulation labs' },
    { v: '<8s',  l: 'Solver response time' },
    { v: '0',    l: 'Cost per student' },
  ]
  return (
    <section style={{ padding: '24px 32px 0', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
        padding: '28px 36px',
        background: 'rgba(124,58,237,0.04)',
        border: `1px solid ${C.borderSoft}`,
        borderRadius: 16,
        backdropFilter: 'blur(10px)',
      }}>
        {items.map((it, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.6 }}
            style={{ textAlign: 'center' }}>
            <div className="kr-grad-text" style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1, lineHeight: 1 }}>
              {it.v}
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: C.textFaint, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase' }}>
              {it.l}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PROBLEM
// ════════════════════════════════════════════════════════════════════════════
function ProblemSection() {
  const cards = [
    { icon: Brain,    title: 'Memory is invisible',
      body: 'Every student forgets at a different rate — but no schoolbook, no tuition class, no app tracks it.' },
    { icon: Eye,      title: 'Learning style is ignored',
      body: 'Some students learn from visuals, some from reading, some from doing. Schools teach all of them the same way.' },
    { icon: Activity, title: 'Weak topics stay hidden',
      body: 'Students don’t know which topic they’re about to fail. They only find out on the exam.' },
  ]
  return (
    <Section>
      <motion.div {...fadeUp()} style={{ textAlign: 'center', marginBottom: 48 }}>
        <Eyebrow>The problem</Eyebrow>
        <h2 className="kr-h2" style={{ margin: 0, fontSize: 56, fontWeight: 800, letterSpacing: -1.5, color: C.text, lineHeight: 1.05 }}>
          Three things textbooks +<br/>
          tuitions <span className="kr-grad-text-warm">can’t fix</span>.
        </h2>
      </motion.div>

      <div className="kr-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
        {cards.map((c, i) => {
          const I = c.icon
          return (
            <motion.div key={i} {...fadeUp(i * 0.1)}
              className="kr-card"
              style={{ padding: 26 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(124,58,237,0.10)',
                border: `1px solid rgba(124,58,237,0.35)`,
                display: 'grid', placeItems: 'center', marginBottom: 18,
                boxShadow: '0 0 24px rgba(124,58,237,0.20)',
              }}>
                <I size={20} color={C.purple} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>{c.title}</div>
              <div style={{ fontSize: 14, color: C.textDim, lineHeight: 1.65 }}>{c.body}</div>
            </motion.div>
          )
        })}
      </div>
    </Section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// KAIRO OS — meet the engine
// ════════════════════════════════════════════════════════════════════════════
function OSSection() {
  return (
    <Section id="os">
      <div className="kr-2col" style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 64, alignItems: 'center' }}>
        <motion.div {...fadeUp()}>
          <Eyebrow>Meet Kairo OS</Eyebrow>
          <h2 className="kr-h2" style={{ margin: 0, fontSize: 56, fontWeight: 800, letterSpacing: -1.5, color: C.text, lineHeight: 1.05 }}>
            Your <span className="kr-grad-text">Academic Twin</span> —<br/>
            quietly learning how you learn.
          </h2>
          <p style={{ marginTop: 22, fontSize: 16, color: C.textDim, lineHeight: 1.7, maxWidth: 500 }}>
            Every quiz, lab, flashcard, and concept you touch feeds a model of you.
            Kairo predicts when you’ll forget, recommends what to revise, and adapts
            every page in the app to your style — all in your browser. None of it
            ever leaves your device.
          </p>

          <div style={{ marginTop: 28, display: 'grid', gap: 12 }}>
            {[
              { i: Brain,  t: 'Ebbinghaus forgetting curve',  s: 'Knows the moment a topic starts to fade' },
              { i: Eye,    t: 'Learning-style detector',      s: 'Visual / interactive / text / repetition' },
              { i: Zap,    t: 'Burnout watch',                s: 'Slows you down before you crash' },
              { i: ShieldCheck, t: '100% on-device',          s: 'Behavioural data never touches our servers' },
            ].map((it, i) => {
              const I = it.i
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.55 }}
                  style={{
                    display: 'flex', gap: 14, alignItems: 'flex-start',
                    padding: '14px 16px', borderRadius: 12,
                    background: C.panel, border: `1px solid ${C.borderSoft}`,
                  }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: 'rgba(124,58,237,0.12)',
                    border: `1px solid rgba(124,58,237,0.32)`,
                    display: 'grid', placeItems: 'center',
                  }}>
                    <I size={15} color={C.purple} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{it.t}</div>
                    <div style={{ fontSize: 12, color: C.textFaint, marginTop: 2 }}>{it.s}</div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        {/* Right side — animated ecosystem diagram */}
        <motion.div {...fadeUp(0.15)}>
          <EcosystemDiagram />
        </motion.div>
      </div>
    </Section>
  )
}

// Animated nodes around a central core
function EcosystemDiagram() {
  const nodes = [
    { name: 'Quiz',       icon: Target,    angle: 0   },
    { name: 'Labs',       icon: Beaker,    angle: 60  },
    { name: 'Flashcards', icon: Layers,    angle: 120 },
    { name: 'Notebook',   icon: BookOpen,  angle: 180 },
    { name: 'Voice',      icon: Mic,       angle: 240 },
    { name: 'Camera',     icon: Camera,    angle: 300 },
  ]
  const R = 130
  return (
    <div style={{
      position: 'relative',
      width: '100%', maxWidth: 420,
      aspectRatio: '1 / 1',
      margin: '0 auto',
    }}>
      {/* Outer glow */}
      <div style={{
        position: 'absolute', inset: '15%',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.45), transparent 65%)',
        filter: 'blur(40px)',
        animation: 'kr-glow 4s ease-in-out infinite',
      }}/>

      {/* Orbit ring */}
      <svg viewBox="0 0 400 400" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="ring2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"  stopColor="#7c3aed" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.5"/>
          </linearGradient>
        </defs>
        <circle cx="200" cy="200" r={R} fill="none" stroke="url(#ring2)" strokeWidth="1.2" strokeDasharray="4 6"/>
        {nodes.map((n, i) => {
          const a = (n.angle * Math.PI) / 180
          const x = 200 + R * Math.cos(a)
          const y = 200 + R * Math.sin(a)
          return <line key={i} x1="200" y1="200" x2={x} y2={y} stroke="rgba(124,58,237,0.25)" strokeWidth="0.7" strokeDasharray="2 3"/>
        })}
      </svg>

      {/* Center core */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 86, height: 86, borderRadius: 22,
        background: GRAD.pill,
        boxShadow: '0 18px 60px rgba(124,58,237,0.65)',
        display: 'grid', placeItems: 'center',
      }}>
        <Cpu size={32} color="#fff" />
      </div>

      {/* Orbiting nodes */}
      {nodes.map((n, i) => {
        const a = (n.angle * Math.PI) / 180
        const cx = 50 + (R / 400) * 100 * Math.cos(a)
        const cy = 50 + (R / 400) * 100 * Math.sin(a)
        const I = n.icon
        return (
          <motion.div key={i}
            initial={{ opacity: 0, scale: 0.5 }} whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }} transition={{ delay: 0.4 + i * 0.08, duration: 0.5 }}
            style={{
              position: 'absolute',
              left: `${cx}%`, top: `${cy}%`,
              transform: 'translate(-50%, -50%)',
              width: 56, height: 56, borderRadius: 16,
              background: C.panel,
              border: `1px solid ${C.border}`,
              display: 'grid', placeItems: 'center',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              animation: `kr-float ${6 + i}s ease-in-out ${-i * 0.5}s infinite`,
            }}>
            <I size={20} color={C.purple} />
            <span style={{
              position: 'absolute', top: 'calc(100% + 6px)',
              fontSize: 10, fontWeight: 700, color: C.textDim,
              letterSpacing: 1.2, textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}>{n.name}</span>
          </motion.div>
        )
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SOLVER
// ════════════════════════════════════════════════════════════════════════════
function SolverSection() {
  return (
    <Section>
      <div className="kr-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 64, alignItems: 'center' }}>
        <motion.div {...fadeUp(0.1)} style={{ order: 1 }}>
          <SolverMock />
        </motion.div>
        <motion.div {...fadeUp()}>
          <Eyebrow>AI Solver</Eyebrow>
          <h2 className="kr-h2" style={{ margin: 0, fontSize: 56, fontWeight: 800, letterSpacing: -1.5, color: C.text, lineHeight: 1.05 }}>
            Any doubt.<br/>
            <span className="kr-grad-text">Eight seconds.</span>
          </h2>
          <p style={{ marginTop: 22, fontSize: 16, color: C.textDim, lineHeight: 1.7, maxWidth: 500 }}>
            Type your question. Kairo writes a step-by-step explanation, finds 4–6
            relevant images, and pulls one matching YouTube video — all under eight
            seconds. Free, unlimited, available at 2 AM the night before your exam.
          </p>
        </motion.div>
      </div>
    </Section>
  )
}

function SolverMock() {
  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(20,20,30,0.96) 0%, rgba(10,10,16,0.94) 100%)',
      border: `1px solid ${C.border}`,
      borderRadius: 18,
      padding: 20,
      boxShadow: '0 24px 64px rgba(124,58,237,0.25)',
    }}>
      {/* Input */}
      <div style={{
        padding: '12px 14px', borderRadius: 10,
        background: C.panel2, border: `1px solid ${C.borderSoft}`,
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
      }}>
        <Sparkles size={14} color={C.purple} />
        <span style={{ fontSize: 13, color: C.textDim }}>Explain photosynthesis step by step</span>
      </div>

      {/* Slides + Answer split */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{
          aspectRatio: '4/3',
          borderRadius: 10, overflow: 'hidden',
          background:
            `radial-gradient(at 50% 50%, rgba(52,211,153,0.32), transparent 65%),
             linear-gradient(135deg, #064e3b 0%, #022c22 100%)`,
          border: `1px solid rgba(52,211,153,0.32)`,
          position: 'relative',
          display: 'grid', placeItems: 'center',
        }}>
          <Beaker size={48} color={C.green} style={{ opacity: 0.75 }} />
          <div style={{ position: 'absolute', bottom: 8, left: 10, right: 10, fontSize: 10, color: '#a7f3d0', fontWeight: 600 }}>
            Image  ·  Chloroplast diagram
          </div>
        </div>

        <div style={{
          padding: 12, borderRadius: 10,
          background: C.panel2, border: `1px solid ${C.borderSoft}`,
          fontSize: 11, lineHeight: 1.6, color: C.textDim,
        }}>
          <span style={{ color: C.text, fontWeight: 700 }}>Photosynthesis</span> is how plants convert light into chemical energy. It happens in <span style={{ color: C.green }}>chloroplasts</span>, mostly in the leaves...
          <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 6, fontSize: 10, color: C.purple }}>
            6 CO₂ + 6 H₂O → C₆H₁₂O₆ + 6 O₂
          </div>
        </div>
      </div>

      {/* Bottom — image strip + video chip */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {[C.amber, C.blue, C.cyan, C.pink].map((col, i) => (
          <div key={i} style={{
            flex: 1, aspectRatio: '1/1',
            borderRadius: 6,
            background: `linear-gradient(135deg, ${col}33, ${col}11)`,
            border: `1px solid ${col}44`,
          }}/>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// LABS
// ════════════════════════════════════════════════════════════════════════════
function LabsSection() {
  const labs = [
    { name: 'Solar System',    subject: 'Space',     icon: Globe,          tint: '#a78bfa' },
    { name: 'Human Heart',     subject: 'Biology',   icon: Heart,          tint: '#f87171' },
    { name: 'DNA Helix',       subject: 'Biology',   icon: Activity,       tint: '#34d399' },
    { name: 'Atomic Structure',subject: 'Chemistry', icon: Atom,           tint: '#60a5fa' },
    { name: 'Vectors 3D',      subject: 'Math',      icon: Compass,        tint: '#fbbf24' },
    { name: 'Saturn V Rocket', subject: 'Space',     icon: Zap,            tint: '#ec4899' },
  ]
  return (
    <Section id="labs">
      <motion.div {...fadeUp()} style={{ textAlign: 'center', marginBottom: 56 }}>
        <Eyebrow>Kairo Labs</Eyebrow>
        <h2 className="kr-h2" style={{ margin: 0, fontSize: 56, fontWeight: 800, letterSpacing: -1.5, color: C.text, lineHeight: 1.05 }}>
          Not videos.<br/>
          <span className="kr-grad-text">Real 3D simulations.</span>
        </h2>
        <p style={{ marginTop: 18, fontSize: 16, color: C.textDim, lineHeight: 1.6, maxWidth: 640, margin: '18px auto 0' }}>
          Drag to rotate. Click any part. Slide controls. Built with React Three Fiber +
          compressed GLB models that load in seconds on any device.
        </p>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}
           className="kr-2col">
        {labs.map((lab, i) => {
          const I = lab.icon
          return (
            <motion.div key={i} {...fadeUp(i * 0.07)}
              className="kr-card"
              style={{
                aspectRatio: '4/3',
                padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                background: `linear-gradient(135deg, ${lab.tint}1f 0%, transparent 60%), ${C.panel}`,
              }}>
              <div style={{
                position: 'absolute', top: -30, right: -30,
                width: 140, height: 140, borderRadius: '50%',
                background: `radial-gradient(circle, ${lab.tint}33 0%, transparent 70%)`,
                pointerEvents: 'none', filter: 'blur(10px)',
              }}/>
              <div style={{
                width: 50, height: 50, borderRadius: 14,
                background: `${lab.tint}22`,
                border: `1px solid ${lab.tint}44`,
                display: 'grid', placeItems: 'center',
                boxShadow: `0 0 24px ${lab.tint}55`,
              }}>
                <I size={22} color={lab.tint} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: lab.tint, letterSpacing: 1.4, textTransform: 'uppercase' }}>
                  {lab.subject}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginTop: 4 }}>
                  {lab.name}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      <motion.div {...fadeUp(0.1)} style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: C.textFaint }}>
        + 9 more labs across Physics, Chemistry, Biology, Math, and Space
      </motion.div>
    </Section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ADAPTATION
// ════════════════════════════════════════════════════════════════════════════
function AdaptationSection() {
  return (
    <Section>
      <motion.div {...fadeUp()} style={{ textAlign: 'center', maxWidth: 820, margin: '0 auto 56px' }}>
        <Eyebrow>Adaptive intelligence</Eyebrow>
        <h2 className="kr-h2" style={{ margin: 0, fontSize: 56, fontWeight: 800, letterSpacing: -1.5, color: C.text, lineHeight: 1.05 }}>
          Kairo <span className="kr-grad-text">learns you</span>.<br/>
          Then teaches you back.
        </h2>
      </motion.div>

      {/* Animated retention graph */}
      <motion.div {...fadeUp(0.1)} style={{
        background: C.panel, border: `1px solid ${C.border}`,
        borderRadius: 18, padding: 28,
        boxShadow: '0 18px 60px rgba(124,58,237,0.15)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, letterSpacing: 1.6, textTransform: 'uppercase' }}>
          Memory retention forecast
        </div>
        <div style={{ marginTop: 16 }}>
          <RetentionCurve />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 24 }}
             className="kr-2col">
          {[
            { l: 'WHAT YOU\'LL FORGET',  v: '7 topics', s: 'in the next 4 days' },
            { l: 'YOUR BEST HOUR',       v: '8 PM',     s: '23% higher accuracy' },
            { l: 'STREAK',                v: '10 days', s: 'longest yet' },
          ].map((it, i) => (
            <div key={i} style={{
              padding: 14, borderRadius: 10,
              background: C.panel2, border: `1px solid ${C.borderSoft}`,
            }}>
              <div style={{ fontSize: 10, color: C.textFaint, fontWeight: 700, letterSpacing: 1.4 }}>{it.l}</div>
              <div className="kr-grad-text" style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{it.v}</div>
              <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>{it.s}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </Section>
  )
}

function RetentionCurve() {
  const W = 1000, H = 220, P = 30
  const points = [1.0, 0.88, 0.72, 0.58, 0.49, 0.42, 0.38]
  const xs = (d: number) => P + (W - 2*P) * (d / 6)
  const ys = (r: number) => H - P - (H - 2*P) * r
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xs(i)} ${ys(p)}`).join(' ')
  const area = `${line} L ${xs(6)} ${H - P} L ${xs(0)} ${H - P} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="area2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#a78bfa" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="line2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c4b5fd"/>
          <stop offset="100%" stopColor="#22d3ee"/>
        </linearGradient>
      </defs>
      <line x1={P} y1={ys(0.6)} x2={W - P} y2={ys(0.6)} stroke={C.borderSoft} strokeDasharray="3 4"/>
      <text x={W - P + 4} y={ys(0.6) + 4} fill={C.textFaint} fontSize="10">60% threshold</text>
      <motion.path d={area} fill="url(#area2)"
        initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1.2 }}/>
      <motion.path d={line} fill="none" stroke="url(#line2)" strokeWidth="3" strokeLinejoin="round"
        initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.4, ease: 'easeOut' }}/>
      {points.map((p, i) => (
        <motion.circle key={i} cx={xs(i)} cy={ys(p)} r="5" fill="#fff" stroke="#a78bfa" strokeWidth="2"
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.1 }}/>
      ))}
      {[0,1,2,3,4,5,6].map(d => (
        <text key={d} x={xs(d)} y={H - 8} fill={C.textFaint} fontSize="10" textAnchor="middle">
          {d === 0 ? 'Today' : `+${d}d`}
        </text>
      ))}
    </svg>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ROLES
// ════════════════════════════════════════════════════════════════════════════
function RolesSection() {
  const roles = [
    { icon: GraduationCap, name: 'Students',
      tag: 'Learn faster. Forget less.',
      items: ['AI tutor that knows you', '3D simulation labs', 'Memory retention engine', 'Daily Battle Mode'] },
    { icon: BookOpen, name: 'Teachers',
      tag: 'Save hours every week.',
      items: ['AI lesson plans + quizzes', 'Bulk essay grader', 'At-risk student alerts', 'Auto-drafted parent updates'] },
    { icon: Users, name: 'Parents',
      tag: 'Stay informed. Never invade.',
      items: ['Marks + trend insights', 'Subject strength panels', 'No chat / homework access', 'Linked to one child'] },
    { icon: Building2, name: 'Schools',
      tag: 'Run the whole campus.',
      items: ['Admission AI bot', 'Attendance + timetable', 'Announcements + fees', 'Multi-tenant isolated'] },
  ]
  return (
    <Section>
      <motion.div {...fadeUp()} style={{ textAlign: 'center', marginBottom: 56 }}>
        <Eyebrow>One platform · four roles</Eyebrow>
        <h2 className="kr-h2" style={{ margin: 0, fontSize: 56, fontWeight: 800, letterSpacing: -1.5, color: C.text, lineHeight: 1.05 }}>
          A connected <span className="kr-grad-text">ecosystem</span>.
        </h2>
      </motion.div>

      <div className="kr-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
        {roles.map((r, i) => {
          const I = r.icon
          return (
            <motion.div key={i} {...fadeUp(i * 0.08)}
              className="kr-card"
              style={{ padding: 24 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(124,58,237,0.12)',
                border: `1px solid rgba(124,58,237,0.32)`,
                display: 'grid', placeItems: 'center', marginBottom: 16,
              }}>
                <I size={20} color={C.purple} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{r.name}</div>
              <div style={{ fontSize: 12, color: C.purple, marginTop: 4, fontWeight: 600 }}>{r.tag}</div>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {r.items.map((it, j) => (
                  <div key={j} style={{ fontSize: 12, color: C.textDim, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: C.purple, fontWeight: 800, lineHeight: 1.5 }}>▪</span>
                    {it}
                  </div>
                ))}
              </div>
            </motion.div>
          )
        })}
      </div>
    </Section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// FEATURES
// ════════════════════════════════════════════════════════════════════════════
function FeaturesSection() {
  const features = [
    { i: MessageCircleIcon, t: 'AI Solver',         s: 'Doubts answered in 8s' },
    { i: Brain,             t: 'Memory Brain',      s: 'Long-term recall engine' },
    { i: Beaker,            t: 'Kairo Labs',        s: '15 3D simulations' },
    { i: Activity,          t: 'Mistake Analysis',  s: 'Pattern detection' },
    { i: Zap,               t: 'Revision Sim',      s: 'Spaced repetition' },
    { i: Compass,           t: 'Adaptive Path',     s: 'AI-curated journey' },
    { i: Network,           t: 'Concept Map',       s: 'Visual learning' },
    { i: BookOpen,          t: 'AI Notebook',       s: 'Second brain' },
    { i: Mic,               t: 'Voice Tutor',       s: 'Speak your doubt' },
    { i: Layers,            t: 'Flashcards SRS',    s: 'Anki-style review' },
    { i: Target,            t: 'Adaptive Quiz',     s: 'Tuned to your level' },
    { i: TrendingUp,        t: 'Performance Predictor', s: 'Forecast your grade' },
    { i: Bot,               t: 'AI Teacher',        s: 'Lesson plans + quizzes' },
    { i: Camera,            t: 'Camera Study',      s: 'Scan textbook page' },
    { i: FunctionSquare,    t: 'Formula Sheet',     s: 'Every formula, indexed' },
    { i: Sparkles,          t: 'AI Insights',       s: 'Personalised guidance' },
  ]
  return (
    <Section>
      <motion.div {...fadeUp()} style={{ textAlign: 'center', marginBottom: 48 }}>
        <Eyebrow>40+ features</Eyebrow>
        <h2 className="kr-h2" style={{ margin: 0, fontSize: 56, fontWeight: 800, letterSpacing: -1.5, color: C.text, lineHeight: 1.05 }}>
          One app.<br/>
          <span className="kr-grad-text">Every learning tool you’ll need.</span>
        </h2>
      </motion.div>

      <div
        className="kr-features-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 14,
        }}>
        {features.map((f, i) => {
          const I = f.i
          return (
            <motion.div key={i}
              initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: (i % 8) * 0.05, duration: 0.5 }}
              className="kr-card"
              style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(124,58,237,0.10)',
                border: `1px solid rgba(124,58,237,0.28)`,
                display: 'grid', placeItems: 'center',
              }}>
                <I size={16} color={C.purple} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{f.t}</div>
                <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 2 }}>{f.s}</div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </Section>
  )
}

// Tiny inline icon since lucide doesn't export "MessageCircleIcon" by this name
function MessageCircleIcon({ size = 16, color = C.purple }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// FUTURE
// ════════════════════════════════════════════════════════════════════════════
function FutureSection() {
  return (
    <Section>
      <motion.div {...fadeUp()} style={{
        padding: '72px 48px',
        background:
          `radial-gradient(at 20% 30%, rgba(124,58,237,0.18) 0%, transparent 50%),
           radial-gradient(at 80% 70%, rgba(37,99,235,0.16) 0%, transparent 55%),
           linear-gradient(135deg, #0a0a18 0%, #0e0e1e 100%)`,
        border: `1px solid ${C.border}`,
        borderRadius: 24,
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div className="kr-noise" />
        <Eyebrow>The future</Eyebrow>
        <h2 className="kr-h2" style={{
          margin: 0, fontSize: 60, fontWeight: 800, letterSpacing: -1.8,
          color: C.text, lineHeight: 1.05, maxWidth: 800, marginInline: 'auto',
        }}>
          Built for the way<br/>
          <span className="kr-grad-text">your generation</span> actually learns.
        </h2>
        <p style={{
          marginTop: 22, fontSize: 17, color: C.textDim, lineHeight: 1.7,
          maxWidth: 580, marginInline: 'auto',
        }}>
          Every student has a different brain. Kairo finally treats them that way —
          watching, adapting, and quietly making sure no one gets left behind.
        </p>
      </motion.div>
    </Section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// FINAL CTA
// ════════════════════════════════════════════════════════════════════════════
function FinalCTASection({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <Section>
      <motion.div {...fadeUp()} style={{ textAlign: 'center', position: 'relative', padding: '60px 24px' }}>
        {/* Backdrop */}
        <div style={{
          position: 'absolute', inset: '-20% -10%',
          background:
            `radial-gradient(at 50% 50%, rgba(124,58,237,0.30) 0%, transparent 55%)`,
          filter: 'blur(40px)', pointerEvents: 'none',
        }}/>

        {/* Big logo */}
        <div style={{ position: 'relative', marginBottom: 30, display: 'inline-block' }}>
          <KairoLogo size={92} />
        </div>

        <h2 className="kr-h2" style={{
          margin: 0, fontSize: 80, fontWeight: 800, letterSpacing: -3,
          color: C.text, lineHeight: 1.0, position: 'relative',
        }}>
          Experience<br/>
          <span className="kr-grad-text">learning.</span>
        </h2>

        <p style={{
          marginTop: 24, fontSize: 18, color: C.textDim, lineHeight: 1.6,
          maxWidth: 540, margin: '24px auto 0', position: 'relative',
        }}>
          The future of education starts now.
        </p>

        <div style={{
          marginTop: 44, display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap',
          position: 'relative',
        }}>
          <button onClick={onGetStarted}
            className="kr-btn-glow"
            style={{
              padding: '17px 36px', borderRadius: 13,
              background: GRAD.pill, color: '#fff',
              fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer',
              boxShadow: '0 18px 56px rgba(124,58,237,0.55)',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontFamily: 'inherit',
            }}>
            Join Kairo <ArrowRight size={18} />
          </button>
          <a href="#labs"
            className="kr-btn-glow"
            style={{
              padding: '17px 34px', borderRadius: 13,
              background: 'rgba(255,255,255,0.04)', color: C.text,
              fontWeight: 600, fontSize: 16,
              border: `1px solid ${C.border}`, cursor: 'pointer',
              textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontFamily: 'inherit', backdropFilter: 'blur(8px)',
            }}>
            <Beaker size={18} color={C.purple} /> Explore Labs
          </a>
        </div>
      </motion.div>
    </Section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// FOOTER
// ════════════════════════════════════════════════════════════════════════════
function Footer() {
  return (
    <footer style={{
      padding: '32px 32px 40px', maxWidth: 1280, margin: '0 auto',
      borderTop: `1px solid ${C.borderSoft}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <KairoLogo size={24} />
          <span style={{ fontSize: 13, fontWeight: 700, color: C.textDim }}>
            KAIRO  ·  ACCELERATE YOUR ACADEMICS
          </span>
        </div>
        <div style={{ fontSize: 11, color: C.textFaint }}>
          © {new Date().getFullYear()} Kairo · Built for Indian classrooms.
        </div>
      </div>
    </footer>
  )
}
