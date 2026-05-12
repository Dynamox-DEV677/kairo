/**
 * ConfirmModal — premium replacement for `window.confirm()`.
 *
 * Use the imperative helper:
 *
 *   import { confirmDialog } from '../components/ConfirmModal'
 *
 *   const yes = await confirmDialog({
 *     title:    'Wipe your Twin?',
 *     body:     "Everything Kairo OS learned about you will be erased from this device.",
 *     confirmLabel: 'Yes, wipe',
 *     tone:     'danger',
 *   })
 *   if (yes) doIt()
 *
 * Or render <ConfirmModal> directly for fully-controlled cases.
 *
 * Features:
 *   - Glassmorphism backdrop with blur + radial glow
 *   - ESC to cancel, click backdrop to cancel
 *   - Two tones: 'danger' (red) or 'primary' (purple gradient)
 *   - Framer Motion enter/exit
 *   - Body-scroll lock while open
 *   - Auto-focuses the cancel button so an accidental Enter doesn't confirm
 */
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Sparkles, X } from 'lucide-react'

export interface ConfirmOptions {
  title:         string
  body?:         string
  confirmLabel?: string
  cancelLabel?:  string
  tone?:         'danger' | 'primary'
  icon?:         React.ReactNode
}

// ════════════════════════════════════════════════════════════════════════════
// Imperative API — confirmDialog() returns a Promise<boolean>
// ════════════════════════════════════════════════════════════════════════════

let dialogRoot: HTMLDivElement | null = null

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(false); return }

    // Lazily create / re-use a single host node for all dialogs
    if (!dialogRoot) {
      dialogRoot = document.createElement('div')
      dialogRoot.id = 'kairo-confirm-root'
      document.body.appendChild(dialogRoot)
    }

    // Dynamically import react-dom/client to render the dialog.
    // This keeps the module purely React-friendly without a global root.
    import('react-dom/client').then(({ createRoot }) => {
      const node = document.createElement('div')
      dialogRoot!.appendChild(node)
      const root = createRoot(node)

      function cleanup(value: boolean) {
        // Animate out then unmount
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

// ════════════════════════════════════════════════════════════════════════════
// Controlled component
// ════════════════════════════════════════════════════════════════════════════

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

  // ESC closes, focus cancel on open, lock body scroll
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
  const accentColor = danger ? '#f87171' : '#a78bfa'
  const glowColor   = danger ? 'rgba(248,113,113,0.35)' : 'rgba(124,58,237,0.35)'
  const confirmGradient = danger
    ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
    : 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #2563eb 100%)'

  const DefaultIcon = danger ? AlertTriangle : Sparkles

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          // Backdrop
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(6, 6, 10, 0.78)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'grid', placeItems: 'center',
            padding: 16,
          }}
        >
          <motion.div
            // Dialog
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit   ={{ opacity: 0, y: 8,  scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={e => e.stopPropagation()}
            role="dialog" aria-modal="true" aria-labelledby="kairo-confirm-title"
            style={{
              width: '100%', maxWidth: 420,
              background: 'linear-gradient(180deg, #14141f 0%, #0d0d15 100%)',
              border: `1px solid ${danger ? 'rgba(248,113,113,0.32)' : 'rgba(124,58,237,0.32)'}`,
              borderRadius: 18,
              padding: 24,
              position: 'relative',
              overflow: 'hidden',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
              boxShadow: `0 24px 80px ${glowColor}, 0 0 0 1px rgba(255,255,255,0.02) inset`,
            }}
          >
            {/* Decorative glow */}
            <div style={{
              position: 'absolute', top: -40, right: -40,
              width: 160, height: 160, borderRadius: '50%',
              background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
              pointerEvents: 'none',
            }} />

            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                position: 'absolute', top: 14, right: 14,
                width: 28, height: 28, borderRadius: 8,
                border: '1px solid #22222e', background: 'transparent',
                color: '#71717a', cursor: 'pointer',
                display: 'grid', placeItems: 'center',
              }}
            >
              <X size={14} />
            </button>

            {/* Icon */}
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: danger ? 'rgba(248,113,113,0.12)' : 'rgba(124,58,237,0.12)',
              border:    `1px solid ${danger ? 'rgba(248,113,113,0.32)' : 'rgba(124,58,237,0.32)'}`,
              display: 'grid', placeItems: 'center',
              marginBottom: 14,
              position: 'relative',
              boxShadow: `0 0 24px ${glowColor}`,
            }}>
              {icon ?? <DefaultIcon size={20} color={accentColor} />}
            </div>

            {/* Title */}
            <h2 id="kairo-confirm-title" style={{
              margin: 0, fontSize: 18, fontWeight: 800,
              color: '#fafafa', letterSpacing: -0.3, lineHeight: 1.3,
            }}>
              {title}
            </h2>

            {/* Body */}
            {body && (
              <p style={{
                margin: '8px 0 0', fontSize: 13.5, color: '#a1a1aa', lineHeight: 1.6,
              }}>
                {body}
              </p>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button
                ref={cancelRef}
                onClick={onClose}
                style={{
                  padding: '10px 18px', borderRadius: 10,
                  background: 'transparent', border: '1px solid #2a2a36',
                  color: '#d4d4d8', fontFamily: 'inherit', fontWeight: 600, fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                style={{
                  padding: '10px 20px', borderRadius: 10,
                  background: confirmGradient, border: 'none',
                  color: '#ffffff', fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                  cursor: 'pointer',
                  boxShadow: `0 10px 28px ${glowColor}`,
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    dialogRoot || document.body
  )
}
