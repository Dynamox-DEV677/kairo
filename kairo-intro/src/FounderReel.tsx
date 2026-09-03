/**
 * FounderReel — OVERLAY-ONLY graphics for Darshan's founder video.
 *
 * Renders with a TRANSPARENT background so it can be ffmpeg-composited over the
 * raw footage (`public/founder-base.mp4`). We never run the source clip through
 * <OffthreadVideo> — that flickers on h264 — so this comp contains graphics only.
 *
 * Beats (seconds, matched to the cut base clip @ 59.2s):
 *   0.0 – 6.0    founder name card
 *  12.6 – 19.5   "Kyno" product reveal
 *  27.8 – 34.0   Kiran / beta-tester card
 *  48.9 – 50.2   BEFORE stat (13/20)
 *  50.3 – 56.2   AFTER stat slam (19.5/20) + delta
 *  56.3 – 59.2   sign-off CTA + store line
 * Captions run the whole way, word-synced.
 */
import {
  AbsoluteFill, Img, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from 'remotion'
import { PHRASES } from './founderWords'

export const FR_FPS = 30
export const FR_DURATION_F = Math.round(59.2 * FR_FPS)
const W = 1080
const H = 1920

const PURPLE = '#7C5CFF'
const CYAN   = '#4FD8E8'
const GREEN  = '#3ddc84'
const CORAL  = '#FF5A6E'
const UI     = "'Segoe UI', -apple-system, Roboto, Helvetica, Arial, sans-serif"

const SHADOW = '0 6px 26px rgba(0,0,0,0.85), 0 2px 6px rgba(0,0,0,0.9)'
const sec = (f: number) => f / FR_FPS
const win = (t: number, a: number, b: number) => t >= a && t <= b
/** 0→1 ease-in, 1→0 ease-out envelope with soft edges */
function env(t: number, a: number, b: number, fade = 0.32) {
  if (t < a || t > b) return 0
  const i = Math.min(1, (t - a) / fade)
  const o = Math.min(1, (b - t) / fade)
  const v = Math.min(i, o)
  return 1 - Math.pow(1 - v, 3)
}

export default function FounderReel() {
  const f = useCurrentFrame()
  const t = sec(f)
  return (
    <AbsoluteFill style={{ fontFamily: UI }}>
      {/* style.css paints html/body/#root #050505, which silently flattens the
          alpha channel on every render. This comp is an overlay — force it clear. */}
      <style>{`html, body, #root { background: transparent !important; }`}</style>
      <TopVignette t={t} />
      <NameCard t={t} />
      <KynoReveal t={t} />
      <TesterCard t={t} />
      <StatBefore t={t} />
      <StatAfter t={t} />
      <EndCTA t={t} />
      <Captions f={f} t={t} />
      <Watermark t={t} />
    </AbsoluteFill>
  )
}

/* subtle darkening so white text always reads over the footage */
function TopVignette({ t }: { t: number }) {
  const on = env(t, 0, 59.2, 0.5)
  return (
    <>
      <AbsoluteFill style={{
        background: 'linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.10) 26%, rgba(0,0,0,0) 46%)',
        opacity: on,
      }} />
      <AbsoluteFill style={{
        background: 'linear-gradient(0deg, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.30) 16%, rgba(0,0,0,0) 34%)',
        opacity: on,
      }} />
    </>
  )
}

/* ── 0–6s: who is this ── */
function NameCard({ t }: { t: number }) {
  const o = env(t, 0.25, 6.0, 0.45)
  if (!o) return null
  const slide = interpolate(o, [0, 1], [-46, 0])
  return (
    <div style={{ position: 'absolute', top: 132, left: 56, opacity: o, transform: `translateX(${slide}px)` }}>
      <div style={{
        display: 'inline-block', padding: '9px 20px', borderRadius: 999,
        background: PURPLE, color: '#fff', fontSize: 27, fontWeight: 900,
        letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 16,
        boxShadow: `0 10px 34px ${PURPLE}80`,
      }}>
        Founder &amp; CEO
      </div>
      <div style={{ fontSize: 92, fontWeight: 900, color: '#fff', letterSpacing: -2.6, lineHeight: 1, textShadow: SHADOW }}>
        DARSHAN
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, color: CYAN, marginTop: 10, textShadow: SHADOW }}>
        Kairo Industries
      </div>
    </div>
  )
}

/* ── ~13–19.5s: the product ── */
function KynoReveal({ t }: { t: number }) {
  const o = env(t, 12.6, 19.5, 0.42)
  if (!o) return null
  const pop = interpolate(o, [0, 1], [0.82, 1])
  return (
    <div style={{
      position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center',
      opacity: o, transform: `scale(${pop})`,
    }}>
      <div style={{
        width: 168, height: 168, margin: '0 auto 20px', borderRadius: 40, overflow: 'hidden',
        boxShadow: `0 0 70px ${PURPLE}88, 0 18px 50px rgba(0,0,0,0.7)`,
      }}>
        <Img src={staticFile('kyno_mark.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ fontSize: 108, fontWeight: 900, color: '#fff', letterSpacing: -3, lineHeight: 1, textShadow: SHADOW }}>
        Kyno
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, color: CYAN, marginTop: 8, textShadow: SHADOW }}>
        our first product
      </div>
    </div>
  )
}

/* ── ~28–34s: the student ── */
function TesterCard({ t }: { t: number }) {
  const o = env(t, 27.8, 34.0, 0.4)
  if (!o) return null
  return (
    <div style={{
      position: 'absolute', top: 176, right: 52, opacity: o,
      transform: `translateX(${interpolate(o, [0, 1], [50, 0])}px)`,
      background: 'rgba(12,14,22,0.86)', border: `1px solid ${CYAN}55`,
      borderRadius: 24, padding: '20px 26px', textAlign: 'right',
      boxShadow: '0 18px 50px rgba(0,0,0,0.6)',
    }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: CYAN, letterSpacing: 2, textTransform: 'uppercase' }}>
        Beta tester
      </div>
      <div style={{ fontSize: 60, fontWeight: 900, color: '#fff', lineHeight: 1.05, marginTop: 6 }}>KIRAN</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 4 }}>Class 9</div>
    </div>
  )
}

/* ── the payoff: before ── */
function StatBefore({ t }: { t: number }) {
  const o = env(t, 48.9, 51.4, 0.3)
  if (!o) return null
  const strike = t > 50.4 ? Math.min(1, (t - 50.4) / 0.5) : 0
  return (
    <div style={{ position: 'absolute', top: 250, left: 0, right: 0, textAlign: 'center', opacity: o }}>
      <div style={{ fontSize: 30, fontWeight: 900, color: 'rgba(255,255,255,0.66)', letterSpacing: 3, textTransform: 'uppercase', textShadow: SHADOW }}>
        Before Kyno
      </div>
      <div style={{ position: 'relative', display: 'inline-block', marginTop: 6 }}>
        <span style={{ fontSize: 132, fontWeight: 900, color: CORAL, letterSpacing: -3, textShadow: SHADOW }}>
          13<span style={{ fontSize: 62, color: 'rgba(255,255,255,0.6)' }}>/20</span>
        </span>
        <div style={{
          position: 'absolute', left: -8, right: -8, top: '52%', height: 9, background: CORAL,
          borderRadius: 5, transform: `scaleX(${strike})`, transformOrigin: 'left center',
          boxShadow: `0 0 22px ${CORAL}`,
        }} />
      </div>
    </div>
  )
}

/* ── the payoff: after (the money shot) ── */
function StatAfter({ t }: { t: number }) {
  const o = env(t, 50.5, 56.2, 0.34)
  if (!o) return null
  const p = Math.min(1, Math.max(0, (t - 50.5) / 0.55))
  const slam = 1 + (1 - Math.pow(1 - p, 3)) * 0 + (p < 1 ? (1 - p) * 0.55 : 0)  // overshoot in
  const glow = 0.55 + 0.45 * Math.sin(t * 5)
  return (
    <div style={{ position: 'absolute', top: 470, left: 0, right: 0, textAlign: 'center', opacity: o }}>
      <div style={{ fontSize: 30, fontWeight: 900, color: GREEN, letterSpacing: 3, textTransform: 'uppercase', textShadow: SHADOW }}>
        After Kyno
      </div>
      <div style={{
        fontSize: 186, fontWeight: 900, color: '#fff', letterSpacing: -6, lineHeight: 1,
        transform: `scale(${slam})`,
        textShadow: `0 0 ${34 + glow * 26}px ${GREEN}cc, ${SHADOW}`,
      }}>
        19.5<span style={{ fontSize: 78, color: 'rgba(255,255,255,0.66)' }}>/20</span>
      </div>
      <div style={{
        display: 'inline-block', marginTop: 14, padding: '11px 26px', borderRadius: 999,
        background: GREEN, color: '#04220f', fontSize: 36, fontWeight: 900,
        boxShadow: `0 12px 40px ${GREEN}70`,
      }}>
        +6.5 marks
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginTop: 12, textShadow: SHADOW }}>
        one test. one study plan.
      </div>
    </div>
  )
}

/* ── sign-off ── */
function EndCTA({ t }: { t: number }) {
  const o = env(t, 56.3, 59.2, 0.4)
  if (!o) return null
  return (
    <div style={{ position: 'absolute', top: 300, left: 0, right: 0, textAlign: 'center', opacity: o }}>
      <div style={{
        width: 156, height: 156, margin: '0 auto 18px', borderRadius: 38, overflow: 'hidden',
        boxShadow: `0 0 62px ${PURPLE}88`,
      }}>
        <Img src={staticFile('kyno_mark.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ fontSize: 84, fontWeight: 900, color: '#fff', letterSpacing: -2.4, textShadow: SHADOW }}>Kyno</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: CYAN, marginTop: 6, textShadow: SHADOW }}>by Kairo Industries</div>
      <div style={{
        display: 'inline-block', marginTop: 26, padding: '16px 34px', borderRadius: 999,
        background: PURPLE, color: '#fff', fontSize: 32, fontWeight: 900,
        boxShadow: `0 14px 44px ${PURPLE}80`,
      }}>
        Free on Google Play
      </div>
      <div style={{ fontSize: 25, fontWeight: 700, color: 'rgba(255,255,255,0.82)', marginTop: 18, textShadow: SHADOW }}>
        kairo-daily-edu.vercel.app
      </div>
    </div>
  )
}

/* ── word-synced captions ── */
function Captions({ f, t }: { f: number; t: number }) {
  const active = PHRASES.find(p => t >= p.s - 0.12 && t <= p.e + 0.34)
  if (!active) return null
  const o = Math.min(1, (t - (active.s - 0.12)) / 0.14, ((active.e + 0.34) - t) / 0.18)
  return (
    <div style={{
      position: 'absolute', left: 60, right: 60, bottom: 300, textAlign: 'center',
      opacity: Math.max(0, o),
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 16px', justifyContent: 'center' }}>
        {active.words.map((w, i) => {
          const spoken = t >= w.s - 0.04
          const hot = t >= w.s - 0.04 && t <= w.e + 0.10
          return (
            <span key={i} style={{
              fontSize: 62, fontWeight: 900, letterSpacing: -1,
              color: spoken ? '#fff' : 'rgba(255,255,255,0.42)',
              textShadow: hot ? `0 0 26px ${CYAN}, ${SHADOW}` : SHADOW,
              transform: hot ? 'translateY(-5px) scale(1.05)' : 'none',
              display: 'inline-block', transition: 'none',
            }}>{w.w}</span>
          )
        })}
      </div>
    </div>
  )
}

/* persistent small brand mark */
function Watermark({ t }: { t: number }) {
  const o = env(t, 0.6, 56.2, 0.6) * 0.85
  if (!o) return null
  return (
    <div style={{
      position: 'absolute', bottom: 168, left: 0, right: 0, textAlign: 'center', opacity: o,
    }}>
      <span style={{
        fontSize: 24, fontWeight: 800, color: 'rgba(255,255,255,0.78)', letterSpacing: 2.4,
        textShadow: SHADOW,
      }}>
        ✦ KYNO · KAIRO INDUSTRIES
      </span>
    </div>
  )
}
