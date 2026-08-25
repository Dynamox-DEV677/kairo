import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, RotateCcw, Target, Flame, CalendarClock, Volume2, VolumeX, Undo2 } from 'lucide-react'
import { track, getDashboard, loadState } from '../lib/twin'
import {
  sessionFocusedMs, parseHistory, appendSession, focusStreakDays, weekMinutes, sessionHeadline,
  type FocusRecord, type FocusSegment,
} from '../lib/focus.core'
import {
  parseBanList, toggleBan, sessionReceipt, receiptLine, SUGGESTED_BANS,
  type Receipt,
} from '../lib/focusReceipt.core'

/**
 * Focus Lock — a distraction-free session where only real focus counts.
 *
 * The honesty mechanism: time accrues in SEGMENTS that only run while the
 * timer runs AND the tab is visible. Drift to another tab/app and the segment
 * closes — the clock waits, calmly, with no guilt copy. Background-interval
 * throttling can't inflate the count either, because remaining time is
 * recomputed from segment math on every tick rather than decremented.
 */

const HISTORY_KEY = 'kyno:focus:history'
const LEGACY_TOTAL_KEY = 'kyno:focus_total_min'
const BANLIST_KEY = 'kyno:focus:banlist'

const PRESETS = [15, 25, 45, 60]

type Status = 'idle' | 'running' | 'paused' | 'drifted' | 'done'

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function loadHistory(): FocusRecord[] {
  try { return parseHistory(localStorage.getItem(HISTORY_KEY) || '') } catch { return [] }
}

export default function FocusMode() {
  const [durationMin, setDurationMin] = useState(25)
  const [status, setStatus]   = useState<Status>('idle')
  const [goal, setGoal]       = useState('')
  const [ambient, setAmbient] = useState(false)
  const [drifts, setDrifts]   = useState(0)
  const [history, setHistory] = useState<FocusRecord[]>(loadHistory)
  const [headline, setHeadline] = useState('')
  const [, forceTick] = useState(0)

  // The ban list — a commitment contract, persisted across sessions.
  const [banList, setBanList] = useState<string[]>(() => {
    try { return parseBanList(localStorage.getItem(BANLIST_KEY) || '') } catch { return [] }
  })
  const [banInput, setBanInput] = useState('')
  function setBans(next: string[]) {
    setBanList(next)
    try { localStorage.setItem(BANLIST_KEY, JSON.stringify(next)) } catch {}
  }

  // Live receipt of what this session actually touched (twin log ∩ window).
  const [liveReceipt, setLiveReceipt] = useState<Receipt | null>(null)

  const segmentsRef = useRef<FocusSegment[]>([])
  const statusRef = useRef<Status>('idle')
  statusRef.current = status
  const sessionStartRef = useRef(0)
  const driftStartRef = useRef(0)
  const driftMsRef = useRef(0)

  const plannedMs = durationMin * 60_000
  const focusedMs = sessionFocusedMs(segmentsRef.current, Date.now())
  const remaining = Math.max(0, plannedMs - focusedMs)

  const weakChips = useMemo<string[]>(() => {
    try { return (getDashboard().twin?.weakTopics || []).slice(0, 3).map(w => w.topic) } catch { return [] }
  }, [])

  const finish = useCallback((why: 'complete' | 'early') => {
    // Close the open segment before summing.
    const segs = segmentsRef.current
    const last = segs[segs.length - 1]
    if (last && last.end == null) last.end = Date.now()
    const focused = sessionFocusedMs(segs, Date.now())

    // If we finish WHILE drifted, that drift ends now too.
    if (driftStartRef.current > 0) {
      driftMsRef.current += Date.now() - driftStartRef.current
      driftStartRef.current = 0
    }

    // The receipt: what the twin log says actually happened in this window.
    let receipt: Receipt | undefined
    try { receipt = sessionReceipt(loadState().events, sessionStartRef.current, Date.now()) } catch {}

    const record: FocusRecord = {
      ts: Date.now(), focusedMs: focused, plannedMs, drifts, goal: goal || undefined,
      driftMs: driftMsRef.current || undefined,
      banned: banList.length ? banList : undefined,
      receipt,
    }
    const next = appendSession(loadHistory(), record)
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)) } catch {}
    setHistory(next)
    setHeadline(sessionHeadline(record, next, Date.now()))
    setLiveReceipt(receipt || null)
    try {
      track({ type: 'session_end', durationMs: focused, payload: { kind: 'focus', goal, drifts, why } })
    } catch {}
    // Tell the Home / Kyno OS cards a session just banked (deterministic
    // refresh; the visibility observer alone can be lost across HMR swaps).
    try { window.dispatchEvent(new CustomEvent('kyno:focus-banked')) } catch {}
    try { if (document.fullscreenElement) document.exitFullscreen() } catch {}
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && why === 'complete') {
      try { new Notification('Kyno Focus Lock', { body: 'Session complete. Take a 5-minute break.' }) } catch {}
    }
    setStatus('done')
  }, [plannedMs, drifts, goal, banList])

  // The tick: re-render twice a second while running; auto-finish at zero.
  useEffect(() => {
    if (status !== 'running') return
    const id = window.setInterval(() => {
      const left = plannedMs - sessionFocusedMs(segmentsRef.current, Date.now())
      if (left <= 0) finish('complete')
      else forceTick(t => t + 1)
    }, 500)
    return () => window.clearInterval(id)
  }, [status, plannedMs, finish])

  // The live receipt: every few seconds, ask the twin log what this session
  // has actually touched so far. Cheap enough at 5s; honest at any rate.
  useEffect(() => {
    if (status !== 'running') return
    const compute = () => {
      try { setLiveReceipt(sessionReceipt(loadState().events, sessionStartRef.current, Date.now())) } catch {}
    }
    compute()
    const id = window.setInterval(compute, 5000)
    return () => window.clearInterval(id)
  }, [status])

  // The lock: drifting to another tab/app closes the segment and pauses.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && statusRef.current === 'running') {
        const last = segmentsRef.current[segmentsRef.current.length - 1]
        if (last && last.end == null) last.end = Date.now()
        driftStartRef.current = Date.now() // the drift is TIMED, not just counted
        setDrifts(d => d + 1)
        setStatus('drifted')
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Leaving mid-session warns (accidental closes lose the session).
  useEffect(() => {
    if (status !== 'running' && status !== 'drifted' && status !== 'paused') return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [status])

  function openSegment() { segmentsRef.current.push({ start: Date.now(), end: null }) }
  function closeSegment() {
    const last = segmentsRef.current[segmentsRef.current.length - 1]
    if (last && last.end == null) last.end = Date.now()
  }

  function start() {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    if (status === 'idle' || status === 'done') {
      segmentsRef.current = []; setDrifts(0); setHeadline(''); setLiveReceipt(null)
      driftMsRef.current = 0; driftStartRef.current = 0
      sessionStartRef.current = Date.now()
    }
    openSegment()
    setStatus('running')
    // Best-effort immersion. Esc always exits; failure is fine.
    try { document.documentElement.requestFullscreen?.()?.catch(() => {}) } catch {}
  }
  function pause() { closeSegment(); setStatus('paused') }
  function resume() {
    if (driftStartRef.current > 0) { // coming back from a drift: bank its length
      driftMsRef.current += Date.now() - driftStartRef.current
      driftStartRef.current = 0
    }
    openSegment(); setStatus('running')
  }
  function reset() {
    closeSegment()
    segmentsRef.current = []
    driftMsRef.current = 0; driftStartRef.current = 0
    setDrifts(0); setHeadline(''); setLiveReceipt(null); setStatus('idle')
    try { if (document.fullscreenElement) document.exitFullscreen() } catch {}
  }

  const now = Date.now()
  const streak = focusStreakDays(history, now)
  const week = weekMinutes(history, now)
  const legacyMin = Number((() => { try { return localStorage.getItem(LEGACY_TOTAL_KEY) } catch { return 0 } })() || 0)
  const lifetimeMin = legacyMin + Math.round(history.reduce((a, r) => a + r.focusedMs, 0) / 60000)

  const progress = status === 'done' ? 1 : plannedMs > 0 ? Math.min(1, focusedMs / plannedMs) : 0
  const R = 130
  const C = 2 * Math.PI * R

  const running = status === 'running'
  const inSession = running || status === 'paused' || status === 'drifted'

  const bg = ambient
    ? 'radial-gradient(ellipse at top, #1a1a2e 0%, #0A0D16 60%), radial-gradient(ellipse at bottom right, rgba(124, 92, 255, 0.18), transparent 50%)'
    : '#0A0D16'

  return (
    <div style={{
      minHeight: '100%', background: bg, padding: '32px 24px 80px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      transition: 'background 0.4s ease', position: 'relative', overflow: 'auto',
    }}>
      <AnimatePresence>
        {ambient && [0, 1, 2].map(i => (
          <motion.div key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.12, x: [0, 60, -40, 0], y: [0, -30, 50, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 18 + i * 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute', top: `${20 + i * 25}%`, left: `${15 + i * 28}%`,
              width: 260, height: 260, borderRadius: '50%',
              background: ['#7C5CFF', '#7C5CFF', '#A5B4FC'][i],
              filter: 'blur(80px)', pointerEvents: 'none',
            }} />
        ))}
      </AnimatePresence>

      <div style={{ width: '100%', maxWidth: 720, display: 'flex', alignItems: 'center', gap: 14, marginBottom: 26, zIndex: 1 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#7C5CFF,#5A3CE0)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Target size={20} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Focus Lock</h1>
          <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Only real focus counts — drift away and the clock waits for you</p>
        </div>
        <button
          onClick={() => setAmbient(a => !a)}
          title={ambient ? 'Calm mode off' : 'Calm mode on'}
          style={{
            width: 36, height: 36, borderRadius: 8,
            background: ambient ? 'rgba(124, 92, 255, 0.15)' : '#1C2233',
            border: `1px solid ${ambient ? '#7C5CFF' : '#1f2532'}`,
            color: ambient ? '#A5B4FC' : '#9CA3AF', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          {ambient ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>
      </div>

      {/* streak / week / lifetime — real history, no invention */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, zIndex: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          [<Flame key="f" size={12} color="#FFB020" />, `${streak} day focus streak`],
          [<CalendarClock key="c" size={12} color="#A5B4FC" />, `${week} min this week`],
          [<Target key="t" size={12} color="#34D399" />, `${lifetimeMin} min lifetime`],
        ].map(([icon, label], i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            borderRadius: 999, background: '#141A2A', border: '1px solid #1f2532',
            fontSize: 11.5, color: '#B1B5BA', fontWeight: 600,
          }}>{icon}{label}</span>
        ))}
      </div>

      <div style={{ position: 'relative', width: 300, height: 300, marginBottom: 20, zIndex: 1 }}>
        <svg viewBox="-160 -160 320 320" width={300} height={300} style={{ transform: 'rotate(-90deg)' }}>
          <circle r={R} fill="none" stroke="#171D2D" strokeWidth={9} />
          <motion.circle
            r={R} fill="none"
            stroke={status === 'done' ? '#34D399' : 'url(#grad)'}
            strokeWidth={9} strokeLinecap="round"
            strokeDasharray={C}
            animate={{ strokeDashoffset: C * (1 - progress) }}
            transition={{ ease: 'linear', duration: 0.4 }}
            style={{ filter: running ? 'drop-shadow(0 0 6px rgba(124, 92, 255,0.55))' : 'none' }}
          />
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7C5CFF" />
              <stop offset="1" stopColor="#A5B4FC" />
            </linearGradient>
          </defs>
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            fontSize: 60, fontWeight: 800, color: '#fafafa',
            fontFamily: 'Consolas, monospace', letterSpacing: -2, lineHeight: 1,
          }}>
            {status === 'done' ? 'Done' : fmt(remaining)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: status === 'done' ? '#34D399' : running ? '#34d399' : status === 'drifted' ? '#FFB020' : '#6B7280',
              boxShadow: running ? '0 0 8px #34d399' : 'none',
            }} />
            <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 2.5 }}>
              {status === 'done' ? 'session banked' : running ? 'focusing' : status === 'drifted' ? 'drifted — clock paused' : status === 'paused' ? 'paused' : 'ready'}
            </div>
          </div>
          {inSession && drifts > 0 && (
            <div style={{ fontSize: 10.5, color: '#6B7280', marginTop: 5 }}>{drifts} drift{drifts === 1 ? '' : 's'} this session</div>
          )}
        </div>
      </div>

      {/* the contract + the live receipt, front and centre while locked in */}
      {inSession && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 18, zIndex: 1, maxWidth: 520 }}>
          {banList.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
              <span style={{ fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: '#6B7280', fontWeight: 700 }}>Banned this session</span>
              {banList.map(b => (
                <span key={b} style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 999, fontWeight: 600,
                  background: 'rgba(255,122,144,0.10)', border: '1px solid rgba(255,122,144,0.35)', color: '#FF9CB0',
                  textDecoration: 'line-through',
                }}>{b}</span>
              ))}
            </div>
          )}
          {liveReceipt && receiptLine(liveReceipt) && (
            <div style={{
              fontSize: 11.5, color: '#B1B5BA', padding: '7px 14px', borderRadius: 999,
              background: '#141A2A', border: '1px solid #1f2532',
            }}>
              This session so far: <b style={{ color: '#fafafa' }}>{receiptLine(liveReceipt)}</b>
            </div>
          )}
        </div>
      )}

      {/* drifted banner — calm, one action */}
      <AnimatePresence>
        {status === 'drifted' && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, zIndex: 1,
              padding: '10px 14px', borderRadius: 12, background: 'rgba(255,176,32,0.08)',
              border: '1px solid rgba(255,176,32,0.3)', maxWidth: 480,
            }}>
            <span style={{ fontSize: 12.5, color: '#B1B5BA' }}>You drifted away — the clock stopped with you. Back?</span>
            <button className="kyno-chunky" onClick={resume}
              style={{ padding: '7px 14px', borderRadius: 10, border: 'none', background: '#7C5CFF', color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              <Undo2 size={12} style={{ verticalAlign: -2, marginRight: 5 }} />Lock back in
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* done panel */}
      {status === 'done' && headline && (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
          style={{
            marginBottom: 18, zIndex: 1, padding: '14px 18px', borderRadius: 12, maxWidth: 480,
            background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)',
            fontSize: 13.5, color: '#e4e4e7', fontWeight: 600, textAlign: 'center',
          }}>
          {headline}
          {goal && <div style={{ fontSize: 11.5, color: '#9CA3AF', fontWeight: 500, marginTop: 4 }}>on: {goal}</div>}
          {liveReceipt && receiptLine(liveReceipt) && (
            <div style={{ fontSize: 12, color: '#B1B5BA', fontWeight: 500, marginTop: 8, paddingTop: 8, borderTop: '1px dashed rgba(255,255,255,0.12)' }}>
              You studied: {receiptLine(liveReceipt)}
              {liveReceipt.topics.length > 0 && (
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
                  {liveReceipt.topics.slice(0, 3).map(t => t.topic).join(' · ')}
                </div>
              )}
            </div>
          )}
          <div style={{ fontSize: 11, fontWeight: 500, marginTop: 6, color: drifts === 0 ? '#34D399' : '#FFB020' }}>
            {drifts === 0
              ? (banList.length ? 'Contract held — you never left. ✓' : 'You never left. ✓')
              : `Left ${drifts}× for ${Math.max(1, Math.round(driftMsRef.current / 60000))} min — the clock waited, none of it counted.`}
          </div>
        </motion.div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 26, zIndex: 1 }}>
        {!running ? (
          <motion.button className="kyno-chunky" whileTap={{ scale: 0.96 }}
            onClick={status === 'paused' || status === 'drifted' ? resume : start}
            style={{
              padding: '12px 28px', borderRadius: 12, border: 'none', background: '#7C5CFF',
              color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            }}>
            <Play size={14} />
            {status === 'paused' || status === 'drifted' ? 'Resume' : status === 'done' ? 'Go again' : 'Lock in'}
          </motion.button>
        ) : (
          <motion.button className="kyno-ghost" whileTap={{ scale: 0.96 }} onClick={pause}
            style={{
              padding: '12px 28px', borderRadius: 12, border: '1px solid #7C5CFF',
              background: 'rgba(124, 92, 255, 0.1)', color: '#A5B4FC',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
            <Pause size={14} />Pause
          </motion.button>
        )}
        {inSession && (
          // Deliberately quiet — ending early still banks the honest minutes.
          <button className="kyno-ghost" onClick={() => finish('early')} style={{
            padding: '12px 14px', borderRadius: 12, border: '1px solid #1f2532',
            background: 'transparent', color: '#6B7280', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12,
          }}>
            End early
          </button>
        )}
        {(status === 'done' || status === 'paused' || status === 'drifted') && (
          <button className="kyno-ghost" onClick={reset} style={{
            padding: '12px 16px', borderRadius: 12, border: '1px solid #1f2532',
            background: '#1C2233', color: '#9CA3AF', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <RotateCcw size={13} />Reset
          </button>
        )}
      </div>

      {!inSession && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, zIndex: 1 }}>
            {PRESETS.map(m => (
              <button key={m} onClick={() => setDurationMin(m)}
                className={`kyno-chip${durationMin === m ? ' on' : ''}`}
                style={{ padding: '8px 16px', fontSize: 12 }}>{m} min</button>
            ))}
          </div>

          <div style={{ width: '100%', maxWidth: 560, zIndex: 1 }}>
            <label style={{
              fontSize: 11, fontWeight: 700, color: '#6B7280',
              textTransform: 'uppercase', letterSpacing: 2, display: 'block', marginBottom: 8,
            }}>
              What are you focusing on?
            </label>
            <input
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="e.g. Revise quadratic equations · Read Chapter 6"
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 10,
                background: '#141A2A', border: '1px solid #1f2532',
                color: '#fafafa', fontFamily: 'inherit', fontSize: 14,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            {weakChips.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {weakChips.map(t => (
                  <button key={t} onClick={() => setGoal(`Practise ${t}`)}
                    className="kyno-chip" style={{ padding: '6px 12px', fontSize: 11 }}>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* The ban list — the commitment contract. */}
          <div style={{ width: '100%', maxWidth: 560, marginTop: 22, zIndex: 1 }}>
            <label style={{
              fontSize: 11, fontWeight: 700, color: '#6B7280',
              textTransform: 'uppercase', letterSpacing: 2, display: 'block', marginBottom: 8,
            }}>
              Banned during focus
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {[...new Set([...banList, ...SUGGESTED_BANS])].map(b => {
                const on = banList.some(x => x.toLowerCase() === b.toLowerCase())
                return (
                  <button key={b} onClick={() => setBans(toggleBan(banList, b))}
                    className={`kyno-chip${on ? ' on' : ''}`}
                    style={{ padding: '6px 12px', fontSize: 11, textDecoration: on ? 'line-through' : 'none' }}>
                    {on ? '🚫 ' : ''}{b}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={banInput}
                onChange={e => setBanInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && banInput.trim()) { setBans(toggleBan(banList, banInput)); setBanInput('') } }}
                placeholder="Add your own… (Enter)"
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 10,
                  background: '#141A2A', border: '1px solid #1f2532',
                  color: '#fafafa', fontFamily: 'inherit', fontSize: 12.5,
                  outline: 'none', minWidth: 0,
                }}
              />
            </div>
            <div style={{ fontSize: 10.5, color: '#6B7280', marginTop: 8, lineHeight: 1.55 }}>
              Straight with you: a web app can't force-close other apps. What Kyno does is <b style={{ color: '#9CA3AF' }}>witness the contract</b> — the moment you open anything else, the clock freezes, the drift is timed, and it shows on your session receipt. Pair it with your phone's own app timer if you want a hard wall.
            </div>
          </div>
        </>
      )}
    </div>
  )
}
