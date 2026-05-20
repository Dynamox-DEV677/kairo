/**
 * SprintOverlay — full-screen "your data is sprinting over" animation.
 *
 * Used by:
 *   - TwinBackupModal (manual import)
 *   - App.tsx (automatic pull from cloud on cross-device login)
 *
 * Strict monochrome palette.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Laptop, Brain, FileJson, Zap } from 'lucide-react'

const C = {
  bg:        '#050505',
  panel:     '#0E1117',
  panel2:    '#151922',
  text:      '#fafafa',
  textDim:   '#B1B5BA',
  textFaint: '#9CA3AF',
  textGhost: '#6B7280',
  purple:    '#66D9FF',
  purpleHi:  '#4F7CFF',
  purpleLite:'#A5B4FC',
  purpleSoft:'#DBE7FF',
}

export const SPRINT_PHASES: { text: string; sub: string }[] = [
  { text: 'Reaching for your data…',         sub: 'Talking to the cloud.' },
  { text: 'Unpacking events…',               sub: 'Quiz answers, lab visits, flashcard reviews.' },
  { text: 'Restoring doubts & formulas…',    sub: 'Every question you ever asked the Solver.' },
  { text: 'Rebuilding mastery model…',       sub: 'Ebbinghaus curves, confidence, retention.' },
  { text: 'Wiring up the Knowledge Graph…',  sub: 'Connecting topics back into a web.' },
  { text: 'Almost there…',                   sub: 'Your data is sprinting the last metre.' },
]

export const SPRINT_MIN_MS = 3200

interface Props {
  /** When true, overlay is mounted. Parent owns the lifecycle. */
  open:        boolean
  /** Optional override phase index. Self-rotates if not provided. */
  phaseIdx?:   number
  /** Either render fullscreen (default) or inside a relative parent. */
  fullscreen?: boolean
  /** Optional banner above the headline (e.g. "Welcome back"). */
  banner?:     string
  /** Optional override headline / subhead. */
  headline?:   string
  subhead?:    string
}

export default function SprintOverlay({ open, phaseIdx, fullscreen = true, banner, headline, subhead }: Props) {
  const [auto, setAuto] = useState(0)

  // Self-rotate phase when no external index is provided.
  useEffect(() => {
    if (!open || phaseIdx != null) return
    setAuto(0)
    const id = window.setInterval(() => {
      setAuto(i => Math.min(i + 1, SPRINT_PHASES.length - 1))
    }, 520)
    return () => window.clearInterval(id)
  }, [open, phaseIdx])

  if (!open) return null

  const idx = phaseIdx ?? auto
  const phase    = SPRINT_PHASES[Math.min(idx, SPRINT_PHASES.length - 1)]
  const progress = (idx + 1) / SPRINT_PHASES.length

  const dots = Array.from({ length: 14 }, (_, i) => i)

  const node = (
    <motion.div
      key="sprint-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        position: fullscreen ? 'fixed' : 'absolute',
        inset: 0,
        zIndex: fullscreen ? 9999 : 5,
        background: `linear-gradient(180deg, rgba(14,14,22,0.97) 0%, rgba(6,6,10,0.99) 100%)`,
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 28px',
        overflow: 'hidden',
      }}
    >
      <style>{`@keyframes sprint-glow { 0%,100% { opacity: 0.45 } 50% { opacity: 1 } }`}</style>

      {/* Backdrop orbs */}
      <div style={{
        position: 'absolute', top: '-20%', left: '15%',
        width: 280, height: 280, borderRadius: '50%',
        background: 'radial-gradient(closest-side, rgba(79, 124, 255, 0.35), transparent 70%)',
        filter: 'blur(40px)', animation: 'sprint-glow 4s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', right: '15%',
        width: 280, height: 280, borderRadius: '50%',
        background: 'radial-gradient(closest-side, rgba(165, 180, 252, 0.25), transparent 70%)',
        filter: 'blur(40px)', animation: 'sprint-glow 4s ease-in-out infinite 1s',
        pointerEvents: 'none',
      }} />

      {/* Device-to-device track */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 460, height: 120, marginBottom: 26 }}>
        {/* Source — file/laptop */}
        <motion.div
          animate={{ y: [-2, 2, -2] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
            width: 68, height: 68, borderRadius: 17,
            background: `linear-gradient(135deg, ${C.panel} 0%, ${C.bg} 100%)`,
            border: `1px solid ${C.purpleLite}55`,
            display: 'grid', placeItems: 'center',
            boxShadow: `0 0 28px rgba(165, 180, 252, 0.4)`,
            zIndex: 2,
          }}
        >
          <Laptop size={28} color={C.purpleLite} />
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              position: 'absolute', top: -8, right: -8,
              width: 24, height: 24, borderRadius: 7,
              background: C.purpleLite, color: '#000',
              display: 'grid', placeItems: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
            }}
          >
            <FileJson size={12} />
          </motion.div>
        </motion.div>

        {/* Track */}
        <div style={{
          position: 'absolute', left: 68, right: 68, top: '50%',
          height: 3, transform: 'translateY(-50%)',
          background: 'linear-gradient(90deg, rgba(165, 180, 252, 0.15), rgba(102, 217, 255, 0.45), rgba(79, 124, 255, 0.32), rgba(102, 217, 255, 0.45), rgba(165, 180, 252, 0.15))',
          borderRadius: 999, overflow: 'hidden',
        }}>
          <motion.div
            animate={{ x: ['-50%', '120%'] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            style={{
              position: 'absolute', top: -2, height: 7, width: 70,
              background: 'linear-gradient(90deg, transparent, #A5B4FC, transparent)',
              filter: 'blur(2px)', borderRadius: 999,
            }}
          />
        </div>

        {/* Particles */}
        {dots.map(i => (
          <motion.div
            key={i}
            initial={{ x: 70, opacity: 0, y: 56 }}
            animate={{
              x: ['10%', '90%'],
              opacity: [0, 1, 1, 0],
              y: 56 + Math.sin(i) * 8,
            }}
            transition={{
              duration: 1.4 + (i % 4) * 0.2,
              repeat: Infinity, delay: i * 0.15,
              ease: 'easeInOut',
            }}
            style={{
              position: 'absolute', left: 0, top: 0,
              width: 7, height: 7, borderRadius: '50%',
              background: i % 3 === 0 ? C.purpleLite : i % 3 === 1 ? C.purple : C.purpleSoft,
              boxShadow: `0 0 12px ${C.purpleLite}`,
            }}
          />
        ))}

        {/* Destination — brain */}
        <motion.div
          animate={{ y: [2, -2, 2] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
            width: 68, height: 68, borderRadius: 17,
            background: 'linear-gradient(135deg, #A5B4FC 0%, #4F7CFF 60%, #0B1530 100%)',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 0 36px rgba(79, 124, 255, 0.32)',
            zIndex: 2,
          }}
        >
          <Brain size={30} color="#000" />
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
            style={{
              position: 'absolute', inset: -10, borderRadius: 22,
              border: '2px solid #A5B4FC', pointerEvents: 'none',
            }}
          />
        </motion.div>
      </div>

      {banner && (
        <div style={{ fontSize: 10, fontWeight: 700, color: C.purpleSoft, letterSpacing: 2.6, textTransform: 'uppercase', marginBottom: 4 }}>
          {banner}
        </div>
      )}

      <motion.div
        initial={{ y: 6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        style={{
          fontSize: 11, fontWeight: 700, color: C.purpleLite,
          letterSpacing: 2.2, textTransform: 'uppercase',
          marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <Zap size={11} />
        Your data is sprinting over
      </motion.div>
      <h2 style={{
        margin: 0, fontSize: 24, fontWeight: 800,
        color: C.text, textAlign: 'center', letterSpacing: -0.4, lineHeight: 1.2,
        maxWidth: 520,
      }}>
        {headline || 'Give it a second — your data is racing across.'}
      </h2>
      {subhead && (
        <p style={{ margin: '8px 0 0', fontSize: 13, color: C.textDim, textAlign: 'center', maxWidth: 480, lineHeight: 1.55 }}>
          {subhead}
        </p>
      )}

      <div style={{ marginTop: 22, minHeight: 56, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28 }}
            style={{ textAlign: 'center' }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: -0.1 }}>
              {phase.text}
            </div>
            <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 4 }}>
              {phase.sub}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{
        marginTop: 20, width: '100%', maxWidth: 340,
        height: 4, borderRadius: 999, overflow: 'hidden',
        background: 'rgba(102, 217, 255, 0.12)',
      }}>
        <motion.div
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.4 }}
          style={{
            height: '100%',
            background: 'linear-gradient(90deg, #A5B4FC, #66D9FF, #4F7CFF)',
            boxShadow: '0 0 12px rgba(102, 217, 255, 0.7)',
          }}
        />
      </div>

      <div style={{ marginTop: 12, fontSize: 10.5, color: C.textGhost, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 700 }}>
        {Math.round(progress * 100)}%
      </div>
    </motion.div>
  )

  return fullscreen ? createPortal(node, document.body) : node
}
