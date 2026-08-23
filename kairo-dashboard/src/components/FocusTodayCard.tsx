import { useMemo, useState, useEffect, useRef } from 'react'
import { Target, Flame, ArrowRight } from 'lucide-react'
import { parseHistory } from '../lib/focus.core'
import { todaysFocus } from '../lib/focusReceipt.core'

/**
 * Today's focus, on Home and Kyno OS: real focused minutes, the drift ledger,
 * and WHAT was studied inside those sessions — merged from the receipts each
 * session stored (which came from the twin event log, never self-report).
 *
 * Same staleness rule as the Museum: pages stay mounted across tab switches,
 * so this recomputes whenever it becomes visible again.
 */
export default function FocusTodayCard({ onNavigate, nudge = false }: {
  onNavigate?: (v: string) => void
  /** show a quiet "no session yet" row instead of hiding (Kyno OS wants this) */
  nudge?: boolean
}) {
  const [tick, setTick] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = rootRef.current
    const bump = () => setTick(t => t + 1)
    // Deterministic: Focus Lock announces every banked session.
    window.addEventListener('kyno:focus-banked', bump)
    let io: IntersectionObserver | null = null
    if (el && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) bump() })
      io.observe(el)
    }
    return () => { window.removeEventListener('kyno:focus-banked', bump); io?.disconnect() }
  }, [])

  const today = useMemo(() => {
    try { return todaysFocus(parseHistory(localStorage.getItem('kyno:focus:history') || ''), Date.now()) }
    catch { return null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const go = () => {
    if (onNavigate) return onNavigate('focus')
    try { (window as any).__kairoSetActive?.('focus') } catch {}
  }

  const box: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left',
    background: '#141A2A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14,
    padding: '14px 16px', marginBottom: 18, cursor: 'pointer', fontFamily: 'inherit', color: '#fafafa',
  }

  if (!today) {
    if (!nudge) return <div ref={rootRef} style={{ height: 0, overflow: 'hidden' }} aria-hidden />
    return (
      <div ref={rootRef}>
        <button onClick={go} style={box}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Target size={15} color="#A5B4FC" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: '#B1B5BA', flex: 1 }}>No focus session today yet — lock one in and what you study shows up here.</span>
            <ArrowRight size={14} color="#9CA3AF" style={{ flexShrink: 0 }} />
          </span>
        </button>
      </div>
    )
  }

  return (
    <div ref={rootRef}>
      <button onClick={go} style={box}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Flame size={14} color="#FFB020" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: '#9CA3AF' }}>Today's focus</span>
          <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, color: '#fafafa' }}>
            {today.focusedMin} min · {today.sessions} session{today.sessions === 1 ? '' : 's'}
          </span>
        </span>

        <span style={{ display: 'block', fontSize: 12, color: '#B1B5BA', lineHeight: 1.6 }}>
          {(today.questions > 0 || today.cards > 0 || today.notes > 0) ? (
            <>
              Studied:{' '}
              {[
                today.questions ? `${today.questions} question${today.questions === 1 ? '' : 's'} (${today.correct} right)` : null,
                today.cards ? `${today.cards} card${today.cards === 1 ? '' : 's'}` : null,
                today.notes ? `${today.notes} note${today.notes === 1 ? '' : 's'}` : null,
              ].filter(Boolean).join(' · ')}
            </>
          ) : (
            <>Focused time banked — no tracked study actions inside the sessions yet.</>
          )}
          <span style={{ color: today.drifts === 0 ? '#34D399' : '#FFB020' }}>
            {' '}· {today.drifts === 0 ? 'never left ✓' : `left ${today.drifts}× (${Math.max(1, today.driftMin)} min)`}
          </span>
        </span>

        {today.topics.length > 0 && (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
            {today.topics.map(t => (
              <span key={`${t.subject}|${t.topic}`} style={{
                fontSize: 10.5, padding: '3px 10px', borderRadius: 999, fontWeight: 600,
                background: 'rgba(124,92,255,0.12)', border: '1px solid rgba(124,92,255,0.35)', color: '#A5B4FC',
              }}>
                {t.topic} · {t.count}
              </span>
            ))}
          </span>
        )}
      </button>
    </div>
  )
}
