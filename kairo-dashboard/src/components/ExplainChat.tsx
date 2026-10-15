/**
 * The Reader's side chat: "Explain simply" and "Summarise", answered beside
 * the page.
 *
 * It used to be a queue -- the selection was filed as pending and answered
 * later, on another screen. A student mid-chapter wants the explanation while
 * the page is still in front of them, so the answer now streams into a panel
 * that leaves the page visible (a bottom sheet on a phone, a side column on a
 * wide screen), and they can follow up without losing their place.
 *
 * What the model sees -- the selection, the rest of that page, and the rule
 * that an exercise gets the idea and a first step rather than its answer --
 * is built in explain.core so it can be tested.
 */
import { useEffect, useRef, useState } from 'react'
import { X, Send, Loader2, AlertTriangle, ListOrdered } from 'lucide-react'
import { T, FONT, ICON } from '../lib/spaceTokens'
import MathText from './MathText'
import { chat } from '../lib/openrouter'
import { studentMessage } from '../lib/aiError.core'
import { MODES, QUICK, buildMessages, pageText, looksLikeQuestion, solveSeed } from '../lib/explain.core.js'
import type { ExplainMode, ChatTurn } from '../lib/explain.core'
import type { Book } from '../lib/library'

interface Shown extends ChatTurn {
  /** What the bubble says, when it differs from what the model was sent. */
  label?: string
}

export default function ExplainChat({ book, page, quote, mode, wide, onClose, onAnswered, onSolve, onGoto }: {
  book: Book
  page: number
  quote: string
  mode: ExplainMode
  /** Side column on a wide screen, bottom sheet otherwise. */
  wide: boolean
  onClose: () => void
  /** The first answer, so the Reader can keep it with the student's highlights. */
  onAnswered?: (answer: string) => void
  /** Hand an exercise to Doubt Solving's step-by-step solver. */
  onSolve?: (seed: string) => void
  onGoto?: (page: number) => void
}) {
  const [turns, setTurns] = useState<Shown[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  // No abort on close: React (StrictMode, hot reload) can tear an effect down
  // and set it up again on the same panel, and aborting there killed the
  // first answer before it arrived. A reply that lands after a real close is
  // simply dropped.
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const started = useRef(false)
  const turnsRef = useRef<Shown[]>([])
  turnsRef.current = turns
  const answeredOnce = useRef(false)
  const context = useRef(pageText(book.index, page))

  async function send(ask: string, label?: string) {
    const q = ask.trim()
    if (!q || busy) return
    const history = turnsRef.current
    setTurns(t => [...t, { role: 'user', content: q, label }])
    setInput('')
    setError('')
    setDraft('')
    setBusy(true)
    try {
      const messages = buildMessages({ title: book.title, page, quote, context: context.current, history, ask: q })
      const full = (await chat({ messages, effort: 'low', onChunk: (_t, all) => { if (alive.current) setDraft(all) } })).trim()
      // A stand-in reply arrives as plain JSON on a streaming request and
      // reads as nothing -- say so instead of showing an empty bubble.
      if (!full) throw Object.assign(new Error('AI unavailable'), { status: 503 })
      if (!alive.current) return
      setTurns(t => [...t, { role: 'assistant', content: full }])
      if (!answeredOnce.current) { answeredOnce.current = true; onAnswered?.(full) }
    } catch (e: any) {
      if (alive.current) setError(studentMessage(e))
    } finally {
      if (alive.current) { setDraft(''); setBusy(false) }
    }
  }

  // Answer the selection straight away -- once.
  useEffect(() => {
    if (started.current) return
    started.current = true
    void send(MODES[mode].first, MODES[mode].label)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /*
   * A finished answer is read from its FIRST line, so scroll to where it
   * starts; jumping to the end left only its last paragraph in view. A new
   * question (and an error) scroll to the end, where the reply will appear.
   */
  // Scrolled by hand on the chat box itself: scrollIntoView also scrolls every
  // ancestor, which nudged the Reader's page underneath.
  const lastAnswerRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const last = turns[turns.length - 1]
    const el = lastAnswerRef.current
    box.scrollTop = last?.role === 'assistant' && el ? Math.max(0, el.offsetTop - 8) : box.scrollHeight
  }, [turns])
  useEffect(() => { if (error && boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight }, [error])

  const exercise = looksLikeQuestion(quote)

  return (
    <div
      role="dialog" aria-label={MODES[mode].label}
      style={wide ? {
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 380, zIndex: 45,
        background: T.sheet, borderLeft: `1px solid ${T.border}`,
        display: 'flex', flexDirection: 'column', fontFamily: FONT, color: T.text,
      } : {
        position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%', zIndex: 45,
        background: T.sheet, borderTop: `1px solid ${T.border}`, borderRadius: '22px 22px 0 0',
        boxShadow: '0 -18px 50px rgba(0,0,0,0.55)',
        display: 'flex', flexDirection: 'column', fontFamily: FONT, color: T.text,
      }}
    >
      {!wide && <div aria-hidden="true" style={{ width: 38, height: 4, borderRadius: 2, background: T.borderCtl, margin: '8px auto 0' }} />}

      {/* header: what was selected, and where */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.divider}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.3, fontWeight: 700, color: T.accent }}>
            {MODES[mode].label.toUpperCase()}
          </div>
          <button onClick={() => onGoto?.(page)} disabled={!onGoto} style={{
            padding: '2px 8px', borderRadius: 100, border: `1px solid ${T.borderCtl}`, background: T.raised,
            color: T.accentPale, fontFamily: FONT, fontSize: 11, fontWeight: 700, cursor: onGoto ? 'pointer' : 'default',
          }}>p. {page}</button>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} aria-label="Close and keep reading" style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          }}>
            <X size={18} color={T.faint} {...ICON} />
          </button>
        </div>
        <div style={{
          marginTop: 6, fontSize: 12.5, color: T.muted, lineHeight: 1.5, borderLeft: `2px solid ${T.accent}`, paddingLeft: 9,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {quote}
        </div>
      </div>

      {/* the conversation */}
      <div ref={boxRef} style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px' }}>
        {turns.map((t, i) => t.role === 'user' ? (
          <div key={i} style={{
            marginLeft: 'auto', width: 'fit-content', maxWidth: '85%', marginBottom: 10,
            padding: '7px 12px', borderRadius: '14px 14px 4px 14px', background: T.accentSurface,
            fontSize: 13, color: T.text, lineHeight: 1.45,
          }}>{t.label || t.content}</div>
        ) : (
          <div key={i} ref={i === turns.length - 1 ? lastAnswerRef : undefined} style={{ marginBottom: 12, scrollMarginTop: 8 }}>
            <MathText text={t.content} style={{ fontSize: 14.5, color: T.text, lineHeight: 1.6 }} />
          </div>
        ))}
        {busy && (
          draft
            ? <MathText text={draft} style={{ fontSize: 14.5, color: T.text, lineHeight: 1.6 }} />
            : <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.muted, fontSize: 13.5 }}>
                <Loader2 size={15} {...ICON} className="kyno-spin" /> Thinking…
              </div>
        )}
        {error && (
          <div style={{ display: 'flex', gap: 8, color: T.warning, fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>
            <AlertTriangle size={16} {...ICON} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{error}</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* follow-ups */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${T.divider}`, padding: '10px 14px calc(10px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
          {exercise && onSolve && (
            <button onClick={() => onSolve(solveSeed(quote))} style={chipStyle(true)}>
              <ListOrdered size={13} {...ICON} /> Solve it step by step
            </button>
          )}
          {QUICK.map(q => (
            <button key={q.id} onClick={() => send(q.ask, q.label)} disabled={busy} style={chipStyle(false, busy)}>{q.label}</button>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); void send(input) }} style={{ display: 'flex', gap: 8 }}>
          <input
            value={input} onChange={e => setInput(e.target.value)} maxLength={400}
            placeholder="Ask a follow-up" aria-label="Ask a follow-up"
            style={{
              flex: 1, minWidth: 0, height: 42, borderRadius: 12, padding: '0 12px', boxSizing: 'border-box',
              background: T.raised, border: `1px solid ${T.borderCtl}`, color: T.text,
              fontFamily: FONT, fontSize: 16, outline: 'none',
            }}
          />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send" style={{
            width: 42, height: 42, borderRadius: 12, border: 'none', flexShrink: 0,
            background: busy || !input.trim() ? T.raised : T.accent, display: 'grid', placeItems: 'center',
            cursor: busy || !input.trim() ? 'default' : 'pointer',
          }}>
            <Send size={16} color={input.trim() && !busy ? '#fff' : T.faint} {...ICON} />
          </button>
        </form>
      </div>
    </div>
  )
}

function chipStyle(primary: boolean, disabled = false): React.CSSProperties {
  return {
    flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 100,
    background: primary ? T.accentSurface : T.raised, border: `1px solid ${primary ? T.accent : T.borderCtl}`,
    color: primary ? T.text : T.text2, fontFamily: FONT, fontSize: 12.5, fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1, whiteSpace: 'nowrap',
  }
}
