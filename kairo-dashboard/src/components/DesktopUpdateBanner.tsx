/**
 * Desktop Update Banner.
 *
 * Listens for `window.kairoDesktop.onUpdateReady()` — fired by the
 * Electron auto-updater when a new installer has finished downloading.
 * Slides up from the bottom of the window with a tight, Kairo-styled
 * "Restart to update" card. Clicking Restart calls back into IPC and
 * the shell quits + relaunches on the new build.
 *
 * In the web build (no Electron), `kairoDesktop` is undefined and this
 * component renders nothing. Safe to mount unconditionally in App.tsx.
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, RotateCcw, X } from 'lucide-react'

interface UpdateInfo {
  version:     string
  releaseDate: string | null
  releaseName: string | null
}

declare global {
  interface Window {
    kairoDesktop?: {
      isDesktop:        boolean
      onUpdateReady?:   (cb: (info: UpdateInfo) => void) => () => void
      restartToUpdate?: () => Promise<void>
    }
  }
}

export default function DesktopUpdateBanner() {
  const [info,    setInfo]    = useState<UpdateInfo | null>(null)
  const [busy,    setBusy]    = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const api = window.kairoDesktop
    if (!api?.isDesktop || !api.onUpdateReady) return

    // Subscribe — returns an unsubscriber. Renders nothing until the
    // first update-downloaded event fires.
    const unsub = api.onUpdateReady((next) => {
      setInfo(next)
      setDismissed(false)        // re-show if previously dismissed
    })
    return () => unsub()
  }, [])

  if (!info || dismissed) return null

  async function onRestart() {
    if (busy) return
    setBusy(true)
    try {
      await window.kairoDesktop?.restartToUpdate?.()
      // No code runs after this — the app is restarting.
    } catch (e) {
      setBusy(false)
      // eslint-disable-next-line no-console
      console.warn('[Kairo] restart failed:', e)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="update-banner"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0,   opacity: 1 }}
        exit   ={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        style={{
          position: 'fixed',
          bottom: 'calc(28px + env(safe-area-inset-bottom))',
          left:   '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          padding: '14px 18px 14px 16px',
          minWidth: 320, maxWidth: 'calc(100vw - 32px)',
          background:
            'linear-gradient(135deg, #1a0b3b 0%, #0E1117 60%, #050505 100%)',
          border: '1px solid rgba(102, 217, 255, 0.35)',
          borderRadius: 16,
          boxShadow:
            '0 16px 48px rgba(79, 124, 255, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.04) inset',
          display: 'flex', alignItems: 'center', gap: 14,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
          color: '#ffffff',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {/* Sparkle badge */}
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #4F7CFF 0%, #2046C2 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 18px rgba(79, 124, 255, 0.32)',
          flexShrink: 0,
        }}>
          <Sparkles size={17} color="#fff" />
        </div>

        {/* Copy */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: -0.1 }}>
            Kairo {info.version} is ready
          </div>
          <div style={{
            fontSize: 11.5, color: '#CBD5E1', marginTop: 2,
            fontFamily: 'ui-monospace, monospace', letterSpacing: 0.2,
          }}>
            Restart to apply — your session stays put.
          </div>
        </div>

        {/* Buttons */}
        <button
          onClick={onRestart}
          disabled={busy}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            background: busy
              ? 'rgba(102, 217, 255, 0.3)'
              : 'linear-gradient(135deg, #fafafa 0%, #A5B4FC 100%)',
            color: '#050505',
            border: 'none', fontFamily: 'inherit',
            fontSize: 12.5, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
            boxShadow: '0 0 14px rgba(165, 180, 252, 0.35)',
            flexShrink: 0,
            transition: 'transform .15s',
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(.97)')}
          onMouseUp  ={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          {busy ? 'Restarting…' : <><RotateCcw size={12} /> Restart</>}
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss update banner"
          style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#9CA3AF', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <X size={13} />
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
