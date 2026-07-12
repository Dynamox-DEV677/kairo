import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

interface KairoLoaderProps {
  duration?: number
  loop?: boolean
  wordmark?: string
  tagline?: string
  onLoopComplete?: () => void
  fullscreen?: boolean
}

const C = {
  bg:        '#050505',
  primary:   '#4F7CFF',
  secondary: '#66D9FF',
  highlight: '#A5B4FC',
  text:      '#FFFFFF',
} as const

const T = {
  particlesIn:  0.30,
  linesStart:   1.20,
  linesEnd:     3.60,
  logoStart:    3.20,
  logoStrokes:  1.40,
  logoLock:     4.80,
  wordmarkIn:   5.20,
  taglineIn:    5.80,
}

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
    const edge = Math.floor(r() * 4)
    let sx = 500, sy = 500
    const margin = 40
    if (edge === 0) { sx = r() * 1000;       sy = -margin }
    if (edge === 1) { sx = 1000 + margin;    sy = r() * 1000 }
    if (edge === 2) { sx = r() * 1000;       sy = 1000 + margin }
    if (edge === 3) { sx = -margin;          sy = r() * 1000 }

    const angle = r() * Math.PI * 2
    const radius = 90 + r() * 110
    const ex = 500 + Math.cos(angle) * radius
    const ey = 500 + Math.sin(angle) * radius

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
            filter: p.size > 1.8 ? `drop-shadow(0 0 ${p.size * 1.4}px ${p.hue})` : undefined,
          }}
        />
      ))}
    </div>
  )
}

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

function LogoAssemble({ reduce }: { reduce: boolean | null }) {
  const easeInk: [number, number, number, number] = [0.83, 0, 0.17, 1]

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <motion.div
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
          width:  'clamp(220px, 26vw, 340px)',
          height: 'clamp(220px, 26vw, 340px)',
        }}
      >
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

        <motion.img
          src="/kairo_logo.png"
          alt="Kyno"
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
            filter: 'drop-shadow(0 0 20px rgba(79, 124, 255, 0.30))',
            userSelect: 'none',
            WebkitUserDrag: 'none',
          } as React.CSSProperties}
        />

        {!reduce && (
          <motion.img
            src="/kairo_logo.png"
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

function CaptionReveal({
  wordmark, tagline, reduce,
}: { wordmark: string; tagline: string; reduce: boolean | null }) {
  const easeReveal: [number, number, number, number] = [0.16, 1, 0.3, 1]
  return (
    <div style={{
      position: 'absolute',
      left: '50%', top: 'calc(50% + clamp(110px, 14vw, 170px))',
      transform: 'translate(-50%, 0)',
      textAlign: 'center',
      pointerEvents: 'none',
      fontFamily: '-apple-system, "SF Pro Display", "Inter", system-ui, sans-serif',
      width: 'max-content',
      maxWidth: '92vw',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 14, filter: reduce ? 'none' : 'blur(8px)' }}
        animate={{ opacity: 1, y: 0,  filter: reduce ? 'none' : 'blur(0px)' }}
        transition={{ delay: T.wordmarkIn, duration: 0.75, ease: easeReveal }}
        style={{
          fontSize: 'clamp(28px, 4.6vw, 42px)',
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
          marginTop: 14,
          fontSize: 'clamp(10.5px, 1.4vw, 12.5px)',
          fontWeight: 600,
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          color: 'rgba(255, 255, 255, 0.85)',
          textShadow: '0 0 12px rgba(79, 124, 255, 0.18)',
        }}
      >
        {tagline}
      </motion.div>
    </div>
  )
}

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

export default function KairoLoader({
  duration  = 8000,
  loop      = true,
  wordmark  = 'KYNO',
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
        userSelect: 'none',
      }}
    >
      <ParticleField  reduce={reduce} loopKey={loopKey} />
      <EmergingLines  reduce={reduce} loopKey={loopKey} />
      <LogoAssemble   reduce={reduce}                  key={`logo-${loopKey}`} />
      <CaptionReveal  reduce={reduce} wordmark={wordmark} tagline={tagline} key={`cap-${loopKey}`} />
      <Vignette />
    </div>
  )
}
