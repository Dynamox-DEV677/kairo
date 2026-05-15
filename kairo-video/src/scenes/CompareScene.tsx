/**
 * CompareScene — the differentiator.
 *   WHY KAIRO?
 *   BYJU'S = videos
 *   KHAN = lectures
 *   KAIRO = a twin that learns YOU
 *
 * Each line slides in from the side. Kairo's row gets the purple gradient
 * + a small "winner" pill.
 * 7 seconds total.
 */
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion'
import { Aura } from '../components/Aura'
import { SparkleField } from '../components/SparkleField'
import { C, FONT } from '../theme'

const ROWS = [
  { left: "BYJU'S",  right: 'pre-recorded videos',     accent: false },
  { left: 'KHAN',    right: 'one-size lectures',       accent: false },
  { left: 'KAIRO',   right: 'a twin that learns YOU',  accent: true  },
]

const ROW_DELAY = 30   // 1 s between rows
const DURATION  = 210  // 7 s

export const CompareScene: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const titleS = spring({ frame, fps, config: { stiffness: 240, damping: 18 } })

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Aura />
      <SparkleField />

      {/* Section title */}
      <div style={{
        position: 'absolute', top: 100, left: 0, right: 0,
        textAlign: 'center',
        transform: `translateY(${(1 - titleS) * 20}px) scale(${titleS})`,
        opacity: titleS,
      }}>
        <div style={{
          fontFamily: FONT.family, fontWeight: 900,
          fontSize: 200, color: C.text, letterSpacing: -4, lineHeight: 1,
          textShadow: '0 0 40px rgba(167,139,250,0.4)',
        }}>
          WHY KAIRO?
        </div>
      </div>

      {/* Comparison rows */}
      <div style={{
        position: 'absolute', top: 420, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30,
      }}>
        {ROWS.map((row, i) => {
          const rowStart = 30 + i * ROW_DELAY
          const enter = spring({
            frame: frame - rowStart, fps,
            config: { stiffness: 220, damping: 22 },
          })
          const xSlide = interpolate(enter, [0, 1], [-120, 0])
          const opacity = interpolate(enter, [0, 1], [0, 1])

          return (
            <div
              key={row.left}
              style={{
                display: 'flex', alignItems: 'center', gap: 36,
                opacity, transform: `translateX(${xSlide}px)`,
                padding: '20px 40px', borderRadius: 24,
                background: row.accent
                  ? 'linear-gradient(135deg, rgba(196,181,253,0.20), rgba(124,58,237,0.10))'
                  : 'rgba(255,255,255,0.04)',
                border: row.accent
                  ? '2px solid rgba(196,181,253,0.55)'
                  : '1px solid rgba(255,255,255,0.08)',
                boxShadow: row.accent
                  ? '0 16px 40px rgba(124,58,237,0.4)'
                  : 'none',
                minWidth: 1400,
              }}
            >
              <div style={{
                fontFamily: FONT.family, fontWeight: 900,
                fontSize: 100, letterSpacing: -2, lineHeight: 1,
                color: row.accent ? 'transparent' : C.textDim,
                background: row.accent
                  ? 'linear-gradient(135deg, #e9d5ff, #a78bfa, #7c3aed)'
                  : 'none',
                WebkitBackgroundClip: row.accent ? 'text' : undefined,
                backgroundClip: row.accent ? 'text' : undefined,
                WebkitTextFillColor: row.accent ? 'transparent' : undefined,
                minWidth: 320,
              }}>
                {row.left}
              </div>
              <div style={{
                fontFamily: FONT.family, fontWeight: FONT.semi,
                fontSize: 48, color: row.accent ? C.text : C.textFaint,
              }}>
                = {row.right}
              </div>
              {row.accent && (
                <div style={{
                  marginLeft: 'auto',
                  padding: '8px 18px', borderRadius: 999,
                  background: '#c4b5fd', color: '#000',
                  fontFamily: FONT.family, fontWeight: 900,
                  fontSize: 22, letterSpacing: 2,
                }}>
                  YOU
                </div>
              )}
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

export const COMPARE_DURATION = DURATION
