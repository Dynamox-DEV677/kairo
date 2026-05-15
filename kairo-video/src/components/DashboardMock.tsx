/**
 * DashboardMock — a vector-drawn Kairo OS dashboard preview.
 * Built from SVG so it animates in crisp at any resolution and you can
 * tweak the metrics without a screenshot.
 */
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion'
import { C } from '../theme'

interface Props {
  /** Frame the dashboard starts animating in. */
  start?: number
}

export const DashboardMock: React.FC<Props> = ({ start = 0 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const local = frame - start

  // Spring scale-in
  const s = spring({ frame: local, fps, config: { stiffness: 220, damping: 20 } })
  const opacity = interpolate(local, [0, 14], [0, 1], { extrapolateRight: 'clamp' })

  // Pulse ring fills 0 → 0.76 of circumference
  const r = 70
  const c = 2 * Math.PI * r
  const ringT = interpolate(local, [12, 40], [0, 0.76], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const dashOffset = c * (1 - ringT)

  // Numeric counter for the big "76" score
  const score = Math.round(interpolate(local, [12, 40], [0, 76], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))

  // Heatmap chip widths animate in sequence
  const chipReveal = (i: number) =>
    interpolate(local, [22 + i * 4, 30 + i * 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity,
        transform: `scale(${s})`,
      }}
    >
      {/* Phone-shaped device */}
      <div
        style={{
          width: 560, height: 1100, borderRadius: 56,
          background: `linear-gradient(180deg, #0e0e16 0%, #06060a 100%)`,
          border: `2px solid rgba(167,139,250,0.35)`,
          boxShadow: '0 40px 120px rgba(124,58,237,0.45), 0 0 80px rgba(124,58,237,0.30), inset 0 1px 0 rgba(255,255,255,0.05)',
          padding: '36px 28px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Status bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontFamily: 'inherit', fontSize: 16, color: C.textDim, marginBottom: 22,
        }}>
          <span style={{ fontWeight: 700 }}>9:41</span>
          <span style={{ letterSpacing: 2 }}>• • •</span>
        </div>

        {/* Greeting */}
        <div style={{ fontSize: 13, fontWeight: 700, color: C.purpleLite, letterSpacing: 2, marginBottom: 4 }}>
          AI PULSE
        </div>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: -0.6 }}>
          Thriving today.
        </h2>

        {/* Pulse ring */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '34px 0' }}>
          <svg width={220} height={220} viewBox="0 0 200 200">
            <defs>
              <linearGradient id="ringG" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"  stopColor="#c4b5fd"/>
                <stop offset="50%" stopColor="#a78bfa"/>
                <stop offset="100%" stopColor="#7c3aed"/>
              </linearGradient>
            </defs>
            <circle cx={100} cy={100} r={r} fill="none" stroke="#13131d" strokeWidth={14}/>
            <circle
              cx={100} cy={100} r={r} fill="none"
              stroke="url(#ringG)" strokeWidth={14} strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 100 100)"
            />
            <text x={100} y={110} textAnchor="middle" fontSize={52} fontWeight={800}
                  fill={C.text} letterSpacing={-2}>
              {score}
            </text>
          </svg>
        </div>

        {/* Heatmap chips */}
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textFaint, letterSpacing: 1.6, marginBottom: 10 }}>
          WEAKNESS HEATMAP
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            { t: 'vectors',         m: 0.32, col: C.purpleHi },
            { t: 'quadratic eq.',   m: 0.41, col: C.purpleHi },
            { t: 'electrolysis',    m: 0.55, col: C.purple   },
            { t: 'photosynthesis',  m: 0.68, col: C.purple   },
            { t: 'newton laws',     m: 0.78, col: C.purpleLite },
            { t: 'cell biology',    m: 0.84, col: C.purpleLite },
          ].map((chip, i) => {
            const reveal = chipReveal(i)
            return (
              <div
                key={chip.t}
                style={{
                  padding: '7px 12px', borderRadius: 999,
                  background: `${chip.col}22`,
                  border: `1px solid ${chip.col}66`,
                  color: chip.col,
                  fontSize: 13, fontWeight: 700,
                  opacity: reveal,
                  transform: `translateY(${(1 - reveal) * 8}px)`,
                  whiteSpace: 'nowrap',
                }}
              >
                {chip.t}
                <span style={{ marginLeft: 6, opacity: 0.7, fontSize: 11 }}>
                  {Math.round(chip.m * 100)}%
                </span>
              </div>
            )
          })}
        </div>

        {/* Bottom row: streak + retention */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 26 }}>
          <div style={{
            padding: '14px 16px', borderRadius: 14,
            background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.18)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.purpleLite, letterSpacing: 1.4 }}>STREAK</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: -0.6 }}>10d</div>
          </div>
          <div style={{
            padding: '14px 16px', borderRadius: 14,
            background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.18)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.purpleLite, letterSpacing: 1.4 }}>RETENTION</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: -0.6 }}>99%</div>
          </div>
        </div>
      </div>
    </div>
  )
}
