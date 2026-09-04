/**
 * The honest sync indicator.
 *
 * Silent by default: a student should not be shown plumbing that is working.
 * It appears only when something is genuinely wrong, and it says so plainly
 * rather than claiming a save that never happened.
 */
import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { SYNC_EVENT, syncState, clearFailureLog, type SyncState, type DbFailure } from '../lib/dbError'

export default function SyncIndicator() {
  const [{ state, lastFailure }, set] = useState<{ state: SyncState; lastFailure: DbFailure | null }>(() => syncState())
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const on = (e: Event) => set((e as CustomEvent).detail)
    window.addEventListener(SYNC_EVENT, on)
    return () => window.removeEventListener(SYNC_EVENT, on)
  }, [])

  if (state !== 'error' || !lastFailure || dismissed) return null

  return (
    <div style={{ position: 'fixed', left: 12, bottom: 'calc(12px + var(--kyno-nav-clearance, 0px))', zIndex: 90, maxWidth: 320 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '0 12px', borderRadius: 100,
        background: '#3A2E18', border: '1px solid #4A3A20', color: '#F2A65A',
        fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
      }}>
        <AlertTriangle size={14} strokeWidth={1.75} /> Not synced
      </button>
      {open && (
        <div style={{
          marginTop: 8, padding: 12, borderRadius: 14, background: '#15151F', border: '1px solid #262636',
          color: '#C9C9DC', fontSize: 12, lineHeight: 1.55, fontFamily: 'inherit',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <b style={{ color: '#EDEDF5' }}>Your work is saved on this device only.</b>
            <button onClick={() => { setDismissed(true); clearFailureLog() }} aria-label="Dismiss"
              style={{ background: 'none', border: 'none', color: '#7E7E96', cursor: 'pointer', padding: 0 }}>
              <X size={14} />
            </button>
          </div>
          <div style={{ marginTop: 6 }}>
            Kyno could not reach your account. Nothing is lost — it is all still here — but it will not appear on another phone until this clears.
          </div>
          <div style={{ marginTop: 8, fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#7E7E96', wordBreak: 'break-word' }}>
            {lastFailure.op} {lastFailure.table}{lastFailure.code ? ` · ${lastFailure.code}` : ''}<br />{lastFailure.message}
          </div>
        </div>
      )}
    </div>
  )
}
