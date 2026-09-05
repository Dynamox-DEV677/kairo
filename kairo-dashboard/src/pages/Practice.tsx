/**
 * Practice — one timed session instead of six menu items.
 *
 * The student picks TIME. Kyno picks FORMAT. Adaptive Quiz, Flashcards,
 * Revision Simulator, Grader and Teach Back are formats inside one session;
 * Mock Test is a separate room, because three hours is a different decision
 * from fifteen minutes.
 *
 * WHAT THIS IS NOT
 * A rewrite. Cards come from the twin's flashcard table and are rescheduled by
 * the same FSRS call Flashcards.tsx makes. Questions come from /api/quiz/start.
 * Written answers are transcribed by the camera route the Solver already uses
 * and marked by /api/practice/grade. XP goes through awardXP and the published table. The
 * intelligence is upstream; this file is a shell and six layouts.
 *
 * DEGRADED STATE, by design
 * Cards and MCQs need no AI and always work. If the grader is down the photo
 * is kept, the answer is saved as "grading when the AI is back", and the
 * session continues. If teach-back cannot get a mic or a grade, the format is
 * dropped from the remaining plan silently. A student mid-session should not
 * be able to tell the AI layer is struggling — so nothing in here shows a
 * full-screen error.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  X, Bookmark, Clock, ChevronRight, Check, AlertTriangle, Mic, Camera, RotateCcw,
  Lock, Grid3x3, Flag, ArrowLeft, Layers, HelpCircle, PenLine, MessageSquare, Loader2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { KATEX_OPTS } from '../lib/katex'
import { prepMathMarkdown } from '../lib/math.core'
import { T, FONT, MONO, ICON } from '../lib/spaceTokens'
import { useSpaceLayout } from '../components/SpaceFrame'
import { SPACE_VIEW_EVENT } from '../lib/spaces.core'
import { keepPageMounted } from '../lib/keepMounted'
import { aiHeadersAsync } from '../lib/devKey'
import { post } from '../lib/api'
import { studentMessage } from '../lib/aiError.core'
import {
  loadState, listFlashcards, reviewFlashcard, getMistakes, getProfile, track, recordFlashcard,
} from '../lib/twin'
import { saveToNotebook } from '../lib/notebook'
import { cardsForNote, attachCards } from '../lib/notes.core'
import { nearestExamDays } from '../lib/examDate'
import { nextInterval as fsrsNextInterval } from '../lib/fsrs.core'
import { awardXP } from '../lib/game'
import { getJSON, setJSON } from '../lib/storage'
import { cleanOption } from '../lib/museum.core'
import { scorePaper, paletteStates, clockLabel } from '../lib/exam.core'
import type { ExamQuestion } from '../lib/exam.core'
import {
  buildSession, rebuildWithout, trimQuestions, clock, intervalLabel, lastMissLine,
  movementRows, resultsHeadline, xpFor, flatTopicNudge, BUDGETS,
} from '../lib/practice.core'
import type { SessionPlan, SessionItem, MovementRow } from '../lib/practice.core'

type Style = React.CSSProperties

/* ── small shared bits ────────────────────────────────────────────────────── */

function Eyebrow({ children, color = T.accent }: { children: React.ReactNode; color?: string }) {
  return <div style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: 700, color, textTransform: 'uppercase' }}>{children}</div>
}

function Card({ children, style, onClick }: { children: React.ReactNode; style?: Style; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, cursor: onClick ? 'pointer' : undefined, ...style }}
    >{children}</div>
  )
}

function Primary({ children, onClick, disabled, style }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; style?: Style }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', height: 54, borderRadius: 14, border: 'none',
      background: disabled ? T.raised : T.accent, color: disabled ? T.faint : '#fff',
      fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...style,
    }}>{children}</button>
  )
}

function Secondary({ children, onClick, style }: { children: React.ReactNode; onClick?: () => void; style?: Style }) {
  return (
    <button onClick={onClick} style={{
      height: 46, padding: '0 16px', borderRadius: 14, background: T.raised, border: `1px solid ${T.borderCtl}`,
      color: T.text2, fontSize: 13.5, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', ...style,
    }}>{children}</button>
  )
}

/** Inline, never full-screen. The session keeps going around it. */
function Inline({ message, onRetry, tone = 'warn' }: { message: string; onRetry?: () => void; tone?: 'warn' | 'ok' }) {
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 14,
      background: tone === 'ok' ? T.successBg : T.warningBg,
      border: `1px solid ${tone === 'ok' ? T.successBorder : T.warningBorder}`,
    }}>
      {tone === 'ok'
        ? <Check size={16} color={T.success} {...ICON} style={{ flexShrink: 0, marginTop: 2 }} />
        : <AlertTriangle size={16} color={T.warning} {...ICON} style={{ flexShrink: 0, marginTop: 2 }} />}
      <div style={{ flex: 1, fontSize: 12.5, color: T.text2, lineHeight: 1.5 }}>
        {message}
        {onRetry && (
          <button onClick={onRetry} style={{
            display: 'block', marginTop: 8, background: 'none', border: 'none', padding: 0,
            color: T.accentPale, fontSize: 12.5, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
          }}>Try again</button>
        )}
      </div>
    </div>
  )
}

const KIND_ICON = {
  card: Layers, question: HelpCircle, written: PenLine, teach: MessageSquare,
} as const

/* ── the session chrome ───────────────────────────────────────────────────── */

function Chrome({ label, msLeft, progress, onClose, exam = false }: {
  label: string; msLeft: number; progress: number; onClose: () => void; exam?: boolean
}) {
  const low = exam && msLeft < 10 * 60_000
  return (
    <div style={{ borderBottom: `1px solid ${exam ? T.borderExam : T.divider}`, background: exam ? T.exam : T.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 10px 4px' }}>
        <button onClick={onClose} aria-label="Close" style={{
          width: 44, height: 44, borderRadius: 12, background: 'none', border: 'none',
          display: 'grid', placeItems: 'center', cursor: 'pointer',
        }}><X size={20} color={T.muted} {...ICON} /></button>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{
          fontFamily: exam ? MONO : FONT, fontSize: exam ? 20 : 13, fontWeight: 600,
          color: exam ? (low ? T.error : T.warning) : T.muted, paddingRight: 8, fontVariantNumeric: 'tabular-nums',
        }}>{exam ? clockLabel(msLeft) : `${clock(msLeft)} left`}</div>
      </div>
      {!exam && (
        <div style={{ height: 3, background: T.divider }}>
          <div style={{ height: 3, width: `${Math.min(100, Math.max(0, progress * 100))}%`, background: T.accent, transition: 'width .3s' }} />
        </div>
      )}
    </div>
  )
}

/**
 * Maths, wherever a card or a question is shown.
 *
 * Anything a student or a model writes can contain maths, so every such
 * surface renders through markdown + KaTeX. prepMathMarkdown normalises the
 * delimiters and maps Unicode Greek to LaTeX commands first, which is what
 * lets "sin θ" and "5 Ω" come out as maths rather than as stray glyphs.
 */
function MathText({ text, style }: { text?: string | null; style?: Style }) {
  const src = String(text ?? '')
  if (!src.trim()) return null
  return (
    <div className="kyno-math" style={style}>
      <style>{`.kyno-math p { margin: 0 } .kyno-math .katex { color: inherit } .kyno-math .katex-display { margin: 6px 0; overflow-x: auto; overflow-y: hidden }`}</style>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, KATEX_OPTS]]}>
        {prepMathMarkdown(src)}
      </ReactMarkdown>
    </div>
  )
}

/* ── format: flashcard ────────────────────────────────────────────────────── */

const GRADES = [
  { rating: 1 as const, label: 'Again', color: T.error,   border: T.errorBorder },
  { rating: 2 as const, label: 'Hard',  color: T.warning, border: T.warningBorder },
  { rating: 3 as const, label: 'Good',  color: T.success, border: '#234A38' },
  { rating: 4 as const, label: 'Easy',  color: T.info,    border: T.infoBorder },
]

function FlashcardFormat({ card, missLine, onGrade, onAsk }: {
  card: any; missLine: string | null; onGrade: (rating: 1 | 2 | 3 | 4) => void; onAsk: () => void
}) {
  const [flipped, setFlipped] = useState(false)
  useEffect(() => setFlipped(false), [card?.id])

  // The REAL next interval for each button, from the same scheduler the review
  // will use -- not "1 min / 2 days / 6 days / 14 days" placeholders.
  const intervals = useMemo(() => {
    const days = nearestExamDays()
    return GRADES.map(g => {
      try {
        const state = card?.fsrs
          ? { ...card.fsrs }
          : { stability: 0.4, difficulty: 5, reps: 0, lapses: 0 }
        // preview the interval this rating would produce
        const { intervalDays } = fsrsNextInterval(
          g.rating === 1 ? { ...state, stability: Math.min(state.stability, 0.05) } : state,
          { daysToExam: days },
        )
        return intervalLabel(g.rating === 1 ? 0 : intervalDays * (g.rating === 2 ? 0.6 : g.rating === 4 ? 1.6 : 1))
      } catch { return '' }
    })
  }, [card?.id])

  const pill = [card?.subject, card?.topic].filter(Boolean).join(' · ').toUpperCase()

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 14px 0', minHeight: 0 }}>
      <div
        onClick={() => setFlipped(f => !f)}
        style={{
          flex: 1, minHeight: 0, background: T.surface, borderRadius: 22, border: `1px solid ${T.border}`,
          display: 'flex', flexDirection: 'column', cursor: 'pointer', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 14px 0' }}>
          {pill ? (
            <div style={{ fontSize: 10.5, letterSpacing: 1.2, fontWeight: 700, color: T.accentPale, background: T.accentSurface, borderRadius: 100, padding: '5px 10px' }}>{pill}</div>
          ) : <span />}
          <Bookmark size={17} color={T.faint} {...ICON} />
        </div>

        {/* justify-content:center on a scrolling flex box clips the TOP of any
            content taller than the box, and the clipped part cannot be
            scrolled to -- which is why a two-line question lost its first
            line. Auto margins centre it when it fits and let it scroll from
            the top when it does not. */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '18px 18px', overflowY: 'auto' }}>
        <div style={{ margin: 'auto 0', width: '100%' }}>
          {/* BOTH faces go through the maths renderer. The front used to be
              plain text, so "sin θ + cos θ" and a resistance in Ω arrived as
              characters instead of maths -- on the very side the student is
              asked to answer from. */}
          <MathText text={card?.front} style={{ fontSize: 21, fontWeight: 600, color: T.text, lineHeight: 1.4, textAlign: 'center' }} />
          {flipped && (
            <>
              <div style={{ height: 1, background: T.divider, margin: '18px 0 14px' }} />
              <Eyebrow color={T.success}>Answer</Eyebrow>
              <MathText text={card?.back} style={{ fontSize: 22, color: T.text, marginTop: 8, lineHeight: 1.35, wordBreak: 'break-word' }} />
            </>
          )}
          {!flipped && <div style={{ fontSize: 12, color: T.faint, textAlign: 'center', marginTop: 18 }}>Tap to reveal</div>}
        </div>
        </div>

        {missLine && (
          <div style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '11px 14px', background: T.raised, borderTop: `1px solid ${T.divider}` }}>
            <AlertTriangle size={15} color={T.warning} {...ICON} />
            <div style={{ fontSize: 12.5, color: T.text2 }}>{missLine}</div>
          </div>
        )}
      </div>

      <div style={{ padding: '14px 0 6px' }}>
        <Eyebrow>How well did you know it?</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 10 }}>
          {GRADES.map((g, i) => (
            <button key={g.label} onClick={() => onGrade(g.rating)} disabled={!flipped} style={{
              height: 54, borderRadius: 14, background: T.surface, border: `1px solid ${g.border}`,
              opacity: flipped ? 1 : 0.45, cursor: flipped ? 'pointer' : 'not-allowed',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, fontFamily: FONT,
            }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: g.color }}>{g.label}</span>
              <span style={{ fontSize: 10.5, color: T.faint }}>{intervals[i]}</span>
            </button>
          ))}
        </div>
        <button onClick={onAsk} style={{
          display: 'block', margin: '12px auto 0', background: 'none', border: 'none',
          color: T.dim, fontSize: 12.5, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', minHeight: 44,
        }}>Ask Kyno about this card</button>
      </div>
    </div>
  )
}

/* ── format: question ─────────────────────────────────────────────────────── */

function QuestionFormat({ q, onAnswer }: { q: ExamQuestion; onAnswer: (correct: boolean, chosen: number) => void }) {
  const [chosen, setChosen] = useState<number | null>(null)
  useEffect(() => setChosen(null), [q?.q])
  const revealed = chosen !== null
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 0' }}>
      {q.topic && <div style={{ fontSize: 10.5, letterSpacing: 1.2, fontWeight: 700, color: T.accentPale, background: T.accentSurface, borderRadius: 100, padding: '5px 10px', display: 'inline-block' }}>{String(q.topic).toUpperCase()}</div>}
      <MathText text={q.q} style={{ fontSize: 16.5, lineHeight: 1.6, color: T.text, marginTop: 12 }} />
      <div style={{ display: 'grid', gap: 9, marginTop: 16 }}>
        {q.options.map((opt, i) => {
          const isRight = i === q.correctIndex
          const isChosen = i === chosen
          const bg = !revealed ? T.surface : isRight ? T.successBg : isChosen ? T.errorBg : T.surface
          const bd = !revealed ? T.border : isRight ? T.successBorder : isChosen ? T.errorBorder : T.border
          return (
            <button key={i} disabled={revealed} onClick={() => { setChosen(i); onAnswer(isRight, i) }} style={{
              display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left', padding: '12px 13px', minHeight: 48,
              background: bg, border: `1px solid ${bd}`, borderRadius: 14, cursor: revealed ? 'default' : 'pointer', fontFamily: FONT,
            }}>
              <span style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
                border: `1.5px solid ${revealed && (isRight || isChosen) ? 'transparent' : '#3A3A50'}`,
                background: revealed && isRight ? T.success : revealed && isChosen ? T.error : 'transparent',
                color: revealed && (isRight || isChosen) ? '#0B0B14' : T.muted, fontSize: 12, fontWeight: 700,
              }}>{'ABCD'[i]}</span>
              <span style={{ fontFamily: MONO, fontSize: 13.5, color: T.text2, lineHeight: 1.45 }}>{opt}</span>
            </button>
          )
        })}
      </div>
      {revealed && q.explanation && (
        <div style={{ marginTop: 14, fontSize: 12.5, color: T.dim, lineHeight: 1.55, padding: '12px 13px', background: T.well, borderRadius: 14, border: `1px solid ${T.divider}` }}>{q.explanation}</div>
      )}
    </div>
  )
}

/* ── format: written answer + grader ──────────────────────────────────────── */

interface Rubric {
  total: number; awarded: number; verdict: string
  steps: Array<{ line: number | null; type: string; marks: number; awarded: number; title: string; reason: string }>
}

function WrittenFormat({ question, marks, onDone }: {
  question: string; marks: number; onDone: (rubric: Rubric | null) => void
}) {
  const [shot, setShot] = useState<string | null>(null)
  const [lines, setLines] = useState<string[]>([])
  const [rubric, setRubric] = useState<Rubric | null>(null)
  const [busy, setBusy] = useState<'' | 'reading' | 'grading'>('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onFile(f: File | null) {
    if (!f) return
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = String(reader.result || '')
      setShot(dataUrl); setRubric(null); setNote(''); setPending(false)
      setBusy('reading')
      try {
        const headers = { 'Content-Type': 'application/json', ...(await aiHeadersAsync()) }
        const r = await fetch('/api/camera/analyze', { method: 'POST', headers, body: JSON.stringify({ image: dataUrl, mode: 'transcribe' }) })
        const j = await r.json().catch(() => ({}))
        if (!r.ok) { const e: any = new Error(j?.error || 'read failed'); e.status = r.status; throw e }
        const text = String(j?.text || '').trim()
        const ls = text.split('\n').map(s => s.trim()).filter(Boolean)
        setLines(ls)
        if (!ls.length) { setNote('Could not read the writing — try more light, or hold the phone flat.'); setBusy(''); return }

        setBusy('grading')
        const prof = getProfile() as any
        const g = await post('/practice/grade', {
          question, answer: ls.join('\n'), marks,
          board: prof?.board || 'CBSE', class: prof?.cls || '10',
        })
        setRubric(g)
        try {
          track({
            type: 'essay_graded', topic: question.slice(0, 60), score: Math.round((g.awarded / g.total) * 100),
            correct: g.awarded === g.total, modality: 'text',
            // The rubric travels with the event so Performance can name the
            // line that lost the mark without re-grading anything.
            payload: { practice: true, source: 'written', q: question, marks: g.total, awarded: g.awarded, steps: g.steps, lines: ls },
          })
        } catch { /* nicety */ }
      } catch (e: any) {
        // Grader down: keep the photo, save the answer, carry on. The session
        // must not know the AI layer is struggling.
        if (lines.length || shot) {
          try {
            const q = getJSON<any[]>('kyno:practice:pending') || []
            q.push({ ts: Date.now(), question, answer: lines.join('\n'), marks })
            setJSON('kyno:practice:pending', q.slice(-20))
          } catch { /* storage blocked */ }
          setPending(true)
        }
        setNote(studentMessage(e))
      } finally { setBusy('') }
    }
    reader.readAsDataURL(f)
  }

  const lost = rubric?.steps.filter(s => s.awarded < s.marks) || []
  const won  = rubric?.steps.filter(s => s.awarded === s.marks && s.marks > 0) || []
  const lostLines = new Set(lost.map(s => s.line).filter(Boolean))
  const wonLines  = new Set(won.map(s => s.line).filter(Boolean))

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => onFile(e.target.files?.[0] || null)} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Eyebrow>Written answer</Eyebrow>
          <span style={{ fontSize: 11, color: T.faint }}>· {marks} marks</span>
        </div>
        <div style={{ fontSize: 16.5, lineHeight: 1.6, color: T.text, marginTop: 8 }}>{question}</div>

        {!shot && (
          <Card style={{ marginTop: 16, textAlign: 'center', padding: '26px 14px', borderStyle: 'dashed', borderColor: T.dashed, background: T.well }}>
            <PenLine size={24} color={T.accentPale} {...ICON} />
            <div style={{ fontSize: 13.5, color: T.text2, marginTop: 10, lineHeight: 1.5 }}>Work it on paper the way you would in the exam. Then photograph the page.</div>
            <div style={{ fontSize: 11.5, color: T.faint, marginTop: 6 }}>Kyno marks it step by step, the way the board does.</div>
          </Card>
        )}

        {rubric && (
          <div style={{
            marginTop: 16, padding: 14, borderRadius: 16, border: `1px solid ${T.successBorder}`,
            background: 'linear-gradient(135deg, #123D2B, #15251F)', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ flex: 1 }}>
              <Eyebrow color={T.success}>CBSE step marking</Eyebrow>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginTop: 6, lineHeight: 1.35 }}>{rubric.verdict}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: T.success }}>{rubric.awarded}</span>
              <span style={{ fontSize: 17, fontWeight: 600, color: T.successInk }}>/{rubric.total}</span>
            </div>
          </div>
        )}

        {shot && (
          <div style={{ marginTop: 14, borderRadius: 16, overflow: 'hidden', border: `1px solid ${T.border}`, background: T.paper }}>
            <img src={shot} alt="Your written answer" style={{ width: '100%', display: 'block', maxHeight: 260, objectFit: 'cover' }} />
            {lines.length > 0 && (
              <div style={{ padding: '12px 14px', borderTop: `1px solid #E4DFD2` }}>
                {lines.map((l, i) => {
                  const n = i + 1
                  const isLost = lostLines.has(n), isWon = wonLines.has(n)
                  const step = rubric?.steps.find(s => s.line === n)
                  return (
                    <div key={i} style={{
                      position: 'relative', fontFamily: MONO, fontSize: 13, color: T.paperInk, lineHeight: 1.7,
                      padding: '2px 8px', margin: '2px 0', borderRadius: 6,
                      border: isLost ? `2px solid ${T.markLost}` : '2px solid transparent',
                    }}>
                      {l}
                      {(isLost || isWon) && step && (
                        <span style={{
                          position: 'absolute', right: -2, top: -10, fontSize: 10.5, fontWeight: 700, color: '#fff',
                          background: isLost ? T.markLost : T.markWon, borderRadius: 100, padding: '2px 7px', fontFamily: FONT,
                        }}>{isLost ? `−${step.marks - step.awarded}` : `✓ ${step.awarded}`}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {busy && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: T.muted }}>
            <Loader2 size={15} {...ICON} /> {busy === 'reading' ? 'Reading your handwriting…' : 'Marking it step by step…'}
          </div>
        )}

        {pending && <div style={{ marginTop: 12 }}><Inline tone="ok" message="Saved — grading when the AI is back. Your session carries on." /></div>}
        {note && !pending && <div style={{ marginTop: 12 }}><Inline message={note} onRetry={() => fileRef.current?.click()} /></div>}

        {rubric && (
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            {[...lost, ...won].map((s, i) => {
              const isLost = s.awarded < s.marks
              return (
                <div key={i} style={{
                  display: 'flex', gap: 12, padding: 13, borderRadius: 16,
                  background: isLost ? T.errorBg : T.successBg, border: `1px solid ${isLost ? T.errorBorder : T.successBorder}`,
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center',
                    background: isLost ? T.error : T.success, color: '#0B0B14',
                  }}>{isLost ? <X size={15} {...ICON} /> : <Check size={15} {...ICON} />}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>{s.title}</div>
                    <div style={{ fontSize: 12.5, color: T.text2, lineHeight: 1.5, marginTop: 4 }}>{s.reason}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ padding: '12px 14px calc(12px + env(safe-area-inset-bottom))', borderTop: `1px solid ${T.divider}`, background: T.bgAlt, display: 'flex', gap: 10 }}>
        {shot ? (
          <>
            <button onClick={() => fileRef.current?.click()} aria-label="Retake photo" style={{ width: 54, height: 54, flexShrink: 0, borderRadius: 14, background: T.raised, border: `1px solid ${T.borderCtl}`, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
              <RotateCcw size={19} color={T.muted} {...ICON} />
            </button>
            <Primary onClick={() => onDone(rubric)} disabled={!!busy}>Next <ChevronRight size={18} {...ICON} /></Primary>
          </>
        ) : (
          <>
            <Secondary onClick={() => onDone(null)} style={{ flex: 1 }}>Skip this one</Secondary>
            <Primary onClick={() => fileRef.current?.click()} style={{ flex: 2 }}><Camera size={19} {...ICON} /> Photograph my answer</Primary>
          </>
        )}
      </div>
    </div>
  )
}

/* ── format: teach back ───────────────────────────────────────────────────── */

interface TeachResult { score: number; verdict: string; gotRight: string[]; missed: Array<{ point: string; reasoning: string }> }

function TeachFormat({ question, onDone }: { question: string; onDone: (r: TeachResult | null, said?: string) => void }) {
  const [said, setSaid] = useState('')
  const [listening, setListening] = useState(false)
  const [result, setResult] = useState<TeachResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [level, setLevel] = useState(0)
  const recRef = useRef<any>(null)
  const hasSTT = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

  useEffect(() => {
    if (!listening) { setLevel(0); return }
    const id = setInterval(() => setLevel(Math.random()), 120)
    return () => clearInterval(id)
  }, [listening])

  function toggle() {
    if (listening) { try { recRef.current?.stop() } catch { /* ignore */ } setListening(false); return }
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    try {
      const rec = new SR()
      rec.lang = 'en-IN'; rec.continuous = true; rec.interimResults = true
      rec.onresult = (ev: any) => {
        let t = ''
        for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript + ' '
        setSaid(t.trim())
      }
      rec.onerror = () => setListening(false)
      rec.onend = () => setListening(false)
      rec.start(); recRef.current = rec; setListening(true)
    } catch { setListening(false) }
  }

  async function grade() {
    const transcript = said.trim()
    if (!transcript) return
    setBusy(true); setNote('')

    // SAVE FIRST, GRADE SECOND. A student who speaks for a minute and loses it
    // to a failed request does not come back. The transcript is theirs from
    // the moment they stop talking, whether or not the grader answers.
    try {
      saveToNotebook({
        kind: 'note',
        title: `Teach-back · ${String(question).slice(0, 60)}`,
        content: transcript,
        subject: null,
        tags: [],
        source: 'teach-back',
      })
    } catch { /* storage full or blocked: grading still gets its chance */ }

    try {
      const prof = getProfile() as any
      const r = await post('/practice/teachback', { question, transcript, class: prof?.cls || '10' })
      setResult(r)
    } catch (e: any) {
      // Name the step, promise the recovery, and carry the reference id so a
      // report can be matched to the server log.
      const ref = e?.ref ? ` (ref ${e.ref})` : ''
      setNote(`Could not grade your answer${ref} — what you said is saved in Notes. ${studentMessage(e)}`)
    } finally { setBusy(false) }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 8px' }}>
        <Eyebrow>Explain it like I am your friend</Eyebrow>
        <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.4, color: T.text, marginTop: 8 }}>{question}</div>

        <Card style={{ marginTop: 16 }}>
          <Eyebrow color={T.muted}>You said</Eyebrow>
          {hasSTT ? (
            <div style={{ fontSize: 14, lineHeight: 1.65, color: said ? T.text2 : T.faint, marginTop: 8, minHeight: 48 }}>
              {said || (listening ? 'Listening…' : 'Tap the mic and explain it in your own words. Hinglish is fine.')}
            </div>
          ) : (
            <textarea value={said} onChange={e => setSaid(e.target.value)} rows={4}
              placeholder="No microphone here — type your explanation. Your own words, any language mix."
              style={{ width: '100%', marginTop: 8, background: T.well, border: `1px solid ${T.borderCtl}`, borderRadius: 12, color: T.text2, fontFamily: FONT, fontSize: 16, lineHeight: 1.6, padding: 10, resize: 'vertical', boxSizing: 'border-box' }} />
          )}
        </Card>

        {hasSTT && (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center', height: 34, marginTop: 14 }}>
            {Array.from({ length: 12 }).map((_, i) => {
              const active = listening && Math.abs(i - 5.5) / 6 < level
              return <div key={i} style={{ width: 3, borderRadius: 2, height: active ? 10 + Math.round(level * 18) : 8, background: active ? T.accent : T.dashed, transition: 'height .1s' }} />
            })}
          </div>
        )}

        {result && (
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{result.verdict}</div>
            {result.gotRight.map((g, i) => (
              <div key={`g${i}`} style={{ padding: 13, borderRadius: 16, background: T.surface, border: `1px solid ${T.successBorder}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: T.success, fontSize: 12, fontWeight: 700, letterSpacing: 0.6 }}><Check size={14} {...ICON} /> YOU GOT THIS</div>
                <div style={{ fontSize: 13.5, color: T.text2, lineHeight: 1.5, marginTop: 6 }}>{g}</div>
              </div>
            ))}
            {result.missed.map((m, i) => (
              <div key={`m${i}`} style={{ padding: 13, borderRadius: 16, background: T.surface, border: `1px solid ${T.warningBorder}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: T.warning, fontSize: 12, fontWeight: 700, letterSpacing: 0.6 }}><AlertTriangle size={14} {...ICON} /> {m.point.toUpperCase()}</div>
                <div style={{ fontSize: 13.5, color: T.text2, lineHeight: 1.55, marginTop: 6 }}>{m.reasoning}</div>
              </div>
            ))}
          </div>
        )}

        {note && <div style={{ marginTop: 12 }}><Inline message={note} onRetry={grade} /></div>}
      </div>

      <div style={{ padding: '12px 14px calc(12px + env(safe-area-inset-bottom))', borderTop: `1px solid ${T.divider}`, background: T.bgAlt, display: 'flex', gap: 12, alignItems: 'center' }}>
        {hasSTT && !result && (
          <button onClick={toggle} aria-label={listening ? 'Stop' : 'Speak'} style={{
            width: 62, height: 62, borderRadius: '50%', flexShrink: 0, border: 'none', cursor: 'pointer',
            background: listening ? T.error : T.accent, display: 'grid', placeItems: 'center',
            boxShadow: `0 6px 18px ${listening ? 'rgba(224,112,90,.35)' : 'rgba(124,92,255,.35)'}`,
          }}><Mic size={24} color="#fff" {...ICON} /></button>
        )}
        {result
          ? <Primary onClick={() => onDone(result, said)}>Next <ChevronRight size={18} {...ICON} /></Primary>
          : said.trim()
            ? <Primary onClick={grade} disabled={busy}>{busy ? <Loader2 size={18} {...ICON} /> : null} Good enough, grade it</Primary>
            : <Secondary onClick={() => onDone(null)} style={{ flex: 1, height: 54 }}>Skip this one</Secondary>}
      </div>
    </div>
  )
}

/* ── the mock room ────────────────────────────────────────────────────────── */

function MockRoom({ subject, onExit }: { subject: string; onExit: () => void }) {
  const [phase, setPhase] = useState<'building' | 'live' | 'done'>('building')
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [flags, setFlags] = useState<Set<number>>(new Set())
  const [i, setI] = useState(0)
  const [palette, setPalette] = useState(false)
  const [err, setErr] = useState('')
  const TOTAL_MS = 40 * 60_000
  const [startedAt] = useState(Date.now())
  const [now, setNow] = useState(Date.now())
  const TARGET = 20

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])

  // The honest lockout. Doubt Solving, hints and the solver are unreachable
  // while this flag is up -- see the guard in Dashboard.
  useEffect(() => {
    try { (window as any).__kynoExamLock = true } catch { /* ignore */ }
    return () => { try { delete (window as any).__kynoExamLock } catch { /* ignore */ } }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const prof = getProfile() as any
      try {
        const r = await post('/quiz/start', {
          school_id: 'demo_school', subject, topic: '',
          class: String(prof?.cls || '10').replace(/\D/g, '') || '10', board: prof?.board || 'CBSE',
          difficulty: 'medium', total_questions: TARGET,
        })
        const qs: ExamQuestion[] = []
        for (const raw of (r.questions || [])) {
          const opts = (raw.options || []).map((o: string) => cleanOption(o))
          const ci = (raw.options || []).findIndex((o: string) => o.charAt(0) === raw.correct)
          if (opts.length >= 2 && ci >= 0) qs.push({ q: raw.question, options: opts, correctIndex: ci, explanation: raw.explanation || null, subject, topic: raw.topic || null, difficulty: raw.difficulty || 'medium' })
        }
        if (cancelled) return
        if (qs.length < 6) throw new Error('Could not build enough questions — try again in a minute.')
        setQuestions(qs); setAnswers(Array(qs.length).fill(null)); setPhase('live')
      } catch (e: any) { if (!cancelled) setErr(studentMessage(e)) }
    })()
    return () => { cancelled = true }
  }, [subject])

  const msLeft = Math.max(0, TOTAL_MS - (now - startedAt))
  useEffect(() => { if (phase === 'live' && msLeft === 0) setPhase('done') }, [msLeft, phase])

  const states = paletteStates(questions.length, answers, flags)
  const q = questions[i]

  function submit() {
    const score = scorePaper(questions, answers, { correct: 1, wrong: 0 })
    questions.forEach((qq, k) => {
      const a = answers[k]; if (a == null) return
      try { track({ type: 'quiz_answered', subject: qq.subject || undefined, topic: qq.topic || undefined, correct: a === qq.correctIndex, score: a === qq.correctIndex ? 100 : 0, modality: 'interactive', payload: a === qq.correctIndex ? { mock: true, q: qq.q } : { mock: true, source: 'mock', q: qq.q, options: qq.options, correctIndex: qq.correctIndex, chosenIndex: a, explanation: qq.explanation || undefined } }) } catch { /* nicety */ }
    })
    try { track({ type: 'quiz_completed', subject, score: Math.round((score.marks / Math.max(1, score.maxMarks)) * 100), payload: { mock: true, practice: true } }) } catch { /* nicety */ }
    setPhase('done')
  }

  const shell: Style = { position: 'absolute', inset: 0, background: T.exam, color: T.text, fontFamily: FONT, display: 'flex', flexDirection: 'column' }

  if (phase === 'building') return (
    <div style={shell}>
      <Chrome label={`${subject.toUpperCase()} MOCK`} msLeft={TOTAL_MS} progress={0} onClose={onExit} exam />
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 20 }}>
        {err ? <div style={{ width: '100%' }}><Inline message={err} onRetry={onExit} /></div>
             : <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: T.muted, fontSize: 13 }}><Loader2 size={16} {...ICON} /> Setting the paper…</div>}
      </div>
    </div>
  )

  if (phase === 'done') {
    const score = scorePaper(questions, answers, { correct: 1, wrong: 0 })
    return (
      <div style={shell}>
        <Chrome label="PAPER SUBMITTED" msLeft={0} progress={1} onClose={onExit} exam />
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          <Eyebrow color={T.warning}>Mock · {subject}</Eyebrow>
          <div style={{ fontSize: 44, fontWeight: 700, marginTop: 8 }}>{score.marks} <span style={{ fontSize: 18, color: T.faint, fontWeight: 600 }}>/ {score.maxMarks}</span></div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 6 }}>Kyno is unlocked again. Every wrong answer is in your Mistake Museum.</div>
          <div style={{ marginTop: 22 }}><Primary onClick={onExit}>Back to Practice</Primary></div>
        </div>
      </div>
    )
  }

  return (
    <div style={shell}>
      <Chrome label={`${subject.toUpperCase()} MOCK · Q ${i + 1} of ${questions.length}`} msLeft={msLeft} progress={0} onClose={submit} exam />
      <div style={{ display: 'flex', gap: 2, padding: '8px 14px 0' }}>
        {states.map((s, k) => (
          <div key={k} style={{ flex: 1, height: 3, borderRadius: 1, background: k === i ? T.accent : s === 'done' ? T.success : s === 'flag' ? T.warning : T.unseen }} />
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.text2, background: T.surface, border: `1px solid ${T.borderExam}`, borderRadius: 100, padding: '5px 10px' }}>1 mark</span>
          <button onClick={() => setFlags(f => { const n = new Set(f); n.has(i) ? n.delete(i) : n.add(i); return n })} style={{
            display: 'flex', gap: 6, alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT,
            color: flags.has(i) ? T.warning : T.muted, fontSize: 12.5, fontWeight: 600, minHeight: 44,
          }}><Flag size={15} {...ICON} /> Mark for review</button>
        </div>
        <MathText text={q?.q} style={{ fontSize: 16.5, lineHeight: 1.6, color: T.text, marginTop: 10 }} />
        <div style={{ display: 'grid', gap: 9, marginTop: 16 }}>
          {q?.options.map((opt, k) => {
            const on = answers[i] === k
            return (
              <button key={k} onClick={() => setAnswers(a => { const n = a.slice(); n[i] = k; return n })} style={{
                display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left', padding: '12px 13px', minHeight: 48, fontFamily: FONT,
                background: on ? T.accentSurface : T.surface, border: `1px solid ${on ? T.accent : T.border}`, borderRadius: 14, cursor: 'pointer',
              }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', border: `1.5px solid ${on ? T.accent : '#3A3A50'}`, background: on ? T.accent : 'transparent', color: on ? '#fff' : T.muted, fontSize: 12, fontWeight: 700 }}>{'ABCD'[k]}</span>
                <span style={{ fontFamily: MONO, fontSize: 13.5, color: on ? '#fff' : T.text2, lineHeight: 1.45 }}>{opt}</span>
              </button>
            )
          })}
        </div>

        <div style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'center', padding: 12, borderRadius: 14, background: T.well, border: `1px solid ${T.divider}` }}>
          <Lock size={15} color={T.faint} {...ICON} />
          <div style={{ fontSize: 12.5, color: T.dim }}>Kyno is locked until you submit — exam conditions</div>
        </div>
      </div>

      {palette && (
        <div onClick={() => setPalette(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(5,5,12,.7)', display: 'flex', alignItems: 'flex-end', zIndex: 30 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: T.sheet, borderRadius: '26px 26px 0 0', padding: '18px 18px calc(18px + env(safe-area-inset-bottom))' }}>
            <Eyebrow color={T.muted}>Question palette</Eyebrow>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8, marginTop: 12 }}>
              {states.map((s, k) => (
                <button key={k} onClick={() => { setI(k); setPalette(false) }} style={{
                  height: 38, borderRadius: 10, fontFamily: MONO, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  background: k === i ? T.accent : s === 'done' ? T.successBg : s === 'flag' ? T.warningBg : T.surface,
                  border: `1px solid ${k === i ? T.accent : s === 'done' ? T.successBorder : s === 'flag' ? T.warningBorder : T.border}`,
                  color: k === i ? '#fff' : T.text2,
                }}>{k + 1}</button>
              ))}
            </div>
            <div style={{ marginTop: 16 }}><Primary onClick={submit} style={{ background: T.warning, color: '#0B0B14' }}>Submit paper</Primary></div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, padding: '12px 14px calc(12px + env(safe-area-inset-bottom))', borderTop: `1px solid ${T.borderExam}`, background: T.exam }}>
        <button onClick={() => setI(k => Math.max(0, k - 1))} aria-label="Previous" style={{ width: 54, height: 54, borderRadius: 14, background: T.surface, border: `1px solid ${T.borderExam}`, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><ArrowLeft size={19} color={T.muted} {...ICON} /></button>
        <button onClick={() => setPalette(true)} aria-label="Palette" style={{ width: 54, height: 54, borderRadius: 14, background: T.surface, border: `1px solid ${T.borderExam}`, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Grid3x3 size={19} color={T.muted} {...ICON} /></button>
        <Primary onClick={() => i < questions.length - 1 ? setI(i + 1) : setPalette(true)} style={{ background: T.surface, color: T.text, border: `1px solid ${T.borderExam}` }}>Save & next</Primary>
      </div>
    </div>
  )
}

/* ── the page ─────────────────────────────────────────────────────────────── */

type View = 'home' | 'formats' | 'session' | 'results' | 'mock'

export default function Practice({ onOpenDoubt }: { onOpenDoubt?: (seed: string) => void }) {
  const [view, setView] = useState<View>('home')
  const layout = useSpaceLayout()   // desktop: the session stays a 480px column, centred vertically
  // A live session must survive a trip to another space and back.
  useEffect(() => (view === 'session' || view === 'mock' ? keepPageMounted('practice') : undefined), [view])
  const [minutes, setMinutes] = useState(15)
  const [plan, setPlan] = useState<SessionPlan | null>(null)
  const [items, setItems] = useState<SessionItem[]>([])
  const [idx, setIdx] = useState(0)
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [qLoading, setQLoading] = useState(false)
  const [qNote, setQNote] = useState('')
  const [before, setBefore] = useState<any[]>([])
  const [touched, setTouched] = useState<string[]>([])
  const [stats, setStats] = useState({ cards: 0, questions: 0, correct: 0, retained: 0, written: 0, teach: 0 })
  const [mockSubject, setMockSubject] = useState('Science')
  const [tick, setTick] = useState(0)
  /** From Performance: drill these signatures/topics instead of the default target. */
  const [filter, setFilter] = useState<{ signatures?: string[]; topics?: string[]; cardIds?: string[] } | null>(null)
  useEffect(() => {
    const on = (e: Event) => {
      const f = (e as CustomEvent)?.detail
      if (f && (f.signatures?.length || f.topics?.length || f.cardIds?.length)) { setFilter(f); setView('home') }
    }
    window.addEventListener('kyno:practice-filter', on)
    return () => window.removeEventListener('kyno:practice-filter', on)
  }, [])

  const cards = useMemo(() => { try { return listFlashcards() } catch { return [] } }, [view, tick])
  const mistakes = useMemo(() => { try { return getMistakes() } catch { return [] } }, [view, tick])
  const mastery = useMemo(() => { try { return loadState().mastery } catch { return [] } }, [view, tick])
  const events = useMemo(() => { try { return loadState().events } catch { return [] } }, [view, tick])

  // A filter narrows the mistake rows the builder targets, so "Drill this
  // pattern" produces questions on THAT topic rather than the overall worst.
  const targetedMistakes = useMemo(() => {
    if (!filter?.topics?.length) return mistakes
    const want = new Set(filter.topics.map(t => String(t).toLowerCase()))
    const hit = mistakes.filter(m => want.has(String(m.topic).toLowerCase()))
    return hit.length ? hit : mistakes
  }, [mistakes, filter])
  // "Review" from Notes hands over exactly the cards that are due from saved
  // notes; the session is built from those and nothing else.
  const targetedCards = useMemo(() => {
    if (!filter?.cardIds?.length) return cards
    const want = new Set(filter.cardIds)
    const hit = cards.filter(c => want.has(c.id))
    return hit.length ? hit : cards
  }, [cards, filter])
  const preview = useMemo(() => buildSession({ minutes, cards: targetedCards, mistakes: targetedMistakes, mastery }), [minutes, targetedCards, targetedMistakes, mastery])

  const exam = useMemo(() => {
    const days = nearestExamDays()
    if (days == null) return null
    let name = 'Exam'
    try {
      const p = getJSON<{ examDates?: Array<{ name?: string; date?: string }> }>('kyno:student_profile')
      const soon = (p?.examDates || []).map(e => ({ n: e?.name, t: Date.parse(e?.date || '') })).filter(e => Number.isFinite(e.t) && e.t > Date.now() - 86400000).sort((a, b) => a.t - b.t)[0]
      if (soon?.n) name = soon.n
    } catch { /* ignore */ }
    const last = (events as any[]).filter(e => e?.type === 'quiz_completed' && e?.payload?.mock && typeof e.score === 'number').sort((a, b) => b.ts - a.ts)[0]
    return { name, days, last: last ? Math.round(last.score) : null }
  }, [events])

  useEffect(() => {
    if (view !== 'session') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [view])

  const msLeft = Math.max(0, (plan?.minutes || 0) * 60_000 - (now - startedAt))

  // Running out of items ends the session. This used to be a finish() call
  // inside render -- setState during render, which React tolerates right up
  // until it does not. A rebuildWithout() that drops the last remaining items
  // is exactly the path that hits it.
  useEffect(() => {
    if (view === 'session' && items.length > 0 && idx >= items.length) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, items, idx])

  // A question item with nothing behind it, once loading is over, is skipped
  // rather than spun on. trimQuestions() above should make this unreachable;
  // this is the net under it.
  useEffect(() => {
    if (view !== 'session' || qLoading) return
    const it = items[idx]
    if (it?.kind !== 'question') return
    const qi = items.slice(0, idx).filter(x => x.kind === 'question').length
    if (!questions[qi]) setItems(cur => rebuildWithout(cur, 'question', idx))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, qLoading, items, idx, questions])

  /* ── start ── */
  function start(p: SessionPlan) {
    setPlan(p); setItems(p.items); setIdx(0); setStartedAt(Date.now()); setNow(Date.now())
    setBefore(JSON.parse(JSON.stringify(mastery))); setTouched([])
    setStats({ cards: 0, questions: 0, correct: 0, written: 0, teach: 0 })
    setQuestions([]); setQNote('')
    try { track({ type: 'session_start', payload: { practice: true, minutes: p.minutes } }) } catch { /* nicety */ }
    setView('session')
    const nQ = p.counts.questions
    if (nQ > 0) loadQuestions(nQ, p.target?.topic || '', p.target?.subject || 'Science')
  }

  // #/grader and #/essay open the format picker, where the written format is.
  // Never yank a student out of a running session to honour a redirect.
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (d?.space !== 'practice') return
      // A MOCK is the one thing a redirect may not interrupt -- it is an exam
      // under a real lockout, and the app already refuses to leave it.
      // Anything else honours the navigation: the student asked for a quiz, so
      // give them a quiz. Holding them in an abandoned session instead is how
      // a redirect silently does nothing, which is the bug being fixed.
      if (view === 'mock' || (window as any).__kynoExamLock) return
      const t = preview.target
      // Each old route opens the FORMAT it used to be, not the Practice index:
      // Adaptive Quiz was questions, Exam Hall was the mock, Teach Back was
      // speaking it back, Revision Simulator was a mixed run.
      if (d.view === 'quiz') start({ ...preview, items: Array.from({ length: 8 }, () => ({ kind: 'question' as const, topic: t?.topic || null, subject: t?.subject || null })), counts: { cards: 0, questions: 8, written: 0, teach: 0 } })
      else if (d.view === 'teachback') start({ ...preview, items: [{ kind: 'teach', topic: t?.topic || null, subject: t?.subject || null }], counts: { cards: 0, questions: 0, written: 0, teach: 1 } })
      else if (d.view === 'simulator') start(preview)
      else if (['home', 'formats', 'mock'].includes(d.view)) setView(d.view)
    }
    window.addEventListener(SPACE_VIEW_EVENT, on)
    return () => window.removeEventListener(SPACE_VIEW_EVENT, on)
  }, [view, preview, items, idx])

  async function loadQuestions(n: number, topic: string, subject: string) {
    setQLoading(true); setQNote('')
    try {
      const prof = getProfile() as any
      const r = await post('/quiz/start', {
        school_id: 'demo_school', subject, topic,
        class: String(prof?.cls || '10').replace(/\D/g, '') || '10', board: prof?.board || 'CBSE',
        difficulty: 'medium', total_questions: Math.min(15, Math.max(3, n)),
      })
      const qs: ExamQuestion[] = []
      for (const raw of (r.questions || [])) {
        const opts = (raw.options || []).map((o: string) => cleanOption(o))
        const ci = (raw.options || []).findIndex((o: string) => o.charAt(0) === raw.correct)
        if (opts.length >= 2 && ci >= 0) qs.push({ q: raw.question, options: opts, correctIndex: ci, explanation: raw.explanation || null, subject, topic: raw.topic || topic || null, difficulty: raw.difficulty || 'medium' })
      }
      setQuestions(qs)
      // Fewer than planned is the common case, not the error case.
      setItems(it => trimQuestions(it, qs.length))
    } catch (e: any) {
      // Questions unavailable: drop the format, keep the session. The student
      // sees a shorter session, not an error.
      setQNote(studentMessage(e))
      setItems(it => rebuildWithout(it, 'question', idx))
    } finally { setQLoading(false) }
  }

  function advance() {
    if (idx + 1 >= items.length) finish()
    else setIdx(idx + 1)
  }

  function finish() {
    const s = stats
    // xpFor mirrors the published table for the results screen; the cards and
    // written answers were credited as they happened, this is the session itself.
    const xp = xpFor({ ...s, finished: true })
    try { awardXP('session_done') } catch { /* nicety */ }
    try { track({ type: 'session_end', payload: { practice: true, ...s, xp } }) } catch { /* nicety */ }
    setTick(t => t + 1)
    setView('results')
  }

  /* ── per-format handlers ── */
  function gradeCard(card: any, rating: 1 | 2 | 3 | 4) {
    try { reviewFlashcard(card.id, rating, { daysToExam: nearestExamDays() }) } catch { /* nicety */ }
    if (card?.topic) setTouched(t => [...t, card.topic])
    setStats(s => ({ ...s, cards: s.cards + 1, correct: s.correct + (rating >= 3 ? 1 : 0), retained: (s.retained || 0) + (rating >= 3 ? 1 : 0) }))
    if (rating >= 3) { try { awardXP('card_retained') } catch { /* nicety */ } }   // Good or Easy: the card was kept
    advance()
  }

  function answerQuestion(q: ExamQuestion, correct: boolean, chosen: number) {
    try { track({ type: 'quiz_answered', subject: q.subject || undefined, topic: q.topic || undefined, correct, score: correct ? 100 : 0, modality: 'interactive', payload: correct ? { practice: true, q: q.q } : { practice: true, source: 'quiz', q: q.q, options: q.options, correctIndex: q.correctIndex, chosenIndex: chosen, explanation: q.explanation || undefined } }) } catch { /* nicety */ }
    if (q.topic) setTouched(t => [...t, String(q.topic)])
    setStats(s => ({ ...s, questions: s.questions + 1, correct: s.correct + (correct ? 1 : 0) }))
    setTimeout(advance, 900)
  }

  /* ── render ── */
  const shell: Style = { position: 'absolute', inset: 0, background: T.bg, color: T.text, fontFamily: FONT, display: 'flex', flexDirection: 'column', overflow: 'hidden' }

  if (view === 'mock') return <MockRoom subject={mockSubject} onExit={() => { setTick(t => t + 1); setView('home') }} />

  /* home ------------------------------------------------------------------ */
  if (view === 'home' || view === 'formats') {
    return (
      <div style={shell}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 14px 24px' }}>
          {view === 'formats' ? (
            <>
              <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', color: T.muted, fontFamily: FONT, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0, marginBottom: 14, minHeight: 44 }}><ArrowLeft size={17} {...ICON} /> Back</button>
              <Eyebrow>Pick a format</Eyebrow>
              <h1 style={{ fontSize: 25, fontWeight: 700, margin: '8px 0 16px', letterSpacing: -0.3 }}>You know what you want.</h1>
              <div style={{ display: 'grid', gap: 10 }}>
                {[
                  { k: 'card', label: 'Flashcards', sub: `${preview.counts.cards || 0} due`, run: () => start({ ...preview, items: preview.items.filter(i => i.kind === 'card'), counts: { ...preview.counts, questions: 0, written: 0, teach: 0 } }) },
                  { k: 'question', label: 'Questions', sub: preview.target?.topic ? `on ${preview.target.topic}` : 'mixed', run: () => start({ ...preview, items: Array.from({ length: 8 }, () => ({ kind: 'question' as const, topic: preview.target?.topic || null, subject: preview.target?.subject || null })), counts: { cards: 0, questions: 8, written: 0, teach: 0 } }) },
                  { k: 'written', label: 'Written answer', sub: 'photograph and get step-marked', run: () => start({ ...preview, items: [{ kind: 'written', topic: preview.target?.topic || null, subject: preview.target?.subject || null }], counts: { cards: 0, questions: 0, written: 1, teach: 0 } }) },
                  { k: 'teach', label: 'Teach it back', sub: 'explain out loud', run: () => start({ ...preview, items: [{ kind: 'teach', topic: preview.target?.topic || null, subject: preview.target?.subject || null }], counts: { cards: 0, questions: 0, written: 0, teach: 1 } }) },
                ].map(f => {
                  const Icon = KIND_ICON[f.k as keyof typeof KIND_ICON]
                  return (
                    <Card key={f.k} onClick={f.run}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ width: 38, height: 38, borderRadius: 12, background: T.accentSurface, display: 'grid', placeItems: 'center' }}><Icon size={17} color={T.accentPale} {...ICON} /></div>
                        <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{f.label}</div><div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>{f.sub}</div></div>
                        <ChevronRight size={17} color={T.fainter} {...ICON} />
                      </div>
                    </Card>
                  )
                })}
                <Card onClick={() => setView('mock')} style={{ background: T.exam, border: `1px solid ${T.borderExam}` }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, background: T.warningBg, display: 'grid', placeItems: 'center' }}><Clock size={17} color={T.warning} {...ICON} /></div>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>Full mock</div><div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>Exam conditions · Kyno locked</div></div>
                    <ChevronRight size={17} color={T.fainter} {...ICON} />
                  </div>
                </Card>
              </div>
            </>
          ) : (
            <>
              <Eyebrow>Practice</Eyebrow>
              <h1 style={{ fontSize: 25, fontWeight: 700, margin: '8px 0 0', letterSpacing: -0.3 }}>How long have you got?</h1>
              {filter && (
                <button onClick={() => setFilter(null)} style={{
                  marginTop: 12, height: 34, padding: '0 12px', borderRadius: 100, background: T.accentSurface,
                  border: `1px solid ${T.accent}`, color: T.accentPale, fontSize: 12.5, fontWeight: 600, fontFamily: FONT,
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
                }}>
                  {filter.cardIds?.length ? `Reviewing ${filter.cardIds.length} cards from your notes` : `Drilling: ${(filter.topics || filter.signatures || []).slice(0, 2).join(', ')}`} <X size={14} {...ICON} />
                </button>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 18 }}>
                {BUDGETS.map(m => {
                  const on = m === minutes
                  return (
                    <button key={m} onClick={() => setMinutes(m)} style={{
                      height: 78, borderRadius: 16, cursor: 'pointer', fontFamily: FONT,
                      background: on ? T.accentSurface : T.surface, border: `1px solid ${on ? T.accent : T.borderCtl}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                    }}>
                      <span style={{ fontSize: 26, fontWeight: 700, color: on ? '#fff' : T.muted }}>{m}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: on ? T.accentPale : T.faint, letterSpacing: 0.4 }}>minutes</span>
                    </button>
                  )
                })}
              </div>

              <Card style={{ marginTop: 14, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 14px 6px' }}><Eyebrow color={T.muted}>Kyno will build you</Eyebrow></div>
                <div style={{ padding: '4px 14px 12px', display: 'grid', gap: 10 }}>
                  {preview.preview.map(r => {
                    const Icon = KIND_ICON[r.kind]
                    return (
                      <div key={r.kind} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: T.accentSurface, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon size={15} color={T.accentPale} {...ICON} /></div>
                        <div style={{ flex: 1, fontSize: 14, color: T.text }}>{r.label}</div>
                        <div style={{ fontSize: 12.5, color: T.dim, fontVariantNumeric: 'tabular-nums' }}>{r.minutes} min</div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ height: 1, background: T.divider }} />
                <div style={{ padding: '11px 14px 13px', fontSize: 12, color: T.dim, lineHeight: 1.5 }}>Built from what is due and where you are weakest — you pick the time, Kyno picks the format.</div>
              </Card>

              <div style={{ marginTop: 14 }}><Primary onClick={() => start(preview)}>Start {minutes} minutes <ChevronRight size={18} {...ICON} /></Primary></div>

              {exam && (
                <Card onClick={() => setView('mock')} style={{ marginTop: 14, background: 'linear-gradient(135deg, #2A1A16, #15151F)', border: '1px solid #4A2E20' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, background: T.warningBg, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Clock size={17} color={T.warning} {...ICON} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{exam.name} in {exam.days} day{exam.days === 1 ? '' : 's'}</div>
                      <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>Full mock · 40 min{exam.last != null ? ` · last scored ${exam.last}%` : ''}</div>
                    </div>
                    <ChevronRight size={17} color={T.fainter} {...ICON} />
                  </div>
                </Card>
              )}

              <button onClick={() => setView('formats')} style={{ display: 'block', margin: '20px auto 0', background: 'none', border: 'none', color: T.dim, fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', minHeight: 44 }}>Pick a format myself</button>
            </>
          )}
        </div>
      </div>
    )
  }

  /* results --------------------------------------------------------------- */
  if (view === 'results') {
    const rows: MovementRow[] = movementRows(before, mastery, touched)
    const weak = mistakes.slice(0, 3).map(m => m.topic)
    const h = resultsHeadline(rows, weak)
    const pct = stats.cards + stats.questions ? Math.round((stats.correct / (stats.cards + stats.questions)) * 100) : 0
    const xp = xpFor({ ...stats, finished: true })
    const nudge = flatTopicNudge(rows)
    const due = (() => { try { return listFlashcards().filter(c => c.dueAt <= Date.now() + 86400000 && c.dueAt > Date.now()).length } catch { return 0 } })()
    const mins = Math.max(1, Math.round((Date.now() - startedAt) / 60000))

    return (
      <div style={shell}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 14px 24px' }}>
          <Eyebrow color={T.success}>Session done · {mins} min</Eyebrow>
          <h1 style={{ fontSize: 25, fontWeight: 700, margin: '8px 0 0', letterSpacing: -0.3 }}>{h.headline}</h1>
          {h.sub && <div style={{ fontSize: 14, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>{h.sub}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 18 }}>
            {[
              { v: String(stats.cards), l: 'cards cleared', c: T.text },
              { v: `${pct}%`, l: 'correct', c: T.success },
              { v: `+${xp}`, l: 'XP earned', c: T.accentPale },
            ].map(t => (
              <Card key={t.l} style={{ textAlign: 'center', padding: '14px 8px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: t.c }}>{t.v}</div>
                <div style={{ fontSize: 11, color: T.faint, marginTop: 3 }}>{t.l}</div>
              </Card>
            ))}
          </div>

          {rows.length > 0 && (
            <Card style={{ marginTop: 14 }}>
              <Eyebrow color={T.muted}>What shifted</Eyebrow>
              <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                {rows.map(r => (
                  <div key={r.topic}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                      <span style={{ color: T.text, textTransform: 'capitalize' }}>{r.topic}</span>
                      <span style={{ color: r.moved ? T.success : T.flat, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{r.label}</span>
                    </div>
                    <div style={{ position: 'relative', height: 6, borderRadius: 3, background: r.moved ? T.successDim : T.barFlat, marginTop: 7, overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', inset: 0, width: `${r.moved ? r.to : r.from}%`, background: r.moved ? T.success : T.barFlat, borderRadius: 3 }} />
                      {r.moved && <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${r.from}%`, background: T.successDim }} />}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            {due > 0 && (
              <Card style={{ background: 'linear-gradient(135deg, #1A1430, #15151F)', border: '1px solid #2E2450' }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{due} card{due === 1 ? '' : 's'} come back tomorrow</div>
                <div style={{ fontSize: 12, color: T.accentPale, marginTop: 3 }}>Timed to just before you would forget</div>
              </Card>
            )}
            {nudge && (
              <Card onClick={() => start({ minutes: 15, items: [{ kind: 'teach', topic: nudge.topic, subject: null }], counts: { cards: 0, questions: 0, written: 0, teach: 1 }, target: { topic: nudge.topic, subject: null, why: 'mastery' }, estimatedMinutes: 2, preview: [] })}
                    style={{ background: 'linear-gradient(135deg, #2A1A16, #15151F)', border: `1px solid ${T.warningBorder}` }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{nudge.headline}</div>
                <div style={{ fontSize: 12, color: T.warning, marginTop: 3 }}>{nudge.detail}</div>
              </Card>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '12px 14px calc(12px + env(safe-area-inset-bottom))', borderTop: `1px solid ${T.divider}`, background: T.bgAlt }}>
          <Secondary onClick={() => setView('home')} style={{ flex: 1, height: 54 }}>Done for today</Secondary>
          <Primary onClick={() => start(buildSession({ minutes: 5, cards: listFlashcards(), mistakes, mastery }))} style={{ flex: 1 }}>Another 5 min</Primary>
        </div>
      </div>
    )
  }

  /* session --------------------------------------------------------------- */
  const item = items[idx]
  const done = items.length ? idx / items.length : 0
  const kindCount = items.filter((it, k) => k <= idx && it.kind === item?.kind).length
  const kindTotal = items.filter(it => it.kind === item?.kind).length
  const label = item?.kind === 'card' ? `Card ${kindCount} of ${kindTotal}` : item?.kind === 'question' ? `Question ${kindCount} of ${kindTotal}` : item?.kind === 'written' ? 'Written answer' : 'Teach back'

  // An empty shell here is an invisible failure: the student sees a header and
  // a void, with nothing to report and nothing to press. Say what happened.
  if (!item) return (
    <div style={shell}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>This session came out empty.</div>
        <div style={{ fontSize: 13.5, color: T.dim, lineHeight: 1.55, maxWidth: 300 }}>
          Kyno had nothing due and nothing to build from yet. Answer a few questions or save a note, and there will be.
        </div>
        <Primary style={{ maxWidth: 240, marginTop: 4 }} onClick={() => { setItems([]); setIdx(0); setView('home') }}>Back to Practice</Primary>
      </div>
    </div>
  )

  const qIndex = items.slice(0, idx).filter(it => it.kind === 'question').length
  const q = questions[qIndex]

  return (
    <div style={layout.bp === 'desktop' ? { ...shell, justifyContent: 'center' } : shell}>
      {/* Desktop: one session card of at most 760px tall, in the vertical
          middle of the 480px column. Never stretch a flashcard across a laptop. */}
      <div style={layout.bp === 'desktop'
        ? { display: 'flex', flexDirection: 'column', flex: '0 1 760px', minHeight: 0, border: `1px solid ${T.border}`, borderRadius: 22, overflow: 'hidden', background: T.bg }
        : { display: 'contents' }}>
      <Chrome label={label} msLeft={msLeft} progress={done} onClose={finish} />
      {item.kind === 'card' && (
        <FlashcardFormat
          card={item.card}
          missLine={lastMissLine(item.card, events as any)}
          onGrade={r => gradeCard(item.card, r)}
          onAsk={() => onOpenDoubt?.(`Help me understand this flashcard:\n\nQ: ${item.card.front}\nA: ${item.card.back}`)}
        />
      )}
      {item.kind === 'question' && (
        qLoading || !q
          ? <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 20 }}>
              {qNote
                ? <div style={{ width: '100%' }}><Inline message="Questions are unavailable right now — carrying on with the rest of your session." /><div style={{ marginTop: 12 }}><Primary onClick={advance}>Continue</Primary></div></div>
                : <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: T.muted, fontSize: 13 }}><Loader2 size={16} {...ICON} /> Writing your questions…</div>}
            </div>
          : <QuestionFormat q={q} onAnswer={(c, i) => answerQuestion(q, c, i)} />
      )}
      {item.kind === 'written' && (
        <WrittenFormat
          question={`Explain and solve, showing every step: a ${item.topic || 'numerical'} problem of the kind that appears in your board exam.`}
          marks={5}
          onDone={r => { if (r) { setStats(s => ({ ...s, written: s.written + 1 })); try { awardXP('written_graded') } catch { /* nicety */ } } if (item.topic) setTouched(t => [...t, item.topic!]); advance() }}
        />
      )}
      {item.kind === 'teach' && (
        <TeachFormat
          question={item.topic ? `Why does ${item.topic} work the way it does?` : 'Explain the last thing you learned, as if to a friend.'}
          onDone={(r, said) => {
            if (r) {
              setStats(s => ({ ...s, teach: s.teach + 1 })); if (item.topic) setTouched(t => [...t, item.topic!])
              try { awardXP('written_graded') } catch { /* nicety */ }   // a graded teach-back counts as a graded written answer
              // A teach-back is the best note a student writes all week: their
              // own words, plus what they missed. It goes to the library with
              // its provenance and comes back as cards.
              if (said && said.trim()) {
                const content = `**You said:** ${said.trim()}\n\n${r.gotRight.map(g => `- ${g}`).join('\n')}${r.missed.length ? `\n\n**What was missing**\n${r.missed.map(m => `- ${m.point}: ${m.reasoning}`).join('\n')}` : ''}`
                ;(async () => {
                  try {
                    const { id } = await saveToNotebook({ kind: 'note', title: `Teach-back · ${item.topic || 'a topic'}`, content, subject: item.subject || null, tags: item.topic ? [item.topic] : [], source: 'teach-back' })
                    const ids: string[] = []
                    for (const c of cardsForNote(item.topic || 'Teach-back', content, { max: 2 })) {
                      try { ids.push(recordFlashcard({ front: c.front, back: c.back, subject: item.subject || undefined, topic: item.topic || undefined, source: 'auto-from-note' }).id) } catch { /* nicety */ }
                    }
                    try { setJSON('kyno:notes:cards', attachCards(getJSON('kyno:notes:cards') || {}, id, ids)) } catch { /* storage blocked */ }
                  } catch { /* the session continues regardless */ }
                })()
              }
              advance()
            }
            else { setItems(it => rebuildWithout(it, 'teach', idx)) }   // the effect above ends the session if nothing is left
          }}
        />
      )}
      </div>
    </div>
  )
}
