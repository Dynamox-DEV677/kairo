/**
 * KairoLoader — premium AI-OS loading sequence.
 *
 * Drop in anywhere a spinner would normally go. Renders a full-bleed
 * dark canvas, fades particles in, draws curved blue lines that "travel"
 * across the space leaving soft trails, then *assembles* the Kairo K
 * via SVG path-draw animations (pathLength on three strokes, staggered).
 * After the K locks, a soft pulse runs, then the wordmark + tagline
 * reveal via opacity + blur + upward motion. The whole sequence loops
 * (until the parent unmounts).
 *
 * Why not <SplashScreen>?
 *   SplashScreen uses a static PNG. This component *constructs* the
 *   mark — the user sees the K being built, which is the point of an
 *   AI-OS loader. Two different surfaces, two different jobs.
 *
 * Performance:
 *   - 40 particles cap (mobile-friendly)
 *   - All motion goes through Framer Motion which runs on rAF
 *   - `pathLength` animations are GPU-accelerated
 *   - Respects `prefers-reduced-motion` via useReducedMotion
 *
 * Usage:
 *   <KairoLoader />                                    // default 8s loop
 *   <KairoLoader loop={false} onComplete={...} />      // one-shot
 *   <KairoLoader tagline="Loading your study plan…" /> // custom caption
 */
import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { staticFile } from 'remotion'

// In Remotion, public/ assets aren't served at `/` reliably -- staticFile()
// resolves to the bundler's actual hashed URL. Used in the <img src> below.
const LOGO_SRC = staticFile('kairo_logo.png')

interface KairoLoaderProps {
  /** Total loop duration in ms. Default 8000. */
  duration?: number
  /** Keep looping until unmount. Default true. */
  loop?: boolean
  /** Override the wordmark text. */
  wordmark?: string
  /** Override the tagline. */
  tagline?: string
  /** Fires every time one loop cycle completes. */
  onLoopComplete?: () => void
  /** Apply position:fixed full-screen. Set false to embed in a card. */
  fullscreen?: boolean
}

// ─── Palette ────────────────────────────────────────────────────────────────
const C = {
  bg:        '#050505',
  primary:   '#4F7CFF',
  secondary: '#66D9FF',
  highlight: '#A5B4FC',
  text:      '#FFFFFF',
} as const

// ─── Timing — seconds within one loop ───────────────────────────────────────
// All animations key off these so a re-pace is one edit.
const T = {
  particlesIn:  0.30,
  linesStart:   1.20,
  linesEnd:     3.60,
  logoStart:    3.20,
  logoStrokes:  1.40,   // total time across the three K strokes
  logoLock:     4.80,   // pulse fires here
  wordmarkIn:   5.20,
  taglineIn:    5.80,
}

// ─── Seeded PRNG so layouts are stable across re-mounts of one cycle ────────
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Particle {
  x: number
  y: number
  size: number
  hue: string
  driftX: number
  driftY: number
  driftDur: number
  delay: number
}

function seededParticles(n: number, seed: number): Particle[] {
  const r = mulberry32(seed)
  return Array.from({ length: n }, () => {
    const big = r() > 0.78
    const hueRoll = r()
    return {
      x:        r() * 100,
      y:        r() * 100,
      size:     big ? 2.2 + r() * 1.0 : 0.8 + r() * 1.0,
      hue:      hueRoll < 0.62 ? C.primary : hueRoll < 0.92 ? C.secondary : C.highlight,
      driftX:   (r() - 0.5) * 24,
      driftY:   (r() - 0.5) * 30,
      driftDur: 5 + r() * 4,
      delay:    r() * 0.6,
    }
  })
}

interface Line {
  d: string
  hue: string
  delay: number
  duration: number
  dashLength: number
}

function seededLines(n: number, seed: number): Line[] {
  const r = mulberry32(seed)
  return Array.from({ length: n }, (_, i) => {
    // Start on a random edge, end near centre — the "knowledge converging"
    // metaphor. Quadratic curve via a single off-axis control point gives
    // a natural curve without overshooting the canvas.
    const edge = Math.floor(r() * 4)
    let sx = 500, sy = 500
    const margin = 40
    if (edge === 0) { sx = r() * 1000;       sy = -margin }
    if (edge === 1) { sx = 1000 + margin;    sy = r() * 1000 }
    if (edge === 2) { sx = r() * 1000;       sy = 1000 + margin }
    if (edge === 3) { sx = -margin;          sy = r() * 1000 }

    // End within a tight central cluster (where the K will live).
    const angle = r() * Math.PI * 2
    const radius = 90 + r() * 110
    const ex = 500 + Math.cos(angle) * radius
    const ey = 500 + Math.sin(angle) * radius

    // Control point — biased to one side so the curve bows away from the
    // straight line, looks like an organic trajectory.
    const midX = (sx + ex) / 2
    const midY = (sy + ey) / 2
    const perpX = -(ey - sy)
    const perpY =  (ex - sx)
    const perpLen = Math.hypot(perpX, perpY) || 1
    const bow = (r() - 0.5) * 380
    const cpX = midX + (perpX / perpLen) * bow
    const cpY = midY + (perpY / perpLen) * bow

    return {
      d: `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cpX.toFixed(1)} ${cpY.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`,
      hue: r() > 0.55 ? C.primary : C.secondary,
      delay: T.linesStart + i * 0.12,
      duration: 1.8 + r() * 0.6,
      dashLength: 0.14 + r() * 0.10,
    }
  })
}

// ─── Particle field — drifts subtly, persists through the loop ──────────────
function ParticleField({
  reduce,
  loopKey,
}: { reduce: boolean | null; loopKey: number }) {
  const particles = useMemo(() => seededParticles(40, 20260521 + loopKey), [loopKey])
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {particles.map((p, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 0, y: 0 }}
          animate={
            reduce
              ? { opacity: 0.5 }
              : {
                  opacity: [0, 0.65, 0.45, 0.55],
                  x: [0, p.driftX, 0, -p.driftX, 0],
                  y: [0, p.driftY, 0, -p.driftY, 0],
                }
          }
          transition={{
            opacity: { duration: 2.4, delay: T.particlesIn + p.delay, ease: 'easeOut' },
            x:       { duration: p.driftDur,     repeat: Infinity,        ease: 'easeInOut' },
            y:       { duration: p.driftDur * 1.2, repeat: Infinity,      ease: 'easeInOut' },
          }}
          style={{
            position: 'absolute',
            left:   `${p.x}%`,
            top:    `${p.y}%`,
            width:  p.size,
            height: p.size,
            borderRadius: '50%',
            background: p.hue,
            // Soft glow only on the larger particles — keeps the field calm.
            filter: p.size > 1.8 ? `drop-shadow(0 0 ${p.size * 1.4}px ${p.hue})` : undefined,
          }}
        />
      ))}
    </div>
  )
}

// ─── Emerging lines — short bright dash travels along each path ─────────────
// The `pathLength` is held at `dashLength` (a small fraction) so only a
// SHORT segment of the curve is ever visible; `pathOffset` animates from
// 0 → 1.1 to sweep that segment across the full path. Reads as "a moving
// light traveling along a curve, leaving a trail" — but mathematically
// it's a single moving dash.
function EmergingLines({
  reduce,
  loopKey,
}: { reduce: boolean | null; loopKey: number }) {
  const lines = useMemo(() => seededLines(10, 0xC0FFEE + loopKey), [loopKey])
  if (reduce) return null
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid slice"
    >
      {lines.map((l, i) => (
        <g key={i}>
          {/* Soft trail underneath — wider, blurred, slightly delayed */}
          <motion.path
            d={l.d}
            stroke={l.hue}
            strokeWidth={3.2}
            strokeLinecap="round"
            fill="none"
            opacity={0.22}
            initial={{ pathLength: l.dashLength * 1.6, pathOffset: -0.05 }}
            animate={{ pathOffset: 1.1 }}
            transition={{
              duration: l.duration,
              delay: l.delay,
              ease: [0.65, 0, 0.35, 1],
            }}
            style={{ filter: 'blur(3px)' }}
          />
          {/* Crisp leading edge */}
          <motion.path
            d={l.d}
            stroke={l.hue}
            strokeWidth={1.2}
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: l.dashLength, pathOffset: 0, opacity: 0 }}
            animate={{
              pathOffset: 1.1,
              opacity:    [0, 0.85, 0.85, 0],
            }}
            transition={{
              pathOffset: { duration: l.duration, delay: l.delay, ease: [0.65, 0, 0.35, 1] },
              opacity:    { duration: l.duration, delay: l.delay, times: [0, 0.12, 0.78, 1] },
            }}
            style={{ filter: `drop-shadow(0 0 4px ${l.hue})` }}
          />
        </g>
      ))}
    </svg>
  )
}

// ─── Logo assembly — the actual Kairo mark materialises from centre out ────
//
// The brand mark is a hand-drawn organic logo (PNG, transparent on dark).
// Without a vector source we can't path-draw individual strokes, so the
// "construct" feel comes from a four-layer reveal:
//
//   1. A blue radial bloom expands behind where the mark will appear
//   2. The PNG reveals via clip-path circle growing from 0% -> 75% at
//      centre — feels like the mark crystallising outward, not a wipe
//   3. Filter blur drops from 12px -> 0 over the same window so the
//      mark also "comes into focus"
//   4. Scale 0.92 -> 1.0 -> pulse settle
//
// Combined, it reads as "the logo is being constructed". When you have
// the brand mark as SVG paths, swap the <img> for <motion.path>
// elements driven by `pathLength` and the rest of this component stays
// the same.
function LogoAssemble({ reduce }: { reduce: boolean | null }) {
  const easeInk: [number, number, number, number] = [0.83, 0, 0.17, 1]

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <motion.div
        // Settle + lock pulse — one combined keyframe so the mark
        // never sits at scale=1 in a static way before the pulse.
        initial={{ scale: 0.92 }}
        animate={reduce ? { scale: 1 } : { scale: [0.92, 1.0, 1.045, 1.0] }}
        transition={{
          delay:    T.logoStart,
          times:    [0, 0.62, 0.84, 1],
          duration: T.logoStrokes + 0.55,
          ease:     'easeOut',
        }}
        style={{
          position: 'relative',
          // Fixed size for Remotion render — vw units don't always
          // resolve cleanly in headless Chromium.
          width:  '420px',
          height: '420px',
        }}
      >
        {/* Bloom layer — soft blue glow that emerges underneath the
            mark. Alpha is capped at 0.28 per the refinement spec. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={reduce ? { opacity: 0.4, scale: 1 } : { opacity: [0, 0.5, 0.4], scale: 1 }}
          transition={{
            opacity:  { delay: T.logoStart + 0.15, duration: 1.0, ease: easeInk, times: [0, 0.7, 1] },
            scale:    { delay: T.logoStart + 0.15, duration: 1.0, ease: easeInk },
          }}
          style={{
            position: 'absolute', inset: '-22%',
            background: `radial-gradient(circle, rgba(79, 124, 255, 0.28) 0%, rgba(102, 217, 255, 0.10) 38%, transparent 70%)`,
            filter: 'blur(18px)',
            pointerEvents: 'none',
          }}
        />

        {/* The actual Kairo mark.

            Reveal stack:
              - clip-path circle expands centre-out (the "construct" gesture)
              - blur drops 12px -> 0 (the "crystallise" gesture)
              - opacity 0 -> 1

            Note: clip-path goes to 75%, not 100%, because the SVG
            mark has soft edges that look better cropped slightly.
            If you want the full mark visible bump to 100%. */}
        <motion.img
          src={LOGO_SRC}
          alt="Kairo"
          draggable={false}
          initial={{
            opacity: 0,
            clipPath:        'circle(0% at 50% 50%)',
            WebkitClipPath:  'circle(0% at 50% 50%)',
          }}
          animate={
            reduce
              ? { opacity: 1, clipPath: 'circle(80% at 50% 50%)', WebkitClipPath: 'circle(80% at 50% 50%)' }
              : {
                  opacity:        1,
                  clipPath:       'circle(80% at 50% 50%)',
                  WebkitClipPath: 'circle(80% at 50% 50%)',
                }
          }
          transition={{
            opacity:  { delay: T.logoStart + 0.10, duration: T.logoStrokes * 0.55, ease: easeInk },
            clipPath: { delay: T.logoStart,        duration: T.logoStrokes,        ease: easeInk },
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            // Mid-strength drop-shadow — stays under the 0.32 ceiling
            filter: 'drop-shadow(0 0 20px rgba(79, 124, 255, 0.30))',
            userSelect: 'none',
            WebkitUserDrag: 'none',
          } as React.CSSProperties}
        />

        {/* Focus pull — a separate blurred copy that fades out as the
            sharp PNG above takes over. Gives the "coming into focus"
            feel without animating filter on the main img (which is
            expensive on mobile when combined with clip-path). */}
        {!reduce && (
          <motion.img
            src={LOGO_SRC}
            alt=""
            aria-hidden
            draggable={false}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: [0, 0.6, 0], scale: 1.0 }}
            transition={{
              delay: T.logoStart + 0.05,
              duration: T.logoStrokes,
              ease: easeInk,
              times: [0, 0.5, 1],
            }}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%', height: '100%',
              objectFit: 'contain',
              filter: 'blur(14px) saturate(120%)',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          />
        )}
      </motion.div>
    </div>
  )
}

// ─── Caption — KAIRO + tagline, opacity + blur + translateY ─────────────────
function CaptionReveal({
  wordmark, tagline, reduce,
}: { wordmark: string; tagline: string; reduce: boolean | null }) {
  const easeReveal: [number, number, number, number] = [0.16, 1, 0.3, 1]
  return (
    <div style={{
      position: 'absolute',
      left: '50%', top: 'calc(50% + 270px)',
      transform: 'translate(-50%, 0)',
      textAlign: 'center',
      pointerEvents: 'none',
      fontFamily: '-apple-system, "SF Pro Display", "Inter", system-ui, sans-serif',
      width: 'max-content',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 14, filter: reduce ? 'none' : 'blur(8px)' }}
        animate={{ opacity: 1, y: 0,  filter: reduce ? 'none' : 'blur(0px)' }}
        transition={{ delay: T.wordmarkIn, duration: 0.75, ease: easeReveal }}
        style={{
          fontSize: 56,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: C.text,
          lineHeight: 1,
        }}
      >
        {wordmark}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10, filter: reduce ? 'none' : 'blur(6px)' }}
        animate={{ opacity: 0.78, y: 0, filter: reduce ? 'none' : 'blur(0px)' }}
        transition={{ delay: T.taglineIn, duration: 0.65, ease: easeReveal }}
        style={{
          marginTop: 18,
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          color: 'rgba(255, 255, 255, 0.85)',
          // Refinement-spec-compliant: glow alpha ≤ 0.18
          textShadow: '0 0 12px rgba(79, 124, 255, 0.18)',
        }}
      >
        {tagline}
      </motion.div>
    </div>
  )
}

// ─── Vignette — focuses the eye toward centre, never aggressive ─────────────
function Vignette() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      background: `radial-gradient(
        ellipse at center,
        transparent 32%,
        rgba(0, 0, 0, 0.42) 78%,
        rgba(0, 0, 0, 0.78) 100%
      )`,
    }} />
  )
}

// ─── Main component ────────────────────────────────────────────────────────
export default function KairoLoader({
  duration  = 8000,
  loop      = true,
  wordmark  = 'KAIRO',
  tagline   = 'Your AI Education System',
  onLoopComplete,
  fullscreen = true,
}: KairoLoaderProps) {
  const [loopKey, setLoopKey] = useState(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!loop) return
    const t = window.setTimeout(() => {
      onLoopComplete?.()
      setLoopKey(k => k + 1)
    }, duration)
    return () => window.clearTimeout(t)
  }, [loopKey, loop, duration, onLoopComplete])

  return (
    <div
      style={{
        position: fullscreen ? 'fixed' : 'absolute',
        inset:    0,
        background: C.bg,
        overflow: 'hidden',
        zIndex:   fullscreen ? 9999 : undefined,
        // Prevent text selection during the animation
        userSelect: 'none',
      }}
    >
      {/* Every animated sub-tree keys off `loopKey` so a cycle restart
          remounts them with fresh `initial` states. Cleaner than juggling
          AnimatePresence here. */}
      <ParticleField  reduce={reduce} loopKey={loopKey} />
      <EmergingLines  reduce={reduce} loopKey={loopKey} />
      <LogoAssemble   reduce={reduce}                  key={`logo-${loopKey}`} />
      <CaptionReveal  reduce={reduce} wordmark={wordmark} tagline={tagline} key={`cap-${loopKey}`} />
      <Vignette />
    </div>
  )
}
