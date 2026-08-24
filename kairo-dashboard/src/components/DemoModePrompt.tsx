import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'
import { seedDemo, loadState } from '../lib/twin'
import { authToken } from '../lib/storage'

function promptStorageKey(): string {
  if (typeof window === 'undefined') return 'kyno:demo-prompt-shown:_local'
  try {
    const tok = authToken()
    if (tok) {
      const payload = JSON.parse(atob(tok.split('.')[1]))
      if (payload?.sub) {
        let h = 0x811c9dc5
        const s = String(payload.sub)
        for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
        return 'kyno:demo-prompt-shown:' + ((h >>> 0).toString(36)).padStart(7, '0')
      }
    }
  } catch {  }
  return 'kyno:demo-prompt-shown:_local'
}

interface Props {
  delayMs?: number
}

export default function DemoModePrompt({ delayMs = 1400 }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(promptStorageKey())) return
    try {
      const state = loadState()
      if (state.events.length > 0) return
    } catch {  }

    const t = window.setTimeout(() => setOpen(true), delayMs)
    return () => window.clearTimeout(t)
  }, [delayMs])

  function dismiss() {
    try { localStorage.setItem(promptStorageKey(), 'dismissed:' + Date.now()) } catch {  }
    setOpen(false)
  }

  function accept() {
    if (busy) return
    setBusy(true)
    try {
      seedDemo()
      localStorage.setItem(promptStorageKey(), 'accepted:' + Date.now())
      window.location.reload()
    } catch (err) {
      console.warn('[DemoModePrompt] seed failed:', err)
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0,  filter: 'blur(0px)' }}
          exit={{    opacity: 0, y: 16, filter: 'blur(6px)' }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'fixed',
            right: 'calc(20px + env(safe-area-inset-right))',
            bottom: 'calc(20px + env(safe-area-inset-bottom))',
            zIndex: 9000,
            maxWidth: 'min(360px, calc(100vw - 40px))',
            background: 'rgba(14, 17, 23, 0.86)',


            border: '1px solid rgba(124, 92, 255, 0.22)',
            borderRadius: 14,
            padding: 18,
            color: '#fafafa',
            fontFamily: '-apple-system, "SF Pro Display", "Inter", system-ui, sans-serif',
            boxShadow: '0 18px 48px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(124, 92, 255, 0.06)',
          }}
        >
          <button className="kyno-ghost"
            onClick={dismiss}
            aria-label="Dismiss"
            style={{
              position: 'absolute', top: 10, right: 10,
              background: 'transparent', border: 'none',
              color: 'rgba(255, 255, 255, 0.5)', cursor: 'pointer',
              padding: 4, lineHeight: 0, borderRadius: 6,
            }}
          >
            <X size={14} />
          </button>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                display: 'grid', placeItems: 'center',
                background: 'linear-gradient(135deg, #7C5CFF 0%, #4A2FA8 100%)',
                boxShadow: '0 0 18px rgba(124, 92, 255, 0.20)',
              }}
            >
              <Sparkles size={16} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.01em' }}>
                Try Demo Mode
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#B1B5BA', lineHeight: 1.55 }}>
                Skip the empty dashboard — load two weeks of realistic Class 10 CBSE activity
                so you can explore Kyno, Flashcards, Concept Map and Mistake Analysis with
                real data.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="kyno-chunky"
              onClick={accept}
              disabled={busy}
              style={{
                flex: 1,
                padding: '9px 12px', borderRadius: 9, border: 'none',
                background: busy
                  ? 'rgba(124, 92, 255, 0.30)'
                  : 'linear-gradient(135deg, #7C5CFF 0%, #4A2FA8 100%)',
                color: '#fff', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                cursor: busy ? 'wait' : 'pointer',
                letterSpacing: 0.2,
              }}
            >
              {busy ? 'Loading…' : 'Load demo data'}
            </button>
            <button className="kyno-ghost"
              onClick={dismiss}
              style={{
                padding: '9px 14px', borderRadius: 9,
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.10)',
                color: '#9CA3AF', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Not now
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
