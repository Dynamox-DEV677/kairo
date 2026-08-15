import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'
import { PrimaryButton } from './PrimaryButton'
import { UPDATES } from '../data/updates'
import { pendingUpdates, seenAfterDismiss } from '../lib/updates.core'
import { getRaw, setRaw, userKey } from '../lib/storage'

/**
 * "Kyno Update N" — what changed since the student last looked.
 *
 * Content comes from ../data/updates.ts and nothing is duplicated here, so
 * shipping a release note is a one-file edit. This component only decides
 * *whether* to show, and renders whatever it is given.
 *
 * Deliberately dismissible and non-blocking: Escape, the backdrop and the ✕ all
 * close it, and closing counts as read. A student opening the app to revise
 * twenty minutes before a test should not have to read release notes first.
 */
export default function UpdatesHost({ uid }: { uid?: string | null }) {
  const key = uid ? userKey.updatesSeen(uid) : null

  // Read once on mount and freeze it. Re-reading on every render would make the
  // list vanish mid-animation the moment dismiss() writes the new value.
  const [lastSeen] = useState<string | null>(() => (key ? getRaw(key) : null))
  const [open, setOpen] = useState(false)

  const pending = useMemo(() => pendingUpdates(UPDATES, lastSeen), [lastSeen])
  const dismissRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!key || pending.length === 0) return
    // A beat after login so it lands on a settled screen rather than fighting
    // the dashboard's own mount animation.
    const t = setTimeout(() => setOpen(true), 650)
    return () => clearTimeout(t)
  }, [key, pending.length])

  function dismiss() {
    setOpen(false)
    if (!key) return
    // Write the highest number actually shown, not the file's max — see
    // seenAfterDismiss(). Writing on dismiss rather than on open means a
    // student who closes the tab mid-read still sees it next time.
    try { setRaw(key, String(seenAfterDismiss(pending, lastSeen))) } catch {  }
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
    document.addEventListener('keydown', onKey)
    const t = setTimeout(() => dismissRef.current?.focus(), 40)
    return () => { document.removeEventListener('keydown', onKey); clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (typeof document === 'undefined') return null
  if (!key || pending.length === 0) return null

  const newest = pending[pending.length - 1]
  const many = pending.length > 1

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={dismiss}
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'rgba(6, 6, 10, 0.78)',
            display: 'grid', placeItems: 'center',
            padding: 16,
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={e => e.stopPropagation()}
            role="dialog" aria-modal="true" aria-labelledby="kyno-update-title"
            style={{
              width: '100%', maxWidth: 440,
              maxHeight: 'min(78vh, 640px)',
              display: 'flex', flexDirection: 'column',
              background: 'linear-gradient(180deg, #1C2233 0%, #0d0d15 100%)',
              border: '1px solid rgba(124, 92, 255, 0.32)',
              borderRadius: 18,
              position: 'relative',
              overflow: 'hidden',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              boxShadow: '0 24px 80px rgba(124, 92, 255, 0.35), 0 0 0 1px rgba(255,255,255,0.02) inset',
            }}
          >
            <div style={{
              position: 'absolute', top: -40, right: -40,
              width: 160, height: 160, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(124, 92, 255, 0.35) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />

            <button
              onClick={dismiss}
              aria-label="Close"
              style={{
                position: 'absolute', top: 14, right: 14, zIndex: 1,
                width: 28, height: 28, borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.08)', background: 'transparent',
                color: '#9CA3AF', cursor: 'pointer',
                display: 'grid', placeItems: 'center',
              }}
            >
              <X size={14} />
            </button>

            <div style={{ padding: '24px 24px 0' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(124, 92, 255, 0.12)',
                border: '1px solid rgba(124, 92, 255, 0.32)',
                display: 'grid', placeItems: 'center',
                marginBottom: 14,
                boxShadow: '0 0 24px rgba(124, 92, 255, 0.35)',
              }}>
                <Sparkles size={20} color="#A5B4FC" />
              </div>

              <h2 id="kyno-update-title" style={{
                margin: 0, fontSize: 18, fontWeight: 800,
                color: '#fafafa', letterSpacing: -0.3, lineHeight: 1.3,
              }}>
                {newest.title}
              </h2>
              <p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#9CA3AF' }}>
                {/* Say plainly that they missed some, rather than showing a
                    stack of cards with no explanation of why there are four. */}
                {many
                  ? `${pending.length} updates since you were last here · here's all of it`
                  : "Here's what's new"}
              </p>
            </div>

            <div style={{
              overflowY: 'auto', padding: '18px 24px 4px',
              display: 'flex', flexDirection: 'column', gap: 18,
            }}>
              {/* Oldest first — reads as a history of what you missed. */}
              {pending.map(u => (
                <section key={u.n}>
                  {many && (
                    <div style={{
                      display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8,
                    }}>
                      <span style={{
                        fontSize: 11, fontWeight: 800, letterSpacing: 1.2,
                        textTransform: 'uppercase', color: '#A5B4FC',
                      }}>{u.title}</span>
                      <span style={{ fontSize: 11, color: '#6B7280' }}>{u.date}</span>
                    </div>
                  )}
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {u.changes.map((c, i) => (
                      <li key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                        <span aria-hidden style={{
                          width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                          background: '#7C5CFF', marginTop: 7,
                          boxShadow: '0 0 8px rgba(124, 92, 255, 0.8)',
                        }} />
                        <span style={{ fontSize: 13.5, color: '#B1B5BA', lineHeight: 1.55 }}>{c}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <div style={{ padding: '18px 24px 22px' }}>
              <PrimaryButton ref={dismissRef} onClick={dismiss} full>
                Got it
              </PrimaryButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
