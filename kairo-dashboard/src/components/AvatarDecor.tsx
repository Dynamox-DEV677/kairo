import type { ReactNode } from 'react'
import { getRaw, setRaw } from '../lib/storage'

export interface DecorDef { id: string; label: string; emoji: string }
export const DECORATIONS: DecorDef[] = [
  { id: 'none',    label: 'None',        emoji: '🚫' },
  { id: 'neon',    label: 'Neon Ring',   emoji: '💠' },
  { id: 'spin',    label: 'Cyber Spin',  emoji: '🌀' },
  { id: 'racer',   label: 'Racer',       emoji: '🏎️' },
  { id: 'flame',   label: 'On Fire',     emoji: '🔥' },
  { id: 'orbit',   label: 'Satellite',   emoji: '🛰️' },
  { id: 'royal',   label: 'Royal',       emoji: '👑' },
]

export function getDecor(): string {
  try { return getRaw('kairo:decor') || 'none' } catch { return 'none' }
}
export function setDecor(id: string) {
  try { setRaw('kairo:decor', id) } catch {  }
  try { window.dispatchEvent(new CustomEvent('kairo:decor', { detail: id })) } catch {  }
}

const DECOR_CSS = `
@keyframes kdSpin   { to { transform: rotate(360deg) } }
@keyframes kdPulse  { 0%,100% { opacity: .55; transform: scale(1) } 50% { opacity: 1; transform: scale(1.06) } }
@keyframes kdFlame  { 0%,100% { filter: hue-rotate(0deg) brightness(1) } 50% { filter: hue-rotate(-18deg) brightness(1.25) } }
`

export function DecoratedAvatar({
  pic, name = 'K', size = 44, decor, rounded = 12,
}: {
  pic?: string | null
  name?: string
  size?: number
  decor?: string
  rounded?: number
}) {
  const d = decor ?? getDecor()
  const pad = Math.max(4, size * 0.14)
  const box = size + pad * 2

  const core: ReactNode = (
    <div style={{
      width: size, height: size, borderRadius: rounded, overflow: 'hidden',
      background: pic ? 'transparent' : 'linear-gradient(135deg,#7C6BF6,#4A2FA8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 800, color: '#fff', flexShrink: 0,
    }}>
      {pic
        ? <img src={pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (name?.charAt(0)?.toUpperCase() || 'K')}
    </div>
  )

  return (
    <div style={{ position: 'relative', width: box, height: box, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      <style>{DECOR_CSS}</style>

      {d === 'neon' && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: rounded + pad,
          border: '2px solid #A5B4FC',
          boxShadow: '0 0 12px rgba(165,180,252,0.8), inset 0 0 10px rgba(165,180,252,0.35)',
          animation: 'kdPulse 2s ease-in-out infinite',
        }} />
      )}

      {d === 'spin' && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '2.5px solid transparent',
          borderTopColor: '#A5B4FC', borderRightColor: '#7C6BF6',
          animation: 'kdSpin 1.4s linear infinite',
        }} />
      )}

      {d === 'flame' && (
        <div style={{
          position: 'absolute', inset: -1, borderRadius: rounded + pad,
          border: '2.5px solid #ff7a4a',
          boxShadow: '0 0 14px rgba(255,122,74,0.85), 0 -4px 18px rgba(255,180,60,0.6)',
          animation: 'kdFlame 1.2s ease-in-out infinite',
        }} />
      )}

      {d === 'royal' && (
        <>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: rounded + pad,
            border: '2px solid #ffd180',
            boxShadow: '0 0 12px rgba(255,209,128,0.7)',
          }} />
          <span style={{
            position: 'absolute', top: -size * 0.28, fontSize: size * 0.38,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
          }}>👑</span>
        </>
      )}

      {(d === 'racer' || d === 'orbit') && (
        <>
          <div style={{
            position: 'absolute', inset: 1, borderRadius: '50%',
            border: '1.5px dashed rgba(165,180,252,0.4)',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            animation: `kdSpin ${d === 'racer' ? 1.6 : 3.2}s linear infinite`,
          }}>
            <span style={{
              position: 'absolute', top: -size * 0.16, left: '50%',
              transform: 'translateX(-50%)',
              fontSize: size * 0.34, lineHeight: 1,
              filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.55))',
            }}>{d === 'racer' ? '🏎️' : '🛰️'}</span>
          </div>
        </>
      )}

      {core}
    </div>
  )
}
