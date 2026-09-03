/**
 * KairoIndustries — the clean company intro.
 *
 * Deliberately restrained: this is the mark's introduction, not a showreel.
 * One signature moment (a light sweep travelling across the K), everything
 * else quiet. Six seconds, no cuts, no camera moves.
 *
 * Timeline (150 frames @ 25fps = 6.0s)
 *   000-030  black holds, faint halo blooms
 *   012-060  mark fades up and settles from 1.06 -> 1.00
 *   058-086  light sweep travels across the mark
 *   070-100  hairline draws outward from centre
 *   078-108  KAIRO INDUSTRIES letterspaces in beneath
 *   132-150  whole frame fades to black
 *
 * The logo asset is white-on-transparent, so it needs no blend tricks —
 * but `screen` is applied anyway so a black-backed export of the same mark
 * would still composite correctly.
 */
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { COLORS } from './config/colors'

export const KI_FPS = 25
export const KI_DURATION_F = 150

/** Gentle, expensive-feeling ease. Nothing in this piece should snap. */
const EASE = (t: number) => 1 - Math.pow(1 - t, 3)

/** interpolate with the house easing and hard clamping. */
const ramp = (frame: number, from: number, to: number, a: number, b: number) =>
  interpolate(frame, [from, to], [a, b], {
    easing: EASE,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

export const KairoIndustries: React.FC = () => {
  const f = useCurrentFrame()

  // ── mark ──
  const markOpacity = ramp(f, 12, 60, 0, 1)
  const markScale = ramp(f, 12, 72, 1.06, 1)

  // ── halo behind the mark: blooms early, then recedes so it never competes ──
  const haloIn = ramp(f, 0, 46, 0, 1)
  const haloSettle = ramp(f, 60, 110, 1, 0.55)
  const halo = haloIn * haloSettle

  // ── signature: a light sweep crossing the mark once ──
  const sweepP = ramp(f, 58, 86, 0, 1)
  const sweepVisible = f >= 58 && f <= 88
  const sweepX = interpolate(sweepP, [0, 1], [-45, 145])

  // ── hairline draws outward from the centre ──
  const ruleW = ramp(f, 70, 100, 0, 300)
  const ruleOpacity = ramp(f, 70, 92, 0, 1)

  // ── wordmark ──
  const wordOpacity = ramp(f, 78, 108, 0, 1)
  const wordSpacing = ramp(f, 78, 116, 0.62, 0.34) // em — settles inward
  const wordLift = ramp(f, 78, 108, 10, 0)

  // ── final fade ──
  const out = ramp(f, 132, 150, 1, 0)

  return (
    <AbsoluteFill style={{ background: COLORS.bg, opacity: out }}>
      {/* atmosphere — a single soft bloom, well under the 32% alpha ceiling */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 44%, ${COLORS.primaryGlow12} 0%, rgba(79,124,255,0.04) 34%, transparent 62%)`,
          opacity: halo,
        }}
      />

      {/* mark */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            position: 'relative',
            // The source art has generous internal padding, so the container
            // has to run large for the K itself to read at 1080p.
            width: 660,
            height: 660,
            marginTop: -58,
            opacity: markOpacity,
            transform: `scale(${markScale})`,
          }}
        >
          <Img
            src={staticFile('kairo_industries_mark.png')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              mixBlendMode: 'screen',
            }}
          />

          {/* the sweep: a narrow bright band, masked to the mark itself */}
          {sweepVisible && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                WebkitMaskImage: `url(${staticFile('kairo_industries_mark.png')})`,
                maskImage: `url(${staticFile('kairo_industries_mark.png')})`,
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
                background: `linear-gradient(105deg,
                  transparent ${sweepX - 18}%,
                  ${COLORS.secondary} ${sweepX}%,
                  transparent ${sweepX + 18}%)`,
                opacity: 0.85 * Math.sin(sweepP * Math.PI), // in and out, no pop
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      </AbsoluteFill>

      {/* wordmark block */}
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          // Sits close enough to the mark to read as one lockup.
          marginTop: 330,
          gap: 24,
        }}
      >
        <div
          style={{
            width: ruleW,
            height: 1,
            opacity: ruleOpacity,
            background: `linear-gradient(90deg, transparent, ${COLORS.hairlineWarm}, rgba(165,180,252,0.42), ${COLORS.hairlineWarm}, transparent)`,
          }}
        />

        <div
          style={{
            opacity: wordOpacity,
            transform: `translateY(${wordLift}px)`,
            fontFamily: '-apple-system, "SF Pro Display", "Inter", system-ui, sans-serif',
            fontSize: 27,
            fontWeight: 300,
            letterSpacing: `${wordSpacing}em`,
            // letter-spacing pads the right edge; nudge back so it reads centred
            textIndent: `${wordSpacing}em`,
            color: COLORS.text,
            whiteSpace: 'nowrap',
          }}
        >
          KAIRO INDUSTRIES
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

export default KairoIndustries
