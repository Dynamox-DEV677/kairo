import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CloudDownload, Lock, Zap, Layers, AlertCircle, BookOpen, FlaskConical, Brain } from 'lucide-react'

export interface CloudStats {
  events:     number
  flashcards: number
  doubts:     number
  formulas:   number
  concepts:   number
  mastery:    number
  xp:         number
}

interface Props {
  open:      boolean
  stats:     CloudStats | null
  busy?:     boolean
  onConfirm: () => void
  onDismiss: () => void
}

const C = {
  bg:        '#0A0D16',
  panel:     '#141A2A',
  panel2:    '#1C2233',
  border:    'rgba(255,255,255,0.08)',
  text:      '#fafafa',
  textDim:   '#B1B5BA',
  textFaint: '#9CA3AF',
  purple:    '#A5B4FC',
  purpleHi:  '#7C5CFF',
  amber:     '#FFB44A',
}

export default function CloudRestorePrompt({ open, stats, busy, onConfirm, onDismiss }: Props) {
  if (typeof document === 'undefined') return null

  const chips: { icon: any; label: string; value: number; color: string }[] = stats ? [
    { icon: Zap,          label: 'XP',         value: stats.xp,         color: C.amber },
    { icon: Layers,       label: 'Flashcards', value: stats.flashcards, color: C.purple },
    { icon: AlertCircle,  label: 'Mistakes',   value: stats.doubts,     color: C.purple },
    { icon: BookOpen,     label: 'Events',     value: stats.events,     color: C.purple },
    { icon: FlaskConical, label: 'Formulas',   value: stats.formulas,   color: C.purple },
    { icon: Brain,        label: 'Concepts',   value: stats.concepts,   color: C.purple },
  ].filter(c => c.value > 0) : []

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="crp-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 10000,
              background: 'rgba(5,6,10,0.9)',


            }}
          />
          <motion.div
            key="crp-card"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            style={{
              position: 'fixed', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(460px, calc(100vw - 32px))',
              maxHeight: 'calc(100vh - 48px)', overflowY: 'auto',
              zIndex: 10001,
              background: C.panel, border: `1px solid ${C.border}`, borderRadius: 18,
              boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
              padding: '26px 24px',
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 14, margin: '0 auto 16px',
              background: 'linear-gradient(135deg, #A5B4FC, #7C5CFF)',
              display: 'grid', placeItems: 'center',
              boxShadow: '0 8px 28px rgba(124, 92, 255,0.35)',
            }}>
              <CloudDownload size={26} color="#0A0D16" />
            </div>

            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: C.text, textAlign: 'center', letterSpacing: -0.3 }}>
              Welcome back — your data is backed up
            </h2>
            <p style={{ margin: '8px 0 18px', fontSize: 13, color: C.textDim, textAlign: 'center', lineHeight: 1.55 }}>
              We found your Kyno history in your account. Pull it onto this device?
            </p>

            {chips.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 18 }}>
                {chips.map(c => (
                  <div key={c.label} style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '7px 12px', borderRadius: 10,
                    background: C.panel2, border: `1px solid ${C.border}`,
                  }}>
                    <c.icon size={14} color={c.color} />
                    <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{c.value}</span>
                    <span style={{ fontSize: 11, color: C.textFaint, fontWeight: 600 }}>{c.label}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
              marginBottom: 18, fontSize: 11.5, color: C.textFaint,
            }}>
              <Lock size={12} color={C.purple} />
              Private — stored in your account, only you can read it.
            </div>

            <button
              onClick={onConfirm}
              disabled={busy}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #A5B4FC, #7C5CFF)',
                color: '#0A0D16', fontFamily: 'inherit', fontSize: 15, fontWeight: 800,
                cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 8px 24px rgba(124, 92, 255,0.3)',
              }}
            >
              {busy
                ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-flex' }}><CloudDownload size={16} /></motion.span>
                : <CloudDownload size={16} />}
              {busy ? 'Restoring…' : 'Restore to this device'}
            </button>
            <button
              onClick={onDismiss}
              disabled={busy}
              style={{
                width: '100%', marginTop: 10, padding: '11px', borderRadius: 12,
                background: 'transparent', border: `1px solid ${C.border}`,
                color: C.textDim, fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                cursor: busy ? 'default' : 'pointer',
              }}
            >
              Not now
            </button>
            <p style={{ margin: '12px 0 0', fontSize: 10.5, color: C.textFaint, textAlign: 'center', lineHeight: 1.5 }}>
              You can always pull it later from Settings → Backup &amp; sync → Sync now.
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
