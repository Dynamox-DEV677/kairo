/**
 * FeaturesScene — four product beats, each 2 s, with a glowing icon + label.
 *   3D LABS · AI SOLVER · BATTLE MODE · AUTO FLASHCARDS
 * 10 seconds total.
 */
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion'
import { Aura } from '../components/Aura'
import { SparkleField } from '../components/SparkleField'
import { C, FONT } from '../theme'

const FEATURES = [
  { label: '3D LABS',          sub: 'real interactive simulations',  icon: 'flask'  },
  { label: 'AI SOLVER',        sub: 'instant answer to any doubt',   icon: 'chat'   },
  { label: 'BATTLE MODE',      sub: 'daily challenge + AI rival',    icon: 'swords' },
  { label: 'AUTO FLASHCARDS',  sub: 'built from your own mistakes',  icon: 'cards'  },
]

const BEAT = 75   // 2.5 s per feature
const DURATION = FEATURES.length * BEAT

export const FeaturesScene: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const activeIdx = Math.min(FEATURES.length - 1, Math.floor(frame / BEAT))
  const local = frame - activeIdx * BEAT
  const enter = spring({ frame: local, fps, config: { stiffness: 240, damping: 18 } })
  const exitT = Math.max(0, local - (BEAT - 12))
  const exit01 = interpolate(exitT, [0, 12], [0, 1], { extrapolateRight: 'clamp' })

  const feat = FEATURES[activeIdx]
  const scale = enter * (1 - exit01 * 0.06)
  const opacity = interpolate(local, [0, 6, BEAT - 14, BEAT], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Aura />
      <SparkleField />

      {/* Section ribbon */}
      <div style={{
        position: 'absolute', top: 80, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
      }}>
        <div style={{
          padding: '8px 22px', borderRadius: 999,
          border: '1px solid rgba(167,139,250,0.4)',
          background: 'rgba(167,139,250,0.08)',
          color: C.purpleLite,
          fontFamily: FONT.family, fontWeight: FONT.semi,
          fontSize: 18, letterSpacing: 4, textTransform: 'uppercase',
        }}>
          Inside Kairo OS
        </div>
      </div>

      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 30,
        opacity, transform: `scale(${scale})`,
      }}>
        <FeatureIcon kind={feat.icon} />
        <div style={{
          fontFamily: FONT.family, fontWeight: 900,
          fontSize: 240, color: C.text, letterSpacing: -3, lineHeight: 0.95,
          textAlign: 'center',
          textShadow: '0 0 50px rgba(196,181,253,0.45)',
        }}>
          {feat.label}
        </div>
        <div style={{
          fontFamily: FONT.family, fontWeight: FONT.semi,
          fontSize: 28, color: C.textDim, letterSpacing: 1.5,
          textTransform: 'uppercase',
        }}>
          {feat.sub}
        </div>
      </div>

      {/* Progress strip — 4 dots at the bottom */}
      <div style={{
        position: 'absolute', bottom: 80, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: 12,
      }}>
        {FEATURES.map((_, i) => (
          <div key={i} style={{
            width: i === activeIdx ? 64 : 16, height: 6,
            borderRadius: 3,
            background: i === activeIdx ? C.purpleLite : 'rgba(167,139,250,0.25)',
            transition: 'all 0.4s',
          }} />
        ))}
      </div>
    </AbsoluteFill>
  )
}

// Tiny SVG glyph for each feature — no asset dependencies.
const FeatureIcon: React.FC<{ kind: string }> = ({ kind }) => {
  const stroke = C.purpleLite
  return (
    <div style={{
      width: 200, height: 200, borderRadius: 56,
      background: 'linear-gradient(135deg, rgba(196,181,253,0.18), rgba(124,58,237,0.10))',
      border: '2px solid rgba(196,181,253,0.45)',
      boxShadow: '0 30px 60px rgba(124,58,237,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {kind === 'flask' && (
        <svg viewBox="0 0 100 100" width={110} height={110} fill="none" stroke={stroke} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round">
          <path d="M 40 15 L 60 15 L 60 38 L 80 78 Q 82 88 72 88 L 28 88 Q 18 88 20 78 L 40 38 Z" />
          <path d="M 30 64 Q 50 56 70 64" stroke={stroke} fill="none" />
        </svg>
      )}
      {kind === 'chat' && (
        <svg viewBox="0 0 100 100" width={110} height={110} fill="none" stroke={stroke} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round">
          <path d="M 18 30 Q 18 18 30 18 L 70 18 Q 82 18 82 30 L 82 60 Q 82 72 70 72 L 42 72 L 28 86 L 28 72 L 30 72 Q 18 72 18 60 Z" />
          <circle cx={38} cy={45} r={3} fill={stroke} />
          <circle cx={50} cy={45} r={3} fill={stroke} />
          <circle cx={62} cy={45} r={3} fill={stroke} />
        </svg>
      )}
      {kind === 'swords' && (
        <svg viewBox="0 0 100 100" width={110} height={110} fill="none" stroke={stroke} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round">
          <path d="M 14 14 L 56 56 L 50 70 L 42 78 L 32 68 L 12 18 Z" />
          <path d="M 86 14 L 44 56 L 50 70 L 58 78 L 68 68 L 88 18 Z" />
          <path d="M 30 78 L 14 88" />
          <path d="M 70 78 L 86 88" />
        </svg>
      )}
      {kind === 'cards' && (
        <svg viewBox="0 0 100 100" width={110} height={110} fill="none" stroke={stroke} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round">
          <rect x={22} y={28} width={48} height={64} rx={8} transform="rotate(-8 46 60)" />
          <rect x={30} y={20} width={48} height={64} rx={8} transform="rotate(6 54 52)" />
          <path d="M 44 44 L 64 44 M 44 56 L 60 56" />
        </svg>
      )}
    </div>
  )
}

export const FEATURES_DURATION = DURATION
