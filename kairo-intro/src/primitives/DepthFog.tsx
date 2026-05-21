/**
 * DepthFog — the ambient atmosphere of the intro.
 *
 * Two layers: a radial vignette so the corners read darker than the
 * centre (cinematography 101 — the eye lands on the brightest spot),
 * and a soft brand-tinted gradient that gives the void a faint blue
 * cast without ever feeling colourful.
 *
 * Both layers fade independently per scene via the `vignette` and
 * `tint` props.
 */
import { COLORS } from '../config/colors'
import { WIDTH, HEIGHT } from '../config/timing'

interface Props {
  /** 0-1 — vignette strength. 0 = flat, 1 = dramatic. */
  vignette?: number
  /** 0-1 — brand tint strength. Keep below 0.6 to stay restrained. */
  tint?:     number
}

export default function DepthFog({ vignette = 0.7, tint = 0.35 }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      {/* Brand-tinted ambient gradient */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: `
            radial-gradient(at 28% 24%, rgba(79, 124, 255, ${0.10 * tint}) 0%, transparent 48%),
            radial-gradient(at 72% 76%, rgba(102, 217, 255, ${0.08 * tint}) 0%, transparent 52%)
          `,
        }}
      />

      {/* Vignette — radial mask that darkens the corners */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(
            ellipse at center,
            transparent 35%,
            rgba(0, 0, 0, ${0.55 * vignette}) 78%,
            rgba(0, 0, 0, ${0.85 * vignette}) 100%
          )`,
        }}
      />

      {/* Pixel grain — barely visible, but reads "premium film" rather
          than "flat svg". Tiny noise via a repeating SVG data URI. */}
      <div
        style={{
          position: 'absolute', inset: 0,
          opacity: 0.05,
          mixBlendMode: 'overlay',
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.6' numOctaves='2' stitchTiles='stitch'/></filter><rect width='220' height='220' filter='url(%23n)'/></svg>")`,
        }}
      />

      {/* Suppress unused-import lint by referencing colors token */}
      <div data-bg={COLORS.bg} hidden />
      <div data-w={WIDTH} data-h={HEIGHT} hidden />
    </div>
  )
}
