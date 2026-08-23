import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Timer, Flag, ArrowLeft, ArrowRight, Landmark, RotateCcw, AlertTriangle } from 'lucide-react'
import { PrimaryButton } from '../components/PrimaryButton'
import { post } from '../lib/api'
import { track, getProfile } from '../lib/twin'
import { awardXP } from '../lib/game'
import { cleanOption } from '../lib/museum.core'
import {
  PAPER_PRESETS, remainingMs, paletteStates, scorePaper, postMortem,
  splitCounts, clockLabel,
  type PaperPreset, type ExamQuestion, type Marking,
} from '../lib/exam.core'

/**
 * Exam-hall mode — a mock under real conditions. The clock is WALL TIME
 * (exam.core.remainingMs), so switching tabs cannot pause it, exactly like a
 * real hall. No pause button exists. Time runs out → the paper hands itself
 * in. Afterwards, the post-mortem shows where marks leaked — and every miss
 * is tracked with its full question, so it lands in the Mistake Museum
 * automatically.
 */

const SCHOOL_ID = 'demo_school'
const SUBJECTS = ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'History', 'Geography', 'Economics', 'English', 'Computer Science']

const C = {
  bg: '#0A0D16', panel: '#141A2A', border: 'rgba(255,255,255,0.08)',
  text: '#fafafa', dim: '#B1B5BA', faint: '#9CA3AF',
  purple: '#A5B4FC', green: '#34D399', amber: '#FFB020', red: '#FF7A90',
}
const card: React.CSSProperties = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }

type Phase = 'setup' | 'building' | 'exam' | 'result'

interface Paper {
  preset: PaperPreset
  questions: ExamQuestion[]
  marking: Marking
  totalMs: number
  startedAt: number
}

export default function ExamHall() {
  const [phase, setPhase] = useState<Phase>('setup')
  const [presetId, setPresetId] = useState('boards')
  const [subject, setSubject] = useState('Physics')
  const [customQ, setCustomQ] = useState(15)
  const [customMin, setCustomMin] = useState(30)
  const [progress, setProgress] = useState('')
  const [err, setErr] = useState('')
  const [paper, setPaper] = useState<Paper | null>(null)
  const [result, setResult] = useState<any>(null)

  const preset = PAPER_PRESETS.find(p => p.id === presetId)!

  async function build() {
    setErr(''); setPhase('building')
    const wantQ = preset.id === 'custom' ? customQ : preset.questions
    const wantMin = preset.id === 'custom' ? customMin : preset.minutes
    const subjects = preset.subjects || [subject]
    const counts = splitCounts(wantQ, subjects)
    const prof = getProfile()
    const cls = String((prof as any)?.cls || '10').replace(/\D/g, '') || '10'
    const board = (prof as any)?.board || 'CBSE'

    const questions: ExamQuestion[] = []
    try {
      for (let si = 0; si < subjects.length; si++) {
        setProgress(`Building your paper… ${questions.length}/${wantQ} (${subjects[si]})`)
        const r = await post('/quiz/start', {
          school_id: SCHOOL_ID, subject: subjects[si], topic: '',
          class: cls, board, difficulty: 'medium', total_questions: counts[si],
        })
        for (const raw of (r.questions || []).slice(0, counts[si])) {
          const opts = (raw.options || []).map((o: string) => cleanOption(o))
          const ci = (raw.options || []).findIndex((o: string) => o.charAt(0) === raw.correct)
          if (opts.length >= 2 && ci >= 0) {
            questions.push({
              q: raw.question, options: opts, correctIndex: ci,
              explanation: raw.explanation || null,
              subject: subjects[si], topic: raw.topic || null, difficulty: raw.difficulty || 'medium',
            })
          }
        }
        setProgress(`Building your paper… ${questions.length}/${wantQ}`)
      }
    } catch (e: any) {
      if (questions.length < 6) { setErr(e?.message || 'Could not build the paper — try again.'); setPhase('setup'); return }
    }
    if (questions.length < 6) { setErr('Could not build enough questions — try again in a minute.'); setPhase('setup'); return }

    setPaper({
      preset,
      questions,
      marking: preset.marking,
      totalMs: wantMin * 60_000,
      startedAt: Date.now(),
    })
    setPhase('exam')
  }

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: C.bg, padding: '24px 20px 80px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {phase === 'setup' && (
          <Setup
            presetId={presetId} setPresetId={setPresetId}
            subject={subject} setSubject={setSubject}
            customQ={customQ} setCustomQ={setCustomQ}
            customMin={customMin} setCustomMin={setCustomMin}
            err={err} onStart={build}
          />
        )}
        {phase === 'building' && (
          <div style={{ ...card, textAlign: 'center', padding: 50 }}>
            <Timer size={28} color={C.purple} style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14, color: C.text, fontWeight: 600, marginBottom: 4 }}>{progress || 'Building your paper…'}</div>
            <div style={{ fontSize: 12, color: C.faint }}>Fresh questions, board-pattern, at your class level.</div>
          </div>
        )}
        {phase === 'exam' && paper && (
          <Hall paper={paper} onSubmit={(res) => { setResult(res); setPhase('result') }} />
        )}
        {phase === 'result' && result && paper && (
          <Result result={result} paper={paper} onNew={() => { setPaper(null); setResult(null); setPhase('setup') }} />
        )}
      </div>
    </div>
  )
}

/* ── setup ─────────────────────────────────────────────────────────────────── */

function Setup(p: any) {
  const preset = PAPER_PRESETS.find(x => x.id === p.presetId)!
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: 'linear-gradient(135deg, #A5B4FC 0%, #7C5CFF 60%, #0B1530 100%)', display: 'grid', placeItems: 'center' }}>
          <Timer size={22} color="#000" strokeWidth={2.4} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: -0.4 }}>Exam hall</h1>
          <div style={{ fontSize: 12, color: C.faint }}>Real conditions: the clock never pauses, blanks are strategy, and time-outs hand themselves in.</div>
        </div>
      </div>

      <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {PAPER_PRESETS.map(x => (
          <button key={x.id} onClick={() => p.setPresetId(x.id)}
            style={{
              ...card, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
              border: `1.5px solid ${p.presetId === x.id ? 'rgba(124,92,255,0.6)' : C.border}`,
              background: p.presetId === x.id ? 'rgba(124,92,255,0.08)' : C.panel,
            }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>{x.label}</div>
            <div style={{ fontSize: 11, color: C.faint, lineHeight: 1.5 }}>{x.note}</div>
            <div style={{ fontSize: 11.5, color: C.purple, marginTop: 6, fontWeight: 600 }}>
              {x.id === 'custom' ? 'you choose' : `${x.questions} questions · ${x.minutes} min`}
            </div>
          </button>
        ))}
      </div>

      {preset.pickSubject && (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>Subject</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SUBJECTS.map(s => (
              <button key={s} onClick={() => p.setSubject(s)} className={`kyno-chip${p.subject === s ? ' on' : ''}`}
                style={{ padding: '7px 13px', fontSize: 11.5 }}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {preset.id === 'custom' && (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>Questions</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[10, 15, 20, 30].map(n => (
              <button key={n} onClick={() => p.setCustomQ(n)} className={`kyno-chip${p.customQ === n ? ' on' : ''}`}
                style={{ padding: '7px 14px', fontSize: 12 }}>{n}</button>
            ))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>Minutes</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[15, 30, 45, 60].map(n => (
              <button key={n} onClick={() => p.setCustomMin(n)} className={`kyno-chip${p.customMin === n ? ' on' : ''}`}
                style={{ padding: '7px 14px', fontSize: 12 }}>{n}</button>
            ))}
          </div>
        </div>
      )}

      {p.err && <div style={{ fontSize: 12.5, color: C.red, marginBottom: 10 }}>{p.err}</div>}
      <PrimaryButton full onClick={p.onStart}>Enter the hall</PrimaryButton>
      <div style={{ fontSize: 10.5, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>
        Once inside there is no pause — leaving the tab keeps the clock running, like the real thing.
      </div>
    </>
  )
}

/* ── the hall ──────────────────────────────────────────────────────────────── */

function Hall({ paper, onSubmit }: { paper: Paper; onSubmit: (res: any) => void }) {
  const n = paper.questions.length
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>(() => Array(n).fill(null))
  const [flags, setFlags] = useState<Set<number>>(() => new Set())
  const [confirming, setConfirming] = useState(false)
  const [, tick] = useState(0)

  const timesRef = useRef<number[]>(Array(n).fill(0))
  const activeSinceRef = useRef(Date.now())
  const idxRef = useRef(0)
  const submittedRef = useRef(false)

  const bankTime = useCallback(() => {
    const nowT = Date.now()
    timesRef.current[idxRef.current] += nowT - activeSinceRef.current
    activeSinceRef.current = nowT
  }, [])

  const goTo = useCallback((i: number) => {
    bankTime()
    idxRef.current = i
    setIdx(i)
  }, [bankTime])

  const answersRef = useRef(answers)
  answersRef.current = answers

  const submit = useCallback((why: 'handed-in' | 'time-up') => {
    if (submittedRef.current) return
    submittedRef.current = true
    bankTime()
    const finalAnswers = answersRef.current
    const score = scorePaper(paper.questions, finalAnswers, paper.marking)
    const pm = postMortem({ questions: paper.questions, answers: finalAnswers, times: timesRef.current, marking: paper.marking })

    // File every question into the twin — misses carry the full card, so they
    // land in the Mistake Museum with no extra plumbing.
    paper.questions.forEach((q, i) => {
      const a = finalAnswers[i]
      if (a == null) return // blanks are strategy, not mistakes
      const correct = a === q.correctIndex
      try {
        track({
          type: 'quiz_answered',
          subject: q.subject || undefined,
          topic: q.topic || undefined,
          correct,
          score: correct ? 100 : 0,
          difficulty: ({ easy: 0.3, medium: 0.5, hard: 0.75 } as any)[q.difficulty || 'medium'] ?? 0.5,
          durationMs: timesRef.current[i],
          modality: 'interactive',
          payload: correct
            ? { q: q.q }
            : { q: q.q, options: q.options, correctIndex: q.correctIndex, chosenIndex: a, explanation: q.explanation || undefined },
        })
      } catch {}
    })
    try { awardXP('quiz_done') } catch {}
    onSubmit({ score, pm, why })
  }, [paper, onSubmit, bankTime])

  // The hall clock: checked every second AND on tab-return, against wall time.
  useEffect(() => {
    const check = () => {
      if (remainingMs(paper.startedAt, paper.totalMs, Date.now()) <= 0) submit('time-up')
      else tick(t => t + 1)
    }
    const id = window.setInterval(check, 1000)
    document.addEventListener('visibilitychange', check)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', check) }
  }, [paper, submit])

  // Closing the tab mid-exam deserves a warning.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [])

  const left = remainingMs(paper.startedAt, paper.totalMs, Date.now())
  const q = paper.questions[idx]
  const states = paletteStates(n, answers, flags)
  const lowTime = left < 5 * 60_000

  function pick(i: number) {
    setAnswers(a => { const nx = [...a]; nx[idx] = i; return nx })
  }
  function toggleFlag() {
    setFlags(f => { const nx = new Set(f); if (nx.has(idx)) nx.delete(idx); else nx.add(idx); return nx })
  }

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
        position: 'sticky', top: 0, zIndex: 5, background: C.bg, padding: '6px 0',
      }}>
        <span style={{ fontSize: 12.5, color: C.faint, fontWeight: 600 }}>Q {idx + 1} / {n}</span>
        <span style={{ fontSize: 11, color: C.faint }}>{q.subject}</span>
        <span style={{
          marginLeft: 'auto', fontFamily: 'Consolas, monospace', fontSize: 15, fontWeight: 700,
          padding: '5px 12px', borderRadius: 9,
          background: lowTime ? 'rgba(255,122,144,0.12)' : 'rgba(124,92,255,0.10)',
          color: lowTime ? C.red : C.purple,
          border: `1px solid ${lowTime ? 'rgba(255,122,144,0.4)' : 'rgba(124,92,255,0.3)'}`,
        }}>
          ⏱ {clockLabel(left)}
        </span>
      </div>

      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, lineHeight: 1.55, marginBottom: 14 }}>{q.q}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q.options.map((opt, i) => {
            const on = answers[idx] === i
            return (
              <button key={i} onClick={() => pick(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  borderRadius: 10, textAlign: 'left', fontFamily: 'inherit', fontSize: 13,
                  cursor: 'pointer', color: '#e4e4e7',
                  background: on ? 'rgba(124,92,255,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${on ? 'rgba(124,92,255,0.55)' : 'rgba(255,255,255,0.08)'}`,
                }}>
                <span style={{
                  width: 17, height: 17, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${on ? '#7C5CFF' : 'rgba(255,255,255,0.25)'}`,
                  background: on ? '#7C5CFF' : 'transparent',
                }} />
                {opt}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <PrimaryButton variant="secondary" disabled={idx === 0} onClick={() => goTo(idx - 1)}><ArrowLeft size={13} /> Prev</PrimaryButton>
        <PrimaryButton variant="secondary" disabled={idx === n - 1} onClick={() => goTo(idx + 1)}>Next <ArrowRight size={13} /></PrimaryButton>
        <button className="kyno-ghost" onClick={toggleFlag}
          style={{
            padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
            background: flags.has(idx) ? 'rgba(255,176,32,0.12)' : 'transparent',
            color: flags.has(idx) ? C.amber : C.faint, border: `1.5px solid ${flags.has(idx) ? 'rgba(255,176,32,0.5)' : C.border}`,
          }}>
          <Flag size={12} style={{ verticalAlign: -2, marginRight: 5 }} />{flags.has(idx) ? 'Flagged' : 'Flag'}
        </button>
        <div style={{ marginLeft: 'auto' }}>
          {confirming ? (
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: C.dim }}>Hand in now?</span>
              <PrimaryButton onClick={() => submit('handed-in')}>Yes, submit</PrimaryButton>
              <PrimaryButton variant="secondary" onClick={() => setConfirming(false)}>Keep going</PrimaryButton>
            </span>
          ) : (
            <PrimaryButton variant="secondary" onClick={() => setConfirming(true)}>Hand in</PrimaryButton>
          )}
        </div>
      </div>

      {/* OMR palette */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {states.map((s, i) => (
          <button key={i} onClick={() => goTo(i)}
            style={{
              width: 32, height: 32, borderRadius: 8, fontFamily: 'Consolas, monospace', fontSize: 12,
              cursor: 'pointer', fontWeight: 700,
              border: `1.5px solid ${i === idx ? '#7C5CFF' : 'transparent'}`,
              background: s === 'done' ? 'rgba(52,211,153,0.2)' : s === 'flag' ? 'rgba(255,176,32,0.2)' : 'rgba(255,255,255,0.06)',
              color: s === 'done' ? C.green : s === 'flag' ? C.amber : C.faint,
            }}>
            {i + 1}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: C.faint, marginTop: 10 }}>
        green answered · amber flagged · grey blank — blanks cost nothing{paper.marking.wrong < 0 ? ', wrong answers cost marks' : ''}
      </div>
    </>
  )
}

/* ── post-mortem ───────────────────────────────────────────────────────────── */

function Result({ result, paper, onNew }: { result: any; paper: Paper; onNew: () => void }) {
  const { score, pm, why } = result
  const attempted = score.correct + score.wrong
  const acc = attempted ? Math.round((score.correct / attempted) * 100) : 0
  const go = (view: string) => { try { (window as any).__kairoSetActive?.(view) } catch {} }

  return (
    <>
      {why === 'time-up' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,176,32,0.08)', border: '1px solid rgba(255,176,32,0.3)' }}>
          <AlertTriangle size={14} color={C.amber} />
          <span style={{ fontSize: 12.5, color: C.dim }}>Time ran out — the paper handed itself in, like the real hall.</span>
        </div>
      )}

      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} style={{ ...card, textAlign: 'center', marginBottom: 12, padding: 26 }}>
        <div style={{ fontSize: 44, fontWeight: 900, color: score.marks >= 0 ? C.text : C.red, letterSpacing: -1 }}>
          {score.marks} <span style={{ fontSize: 18, color: C.faint, fontWeight: 600 }}>/ {score.maxMarks}</span>
        </div>
        <div style={{ fontSize: 12.5, color: C.dim, marginTop: 6 }}>
          {score.correct} right · {score.wrong} wrong · {score.blank} blank · {acc}% accuracy on attempts
        </div>
        {score.negLost > 0 && (
          <div style={{ fontSize: 12, color: C.red, marginTop: 4 }}>−{score.negLost} to negative marking</div>
        )}
        {pm && (
          <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4 }}>
            avg {Math.round(pm.avgTimeMs / 1000)}s per question
          </div>
        )}
      </motion.div>

      {pm && pm.leaks.length > 0 && (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: C.amber, marginBottom: 10 }}>Where marks leaked</div>
          {pm.leaks.map((l: any) => (
            <div key={l.i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
              <Timer size={13} color={C.amber} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.55 }}>
                <b style={{ color: C.text }}>Q{l.i + 1}{l.subject ? ` · ${l.subject}` : ''}</b> — {(l.timeMs / 60000).toFixed(1)} min for {l.marks <= 0 ? 'no marks' : `${l.marks}`}{l.answered ? ' (wrong)' : ' (left blank after all that)'}. Flag-and-move next time; come back with spare minutes.
              </span>
            </div>
          ))}
        </div>
      )}

      {pm && Object.keys(pm.bySubject).length > 1 && (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: C.faint, marginBottom: 10 }}>By subject</div>
          {Object.entries(pm.bySubject).map(([s, r]: any) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ width: 110, fontSize: 12, color: C.dim, flexShrink: 0 }}>{s}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ width: `${r.attempted ? (r.correct / r.attempted) * 100 : 0}%`, height: '100%', background: C.purple }} />
              </div>
              <span style={{ fontSize: 11.5, color: C.faint, flexShrink: 0 }}>{r.correct}/{r.attempted} · {Math.round(r.timeMs / 60000)}m</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {score.wrong > 0 && (
          <PrimaryButton onClick={() => go('museum')}><Landmark size={13} /> Review my {score.wrong} miss{score.wrong === 1 ? '' : 'es'} in the Museum</PrimaryButton>
        )}
        <PrimaryButton variant="secondary" onClick={onNew}><RotateCcw size={13} /> New mock</PrimaryButton>
      </div>
      <div style={{ fontSize: 10.5, color: C.faint, marginTop: 12, lineHeight: 1.5 }}>
        Every miss is already filed in the Mistake Museum with its full question — beat each one twice to retire it.
      </div>
    </>
  )
}
