/**
 * Kyno — Landing.
 *
 * Hybrid design system (no random mixing):
 *
 *   Swiss          → foundation: 12-col grid, asymmetric spacing,
 *                    strict typographic hierarchy, alignment precision.
 *   Editorial      → storytelling: oversized type, drop caps, pull quotes,
 *                    section numbers, issue/date metadata.
 *   Bento          → content structure: feature cards in an asymmetric
 *                    grid with deliberately varying spans.
 *   Constructivist → composition: diagonal accents, rotated labels,
 *                    intersecting rules, motion lines.
 *   Brutalist      → personality: oversized statements, full-bleed
 *                    impact moments, hard contrast.
 *
 * Strict monochrome: BLACK · DEEP PURPLE · WHITE.
 * Accent: soft purple glow only — no rainbow gradients, no other hues.
 */
import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform, useSpring } from 'framer-motion'
import { openTerms } from '../components/Terms'

// ─── Mobile guard ────────────────────────────────────────────────────────────
// Disables parallax on phones so touch + scroll behave normally. Without this
// the dramatic drifts (e.g. -18%→+12%) push content under the user's finger
// and intercept gestures.
function useIsMobileViewport(breakpoint = 768) {
  const [m, setM] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < breakpoint)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onR = () => setM(window.innerWidth < breakpoint)
    window.addEventListener('resize', onR, { passive: true })
    return () => window.removeEventListener('resize', onR)
  }, [breakpoint])
  return m
}

// Helper to pick mobile-safe range (all zeros) vs desktop range.
function pxRange(mobile: boolean, range: [string, string]): [string, string] {
  return mobile ? ['0%', '0%'] : range
}
import {
  ArrowRight, ArrowDown, Sparkles, Brain, Beaker, Atom, BookOpen,
  Mic, Network, Activity, Camera, Compass, Zap, Eye,
} from 'lucide-react'

// ════════════════════════════════════════════════════════════════════════════
// TOKENS — strictly BLACK · DEEP PURPLE · WHITE
// ════════════════════════════════════════════════════════════════════════════
const C = {
  black:       '#000000',
  ink:         '#050505',   // pure dark paper
  paper:       '#050505',   // page bg (slightly lifted)
  panel:       '#101018',   // card bg
  panel2:      '#151922',   // card bg, elevated
  line:        'rgba(255,255,255,0.06)',   // hairline border
  lineSoft:    '#15151e',
  lineHi:      'rgba(255,255,255,0.10)',

  white:       '#ffffff',
  paperLight:  '#fafafa',
  text:        '#ffffff',
  textDim:     '#CBD5E1',
  textFaint:   '#9CA3AF',
  textVery:    '#6B7280',

  purpleLite:  '#DBE7FF',
  purpleSoft:  '#A5B4FC',
  purple:      '#66D9FF',   // primary accent
  purpleHi:    '#4F7CFF',
  purpleDeep:  '#2046C2',
  purpleInk:   '#0B1530',
}

// Typography
const DISPLAY = "'Inter Tight', 'Inter', 'Neue Haas Grotesk Display', 'Helvetica Neue', system-ui, sans-serif"
const SERIF   = "'Charter', 'Iowan Old Style', 'Source Serif Pro', Georgia, serif"
const MONO    = "ui-monospace, 'SF Mono', 'Fira Code', 'JetBrains Mono', Menlo, monospace"
const SANS    = "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"

interface LandingProps {
  onGetStarted: () => void
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════
export default function Landing({ onGetStarted }: LandingProps) {
  return (
    <div style={{
      background: C.ink, color: C.text, fontFamily: SANS,
      width: '100%', minHeight: '100vh',
      overflowX: 'hidden',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale' as any,
    }}>
      <GlobalStyles />
      <GrainOverlay />
      <PurpleHalo />
      <GlobalScrollLayer />

      <Masthead onGetStarted={onGetStarted} />
      <Hero onGetStarted={onGetStarted} />
      <Manifesto />
      <BrutalDivider lines={['STOP', 'MEMORIZING.']} kicker="—" tail={['START', 'UNDERSTANDING.']} />
      <BentoSection onGetStarted={onGetStarted} />
      <ConstructivistInterstitial />
      <LabsShowcase />
      <TwinEssay />
      <DesktopApp />
      <AboutFounder />
      <FinalCTA onGetStarted={onGetStarted} />
      <Footer />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// GLOBAL SCROLL LAYER — page-wide continuous parallax that runs underneath
// every section. Two giant ghost wordmarks counter-drift the entire scroll
// length, plus a slow gradient field that breathes with page progress.
// This is what makes the WHOLE page feel parallax, not just each section.
// ════════════════════════════════════════════════════════════════════════════
function GlobalScrollLayer() {
  const mobile = useIsMobileViewport()
  const { scrollYProgress } = useScroll()
  // KYNO ghost drifts left as you scroll, ACADEMICS drifts right.
  const kx = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['8%',  '-22%']))
  const ax = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['-12%', '18%']))
  // Each band fades in and out at different scroll depths.
  const ko = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.04, 0.10, 0.06, 0.02])
  const ao = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.02, 0.06, 0.10, 0.05])

  // Mobile: skip the fixed-position giant ghost text entirely. It eats touch
  // even with pointer-events:none on some browsers and makes the page feel
  // unresponsive.
  if (mobile) return null

  return (
    <div aria-hidden style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
      overflow: 'hidden',
    }}>
      <motion.div style={{
        position: 'absolute', top: '12%', left: '50%',
        translateX: '-50%',
        x: kx,
        opacity: ko,
        fontFamily: DISPLAY, fontSize: 'min(50vw, 720px)',
        fontWeight: 900, letterSpacing: '-0.09em', color: C.purpleInk,
        whiteSpace: 'nowrap',
      }}>
        KYNO
      </motion.div>
      <motion.div style={{
        position: 'absolute', bottom: '8%', left: '50%',
        translateX: '-50%',
        x: ax,
        opacity: ao,
        fontFamily: DISPLAY, fontSize: 'min(38vw, 540px)',
        fontWeight: 900, letterSpacing: '-0.08em', color: C.purpleInk,
        whiteSpace: 'nowrap',
      }}>
        ACADEMICS
      </motion.div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// LAYERS — grain + halo for editorial / brutalist texture
// ════════════════════════════════════════════════════════════════════════════
function GrainOverlay() {
  return (
    <div aria-hidden style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1,
      opacity: 0.32, mixBlendMode: 'overlay',
      backgroundImage:
        'url("data:image/svg+xml;utf8,<svg viewBox=%270 0 100 100%27 xmlns=%27http://www.w3.org/2000/svg%27><filter id=%27n%27><feTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 stitchTiles=%27stitch%27/><feColorMatrix values=%270 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.32 0%27/></filter><rect width=%27100%27 height=%27100%27 filter=%27url(%23n)%27/></svg>")',
    }} />
  )
}

function PurpleHalo() {
  return (
    <div aria-hidden style={{
      position: 'fixed', top: '-20vh', left: '50%', transform: 'translateX(-50%)',
      width: '120vw', height: '80vh', borderRadius: '50%',
      background: `radial-gradient(60% 60% at 50% 30%, rgba(79, 124, 255, 0.22) 0%, rgba(32, 70, 194, 0.05) 35%, transparent 70%)`,
      pointerEvents: 'none', zIndex: 0,
      filter: 'blur(30px)',
    }} />
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MASTHEAD — Swiss minimal, editorial issue strip
// ════════════════════════════════════════════════════════════════════════════
function Masthead({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      background: 'rgba(6,6,10,0.72)',
      borderBottom: `1px solid ${C.line}`,
    }}>
      <Container>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          padding: '14px 0',
          gap: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <KairoMark size={28} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontFamily: DISPLAY, fontSize: 14, fontWeight: 800, letterSpacing: -0.3 }}>
                KYNO
              </span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: C.textFaint, letterSpacing: 2 }}>
                KAIRO INDUSTRIES
              </span>
            </div>
          </div>

          <nav style={{
            display: 'flex', gap: 28,
            fontFamily: MONO, fontSize: 11, color: C.textFaint,
            letterSpacing: 1.6, textTransform: 'uppercase',
          }} className="kr-masthead-nav">
            {[
              ['01', 'Manifesto'],
              ['02', 'Product'],
              ['03', 'Labs'],
              ['04', 'Twin'],
            ].map(([n, label]) => (
              <span key={n} style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline' }}>
                <span style={{ color: C.purple }}>{n}</span>
                <span>{label}</span>
              </span>
            ))}
          </nav>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontFamily: MONO, fontSize: 10, color: C.textVery, letterSpacing: 1.8,
            }} className="kr-issue-strip">
              ISSUE №01 · MAY 2026
            </span>
            <button onClick={onGetStarted} style={pillCta}>
              Get started <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </Container>
    </header>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// HERO — editorial + brutalist
// ════════════════════════════════════════════════════════════════════════════
function Hero({ onGetStarted }: { onGetStarted: () => void }) {
  const mobile = useIsMobileViewport()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const headlineY = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['0%', '-30%']))
  const headlineO = useTransform(scrollYProgress, [0, 0.8], mobile ? [1, 1] : [1, 0.4])
  // Counter-parallax on the two giant lines — same technique as the brutal divider.
  const line1X    = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['0%', '-14%']))
  const line2X    = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['0%', '16%']))
  const kineticX  = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['0%', '12%']))
  const subX      = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['0%', '-6%']))

  return (
    <section ref={ref} style={{ position: 'relative', paddingTop: 80, paddingBottom: 160, zIndex: 2 }}>
      <Container>

        {/* Issue strip */}
        <SwissRow>
          <SwissCell span={4}>
            <Eyebrow num="00" label="Cover Story" />
          </SwissCell>
          <SwissCell span={4} centerCol />
          <SwissCell span={4} align="right">
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.textFaint, letterSpacing: 2 }}>
              Vol. 1  ·  9 sections
            </span>
          </SwissCell>
        </SwissRow>

        {/* Tagline + headline.
            NOTE: we deliberately do NOT set initial/animate here. Mixing an
            entrance animation with `style: { opacity: motionValue }` causes
            Framer to leave opacity stuck at the `initial` value on first
            paint — the hero went invisible. Scroll-bound y + opacity below
            handle the motion; the headline just appears immediately. */}
        <motion.div
          style={{ y: headlineY, opacity: headlineO, marginTop: 60 }}
        >
          <SwissRow>
            <SwissCell span={9}>
              <div style={{
                fontFamily: MONO, fontSize: 12, color: C.purple,
                letterSpacing: 3, textTransform: 'uppercase', marginBottom: 32,
              }}>
                — Gear Up Your Acceleration
              </div>

              <motion.h1 className="kr-display" style={{
                fontFamily: DISPLAY, margin: 0,
                fontSize: 'clamp(72px, 13vw, 200px)',
                lineHeight: 0.92, letterSpacing: '-0.045em', fontWeight: 800,
                color: C.text,
                x: line1X,
              }}>
                KYNO
              </motion.h1>

              {/* Brutal divider */}
              <div style={{
                width: 220, height: 4,
                background: C.purple,
                margin: '32px 0',
                boxShadow: `0 0 22px ${C.purpleHi}88`,
              }} />

              <motion.h2 className="kr-display" style={{
                fontFamily: DISPLAY, margin: 0,
                fontSize: 'clamp(40px, 6.5vw, 104px)',
                lineHeight: 0.96, letterSpacing: '-0.04em', fontWeight: 800,
                x: line2X,
              }}>
                <span style={{ color: C.text }}>LEARN FASTER. THINK SMARTER. </span>
                <span style={{
                  background: `linear-gradient(180deg, ${C.purpleLite} 0%, ${C.purple} 50%, ${C.purpleHi} 100%)`,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>ACHIEVE MORE.</span>
              </motion.h2>
            </SwissCell>

            <SwissCell span={3}>
              <RotatedLabel text="EDITION · ONE" />
            </SwissCell>
          </SwissRow>
        </motion.div>

        {/* Sub + CTAs */}
        <motion.div style={{ marginTop: 64, x: subX }}>
          <SwissRow>
            <SwissCell span={6}>
              <p style={{
                fontFamily: SANS, fontSize: 19, lineHeight: 1.55, color: C.textDim,
                margin: 0, maxWidth: 560,
              }}>
                An AI that <em style={{ color: C.text, fontStyle: 'normal', borderBottom: `1px solid ${C.purple}` }}>understands every learner</em> —
                what you've forgotten, what you keep missing, the moment you're about to need it next.
                Built by <span style={{ color: C.text, fontWeight: 700 }}>Darshan</span>, Founder &amp; CEO of{' '}
                <span style={{ color: C.text, fontWeight: 700 }}>Kairo Industries</span>.
              </p>

              <div style={{ display: 'flex', gap: 18, marginTop: 32, flexWrap: 'wrap' }}>
                <button onClick={onGetStarted} style={bigCta}>
                  Start Learning
                  <ArrowRight size={16} />
                </button>
                <button onClick={() => scrollToId('manifesto')} style={ghostCta}>
                  <ArrowDown size={14} />
                  Explore Kyno
                </button>
              </div>
            </SwissCell>

            <SwissCell span={6}>
              <motion.div style={{ x: kineticX }}>
                <KineticBlock />
              </motion.div>
            </SwissCell>
          </SwissRow>
        </motion.div>

      </Container>

      {/* Page-number bottom corner */}
      <div style={{
        position: 'absolute', bottom: 24, right: 32,
        fontFamily: MONO, fontSize: 10, color: C.textVery,
        letterSpacing: 2.4, textTransform: 'uppercase',
      }}>
        p. 01 · scroll for more
      </div>
    </section>
  )
}

// Kinetic geometric block — the constructivist "moving piece" beside the hero.
function KineticBlock() {
  return (
    <div style={{
      position: 'relative', height: 420, marginTop: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Centre purple disc */}
      <motion.div
        animate={{ scale: [1, 1.06, 1], opacity: [0.92, 1, 0.92] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'relative', width: 280, height: 280, borderRadius: '50%',
          background:
            `radial-gradient(circle at 35% 30%, ${C.purpleSoft} 0%, ${C.purple} 30%, ${C.purpleDeep} 75%, ${C.purpleInk} 100%)`,
          boxShadow: `0 0 80px ${C.purpleHi}55, 0 0 200px ${C.purpleHi}33, inset 0 0 60px rgba(0,0,0,0.4)`,
          zIndex: 2,
        }}>
        <KairoMark size={80} centered intense />
      </motion.div>

      {/* Constructivist orbital rings + diagonals */}
      <svg viewBox="-200 -200 400 400" width="100%" height="100%"
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {[160, 180].map((r, i) => (
          <circle key={i} cx="0" cy="0" r={r}
            fill="none"
            stroke={i === 0 ? C.purple : C.purpleDeep}
            strokeWidth={i === 0 ? 0.6 : 0.4}
            opacity={i === 0 ? 0.55 : 0.3}
            strokeDasharray={i === 0 ? '2 8' : '6 4'} />
        ))}
        <line x1="-180" y1="-180" x2="180"  y2="180"
          stroke={C.purpleDeep} strokeWidth="0.5" opacity="0.45" />
        <line x1="-180" y1="180"  x2="180"  y2="-180"
          stroke={C.purpleDeep} strokeWidth="0.5" opacity="0.25" />
      </svg>

      {/* Rotated metadata labels */}
      <div style={{
        position: 'absolute', top: 6, left: 0,
        fontFamily: MONO, fontSize: 9.5, color: C.textFaint, letterSpacing: 2.4,
      }}>
        MEMORY ENGINE · V.2026
      </div>
      <div style={{
        position: 'absolute', bottom: 6, right: 0,
        fontFamily: MONO, fontSize: 9.5, color: C.textFaint, letterSpacing: 2.4,
      }}>
        ◐ ACTIVE
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MANIFESTO — editorial essay, drop-cap, pull-quote (scroll-linked drift)
// ════════════════════════════════════════════════════════════════════════════
function Manifesto() {
  const mobile = useIsMobileViewport()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const line1X = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['-15%', '10%']))
  const line2X = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['18%', '-12%']))
  const metaY  = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['28%', '-18%']))
  const ghostX = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['12%', '-10%']))
  const quoteX = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['14%', '-10%']))
  const bodyX  = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['-4%', '3%']))

  return (
    <section ref={ref} id="manifesto" style={{ padding: '120px 0 100px', position: 'relative', zIndex: 2, overflow: 'hidden' }}>
      {/* Ghost watermark behind the headline — louder, larger, more visible drift */}
      <motion.div aria-hidden style={{
        position: 'absolute', top: '30%', left: '50%',
        translateX: '-50%',
        x: ghostX,
        fontFamily: DISPLAY, fontSize: 'min(36vw, 480px)',
        fontWeight: 900, letterSpacing: '-0.09em', color: C.purpleInk,
        opacity: 0.22, pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        MANIFESTO
      </motion.div>

      <Container>
        <SwissRow>
          <SwissCell span={3}>
            <motion.div style={{ y: metaY }}>
              <Eyebrow num="01" label="The Manifesto" />
              <div style={{
                fontFamily: MONO, fontSize: 10, color: C.textVery,
                letterSpacing: 2, marginTop: 14, lineHeight: 1.6,
              }}>
                FILED · MAY 2026
                <br />
                FOR ISSUE Nº 01
                <br />
                WORDS · K. EDITORIAL
              </div>
            </motion.div>
          </SwissCell>

          <SwissCell span={9}>
            <h3 className="kr-headline" style={{
              fontFamily: DISPLAY, fontSize: 'clamp(34px, 4.6vw, 64px)',
              lineHeight: 1.02, letterSpacing: '-0.02em', fontWeight: 700,
              margin: '0 0 48px', color: C.text, maxWidth: 880,
            }}>
              <motion.span style={{ x: line1X, display: 'inline-block' }}>
                Every student in India is taught the same way.
              </motion.span>
              <br />
              <motion.span style={{ x: line2X, color: C.purpleSoft, display: 'inline-block' }}>
                Kyno notices that you aren't.
              </motion.span>
            </h3>

            {/* Two-column body — subtle scroll-linked drift opposite to headline */}
            <motion.div className="kr-two-col" style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 56,
              fontFamily: SERIF, fontSize: 17, lineHeight: 1.7,
              color: C.textDim,
              x: bodyX,
            }}>
              <div>
                <DropCap letter="W" />hen a board paper lands on your desk in March, the questions don't care what you forgot in November. The textbook is the same for forty million students. The teacher will tell you to revise. The coaching centre will sell you a planner. None of them know which formula left your head two Wednesdays ago.
                <p style={{ margin: '16px 0' }}>
                  Kyno is built on a different assumption — that the part of school that <em style={{ color: C.text }}>matters</em> isn't the content. It's the conversation between content and you. Between a chapter and your particular Wednesday.
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 16px' }}>
                  So we built a memory engine. Not for the textbook, but for <em style={{ color: C.text }}>you</em>. It watches what you ask, where you stumble, what you replay at 1 a.m. It remembers the formula you Googled, the question you flagged for review, the diagram you stared at for forty seconds.
                </p>
                <p style={{ margin: 0 }}>
                  Then it tutors you back. With explanations only you needed. With flashcards that come back at the moment you're about to forget. With a study plan that reshapes itself when life gets in the way. This is the Twin. This is Kyno.
                </p>
              </div>
            </motion.div>

            <motion.div style={{ x: quoteX }}>
              <PullQuote
                text={`“Kyno doesn’t teach the textbook. It teaches the person reading it.”`}
                attribution={`— Editor’s note`}
              />
            </motion.div>
          </SwissCell>
        </SwissRow>
      </Container>
    </section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// BRUTAL DIVIDER — full-bleed, oversized statement
// ════════════════════════════════════════════════════════════════════════════
function BrutalDivider({ lines, kicker, tail }: {
  lines: string[]
  kicker?: string
  tail?: string[]
}) {
  const mobile = useIsMobileViewport()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const lx = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['-12%', '6%']))
  const tx = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['8%', '-10%']))

  return (
    <section ref={ref} style={{
      padding: '120px 0 140px',
      borderTop: `1px solid ${C.lineHi}`,
      borderBottom: `1px solid ${C.lineHi}`,
      background:
        `linear-gradient(180deg, ${C.paper} 0%, ${C.ink} 50%, ${C.paper} 100%)`,
      position: 'relative', overflow: 'hidden', zIndex: 2,
    }}>
      {/* Big watermark KYNO */}
      <div aria-hidden style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        fontFamily: DISPLAY, fontSize: 'min(36vw, 460px)',
        fontWeight: 900, letterSpacing: '-0.08em', color: C.purpleInk,
        opacity: 0.16, pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        STOP·START
      </div>

      <Container>
        <motion.h2 style={{ x: lx }}
          className="kr-brutal"
        >
          {lines.map((l, i) => (
            <div key={i} style={{ fontFamily: DISPLAY, fontWeight: 900 }}>{l}</div>
          ))}
        </motion.h2>

        {kicker && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, margin: '22px 0', justifyContent: 'center' }}>
            <span style={{ width: 60, height: 1, background: C.purple }} />
            <span style={{ fontFamily: MONO, fontSize: 13, color: C.purple, letterSpacing: 3 }}>
              {kicker}
            </span>
            <span style={{ width: 60, height: 1, background: C.purple }} />
          </div>
        )}

        {tail && (
          <motion.h2 style={{ x: tx }}
            className="kr-brutal"
          >
            {tail.map((l, i) => (
              <div key={i} style={{ fontFamily: DISPLAY, fontWeight: 900, color: C.purpleSoft }}>
                {l}
              </div>
            ))}
          </motion.h2>
        )}
      </Container>
    </section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// BENTO — asymmetric feature grid (scroll-linked drift)
// ════════════════════════════════════════════════════════════════════════════
function BentoSection({ onGetStarted }: { onGetStarted: () => void }) {
  const mobile = useIsMobileViewport()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const head1X = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['-14%', '8%']))
  const head2X = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['16%', '-10%']))
  const ghostX = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['14%', '-12%']))
  const bentoY = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['8%', '-8%']))
  // Bento cards drift in alternating directions for kinetic depth.
  const driftL = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['0%', '-6%']))
  const driftR = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['0%', '6%']))

  return (
    <section ref={ref} id="product" style={{ padding: '120px 0 100px', position: 'relative', zIndex: 2, overflow: 'hidden' }}>
      <motion.div aria-hidden style={{
        position: 'absolute', top: '6%', left: '50%',
        translateX: '-50%',
        x: ghostX,
        fontFamily: DISPLAY, fontSize: 'min(38vw, 500px)',
        fontWeight: 900, letterSpacing: '-0.09em', color: C.purpleInk,
        opacity: 0.20, pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        BENTO
      </motion.div>

      <Container>
        <SwissRow>
          <SwissCell span={3}>
            <Eyebrow num="02" label="The Product" />
          </SwissCell>
          <SwissCell span={9}>
            <h3 className="kr-headline" style={{
              fontFamily: DISPLAY, fontSize: 'clamp(34px, 4.6vw, 64px)',
              lineHeight: 1.02, letterSpacing: '-0.02em', fontWeight: 700,
              margin: 0, color: C.text, maxWidth: 880,
            }}>
              <motion.span style={{ x: head1X, display: 'inline-block' }}>Eleven systems.</motion.span>
              <br />
              <motion.span style={{ x: head2X, color: C.purpleSoft, display: 'inline-block' }}>One mind.</motion.span>
            </h3>
            <p style={{
              fontFamily: SANS, fontSize: 16.5, lineHeight: 1.65, color: C.textDim,
              maxWidth: 680, marginTop: 22,
            }}>
              Kyno isn't a feature list. Each module is a sense organ for the Twin —
              hearing your doubts, seeing your notebook, remembering your weak spots,
              breathing the syllabus back to you when you need it.
            </p>
          </SwissCell>
        </SwissRow>

        <motion.div className="kr-bento" style={{ marginTop: 72, y: bentoY }}>
          {/* Row 1 — left cluster drifts left, right cluster drifts right */}
          <motion.div style={{ gridColumn: '1 / span 8', gridRow: 'span 2', x: driftL }}>
            <BentoCard span="col 1 / span 8" rowSpan={2} hero
              kicker="01 · Solver" title="Any doubt. Eight seconds."
              body="Type any question. Kyno writes a step-by-step explanation, finds 4–6 relevant images, and pulls one matching video — all under eight seconds."
              icon={Sparkles}
              tag="LIVE · 24/7"
              embedded
            />
          </motion.div>
          <motion.div style={{ gridColumn: '9 / span 4', x: driftR }}>
            <BentoCard span="col 9 / span 4"
              kicker="02 · OS"
              title="Kyno"
              body="The memory engine. Tracks what you've studied, what you've forgotten, and what to do next."
              icon={Atom}
              embedded
            />
          </motion.div>
          <motion.div style={{ gridColumn: '9 / span 4', x: driftR }}>
            <BentoCard span="col 9 / span 4"
              kicker="03 · Voice"
              title="Voice tutor"
              body="Hold to speak. Kyno replies in voice and on-screen text. Hands-free, exam-night ready."
              icon={Mic}
              embedded
            />
          </motion.div>

          {/* Row 2 — left drifts left, mid stays, right drifts right */}
          <motion.div style={{ gridColumn: '1 / span 5', x: driftL }}>
            <BentoCard span="col 1 / span 5"
              kicker="04 · Labs"
              title="3D physics, chem, bio"
              body="Drag, zoom, tweak variables. Diagrams you can touch."
              icon={Beaker}
              visual="lab"
              embedded
            />
          </motion.div>
          <div style={{ gridColumn: '6 / span 4' }}>
            <BentoCard span="col 6 / span 4"
              kicker="05 · Memory"
              title="Memory Brain"
              body="A graph of every concept you've touched, ranked by mastery."
              icon={Brain}
              embedded
            />
          </div>
          <motion.div style={{ gridColumn: '10 / span 3', x: driftR }}>
            <BentoCard span="col 10 / span 3"
              kicker="06 · Notebook"
              title="AI Notebook"
              body="Type. It organises."
              icon={BookOpen}
              compact
              embedded
            />
          </motion.div>

          {/* Row 3 — left drifts left, right drifts right */}
          <motion.div style={{ gridColumn: '1 / span 3', x: driftL }}>
            <BentoCard span="col 1 / span 3"
              kicker="07 · Predictor"
              title="Exam Predictor"
              body="Probability-ranked questions for next month's paper."
              icon={Activity}
              compact
              embedded
            />
          </motion.div>
          <div style={{ gridColumn: '4 / span 4' }}>
            <BentoCard span="col 4 / span 4"
              kicker="08 · Concepts"
              title="Concept Map"
              body="Drag the whole syllabus around like a metro map."
              icon={Network}
              embedded
            />
          </div>
          <motion.div style={{ gridColumn: '8 / span 5', x: driftR }}>
            <BentoCard span="col 8 / span 5"
              kicker="09 · Camera Study"
              title="Point at a textbook."
              body="Snap a page. Kyno explains the question on it, step by step, with diagrams pulled in."
              icon={Camera}
              embedded
            />
          </motion.div>
        </motion.div>

        <div style={{ marginTop: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 24 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.textVery, letterSpacing: 2 }}>
            + 22 MORE TOOLS LIVE IN PRODUCTION
          </span>
          <button onClick={onGetStarted} style={bigCta}>
            See them inside Kyno <ArrowRight size={16} />
          </button>
        </div>
      </Container>
    </section>
  )
}

function BentoCard({ span, rowSpan = 1, hero = false, compact = false,
                    kicker, title, body, icon: Icon, tag, visual, embedded = false,
}: {
  span: string
  rowSpan?: number
  hero?: boolean
  compact?: boolean
  kicker: string
  title: string
  body: string
  icon?: any
  tag?: string
  visual?: 'lab'
  /** When true, the card lives INSIDE a parallax wrapper that already owns
   *  grid placement. Skip our own grid-column/row so it inherits 100% of
   *  the wrapper's box. */
  embedded?: boolean
}) {
  const [hover, setHover] = useState(false)
  return (
    <motion.div
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 200, damping: 22 }}
      style={{
        ...(embedded
          ? { width: '100%', height: '100%' }
          : { gridColumn: span.replace('col ', ''), gridRow: `span ${rowSpan}` }),
        background: hero
          ? `linear-gradient(140deg, ${C.purpleInk} 0%, ${C.panel} 60%, ${C.ink} 100%)`
          : C.panel,
        border: `1px solid ${hover ? 'rgba(102, 217, 255, 0.35)' : C.line}`,
        borderRadius: 22, padding: hero ? '36px 38px 32px' : compact ? '22px' : '28px 28px 24px',
        display: 'flex', flexDirection: 'column', gap: 14,
        position: 'relative', overflow: 'hidden',
        transition: 'border-color .25s',
        minHeight: hero ? 0 : compact ? 160 : 220,
        boxShadow: hover ? `0 12px 50px rgba(79, 124, 255, 0.18)` : '0 0 0 transparent',
      }}>
      {/* Constructivist corner cut */}
      <span aria-hidden style={{
        position: 'absolute', top: 0, right: 0, width: 28, height: 28,
        background: `linear-gradient(225deg, transparent 50%, ${C.lineHi} 50%)`,
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{
          fontFamily: MONO, fontSize: 10, letterSpacing: 2.2, color: C.purpleSoft,
          textTransform: 'uppercase',
        }}>
          {kicker}
        </span>
        {tag && (
          <span style={{
            fontFamily: MONO, fontSize: 9, color: C.purple,
            border: `1px solid ${C.purpleDeep}`, padding: '3px 7px', borderRadius: 4,
            letterSpacing: 1.5,
          }}>
            {tag}
          </span>
        )}
      </div>

      <h4 className="kr-bento-title" style={{
        fontFamily: DISPLAY, margin: 0, fontWeight: 700,
        fontSize: hero ? 'clamp(28px, 3.4vw, 48px)' : compact ? 19 : 22,
        lineHeight: 1.06, letterSpacing: '-0.025em', color: C.text,
      }}>
        {title}
      </h4>

      <p style={{
        margin: 0, fontFamily: SANS, color: C.textDim,
        fontSize: hero ? 16.5 : compact ? 13 : 14, lineHeight: 1.55,
        maxWidth: hero ? 560 : '100%',
      }}>
        {body}
      </p>

      {/* Lab visual filler */}
      {visual === 'lab' && (
        <div style={{
          marginTop: 'auto', height: 80, borderRadius: 14,
          background: `radial-gradient(80% 120% at 50% 50%, ${C.purpleDeep} 0%, ${C.panel2} 60%, transparent 100%)`,
          border: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Beaker size={28} color={C.purpleSoft} style={{ opacity: 0.7 }} />
        </div>
      )}

      {/* Icon — top-right when hero, bottom-right otherwise */}
      {Icon && (
        <div style={{
          position: 'absolute',
          ...(hero ? { top: 30, right: 36 } : { bottom: 22, right: 22 }),
          width: hero ? 56 : 36, height: hero ? 56 : 36, borderRadius: hero ? 14 : 10,
          background: `linear-gradient(135deg, ${C.purpleHi} 0%, ${C.purpleInk} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 24px ${C.purpleHi}55`,
        }}>
          <Icon size={hero ? 22 : 14} color={C.white} />
        </div>
      )}

      {/* Hero-only stat strip */}
      {hero && (
        <div style={{
          marginTop: 'auto', paddingTop: 26,
          borderTop: `1px solid ${C.lineHi}`,
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 22, fontFamily: MONO, fontSize: 11, color: C.textFaint, letterSpacing: 1.5,
        }}>
          <div><strong style={{ color: C.text, fontSize: 26, fontFamily: DISPLAY, fontWeight: 800, display: 'block' }}>8s</strong>avg. answer</div>
          <div><strong style={{ color: C.text, fontSize: 26, fontFamily: DISPLAY, fontWeight: 800, display: 'block' }}>5</strong>images per slide</div>
          <div><strong style={{ color: C.text, fontSize: 26, fontFamily: DISPLAY, fontWeight: 800, display: 'block' }}>∞</strong>questions</div>
        </div>
      )}
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// CONSTRUCTIVIST INTERSTITIAL — diagonal layout, rotated labels
// ════════════════════════════════════════════════════════════════════════════
function ConstructivistInterstitial() {
  const mobile = useIsMobileViewport()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  // Skip the rotation on mobile — the diagonal slab feels off-axis on
  // narrow viewports and can clip touch targets.
  const rotate = useTransform(scrollYProgress, [0, 1], mobile ? [0, 0] : [-2, 2])

  return (
    <section ref={ref} style={{ padding: '120px 0', position: 'relative', zIndex: 2 }}>
      <Container>
        {/* Diagonal slab */}
        <motion.div style={{
          position: 'relative',
          background: C.panel,
          border: `1px solid ${C.lineHi}`,
          padding: '70px 60px',
          rotate, transformOrigin: 'left top',
          boxShadow: `0 30px 90px rgba(32, 70, 194, 0.02), inset 0 0 80px rgba(79, 124, 255, 0.01)`,
        }}>
          {/* Side rotated label */}
          <div style={{
            position: 'absolute', top: 38, left: -54,
            transform: 'rotate(-90deg)', transformOrigin: 'left top',
            fontFamily: MONO, fontSize: 10, letterSpacing: 3.4, color: C.purpleSoft,
          }}>
            ¶ INTERLUDE · 03 · CONSTRUCTION
          </div>

          {/* Intersecting line */}
          <svg viewBox="0 0 1000 200" preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <line x1="0" y1="180" x2="1000" y2="40"
              stroke={C.purple} strokeWidth="1.2" strokeDasharray="3 6" opacity="0.4" />
            <line x1="0" y1="20"  x2="1000" y2="160"
              stroke={C.purpleDeep} strokeWidth="0.6" strokeDasharray="6 8" opacity="0.5" />
          </svg>

          <SwissRow>
            <SwissCell span={7}>
              <h3 className="kr-headline" style={{
                fontFamily: DISPLAY, margin: 0,
                fontSize: 'clamp(28px, 4vw, 52px)', lineHeight: 1.05,
                letterSpacing: '-0.025em', fontWeight: 700, color: C.text,
              }}>
                The textbook is a brick.
                <br />
                <span style={{ color: C.purpleSoft }}>Kyno is a current.</span>
              </h3>
            </SwissCell>
            <SwissCell span={5}>
              <p style={{
                margin: 0, fontFamily: SERIF, fontSize: 17.5, lineHeight: 1.65,
                color: C.textDim, paddingTop: 4,
              }}>
                A brick is heavy, identical, and sits still. A current moves you. It runs in the
                direction you need it to run. It speeds up when you're slow, slows when you're tired.
                It picks you up at midnight, drops you home before the exam.
              </p>
            </SwissCell>
          </SwissRow>
        </motion.div>
      </Container>
    </section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// LABS SHOWCASE — massive editorial cards (scroll-linked drift)
// ════════════════════════════════════════════════════════════════════════════
function LabsShowcase() {
  const labs = [
    { name: 'Gravity',          tag: 'PHYSICS · 11', glyph: Atom },
    { name: 'Newton\'s Cradle', tag: 'PHYSICS · 9',  glyph: Activity },
    { name: 'Heart',            tag: 'BIOLOGY · 10', glyph: Eye },
    { name: 'Combustion',       tag: 'CHEM · 10',    glyph: Zap },
    { name: 'Wave Optics',      tag: 'PHYSICS · 12', glyph: Compass },
  ]

  const mobile = useIsMobileViewport()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const tx1 = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['-18%', '12%']))
  const tx2 = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['20%', '-14%']))
  const ghostX = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['-14%', '10%']))
  const gridY = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['10%', '-10%']))
  const labL  = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['0%', '-5%']))
  const labR  = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['0%', '5%']))

  return (
    <section ref={ref} id="labs" style={{
      padding: '120px 0 100px', position: 'relative', zIndex: 2,
      background: `linear-gradient(180deg, ${C.ink} 0%, ${C.paper} 50%, ${C.ink} 100%)`,
      overflow: 'hidden',
    }}>
      <motion.div aria-hidden style={{
        position: 'absolute', top: '4%', left: '50%',
        translateX: '-50%',
        x: ghostX,
        fontFamily: DISPLAY, fontSize: 'min(42vw, 540px)',
        fontWeight: 900, letterSpacing: '-0.09em', color: C.purpleInk,
        opacity: 0.22, pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        LABS
      </motion.div>

      <Container>
        <SwissRow>
          <SwissCell span={3}>
            <Eyebrow num="03" label="Kyno Labs" />
          </SwissCell>
          <SwissCell span={9}>
            <h3 className="kr-headline" style={{
              fontFamily: DISPLAY, fontSize: 'clamp(36px, 5.4vw, 76px)',
              lineHeight: 0.98, letterSpacing: '-0.03em', fontWeight: 800,
              margin: 0, color: C.text,
            }}>
              <motion.span style={{ x: tx1, display: 'inline-block' }}>Touch the</motion.span><br />
              <motion.span style={{
                x: tx2,
                display: 'inline-block',
                fontStyle: 'italic',
                background: `linear-gradient(180deg, ${C.purpleLite}, ${C.purple})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>diagram.</motion.span>
            </h3>
            <p style={{
              fontFamily: SERIF, fontSize: 18, lineHeight: 1.7, color: C.textDim,
              maxWidth: 700, marginTop: 26,
            }}>
              <DropCap letter="A" /> diagram you can rotate is a different diagram.
              Kyno Labs are full 3D simulations — drag, pinch, zoom, slide the
              variables. Every chapter in NCERT physics, chem, and biology gets
              its own interactive scene.
            </p>
          </SwissCell>
        </SwissRow>

        {/* Hero lab + supporting */}
        <motion.div style={{ marginTop: 80, display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24, y: gridY }}
          className="kr-lab-grid">
          <LabTile big lab={labs[0]} />
          <div style={{ display: 'grid', gap: 24, gridTemplateRows: '1fr 1fr' }}>
            <LabTile lab={labs[1]} />
            <LabTile lab={labs[2]} />
          </div>
        </motion.div>

        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}
          className="kr-lab-grid-2">
          <motion.div style={{ x: labL }}><LabTile lab={labs[3]} /></motion.div>
          <motion.div style={{ x: labR }}><LabTile lab={labs[4]} /></motion.div>
        </div>

        <div style={{
          marginTop: 56, padding: '24px 28px',
          border: `1px solid ${C.lineHi}`, borderRadius: 16,
          background: 'rgba(79, 124, 255, 0.04)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 24, flexWrap: 'wrap',
        }}>
          <span style={{
            fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: C.purpleSoft,
          }}>
            27 LABS LIVE  ·  82 IN PRODUCTION  ·  RENDERED IN-BROWSER ON THREE.JS
          </span>
          <span style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: C.textVery,
          }}>
            FILE / LABS / V.2026.05
          </span>
        </div>
      </Container>
    </section>
  )
}

function LabTile({ lab, big = false }: { lab: { name: string; tag: string; glyph: any }; big?: boolean }) {
  const Icon = lab.glyph
  return (
    <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 200, damping: 22 }}
      style={{
        position: 'relative', aspectRatio: big ? '1.7 / 1' : '1.7 / 1',
        background:
          `radial-gradient(80% 100% at 50% 100%, ${C.purpleDeep} 0%, ${C.panel2} 55%, ${C.ink} 100%)`,
        border: `1px solid ${C.line}`, borderRadius: 22, overflow: 'hidden',
        padding: big ? '36px 38px' : '24px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        cursor: 'pointer',
        boxShadow: '0 20px 80px rgba(32, 70, 194, 0.01)',
      }}>

      {/* Big floating glyph */}
      <div style={{
        position: 'absolute', right: big ? '8%' : '-8%', top: big ? '8%' : '-15%',
        width: big ? 320 : 220, height: big ? 320 : 220,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${C.purpleHi}55 0%, transparent 65%)`,
        filter: 'blur(8px)',
      }} />
      <div style={{
        position: 'absolute', right: big ? '12%' : '12%', top: big ? '25%' : '20%',
        opacity: 0.5,
      }}>
        <Icon size={big ? 200 : 120} color={C.purpleSoft} strokeWidth={0.6} />
      </div>

      <div style={{ position: 'relative', zIndex: 2 }}>
        <span style={{
          fontFamily: MONO, fontSize: 10, color: C.purpleSoft, letterSpacing: 2.4,
        }}>
          {lab.tag}
        </span>
      </div>

      <div style={{ position: 'relative', zIndex: 2 }}>
        <h4 style={{
          fontFamily: DISPLAY, margin: 0,
          fontSize: big ? 'clamp(40px, 5vw, 64px)' : 'clamp(26px, 3.2vw, 38px)',
          fontWeight: 800, letterSpacing: '-0.025em', color: C.text,
          lineHeight: 1,
        }}>
          {lab.name}.
        </h4>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: C.purple,
          }}>
            → OPEN SIMULATION
          </span>
          <ArrowRight size={11} color={C.purple} />
        </div>
      </div>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TWIN ESSAY — long-form editorial (scroll-linked drift)
// ════════════════════════════════════════════════════════════════════════════
function TwinEssay() {
  const mobile = useIsMobileViewport()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const lx1 = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['-16%', '12%']))
  const lx2 = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['20%', '-14%']))
  const ghostX = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['16%', '-14%']))
  const bodyY  = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['10%', '-10%']))
  const quoteX = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['-14%', '10%']))

  return (
    <section ref={ref} id="twin" style={{ padding: '140px 0 120px', position: 'relative', zIndex: 2, overflow: 'hidden' }}>
      <motion.div aria-hidden style={{
        position: 'absolute', top: '8%', left: '50%',
        translateX: '-50%',
        x: ghostX,
        fontFamily: DISPLAY, fontSize: 'min(44vw, 580px)',
        fontWeight: 900, letterSpacing: '-0.09em', color: C.purpleInk,
        opacity: 0.22, pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        TWIN
      </motion.div>

      <Container>
        <SwissRow>
          <SwissCell span={3}>
            <Eyebrow num="04" label="The Twin" />
            <RotatedLabel text="MEMORY · ENGINE · V.2026" style={{ marginTop: 56 }} />
          </SwissCell>
          <SwissCell span={9}>
            <h3 className="kr-headline" style={{
              fontFamily: DISPLAY, fontSize: 'clamp(40px, 6vw, 92px)',
              lineHeight: 0.94, letterSpacing: '-0.035em', fontWeight: 800,
              margin: 0, color: C.text,
            }}>
              <motion.span style={{ x: lx1, display: 'inline-block' }}>An AI that knows</motion.span><br />
              <motion.em style={{
                x: lx2,
                display: 'inline-block',
                fontStyle: 'italic',
                background: `linear-gradient(180deg, ${C.purpleLite}, ${C.purpleHi})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>where you are</motion.em>.
            </h3>

            <motion.div style={{
              marginTop: 56,
              display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 56,
              fontFamily: SERIF, fontSize: 17.5, lineHeight: 1.75, color: C.textDim,
              y: bodyY,
            }} className="kr-two-col">
              <div>
                <DropCap letter="T" />he Twin lives on your device. Most of what Kyno
                remembers about you — every flashcard, every formula, every focus
                session — sits in your browser's local storage, not on a server.
                When you change devices, Kyno encrypts the whole Twin and ships it
                over for a brief moment, then wipes the cloud copy.
                <p style={{ margin: '16px 0' }}>
                  The Twin grows as you study. It learns the shape of your
                  mistakes — that you confuse <em style={{ color: C.text }}>moment</em> and
                  <em style={{ color: C.text }}> momentum</em>, that the second law of
                  thermodynamics slipped out two Tuesdays ago, that you peaked on
                  fluid mechanics in October.
                </p>
              </div>
              <div>
                <p style={{ margin: 0 }}>
                  And then it speaks back. Spaced-repetition cards arrive the
                  moment you're about to forget. A study plan reshapes itself
                  around the chapters your last mock paper said you don't yet own.
                  Voice tutor sessions get shorter the better you know something
                  and longer the moment you stumble.
                </p>
                <p style={{ margin: '16px 0 0' }}>
                  This is the part of Kyno that, the longer you stay, the more
                  it becomes <em style={{ color: C.text }}>only yours</em>.
                </p>
              </div>
            </motion.div>

            <motion.div style={{ x: quoteX }}>
              <PullQuote
                text={`“It remembered I never finished projectile motion. I had.\nI just forgot I had.”`}
                attribution={`— Ananya, Class 11, CBSE`}
              />
            </motion.div>
          </SwissCell>
        </SwissRow>
      </Container>
    </section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// DESKTOP APP — download section for the Electron build
// ════════════════════════════════════════════════════════════════════════════
function DesktopApp() {
  const mobile = useIsMobileViewport()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const lx1 = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['-12%', '8%']))
  const lx2 = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['14%', '-10%']))
  const ghostX = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['12%', '-10%']))

  // The release page on GitHub. Builders upload .exe/.dmg/.AppImage there;
  // these direct links resolve to the latest tagged build whenever it lands.
  const RELEASES = 'https://github.com/Dynamox-DEV677/kairo/releases/latest'

  return (
    <section ref={ref} id="desktop" style={{
      padding: '140px 0 120px', position: 'relative', zIndex: 2, overflow: 'hidden',
    }}>
      {/* Ghost watermark */}
      <motion.div aria-hidden style={{
        position: 'absolute', top: '8%', left: '50%',
        translateX: '-50%',
        x: ghostX,
        fontFamily: DISPLAY, fontSize: 'min(38vw, 500px)',
        fontWeight: 900, letterSpacing: '-0.09em', color: C.purpleInk,
        opacity: 0.20, pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        DESKTOP
      </motion.div>

      <Container>
        <SwissRow>
          <SwissCell span={3}>
            <Eyebrow num="05" label="The Desktop App" />
            <RotatedLabel text="WINDOWS · MACOS · LINUX" style={{ marginTop: 56 }} />
          </SwissCell>

          <SwissCell span={9}>
            <h3 className="kr-headline" style={{
              fontFamily: DISPLAY, fontSize: 'clamp(36px, 5.4vw, 76px)',
              lineHeight: 0.98, letterSpacing: '-0.03em', fontWeight: 800,
              margin: 0, color: C.text,
            }}>
              <motion.span style={{ x: lx1, display: 'inline-block' }}>Kyno,</motion.span><br />
              <motion.span style={{
                x: lx2,
                display: 'inline-block',
                fontStyle: 'italic',
                background: `linear-gradient(180deg, ${C.purpleLite}, ${C.purpleHi})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>natively yours.</motion.span>
            </h3>

            <p style={{
              fontFamily: SERIF, fontSize: 18, lineHeight: 1.7, color: C.textDim,
              maxWidth: 720, marginTop: 26,
            }}>
              The web app lives on every browser. The desktop app lives on
              your computer — faster startup, no tab clutter, persistent
              login. Same Twin, same data, same account everywhere.
            </p>

            {/* Three download cards */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
              marginTop: 48,
            }} className="kr-download-grid">
              <DownloadCard
                href={RELEASES}
                platform="Windows"
                detail="10 / 11 · x64"
                file=".exe installer"
                glyph={<WindowsGlyph />}
              />
              <DownloadCard
                href={RELEASES}
                platform="macOS"
                detail="12+ · Intel / Apple Silicon"
                file=".dmg"
                glyph={<AppleGlyph />}
              />
              <DownloadCard
                href={RELEASES}
                platform="Linux"
                detail="AppImage · .deb"
                file="AppImage"
                glyph={<LinuxGlyph />}
              />
            </div>

            {/* Feature strip */}
            <div style={{
              marginTop: 40, padding: '20px 24px',
              borderRadius: 14,
              background: 'rgba(79, 124, 255, 0.05)',
              border: `1px solid ${C.line}`,
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 18,
              fontFamily: MONO, fontSize: 11, color: C.textFaint, letterSpacing: 1.4,
            }} className="kr-desktop-features">
              <FeatureLine k="ALWAYS DARK" v="No white flash on boot." />
              <FeatureLine k="LIVE SPLASH" v="Apple-style splash for ~2 s." />
              <FeatureLine k="LINKED ACCOUNT" v="Same login across web + desktop." />
              <FeatureLine k="OFFLINE-FRIENDLY" v="Twin cached locally." />
            </div>

            <p style={{
              marginTop: 32, fontFamily: MONO, fontSize: 11, color: C.textVery,
              letterSpacing: 2,
            }}>
              Built with Electron · MIT-licensed · open source
            </p>
          </SwissCell>
        </SwissRow>
      </Container>
    </section>
  )
}

function DownloadCard({ href, platform, detail, file, glyph }: {
  href: string; platform: string; detail: string; file: string; glyph: React.ReactNode
}) {
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noreferrer"
      whileHover={{ y: -3, borderColor: 'rgba(102, 217, 255, 0.45)' }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      style={{
        display: 'flex', flexDirection: 'column', gap: 14,
        padding: '22px 22px 20px',
        background: C.panel,
        border: `1px solid ${C.line}`,
        borderRadius: 18,
        textDecoration: 'none',
        cursor: 'pointer',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: `linear-gradient(135deg, ${C.purpleHi}, ${C.purpleInk})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 18px rgba(79, 124, 255, 0.03)`,
        }}>
          {glyph}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: DISPLAY, fontSize: 22, fontWeight: 800,
            color: C.text, letterSpacing: '-0.02em', lineHeight: 1.05,
          }}>
            {platform}
          </div>
          <div style={{
            fontFamily: MONO, fontSize: 10, color: C.textFaint, letterSpacing: 1.4,
            marginTop: 3,
          }}>
            {detail}
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 'auto', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', paddingTop: 14,
        borderTop: `1px solid ${C.line}`,
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 11, color: C.purpleSoft, letterSpacing: 1.6,
        }}>
          {file}
        </span>
        <ArrowDown size={14} color={C.purpleSoft} />
      </div>
    </motion.a>
  )
}

function FeatureLine({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div style={{ color: C.purpleSoft, fontWeight: 700, marginBottom: 4 }}>{k}</div>
      <div style={{ color: C.textDim, letterSpacing: 0.1, fontFamily: SANS, fontSize: 12, lineHeight: 1.5 }}>{v}</div>
    </div>
  )
}

// Minimalist platform glyphs — drawn as inline SVG to stay on-brand.
function WindowsGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
      <path d="M3 3.5l8-1.1V11H3V3.5zM12 2.3l9-1.3V11h-9V2.3zM3 12h8v8.5l-8-1.1V12zm9 0h9v9.7l-9-1.3V12z" />
    </svg>
  )
}
function AppleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
      <path d="M17.6 13.4c0-2.5 2-3.7 2.1-3.8-1.1-1.7-2.9-1.9-3.5-2-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.2 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.5 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.7 1.3 0 2.2-1.2 3-2.4.5-.7.9-1.5 1.2-2.4-1.4-.5-2.4-1.9-2.4-4.1zM15.2 5.3c.6-.8 1-1.9.9-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1.1 0 2.1-.5 2.8-1.3z" />
    </svg>
  )
}
function LinuxGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
      <path d="M12 2c1.7 0 3 1.3 3 3 0 1-.5 1.9-1.2 2.5 0 0 1.7.4 2.7 2.3.8 1.6.8 2.9 1.3 3.7.5.7 1.5 1 1.6 2 0 1.2-1 1.6-1.6 1.9-.6.3-1 .7-1.2 1.1-.2.5-.1 1-.6 1.6-.5.6-1.4.6-2 .5-.7-.1-1.3-.5-1.6-.6-.4-.1-1-.1-1.4 0-.4.1-1 .5-1.6.6-.7.1-1.6.1-2-.5-.5-.6-.4-1.1-.6-1.6-.2-.4-.6-.8-1.2-1.1C5 16 4 15.6 4 14.4c.1-1 1.1-1.3 1.6-2 .5-.8.5-2.1 1.3-3.7 1-1.9 2.7-2.3 2.7-2.3C8.9 5.8 8.4 4.9 8.4 4c0-1.7 1.4-3 3-3zm-1 3.2c-.6 0-1 .4-1 .9 0 .4.3.7.6.7l-.1.5c-.4.1-.6.3-.6.6 0 .2.2.4.5.4.3 0 .5-.2.5-.5l.1-.5.1.5c0 .3.2.5.5.5.3 0 .5-.2.5-.4 0-.3-.2-.5-.6-.6l-.1-.5c.3 0 .6-.3.6-.7 0-.5-.4-.9-1-.9z" />
    </svg>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// FINAL CTA — brutalist closer (scroll-linked drift + scale)
// ════════════════════════════════════════════════════════════════════════════
function FinalCTA({ onGetStarted }: { onGetStarted: () => void }) {
  const mobile = useIsMobileViewport()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  // Dramatic scale + drift on BEGIN. Tamer on mobile.
  const beginScale = useTransform(scrollYProgress, [0, 0.5, 1],
    mobile ? [1, 1, 1] : [0.7, 1.05, 1.18])
  const beginX     = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['12%', '-12%']))
  const beginO     = useTransform(scrollYProgress, [0, 0.4, 1], mobile ? [1, 1, 1] : [0.4, 1, 1])
  const haloS      = useTransform(scrollYProgress, [0, 1], mobile ? [1, 1] : [0.4, 1.5])
  const ghostX     = useTransform(scrollYProgress, [0, 1], pxRange(mobile, ['-16%', '14%']))

  return (
    <section ref={ref} style={{
      padding: '160px 0',
      borderTop: `1px solid ${C.lineHi}`,
      background:
        `radial-gradient(80% 100% at 50% 50%, rgba(79, 124, 255, 0.18) 0%, ${C.ink} 70%)`,
      position: 'relative', zIndex: 2, overflow: 'hidden',
    }}>
      {/* Animated halo that pulses larger with scroll */}
      <motion.div aria-hidden style={{
        position: 'absolute', top: '50%', left: '50%',
        translate: '-50% -50%',
        width: '70vw', height: '70vw', maxWidth: 900, maxHeight: 900,
        borderRadius: '50%',
        background: `radial-gradient(circle, rgba(79, 124, 255, 0.18) 0%, transparent 60%)`,
        scale: haloS,
        pointerEvents: 'none',
      }} />

      {/* Ghost watermark — louder, larger */}
      <motion.div aria-hidden style={{
        position: 'absolute', top: '50%', left: '50%',
        translateX: '-50%', translateY: '-50%',
        x: ghostX,
        fontFamily: DISPLAY, fontSize: 'min(46vw, 620px)',
        fontWeight: 900, letterSpacing: '-0.09em', color: C.purpleInk,
        opacity: 0.22, pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        BEGIN
      </motion.div>

      <Container>
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 2 }}>
          <span style={{
            fontFamily: MONO, fontSize: 11, letterSpacing: 3.4, color: C.purpleSoft,
            textTransform: 'uppercase',
          }}>
            — End of cover ·  Issue №01 ·
          </span>

          <motion.h2 className="kr-mega" style={{
            fontFamily: DISPLAY, fontWeight: 900,
            fontSize: 'clamp(80px, 19vw, 320px)',
            lineHeight: 0.85, letterSpacing: '-0.05em',
            margin: '28px auto 8px', color: C.text,
            scale: beginScale, x: beginX, opacity: beginO,
          }}>
            BEGIN.
          </motion.h2>

          <p style={{
            fontFamily: SERIF, fontSize: 19, color: C.textDim,
            maxWidth: 560, margin: '14px auto 0', lineHeight: 1.55,
          }}>
            Sign up. Take five minutes. Kyno will read your first doubt,
            build your Twin, and have a personalised plan ready by the time
            you close the tab.
          </p>

          <button onClick={onGetStarted} style={{ ...bigCta, marginTop: 44, fontSize: 16 }}>
            Open Kyno  <ArrowRight size={17} />
          </button>
        </div>
      </Container>
    </section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// FOOTER — Swiss minimal
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
// ABOUT + FOUNDER — About Kyno essay block and the premium founder card
// ════════════════════════════════════════════════════════════════════════════
function AboutFounder() {
  const mobile = useIsMobileViewport()
  return (
    <section id="about" style={{
      padding: '120px 0 130px', position: 'relative', zIndex: 2,
      borderTop: `1px solid ${C.line}`,
    }}>
      <Container>
        {/* — About Kyno — */}
        <SwissRow>
          <SwissCell span={3}>
            <Eyebrow num="07" label="About Kyno" />
          </SwissCell>
          <SwissCell span={9}>
            <h3 className="kr-headline" style={{
              fontFamily: DISPLAY, fontSize: 'clamp(30px, 4vw, 56px)',
              lineHeight: 1.04, letterSpacing: '-0.02em', fontWeight: 700,
              margin: '0 0 32px', color: C.text, maxWidth: 820,
            }}>
              The world's smartest{' '}
              <span style={{ color: C.purpleSoft }}>learning companion.</span>
            </h3>
            <p style={{
              fontFamily: SERIF, fontSize: 17.5, lineHeight: 1.75, color: C.textDim,
              margin: 0, maxWidth: 760,
            }}>
              Kyno is an AI-powered education platform designed to transform how students
              learn. Instead of simply answering questions, Kyno understands every learner,
              creates personalized learning paths, explains concepts visually, adapts to
              individual strengths, and helps students achieve their full potential.
            </p>
            <p style={{
              fontFamily: SERIF, fontSize: 17.5, lineHeight: 1.75, color: C.textDim,
              margin: '18px 0 0', maxWidth: 760,
            }}>
              Built with cutting-edge artificial intelligence by{' '}
              <em style={{ color: C.text, fontStyle: 'normal', borderBottom: `1px solid ${C.purple}` }}>
                Kairo Industries
              </em>, Kyno aims to become the world's smartest learning companion.
            </p>
          </SwissCell>
        </SwissRow>

        {/* — Meet the Founder — premium glass card — */}
        <SwissRow>
          <SwissCell span={3}>
            <div style={{ marginTop: mobile ? 56 : 96 }}>
              <Eyebrow num="08" label="Meet the Founder" />
            </div>
          </SwissCell>
          <SwissCell span={9}>
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              style={{
                marginTop: mobile ? 24 : 96,
                borderRadius: 28,
                border: `1px solid ${C.lineHi}`,
                background: `linear-gradient(150deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.015) 55%, ${C.purpleInk}44 100%)`,
                backdropFilter: 'blur(18px) saturate(150%)',
                WebkitBackdropFilter: 'blur(18px) saturate(150%)',
                padding: mobile ? '32px 24px' : '48px 56px',
                display: 'flex',
                flexDirection: mobile ? 'column' : 'row',
                gap: mobile ? 28 : 56,
                alignItems: mobile ? 'flex-start' : 'center',
                boxShadow: `0 30px 90px rgba(0,0,0,0.45), 0 0 60px ${C.purpleHi}18`,
                position: 'relative', overflow: 'hidden',
              }}
            >
              {/* soft corner glow */}
              <div aria-hidden style={{
                position: 'absolute', top: -120, right: -120, width: 320, height: 320,
                borderRadius: '50%', pointerEvents: 'none',
                background: `radial-gradient(circle, ${C.purpleHi}33 0%, transparent 65%)`,
              }} />

              {/* Monogram avatar */}
              <div style={{
                width: mobile ? 84 : 116, height: mobile ? 84 : 116, flexShrink: 0,
                borderRadius: '28%',
                background: `linear-gradient(140deg, ${C.purpleSoft} 0%, ${C.purple} 45%, ${C.purpleDeep} 100%)`,
                display: 'grid', placeItems: 'center',
                fontFamily: DISPLAY, fontSize: mobile ? 38 : 52, fontWeight: 900, color: '#fff',
                boxShadow: `0 18px 50px ${C.purpleHi}55, inset 0 0 30px rgba(0,0,0,0.25)`,
                letterSpacing: '-0.02em',
              }}>
                D
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontFamily: MONO, fontSize: 10.5, color: C.purple,
                  letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10,
                }}>
                  Founder & CEO · Kairo Industries
                </div>
                <div style={{
                  fontFamily: DISPLAY, fontSize: mobile ? 32 : 44, fontWeight: 800,
                  letterSpacing: '-0.03em', color: C.text, lineHeight: 1,
                }}>
                  Darshan
                </div>
                <p style={{
                  fontFamily: SERIF, fontSize: mobile ? 15.5 : 18, lineHeight: 1.7,
                  color: C.textDim, margin: '20px 0 0', maxWidth: 560, fontStyle: 'italic',
                }}>
                  “I believe education should be personal, intelligent, and accessible to
                  everyone. Kyno is built to become the world's most advanced AI learning
                  platform.”
                </p>
              </div>
            </motion.div>
          </SwissCell>
        </SwissRow>
      </Container>
    </section>
  )
}

function Footer() {
  return (
    <footer style={{
      paddingTop: 60, paddingBottom: 40,
      borderTop: `1px solid ${C.line}`, position: 'relative', zIndex: 2,
    }}>
      <Container>
        <SwissRow>
          <SwissCell span={4}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <KairoMark size={36} />
              <div>
                <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>
                  KYNO
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: C.textFaint, letterSpacing: 1.8, marginTop: 2 }}>
                  A · KAIRO · INDUSTRIES · PRODUCT
                </div>
              </div>
            </div>
            <p style={{
              fontFamily: SANS, color: C.textFaint, fontSize: 13, lineHeight: 1.6, marginTop: 22,
              maxWidth: 320,
            }}>
              The AI education system built for the future.
              Built with ❤️ by Darshan.
            </p>
          </SwissCell>

          <SwissCell span={3}>
            <FooterCol title="ISSUE · NAV" items={[
              { label: 'Manifesto',   href: '#manifesto' },
              { label: 'Product',     href: '#product' },
              { label: 'Labs',        href: '#labs' },
              { label: 'Twin',        href: '#twin' },
              { label: 'Desktop App', href: '#desktop' },
            ]} />
          </SwissCell>
          <SwissCell span={3}>
            <FooterCol title="COMPANY" items={[
              { label: 'About',            href: '/about' },
              { label: 'Contact',          href: 'mailto:kairoindustries.cor@gmail.com' },
              { label: '📞 877 800 4043',  href: 'tel:8778004043' },
              { label: 'System Status',    href: '/status' },
            ]} />
          </SwissCell>
          <SwissCell span={2}>
            <FooterCol title="LEGAL" items={[
              { label: 'Terms',   onClick: () => openTerms('terms') },
              { label: 'Privacy', onClick: () => openTerms('privacy') },
            ]} />
          </SwissCell>
        </SwissRow>

        <div style={{
          marginTop: 56, paddingTop: 22, borderTop: `1px solid ${C.line}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          gap: 18, flexWrap: 'wrap',
        }}>
          <span style={{ fontFamily: MONO, fontSize: 10, color: C.textVery, letterSpacing: 2 }}>
            © {new Date().getFullYear()}  ·  KAIRO INDUSTRIES  ·  ALL RIGHTS RESERVED
          </span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: C.textVery, letterSpacing: 2 }}>
            BUILT WITH ❤️ BY DARSHAN  ·  CHENNAI · INDIA
          </span>
        </div>
      </Container>
    </footer>
  )
}

type FooterItem = { label: string; href?: string; onClick?: () => void }

function FooterCol({ title, items }: { title: string; items: FooterItem[] }) {
  const sharedStyle: React.CSSProperties = {
    fontFamily: SANS, fontSize: 13, color: C.textDim, textDecoration: 'none',
    transition: 'color .15s',
    background: 'transparent', border: 'none', padding: 0,
    textAlign: 'left', cursor: 'pointer',
  }
  return (
    <div>
      <div style={{
        fontFamily: MONO, fontSize: 10, color: C.purple, letterSpacing: 2.4,
        marginBottom: 18,
      }}>
        {title}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(({ label, href, onClick }) => (
          <li key={label}>
            {onClick ? (
              <button
                type="button"
                onClick={onClick}
                style={sharedStyle}
                onMouseEnter={e => (e.currentTarget.style.color = C.purpleSoft)}
                onMouseLeave={e => (e.currentTarget.style.color = C.textDim)}
              >
                {label}
              </button>
            ) : (
              <a
                href={href}
                style={sharedStyle}
                onMouseEnter={e => (e.currentTarget.style.color = C.purpleSoft)}
                onMouseLeave={e => (e.currentTarget.style.color = C.textDim)}
              >
                {label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Layout primitives — Swiss 12-col + helpers
// ════════════════════════════════════════════════════════════════════════════
function Container({ children }: { children: React.ReactNode }) {
  return (
    <div className="kr-container" style={{
      maxWidth: 1320, margin: '0 auto', padding: '0 32px',
      position: 'relative',
    }}>
      {children}
    </div>
  )
}

function SwissRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="kr-row" style={{
      display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 24,
    }}>
      {children}
    </div>
  )
}

function SwissCell({ children, span, align = 'left', centerCol = false }: {
  children?: React.ReactNode
  span: number
  align?: 'left' | 'right' | 'center'
  centerCol?: boolean
}) {
  if (centerCol) return <div style={{ gridColumn: `span ${span}` }} />
  return (
    <div style={{
      gridColumn: `span ${span}`,
      display: 'flex', flexDirection: 'column',
      alignItems: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
    }}>
      {children}
    </div>
  )
}

function Eyebrow({ num, label }: { num: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{
        fontFamily: DISPLAY, fontSize: 'clamp(28px, 2.8vw, 40px)',
        lineHeight: 1, fontWeight: 800, color: C.purple, letterSpacing: '-0.02em',
      }}>
        {num}.
      </div>
      <div style={{
        fontFamily: MONO, fontSize: 11, color: C.textFaint, letterSpacing: 2.2,
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{ width: 44, height: 1, background: C.purple, marginTop: 8 }} />
    </div>
  )
}

function RotatedLabel({ text, style = {} }: { text: string; style?: React.CSSProperties }) {
  return (
    <div style={{
      transform: 'rotate(-90deg)', transformOrigin: 'left top',
      whiteSpace: 'nowrap',
      fontFamily: MONO, fontSize: 10, letterSpacing: 3.4, color: C.purpleSoft,
      ...style,
    }}>
      ¶  {text}
    </div>
  )
}

function DropCap({ letter }: { letter: string }) {
  return (
    <span style={{
      float: 'left', fontFamily: DISPLAY, fontWeight: 800,
      fontSize: 72, lineHeight: 0.85, padding: '6px 12px 0 0',
      color: C.purpleSoft, letterSpacing: '-0.04em',
    }}>
      {letter}
    </span>
  )
}

function PullQuote({ text, attribution }: { text: string; attribution: string }) {
  return (
    <blockquote style={{
      margin: '48px 0 8px', padding: '22px 0 22px 28px',
      borderLeft: `3px solid ${C.purple}`,
      fontFamily: SERIF, fontSize: 'clamp(22px, 2.4vw, 32px)',
      lineHeight: 1.32, color: C.text, fontStyle: 'italic',
      maxWidth: 760,
    }}>
      <span>{text}</span>
      <div style={{
        marginTop: 16, fontFamily: MONO, fontSize: 11, color: C.purpleSoft,
        fontStyle: 'normal', letterSpacing: 1.6,
      }}>
        {attribution}
      </div>
    </blockquote>
  )
}

// Logo mark — the real Kyno brand image inside a rounded purple badge.
function KairoMark({ size = 28, intense = false, centered = false }: {
  size?: number
  intense?: boolean
  centered?: boolean
}) {
  return (
    <div style={{
      position: centered ? 'absolute' : 'relative',
      inset: centered ? 0 : undefined,
      margin: centered ? 'auto' : undefined,
      width: size, height: size, flexShrink: 0,
      borderRadius: Math.max(6, Math.round(size * 0.25)),
      background: intense
        ? `linear-gradient(135deg, ${C.purpleLite} 0%, ${C.purple} 55%, ${C.purpleHi} 100%)`
        : C.purpleInk,
      border: intense ? 'none' : `1px solid ${C.purpleHi}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      boxShadow: intense ? `0 0 22px ${C.purpleHi}55` : 'none',
    }}>
      <img
        src="/kairo_logo.png"
        alt="Kyno"
        style={{
          width: '78%', height: '78%', objectFit: 'contain',
          filter: intense ? 'drop-shadow(0 1px 3px rgba(0,0,0,0.35))' : 'none',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
        draggable={false}
      />
    </div>
  )
}

// Utility: smooth-scroll to section
function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ════════════════════════════════════════════════════════════════════════════
// CTAs
// ════════════════════════════════════════════════════════════════════════════
const pillCta: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '10px 18px', borderRadius: 100, border: 'none', cursor: 'pointer',
  fontFamily: SANS, fontSize: 13, fontWeight: 600,
  background: `linear-gradient(135deg, ${C.purpleHi}, ${C.purpleDeep})`,
  color: C.white,
  boxShadow: `0 0 22px rgba(79, 124, 255, 0.04)`,
  transition: 'transform .15s',
}
const bigCta: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 10,
  padding: '16px 26px', borderRadius: 12, border: 'none', cursor: 'pointer',
  fontFamily: SANS, fontSize: 15, fontWeight: 700, letterSpacing: -0.1,
  background: C.white, color: C.ink,
  boxShadow: `0 0 32px rgba(102, 217, 255, 0.03)`,
  transition: 'transform .15s, box-shadow .25s',
}
const ghostCta: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 10,
  padding: '15px 24px', borderRadius: 12,
  border: `1px solid ${C.lineHi}`,
  background: 'transparent', color: C.textDim, cursor: 'pointer',
  fontFamily: SANS, fontSize: 14, fontWeight: 600,
  transition: 'color .15s, border-color .15s',
}

// ════════════════════════════════════════════════════════════════════════════
// Global styles — responsive collapse rules, brutal headlines class
// ════════════════════════════════════════════════════════════════════════════
function GlobalStyles() {
  return (
    <style>{`
      .kr-brutal {
        font-family: ${DISPLAY};
        font-size: clamp(64px, 13vw, 220px);
        line-height: 0.86;
        letter-spacing: -0.06em;
        color: ${C.text};
        text-align: center;
        margin: 0;
      }
      .kr-bento {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        grid-auto-rows: minmax(180px, auto);
        gap: 18px;
      }
      @media (max-width: 1024px) {
        .kr-row { grid-template-columns: repeat(6, 1fr) !important; }
        .kr-row > * { grid-column: span 6 !important; }
        .kr-two-col { grid-template-columns: 1fr !important; gap: 0 !important; }
        .kr-bento { grid-template-columns: repeat(6, 1fr) !important; }
        .kr-bento > * { grid-column: span 6 !important; grid-row: auto !important; }
        .kr-lab-grid, .kr-lab-grid-2 { grid-template-columns: 1fr !important; }
        .kr-masthead-nav { display: none !important; }
        .kr-issue-strip { display: none !important; }
      }
      @media (max-width: 640px) {
        .kr-brutal { font-size: clamp(54px, 14vw, 120px) !important; }
        .kr-mega   { font-size: clamp(64px, 22vw, 200px) !important; }
        .kr-headline { font-size: clamp(32px, 8vw, 56px) !important; }
        .kr-display { font-size: clamp(48px, 13vw, 92px) !important; }
        .kr-bento-title { font-size: clamp(20px, 5.6vw, 30px) !important; }
        .kr-container { padding: 0 18px !important; }
        .kr-download-grid { grid-template-columns: 1fr !important; }
        .kr-desktop-features { grid-template-columns: 1fr 1fr !important; }
      }
      @media (max-width: 920px) {
        .kr-download-grid { grid-template-columns: 1fr !important; gap: 14px !important; }
        .kr-desktop-features { grid-template-columns: 1fr 1fr !important; }
      }
      @media (max-width: 420px) {
        .kr-container { padding: 0 14px !important; }
      }
    `}</style>
  )
}
