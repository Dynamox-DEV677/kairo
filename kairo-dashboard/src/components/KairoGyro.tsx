/**
 * KairoGyro — the signature Kairo OS loading animation.
 *
 * A 3D gyroscope: three rings spinning on differently-tilted axes at
 * different speeds around a glowing core, wrapped in a soft pulsing
 * halo. Matches the Kairo OS boot-intro aesthetic (ultramarine + cyan).
 *
 * LOGO-SWAPPABLE: the center is a `logo` slot. Today it defaults to a
 * glowing core dot; when the new Kairo logo lands, set DEFAULT_LOGO
 * below once and every loader in the app updates.
 *
 * (Not to be confused with components/KairoLoader.tsx — that's the old
 * K-assembly splash tied to the current logo, currently unused.)
 *
 * Usage:
 *   <KairoGyro />                              // 120px gyro, no text
 *   <KairoGyro label="Loading your Twin…" />   // with label
 *   <KairoGyro size={56} />                    // small inline
 *   <KairoGyro fullPage label="Booting…" />    // centered in parent
 *   <KairoGyro logo={<img src=... />} />       // future logo drop-in
 */
import type { ReactNode } from 'react'

// The Kairo mark (cursive K + graduation cap) — public/kairo-mark.svg.
// Swap the src here once and every loader in the app updates.
const DEFAULT_LOGO: ReactNode = (
  <img
    src="/kairo-mark.svg"
    alt=""
    style={{ width: '42%', height: '42%', objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(102,217,255,0.45))' }}
  />
)

export default function KairoGyro({
  size = 120,
  label,
  sub,
  logo = DEFAULT_LOGO,
  fullPage = false,
}: {
  size?: number
  label?: string
  sub?: string
  logo?: ReactNode
  fullPage?: boolean
}) {
  const gyro = (
    <div style={{ position: 'relative', width: size, height: size, perspective: 600 }}>
      <style>{`
        @keyframes kgSpin { to { transform: rotate(360deg) } }
        @keyframes kgHalo { 0%,100% { transform: scale(1);    opacity: .30 }
                            50%     { transform: scale(1.14); opacity: .70 } }
        @keyframes kgCore { 0%,100% { box-shadow: 0 0 ${Math.round(size * 0.12)}px rgba(102,217,255,.55) }
                            50%     { box-shadow: 0 0 ${Math.round(size * 0.26)}px rgba(102,217,255,.95) } }
        @keyframes kgFade { from { opacity: 0 } to { opacity: 1 } }
      `}</style>

      {/* pulsing halo */}
      <div style={{
        position: 'absolute', inset: '-8%', borderRadius: '50%',
        border: '1px solid rgba(102,217,255,0.22)',
        animation: 'kgHalo 2.1s ease-in-out infinite',
      }} />

      {/* Three gyro rings. Each ring spins flat (kgSpin) inside a parent
          that holds a static 3D tilt — the tilt survives the rotation, so
          together they read as a gyroscope precessing on 3 axes. */}
      <div style={{ position: 'absolute', inset: 0, transform: 'rotateX(62deg)', transformStyle: 'preserve-3d' }}>
        <div style={{
          position: 'absolute', inset: '6%', borderRadius: '50%',
          border: '2px solid transparent',
          borderTopColor: '#66D9FF', borderRightColor: 'rgba(102,217,255,0.33)',
          animation: 'kgSpin 1.6s linear infinite',
        }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, transform: 'rotateY(58deg)', transformStyle: 'preserve-3d' }}>
        <div style={{
          position: 'absolute', inset: '16%', borderRadius: '50%',
          border: '2px solid transparent',
          borderTopColor: '#4F7CFF', borderRightColor: 'rgba(79,124,255,0.33)',
          animation: 'kgSpin 2.3s linear infinite reverse',
        }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, transform: 'rotateX(30deg) rotateY(-45deg)', transformStyle: 'preserve-3d' }}>
        <div style={{
          position: 'absolute', inset: '27%', borderRadius: '50%',
          border: '1.5px solid transparent',
          borderTopColor: '#A5B4FC', borderRightColor: 'rgba(165,180,252,0.30)',
          animation: 'kgSpin 1.1s linear infinite',
        }} />
      </div>

      {/* core — logo slot (glowing dot until the new logo lands) */}
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        {logo ?? (
          <div style={{
            width: Math.max(6, size * 0.14), height: Math.max(6, size * 0.14), borderRadius: '50%',
            background: 'radial-gradient(circle, #fff 0%, #66D9FF 70%)',
            animation: 'kgCore 1.8s ease-in-out infinite',
          }} />
        )}
      </div>
    </div>
  )

  const body = (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
      animation: 'kgFade .4s ease both',
    }}>
      {gyro}
      {label && (
        <div style={{
          fontSize: 12, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase',
          color: '#66D9FF', textAlign: 'center',
        }}>{label}</div>
      )}
      {sub && (
        <div style={{ fontSize: 10.5, letterSpacing: 2, color: '#5B616E', marginTop: -8, textAlign: 'center' }}>
          {sub}
        </div>
      )}
    </div>
  )

  if (!fullPage) return body
  return (
    <div style={{
      width: '100%', height: '100%', minHeight: 240,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {body}
    </div>
  )
}
