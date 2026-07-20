// Reusable Duolingo-style gamified components — the shared building blocks the
// screens compose in step 3. All colours read the CSS theme vars (var(--c-*)),
// so a :root tweak re-themes them everywhere. Animation = transform/opacity only.
import { useId, type ReactNode, type CSSProperties, type ButtonHTMLAttributes } from 'react'
import { motion } from 'framer-motion'
import { Flame } from 'lucide-react'
import { KYNO } from '../theme/tokens'

const DISPLAY = 'var(--kyno-display)'

// ── Chunky press-down button ────────────────────────────────────────────────
type ChunkyVariant = 'primary' | 'cyan' | 'gold' | 'ghost'
type ChunkySize = 'sm' | 'md' | 'lg'

const SIZE: Record<ChunkySize, CSSProperties> = {
  sm: { padding: '8px 14px',  fontSize: 12.5, gap: 6 },
  md: { padding: '11px 18px', fontSize: 14,   gap: 8 },
  lg: { padding: '14px 22px', fontSize: 16,   gap: 9 },
}

interface ChunkyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ChunkyVariant
  size?:    ChunkySize
  icon?:    ReactNode
  full?:    boolean
}

export function ChunkyButton({ variant = 'primary', size = 'md', icon, full, children, style, className, ...rest }: ChunkyButtonProps) {
  const cls = variant === 'ghost'
    ? 'kyno-ghost'
    : `kyno-chunky${variant === 'primary' ? '' : ` ${variant}`}`
  return (
    <button
      {...rest}
      className={[cls, className].filter(Boolean).join(' ')}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        ...SIZE[size],
        width: full ? '100%' : undefined,
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  )
}

// ── Bold rounded card ────────────────────────────────────────────────────────
interface GamCardProps {
  children:   ReactNode
  title?:     string
  icon?:      ReactNode
  accent?:    string
  right?:     ReactNode
  padding?:   number | string
  style?:     CSSProperties
  className?: string
}

export function GamCard({ children, title, icon, accent = 'var(--c-purple)', right, padding = 18, style, className }: GamCardProps) {
  return (
    <div className={['kyno-card', className].filter(Boolean).join(' ')} style={{ padding, ...style }}>
      {(title || right || icon) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
          {icon && <span style={{ color: accent, display: 'inline-flex' }}>{icon}</span>}
          {title && <span style={{ fontFamily: DISPLAY, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: accent }}>{title}</span>}
          {right && <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}>{right}</span>}
        </div>
      )}
      {children}
    </div>
  )
}

// ── Circular level ring (purple→cyan gradient stroke) ────────────────────────
export function LevelRing({ level, into, need, size = 66, stroke = 6 }: {
  level: number; into: number; need: number; size?: number; stroke?: number
}) {
  const id = useId()
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const frac = need > 0 ? Math.max(0, Math.min(1, into / need)) : 0
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor={KYNO.violet} />
            <stop offset="100%" stopColor={KYNO.cyan} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)}
          style={{ transition: 'stroke-dashoffset .7s cubic-bezier(0.22,1,0.36,1)' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
        fontFamily: DISPLAY, fontWeight: 900, fontSize: Math.round(size * 0.36), color: 'var(--c-text)',
      }}>{level}</div>
    </div>
  )
}

// ── Animated cyan XP bar ─────────────────────────────────────────────────────
export function XPBar({ pct, height = 8, shine = true }: { pct: number; height?: number; shine?: boolean }) {
  const p = Math.max(0, Math.min(100, pct))
  return (
    <div style={{ height, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
      <motion.div
        initial={false}
        animate={{ width: `${p}%` }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{ height: '100%', background: 'var(--c-cyan)', borderRadius: 999, position: 'relative', overflow: 'hidden' }}
      >
        {shine && p > 4 && (
          <div style={{
            position: 'absolute', top: 0, bottom: 0, width: '40%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
            animation: 'kyno-xp-shine 2.4s ease-in-out infinite',
          }} />
        )}
      </motion.div>
    </div>
  )
}

// ── Gold flame streak (reacts to length) ─────────────────────────────────────
export function StreakFlame({ days, showLabel = true }: { days: number; showLabel?: boolean }) {
  const size = 15 + Math.min(days, 30) * 0.4
  const glow = Math.min(days, 18)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <Flame size={size} style={{
        color: 'var(--c-gold)',
        filter: `drop-shadow(0 0 ${glow}px rgba(255,176,32,0.6))`,
        animation: days >= 3 ? 'kyno-flame 1.6s ease-in-out infinite' : undefined,
      }} />
      <span style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 20, color: 'var(--c-gold)' }}>{days}</span>
      {showLabel && <span style={{ fontSize: 10.5, color: 'var(--c-faint)' }}>day streak</span>}
    </span>
  )
}

// ── Vibrant Quick-Action tile (press-down + purple accent) ───────────────────
export function QuickTile({ icon, label, onClick }: { icon: ReactNode; label: string; onClick?: () => void }) {
  return (
    <button className="kyno-tile" onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '14px 8px', color: 'var(--c-text)', fontFamily: 'inherit', width: '100%' }}>
      <span style={{
        width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center',
        background: 'rgba(124,107,246,0.16)', color: 'var(--c-purple-lite)',
        border: '1px solid rgba(124,107,246,0.30)',
      }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
    </button>
  )
}

// ── Small value-tied progress bar (Vitals mini-bars) ─────────────────────────
export function MiniBar({ value, color = 'var(--c-cyan)', height = 5 }: { value: number; color?: string; height?: number }) {
  const p = Math.max(0, Math.min(100, value))
  return (
    <div style={{ height, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ height: '100%', width: `${p}%`, background: color, borderRadius: 999, transition: 'width .5s cubic-bezier(0.22,1,0.36,1)' }} />
    </div>
  )
}

// ── Big number + smaller muted unit, baseline-aligned ────────────────────────
export function StatNumber({ value, unit, color = 'var(--c-text)', size = 30 }: { value: ReactNode; unit?: string; color?: string; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ fontSize: size, fontWeight: 900, color, lineHeight: 1 }}>{value}</span>
      {unit && <span style={{ fontSize: Math.round(size * 0.42), fontWeight: 700, color: 'var(--c-faint)' }}>{unit}</span>}
    </span>
  )
}
