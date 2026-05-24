/**
 * KairoTeaser — Apple-style ~28s product reveal.
 *
 *  0–3s   COSMIC DUST OPENER — pitch black, purple particles drift in,
 *         a single point of light grows. Setting the mood.
 *
 *  3–7s   WORD STACK — STUDY · FOCUS · MASTER land one at a time in the
 *         purple gradient style from the reference. Each word breathes,
 *         dissolves, the next arrives.
 *
 *  7–10s  COLOR TRANSITION — the purple slowly bends to Kairo blue
 *         (#4F7CFF → #66D9FF). Particles re-tint. Reads as warp/lightspeed.
 *
 *  10–14s KAIRO REVEAL — wordmark fills the frame in blue gradient, slow
 *         zoom + glow. The brand moment.
 *
 *  14–22s FEATURE MONTAGE — four hero cards fly in: Kairo OS · Solver ·
 *         Concept Map · Flashcards. Quick cuts, every-feature reel.
 *
 *  22–26s TAGLINE — "Your AI study companion." Sparse type, lots of air.
 *
 *  26–28s SIGN-OFF — wordmark + URL, fade to black.
 *
 * Everything is rendered with pure Remotion primitives (Easing,
 * interpolate, AbsoluteFill). No Framer Motion — it doesn't survive
 * the frame-by-frame snapshot model Remotion uses.
 */
import { AbsoluteFill, useCurrentFrame, interpolate, Easing, random } from 'remotion'
import { useMemo } from 'react'

// ──────────────────────────────────────────────────────────────────────────
// Timing
// ──────────────────────────────────────────────────────────────────────────
const FPS = 60
const W   = 1920
const H   = 1080

const sec = (s: number) => Math.round(s * FPS)

/** Frame anchors — single source of truth for the whole teaser. */
const F = {
  dustIn:        sec(0.0),
  dustHero:      sec(2.0),

  word1In:       sec(3.0),
  word1Out:      sec(4.2),
  word2In:       sec(4.0),
  word2Out:      sec(5.4),
  word3In:       sec(5.2),
  word3Out:      sec(6.8),

  colorShift:    sec(7.0),
  colorShiftEnd: sec(10.0),

  kairoIn:       sec(10.0),
  kairoLock:     sec(11.5),
  kairoOut:      sec(14.0),

  featuresStart: sec(14.0),
  featuresEnd:   sec(22.0),

  taglineIn:     sec(22.5),
  taglineOut:    sec(26.0),

  signoffIn:     sec(26.0),
  signoffOut:    sec(28.0),
}

export const KAIRO_TEASER_DURATION_F = sec(28)

// ──────────────────────────────────────────────────────────────────────────
// Easings
// ──────────────────────────────────────────────────────────────────────────
const E = {
  // Smooth Apple-style: slow start, slow end. Used for camera & opacity.
  apple:   Easing.bezier(0.42, 0,    0.22, 1),
  // Sharper "land" — text typesettings.
  land:    Easing.bezier(0.16, 1,    0.30, 1),
  // Slow exit — gives the previous beat time to register.
  exitOut: Easing.bezier(0.6,  0,    0.85, 0.4),
}

// ──────────────────────────────────────────────────────────────────────────
// Palette
// ──────────────────────────────────────────────────────────────────────────
const PURPLE = {
  // Matches the reference "COOL" — soft violet, gradient feel.
  light: '#C7AEFF',
  mid:   '#9A6BFF',
  deep:  '#5A2DC9',
}
const BLUE = {
  light: '#A5B4FC',
  mid:   '#66D9FF',
  deep:  '#4F7CFF',
  ink:   '#2046C2',
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────
function mixHex(a: string, b: string, t: number) {
  const ah = a.startsWith('#') ? a.slice(1) : a
  const bh = b.startsWith('#') ? b.slice(1) : b
  const ar = parseInt(ah.slice(0, 2), 16), ag = parseInt(ah.slice(2, 4), 16), ab = parseInt(ah.slice(4, 6), 16)
  const br = parseInt(bh.slice(0, 2), 16), bg = parseInt(bh.slice(2, 4), 16), bb = parseInt(bh.slice(4, 6), 16)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `rgb(${r}, ${g}, ${bl})`
}

/** Fade-in/out window helper — returns [0..1] opacity for a clip from->to->out. */
function window01(frame: number, fadeIn: [number, number], fadeOut: [number, number]) {
  const o1 = interpolate(frame, fadeIn,  [0, 1], { extrapolateRight: 'clamp', easing: E.apple })
  const o2 = interpolate(frame, fadeOut, [1, 0], { extrapolateLeft:  'clamp', extrapolateRight: 'clamp', easing: E.exitOut })
  return Math.min(o1, o2)
}

// ──────────────────────────────────────────────────────────────────────────
// Cosmic dust — drifting particles, color-shifts purple → blue mid-teaser
// ──────────────────────────────────────────────────────────────────────────
function CosmicDust() {
  const frame = useCurrentFrame()
  const N = 140

  // Color blend: 0 = pure purple, 1 = Kairo blue. Animated across colorShift→colorShiftEnd.
  const blend = interpolate(
    frame,
    [F.colorShift, F.colorShiftEnd],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.apple },
  )

  const dots = useMemo(() => Array.from({ length: N }, (_, i) => ({
    x:    random(`dx${i}`) * W,
    y:    random(`dy${i}`) * H,
    r:    1 + random(`dr${i}`) * 2.4,
    flux: 0.4 + random(`df${i}`) * 0.6,
    seed: random(`ds${i}`),
  })), [])

  // Overall opacity envelope — fade in 0→1.5s, hold, then fade slightly
  // during the KAIRO reveal so it doesn't fight the wordmark.
  const op = interpolate(
    frame,
    [F.dustIn, sec(1.5), F.kairoIn, F.kairoLock, F.featuresStart, F.featuresEnd],
    [0,        1,        1,         0.35,        0.55,            0.1],
    { extrapolateRight: 'clamp', easing: E.apple },
  )

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: op }}>
      {dots.map((d, i) => {
        // Gentle drift — sinusoidal X/Y with seeded phase.
        const t  = frame / FPS
        const dx = Math.sin(t * 0.25 + d.seed * 6.28) * 18
        const dy = Math.cos(t * 0.22 + d.seed * 6.28) * 12
        const tw = 0.5 + 0.5 * Math.sin(t * 0.9 + d.seed * 12.6)
        const colorA = mixHex(PURPLE.light, BLUE.light, blend)
        const colorB = mixHex(PURPLE.deep,  BLUE.deep,  blend)
        return (
          <div key={i} style={{
            position: 'absolute',
            left:     d.x + dx,
            top:      d.y + dy,
            width:    d.r * 2,
            height:   d.r * 2,
            borderRadius: '50%',
            background:  `radial-gradient(circle, ${colorA} 0%, ${colorB} 60%, transparent 100%)`,
            opacity:    d.flux * tw,
            filter:     'blur(0.5px)',
            transform:  'translate(-50%, -50%)',
          }} />
        )
      })}
    </AbsoluteFill>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Soft center halo — the "point of light" that grows on the opener
// ──────────────────────────────────────────────────────────────────────────
function CenterHalo() {
  const frame = useCurrentFrame()
  const grow  = interpolate(frame, [F.dustIn, F.dustHero], [0, 1], { extrapolateRight: 'clamp', easing: E.apple })
  const blend = interpolate(frame, [F.colorShift, F.colorShiftEnd], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.apple })

  // Halo fades during KAIRO reveal so wordmark gradient owns the frame.
  const op = interpolate(
    frame,
    [F.dustIn, F.dustHero, F.kairoIn, F.kairoLock, F.taglineIn, F.signoffIn],
    [0,        0.6,        0.6,       0.0,         0.0,         0.4],
    { extrapolateRight: 'clamp' },
  )
  const colorMid = mixHex(PURPLE.mid, BLUE.mid, blend)

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <div style={{
        width:  1200 * grow,
        height: 1200 * grow,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${colorMid}33 0%, ${colorMid}10 30%, transparent 65%)`,
        filter: 'blur(40px)',
      }} />
    </AbsoluteFill>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Word stack — STUDY · FOCUS · MASTER
// ──────────────────────────────────────────────────────────────────────────
function WordStack() {
  const words = [
    { text: 'STUDY',  in: F.word1In, out: F.word1Out },
    { text: 'FOCUS',  in: F.word2In, out: F.word2Out },
    { text: 'MASTER', in: F.word3In, out: F.word3Out },
  ]
  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {words.map(w => <BigWord key={w.text} text={w.text} from={w.in} to={w.out} />)}
    </AbsoluteFill>
  )
}

function BigWord({ text, from, to }: { text: string; from: number; to: number }) {
  const frame = useCurrentFrame()
  // Land: fast in (0.5s), hold, smooth out (0.4s).
  const op = window01(
    frame,
    [from,        from + sec(0.5)],
    [to - sec(0.4), to],
  )
  // Subtle "settle" — letters rise from below and lock.
  const rise = interpolate(frame, [from, from + sec(0.6)], [22, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.land })
  const blur = interpolate(frame, [from, from + sec(0.6)], [10, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.land })

  return (
    <div style={{
      position: 'absolute',
      opacity:  op,
      transform: `translateY(${rise}px)`,
      filter:    `blur(${blur}px)`,
      fontFamily: "'Inter Tight', 'Inter', 'Neue Haas Grotesk Display', system-ui, sans-serif",
      fontWeight: 900,
      fontSize:   220,
      letterSpacing: '-0.04em',
      background: `linear-gradient(180deg, ${PURPLE.light} 0%, ${PURPLE.mid} 55%, ${PURPLE.deep} 100%)`,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor:  'transparent',
      backgroundClip: 'text',
      color: 'transparent',
      textShadow: '0 0 80px rgba(154, 107, 255, 0.35)',
    }}>
      {text}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// KAIRO wordmark — the brand moment
// ──────────────────────────────────────────────────────────────────────────
function KairoMark() {
  const frame = useCurrentFrame()
  const op = window01(
    frame,
    [F.kairoIn, F.kairoIn + sec(1.2)],
    [F.kairoOut - sec(0.8), F.kairoOut],
  )
  // Slow Ken-Burns push: 0.92 → 1.0 over the whole hold.
  const scale = interpolate(
    frame,
    [F.kairoIn, F.kairoOut],
    [0.92, 1.04],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.apple },
  )
  // Initial blur clears as letters lock.
  const blur = interpolate(frame, [F.kairoIn, F.kairoLock], [14, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.apple })

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <div style={{
        transform: `scale(${scale})`,
        filter:    `blur(${blur}px) drop-shadow(0 0 80px rgba(79, 124, 255, 0.45))`,
        fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif",
        fontWeight: 900,
        fontSize:   380,
        letterSpacing: '-0.05em',
        background: `linear-gradient(180deg, #FFFFFF 0%, ${BLUE.light} 30%, ${BLUE.mid} 60%, ${BLUE.deep} 100%)`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor:  'transparent',
        backgroundClip: 'text',
        color: 'transparent',
      }}>
        KAIRO
      </div>
    </AbsoluteFill>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Feature montage — 4 hero cards, ~2s each, slide-in slide-out
// ──────────────────────────────────────────────────────────────────────────
type Feature = { title: string; subtitle: string; icon: 'os' | 'solver' | 'graph' | 'cards' }
const FEATURES: Feature[] = [
  { title: 'Kairo OS',      subtitle: 'Your AI academic twin',          icon: 'os' },
  { title: "Kairo's Solver", subtitle: 'Every doubt, explained.',        icon: 'solver' },
  { title: 'Concept Map',    subtitle: 'See how every idea connects.',   icon: 'graph' },
  { title: 'Flashcards',     subtitle: 'Spaced repetition, automated.',  icon: 'cards' },
]

function FeatureMontage() {
  const span = F.featuresEnd - F.featuresStart
  const per  = span / FEATURES.length
  return (
    <AbsoluteFill>
      {FEATURES.map((f, i) => (
        <FeatureCard
          key={f.title}
          feature={f}
          from={F.featuresStart + i * per}
          to={F.featuresStart + (i + 1) * per}
        />
      ))}
    </AbsoluteFill>
  )
}

function FeatureCard({ feature, from, to }: { feature: Feature; from: number; to: number }) {
  const frame = useCurrentFrame()
  const cardIn  = from + sec(0.2)
  const cardLock = from + sec(0.8)
  const cardOut = to - sec(0.4)

  const op = window01(frame, [cardIn, cardLock], [cardOut, to])
  const slide = interpolate(frame, [cardIn, cardLock], [60, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.land })
  const slideOut = interpolate(frame, [cardOut, to], [0, -40], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.exitOut })

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <div style={{
        transform: `translateY(${slide + slideOut}px)`,
        width:  1100,
        padding: '64px 72px',
        borderRadius: 28,
        background: 'linear-gradient(135deg, rgba(20, 26, 44, 0.85) 0%, rgba(10, 13, 24, 0.85) 100%)',
        border: `1px solid ${BLUE.deep}55`,
        boxShadow: `0 40px 120px rgba(79, 124, 255, 0.18), 0 0 0 1px rgba(255, 255, 255, 0.04) inset`,
        backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', gap: 48,
      }}>
        <FeatureIcon kind={feature.icon} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif",
            fontWeight: 800,
            fontSize:   88,
            letterSpacing: '-0.03em',
            color: '#FFFFFF',
            lineHeight: 1,
            marginBottom: 18,
          }}>
            {feature.title}
          </div>
          <div style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontWeight: 400,
            fontSize:   32,
            letterSpacing: '-0.005em',
            color: '#9CA3AF',
          }}>
            {feature.subtitle}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}

/** Pure-SVG hero icons. No external assets — every frame is deterministic. */
function FeatureIcon({ kind }: { kind: Feature['icon'] }) {
  const size = 160
  const stroke = `url(#grad-${kind})`

  // Subtle pulse — gives the icon life without distracting from text.
  const frame = useCurrentFrame()
  const pulse = 1 + 0.025 * Math.sin(frame * 0.10)

  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      borderRadius: 24,
      background: `linear-gradient(135deg, ${BLUE.deep}26, ${BLUE.deep}0d)`,
      border: `1px solid ${BLUE.deep}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transform: `scale(${pulse})`,
    }}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 100 100" fill="none">
        <defs>
          <linearGradient id={`grad-${kind}`} x1="0" y1="0" x2="100" y2="100">
            <stop offset="0%"  stopColor={BLUE.light} />
            <stop offset="100%" stopColor={BLUE.deep} />
          </linearGradient>
        </defs>
        {kind === 'os' && (
          // CPU / chip icon
          <g stroke={stroke} strokeWidth="4" strokeLinecap="round">
            <rect x="22" y="22" width="56" height="56" rx="10" />
            <rect x="36" y="36" width="28" height="28" rx="4" />
            <line x1="32" y1="14" x2="32" y2="22" /><line x1="50" y1="14" x2="50" y2="22" /><line x1="68" y1="14" x2="68" y2="22" />
            <line x1="32" y1="78" x2="32" y2="86" /><line x1="50" y1="78" x2="50" y2="86" /><line x1="68" y1="78" x2="68" y2="86" />
            <line x1="14" y1="32" x2="22" y2="32" /><line x1="14" y1="50" x2="22" y2="50" /><line x1="14" y1="68" x2="22" y2="68" />
            <line x1="78" y1="32" x2="86" y2="32" /><line x1="78" y1="50" x2="86" y2="50" /><line x1="78" y1="68" x2="86" y2="68" />
          </g>
        )}
        {kind === 'solver' && (
          // Speech bubble + spark
          <g stroke={stroke} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M18 30 A12 12 0 0 1 30 18 H70 A12 12 0 0 1 82 30 V58 A12 12 0 0 1 70 70 H42 L28 84 V70 H30 A12 12 0 0 1 18 58 Z" />
            <path d="M50 32 L54 42 L64 46 L54 50 L50 60 L46 50 L36 46 L46 42 Z" fill={stroke} />
          </g>
        )}
        {kind === 'graph' && (
          // Concept network — nodes + edges
          <g stroke={stroke} strokeWidth="4" strokeLinecap="round" fill={stroke}>
            <line x1="50" y1="20" x2="20" y2="50" /><line x1="50" y1="20" x2="80" y2="50" />
            <line x1="20" y1="50" x2="50" y2="80" /><line x1="80" y1="50" x2="50" y2="80" />
            <line x1="50" y1="20" x2="50" y2="80" />
            <circle cx="50" cy="20" r="8" /><circle cx="20" cy="50" r="8" />
            <circle cx="80" cy="50" r="8" /><circle cx="50" cy="80" r="8" />
          </g>
        )}
        {kind === 'cards' && (
          // Stacked flashcards
          <g stroke={stroke} strokeWidth="4" strokeLinejoin="round" fill="none">
            <rect x="22" y="32" width="50" height="44" rx="6" transform="rotate(-6 47 54)" />
            <rect x="30" y="26" width="50" height="44" rx="6" />
            <line x1="40" y1="40" x2="68" y2="40" />
            <line x1="40" y1="48" x2="62" y2="48" />
            <line x1="40" y1="56" x2="56" y2="56" />
          </g>
        )}
      </svg>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Tagline
// ──────────────────────────────────────────────────────────────────────────
function Tagline() {
  const frame = useCurrentFrame()
  const op = window01(
    frame,
    [F.taglineIn, F.taglineIn + sec(1.2)],
    [F.taglineOut - sec(0.8), F.taglineOut],
  )
  const rise = interpolate(frame, [F.taglineIn, F.taglineIn + sec(1.2)], [18, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.apple })

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <div style={{
        transform: `translateY(${rise}px)`,
        fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif",
        fontWeight: 600,
        fontSize:   88,
        letterSpacing: '-0.025em',
        color: '#FFFFFF',
        textAlign: 'center',
        lineHeight: 1.1,
      }}>
        Your AI study companion.
      </div>
    </AbsoluteFill>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Sign-off — small wordmark + URL, fade to black
// ──────────────────────────────────────────────────────────────────────────
function SignOff() {
  const frame = useCurrentFrame()
  const op = window01(
    frame,
    [F.signoffIn, F.signoffIn + sec(0.6)],
    [F.signoffOut - sec(0.6), F.signoffOut],
  )
  return (
    <AbsoluteFill style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 18, opacity: op,
    }}>
      <div style={{
        fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif",
        fontWeight: 900,
        fontSize:   140,
        letterSpacing: '-0.04em',
        background: `linear-gradient(180deg, #FFFFFF 0%, ${BLUE.light} 60%, ${BLUE.mid} 100%)`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor:  'transparent',
        backgroundClip: 'text',
        color: 'transparent',
        filter: `drop-shadow(0 0 40px rgba(102, 217, 255, 0.25))`,
      }}>
        KAIRO
      </div>
      <div style={{
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        fontSize:   22,
        letterSpacing: 4,
        color: '#9CA3AF',
        textTransform: 'uppercase',
      }}>
        kairo-daily-edu.vercel.app
      </div>
    </AbsoluteFill>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Final fade to black — sits ON TOP of everything for the last 0.5s
// ──────────────────────────────────────────────────────────────────────────
function FinalFade() {
  const frame = useCurrentFrame()
  const op = interpolate(
    frame,
    [F.signoffOut - sec(0.4), F.signoffOut],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.apple },
  )
  return <AbsoluteFill style={{ background: '#000', opacity: op }} />
}

// ──────────────────────────────────────────────────────────────────────────
// Root composition
// ──────────────────────────────────────────────────────────────────────────
export default function KairoTeaser() {
  return (
    <AbsoluteFill style={{
      background: '#050505',
      fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif",
    }}>
      {/* Layer 1 — ambient: dust + halo (always present, tints purple→blue) */}
      <CosmicDust />
      <CenterHalo />

      {/* Layer 2 — scene-specific content */}
      <WordStack />
      <KairoMark />
      <FeatureMontage />
      <Tagline />
      <SignOff />

      {/* Layer 3 — final fade overlay */}
      <FinalFade />
    </AbsoluteFill>
  )
}
