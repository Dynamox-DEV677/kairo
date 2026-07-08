/**
 * ResetShell — the mobile-first surface every step shares.
 *
 *   ┌────────────────────────┐
 *   │ ◀ Back      step 2/5  │  ← header (safe-area aware)
 *   │                       │
 *   │   Kyno logo          │
 *   │                       │
 *   │   {children}          │  ← scroll-safe body
 *   │                       │
 *   ├────────────────────────┤
 *   │  [ Sticky CTA ]       │  ← bottom action
 *   └────────────────────────┘
 *
 *  - Dark background with animated purple aura
 *  - Glass top header
 *  - Safe-area insets on top + bottom
 *  - Slide+fade transitions between steps via AnimatePresence
 */
import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { RC, FONT } from './shared'

interface Props {
  stepIndex:    number          // 1-5
  stepCount:    number          // 5
  onBack?:      () => void
  /** Replaces the default Kyno logo block. */
  logo?:        ReactNode
  /** Big page title (large H1). */
  title:        string
  /** Sub-line under the title. */
  subtitle?:    string
  /** Page body. */
  children:     ReactNode
  /** Sticky bottom CTA(s). */
  footer?:      ReactNode
}

export default function ResetShell({
  stepIndex, stepCount, onBack, logo, title, subtitle, children, footer,
}: Props) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: RC.bg,
        color: RC.text, fontFamily: FONT,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Ambient aura layer */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `
          radial-gradient(at 50% -10%, rgba(79, 124, 255, 0.30) 0%, transparent 45%),
          radial-gradient(at 0% 100%, rgba(165, 180, 252, 0.10) 0%, transparent 50%),
          radial-gradient(at 100% 100%, rgba(79, 124, 255, 0.12) 0%, transparent 45%)
        `,
        animation: 'rs-aura 10s ease-in-out infinite alternate',
      }} />
      <style>{`
        @keyframes rs-aura {
          0%   { transform: translate3d(-2%, -1%, 0); }
          100% { transform: translate3d( 2%,  1%, 0); }
        }
        @keyframes rs-shake {
          0%, 100% { transform: translateX(0); }
          12% { transform: translateX(-8px); }
          24% { transform: translateX(8px); }
          36% { transform: translateX(-6px); }
          48% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          72% { transform: translateX(4px); }
          84% { transform: translateX(-2px); }
        }
        .rs-shake { animation: rs-shake 0.55s ease both; }
      `}</style>

      {/* Header */}
      <div
        style={{
          position: 'relative', zIndex: 2,
          padding: 'calc(env(safe-area-inset-top) + 14px) 18px 8px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(180deg, rgba(5,5,5,0.85) 0%, transparent 100%)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
      >
        {onBack ? (
          <button
            onClick={onBack}
            aria-label="Back"
            style={{
              width: 44, height: 44, borderRadius: 14,
              border: `1px solid ${RC.border}`,
              background: 'rgba(102, 217, 255, 0.06)',
              color: RC.text, cursor: 'pointer',
              display: 'grid', placeItems: 'center',
              WebkitTapHighlightColor: 'transparent',
              transition: 'background 0.2s',
            }}
            onMouseDown={e => (e.currentTarget.style.background = 'rgba(102, 217, 255, 0.15)')}
            onMouseUp={e =>   (e.currentTarget.style.background = 'rgba(102, 217, 255, 0.06)')}
          >
            <ArrowLeft size={18} />
          </button>
        ) : (
          <div style={{ width: 44, height: 44 }} />
        )}

        <div style={{
          fontSize: 11, fontWeight: 700, color: RC.textFaint,
          letterSpacing: 1.6, textTransform: 'uppercase',
        }}>
          Step {stepIndex} of {stepCount}
        </div>

        <div style={{ width: 44, height: 44 }} />
      </div>

      {/* Progress strip */}
      <div style={{
        position: 'relative', zIndex: 2, padding: '0 18px 14px',
        display: 'flex', gap: 6,
      }}>
        {Array.from({ length: stepCount }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1, height: 4, borderRadius: 999,
              background: i < stepIndex ? RC.purple : 'rgba(102, 217, 255, 0.14)',
              transition: 'background 0.35s',
              boxShadow: i < stepIndex ? `0 0 8px rgba(102, 217, 255, 0.55)` : 'none',
            }}
          />
        ))}
      </div>

      {/* Body */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
        style={{
          position: 'relative', zIndex: 1,
          flex: 1, overflowY: 'auto',
          padding: '20px 22px 24px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {logo !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            {logo}
          </div>
        )}

        <h1 style={{
          margin: '6px 0 8px',
          fontSize: 'clamp(28px, 7vw, 34px)',
          fontWeight: 800, letterSpacing: -0.8, lineHeight: 1.1,
          textAlign: 'center',
        }}>
          {title}
        </h1>

        {subtitle && (
          <p style={{
            margin: '0 0 26px',
            fontSize: 14.5, lineHeight: 1.55,
            color: RC.textDim, textAlign: 'center',
            padding: '0 6px',
          }}>
            {subtitle}
          </p>
        )}

        {children}
      </motion.div>

      {/* Sticky footer */}
      {footer && (
        <div
          style={{
            position: 'relative', zIndex: 2,
            padding: '14px 22px calc(env(safe-area-inset-bottom) + 16px)',
            background: 'linear-gradient(180deg, transparent 0%, rgba(5,5,5,0.95) 30%, #050505 100%)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  )
}

// ─── Re-usable subcomponents ──────────────────────────────────────────────

/** Premium full-width primary button. */
export function PrimaryButton({ children, onClick, disabled, busy, type = 'button' }: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  busy?: boolean
  type?: 'button' | 'submit'
}) {
  const isOff = disabled || busy
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={isOff}
      whileTap={isOff ? undefined : { scale: 0.98 }}
      style={{
        width: '100%',
        minHeight: 54,
        padding: '0 22px',
        borderRadius: 18,
        border: 'none',
        background: isOff
          ? 'rgba(102, 217, 255, 0.12)'
          : 'linear-gradient(135deg, #A5B4FC 0%, #4F7CFF 100%)',
        color: isOff ? RC.textGhost : '#000',
        fontFamily: FONT,
        fontSize: 16,
        fontWeight: 800,
        letterSpacing: 0.2,
        cursor: isOff ? 'not-allowed' : 'pointer',
        boxShadow: isOff ? 'none' : '0 14px 32px rgba(79, 124, 255, 0.42)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 0.2s, box-shadow 0.2s',
      }}
    >
      {busy && (
        <span style={{
          width: 18, height: 18, borderRadius: '50%',
          border: '2px solid rgba(0,0,0,0.25)',
          borderTopColor: '#000',
          animation: 'spin 0.7s linear infinite',
        }} />
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {children}
    </motion.button>
  )
}

/** Quieter secondary text-button. */
export function TextButton({ children, onClick, disabled }: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        minHeight: 48,
        background: 'transparent',
        border: 'none',
        color: disabled ? RC.textGhost : RC.purpleLite,
        fontFamily: FONT,
        fontSize: 14,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        WebkitTapHighlightColor: 'transparent',
        letterSpacing: 0.2,
      }}
    >
      {children}
    </button>
  )
}

/** Compact Kyno wordmark badge — used as the default logo block. */
export function KairoBadge() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 18px', borderRadius: 999,
      background: 'rgba(102, 217, 255, 0.08)',
      border: `1px solid ${RC.border}`,
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 7,
        background: 'linear-gradient(135deg, #A5B4FC, #4F7CFF)',
        boxShadow: '0 0 12px rgba(79, 124, 255, 0.03)',
      }} />
      <span style={{
        fontFamily: FONT,
        fontSize: 12, fontWeight: 800, letterSpacing: 2.2,
        background: GRADIENT_TEXT, WebkitBackgroundClip: 'text',
        backgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>
        KYNO
      </span>
    </div>
  )
}

const GRADIENT_TEXT = 'linear-gradient(135deg, #DBE7FF 0%, #A5B4FC 50%, #4F7CFF 100%)'
