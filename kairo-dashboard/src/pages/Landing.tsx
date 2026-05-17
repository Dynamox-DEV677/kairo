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
import { useRef, useState, useEffect } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, Sparkles, Cpu, Beaker, Brain, Eye, MousePointerClick,
  BookOpen, Repeat, GraduationCap, Users, Building2, ShieldCheck,
  Zap, Atom, Activity, Layers, Target, Mic, Camera, Network,
  TrendingUp, Bot, Heart, Globe, FunctionSquare, Compass,
} from 'lucide-react'
import LabPreview3D, { type LabVariant } from '../components/LabPreview3D'
import HeroCore3D from '../components/HeroCore3D'
import DepthDust from '../components/DepthDust'
import { openTerms } from '../components/Terms'

// ════════════════════════════════════════════════════════════════════════════
// TOKENS — strict monochrome palette: BLACK · DEEP PURPLE · WHITE only
// ════════════════════════════════════════════════════════════════════════════
const C = {
  bg:        '#06060a',   // pure dark
  panel:     '#0c0c14',
  panel2:    '#12121c',
  border:    '#22222e',
  borderSoft:'#1a1a26',

  // Whites
  text:      '#ffffff',
  textDim:   '#c1c1c8',
  textFaint: '#8a8a96',
  textVery:  '#5a5a66',

  // Purple scale (light → dark)
  purpleLite:'#e9d5ff',   // very light lavender
  purpleSoft:'#c4b5fd',
  purple:    '#a78bfa',   // primary
  purpleHi:  '#7c3aed',   // bright primary
  purpleDeep:'#5b21b6',
  purpleDark:'#3b0764',

  // Status scale uses the SAME purple gradient — quality reads as light/dark intensity, not hue.
  ok:        '#a78bfa',
  warn:      '#7c3aed',
  bad:       '#3b0764',
}

const GRAD = {
  // Hero/pill/text gradients are now all purple → deep-purple → black/white
  hero:     'linear-gradient(135deg, #7c3aed 0%, #5b21b6 40%, #1e0937 80%, #06060a 100%)',
  pill:     'linear-gradient(135deg, #7c3aed 0%, #5b21b6 60%, #3b0764 100%)',
  pillHi:   'linear-gradient(135deg, #a78bfa 0%, #7c3aed 50%, #5b21b6 100%)',
  text:     'linear-gradient(90deg, #ffffff 0%, #c4b5fd 50%, #a78bfa 100%)',
  textWarm: 'linear-gradient(90deg, #ffffff 0%, #a78bfa 100%)',
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
      position: 'relative',
    }}>
      <GlobalKeyframes />

      {/* Continuous background atmospheric layer that bleeds across every section */}
      <AtmosphereLayer />

      {/* Persistent dust layer — drifts across the entire scroll, scroll- + mouse-reactive */}
      <DepthDust intensity={0.85} zIndex={0} />

      <TopNav onGetStarted={onGetStarted} />

      {/* No more SectionDividers — they were 80-100px of vertical
          padding each + a centred badge, contributing massively to the
          "stacked panels separated by black voids" feeling. The Section
          dolly entrance + section padding now carries the rhythm. */}
      <HeroSection onGetStarted={onGetStarted} />
      <ProofStrip />
      <ProblemSection />
      <OSSection />
      <SolverSection />
      <LabsSection />
      <LogoInterlude />
      <AdaptationSection />
      <RolesSection />
      <FeaturesSection />
      <FutureSection />
      <FinalCTASection onGetStarted={onGetStarted} />
      <Footer />

      {/* Floating AI presence widget — surfaces "intelligent" feedback */}
      <AIPresenceWidget />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// AMBIENT ATMOSPHERE — sits behind every section, gives the page depth
// ════════════════════════════════════════════════════════════════════════════
function AtmosphereLayer() {
  // Logo watermark positions scattered down the scroll. The PNG renders the
  // real intertwined-leaves brand mark, so opacity needs to be a bit lower
  // than the previous fake-badge had (0.16–0.22) — the leaves are visually
  // busier than a solid dark badge frame.
  const watermarks = [
    { top: '50%',  left: '6%',   size: 220, opacity: 0.18, delay: 0  },
    { top: '105%', left: '88%',  size: 280, opacity: 0.16, delay: 4  },
    { top: '170%', left: '50%',  size: 380, opacity: 0.20, delay: 2  },
    { top: '245%', left: '10%',  size: 240, opacity: 0.15, delay: 6  },
    { top: '310%', left: '85%',  size: 300, opacity: 0.17, delay: 3  },
    { top: '380%', left: '50%',  size: 340, opacity: 0.19, delay: 5  },
    { top: '450%', left: '15%',  size: 220, opacity: 0.15, delay: 1  },
  ]

  return (
    <div aria-hidden style={{
      position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {/* Slow drifting glow blobs */}
      <div style={{
        position: 'absolute', top: '15%', left: '-10%',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)',
        filter: 'blur(40px)',
        animation: 'kr-float 14s ease-in-out infinite',
      }}/>
      <div style={{
        position: 'absolute', top: '60%', right: '-10%',
        width: 700, height: 700, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.14) 0%, transparent 70%)',
        filter: 'blur(50px)',
        animation: 'kr-float 18s ease-in-out -3s infinite',
      }}/>
      <div style={{
        position: 'absolute', top: '120%', left: '40%',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(196, 181, 253,0.10) 0%, transparent 70%)',
        filter: 'blur(40px)',
        animation: 'kr-float 16s ease-in-out -6s infinite',
      }}/>

      {/* Kairo logo watermarks — the real intertwined-leaves brand mark,
          scattered across the full scroll. Gentle float on staggered delays
          so they never breathe in sync. Glow drop-shadow makes them shimmer
          against the dark background. */}
      {watermarks.map((w, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: w.top, left: w.left,
          transform: 'translate(-50%, -50%)',
          opacity: w.opacity,
          filter: 'drop-shadow(0 0 30px rgba(192,132,252,0.4))',
          animation: `kr-float ${12 + (i % 4) * 2}s ease-in-out -${w.delay}s infinite`,
        }}>
          <KairoLogo size={w.size} />
        </div>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// LOGO INTERLUDE — cinematic full-bleed logo moment between sections
// ════════════════════════════════════════════════════════════════════════════
function LogoInterlude() {
  return (
    <section style={{
      padding: '72px 24px',                 // was 140px — half the vertical air
      position: 'relative',
      textAlign: 'center',
      maxWidth: 1280, margin: '0 auto',
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.86 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 1.4, ease: [0.21,0.86,0.41,1] as any }}
        style={{ position: 'relative', display: 'inline-block' }}>

        {/* Massive glow halo behind the badge */}
        <div style={{
          position: 'absolute', inset: '-60%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.32) 0%, rgba(37,99,235,0.16) 35%, transparent 70%)',
          filter: 'blur(40px)',
          animation: 'kr-glow 5s ease-in-out infinite',
          pointerEvents: 'none',
        }}/>

        {/* The hero-sized brand badge — fully interactive, ripples on click */}
        <div style={{ position: 'relative' }}>
          <InteractiveLogo size={200} />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        style={{ marginTop: 40, position: 'relative' }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 4,
          textTransform: 'uppercase', color: C.purple,
          marginBottom: 14,
        }}>
          Kairo
        </div>
        <h2 className="kr-h2" style={{
          margin: 0, fontSize: 54, fontWeight: 800, letterSpacing: -1.5,
          color: C.text, lineHeight: 1.05, maxWidth: 760, marginInline: 'auto',
        }}>
          One ecosystem.<br/>
          <span className="kr-grad-text">Every learning moment.</span>
        </h2>
      </motion.div>
    </section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// AI PRESENCE WIDGET — floating bottom-right with cycling AI insights
// ════════════════════════════════════════════════════════════════════════════
function AIPresenceWidget() {
  // Tones are all purple shades — quality varies by lightness, never by hue.
  const messages = [
    { icon: Eye,       title: 'Detected visual learning preference.', tone: '#a78bfa' },
    { icon: Brain,     title: 'Memory retention model updated.',       tone: '#c4b5fd' },
    { icon: Target,    title: 'Weakness prediction recalculated.',     tone: '#7c3aed' },
    { icon: Sparkles,  title: 'Adaptive path generated for tonight.',  tone: '#a78bfa' },
    { icon: Activity,  title: 'Focus pattern: peaks at 8 PM.',         tone: '#c4b5fd' },
  ]
  const [idx, setIdx] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Slight delay before the widget appears at all
    const t = setTimeout(() => setOpen(true), 1800)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setIdx(i => (i + 1) % messages.length), 4200)
    return () => clearInterval(id)
  }, [open, messages.length])

  const cur = messages[idx]
  const Icon = cur.icon

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 99,
      maxWidth: 340, pointerEvents: 'none',
    }}>
      <AnimatePresence mode="wait">
        {open && (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: -8,    scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.21,0.86,0.41,1] as any }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 14px',
              borderRadius: 14,
              background: 'rgba(13,13,21,0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${cur.tone}44`,
              boxShadow: `0 18px 48px ${cur.tone}22, 0 0 0 1px rgba(255,255,255,0.02) inset`,
            }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              background: `${cur.tone}1c`, border: `1px solid ${cur.tone}55`,
              display: 'grid', placeItems: 'center',
              boxShadow: `0 0 14px ${cur.tone}55`,
            }}>
              <Icon size={14} color={cur.tone} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 9.5, fontWeight: 700, color: cur.tone,
                letterSpacing: 1.6, textTransform: 'uppercase',
              }}>
                Kairo  ·  Live
              </div>
              <div style={{ fontSize: 12.5, color: C.text, marginTop: 1, fontWeight: 500, lineHeight: 1.35 }}>
                {cur.title}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAGNETIC BUTTON — the CTAs follow the cursor slightly on hover
// ════════════════════════════════════════════════════════════════════════════
function MagneticButton({
  as = 'button',
  children,
  strength = 0.25,
  ...rest
}: {
  as?: 'button' | 'a'
  children: React.ReactNode
  strength?: number
  [key: string]: any
}) {
  const ref = useRef<HTMLElement>(null)
  function onMouseMove(e: React.MouseEvent) {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    const x = (e.clientX - (r.left + r.width / 2)) * strength
    const y = (e.clientY - (r.top  + r.height / 2)) * strength
    ref.current.style.transform = `translate(${x}px, ${y}px)`
  }
  function onMouseLeave() {
    if (!ref.current) return
    ref.current.style.transform = 'translate(0, 0)'
  }
  const Tag: any = as
  return (
    <Tag
      ref={ref as any}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        display: 'inline-flex',
        transition: 'transform .25s cubic-bezier(.2,.6,.2,1), box-shadow .25s ease',
        willChange: 'transform',
      }}
      {...rest}>
      {children}
    </Tag>
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
      @keyframes kr-badge-pulse {
        0%, 100% { filter: drop-shadow(0 0 14px rgba(192,132,252,0.45)) drop-shadow(0 0 28px rgba(167, 139, 250,0.20)); }
        50%      { filter: drop-shadow(0 0 28px rgba(192,132,252,0.85)) drop-shadow(0 0 48px rgba(167, 139, 250,0.45)); }
      }
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
        .kr-h1 { font-size: clamp(30px, 8.5vw, 40px) !important; line-height: 1.08 !important; letter-spacing: -0.8px !important; }
        .kr-h2 { font-size: clamp(22px, 6.5vw, 30px) !important; line-height: 1.15 !important; }
        .kr-section { padding: 56px 18px !important; }
        .kr-2col { grid-template-columns: 1fr !important; gap: 32px !important; }
        .kr-features-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)) !important; }
        .kr-labs-grid { grid-template-columns: 1fr !important; gap: 14px !important; }
        .landing-hero {
          padding-top: 90px !important;
          padding-bottom: 40px !important;
        }
        .landing-hero p {
          font-size: 14px !important;
          line-height: 1.55 !important;
          margin-top: 18px !important;
          padding: 0 8px;
        }
        /* Hide the floating logo badges on small screens — too crowded */
        .landing-hero > div[style*="position: absolute"][style*="top: 110px"],
        .landing-hero > div[style*="position: absolute"][style*="bottom: 80px"] {
          display: none !important;
        }
        /* The 3D AI core scales down so it doesn't blow out the hero */
        .landing-hero canvas { transform: scale(0.7); }
      }
      @media (min-width: 769px) and (max-width: 1024px) {
        .kr-labs-grid { grid-template-columns: repeat(2, 1fr) !important; }
      }

      /* Make sure every section composes ABOVE the atmosphere layer */
      section { position: relative; z-index: 1; }

      /* Smooth scroll behavior (lightweight, no JS library needed) */
      html { scroll-behavior: smooth; }

      /* Headline rendering quality boost */
      .kr-h1, .kr-h2 {
        font-feature-settings: 'ss01', 'cv11', 'kern';
        text-rendering: optimizeLegibility;
      }
    `}</style>
  )
}

function Section({ children, style = {}, id }: { children: React.ReactNode; style?: React.CSSProperties; id?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  // Scroll-linked entrance: content RISES (translateY 40→0), scales (0.96→1),
  // opacity fades (0.55→1) as the section enters the viewport.
  //
  // NOTE: the previous version also drove a 6→0 blur tied to scroll, but at
  // mid-scroll 10+ sections would all be in some partial blur state — the
  // page read as fuzzy everywhere. Dropped the blur. Y + scale + opacity
  // carry the entrance cleanly without harming text readability.
  const { scrollYProgress } = useScroll({
    target: ref, offset: ['start end', 'start center'],
  })
  const y       = useTransform(scrollYProgress, [0, 1], [40, 0])
  const scale   = useTransform(scrollYProgress, [0, 1], [0.97, 1])
  const opacity = useTransform(scrollYProgress, [0, 0.4, 1], [0.55, 0.95, 1])

  return (
    <section
      id={id}
      className="kr-section"
      style={{
        padding: '56px 32px',
        position: 'relative',
        maxWidth: 1280,
        margin: '0 auto',
        ...style,
      }}>
      <motion.div
        ref={ref}
        style={{ y, scale, opacity, transformOrigin: 'center top' }}>
        {children}
      </motion.div>
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
// SCROLL HEADLINE — every section h2 gets blur-to-focus entrance + scroll-linked
// scale + parallax. Apple-style motion at every section break.
// ════════════════════════════════════════════════════════════════════════════
function ScrollHeadline({
  children, eyebrow, align = 'center', maxWidth,
}: {
  children: React.ReactNode
  eyebrow?: string
  align?:  'center' | 'left'
  maxWidth?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref, offset: ['start end', 'end start'],
  })
  // Phase 1: scale grows from .96 → 1.04 as the headline enters the viewport;
  // phase 2: parallax-shifts upward as it leaves.
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.96, 1.02, 1.04])
  const y     = useTransform(scrollYProgress, [0, 1], ['0%', '-12%'])

  return (
    <motion.div
      ref={ref}
      style={{
        y,
        textAlign: align,
        marginBottom: 48,
        ...(maxWidth ? { maxWidth, margin: align === 'center' ? '0 auto 48px' : `0 0 48px` } : {}),
      }}>
      {eyebrow && (
        <motion.div
          initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}>
          <Eyebrow>{eyebrow}</Eyebrow>
        </motion.div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 24, filter: 'blur(14px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 1.0, ease: [0.21, 0.86, 0.41, 1] as any }}
        style={{ scale, transformOrigin: 'center bottom' }}>
        {children}
      </motion.div>
    </motion.div>
  )
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
          <KairoBadge size={32} animated={false} />
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

// The actual Kairo brand mark — intertwined leaves + colored balls.
// Lives at /public/kairo_logo.png so it ships in the build, deduped via
// browser HTTP cache regardless of how many times we render it.
function KairoLogo({ size = 32, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <img
      src="/kairo_logo.png"
      alt="Kairo"
      width={size}
      height={size}
      draggable={false}
      decoding="async"
      loading="eager"
      style={{
        width: size, height: size,
        objectFit: 'contain',
        display: 'block',
        userSelect: 'none',
        pointerEvents: 'none',
        filter: glow ? `drop-shadow(0 0 ${size * 0.25}px rgba(192,132,252,0.55))` : undefined,
      }}
    />
  )
}

// ════════════════════════════════════════════════════════════════════════════
// KAIRO BADGE — the real logo wrapped in an animated glow halo
// ════════════════════════════════════════════════════════════════════════════
// Earlier this was a dark circular frame around a fake K-glyph; now it's just
// the real Kairo logo + a configurable glow halo. The leaves design is iconic
// enough to carry its own brand identity without a fake "badge" frame.
function KairoBadge({
  size      = 64,
  glow      = true,
  intense   = false,
  animated  = true,
}: { size?: number; glow?: boolean; intense?: boolean; animated?: boolean }) {
  return (
    <div style={{
      position: 'relative',
      width: size, height: size,
      display: 'inline-block',
      filter: glow
        ? `drop-shadow(0 0 ${intense ? size * 0.32 : size * 0.22}px rgba(192,132,252,${intense ? 0.85 : 0.55}))
           drop-shadow(0 0 ${intense ? size * 0.55 : size * 0.40}px rgba(124,58,237,${intense ? 0.55 : 0.35}))`
        : 'none',
      animation: animated ? 'kr-badge-pulse 5s ease-in-out infinite' : undefined,
    }}>
      <img
        src="/kairo_logo.png"
        alt="Kairo"
        width={size}
        height={size}
        draggable={false}
        style={{
          width: size, height: size,
          objectFit: 'contain',
          display: 'block',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION DIVIDER — small glowing badge + hairline between sections
// ════════════════════════════════════════════════════════════════════════════
function SectionDivider({ size = 40 }: { size?: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 22, padding: '32px 24px',
      maxWidth: 1280, margin: '0 auto',
      position: 'relative', zIndex: 1,
    }}>
      <div style={{
        flex: 1, height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.35), transparent)',
        maxWidth: 240,
      }}/>
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6 }}>
        <KairoBadge size={size} />
      </motion.div>
      <div style={{
        flex: 1, height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.35), transparent)',
        maxWidth: 240,
      }}/>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// HERO
// ════════════════════════════════════════════════════════════════════════════
function HeroSection({ onGetStarted }: { onGetStarted: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })

  // Layered parallax: each element travels at a different speed for depth
  const titleY    = useTransform(scrollYProgress, [0, 1], ['0%', '-30%'])
  const titleScale= useTransform(scrollYProgress, [0, 1], [1, 1.18])
  const titleBlur = useTransform(scrollYProgress, [0.4, 1], [0, 8])
  const titleBlurStr = useTransform(titleBlur, v => `blur(${v}px)`)
  const subY      = useTransform(scrollYProgress, [0, 1], ['0%', '-15%'])
  const heroFade  = useTransform(scrollYProgress, [0, 0.7], [1, 0])
  const coreY     = useTransform(scrollYProgress, [0, 1], ['0%', '20%'])

  // Mouse parallax — feeds HeroCore3D and adds subtle hero tilt
  const pointerXRef = useRef(0)
  const pointerYRef = useRef(0)
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      pointerXRef.current = (e.clientX - cx) / cx
      pointerYRef.current = (e.clientY - cy) / cy
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <section ref={ref} className="landing-hero" style={{
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
      <LightRays />
      <GridFloor />
      <div className="kr-noise" />

      {/* Hero corner badges — interactive: click to ripple energy waves */}
      <div style={{
        position: 'absolute', top: 110, right: 40, zIndex: 4,
        opacity: 0.85, animation: 'kr-float 9s ease-in-out infinite',
      }}>
        <InteractiveLogo size={68} />
      </div>
      <div style={{
        position: 'absolute', bottom: 80, left: 40, zIndex: 4,
        opacity: 0.80, animation: 'kr-float 11s ease-in-out -3s infinite',
      }}>
        <InteractiveLogo size={52} />
      </div>

      {/* 3D AI Core — sits behind the headline, scaled to fill the hero.
          Materializes from scale 0 on mount, scroll-recedes thereafter. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05, duration: 1.4, ease: [0.21,0.86,0.41,1] as any }}
        style={{
          y: coreY,
          position: 'absolute', inset: 0,
          pointerEvents: 'none', zIndex: 1,
        }}>
        <HeroCore3D scrollProgress={scrollYProgress} pointerXRef={pointerXRef} pointerYRef={pointerYRef} />
      </motion.div>

      {/* Text-readability vignette — sits between the 3D core (z:1) and the
          text content (z:2). A dark horizontal band that darkens the area
          where the headline sits, so white text always reads crisp against
          the bright icosahedron. Fades to transparent at edges so the core
          still fills the periphery. */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        background:
          `radial-gradient(ellipse 70% 38% at 50% 48%, rgba(6,6,10,0.65) 0%, rgba(6,6,10,0.35) 45%, transparent 75%)`,
      }}/>

      <motion.div style={{ opacity: heroFade, textAlign: 'center', maxWidth: 1100, padding: '0 24px', position: 'relative', zIndex: 3 }}>
        {/* Brand badge — "Kairo OS is live" */}
        <motion.div
          initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0,  filter: 'blur(0px)' }}
          transition={{ delay: 0.4, duration: 0.7 }}
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
              background: C.purple,
              boxShadow: `0 0 12px ${C.purple}`,
              animation: 'kr-pulse 2.4s ease-in-out infinite',
            }} />
            New  ·  Kairo OS is live
          </span>
        </motion.div>

        {/* Massive headline — blur-to-focus reveal + scroll-linked scale */}
        <motion.h1
          initial={{ opacity: 0, y: 30, scale: 0.96, filter: 'blur(18px)' }}
          animate={{ opacity: 1, y: 0,  scale: 1,    filter: 'blur(0px)' }}
          transition={{ delay: 0.6, duration: 1.2, ease: [0.21,0.86,0.41,1] as any }}
          className="kr-h1"
          style={{
            y: titleY,
            scale: titleScale,
            filter: titleBlurStr,
            transformOrigin: 'center top',
            margin: 0,
            fontSize: 'clamp(30px, 7.5vw, 92px)', lineHeight: 1.02, fontWeight: 800,
            letterSpacing: -2.5,
            color: C.text,
            textShadow: '0 8px 60px rgba(124,58,237,0.35)',
          }}>
          The future of <br/>
          <span className="kr-grad-text">intelligent education.</span>
        </motion.h1>

        {/* Subhead — fades in slower, parallaxes slower than title */}
        <motion.p
          initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0,  filter: 'blur(0px)' }}
          transition={{ delay: 0.95, duration: 0.9 }}
          style={{
            y: subY,
            marginTop: 26, marginBottom: 0,
            fontSize: 'clamp(14px, 2.2vw, 19px)', color: C.textDim,
            maxWidth: 700, marginLeft: 'auto', marginRight: 'auto',
            lineHeight: 1.55, fontWeight: 400,
            padding: '0 12px',
          }}>
          Kairo combines AI tutoring, adaptive learning, immersive 3D simulations,
          and school intelligence into one connected ecosystem.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0,  filter: 'blur(0px)' }}
          transition={{ delay: 1.25, duration: 0.85 }}
          style={{
            marginTop: 38, display: 'flex', gap: 14,
            justifyContent: 'center', flexWrap: 'wrap',
          }}>
          <MagneticButton
            onClick={onGetStarted}
            className="kr-btn-glow"
            style={{
              padding: '15px 30px', borderRadius: 12,
              background: GRAD.pill,
              color: '#fff', fontWeight: 700, fontSize: 15,
              border: 'none', cursor: 'pointer',
              boxShadow: '0 14px 40px rgba(124,58,237,0.45)',
              alignItems: 'center', gap: 8,
              fontFamily: 'inherit', letterSpacing: 0.2,
            }}>
            Start Learning <ArrowRight size={16} />
          </MagneticButton>
          <MagneticButton
            as="a"
            href="#labs"
            className="kr-btn-glow"
            style={{
              padding: '15px 28px', borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              color: C.text, fontWeight: 600, fontSize: 15,
              border: `1px solid ${C.border}`, cursor: 'pointer',
              textDecoration: 'none',
              alignItems: 'center', gap: 8,
              fontFamily: 'inherit', backdropFilter: 'blur(10px)',
            }}>
            <Beaker size={16} color={C.purple} /> Explore Kairo Labs
          </MagneticButton>
        </motion.div>

        {/* Floating UI preview — a small "Kairo OS" glimpse below the headline,
            sized down so the 3D core stays the visual centerpiece. */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.92, filter: 'blur(14px)' }}
          animate={{ opacity: 1, y: 0,  scale: 1,    filter: 'blur(0px)' }}
          transition={{ delay: 1.55, duration: 1.2, ease: [0.21,0.86,0.41,1] as any }}
          style={{
            marginTop: 64,
            position: 'relative',
            maxWidth: 820, margin: '64px auto 0',
            padding: 0,
            animation: 'kr-float 8s ease-in-out infinite',
            perspective: '1200px',
          }}>
          <div style={{ transform: 'rotateX(6deg)', transformStyle: 'preserve-3d' }}>
            <HeroDashboardMock />
          </div>
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
         radial-gradient(at 50% 100%, rgba(196, 181, 253,0.16) 0%, transparent 50%)`,
    }} />
  )
}

// Subtle volumetric light rays sweeping the hero
function LightRays() {
  return (
    <div aria-hidden style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute',
          top: '-20%', left: `${20 + i * 22}%`,
          width: 2, height: '140%',
          background: `linear-gradient(180deg, transparent 0%, rgba(196,181,253,${0.25 - i * 0.05}) 30%, rgba(196, 181, 253,${0.15 - i * 0.03}) 60%, transparent 100%)`,
          transform: `rotate(${12 + i * 2}deg)`,
          filter: 'blur(2px)',
          animation: `kr-glow ${6 + i}s ease-in-out -${i}s infinite`,
        }}/>
      ))}
    </div>
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

      <div className="landing-demo-grid" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14, alignItems: 'start' }}>
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
                  <stop offset="100%" stopColor="#c4b5fd"/>
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
          <div style={{ fontSize: 10, fontWeight: 700, color: C.purple, letterSpacing: 1.4, textTransform: 'uppercase' }}>● Thriving</div>
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
              <span style={{ width: '50%', background: C.purpleSoft }}/>
              <span style={{ width: '7%',  background: C.purpleLite }}/>
              <span style={{ width: '14%', background: C.purple }}/>
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
                const col = t.m < 0.4 ? C.purpleDeep : t.m < 0.7 ? C.purpleHi : C.purpleSoft
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
      <ScrollHeadline eyebrow="The problem">
        <h2 className="kr-h2" style={{ margin: 0, fontSize: 56, fontWeight: 800, letterSpacing: -1.5, color: C.text, lineHeight: 1.05 }}>
          Three things textbooks +<br/>
          tuitions <span className="kr-grad-text-warm">can’t fix</span>.
        </h2>
      </ScrollHeadline>

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
            <stop offset="100%" stopColor="#c4b5fd" stopOpacity="0.5"/>
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
            `radial-gradient(at 50% 50%, rgba(167,139,250,0.32), transparent 65%),
             linear-gradient(135deg, #1e0937 0%, #0c0418 100%)`,
          border: `1px solid rgba(167,139,250,0.32)`,
          position: 'relative',
          display: 'grid', placeItems: 'center',
        }}>
          <Beaker size={48} color={C.purpleSoft} style={{ opacity: 0.75 }} />
          <div style={{ position: 'absolute', bottom: 8, left: 10, right: 10, fontSize: 10, color: C.purpleLite, fontWeight: 600 }}>
            Image  ·  Chloroplast diagram
          </div>
        </div>

        <div style={{
          padding: 12, borderRadius: 10,
          background: C.panel2, border: `1px solid ${C.borderSoft}`,
          fontSize: 11, lineHeight: 1.6, color: C.textDim,
        }}>
          <span style={{ color: C.text, fontWeight: 700 }}>Photosynthesis</span> is how plants convert light into chemical energy. It happens in <span style={{ color: C.purple }}>chloroplasts</span>, mostly in the leaves...
          <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 6, fontSize: 10, color: C.purple }}>
            6 CO₂ + 6 H₂O → C₆H₁₂O₆ + 6 O₂
          </div>
        </div>
      </div>

      {/* Bottom — image strip + video chip */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {[C.purpleHi, C.purpleSoft, C.purpleLite, C.purpleHi].map((col, i) => (
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
  // Each lab gets a distinct purple shade — depth scale across the spectrum
  // gives visual variation while honouring the strict B/W/purple-only rule.
  const labs: Array<{ name: string; subject: string; icon: any; tint: string; variant: LabVariant }> = [
    { name: 'Solar System',     subject: 'Space',     icon: Globe,    tint: '#c4b5fd', variant: 'solar'   },
    { name: 'Human Heart',      subject: 'Biology',   icon: Heart,    tint: '#a78bfa', variant: 'heart'   },
    { name: 'DNA Helix',        subject: 'Biology',   icon: Activity, tint: '#9333ea', variant: 'dna'     },
    { name: 'Atomic Structure', subject: 'Chemistry', icon: Atom,     tint: '#d8b4fe', variant: 'atom'    },
    { name: 'Vectors 3D',       subject: 'Math',      icon: Compass,  tint: '#7c3aed', variant: 'vectors' },
    { name: 'Saturn V Rocket',  subject: 'Space',     icon: Zap,      tint: '#5b21b6', variant: 'rocket'  },
  ]
  return (
    <Section id="labs">
      <ScrollHeadline eyebrow="Kairo Labs">
        <h2 className="kr-h2" style={{ margin: 0, fontSize: 56, fontWeight: 800, letterSpacing: -1.5, color: C.text, lineHeight: 1.05 }}>
          Not videos.<br/>
          <span className="kr-grad-text">Real 3D simulations.</span>
        </h2>
        <p style={{ marginTop: 18, fontSize: 16, color: C.textDim, lineHeight: 1.6, maxWidth: 640, margin: '18px auto 0' }}>
          Hover any card — that's a live WebGL preview, not a screenshot.
          Open the lab to drag, rotate, click parts, slide controls.
        </p>
      </ScrollHeadline>

      <div className="kr-labs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
        {labs.map((lab, i) => <LabCard3D key={i} {...lab} delay={i * 0.07} />)}
      </div>

      <motion.div {...fadeUp(0.1)} style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: C.textFaint }}>
        + 9 more labs across Physics, Chemistry, Biology, Math, and Space
      </motion.div>
    </Section>
  )
}

// One lab card with a live R3F preview embedded.
// Entrance is a cinematic emerge-from-darkness: scale 0.85 + 3D Y-rotate +
// blur-to-focus. Each card staggers 100ms behind the previous one.
function LabCard3D({ name, subject, icon: I, tint, variant, delay }: {
  name: string; subject: string; icon: any; tint: string; variant: LabVariant; delay: number
}) {
  const [hover, setHover] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.88, rotateY: -8, filter: 'blur(18px)' }}
      whileInView={{ opacity: 1, y: 0, scale: 1, rotateY: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ delay, duration: 1.0, ease: [0.21, 0.86, 0.41, 1] as any }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        aspectRatio: '4/3',
        borderRadius: 16,
        overflow: 'hidden',
        border: `1px solid ${hover ? `${tint}55` : C.border}`,
        background: `linear-gradient(135deg, ${tint}10 0%, transparent 55%), ${C.panel}`,
        transition: 'transform .4s cubic-bezier(.2,.6,.2,1), border-color .4s ease, box-shadow .4s ease',
        transform: hover ? 'translateY(-4px) scale(1.005)' : 'none',
        boxShadow: hover
          ? `0 32px 80px ${tint}33, 0 0 0 1px ${tint}22 inset`
          : `0 10px 28px rgba(0,0,0,0.4)`,
        transformStyle: 'preserve-3d',
        perspective: '1000px',
      }}>
      {/* 3D preview */}
      <LabPreview3D variant={variant} tint={tint} />

      {/* Tint radial halo */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(circle at 50% 50%, ${tint}1f 0%, transparent 55%)`,
        opacity: hover ? 1 : 0.7,
        transition: 'opacity .4s ease',
      }}/>

      {/* Bottom-left badge stack */}
      <div style={{
        position: 'absolute', left: 18, bottom: 18, right: 18,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        pointerEvents: 'none', zIndex: 2,
      }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: tint, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            {subject}
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: C.text, marginTop: 4, letterSpacing: -0.2 }}>
            {name}
          </div>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: `${tint}22`, border: `1px solid ${tint}44`,
          display: 'grid', placeItems: 'center',
          backdropFilter: 'blur(6px)',
          boxShadow: hover ? `0 0 18px ${tint}80` : `0 0 8px ${tint}44`,
          transition: 'box-shadow .4s ease',
        }}>
          <I size={16} color={tint} />
        </div>
      </div>

      {/* Live indicator dot */}
      <div style={{
        position: 'absolute', top: 14, right: 14, zIndex: 2,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 9px', borderRadius: 999,
        background: 'rgba(6,6,10,0.55)', backdropFilter: 'blur(8px)',
        border: `1px solid ${C.borderSoft}`,
        fontSize: 9.5, fontWeight: 700, color: C.purple,
        letterSpacing: 1.4, textTransform: 'uppercase',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: C.purple, boxShadow: `0 0 8px ${C.purple}`,
          animation: 'kr-pulse 2s ease-in-out infinite',
        }}/>
        Live
      </div>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ADAPTATION
// ════════════════════════════════════════════════════════════════════════════
function AdaptationSection() {
  return (
    <Section>
      <ScrollHeadline eyebrow="Adaptive intelligence" maxWidth={820}>
        <h2 className="kr-h2" style={{ margin: 0, fontSize: 56, fontWeight: 800, letterSpacing: -1.5, color: C.text, lineHeight: 1.05 }}>
          Kairo <span className="kr-grad-text">learns you</span>.<br/>
          Then teaches you back.
        </h2>
      </ScrollHeadline>

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
          <stop offset="100%" stopColor="#c4b5fd"/>
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
      <ScrollHeadline eyebrow="One platform · four roles">
        <h2 className="kr-h2" style={{ margin: 0, fontSize: 56, fontWeight: 800, letterSpacing: -1.5, color: C.text, lineHeight: 1.05 }}>
          A connected <span className="kr-grad-text">ecosystem</span>.
        </h2>
      </ScrollHeadline>

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
      <ScrollHeadline eyebrow="40+ features">
        <h2 className="kr-h2" style={{ margin: 0, fontSize: 56, fontWeight: 800, letterSpacing: -1.5, color: C.text, lineHeight: 1.05 }}>
          One app.<br/>
          <span className="kr-grad-text">Every learning tool you’ll need.</span>
        </h2>
      </ScrollHeadline>

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

        {/* Big interactive brand badge — click for ripple */}
        <div style={{ position: 'relative', marginBottom: 30, display: 'inline-block' }}>
          <InteractiveLogo size={110} />
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
          <MagneticButton onClick={onGetStarted}
            className="kr-btn-glow"
            style={{
              padding: '17px 36px', borderRadius: 13,
              background: GRAD.pill, color: '#fff',
              fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer',
              boxShadow: '0 18px 56px rgba(124,58,237,0.55)',
              alignItems: 'center', gap: 8,
              fontFamily: 'inherit',
            }}>
            Join Kairo <ArrowRight size={18} />
          </MagneticButton>
          <MagneticButton as="a" href="#labs"
            className="kr-btn-glow"
            style={{
              padding: '17px 34px', borderRadius: 13,
              background: 'rgba(255,255,255,0.04)', color: C.text,
              fontWeight: 600, fontSize: 16,
              border: `1px solid ${C.border}`, cursor: 'pointer',
              textDecoration: 'none',
              alignItems: 'center', gap: 8,
              fontFamily: 'inherit', backdropFilter: 'blur(8px)',
            }}>
            <Beaker size={18} color={C.purple} /> Explore Labs
          </MagneticButton>
        </div>
      </motion.div>
    </Section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// FOOTER — premium Apple-style brand strip + powered-by + columns
// ════════════════════════════════════════════════════════════════════════════
function Footer() {
  const support: FooterItem[] = [
    { label: 'System Status',       href: '/status' },
    { label: 'Help Center',         href: '/help' },
    { label: 'Contact Support',     href: '/contact' },
    { label: 'FAQs',                href: '/faqs' },
    { label: 'Bug Reports',         href: '/bugs' },
  ]
  const platform = [
    { label: 'AI Solver',          href: '#solver' },
    { label: 'Kairo Labs',         href: '#labs' },
    { label: 'Adaptive Learning',  href: '/adaptive' },
    { label: 'Memory Brain',       href: '/memory' },
    { label: 'Voice Tutor',        href: '/voice' },
  ]
  const schoolSystem = [
    { label: 'School Dashboard',   href: '/school' },
    { label: 'Parent Mode',        href: '/parent' },
    { label: 'Teacher Tools',      href: '/teacher' },
    { label: 'Student Analytics',  href: '/analytics' },
    { label: 'Homework System',    href: '/homework' },
  ]
  const company: FooterItem[] = [
    { label: 'About Kairo',        href: '/about' },
    { label: 'Careers',            href: '/careers' },
    { label: 'Privacy Policy',     onClick: () => openTerms('privacy') },
    { label: 'Terms of Service',   onClick: () => openTerms('terms') },
    { label: 'Community',          href: '/community' },
  ]

  return (
    <footer style={{
      position: 'relative',
      paddingTop: 80, paddingBottom: 32,
      borderTop: `1px solid ${C.borderSoft}`,
      background:
        `radial-gradient(at 12% 0%, rgba(124,58,237,0.10) 0%, transparent 45%),
         radial-gradient(at 88% 100%, rgba(91,33,182,0.10) 0%, transparent 50%),
         linear-gradient(180deg, transparent 0%, rgba(6,6,10,0.7) 50%, ${C.bg} 100%)`,
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>

        {/* Top brand row */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 40, flexWrap: 'wrap', paddingBottom: 56,
          borderBottom: `1px solid ${C.borderSoft}`,
        }}>
          <div style={{ maxWidth: 380 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <InteractiveLogo size={48} />
              <span className="kr-grad-text" style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.8 }}>
                Kairo
              </span>
            </div>
            <p style={{
              marginTop: 14, marginBottom: 0,
              fontSize: 14, color: C.textDim, lineHeight: 1.65,
            }}>
              The future of intelligent education. Built for Class 9–12 students
              in India — CBSE, ICSE, and state boards.
            </p>
            <div style={{ marginTop: 16, fontSize: 11, color: C.purple, fontWeight: 700, letterSpacing: 2.4, textTransform: 'uppercase' }}>
              Accelerate Your Academics
            </div>
          </div>

          {/* Powered-by strip */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14 }}>
              Powered by
            </div>
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
              {['OpenRouter','Groq','Supabase','Vercel','Three.js'].map((b, i) => (
                <PoweredByChip key={i} name={b} />
              ))}
            </div>
          </div>
        </div>

        {/* Column links — 5-column grid: Support + Contact + Platform + School System + Company */}
        <div className="kr-footer-cols" style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 32,
          padding: '48px 0 40px',
        }}>
          <FooterCol title="Support"        items={support} />
          <FooterContactCol />
          <FooterCol title="Platform"       items={platform} />
          <FooterCol title="School System"  items={schoolSystem} />
          <FooterCol title="Company"        items={company} />
        </div>

        {/* Bottom bar */}
        <div style={{
          paddingTop: 28, borderTop: `1px solid ${C.borderSoft}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 14, flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 11, color: C.textFaint }}>
            © {new Date().getFullYear()} Kairo. Built for Indian classrooms.
          </div>
          <div style={{ display: 'flex', gap: 18 }}>
            {['English (India)', 'हिन्दी (soon)'].map((l, i) => (
              <span key={i} style={{ fontSize: 11, color: C.textFaint, letterSpacing: 0.2 }}>{l}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile column collapse */}
      <style>{`
        @media (max-width: 1024px) {
          .kr-footer-cols {
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 28px !important;
          }
        }
        @media (max-width: 640px) {
          .kr-footer-cols {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 420px) {
          .kr-footer-cols { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </footer>
  )
}

// Contact column — single email card with copy-to-clipboard on click
function FooterContactCol() {
  const [copied, setCopied] = useState(false)
  const email = 'quro.cor@gmail.com'
  function copy() {
    if (typeof navigator === 'undefined') return
    navigator.clipboard?.writeText(email).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }).catch(() => {})
  }
  return (
    <div>
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: C.textFaint,
        textTransform: 'uppercase', letterSpacing: 2, marginBottom: 18,
      }}>
        Contact
      </div>

      <button
        onClick={copy}
        style={{
          background: 'rgba(124,58,237,0.06)',
          border: `1px solid ${C.borderSoft}`,
          borderRadius: 12,
          padding: '12px 14px',
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: C.text,
          transition: 'all .25s ease',
          position: 'relative',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'rgba(167,139,250,0.45)'
          e.currentTarget.style.boxShadow = '0 0 22px rgba(124,58,237,0.25)'
          e.currentTarget.style.background = 'rgba(124,58,237,0.10)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = C.borderSoft
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.background = 'rgba(124,58,237,0.06)'
        }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: C.purple, textTransform: 'uppercase', letterSpacing: 1.6 }}>
          {copied ? 'Copied ✓' : 'Email us'}
        </div>
        <div style={{ fontSize: 13, marginTop: 4, color: C.text, fontWeight: 600, overflowWrap: 'anywhere' }}>
          {email}
        </div>
      </button>

      <p style={{
        marginTop: 12, marginBottom: 0,
        fontSize: 11, color: C.textFaint, lineHeight: 1.6,
      }}>
        Replies usually within 24h.
      </p>
    </div>
  )
}

type FooterItem = { label: string; href?: string; onClick?: () => void }

function FooterCol({ title, items }: { title: string; items: FooterItem[] }) {
  const baseStyle: React.CSSProperties = {
    fontSize: 13, color: C.textDim, textDecoration: 'none',
    transition: 'color .2s ease',
    background: 'transparent', border: 'none', padding: 0,
    fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
  }
  return (
    <div>
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: C.textFaint,
        textTransform: 'uppercase', letterSpacing: 2, marginBottom: 18,
      }}>
        {title}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((it, i) => (
          <li key={i}>
            {it.onClick ? (
              <button onClick={it.onClick} style={baseStyle}
                onMouseEnter={e => (e.currentTarget.style.color = C.purple)}
                onMouseLeave={e => (e.currentTarget.style.color = C.textDim)}>
                {it.label}
              </button>
            ) : (
              <a href={it.href} style={baseStyle}
                onMouseEnter={e => (e.currentTarget.style.color = C.purple)}
                onMouseLeave={e => (e.currentTarget.style.color = C.textDim)}>
                {it.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Powered-by chip: text in light grey, gentle purple glow on hover.
// Monochrome (no logo image) keeps the strict palette.
function PoweredByChip({ name }: { name: string }) {
  return (
    <a href="#" onClick={e => e.preventDefault()}
      style={{
        fontSize: 13, fontWeight: 600, color: C.textDim,
        letterSpacing: 0.2,
        padding: '7px 12px', borderRadius: 8,
        border: `1px solid ${C.borderSoft}`,
        background: 'rgba(124,58,237,0.03)',
        textDecoration: 'none',
        transition: 'all .25s ease',
        display: 'inline-flex', alignItems: 'center', gap: 7,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = C.text
        e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)'
        e.currentTarget.style.boxShadow = '0 0 18px rgba(124,58,237,0.25)'
        e.currentTarget.style.background = 'rgba(124,58,237,0.08)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = C.textDim
        e.currentTarget.style.borderColor = C.borderSoft
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.background = 'rgba(124,58,237,0.03)'
      }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: C.purpleSoft,
        boxShadow: `0 0 6px ${C.purple}`,
      }}/>
      {name}
    </a>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// INTERACTIVE LOGO — Kairo brand mark that ripples on click, glows on hover
// ════════════════════════════════════════════════════════════════════════════
function InteractiveLogo({ size = 48 }: { size?: number }) {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([])
  const [hover, setHover] = useState(false)
  const idRef = useRef(0)

  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const id = ++idRef.current
    setRipples(prev => [...prev, { id, x, y }])
    setTimeout(() => setRipples(prev => prev.filter(p => p.id !== id)), 900)
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        position: 'relative',
        width: size, height: size,
        cursor: 'pointer',
        display: 'inline-block',
        transition: 'transform .25s cubic-bezier(.2,.6,.2,1)',
        transform: hover ? 'scale(1.08)' : 'scale(1)',
      }}>
      <KairoBadge size={size} intense={hover} animated />

      {/* Ripple energy waves */}
      {ripples.map(r => (
        <span key={r.id} style={{
          position: 'absolute',
          left: r.x, top: r.y,
          width: 0, height: 0,
          borderRadius: '50%',
          border: `2px solid ${C.purple}`,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          animation: 'kr-ripple 0.9s ease-out forwards',
          boxShadow: `0 0 16px ${C.purple}88`,
        }}/>
      ))}

      <style>{`
        @keyframes kr-ripple {
          0%   { width: 0;   height: 0;   opacity: 1; border-width: 2px; }
          100% { width: ${size * 2.4}px; height: ${size * 2.4}px; opacity: 0; border-width: 0.5px; }
        }
      `}</style>
    </div>
  )
}
