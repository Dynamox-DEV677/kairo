import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  onComplete: () => void
  duration?: number
}

export default function SplashScreen({ onComplete, duration = 2600 }: Props) {
  const [visible, setVisible] = useState(true)
  const [canSkip, setCanSkip] = useState(false)

  useEffect(() => {
    const skipT = window.setTimeout(() => setCanSkip(true), 700)
    const exitT = window.setTimeout(() => setVisible(false), duration - 200)
    const doneT = window.setTimeout(() => onComplete(), duration)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && canSkip) { setVisible(false); window.setTimeout(() => onComplete(), 250) }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(skipT); window.clearTimeout(exitT); window.clearTimeout(doneT)
      window.removeEventListener('keydown', onKey)
    }
  }, [duration, onComplete, canSkip])

  const handleClick = () => {
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
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: '#050505', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', cursor: canSkip ? 'pointer' : 'default',
          }}
        >
          <style>{`
            @keyframes kb-breath { 0%,100% { transform: scale(1) } 50% { transform: scale(1.045) } }
            @keyframes kb-glow   { 0%,100% { opacity: .5 } 50% { opacity: .9 } }
          `}</style>

          <div style={{
            position: 'absolute', top: '34%', left: '50%', width: 520, height: 520,
            transform: 'translate(-50%, -50%)', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(79,124,255,0.28), transparent 68%)',
            filter: 'blur(24px)', animation: 'kb-glow 3.6s ease-in-out infinite', pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
            <motion.img
              src="/kairo_logo.png" alt="Kyno" width={128} height={128}
              decoding="async" loading="eager" draggable={false}
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
              style={{
                width: 128, height: 128, objectFit: 'contain',
                filter: 'drop-shadow(0 0 26px rgba(102,217,255,0.5)) drop-shadow(0 10px 30px rgba(79,124,255,0.4))',
                animation: 'kb-breath 4s 0.9s ease-in-out infinite',
                userSelect: 'none', WebkitUserDrag: 'none',
              }}
            />

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
            >
              <div style={{
                fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
                fontSize: 'clamp(38px, 9vw, 48px)', fontWeight: 800, letterSpacing: -1.5, lineHeight: 1,
                background: 'linear-gradient(90deg, #ffffff 0%, #DBE7FF 45%, #8FB0FF 100%)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                Kyno
              </div>
              <div style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 12, fontWeight: 700, letterSpacing: 3.5, textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.55)',
              }}>
                Your AI Academic Twin
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              style={{
                marginTop: 6, width: 'min(220px, 60vw)', height: 3,
                borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden',
              }}
            >
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ delay: 0.4, duration: (duration - 700) / 1000, ease: 'easeInOut' }}
                style={{ height: '100%', background: 'linear-gradient(90deg, #66D9FF, #4F7CFF)' }}
              />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: canSkip ? 0.5 : 0 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'absolute', bottom: 'calc(30px + env(safe-area-inset-bottom))', left: 0, right: 0,
              textAlign: 'center', fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.6)', fontFamily: "'Inter', system-ui, sans-serif", pointerEvents: 'none',
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
