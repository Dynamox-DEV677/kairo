/**
 * No route may ever render blank.
 *
 * Seven routes shipped rendering nothing at all: no content, no console error,
 * no failed request, no error boundary. A component mounted and returned
 * nothing, and the student saw a header, a nav bar, and a void. That is the
 * worst possible failure, because there is nothing to report and nothing to
 * retry.
 *
 * This wraps the visible page. Shortly after it becomes visible it measures
 * what actually drew. If the page produced no laid-out content, the student
 * gets an honest message and a retry instead of an empty screen -- and the
 * console gets a line naming the route, so it can never go unnoticed again.
 *
 * It measures LAYOUT, not the DOM: a page can have plenty of elements and
 * still be collapsed to zero height by a flex parent, which looks identical
 * to a student.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'

const SETTLE_MS = 1200

export default function BlankGuard({ id, active, children }: { id: string; active: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [blank, setBlank] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!active) { setBlank(false); return }
    // Give lazy chunks, fonts and first data a fair chance before judging.
    const t = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const drew = el.querySelector('*') && r.height > 24 && r.width > 24 && (el.innerText || '').trim().length > 0
      if (!drew) {
        console.error(`[route] #/${id} rendered nothing — no content, no error. Showing the fallback.`, {
          height: Math.round(r.height), width: Math.round(r.width), children: el.childElementCount,
        })
        setBlank(true)
      }
    }, SETTLE_MS)
    return () => clearTimeout(t)
  }, [id, active, attempt])

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {children}
      {blank && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5, background: '#0B0B14',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 12, padding: 24, textAlign: 'center', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#EDEDF5' }}>This screen did not load.</div>
          <div style={{ fontSize: 13.5, color: '#9494AD', lineHeight: 1.55, maxWidth: 320 }}>
            Nothing of yours is lost. Kyno drew an empty screen instead of the page, which is a bug on our side, not
            something you did.
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={() => { setBlank(false); setAttempt(a => a + 1) }} style={{
              minHeight: 44, padding: '0 18px', borderRadius: 14, border: 'none', background: '#7C5CFF', color: '#fff',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>Try again</button>
            <button onClick={() => window.location.reload()} style={{
              minHeight: 44, padding: '0 18px', borderRadius: 14, background: '#1A1A26', border: '1px solid #2A2A3C',
              color: '#C9C9DC', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>Reload Kyno</button>
          </div>
          <div style={{ fontSize: 11.5, color: '#5E5E78', marginTop: 6, fontFamily: 'ui-monospace, monospace' }}>#/{id}</div>
        </div>
      )}
    </div>
  )
}
