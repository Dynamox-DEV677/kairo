import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, RotateCcw, X, ArrowDownToLine } from 'lucide-react'

interface UpdateInfo {
  version:     string
  releaseDate: string | null
  releaseName: string | null
}

interface DownloadInfo {
  version:        string | null
  percent:        number
  bytesPerSecond?: number
  transferred?:   number
  total?:         number
}

declare global {
  interface Window {
    kairoDesktop?: {
      isDesktop:            boolean
      onUpdateDownloading?: (cb: (info: DownloadInfo) => void) => () => void
      onUpdateReady?:       (cb: (info: UpdateInfo) => void) => () => void
      restartToUpdate?:     () => Promise<void>
    }
  }
}

type Phase = 'idle' | 'downloading' | 'ready'

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export default function DesktopUpdateBanner() {
  const [phase, setPhase]       = useState<Phase>('idle')
  const [version, setVersion]   = useState('')
  const [percent, setPercent]   = useState(0)
  const [speed, setSpeed]       = useState(0)
  const [busy, setBusy]         = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const versionRef = useRef('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const api = window.kairoDesktop
    if (!api?.isDesktop) return

    const unsubs: (() => void)[] = []

    if (api.onUpdateDownloading) {
      unsubs.push(api.onUpdateDownloading((info) => {
        if (info.version) {
          versionRef.current = info.version
          setVersion(info.version)
        }
        setPercent(info.percent ?? 0)
        setSpeed(info.bytesPerSecond ?? 0)
        setPhase('downloading')
        setDismissed(false)
      }))
    }

    if (api.onUpdateReady) {
      unsubs.push(api.onUpdateReady((info) => {
        setVersion(info.version || versionRef.current || 'latest')
        setPhase('ready')
        setDismissed(false)
      }))
    }

    return () => unsubs.forEach(u => u())
  }, [])

  if (phase === 'idle' || dismissed) return null

  async function onRestart() {
    if (busy) return
    setBusy(true)
    try {
      await window.kairoDesktop?.restartToUpdate?.()
    } catch {
      setBusy(false)
    }
  }

  const isDownloading = phase === 'downloading'
  const isReady       = phase === 'ready'

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={phase}
        initial={{ y: 80, opacity: 0, scale: 0.96 }}
        animate={{ y: 0,  opacity: 1, scale: 1 }}
        exit   ={{ y: 60, opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        style={{
          position: 'fixed',
          bottom: 'calc(24px + env(safe-area-inset-bottom))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          minWidth: isDownloading ? 280 : 340,
          maxWidth: 'calc(100vw - 32px)',
          background: 'rgba(10, 12, 18, 0.92)',
          backdropFilter: 'blur(20px) saturate(150%)',
          WebkitBackdropFilter: 'blur(20px) saturate(150%)',
          border: '1px solid rgba(79, 124, 255, 0.18)',
          borderRadius: 14,
          overflow: 'hidden',
          fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
          color: '#fafafa',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.03) inset',
        }}
      >
        {isDownloading && (
          <div style={{ padding: '14px 16px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <motion.div
                animate={{ y: [0, 3, 0] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: 'linear-gradient(135deg, rgba(79, 124, 255, 0.15), rgba(79, 124, 255, 0.06))',
                  border: '1px solid rgba(79, 124, 255, 0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ArrowDownToLine size={14} color="#4F7CFF" />
              </motion.div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '-0.01em' }}>
                  Downloading Kyno {version || ''}
                </div>
                <div style={{
                  fontSize: 11, color: '#8B92A0', marginTop: 1,
                  fontFamily: 'ui-monospace, monospace',
                }}>
                  {percent}%{speed > 0 ? ` · ${formatBytes(speed)}/s` : ''}
                </div>
              </div>

              <button
                onClick={() => setDismissed(true)}
                aria-label="Dismiss"
                style={{
                  background: 'transparent', border: 'none',
                  color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
                  padding: 4, lineHeight: 0, borderRadius: 6,
                }}
              >
                <X size={13} />
              </button>
            </div>

            <div style={{
              marginTop: 10, height: 3, borderRadius: 2,
              background: 'rgba(255, 255, 255, 0.06)',
              overflow: 'hidden',
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ ease: 'easeOut', duration: 0.4 }}
                style={{
                  height: '100%', borderRadius: 2,
                  background: 'linear-gradient(90deg, #4F7CFF, #66D9FF)',
                  boxShadow: '0 0 8px rgba(79, 124, 255, 0.3)',
                }}
              />
            </div>
          </div>
        )}

        {isReady && (
          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #4F7CFF 0%, #2046C2 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 20px rgba(79, 124, 255, 0.15)',
                flexShrink: 0,
              }}>
                <Download size={16} color="#fff" />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.01em' }}>
                  Kyno {version} is ready
                </div>
                <div style={{
                  fontSize: 11.5, color: '#8B92A0', marginTop: 2,
                  letterSpacing: 0.1,
                }}>
                  Restart to apply — your session picks up right where you left off.
                </div>
              </div>

              <button
                onClick={onRestart}
                disabled={busy}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 9,
                  background: busy
                    ? 'rgba(79, 124, 255, 0.25)'
                    : 'linear-gradient(135deg, #4F7CFF 0%, #2046C2 100%)',
                  color: '#fff', border: 'none',
                  fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                  cursor: busy ? 'wait' : 'pointer',
                  flexShrink: 0,
                  transition: 'transform .12s',
                }}
                onMouseDown={e => (e.currentTarget.style.transform = 'scale(.96)')}
                onMouseUp  ={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                {busy ? 'Restarting…' : <><RotateCcw size={12} /> Restart</>}
              </button>

              <button
                onClick={() => setDismissed(true)}
                aria-label="Dismiss"
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  color: '#6B7280', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
