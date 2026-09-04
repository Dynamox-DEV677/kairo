import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users, Copy, Check, LogOut, Play, Pause, Coffee, DoorOpen, Timer,
  StickyNote, Send, BookmarkPlus, X,
} from 'lucide-react'
import { PrimaryButton } from '../components/PrimaryButton'
import { supabase } from '../lib/supabase'
import { getUsername } from '../lib/social'
import { saveToNotebook } from '../lib/notebook'
import {
  newRoomCode, cleanCode, isValidCode, idleState, startFocus, stopTimer, nextPhase,
  remainingMs, phaseDone, applyTimerEvent, clockLabel, type TimerState,
} from '../lib/room.core'
import {
  makeNote, mergeNotes, removeNote, noteToNotebook, type RoomNote,
} from '../lib/roomNotes.core'

/**
 * C3 — Study Rooms: study together, live. Its own dashboard, not a widget.
 *
 * Transport is a Supabase Realtime channel per room code — presence gives the
 * live participant list, broadcast carries the shared Pomodoro. Ephemeral by
 * design: no tables, no migrations, nothing stored. When the last person
 * leaves, the room simply stops existing.
 *
 * Any member can start/pause — a study room has no owner. Convergence rules
 * live in room.core.js (seq-based last-writer-wins), so two people pressing
 * buttons at once settle on one state everywhere.
 */

const C = {
  bg: '#0A0D16', panel: '#141A2A', panel2: '#1C2233',
  border: 'rgba(255,255,255,0.08)', text: '#fafafa', dim: '#B1B5BA',
  faint: '#9CA3AF', purple: '#A5B4FC', green: '#34D399', amber: '#FFB020',
}
const card: React.CSSProperties = {
  background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20,
}

interface Member { key: string; name: string; joinedAt: number }

// IDENTITY: the room used to broadcast the real name (or nickname) from the
// profile as presence, in the presence KEY, on every shared note and on the
// timer. Other students get the username, and nothing else.
function myName(): string {
  return getUsername().slice(0, 24)
}

// Which room this session is in, remembered so a remount (navigation crash,
// a refresh, the app being killed on mobile) drops you back into it instead of
// the create screen. sessionStorage is per-tab, so it clears itself when the
// tab closes — you are not "stuck" in a room forever.
const ACTIVE_KEY = 'kyno:room:active'
const readActive = () => { try { return sessionStorage.getItem(ACTIVE_KEY) } catch { return null } }
const writeActive = (c: string | null) => {
  try { c ? sessionStorage.setItem(ACTIVE_KEY, c) : sessionStorage.removeItem(ACTIVE_KEY) } catch {  }
}

export default function StudyRoom() {
  const [code, setCodeState] = useState<string | null>(() => readActive())
  const [joinInput, setJoinInput] = useState('')
  const [err, setErr] = useState('')

  // Every code change (create, join, leave) is mirrored to sessionStorage.
  const setCode = (c: string | null) => { writeActive(c); setCodeState(c) }

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: C.bg, padding: '24px 20px 80px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 13, flexShrink: 0,
            background: 'linear-gradient(135deg, #A5B4FC 0%, #7C5CFF 60%, #0B1530 100%)',
            display: 'grid', placeItems: 'center',
          }}>
            <Users size={22} color="#000" strokeWidth={2.4} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: -0.4 }}>
              Study Room
            </h1>
            <div style={{ fontSize: 12, color: C.faint }}>
              One timer, everyone on it. Share the code, study together — no camera, no mic.
            </div>
          </div>
        </div>

        {!code ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="mob-stack">
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: C.purple, marginBottom: 8 }}>
                Start a room
              </div>
              <p style={{ margin: '0 0 14px', fontSize: 12.5, color: C.dim, lineHeight: 1.6 }}>
                You get a 6-letter code. Anyone with it lands on your timer — friends, siblings, the whole study group.
              </p>
              <PrimaryButton full onClick={() => setCode(newRoomCode())}>
                <DoorOpen size={14} /> Create room
              </PrimaryButton>
            </div>
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: C.purple, marginBottom: 8 }}>
                Join a room
              </div>
              <input
                value={joinInput}
                onChange={e => { setJoinInput(e.target.value); setErr('') }}
                onKeyDown={e => { if (e.key === 'Enter' && isValidCode(joinInput)) setCode(cleanCode(joinInput)) }}
                placeholder="ABC 234"
                autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                style={{
                  width: '100%', boxSizing: 'border-box', marginBottom: 10,
                  background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: '12px 14px', fontSize: 18, letterSpacing: 4, textAlign: 'center',
                  color: C.text, fontFamily: 'inherit', outline: 'none', textTransform: 'uppercase',
                }}
              />
              {err && <div style={{ fontSize: 11.5, color: C.amber, marginBottom: 8 }}>{err}</div>}
              <PrimaryButton full variant="secondary"
                onClick={() => {
                  if (isValidCode(joinInput)) setCode(cleanCode(joinInput))
                  else setErr('Codes are 6 letters/numbers — check it and try again.')
                }}>
                Join with code
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <RoomDashboard code={code} onLeave={() => { setCode(null); setJoinInput('') }} />
        )}
      </div>
    </div>
  )
}

function RoomDashboard({ code, onLeave }: { code: string; onLeave: () => void }) {
  const [members, setMembers] = useState<Member[]>([])
  const [timer, setTimer] = useState<TimerState>(idleState)
  const [now, setNow] = useState(() => Date.now())
  const [copied, setCopied] = useState(false)
  const [connected, setConnected] = useState(false)
  const [focusMsThisSitting, setFocusMs] = useState(0)
  const [notes, setNotes] = useState<RoomNote[]>([])
  const [draft, setDraft] = useState('')
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  const timerRef = useRef(timer)
  timerRef.current = timer
  const notesRef = useRef(notes)
  notesRef.current = notes
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  // Presence key: stable per tab, so a refresh rejoins as the same person.
  const meKey = useMemo(() => `m-${Math.random().toString(36).slice(2, 10)}`, [])   // random only: no identity in the key

  useEffect(() => {
    const ch = supabase.channel(`kyno-room-${code}`, {
      config: { presence: { key: meKey }, broadcast: { self: false } },
    })
    channelRef.current = ch

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState() as Record<string, Array<{ name: string; joinedAt: number }>>
      const list: Member[] = Object.entries(state).map(([key, metas]) => ({
        key, name: metas[0]?.name || 'Student', joinedAt: metas[0]?.joinedAt || 0,
      }))
      list.sort((a, b) => a.joinedAt - b.joinedAt)
      setMembers(list)
    })

    ch.on('broadcast', { event: 'timer' }, ({ payload }) => {
      setTimer(cur => applyTimerEvent(cur, payload))
    })

    // Shared notes: a single new note, or a whole set on sync. Union-by-id.
    ch.on('broadcast', { event: 'note' }, ({ payload }) => {
      setNotes(cur => mergeNotes(cur, payload))
    })
    ch.on('broadcast', { event: 'note-remove' }, ({ payload }) => {
      if (payload?.id) setNotes(cur => removeNote(cur, payload.id))
    })

    // A joiner asks for current state; everyone answers. LWW (timer) and
    // union-by-id (notes) make the duplicate replies harmless. No coordinator.
    ch.on('broadcast', { event: 'hello' }, () => {
      if (timerRef.current.seq > 0) {
        ch.send({ type: 'broadcast', event: 'timer', payload: timerRef.current })
      }
      if (notesRef.current.length > 0) {
        ch.send({ type: 'broadcast', event: 'note', payload: notesRef.current })
      }
    })

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setConnected(true)
        await ch.track({ name: myName(), joinedAt: Date.now() })
        ch.send({ type: 'broadcast', event: 'hello', payload: {} })
      }
    })

    return () => { setConnected(false); supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, meKey])

  function addNote() {
    const n = makeNote({ byKey: meKey, byName: myName(), text: draft, ts: Date.now() })
    if (!n) return
    setNotes(cur => mergeNotes(cur, n))
    channelRef.current?.send({ type: 'broadcast', event: 'note', payload: n })
    setDraft('')
  }

  function retractNote(id: string) {
    setNotes(cur => removeNote(cur, id))
    channelRef.current?.send({ type: 'broadcast', event: 'note-remove', payload: { id } })
  }

  async function linkNote(n: RoomNote) {
    if (savedIds.has(n.id)) return
    try {
      await saveToNotebook(noteToNotebook(n, code))
      setSavedIds(s => new Set(s).add(n.id))
    } catch { /* offline / quota — the note stays on screen either way */ }
  }

  // The local clock. Also accumulates MY observed focus time for the sitting —
  // a real measurement of this tab, labelled as exactly that.
  useEffect(() => {
    const iv = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (timerRef.current.phase === 'focus' && document.visibilityState === 'visible') {
        setFocusMs(ms => ms + 1000)
      }
      // Whoever notices the phase ending rolls it over; LWW converges the copies.
      if (phaseDone(timerRef.current, t)) {
        const next = nextPhase(timerRef.current, { now: t, by: myName() })
        setTimer(next)
        channelRef.current?.send({ type: 'broadcast', event: 'timer', payload: next })
      }
    }, 1000)
    return () => window.clearInterval(iv)
  }, [])

  function send(next: TimerState) {
    setTimer(next)
    channelRef.current?.send({ type: 'broadcast', event: 'timer', payload: next })
  }

  const remaining = remainingMs(timer, now)
  const inFocus = timer.phase === 'focus'
  const inBreak = timer.phase === 'break'
  const total = (inFocus ? timer.focusMin : timer.breakMin) * 60_000
  const progress = timer.phase === 'idle' ? 0 : 1 - remaining / Math.max(1, total)

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      {/* Room header: the code IS the invite. */}
      <div style={{ ...card, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase', color: C.faint, marginBottom: 3 }}>
            Room code — share it
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 6, color: C.text }}>{code}</div>
        </div>
        <button className="kyno-ghost" style={{ padding: '8px 14px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          onClick={() => { navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}>
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: connected ? C.green : C.amber,
          }} />
          <span style={{ fontSize: 11.5, color: C.faint }}>{connected ? 'Live' : 'Connecting…'}</span>
          <button className="kyno-danger" style={{ padding: '8px 14px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={onLeave}>
            <LogOut size={13} /> Leave
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }} className="mob-stack">
        {/* The shared timer. */}
        <div style={{ ...card, textAlign: 'center', padding: '30px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase', color: inBreak ? C.green : C.purple, marginBottom: 8 }}>
            {inFocus ? 'Focus — everyone together' : inBreak ? 'Break — breathe' : 'Ready when you are'}
          </div>
          <div style={{ fontSize: 64, fontWeight: 900, color: C.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {timer.phase === 'idle' ? clockLabel(timer.focusMin * 60_000) : clockLabel(remaining)}
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', margin: '18px auto 6px', maxWidth: 340, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.round(progress * 100)}%`, height: '100%', borderRadius: 3,
              background: inBreak ? C.green : 'var(--c-purple)', transition: 'width 1s linear',
            }} />
          </div>
          {timer.by && timer.phase !== 'idle' && (
            <div style={{ fontSize: 11, color: C.faint, marginBottom: 12 }}>started by {timer.by}</div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            {timer.phase === 'idle' ? (
              <PrimaryButton onClick={() => send(startFocus(timer, { now: Date.now(), by: myName() }))}>
                <Play size={14} /> Start {timer.focusMin} min focus
              </PrimaryButton>
            ) : (
              <>
                <PrimaryButton variant="secondary" onClick={() => send(stopTimer(timer, { by: myName() }))}>
                  <Pause size={14} /> Stop
                </PrimaryButton>
                <PrimaryButton onClick={() => send(nextPhase(timer, { now: Date.now(), by: myName() }))}>
                  {inFocus ? <><Coffee size={14} /> Skip to break</> : <><Play size={14} /> Back to focus</>}
                </PrimaryButton>
              </>
            )}
          </div>
          <div style={{ fontSize: 10.5, color: C.faint, marginTop: 14 }}>
            Anyone in the room can start or stop — it changes for everyone at once.
          </div>
        </div>

        {/* The small dashboard: who's here + this sitting. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: C.purple, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={12} /> In the room — {members.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
              {members.length === 0 && (
                <div style={{ fontSize: 12, color: C.faint }}>Connecting you…</div>
              )}
              {members.map(m => (
                <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                    background: 'rgba(124,92,255,0.14)', color: C.purple,
                    display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800,
                  }}>{m.name.slice(0, 1).toUpperCase()}</span>
                  <span style={{ fontSize: 12.5, color: C.text, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.name}{m.key === meKey ? ' (you)' : ''}
                  </span>
                  <span style={{ fontSize: 10, color: inFocus ? C.green : C.faint }}>
                    {inFocus ? 'focusing' : inBreak ? 'on break' : 'here'}
                  </span>
                </div>
              ))}
            </div>
            {members.length === 1 && connected && (
              <div style={{ fontSize: 11, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>
                Just you so far — send the code to someone. Studying with one other person is the whole trick.
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: C.purple, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Timer size={12} /> This sitting
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: C.text }}>{Math.floor(focusMsThisSitting / 60_000)}m</div>
                <div style={{ fontSize: 10, color: C.faint }}>your focus time here</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: C.text }}>{members.length}</div>
                <div style={{ fontSize: 10, color: C.faint }}>studying with you</div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>
              Counts only while this tab is open and the timer is on focus.
            </div>
          </div>
        </div>
      </div>

      {/* Shared notes — the group's live scratchpad. Any note links into your
          own Notebook, which is where anything worth keeping actually lives. */}
      <div style={{ ...card, marginTop: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: C.purple, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <StickyNote size={12} /> Shared notes — {notes.length}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addNote() }}
            placeholder="Type a note everyone sees — a formula, a doubt, a link…"
            maxLength={280}
            style={{
              flex: 1, minWidth: 0, background: C.panel2, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '10px 13px', fontSize: 13, color: C.text,
              fontFamily: 'inherit', outline: 'none',
            }}
          />
          <PrimaryButton size="sm" onClick={addNote} disabled={!draft.trim()}>
            <Send size={13} /> Post
          </PrimaryButton>
        </div>

        {notes.length === 0 ? (
          <div style={{ fontSize: 12, color: C.faint, padding: '8px 2px' }}>
            No notes yet. Anything posted here shows for everyone in the room — and you can save any note into your own Notebook to keep it.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
            {notes.map(n => {
              const mine = n.byKey === meKey
              const saved = savedIds.has(n.id)
              return (
                <div key={n.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '9px 12px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, wordBreak: 'break-word' }}>{n.text}</div>
                    <div style={{ fontSize: 10.5, color: C.faint, marginTop: 3 }}>{mine ? 'You' : n.byName}</div>
                  </div>
                  <button
                    onClick={() => linkNote(n)}
                    title={saved ? 'Saved to your Notebook' : 'Save to my Notebook'}
                    className="kyno-ghost"
                    style={{ padding: '6px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    {saved ? <Check size={12} /> : <BookmarkPlus size={12} />} {saved ? 'Saved' : 'Keep'}
                  </button>
                  {mine && (
                    <button onClick={() => retractNote(n.id)} title="Remove your note" aria-label="Remove note"
                      className="kyno-ghost" style={{ padding: '6px 8px', flexShrink: 0 }}>
                      <X size={12} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}
