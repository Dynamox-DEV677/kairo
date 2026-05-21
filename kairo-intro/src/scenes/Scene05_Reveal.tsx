/**
 * Scene 05 — Reveal (30-38s)
 *
 * The K locks in. A soft pulse (4% scale spike) marks the lock. Then
 * `KAIRO` types in below via a clip-path letter-sweep, followed by
 * the tagline `YOUR AI EDUCATION SYSTEM`.
 *
 * The letter-sweep masks each glyph from below with a rect that
 * retreats over 12 frames per letter, staggered by ~70ms. Feels
 * closer to film typography than a fade-up — every letter has a
 * leading edge that "wipes" onto the canvas.
 *
 * This is the most visible 8 seconds of the intro — every motion
 * here is hand-tuned. If you tweak anything, watch the result twice
 * (real-time) before declaring it "right".
 */
import { useCurrentFrame } from 'remotion'
import { sceneProgress, BEATS } from '../config/timing'
import { MOTION } from '../config/motion'
import { COLORS } from '../config/colors'
import { APPLE, PULSE, LINEAR_R, sub } from '../lib/easings'
import KairoMark     from '../primitives/KairoMark'
import ParticleField from '../primitives/ParticleField'
import DepthFog      from '../primitives/DepthFog'

const WORDMARK = 'KAIRO'
const TAGLINE  = 'YOUR AI EDUCATION SYSTEM'

export default function Scene05_Reveal() {
  // Now that <Sequence> is gone, useCurrentFrame() returns the absolute
  // video frame — so BEATS comparisons and sceneProgress both work
  // against the same clock without needing a prop.
  const frame = useCurrentFrame()
  const p     = sceneProgress('reveal', frame)

  // K is fully drawn by start of scene; fill ramps over 0-15%
  const fillProgress = APPLE(sub(p, 0, 0.15))

  // Lock pulse — fires at BEATS.logoLock (a couple frames into the scene)
  const lockElapsed = frame - BEATS.logoLock
  const pulseWindow = 18                // frames the pulse takes
  const pulseT      = clamp01(lockElapsed / pulseWindow)
  const pulse       = MOTION.LOGO_LOCK_PULSE_AMP *
                      (1 - PULSE(pulseT)) * (lockElapsed >= 0 ? 1 : 0)

  return (
    <>
      <DepthFog vignette={0.62} tint={0.50} />
      <ParticleField mode="orbital" intensity={APPLE(sub(p, 0.10, 0.70))} />

      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 56,
        pointerEvents: 'none',
      }}>
        {/* The K */}
        <KairoMark
          drawProgress={1}
          fillProgress={fillProgress}
          size={MOTION.LOGO_SIZE_PX}
          pulse={pulse}
        />

        {/* Wordmark + tagline */}
        <div style={{ textAlign: 'center', userSelect: 'none' }}>
          <SweepText
            text={WORDMARK}
            startFrame={BEATS.textKairoIn}
            currentFrame={frame}
            letterStaggerMs={MOTION.LETTER_STAGGER_MS}
            letterDurationMs={MOTION.LETTER_DURATION_MS}
            fontSize={94}
            letterSpacing={-2.4}
            color={COLORS.text}
            fontWeight={800}
          />
          <div style={{ height: 22 }} />
          <SweepText
            text={TAGLINE}
            startFrame={BEATS.textTaglineIn}
            currentFrame={frame}
            letterStaggerMs={MOTION.TAGLINE_LETTER_MS}
            letterDurationMs={520}
            fontSize={14}
            letterSpacing={6.4}
            color={'rgba(255, 255, 255, 0.78)'}
            fontWeight={600}
            uppercase
          />
        </div>
      </div>
    </>
  )
}

/* ────────────────────────────────────────────────────────────────────
   SweepText — letter-by-letter clip-path wipe.

   Each letter is wrapped in a span with an animated `clip-path` rect
   that starts at `inset(0 0 100% 0)` (fully masked from below) and
   retreats to `inset(0)` over `letterDurationMs`. Letters start in
   sequence with `letterStaggerMs` gap.
   ──────────────────────────────────────────────────────────────────── */
interface SweepProps {
  text: string
  startFrame: number
  currentFrame: number
  letterStaggerMs: number
  letterDurationMs: number
  fontSize: number
  letterSpacing: number
  color: string
  fontWeight: number
  uppercase?: boolean
}

function SweepText({
  text, startFrame, currentFrame,
  letterStaggerMs, letterDurationMs,
  fontSize, letterSpacing, color, fontWeight, uppercase,
}: SweepProps) {
  const fps = 60 // matches config/timing
  const letters = [...text]
  return (
    <div style={{
      fontFamily: 'var(--kairo-font)',
      fontSize, color, fontWeight,
      letterSpacing,
      textTransform: uppercase ? 'uppercase' : undefined,
      lineHeight: 1,
      display: 'inline-flex',
    }}>
      {letters.map((ch, i) => {
        const letterStartF = startFrame + (i * letterStaggerMs * fps) / 1000
        const elapsedF     = currentFrame - letterStartF
        const t            = clamp01(elapsedF / ((letterDurationMs * fps) / 1000))
        const eased        = LINEAR_R(t)
        // clip-path inset bottom retreats from 100% → 0%
        const insetBottom  = (1 - eased) * 100
        // Lift letter up slightly during reveal — adds dimensionality
        const ty           = (1 - eased) * 8
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              transform: `translateY(${ty}px)`,
              clipPath: `inset(0 0 ${insetBottom}% 0)`,
              WebkitClipPath: `inset(0 0 ${insetBottom}% 0)`,
              willChange: 'clip-path, transform',
              // Preserve spacing on the space character
              minWidth: ch === ' ' ? '0.4em' : undefined,
            }}
          >
            {ch === ' ' ? ' ' : ch}
          </span>
        )
      })}
    </div>
  )
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
