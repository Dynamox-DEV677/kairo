/**
 * KynoCameraDemo — 22s vertical (9:16) Short showing Kyno's live Camera Study Mode.
 *
 * Faceless product demo. Recreates the real in-app UI (floating glass dock,
 * Dynamic Island grading card, question card) over a simulated camera view of
 * a student's paper, so it reads as screen-capture footage rather than AI art.
 *
 * Timeline (660 frames @ 30fps = 22.0s):
 *   0.0 – 2.5s   hook line, phone rises into frame
 *   2.5 – 5.0s   camera "sees" the question → scan sweep → question card
 *   5.0 – 11.0s  student writes, step by step; Dynamic Island tracks progress
 *  11.0 – 15.0s  the slip — step 3 flagged, live feedback line
 *  15.0 – 18.0s  payoff caption
 *  18.0 – 22.0s  logo sign-off + store CTA
 */
import {
  AbsoluteFill, Img, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig, Sequence,
} from 'remotion'

export const CAM_FPS = 30
export const CAM_DURATION_F = CAM_FPS * 22
const W = 1080
const H = 1920

const PURPLE = '#7C5CFF'
const CYAN   = '#4FD8E8'
const CORAL  = '#FF5A6E'
const GREEN  = '#34d399'
const BG     = '#050505'
const HAND   = "'Ink Free', 'Segoe Script', 'Comic Sans MS', cursive"
const UI     = "'Segoe UI', -apple-system, Roboto, Helvetica, Arial, sans-serif"

const ease = (t: number) => 1 - Math.pow(1 - t, 3)
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/* ── the lines the "student" writes, with timing ── */
const STEPS = [
  { at: 150, text: 'x² − 5x + 6 = 0',        bad: false },
  { at: 195, text: '(x − 2)(x − 3) = 0',      bad: false },
  { at: 245, text: 'x − 2 = 0   or   x − 3 = 0', bad: false },
  { at: 300, text: 'x = 2   or   x = −3',     bad: true  },
]

export default function KynoCameraDemo() {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()

  // phone rises in
  const rise = spring({ frame: f - 10, fps, config: { damping: 200, mass: 0.9 } })
  const phoneY = interpolate(rise, [0, 1], [220, 0])
  const phoneScale = interpolate(rise, [0, 1], [0.94, 1])

  const errorShown = f >= 330

  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: UI, overflow: 'hidden' }}>
      <Ambience f={f} error={errorShown} />

      {/* ── hook ── */}
      <Sequence from={0} durationInFrames={95}>
        <HookLine />
      </Sequence>

      {/* ── payoff caption ── */}
      <Sequence from={450} durationInFrames={100}>
        <Caption
          main="It finds the exact step"
          accent="you got wrong."
        />
      </Sequence>

      {/* ── phone ── */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: `translate(-50%, calc(-50% + ${phoneY}px)) scale(${phoneScale})`,
        opacity: interpolate(f, [545, 575], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}>
        <Phone f={f} error={errorShown} />
      </div>

      {/* ── sign-off ── */}
      <Sequence from={555} durationInFrames={105}>
        <SignOff />
      </Sequence>
    </AbsoluteFill>
  )
}

/* ══════════════════════════════════════════════════════════════ */

function Ambience({ f, error }: { f: number; error: boolean }) {
  const glow = error ? CORAL : PURPLE
  const pulse = 0.5 + 0.5 * Math.sin(f / 22)
  return (
    <>
      <AbsoluteFill style={{
        background: `radial-gradient(circle at 50% 42%, ${glow}${error ? '30' : '22'} 0%, transparent 58%)`,
        opacity: 0.7 + pulse * 0.3,
      }} />
      <AbsoluteFill style={{
        background: `radial-gradient(circle at 78% 88%, ${CYAN}14 0%, transparent 46%)`,
      }} />
    </>
  )
}

function HookLine() {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: f, fps, config: { damping: 200 } })
  const out = interpolate(f, [72, 92], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: 168, opacity: out }}>
      <div style={{ transform: `translateY(${interpolate(s, [0, 1], [26, 0])}px)`, opacity: s, textAlign: 'center', padding: '0 80px' }}>
        <div style={{ fontSize: 64, fontWeight: 900, color: '#fff', lineHeight: 1.16, letterSpacing: -1.4 }}>
          I built an AI that
        </div>
        <div style={{ fontSize: 64, fontWeight: 900, color: PURPLE, lineHeight: 1.16, letterSpacing: -1.4 }}>
          watches you solve maths
        </div>
      </div>
    </AbsoluteFill>
  )
}

function Caption({ main, accent }: { main: string; accent: string }) {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: f, fps, config: { damping: 200 } })
  const out = interpolate(f, [76, 98], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: 150, opacity: out, zIndex: 5 }}>
      <div style={{ transform: `translateY(${interpolate(s, [0, 1], [22, 0])}px)`, opacity: s, textAlign: 'center', padding: '0 70px' }}>
        <div style={{ fontSize: 58, fontWeight: 900, color: '#fff', lineHeight: 1.18, letterSpacing: -1.2 }}>{main}</div>
        <div style={{ fontSize: 58, fontWeight: 900, color: CORAL, lineHeight: 1.18, letterSpacing: -1.2 }}>{accent}</div>
      </div>
    </AbsoluteFill>
  )
}

/* ── the phone ── */
function Phone({ f, error }: { f: number; error: boolean }) {
  const PW = 620, PH = 1240, BEZ = 15, R = 66
  return (
    <div style={{
      width: PW, height: PH, borderRadius: R, background: '#0b0b0e',
      border: '2px solid rgba(255,255,255,0.16)',
      boxShadow: `0 44px 120px rgba(0,0,0,0.72), 0 0 76px ${error ? CORAL + '30' : PURPLE + '2e'}`,
      padding: BEZ, position: 'relative', boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', height: '100%', borderRadius: R - BEZ, overflow: 'hidden', position: 'relative', background: '#000' }}>
        <StatusBar />
        <PaperView f={f} />
        <ScanSweep f={f} />
        <QuestionCard f={f} error={error} />
        <Island f={f} error={error} />
        <Dock f={f} />
      </div>
      {/* notch */}
      <div style={{
        position: 'absolute', top: BEZ + 9, left: '50%', transform: 'translateX(-50%)',
        width: 116, height: 27, borderRadius: 14, background: '#000', zIndex: 9,
      }} />
    </div>
  )
}

function StatusBar() {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 46, zIndex: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 26px', color: '#fff', fontSize: 15, fontWeight: 700,
    }}>
      <span>9:41</span>
      <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <Bars /><span style={{ fontSize: 13 }}>▮</span>
      </span>
    </div>
  )
}
function Bars() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 12 }}>
      {[5, 7, 9, 11].map((h, i) => (
        <span key={i} style={{ width: 3, height: h, background: '#fff', borderRadius: 1 }} />
      ))}
    </span>
  )
}

/* the paper the camera is looking at */
function PaperView({ f }: { f: number }) {
  // slow, handheld-feeling drift so it reads as live camera, not a static mock
  const dx = Math.sin(f / 47) * 5
  const dy = Math.cos(f / 61) * 4
  const rot = Math.sin(f / 83) * 0.24
  return (
    <div style={{
      position: 'absolute', inset: 0,
      transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(1.06)`,
      background: 'linear-gradient(168deg, #f6f3ea 0%, #efeadf 52%, #e6e0d3 100%)',
    }}>
      {/* ruled lines */}
      {Array.from({ length: 22 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: 0, right: 0, top: 150 + i * 48,
          height: 1, background: 'rgba(60,80,140,0.13)',
        }} />
      ))}
      <div style={{ position: 'absolute', left: 74, top: 0, bottom: 0, width: 2, background: 'rgba(220,90,90,0.18)' }} />

      {/* printed question */}
      {/* kept clear of the Dynamic Island on the right */}
      <div style={{
        position: 'absolute', left: 84, top: 100, right: 210,
        fontFamily: UI, fontSize: 24, fontWeight: 700, color: '#1c2033', whiteSpace: 'nowrap',
        opacity: interpolate(f, [70, 100], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}>
        Q. Solve&nbsp; x² − 5x + 6 = 0
      </div>

      {/* the student's working, written line by line */}
      {STEPS.map((s, i) => {
        const p = clamp01((f - s.at) / 26)
        if (p <= 0) return null
        const chars = Math.ceil(s.text.length * ease(p))
        const flagged = s.bad && f >= 330
        return (
          <div key={i} style={{
            position: 'absolute', left: 100, top: 226 + i * 74, right: 36,
            fontFamily: HAND, fontSize: 34, color: flagged ? '#c0392b' : '#1a2030',
            whiteSpace: 'pre', display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <span>{s.text.slice(0, chars)}</span>
            {flagged && f >= 340 && (
              <span style={{
                fontFamily: UI, fontSize: 21, fontWeight: 900, color: '#fff',
                background: CORAL, borderRadius: 8, padding: '3px 10px',
                transform: `scale(${interpolate(springish(f - 340), [0, 1], [0.5, 1])})`,
                boxShadow: `0 6px 18px ${CORAL}66`,
              }}>✕ step 3</span>
            )}
          </div>
        )
      })}

      {/* red ring around the wrong term */}
      {f >= 352 && (
        <div style={{
          position: 'absolute', left: 268, top: 440, width: 118, height: 62,
          border: `4px solid ${CORAL}`, borderRadius: '50%',
          transform: `rotate(-6deg) scale(${interpolate(springish(f - 352), [0, 1], [0.6, 1])})`,
          opacity: 0.92,
        }} />
      )}
    </div>
  )
}

function springish(t: number) {
  if (t <= 0) return 0
  const p = Math.min(1, t / 12)
  return 1 - Math.pow(1 - p, 3)
}

/* the sweeping scan line while it reads the page */
function ScanSweep({ f }: { f: number }) {
  const active = f >= 76 && f < 150
  if (!active) return null
  const p = (f - 76) / 74
  return (
    <>
      <div style={{
        position: 'absolute', left: 0, right: 0, top: `${p * 100}%`, height: 3,
        background: `linear-gradient(90deg, transparent, ${CYAN}, transparent)`,
        boxShadow: `0 0 24px ${CYAN}`, zIndex: 6,
      }} />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 5,
        background: `linear-gradient(180deg, ${CYAN}0f 0%, transparent ${p * 100}%)`,
      }} />
    </>
  )
}

/* floating glass question card */
function QuestionCard({ f, error }: { f: number; error: boolean }) {
  const inAt = 150
  if (f < inAt) return null
  const s = springish(f - inAt)
  return (
    <div style={{
      position: 'absolute', left: 18, right: 18, bottom: 128, zIndex: 7,
      background: 'rgba(14,16,26,0.80)', backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.16)', borderRadius: 20, padding: 18,
      transform: `translateY(${interpolate(s, [0, 1], [30, 0])}px)`, opacity: s,
      boxShadow: '0 16px 44px rgba(0,0,0,0.5)',
    }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 11, flexWrap: 'wrap' }}>
        {['Quadratic Equations', 'Medium', '~2 min'].map(t => (
          <span key={t} style={{
            fontSize: 15, fontWeight: 800, padding: '5px 12px', borderRadius: 999,
            background: 'rgba(124,92,255,0.26)', border: `1px solid ${PURPLE}77`, color: '#d3c8ff',
          }}>{t}</span>
        ))}
      </div>
      <div style={{ fontSize: 20, color: '#fff', lineHeight: 1.42, fontWeight: 600 }}>
        Solve&nbsp; x² − 5x + 6 = 0
      </div>
      {error && (
        <div style={{
          marginTop: 13, paddingTop: 13, borderTop: '1px solid rgba(255,255,255,0.14)',
          fontSize: 19, fontWeight: 800, color: CORAL,
          opacity: springish(f - 336),
        }}>
          ⚠ Check the sign when solving x − 3 = 0
        </div>
      )}
    </div>
  )
}

/* Dynamic-Island style live grading card */
function Island({ f, error }: { f: number; error: boolean }) {
  const inAt = 168
  if (f < inAt) return null
  const s = springish(f - inAt)
  const prog = Math.round(interpolate(f, [180, 320], [12, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))
  const acc  = error ? 66 : 100
  const mist = error ? 1 : 0
  const tone = error ? CORAL : GREEN
  return (
    <div style={{
      position: 'absolute', top: 62, right: 16, zIndex: 8,
      background: 'rgba(14,16,26,0.82)', backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.17)', borderRadius: 22, padding: '11px 14px',
      transform: `scale(${interpolate(s, [0, 1], [0.86, 1])})`, opacity: s, minWidth: 168,
      boxShadow: '0 12px 34px rgba(0,0,0,0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
        <span style={{
          width: 10, height: 10, borderRadius: 5, background: tone,
          boxShadow: `0 0 12px ${tone}`,
        }} />
        <span style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>
          {error ? 'Check that' : 'On track'}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px' }}>
        <Metric k="Progress" v={`${prog}%`} />
        <Metric k="Accuracy" v={`${acc}%`} tone={error ? CORAL : GREEN} />
        <Metric k="Mistakes" v={`${mist}`} tone={error ? '#ffb020' : undefined} />
        <Metric k="Confidence" v="High" />
      </div>
    </div>
  )
}
function Metric({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 800 }}>{k}</div>
      <div style={{ fontSize: 17, fontWeight: 900, color: tone || '#fff', lineHeight: 1.2 }}>{v}</div>
    </div>
  )
}

/* floating dock */
function Dock({ f }: { f: number }) {
  const s = springish(f - 130)
  if (f < 130) return null
  const items = ['Menu', 'Capture', 'Cards', 'Ask', 'Hint', 'Explain', 'End']
  return (
    <div style={{
      position: 'absolute', left: 14, right: 14, bottom: 18, zIndex: 8,
      background: 'rgba(14,16,26,0.80)', backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.16)', borderRadius: 26, padding: '11px 8px',
      display: 'flex', justifyContent: 'space-between',
      transform: `translateY(${interpolate(s, [0, 1], [26, 0])}px)`, opacity: s,
    }}>
      {items.map((t, i) => (
        <div key={t} style={{ flex: 1, textAlign: 'center' }}>
          <div style={{
            width: 34, height: 34, margin: '0 auto 4px', borderRadius: 11,
            background: i === 4 ? 'rgba(255,176,32,0.20)' : 'rgba(255,255,255,0.10)',
            border: `1px solid ${i === 4 ? '#ffb02066' : 'rgba(255,255,255,0.15)'}`,
          }} />
          <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>{t}</div>
        </div>
      ))}
    </div>
  )
}

/* closing brand card */
function SignOff() {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: f, fps, config: { damping: 200 } })
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
      <div style={{ textAlign: 'center', opacity: s, transform: `scale(${interpolate(s, [0, 1], [0.9, 1])})` }}>
        <div style={{
          width: 210, height: 210, margin: '0 auto 34px', borderRadius: 50, overflow: 'hidden',
          boxShadow: `0 0 90px ${PURPLE}66`,
        }}>
          <Img src={staticFile('kyno_mark.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ fontSize: 94, fontWeight: 900, color: '#fff', letterSpacing: -2.6, lineHeight: 1 }}>Kyno</div>
        <div style={{ fontSize: 33, color: CYAN, marginTop: 14, fontWeight: 700 }}>AI Academic Twin</div>
        <div style={{
          marginTop: 40, display: 'inline-block', padding: '17px 38px', borderRadius: 999,
          background: PURPLE, color: '#fff', fontSize: 27, fontWeight: 900,
          boxShadow: `0 12px 40px ${PURPLE}70`,
        }}>
          Free on Google Play
        </div>
      </div>
    </AbsoluteFill>
  )
}
