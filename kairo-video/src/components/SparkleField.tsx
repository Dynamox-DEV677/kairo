/**
 * SparkleField — the constant decorative layer. Matches the 4-corner sparkle
 * placement from the Canva file, plus two extra title-row sparkles for the
 * cinematic motion we added during the edit pass.
 */
import { AbsoluteFill } from 'remotion'
import { Sparkle } from './Sparkle'

interface Props {
  /** Scale all sparkles (handy for vertical/portrait re-renders). */
  scale?: number
  /** Override the default 4-corner + 2-mid layout with custom positions. */
  custom?: Array<{ top: number; left: number; size?: number; delay?: number }>
}

export const SparkleField: React.FC<Props> = ({ scale = 1, custom }) => {
  // Canva file placement, in 1920×1080 px coordinates
  const defaultStars = [
    { top: 80,   left: 1620, size: 90, delay: 0  },
    { top: 720,  left: 100,  size: 90, delay: 6  },
    { top: 220,  left: 320,  size: 90, delay: 12 },
    { top: 720,  left: 1450, size: 90, delay: 18 },
    // Title-row extras
    { top: 460,  left: 920,  size: 68, delay: 24 },
    { top: 860,  left: 940,  size: 56, delay: 30 },
  ]
  const stars = custom ?? defaultStars

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {stars.map((s, i) => (
        <Sparkle
          key={i}
          top={s.top}
          left={s.left}
          size={(s.size ?? 80) * scale}
          delay={s.delay ?? 0}
          pulseFrames={50 + (i % 3) * 10}
        />
      ))}
    </AbsoluteFill>
  )
}
