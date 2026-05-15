/**
 * CTAScene — the close.
 *   TRY · KAIRO (huge logo) · kairo.app
 * 5 seconds total.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, staticFile, Img } from 'remotion'
import { Aura } from '../components/Aura'
import { SparkleField } from '../components/SparkleField'
import { BigBeat } from '../components/BigBeat'
import { C, FONT } from '../theme'

const DURATION = 150  // 5 s

export const CTAScene: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Logo spring entrance at frame 40
  const logoEnter = spring({
    frame: frame - 40, fps, config: { stiffness: 220, damping: 16 },
  })
  // Logo continuous breath
  const breath = 1 + 0.04 * Math.sin((frame - 40) / 20)

  // URL fade-in at frame 90
  const urlOpacity = interpolate(frame, [90, 110], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  })
  const urlY = interpolate(frame, [90, 110], [16, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Aura intensity={1.3} />
      <SparkleField />

      {/* "TRY" beat 0-24 frames */}
      <BigBeat text="TRY" start={0} hold={20} size={400} />

      {/* Logo lockup centred 40+ */}
      {frame >= 40 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 40,
        }}>
          {/* Halo behind logo */}
          <div style={{
            position: 'absolute',
            width: 700, height: 700, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.6) 0%, transparent 60%)',
            filter: 'blur(40px)',
            transform: `scale(${logoEnter * breath})`,
          }} />
          {/* The logo PNG */}
          <Img
            src={staticFile('kairo_logo.png')}
            style={{
              width: 380, height: 380,
              objectFit: 'contain',
              transform: `scale(${logoEnter * breath})`,
              filter: 'drop-shadow(0 18px 50px rgba(124,58,237,0.7))',
            }}
          />
          {/* Wordmark */}
          <div style={{
            fontFamily: FONT.family, fontWeight: 900,
            fontSize: 200, lineHeight: 1, letterSpacing: -4,
            transform: `scale(${logoEnter})`,
            background: 'linear-gradient(135deg, #e9d5ff 0%, #c4b5fd 35%, #a78bfa 65%, #7c3aed 100%)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 60px rgba(167,139,250,0.55)',
          }}>
            kairo
          </div>
          {/* URL line */}
          <div style={{
            fontFamily: FONT.family, fontWeight: FONT.semi,
            fontSize: 56, color: C.purpleLite,
            letterSpacing: 4, textTransform: 'lowercase',
            opacity: urlOpacity,
            transform: `translateY(${urlY}px)`,
          }}>
            kairo.app
          </div>
        </div>
      )}
    </AbsoluteFill>
  )
}

export const CTA_DURATION = DURATION
