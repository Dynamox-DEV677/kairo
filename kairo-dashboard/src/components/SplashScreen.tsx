/**
 * SplashScreen — premium app boot animation.
 *
 * Phases (timed in ms from mount):
 *   0   ── Black canvas + radial-purple glow fades in (0 → 1, 600ms)
 *   200 ── Neural grid lines stroke-draw across the field (200 → 1000ms)
 *   500 ── Kairo logo scales 0.3 → 1.0 with elastic spring + bloom
 *   900 ── 18 particles burst outward from logo, fading at the edges
 *   1200── Logo gets a subtle breathing pulse + violet halo
 *   1300── "Kairo" wordmark types in below the logo (700ms)
 *   1700── "Your AI academic twin" subtitle fades up
 *   2200── Progress bar fills from 0 → 100% (final 600ms)
 *   2800── Entire splash fades out → dashboard revealed
 *
 * Total duration: ~3.0s.
 * Skippable: tap anywhere after 1s OR press Esc.
 * Gated:     session-scoped (sessionStorage 'kairo:splash:shown') so we
 *            don't re-play it on every nav.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  /** Called once the splash has fully dismissed. Parent should reveal the app then. */
  onComplete: () => void
  /** Override for total duration (in ms). Default 3000. */
  duration?: number
}

// Ultramarine accent — deeper, more saturated royal blue. Sits between
// the brand's electric primary (#4F7CFF) and the deep anchor (#2046C2),
// so cards/buttons elsewhere stay harmonious.
const C = {
  bg:        '#050505',
  text:      '#ffffff',
  purpleDeep:'#0B1530',
  purple:    '#2A4FE0',  // ultramarine
  purpleLite:'#A5B4FC',
  purpleSoft:'#DBE7FF',
}

export default function SplashScreen({ onComplete, duration = 3000 }: Props) {
  const [visible, setVisible]   = useState(true)
  const [canSkip, setCanSkip]   = useState(false)

  useEffect(() => {
    const skipT = window.setTimeout(() => setCanSkip(true), 900)
    const exitT = window.setTimeout(() => setVisible(false), duration - 200)
    const doneT = window.setTimeout(() => onComplete(), duration)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && canSkip) {
        setVisible(false)
        window.setTimeout(() => onComplete(), 250)
      }
    }
    window.addEventListener('keydown', onKey)

    return () => {
      window.clearTimeout(skipT)
      window.clearTimeout(exitT)
      window.clearTimeout(doneT)
      window.removeEventListener('keydown', onKey)
    }
  }, [duration, onComplete, canSkip])

  function handleClick() {
    if (!canSkip) return
    setVisible(false)
    window.setTimeout(() => onComplete(), 250)
  }

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          onClick={handleClick}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.55, ease: [0.6, 0.0, 0.2, 1] }}
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: C.bg, color: C.text,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
            cursor: canSkip ? 'pointer' : 'default',
            // Anti-aliased crispness for the logo
            isolation: 'isolate',
          }}
        >
          <style>{`
            @keyframes splash-breath {
              0%, 100% { transform: scale(1) }
              50%      { transform: scale(1.04) }
            }
            @keyframes splash-halo {
              0%, 100% { opacity: 0.55 }
              50%      { opacity: 1 }
            }
            @keyframes splash-grid-fade {
              0%   { opacity: 0 }
              60%  { opacity: 0.55 }
              100% { opacity: 0.18 }
            }
            @keyframes splash-glow-pan {
              0%   { transform: translate3d(-12%, -8%, 0) }
              100% { transform: translate3d(12%, 8%, 0) }
            }
            @keyframes splash-caret {
              50% { opacity: 0 }
            }
          `}</style>

          {/* ─── Layer 1: Radial purple aura ────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              position: 'absolute', inset: '-20%',
              background: `
                radial-gradient(at 30% 30%, rgba(42, 79, 224, 0.40) 0%, transparent 50%),
                radial-gradient(at 70% 70%, rgba(165, 180, 252, 0.18) 0%, transparent 55%)
              `,
              animation: 'splash-glow-pan 8s ease-in-out infinite alternate',
              willChange: 'transform',
              pointerEvents: 'none',
            }}
          />

          {/* ─── Layer 2: Neural grid backdrop ──────────────────────────────── */}
          <svg
            width="100%" height="100%"
            viewBox="0 0 1200 800"
            preserveAspectRatio="xMidYMid slice"
            style={{
              position: 'absolute', inset: 0,
              animation: 'splash-grid-fade 2.2s 0.2s ease-out forwards',
              opacity: 0,
              pointerEvents: 'none',
            }}
          >
            <defs>
              <linearGradient id="splash-line" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"  stopColor="#4F7CFF" stopOpacity="0"/>
                <stop offset="50%" stopColor="#A5B4FC" stopOpacity="0.45"/>
                <stop offset="100%" stopColor="#4F7CFF" stopOpacity="0"/>
              </linearGradient>
            </defs>
            {/* Horizontal lines */}
            {[80, 200, 340, 460, 580, 700].map((y, i) => (
              <motion.line
                key={`h${y}`}
                x1={0} y1={y} x2={1200} y2={y}
                stroke="url(#splash-line)" strokeWidth={1}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.4, delay: 0.2 + i * 0.08, ease: 'easeOut' }}
              />
            ))}
            {/* Vertical lines */}
            {[100, 300, 500, 700, 900, 1100].map((x, i) => (
              <motion.line
                key={`v${x}`}
                x1={x} y1={0} x2={x} y2={800}
                stroke="url(#splash-line)" strokeWidth={1}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.4, delay: 0.3 + i * 0.08, ease: 'easeOut' }}
              />
            ))}
          </svg>

          {/* ─── Layer 3: Hero block ────────────────────────────────────────── */}
          <div style={{
            position: 'relative', zIndex: 2,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 22, padding: '0 28px',
            textAlign: 'center', maxWidth: 560,
          }}>
            {/* Logo plate */}
            <div style={{ position: 'relative', width: 180, height: 180 }}>
              {/* Outer halo */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.9, ease: 'easeOut' }}
                style={{
                  position: 'absolute', inset: -50,
                  background: 'radial-gradient(closest-side, rgba(42, 79, 224, 0.38), transparent 70%)',
                  filter: 'blur(28px)',
                  animation: 'splash-halo 3.4s 1.2s ease-in-out infinite',
                  pointerEvents: 'none',
                }}
              />

              {/* Rotating conic ring under the logo */}
              <motion.div
                initial={{ opacity: 0, scale: 0.4, rotate: -90 }}
                animate={{ opacity: 1, scale: 1, rotate: 270 }}
                transition={{ delay: 0.5, duration: 1.6, ease: [0.2, 0.8, 0.2, 1] }}
                style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: `conic-gradient(from 0deg at 50% 50%,
                    transparent 0%, rgba(165, 180, 252, 0.35) 35%,
                    transparent 65%, rgba(79, 124, 255, 0.32) 95%, transparent 100%)`,
                  WebkitMask: 'radial-gradient(circle, transparent 60%, black 62%, black 100%)',
                  mask:        'radial-gradient(circle, transparent 60%, black 62%, black 100%)',
                  pointerEvents: 'none',
                }}
              />

              {/* The logo itself */}
              <motion.div
                initial={{ opacity: 0, scale: 0.3, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.9, type: 'spring', stiffness: 280, damping: 22 }}
                style={{
                  position: 'absolute', inset: 0,
                  display: 'grid', placeItems: 'center',
                  animation: 'splash-breath 4s 1.6s ease-in-out infinite',
                }}
              >
                <img
                  src="/kairo_logo.png"
                  alt="Kairo"
                  width={120} height={120}
                  decoding="async" loading="eager"
                  draggable={false}
                  style={{
                    width: 120, height: 120, objectFit: 'contain',
                    filter: 'drop-shadow(0 12px 36px rgba(42, 79, 224, 0.38))',
                    userSelect: 'none', WebkitUserDrag: 'none',
                  }}
                />
              </motion.div>

              {/* Particle burst */}
              {Array.from({ length: 18 }).map((_, i) => {
                const angle    = (i / 18) * Math.PI * 2
                const distance = 130 + (i % 3) * 18
                const tx = Math.cos(angle) * distance
                const ty = Math.sin(angle) * distance
                const colors = [C.purpleSoft, C.purpleLite, C.purple]
                return (
                  <motion.div
                    key={`p${i}`}
                    initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                    animate={{
                      opacity: [0, 1, 1, 0],
                      x:       [0, tx],
                      y:       [0, ty],
                      scale:   [0, 1.2, 0.8],
                    }}
                    transition={{
                      duration: 1.5,
                      delay: 0.9 + (i % 6) * 0.04,
                      ease: 'easeOut',
                      times: [0, 0.2, 0.7, 1],
                    }}
                    style={{
                      position: 'absolute', top: '50%', left: '50%',
                      width: 6, height: 6, marginLeft: -3, marginTop: -3,
                      borderRadius: '50%',
                      background: colors[i % 3],
                      boxShadow: `0 0 12px ${colors[i % 3]}`,
                      pointerEvents: 'none',
                    }}
                  />
                )
              })}
            </div>

            {/* Wordmark + AI pill on one row */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
                fontSize: 'clamp(34px, 8vw, 44px)',
                fontWeight: 800,
                letterSpacing: -1.4,
                color: C.text,
                lineHeight: 1,
              }}
            >
              {/* "Kairo" — gradient white→ultramarine for a metallic look */}
              <span style={{
                background: 'linear-gradient(90deg, #FFFFFF 0%, #DBE7FF 40%, #A5B4FC 75%, #2A4FE0 100%)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Kairo
              </span>

              {/* White "AI" pill — small, sits on the wordmark baseline.
                  Crisp white text on glass tells you this is an AI product
                  the moment the splash paints, without shouting. */}
              <motion.span
                initial={{ opacity: 0, scale: 0.85, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 1.55, duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
                style={{
                  fontSize: 'clamp(10px, 2.1vw, 12px)',
                  fontWeight: 700,
                  letterSpacing: 1.6,
                  color: '#ffffff',
                  padding: '4px 9px',
                  borderRadius: 999,
                  background: 'rgba(255, 255, 255, 0.10)',
                  border: '1px solid rgba(255, 255, 255, 0.28)',
                  boxShadow: '0 0 18px rgba(42, 79, 224, 0.32)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  textTransform: 'uppercase',
                  alignSelf: 'center',
                }}
              >
                AI
              </motion.span>

              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: [1, 0, 1, 0, 1, 0] }}
                transition={{ delay: 1.4, duration: 1.2 }}
                style={{
                  display: 'inline-block', width: 4, height: 'clamp(28px, 6.5vw, 36px)',
                  marginLeft: 2, alignSelf: 'center',
                  background: '#ffffff', borderRadius: 1,
                  boxShadow: '0 0 12px rgba(255, 255, 255, 0.85)',
                }}
              />
            </motion.div>

            {/* Subtitle — white for max legibility on the dark canvas */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.7, duration: 0.7, ease: 'easeOut' }}
              style={{
                fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
                fontSize: 'clamp(11px, 2.6vw, 13px)',
                fontWeight: 700,
                letterSpacing: 3.2,
                textTransform: 'uppercase',
                color: 'rgba(255, 255, 255, 0.92)',
              }}
            >
              Your AI Academic Twin
            </motion.div>

            {/* Progress bar */}
            <div style={{
              marginTop: 6,
              width: 'min(280px, 70vw)',
              height: 2,
              background: 'rgba(102, 217, 255, 0.12)',
              borderRadius: 999, overflow: 'hidden',
              position: 'relative',
            }}>
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ delay: 0.4, duration: (duration - 600) / 1000, ease: 'easeInOut' }}
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #DBE7FF, #A5B4FC, #4F7CFF)',
                  boxShadow: '0 0 12px rgba(165, 180, 252, 0.9)',
                }}
              />
            </div>
          </div>

          {/* Skip hint — appears at 1s */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: canSkip ? 0.55 : 0 }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'absolute',
              bottom: 'calc(28px + env(safe-area-inset-bottom))',
              left: 0, right: 0,
              textAlign: 'center',
              fontSize: 11, fontWeight: 600,
              letterSpacing: 1.6, textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.70)',
              fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
              pointerEvents: 'none',
            }}
          >
            Tap to skip
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
