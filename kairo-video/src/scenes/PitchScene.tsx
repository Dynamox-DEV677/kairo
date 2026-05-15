/**
 * PitchScene — Beats 7-9 from the script.
 *   YOUR · AI ACADEMIC · TWIN
 *
 * 5 s total. "TWIN" lands huge with the purple gradient.
 */
import { AbsoluteFill } from 'remotion'
import { Aura } from '../components/Aura'
import { SparkleField } from '../components/SparkleField'
import { BigBeat } from '../components/BigBeat'

const BEATS = [
  { text: 'YOUR',         start: 0,  hold: 22, size: 360 },
  { text: 'AI ACADEMIC',  start: 36, hold: 30, size: 240 },
  { text: 'TWIN',         start: 84, hold: 60, size: 460, gradient: true },
]

export const PitchScene: React.FC = () => (
  <AbsoluteFill style={{ overflow: 'hidden' }}>
    <Aura intensity={1.1} />
    <SparkleField />
    {BEATS.map((b) => (
      <BigBeat key={b.text} {...b} />
    ))}
  </AbsoluteFill>
)

export const PITCH_DURATION = 150  // 5 s
