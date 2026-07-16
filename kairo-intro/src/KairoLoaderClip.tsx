/**
 * KairoLoaderClip — Remotion-native version of the dashboard's KairoLoader.
 *
 * Why a separate file instead of importing KairoLoader.tsx directly?
 *
 * Framer Motion animations don't reliably advance inside Remotion's
 * frame-by-frame render. Each Remotion frame is a static snapshot, and
 * FM's internal scheduler (which uses requestAnimationFrame + the
 * library's own timing logic) doesn't get to tick between snapshots.
 * The result: every frame shows the `initial` state, the logo never
 * appears.
 *
 * For the dashboard (real browser, real time) the Framer Motion
 * version is correct. For the MP4 export we need to drive every
 * animation off `useCurrentFrame()` instead — that's deterministic
 * and matches Remotion's render model.
 *
 * Visual sequence is the same as the dashboard loader.
 */
import { AbsoluteFill, useCurrentFrame, interpolate, staticFile, Easing } from 'remotion'
import { useMemo } from 'react'

// ─── Palette ────────────────────────────────────────────────────────────────
const C = {
  bg:        '#050505',
  primary:   '#4F7CFF',
  secondary: '#66D9FF',
  highlight: '#A5B4FC',
  text:      '#FFFFFF',
}

const FPS = 60
const W   = 1920
const H   = 1080

// Frame anchors (60 fps)
const F = {
  particlesIn:  Math.round(0.30 * FPS),   //  18
  linesStart:   Math.round(1.20 * FPS),   //  72
  linesEnd:     Math.round(3.60 * FPS),   // 216
  logoStart:    Math.round(3.20 * FPS),   // 192
  logoStrokes:  Math.round(1.40 * FPS),   //  84 (duration)
  logoLock:     Math.round(4.80 * FPS),   // 288
  wordmarkIn:   Math.round(5.20 * FPS),   // 312
  taglineIn:    Math.round(5.80 * FPS),   // 348
}

// Easings — match the dashboard loader's curves.
const E = {
  ink:    Easing.bezier(0.83, 0,    0.17, 1),  // slow start, hard finish
  apple:  Easing.bezier(0.4,  0,    0.2,  1),
  linear: Easing.bezier(0.16, 1,    0.3,  1),
}

// ─── Seeded PRNG ────────────────────────────────────────────────────────────
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

// ─── Particles ──────────────────────────────────────────────────────────────
interface Particle {
  x: number; y: number; size: number; hue: string
  driftX: number; driftY: number; driftPeriod: number; phaseX: number; phaseY: number
  fadeInDelay: number
}

function buildParticles(): Particle[] {
  const r = mulberry32(20260521)
  return Array.from({ length: 40 }, () => {
    const big = r() > 0.78
    const hueRoll = r()
    return {
      x: r() * W,
      y: r() * H,
      size: big ? 2.2 + r() * 1.0 : 0.8 + r() * 1.0,
      hue: hueRoll < 0.62 ? C.primary : hueRoll < 0.92 ? C.secondary : C.highlight,
      driftX: (r() - 0.5) * 28,
      driftY: (r() - 0.5) * 36,
      driftPeriod: 5 + r() * 3,
      phaseX: r() * Math.PI * 2,
      phaseY: r() * Math.PI * 2,
      fadeInDelay: r() * 0.6,
    }
  })
}

function ParticleField() {
  const frame = useCurrentFrame()
  const t = frame / FPS // seconds
  const particles = useMemo(buildParticles, [])
  return (
    <svg
      width={W} height={H}
      style={{ position: 'absolute', inset: 0 }}
      viewBox={`0 0 ${W} ${H}`}
    >
      {particles.map((p, i) => {
        const fadeT = interpolate(
          frame,
          [F.particlesIn + p.fadeInDelay * FPS, F.particlesIn + p.fadeInDelay * FPS + 144],
          [0, 0.55],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        )
        const driftX = Math.sin((t / p.driftPeriod) * Math.PI * 2 + p.phaseX) * p.driftX
        const driftY = Math.cos((t / p.driftPeriod) * Math.PI * 2 + p.phaseY) * p.driftY
        const cx = p.x + driftX
        const cy = p.y + driftY
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={p.size}
            fill={p.hue}
            opacity={fadeT}
            style={{ filter: p.size > 1.8 ? `drop-shadow(0 0 ${p.size * 1.4}px ${p.hue})` : undefined }}
          />
        )
      })}
    </svg>
  )
}

// ─── Curved emerging lines ─────────────────────────────────────────────────
interface Line {
  d: string; length: number; hue: string; delay: number; duration: number; dashLength: number
}

function buildLines(): Line[] {
  const r = mulberry32(0xC0FFEE)
  return Array.from({ length: 10 }, (_, i) => {
    const edge = Math.floor(r() * 4)
    let sx = 500, sy = 500
    const m = 40
    if (edge === 0) { sx = r() * 1000;    sy = -m }
    if (edge === 1) { sx = 1000 + m;       sy = r() * 1000 }
    if (edge === 2) { sx = r() * 1000;    sy = 1000 + m }
    if (edge === 3) { sx = -m;             sy = r() * 1000 }
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

    // Approximate arc length of the quadratic curve (sample 16 points).
    const samples = 16
    let len = 0
    let lastX = sx, lastY = sy
    for (let s = 1; s <= samples; s++) {
      const u = s / samples
      const x = (1 - u) * (1 - u) * sx + 2 * (1 - u) * u * cpX + u * u * ex
      const y = (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * cpY + u * u * ey
      len += Math.hypot(x - lastX, y - lastY)
      lastX = x; lastY = y
    }

    return {
      d: `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cpX.toFixed(1)} ${cpY.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`,
      length: len,
      hue: r() > 0.55 ? C.primary : C.secondary,
      delay: F.linesStart + i * 7,                   // 7 frames stagger ≈ 117ms
      duration: Math.round((1.8 + r() * 0.6) * FPS),
      dashLength: 0.14 + r() * 0.10,
    }
  })
}

function EmergingLines() {
  const frame = useCurrentFrame()
  const lines = useMemo(buildLines, [])
  return (
    <svg
      width={W} height={H}
      style={{ position: 'absolute', inset: 0 }}
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid slice"
    >
      {lines.map((l, i) => {
        // 0-1 progress for this line's lifecycle
        const p = interpolate(frame, [l.delay, l.delay + l.duration], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.ink,
        })
        // Visible only during its lifecycle window
        const visible = frame >= l.delay && frame < l.delay + l.duration + 12
        if (!visible) return null

        // pathOffset moves the dash from before the path start to past the end.
        // strokeDashoffset uses the path's measured length.
        const dashLen   = l.length * l.dashLength
        const offset    = -dashLen + p * (l.length + dashLen * 2)
        // Soft fade in + out
        const opacity = interpolate(p, [0, 0.12, 0.78, 1], [0, 0.85, 0.85, 0])

        return (
          <g key={i}>
            {/* Blurred trail */}
            <path
              d={l.d}
              stroke={l.hue}
              strokeWidth={3.2}
              strokeLinecap="round"
              fill="none"
              opacity={opacity * 0.26}
              strokeDasharray={`${dashLen * 1.6} ${l.length * 4}`}
              strokeDashoffset={-offset}
              style={{ filter: 'blur(3px)' }}
            />
            {/* Crisp leading edge */}
            <path
              d={l.d}
              stroke={l.hue}
              strokeWidth={1.2}
              strokeLinecap="round"
              fill="none"
              opacity={opacity}
              strokeDasharray={`${dashLen} ${l.length * 4}`}
              strokeDashoffset={-offset}
              style={{ filter: `drop-shadow(0 0 4px ${l.hue})` }}
            />
          </g>
        )
      })}
    </svg>
  )
}

// ─── Logo assembly ─────────────────────────────────────────────────────────
function LogoAssemble() {
  const frame = useCurrentFrame()

  // Clip-path circle expand 0% → 80% at centre
  const clipRadius = interpolate(
    frame,
    [F.logoStart, F.logoStart + F.logoStrokes],
    [0, 80],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.ink },
  )
  // Main opacity ramp
  const opacity = interpolate(
    frame,
    [F.logoStart + 6, F.logoStart + Math.round(F.logoStrokes * 0.55)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.ink },
  )
  // Settle scale + lock pulse (two keyframes in sequence)
  const settle = interpolate(
    frame,
    [F.logoStart, F.logoStart + Math.round(F.logoStrokes * 0.62)],
    [0.92, 1.0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.apple },
  )
  const pulse = interpolate(
    frame,
    [F.logoLock - 4, F.logoLock + 14, F.logoLock + 32],
    [1.0, 1.045, 1.0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )
  const scale = settle * pulse

  // Bloom opacity
  const bloomOpacity = interpolate(
    frame,
    [F.logoStart + 9, F.logoStart + 42, F.logoStart + 100],
    [0, 0.5, 0.4],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.ink },
  )
  // Focus-pull (blurred ghost copy fading through)
  const ghostOpacity = interpolate(
    frame,
    [F.logoStart + 3, F.logoStart + Math.round(F.logoStrokes * 0.5), F.logoStart + F.logoStrokes],
    [0, 0.6, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.ink },
  )

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'relative',
        width: 420, height: 420,
        transform: `scale(${scale})`,
        transformOrigin: '50% 50%',
      }}>
        {/* Bloom */}
        <div style={{
          position: 'absolute', inset: '-22%',
          background: `radial-gradient(circle, rgba(79, 124, 255, 0.28) 0%, rgba(102, 217, 255, 0.10) 38%, transparent 70%)`,
          filter: 'blur(18px)',
          opacity: bloomOpacity,
        }} />
        {/* Main mark */}
        <img
          src={staticFile('kairo_logo.png')}
          alt="Kairo"
          draggable={false}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'contain',
            opacity,
            clipPath:        `circle(${clipRadius}% at 50% 50%)`,
            WebkitClipPath:  `circle(${clipRadius}% at 50% 50%)`,
            filter: 'drop-shadow(0 0 20px rgba(79, 124, 255, 0.30))',
          }}
        />
        {/* Blurred focus-pull */}
        <img
          src={staticFile('kairo_logo.png')}
          alt=""
          aria-hidden
          draggable={false}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'contain',
            opacity: ghostOpacity,
            filter: 'blur(14px) saturate(120%)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  )
}

// ─── Wordmark + tagline ────────────────────────────────────────────────────
interface CaptionPartProps {
  text: string
  startFrame: number
  duration: number
  fontSize: number
  fontWeight: number
  letterSpacing: number
  color: string
  liftPx: number
  blurStart: number
  uppercase?: boolean
  glow?: string
  endOpacity?: number
}

function CaptionPart({
  text, startFrame, duration, fontSize, fontWeight, letterSpacing, color,
  liftPx, blurStart, uppercase, glow, endOpacity = 1,
}: CaptionPartProps) {
  const frame = useCurrentFrame()
  const t = interpolate(
    frame, [startFrame, startFrame + duration], [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.linear },
  )
  const opacity = t * endOpacity
  const y       = liftPx * (1 - t)
  const blur    = blurStart * (1 - t)
  return (
    <div style={{
      fontSize, fontWeight, letterSpacing, color,
      lineHeight: 1,
      textTransform: uppercase ? 'uppercase' : undefined,
      opacity,
      transform: `translateY(${y}px)`,
      filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
      textShadow: glow,
    }}>
      {text}
    </div>
  )
}

function Caption() {
  return (
    <div style={{
      position: 'absolute',
      left: '50%', top: 'calc(50% + 270px)',
      transform: 'translate(-50%, 0)',
      textAlign: 'center', pointerEvents: 'none',
      fontFamily: '-apple-system, "SF Pro Display", "Inter", system-ui, sans-serif',
      width: 'max-content',
    }}>
      <CaptionPart
        text="KAIRO"
        startFrame={F.wordmarkIn}
        duration={Math.round(0.75 * FPS)}
        fontSize={56}
        fontWeight={800}
        letterSpacing={-1.1}
        color={C.text}
        liftPx={14}
        blurStart={8}
      />
      <div style={{ height: 18 }} />
      <CaptionPart
        text="YOUR AI EDUCATION SYSTEM"
        startFrame={F.taglineIn}
        duration={Math.round(0.65 * FPS)}
        fontSize={15}
        fontWeight={600}
        letterSpacing={4.8}
        color="rgba(255, 255, 255, 0.85)"
        liftPx={10}
        blurStart={6}
        uppercase
        glow="0 0 12px rgba(79, 124, 255, 0.18)"
        endOpacity={0.78}
      />
    </div>
  )
}

// ─── Vignette ──────────────────────────────────────────────────────────────
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

// ─── Composition root ──────────────────────────────────────────────────────
export default function KairoLoaderClip() {
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
      <ParticleField />
      <EmergingLines />
      <LogoAssemble />
      <Caption />
      <Vignette />
    </AbsoluteFill>
  )
}
