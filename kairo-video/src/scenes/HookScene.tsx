/**
 * HookScene — the exact 6 beats from the Canva file:
 *   WANNA · SEE · SOMETHING · COOL · MEET · kairo
 *
 * 7 seconds total at 30 fps = 210 frames.
 * Each beat lives 30 frames (~1.0 s) with the spring-pop animation.
 */
import { AbsoluteFill } from 'remotion'
import { Aura } from '../components/Aura'
import { SparkleField } from '../components/SparkleField'
import { BigBeat } from '../components/BigBeat'

const BEAT = 30   // frames per beat
const BEATS = [
  { text: 'WANNA',     size: 340 },
  { text: 'SEE',       size: 380 },
  { text: 'SOMETHING', size: 240 },     // longer word → smaller font
  { text: 'COOL',      size: 380 },
  { text: 'MEET',      size: 360 },
  { text: 'kairo',     size: 420, gradient: true },
]

export const HookScene: React.FC = () => {
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Aura />
      <SparkleField />
      {BEATS.map((b, i) => (
        <BigBeat
          key={b.text}
          text={b.text}
          start={i * BEAT}
          hold={20}
          size={b.size}
          gradient={b.gradient}
        />
      ))}
    </AbsoluteFill>
  )
}

export const HOOK_DURATION = BEATS.length * BEAT  // 180 frames = 6 s
