/**
 * DashboardScene — the wow moment.
 * Dashboard mockup slides up from the bottom while a side caption types in:
 *   "IT LEARNS HOW YOU STUDY"
 * 10 seconds total.
 */
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion'
import { Aura } from '../components/Aura'
import { SparkleField } from '../components/SparkleField'
import { DashboardMock } from '../components/DashboardMock'
import { BigBeat } from '../components/BigBeat'
import { C, FONT } from '../theme'

const DURATION = 300  // 10 s

export const DashboardScene: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  // The mockup slides up + tilts back, anchored 75% width
  const enter = spring({ frame, fps, config: { stiffness: 200, damping: 22 } })
  const tilt  = interpolate(enter, [0, 1], [12, -4])
  const ty    = interpolate(enter, [0, 1], [60, 0])

  // Caption typewriter
  const caption = 'IT LEARNS HOW YOU STUDY'
  const chars = Math.floor(interpolate(frame, [60, 130], [0, caption.length], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  }))

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Aura intensity={0.9} />
      <SparkleField />

      {/* Dashboard pinned to the right half */}
      <div style={{
        position: 'absolute',
        top: 0, bottom: 0, right: 60,
        width: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `translateY(${ty}px) rotateY(${tilt}deg)`,
        transformOrigin: 'center',
      }}>
        <DashboardMock start={4} />
      </div>

      {/* Caption pinned to the left half */}
      <div style={{
        position: 'absolute',
        top: 0, bottom: 0, left: 80,
        width: 1080,
        display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start', justifyContent: 'center',
        padding: '0 40px',
        gap: 24,
      }}>
        <div style={{
          fontFamily: FONT.family, fontWeight: FONT.semi,
          fontSize: 22, color: C.purpleLite,
          letterSpacing: 3, textTransform: 'uppercase',
        }}>
          The dashboard
        </div>
        <div style={{
          fontFamily: FONT.family, fontWeight: 900,
          fontSize: 130, color: C.text,
          letterSpacing: -3, lineHeight: 0.95,
          maxWidth: 980,
          textShadow: '0 0 40px rgba(196,181,253,0.4)',
        }}>
          {caption.slice(0, chars)}
          {chars < caption.length && (
            <span style={{
              display: 'inline-block', width: 8, height: 110,
              marginLeft: 8, verticalAlign: 'middle',
              background: C.purpleLite, borderRadius: 3,
              animation: 'none',
              opacity: Math.floor(frame / 6) % 2 === 0 ? 1 : 0,
            }} />
          )}
        </div>
        <div style={{
          fontFamily: FONT.family, fontWeight: FONT.semi,
          fontSize: 24, color: C.textDim,
          maxWidth: 900, lineHeight: 1.4,
        }}>
          Ebbinghaus forgetting curves · weakness heatmap · live mastery score.
        </div>
      </div>

      {/* "Live" overlay beat — confirms the surface is updating in real time */}
      {frame > 200 && (
        <BigBeat
          text="IT REMEMBERS YOU"
          start={210}
          hold={50}
          size={200}
          gradient
        />
      )}
    </AbsoluteFill>
  )
}

export const DASHBOARD_DURATION = DURATION
