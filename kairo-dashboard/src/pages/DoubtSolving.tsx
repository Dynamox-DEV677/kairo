/**
 * Doubt Solving — one space for a question, however it arrives.
 *
 * Typing, speaking and photographing a doubt were three menu items that hit
 * the same solver and then showed three different answers in three different
 * layouts. This is one screen with one input bar and one answer.
 *
 * WHY THE ANSWER IS REVEALED A STEP AT A TIME
 * The old solver printed the whole worked solution the moment it arrived. A
 * student stuck on step 3 had already read step 4, so there was nothing left
 * to attempt. Steps unlock one at a time, and the next one is visible but
 * blurred-out with "try it yourself first" — the shape of the answer is a
 * hint, the answer is not.
 *
 * WHAT THIS IS NOT
 * A rewrite. Every request goes to the endpoints that already existed
 * (/api/ai/solver/text, /api/camera/analyze, /api/document/read), the chat is
 * the chat that already existed, and the save actions call the flashcard and
 * mistake recorders that already existed. This file is a container and a
 * layout; the intelligence is all upstream of it.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Camera, Mic, ChevronDown, ChevronRight, Check, RotateCcw, Bookmark,
  ArrowLeft, AlertTriangle, Layers, TrendingUp, Share2, RefreshCw, Loader2, X,
} from 'lucide-react'
import { aiHeadersAsync } from '../lib/devKey'
import { studentMessage } from '../lib/aiError.core'
import { getStudentMemory, getMistakes, listDoubts, recordDoubt } from '../lib/twin'
import {
  splitSteps, contextLabel, weaknessSuggestion, recentDoubtCards, ownMistakeLine,
} from '../lib/doubt.core'
import type { DoubtStep } from '../lib/doubt.core'

/* ── tokens ───────────────────────────────────────────────────────────────── */

const T = {
  bg: '#0B0B14',
  bgAlt: '#0F0F1A',
  surface: '#15151F',
  raised: '#1A1A26',
  sheet: '#131320',
  border: '#262636',
  borderCtl: '#2A2A3C',
  divider: '#1E1E2C',
  text: '#EDEDF5',
  text2: '#C9C9DC',
  muted: '#9494AD',
  dim: '#7E7E96',
  faint: '#5E5E78',
  fainter: '#4A4A60',
  accent: '#7C5CFF',
  accentLite: '#9B82FF',
  accentPale: '#C4B4FF',
  accentSurface: '#2A1F52',
  success: '#3DD68C',
  successBg: '#123D2B',
  warning: '#F2A65A',
} as const

const FONT = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace"
const ICON = { strokeWidth: 1.75, absoluteStrokeWidth: false } as const

type Style = React.CSSProperties

/* ── answer modes ─────────────────────────────────────────────────────────── */

/**
 * The three pills on the capture screen. Each rewrites the request, because
 * the difference has to reach the model — a UI toggle that only hides text
 * would still burn the same tokens and still spoil the answer.
 */
const MODES = [
  {
    id: 'steps', label: 'Step by step',
    prefix: 'Solve this step by step. Number each step with a ## heading, show the working, and explain the reasoning behind each one.',
  },
  {
    id: 'answer', label: 'Just the answer',
    prefix: 'Give the final answer with the minimum working needed to justify it. Be brief.',
  },
  {
    id: 'hint', label: 'Give me a hint',
    prefix: 'Do NOT solve this. Give one hint that points at the first thing the student should do, and stop. No final answer.',
  },
] as const

type ModeId = typeof MODES[number]['id']

/* ── small shared bits ────────────────────────────────────────────────────── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: 700, color: T.accent, textTransform: 'uppercase' }}>
      {children}
    </div>
  )
}

function Card({ children, style, onClick }: { children: React.ReactNode; style?: Style; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      style={{
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16,
        padding: 14, cursor: onClick ? 'pointer' : undefined, ...style,
      }}
    >
      {children}
    </div>
  )
}

/**
 * A failure the student can act on, inline.
 *
 * Never a full-screen error: the brief is explicit that an AI outage must not
 * make the screen useless, so this sits inside the flow with the input bar and
 * the camera still live above and below it.
 */
function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.borderCtl}`, borderRadius: 16,
      padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <AlertTriangle size={18} color={T.warning} {...ICON} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: T.text2, lineHeight: 1.45 }}>{message}</div>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              marginTop: 10, minHeight: 38, padding: '0 14px', borderRadius: 14,
              background: T.raised, border: `1px solid ${T.borderCtl}`, color: T.accentPale,
              fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}
          >
            <RefreshCw size={14} {...ICON} /> Try again
          </button>
        )}
      </div>
    </div>
  )
}

/* ── the input bar ────────────────────────────────────────────────────────── */

/**
 * Text, mic and camera, on every screen that can take a question.
 *
 * All three call the same handler with a mode flag. That is the whole point of
 * the consolidation: the student picks how to ask, not which feature to open.
 */
function InputBar({
  value, onChange, onSubmit, onCamera, onMic, listening, busy, caption,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onCamera: () => void
  onMic: () => void
  listening: boolean
  busy: boolean
  caption?: string
}) {
  return (
    <div style={{
      position: 'sticky', bottom: 0, background: T.bgAlt,
      borderTop: `1px solid ${T.divider}`,
      padding: '12px 14px calc(12px + env(safe-area-inset-bottom))',
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit() } }}
          placeholder="Type your question"
          aria-label="Type your question"
          style={{
            flex: 1, minWidth: 0, height: 52, borderRadius: 100, padding: '0 20px',
            background: T.raised, border: `1px solid ${T.borderCtl}`, color: T.text,
            fontSize: 15, fontFamily: FONT, outline: 'none',
          }}
        />
        <button
          onClick={onMic}
          aria-label={listening ? 'Stop listening' : 'Ask by voice'}
          style={{
            width: 52, height: 52, flexShrink: 0, borderRadius: '50%',
            background: listening ? T.accentSurface : T.raised,
            border: `1px solid ${listening ? T.accent : T.borderCtl}`,
            display: 'grid', placeItems: 'center', cursor: 'pointer',
          }}
        >
          <Mic size={21} color={listening ? T.accentPale : T.muted} {...ICON} />
        </button>
        <button
          onClick={onCamera}
          aria-label="Snap the question"
          style={{
            width: 52, height: 52, flexShrink: 0, borderRadius: '50%',
            background: T.accent, border: 'none',
            display: 'grid', placeItems: 'center', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(124,92,255,0.35)',
          }}
        >
          {busy ? <Loader2 size={21} color="#fff" {...ICON} className="kyno-spin" />
                : <Camera size={21} color="#fff" {...ICON} />}
        </button>
      </div>
      {caption && (
        <div style={{ fontSize: 11.5, color: T.faint, textAlign: 'center', marginTop: 9 }}>
          {caption}
        </div>
      )}
    </div>
  )
}

/* ── screen 3: the answer ─────────────────────────────────────────────────── */

function StepCard({ step, n }: { step: DoubtStep; n: number }) {
  return (
    <Card style={{ padding: 15 }}>
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
        <div style={{
          width: 22, height: 22, borderRadius: 7, flexShrink: 0,
          background: T.accentSurface, color: T.accentPale,
          display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 700,
        }}>{n}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text, lineHeight: 1.4 }}>
            {step.title}
          </div>
          {step.working && (
            <pre style={{
              margin: '10px 0 0', padding: '10px 12px', borderRadius: 12,
              background: '#101019', border: `1px solid ${T.divider}`,
              fontFamily: MONO, fontSize: 13, color: T.text2,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowX: 'auto',
            }}>{step.working}</pre>
          )}
          {step.why && (
            <div style={{ marginTop: 9, fontSize: 12.5, color: T.dim, lineHeight: 1.55 }}>
              {step.why}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

/** The next step: present, numbered, and deliberately withholding the working. */
function LockedStep({ step, n }: { step: DoubtStep; n: number }) {
  return (
    <div style={{
      border: `1px dashed ${'#2E2E42'}`, background: '#101019',
      borderRadius: 16, padding: 15,
    }}>
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
        <div style={{
          width: 22, height: 22, borderRadius: 7, flexShrink: 0,
          background: T.raised, color: T.faint,
          display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 700,
        }}>{n}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: T.dim, lineHeight: 1.4 }}>
            {step.title}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: T.fainter, lineHeight: 1.5 }}>
            Try it yourself first — you have everything you need
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── screen 5: the save sheet ─────────────────────────────────────────────── */

interface SaveResult {
  flashcards: string[]
  mistakeNote: string | null
  topic: string
}

function SaveSheet({ result, onClose, onAskAnother }: {
  result: SaveResult
  onClose: () => void
  onAskAnother: () => void
}) {
  const rows = [
    result.flashcards.length && {
      icon: <Layers size={17} color={T.accentPale} {...ICON} />,
      tint: T.accentSurface,
      title: `${result.flashcards.length} flashcard${result.flashcards.length === 1 ? '' : 's'}`,
      sub: result.flashcards.join(' · '),
      action: 'Review',
    },
    result.mistakeNote && {
      icon: <AlertTriangle size={17} color={T.warning} {...ICON} />,
      tint: '#3A2A16',
      title: 'Logged to Mistake Analysis',
      sub: result.mistakeNote,
      action: 'View',
    },
    result.topic && {
      icon: <TrendingUp size={17} color={T.success} {...ICON} />,
      tint: T.successBg,
      title: `${result.topic} — gap closing`,
      sub: 'Added to your knowledge graph',
      action: 'Graph',
    },
  ].filter(Boolean) as Array<{ icon: React.ReactNode; tint: string; title: string; sub: string; action: string }>

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 40,
        background: 'rgba(5,5,12,0.66)', display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', background: T.sheet, borderRadius: '26px 26px 0 0',
          borderTop: `1px solid ${T.border}`,
          padding: '10px 18px calc(18px + env(safe-area-inset-bottom))',
          maxHeight: '86%', overflowY: 'auto',
        }}
      >
        <div style={{ width: 38, height: 4, borderRadius: 2, background: T.borderCtl, margin: '0 auto 18px' }} />

        <div style={{
          width: 54, height: 54, borderRadius: 16, background: T.successBg,
          display: 'grid', placeItems: 'center', marginBottom: 14,
        }}>
          <Check size={26} color={T.success} {...ICON} />
        </div>

        <div style={{ fontSize: 19, fontWeight: 700, color: T.text }}>Saved to your notes</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 5 }}>
          {rows.length === 1
            ? 'Kyno pulled one thing out of this'
            : `Kyno pulled ${rows.length} things out of this one`}
        </div>

        <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
          {rows.map((r, i) => (
            <div key={i} style={{
              display: 'flex', gap: 12, alignItems: 'center',
              background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 16, padding: 13,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12, background: r.tint,
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}>{r.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>{r.title}</div>
                <div style={{
                  fontSize: 11.5, color: T.dim, marginTop: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{r.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            onClick={onAskAnother}
            style={{
              flex: 1, height: 50, borderRadius: 15, background: T.accent, border: 'none',
              color: '#fff', fontSize: 14.5, fontWeight: 700, fontFamily: FONT, cursor: 'pointer',
            }}
          >Ask another</button>
          <button
            aria-label="Share"
            style={{
              width: 50, height: 50, flexShrink: 0, borderRadius: 15,
              background: T.raised, border: `1px solid ${T.borderCtl}`,
              display: 'grid', placeItems: 'center', cursor: 'pointer',
            }}
          >
            <Share2 size={19} color={T.muted} {...ICON} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── the page ─────────────────────────────────────────────────────────────── */

type View = 'entry' | 'capture' | 'answer'

export default function DoubtSolving({
  profile, onOpenChat,
}: {
  profile?: any
  /** Hands the question (and the step they were on) to the existing chat. */
  onOpenChat?: (seed: string) => void
}) {
  const [view, setView] = useState<View>('entry')
  const [input, setInput] = useState('')
  const [listening, setListening] = useState(false)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [question, setQuestion] = useState('')
  const [steps, setSteps] = useState<DoubtStep[]>([])
  const [revealed, setRevealed] = useState(1)
  const [topic, setTopic] = useState('')

  const [shot, setShot] = useState<string | null>(null)
  const [detected, setDetected] = useState('')
  const [mode, setMode] = useState<ModeId>('steps')

  const [saved, setSaved] = useState<SaveResult | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  /* ── data the screen reads from what the app already knows ── */

  const mistakes = useMemo(() => { try { return getMistakes() } catch { return [] } }, [view])
  const recents = useMemo(() => {
    try { return recentDoubtCards(listDoubts(8), 2) } catch { return [] }
  }, [view])
  const suggestion = useMemo(() => weaknessSuggestion(mistakes), [mistakes])

  const [subject, setSubject] = useState('')
  const chip = contextLabel(profile, subject)

  useEffect(() => () => abortRef.current?.abort(), [])

  /* ── asking ── */

  const solve = useCallback(async (raw: string, chosen: ModeId = 'steps') => {
    const asked = raw.trim()
    if (!asked) return

    setQuestion(asked)
    setError('')
    setSteps([])
    setRevealed(1)
    setBusy(true)
    setView('answer')

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const headers = { 'Content-Type': 'application/json', ...(await aiHeadersAsync()) }

      let student: any = null
      try { student = getStudentMemory() } catch { /* twin unavailable */ }
      // The chip is not decoration — it goes to the model, which is why the
      // same question can get a different answer for CBSE and Cambridge.
      if (student && subject) student.subject = subject

      let ms: any[] = []
      try {
        ms = getMistakes().slice(0, 10).map(m => ({ topic: m.topic, count: m.count, severity: m.severity }))
      } catch { /* no history yet */ }

      const prefix = MODES.find(m => m.id === chosen)?.prefix || ''
      const r = await fetch('/api/ai/solver/text', {
        method: 'POST', headers, signal: ctrl.signal,
        body: JSON.stringify({ question: `${prefix}\n\n${asked}`, student, mistakes: ms }),
      })

      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        const e: any = new Error(body?.error || 'The solver did not answer.')
        e.status = r.status
        throw e
      }

      const plan = await r.json()
      const parsed = splitSteps(plan)
      setSteps(parsed)
      setTopic(plan?.topicKeyword || '')
      if (plan?.questionType && !subject) setSubject(plan.questionType)

      try {
        recordDoubt({
          question: asked,
          answer: plan?.textExplanation,
          topic: plan?.topicKeyword,
          subject: plan?.questionType,
          source: 'solver',
        })
      } catch { /* recording is a nicety, never a blocker */ }
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      setError(studentMessage(e))
    } finally {
      setBusy(false)
    }
  }, [subject])

  /* ── camera ── */

  function openCamera() { fileRef.current?.click() }

  async function onFile(f: File | null) {
    if (!f) return
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = String(reader.result || '')
      setShot(dataUrl)
      setDetected('')
      setView('capture')
      setError('')

      // Read the page so the student can confirm WHICH question before we
      // spend a solve on it. A textbook page holds five sums.
      setBusy(true)
      try {
        const headers = { 'Content-Type': 'application/json', ...(await aiHeadersAsync()) }
        const r = await fetch('/api/camera/analyze', {
          method: 'POST', headers,
          body: JSON.stringify({ image: dataUrl, mode: 'read-question' }),
        })
        if (r.ok) {
          const j = await r.json()
          setDetected(String(j?.text || j?.question || '').trim())
        } else {
          const body = await r.json().catch(() => ({}))
          const e: any = new Error(body?.error || 'Could not read the page.')
          e.status = r.status
          throw e
        }
      } catch (e: any) {
        // The photo is still on screen and still solvable by typing what it
        // says — a failed read must not throw the capture away.
        setError(studentMessage(e))
      } finally {
        setBusy(false)
      }
    }
    reader.readAsDataURL(f)
  }

  /* ── voice ── */

  function toggleMic() {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setError('Voice input is not available in this browser — type it instead.'); return }
    if (listening) { setListening(false); return }
    try {
      const rec = new SR()
      rec.lang = 'en-IN'
      rec.interimResults = false
      rec.onresult = (ev: any) => {
        const said = ev?.results?.[0]?.[0]?.transcript || ''
        setListening(false)
        if (said) solve(said, 'steps')
      }
      rec.onerror = () => setListening(false)
      rec.onend = () => setListening(false)
      rec.start()
      setListening(true)
    } catch {
      setListening(false)
      setError('Could not start the microphone.')
    }
  }

  /* ── saving ── */

  function save() {
    const fronts = steps.slice(0, 2).map(s => s.title).filter(Boolean)
    setSaved({
      flashcards: fronts,
      mistakeNote: ownMistakeLine(topic, mistakes),
      topic,
    })
  }

  /* ── render ───────────────────────────────────────────────────────────── */

  const shell: Style = {
    position: 'absolute', inset: 0, background: T.bg, color: T.text,
    fontFamily: FONT, display: 'flex', flexDirection: 'column', overflow: 'hidden',
  }
  const scroll: Style = { flex: 1, overflowY: 'auto', padding: '18px 14px 8px' }

  /* entry ------------------------------------------------------------------ */
  if (view === 'entry') {
    return (
      <div style={shell}>
        <input ref={fileRef} type="file" accept="image/*" capture="environment"
               style={{ display: 'none' }} onChange={e => onFile(e.target.files?.[0] || null)} />
        <div style={scroll}>
          <Eyebrow>Doubt solving</Eyebrow>
          <h1 style={{ fontSize: 25, fontWeight: 700, margin: '8px 0 0', letterSpacing: -0.3 }}>
            What are you stuck on?
          </h1>

          {chip && (
            <button
              onClick={() => { /* subject picker lands with the profile sheet */ }}
              style={{
                marginTop: 14, height: 36, padding: '0 14px', borderRadius: 100,
                background: T.raised, border: `1px solid ${T.borderCtl}`, color: T.text2,
                fontSize: 12.5, fontWeight: 500, fontFamily: FONT, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.success }} />
              {chip}
              <ChevronDown size={15} color={T.faint} {...ICON} />
            </button>
          )}

          {error && <div style={{ marginTop: 16 }}><InlineError message={error} /></div>}

          {recents.length > 0 && (
            <>
              <div style={{ marginTop: 26, marginBottom: 10 }}>
                <Eyebrow>Pick up where you left</Eyebrow>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {recents.map(r => (
                  <Card key={r.id} onClick={() => solve(r.question)}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 11, background: T.accentSurface,
                        display: 'grid', placeItems: 'center', flexShrink: 0,
                      }}>
                        <Bookmark size={16} color={T.accentPale} {...ICON} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13.5, color: T.text, lineHeight: 1.45,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>{r.question}</div>
                        <div style={{ fontSize: 11.5, color: T.faint, marginTop: 5 }}>
                          {r.meta}{r.saved ? ' · Saved to notes' : ''}
                        </div>
                      </div>
                      <ChevronRight size={17} color={T.fainter} {...ICON} style={{ flexShrink: 0, marginTop: 8 }} />
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}

          {suggestion && (
            <Card
              onClick={() => solve(suggestion.prompt)}
              style={{
                marginTop: 12,
                background: 'linear-gradient(135deg, #1A1430, #15151F)',
                border: '1px solid #2E2450',
              }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>
                {suggestion.headline}
              </div>
              <div style={{ fontSize: 12, color: T.accentPale, marginTop: 4 }}>
                {suggestion.detail}
              </div>
            </Card>
          )}
        </div>

        <InputBar
          value={input} onChange={setInput}
          onSubmit={() => { const q = input; setInput(''); solve(q) }}
          onCamera={openCamera} onMic={toggleMic}
          listening={listening} busy={busy}
          caption="Snap the question, say it, or type it — same place"
        />
      </div>
    )
  }

  /* capture ---------------------------------------------------------------- */
  if (view === 'capture') {
    return (
      <div style={shell}>
        <div style={scroll}>
          <button
            onClick={() => { setView('entry'); setError('') }}
            style={{
              background: 'none', border: 'none', color: T.muted, fontFamily: FONT,
              fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
              gap: 6, padding: 0, marginBottom: 14, minHeight: 44,
            }}
          >
            <ArrowLeft size={17} {...ICON} /> Back
          </button>

          {shot && (
            <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: `1px solid ${T.border}` }}>
              <img src={shot} alt="The question you photographed" style={{ width: '100%', display: 'block' }} />
            </div>
          )}

          <div style={{
            marginTop: 12, display: 'flex', gap: 10, alignItems: 'flex-start',
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 13,
          }}>
            {busy
              ? <Loader2 size={17} color={T.muted} {...ICON} style={{ flexShrink: 0, marginTop: 1 }} />
              : <Check size={17} color={T.success} {...ICON} style={{ flexShrink: 0, marginTop: 1 }} />}
            <div style={{ fontSize: 12.5, color: T.text2, lineHeight: 1.5 }}>
              {busy
                ? 'Reading the page…'
                : detected
                  ? <>Read it as: <span style={{ color: T.text }}>{detected.slice(0, 180)}</span></>
                  : 'Could not read the page automatically — type the question below and it still works.'}
            </div>
          </div>

          {error && <div style={{ marginTop: 12 }}><InlineError message={error} /></div>}

          <div style={{ marginTop: 22, marginBottom: 10 }}>
            <Eyebrow>How should Kyno answer?</Eyebrow>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {MODES.map(m => {
              const on = mode === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  style={{
                    minHeight: 44, padding: '0 16px', borderRadius: 100,
                    background: on ? T.accentSurface : T.raised,
                    border: `1px solid ${on ? T.accent : T.borderCtl}`,
                    color: on ? T.accentPale : T.muted,
                    fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
                  }}
                >{m.label}</button>
              )
            })}
          </div>
        </div>

        <div style={{
          background: T.bgAlt, borderTop: `1px solid ${T.divider}`,
          padding: '12px 14px calc(12px + env(safe-area-inset-bottom))',
          display: 'flex', gap: 10,
        }}>
          <button
            onClick={openCamera}
            aria-label="Retake the photo"
            style={{
              width: 52, height: 52, flexShrink: 0, borderRadius: 15,
              background: T.raised, border: `1px solid ${T.borderCtl}`,
              display: 'grid', placeItems: 'center', cursor: 'pointer',
            }}
          >
            <RotateCcw size={19} color={T.muted} {...ICON} />
          </button>
          <button
            onClick={() => solve(detected || input, mode)}
            disabled={!detected && !input.trim()}
            style={{
              flex: 1, height: 52, borderRadius: 15, border: 'none',
              background: (detected || input.trim()) ? T.accent : T.raised,
              color: (detected || input.trim()) ? '#fff' : T.faint,
              fontSize: 15, fontWeight: 700, fontFamily: FONT,
              cursor: (detected || input.trim()) ? 'pointer' : 'not-allowed',
            }}
          >Solve this →</button>
        </div>
      </div>
    )
  }

  /* answer ----------------------------------------------------------------- */
  const total = steps.length
  const shown = Math.min(revealed, total)

  return (
    <div style={shell}>
      <input ref={fileRef} type="file" accept="image/*" capture="environment"
             style={{ display: 'none' }} onChange={e => onFile(e.target.files?.[0] || null)} />

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
        borderBottom: `1px solid ${T.divider}`,
      }}>
        <button
          onClick={() => setView('entry')}
          aria-label="Back"
          style={{
            width: 44, height: 44, marginLeft: -10, borderRadius: 12, background: 'none',
            border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer',
          }}
        >
          <ArrowLeft size={20} color={T.muted} {...ICON} />
        </button>
        {topic && (
          <div style={{
            padding: '6px 12px', borderRadius: 100, background: T.raised,
            border: `1px solid ${T.borderCtl}`, fontSize: 12, color: T.text2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{topic}</div>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={save}
          aria-label="Save to notes"
          style={{
            width: 44, height: 44, borderRadius: 12, background: 'none', border: 'none',
            display: 'grid', placeItems: 'center', cursor: 'pointer',
          }}
        >
          <Bookmark size={19} color={T.muted} {...ICON} />
        </button>
      </div>

      <div style={scroll}>
        <Card style={{ background: T.bgAlt }}>
          <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.5 }}>{question}</div>
        </Card>

        {busy && (
          <div style={{
            marginTop: 16, display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 13, color: T.muted,
          }}>
            <Loader2 size={16} {...ICON} /> Working through it…
          </div>
        )}

        {error && (
          <div style={{ marginTop: 16 }}>
            <InlineError message={error} onRetry={() => solve(question, mode)} />
          </div>
        )}

        {total > 0 && (
          <>
            <div style={{ margin: '22px 0 10px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Eyebrow>Step {shown} of {total}</Eyebrow>
              <div style={{ flex: 1, display: 'flex', gap: 4 }}>
                {steps.map((_, i) => (
                  <div key={i} style={{
                    flex: 1, height: 3, borderRadius: 2,
                    background: i < shown ? T.accent : T.borderCtl,
                  }} />
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {steps.slice(0, shown).map((s, i) => <StepCard key={i} step={s} n={i + 1} />)}
              {shown < total && <LockedStep step={steps[shown]} n={shown + 1} />}
            </div>
          </>
        )}
      </div>

      {total > 0 && (
        <div style={{
          background: T.bgAlt, borderTop: `1px solid ${T.divider}`,
          padding: '12px 14px calc(12px + env(safe-area-inset-bottom))',
        }}>
          {shown < total ? (
            <button
              onClick={() => setRevealed(r => r + 1)}
              style={{
                width: '100%', height: 52, borderRadius: 15, background: T.accent,
                border: 'none', color: '#fff', fontSize: 15, fontWeight: 700,
                fontFamily: FONT, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              Show step {shown + 1} <ChevronDown size={18} {...ICON} />
            </button>
          ) : (
            <button
              onClick={save}
              style={{
                width: '100%', height: 52, borderRadius: 15, background: T.accent,
                border: 'none', color: '#fff', fontSize: 15, fontWeight: 700,
                fontFamily: FONT, cursor: 'pointer',
              }}
            >Save to notes</button>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button
              onClick={() => onOpenChat?.(
                `I'm stuck on step ${shown} of this: ${question}\n\n${steps[shown - 1]?.title || ''}\n${steps[shown - 1]?.working || ''}`
              )}
              style={{
                flex: 1, height: 46, borderRadius: 14, background: T.raised,
                border: `1px solid ${T.borderCtl}`, color: T.text2,
                fontSize: 13.5, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
              }}
            >I'm stuck here</button>
            <button
              onClick={() => solve(`Give me one more question just like this one: ${question}`, 'steps')}
              style={{
                flex: 1, height: 46, borderRadius: 14, background: T.raised,
                border: `1px solid ${T.borderCtl}`, color: T.text2,
                fontSize: 13.5, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
              }}
            >Similar sum</button>
          </div>
        </div>
      )}

      {saved && (
        <SaveSheet
          result={saved}
          onClose={() => setSaved(null)}
          onAskAnother={() => { setSaved(null); setView('entry'); setSteps([]); setQuestion('') }}
        />
      )}
    </div>
  )
}
