import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Sparkles, X } from 'lucide-react'
import { PrimaryButton } from './PrimaryButton'

export interface ConfirmOptions {
  title:         string
  body?:         string
  confirmLabel?: string
  cancelLabel?:  string
  tone?:         'danger' | 'primary'
  icon?:         React.ReactNode
}

let dialogRoot: HTMLDivElement | null = null

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(false); return }

    if (!dialogRoot) {
      dialogRoot = document.createElement('div')
      dialogRoot.id = 'kairo-confirm-root'
      document.body.appendChild(dialogRoot)
    }

    import('react-dom/client').then(({ createRoot }) => {
      const node = document.createElement('div')
      dialogRoot!.appendChild(node)
      const root = createRoot(node)

      function cleanup(value: boolean) {
        root.render(<ConfirmModal {...opts} open={false} onClose={() => {}} onConfirm={() => {}} />)
        setTimeout(() => {
          root.unmount()
          if (node.parentNode) node.parentNode.removeChild(node)
        }, 220)
        resolve(value)
      }

      root.render(
        <ConfirmModal
          {...opts}
          open={true}
          onClose={()   => cleanup(false)}
          onConfirm={() => cleanup(true)}
        />
      )
    })
  })
}

export interface ConfirmModalProps extends ConfirmOptions {
  open:      boolean
  onConfirm: () => void
  onClose:   () => void
}

export default function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  tone         = 'primary',
  icon,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter')  onConfirm()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTimeout(() => cancelRef.current?.focus(), 30)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose, onConfirm])

  if (typeof document === 'undefined') return null

  const danger = tone === 'danger'
  const accentColor = danger ? '#FB7185' : '#A5B4FC'
  const glowColor   = danger ? 'rgba(251,113,133,0.32)' : 'rgba(124, 92, 255, 0.35)'
  const DefaultIcon = danger ? AlertTriangle : Sparkles

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(6, 6, 10, 0.78)',


            display: 'grid', placeItems: 'center',
            padding: 16,
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit   ={{ opacity: 0, y: 8,  scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={e => e.stopPropagation()}
            role="dialog" aria-modal="true" aria-labelledby="kairo-confirm-title"
            style={{
              width: '100%', maxWidth: 420,
              background: 'linear-gradient(180deg, #1C2233 0%, #0d0d15 100%)',
              border: `1px solid ${danger ? 'rgba(248,113,113,0.32)' : 'rgba(124, 92, 255, 0.32)'}`,
              borderRadius: 18,
              padding: 24,
              position: 'relative',
              overflow: 'hidden',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
              boxShadow: `0 24px 80px ${glowColor}, 0 0 0 1px rgba(255,255,255,0.02) inset`,
            }}
          >
            <div style={{
              position: 'absolute', top: -40, right: -40,
              width: 160, height: 160, borderRadius: '50%',
              background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
              pointerEvents: 'none',
            }} />

            <button className="kyno-ghost"
              onClick={onClose}
              aria-label="Close"
              style={{
                position: 'absolute', top: 14, right: 14,
                width: 28, height: 28, borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.08)', background: 'transparent',
                color: '#9CA3AF', cursor: 'pointer',
                display: 'grid', placeItems: 'center',
              }}
            >
              <X size={14} />
            </button>

            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: danger ? 'rgba(248,113,113,0.12)' : 'rgba(124, 92, 255, 0.12)',
              border:    `1px solid ${danger ? 'rgba(248,113,113,0.32)' : 'rgba(124, 92, 255, 0.32)'}`,
              display: 'grid', placeItems: 'center',
              marginBottom: 14,
              position: 'relative',
              boxShadow: `0 0 24px ${glowColor}`,
            }}>
              {icon ?? <DefaultIcon size={20} color={accentColor} />}
            </div>

            <h2 id="kairo-confirm-title" style={{
              margin: 0, fontSize: 18, fontWeight: 800,
              color: '#fafafa', letterSpacing: -0.3, lineHeight: 1.3,
            }}>
              {title}
            </h2>

            {body && (
              <p style={{
                margin: '8px 0 0', fontSize: 13.5, color: '#B1B5BA', lineHeight: 1.6,
              }}>
                {body}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              {/* Cancel stays visually quiet and Confirm carries the weight —
                  except when tone="danger", where the *destructive* action is
                  deliberately NOT the glowing one. A student should not have to
                  read the label to know which button is the safe one. */}
              <PrimaryButton
                ref={cancelRef}
                onClick={onClose}
                variant={danger ? 'primary' : 'secondary'}
              >
                {cancelLabel}
              </PrimaryButton>
              <PrimaryButton
                onClick={onConfirm}
                variant={danger ? 'danger' : 'primary'}
              >
                {confirmLabel}
              </PrimaryButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    dialogRoot || document.body
  )
}
