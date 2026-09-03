/**
 * Typography layer.
 *
 * Kept in the DOM rather than as 3D text on purpose: HTML text renders with
 * subpixel-accurate hinting at any output scale, where MSDF/extruded 3D type
 * softens and needs a font atlas. The 3D scene sits behind; the type composites
 * over it — which is also how real broadcast packages are built.
 *
 * Reveals are mask-based (a clip travelling over stationary text), never a
 * scale-bounce. Tracking tightens slightly as each line settles, an old title-
 * design trick that makes words feel like they're locking into place.
 */
import { useCurrentFrame } from 'remotion'
import { TYPE, COLOR } from '../../constants/theme'
import { SCENE, WORD_BEATS, FPS } from '../../constants/timeline'
import { envelope, ramp, progress, TYPE_IN, CINEMA } from '../../lib/easing'

/** A single line revealed behind a travelling mask. */
function MaskedLine({
  children,
  fromSec,
  toSec,
  size,
  weight = TYPE.displayWeight,
  tracking = TYPE.displayTracking,
  color = COLOR.light,
  opacityScale = 1,
}: {
  children: React.ReactNode
  fromSec: number
  toSec: number
  size: number
  weight?: number
  tracking?: number
  color?: string
  opacityScale?: number
}) {
  const frame = useCurrentFrame()
  // Envelope must fit INSIDE the beat or the line never reaches full opacity.
  // Derived from the window rather than hard-coded so re-pacing can't break it.
  const span = Math.max(0.4, toSec - fromSec)
  const fadeIn = Math.min(0.42, span * 0.30)
  const fadeOut = Math.min(0.40, span * 0.28)

  const reveal = progress(frame, fromSec, fromSec + Math.min(0.62, span * 0.42), TYPE_IN)
  const alpha = envelope(frame, fromSec, toSec, fadeIn, fadeOut) * opacityScale
  // tracking eases from wide → designed value as the line settles
  const track = ramp(frame, fromSec, fromSec + span * 0.75, tracking + 0.30, tracking, CINEMA)
  const lift = ramp(frame, fromSec, fromSec + span * 0.7, 12, 0, TYPE_IN)

  if (alpha < 0.002) return null

  return (
    <div
      style={{
        overflow: 'hidden',
        opacity: alpha,
        // mask sweeps left→right, revealing the glyphs already in position
        clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0)`,
      }}
    >
      <div
        style={{
          fontFamily: TYPE.stack,
          fontSize: size,
          fontWeight: weight,
          letterSpacing: `${track}em`,
          color,
          lineHeight: 1.08,
          transform: `translateY(${lift}px)`,
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export default function CinematicType() {
  const frame = useCurrentFrame()
  const t = frame / FPS

  // Endplate: the only lower-case, non-tracked text in the film — it reads as
  // a signature after 30 seconds of wide capitals.
  const endAlpha = envelope(frame, SCENE.signoff.from + 1.0, SCENE.signoff.to, 1.3, 1.1)
  const ruleW = ramp(frame, SCENE.signoff.from + 1.5, SCENE.signoff.to - 0.6, 0, 216, CINEMA)

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        // no background: the 3D layer shows through
      }}
    >
      {/* ── Scene 5: the five verbs, centred, one at a time ── */}
      {WORD_BEATS.map(({ word, from, to }) => (
        <div
          key={word}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaskedLine fromSec={from} toSec={to} size={104} weight={200} tracking={0.30}>
            {word}
          </MaskedLine>
        </div>
      ))}

      {/* ── Scene 6: endplate ── */}
      {endAlpha > 0.002 && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 300,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            opacity: endAlpha,
          }}
        >
          <div
            style={{
              fontFamily: TYPE.stack,
              fontSize: 56,
              fontWeight: 300,
              letterSpacing: '0.44em',
              color: COLOR.light,
              // survives the vignette + soft-light grade sitting over this layer
              textShadow: '0 2px 26px rgba(0,0,0,0.9)',
              textTransform: 'uppercase',
              // optical correction: wide tracking pushes the block right, pull it back
              textIndent: '0.46em',
            }}
          >
            Kairo Industries
          </div>

          {/* hairline rule grows out from centre */}
          <div
            style={{
              width: ruleW,
              height: 1,
              marginTop: 30,
              background: `linear-gradient(90deg, transparent, ${COLOR.titanium}, transparent)`,
              opacity: 0.55,
            }}
          />

          <div
            style={{
              marginTop: 28,
              fontFamily: TYPE.stack,
              fontSize: 24,
              fontWeight: TYPE.captionWeight,
              letterSpacing: '0.20em',
              color: 'rgba(255,255,255,0.86)',
              textShadow: '0 2px 20px rgba(0,0,0,0.9)',
            }}
          >
            Building the Future of Education
          </div>
        </div>
      )}

      {/* Final fade to black — the film ends on nothing, deliberately. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: COLOR.void,
          opacity: t < SCENE.signoff.to - 1.0 ? 0 : progress(frame, SCENE.signoff.to - 1.0, SCENE.signoff.to, CINEMA),
        }}
      />
    </div>
  )
}
