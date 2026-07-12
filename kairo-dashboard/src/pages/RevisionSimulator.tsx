import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, Clock, Target, CheckCircle2, XCircle, Sparkles,
  Trophy, RefreshCw, Brain, AlertTriangle,
} from 'lucide-react'
import { chat } from '../lib/openrouter'
import { getMistakes, track } from '../lib/twin'

interface Question {
  q:        string
  options:  string[]
  answer:   number
  explain:  string
  topic:    string
  subject?: string
}

const card: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(14px) saturate(140%)', WebkitBackdropFilter: 'blur(14px) saturate(140%)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }

const DIFFICULTIES = [
  { id: 'easy',   label: 'Easy',   color: '#A5B4FC', secs: 90, count: 8  },
  { id: 'medium', label: 'Medium', color: '#A5B4FC', secs: 60, count: 10 },
  { id: 'hard',   label: 'Exam',   color: '#66D9FF', secs: 45, count: 12 },
]

type Phase = 'setup' | 'loading' | 'live' | 'review' | 'done'

export default function RevisionSimulator() {
  const [phase, setPhase]         = useState<Phase>('setup')
  const [diff, setDiff]           = useState<typeof DIFFICULTIES[0]>(DIFFICULTIES[1])
  const [weakTopics, setWeakTopics] = useState<{ topic: string; subject?: string }[]>([])
  const [pickedTopics, setPicked] = useState<string[]>([])
  const [memoryReady, setMemoryReady] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [idx, setIdx]             = useState(0)
  const [answers, setAnswers]     = useState<(number | null)[]>([])
  const [secsLeft, setSecsLeft]   = useState(0)
  const [err, setErr]             = useState('')
  const intervalRef               = useRef<number | null>(null)

  const loadMemory = useCallback(async () => {
    try {
      const mistakes = getMistakes()
      if (mistakes.length > 0) {
        const items = mistakes.slice(0, 12).map(m => ({
          topic:   m.topic,
          subject: m.subject,
        }))
        setWeakTopics(items)
        setPicked(items.slice(0, 5).map(x => x.topic))
        setMemoryReady(true)
        return
      }
      const r = await fetch('/api/memory', {
        headers: { Authorization: `Bearer ${localStorage.getItem('kairo_token') || ''}` },
      })
      if (r.ok) {
        const d = await r.json()
        const items = (d.weak || []).slice(0, 10).map((m: any) => ({
          topic: m.topic || m.content, subject: m.subject || undefined,
        })).filter((x: any) => x.topic)
        setWeakTopics(items)
        setPicked(items.slice(0, 5).map((x: any) => x.topic))
      }
    } catch {  }
    finally { setMemoryReady(true) }
  }, [])

  useEffect(() => { loadMemory() }, [loadMemory])

  useEffect(() => {
    if (phase !== 'live') return
    setSecsLeft(diff.secs)
    intervalRef.current = window.setInterval(() => {
      setSecsLeft(s => {
        if (s <= 1) {
          if (intervalRef.current) window.clearInterval(intervalRef.current)
          setAnswers(prev => {
            const next = [...prev]
            if (next[idx] === undefined || next[idx] === null) next[idx] = null
            return next
          })
          setTimeout(() => advance(null), 300)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) window.clearInterval(intervalRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx])

  function advance(picked: number | null) {
    if (intervalRef.current) window.clearInterval(intervalRef.current)
    if (idx + 1 >= questions.length) {
      const finalAnswers = [...answers]
      finalAnswers[idx] = picked ?? finalAnswers[idx] ?? null
      setAnswers(finalAnswers)
      setPhase('review')
      trackResultsToMemory(questions, finalAnswers)
    } else {
      setIdx(i => i + 1)
    }
  }

  async function trackResultsToMemory(qs: Question[], ans: (number | null)[]) {
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i]
      const correct = ans[i] === q.answer
      try {
        await fetch('/api/memory/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('kairo_token') || ''}`,
          },
          body: JSON.stringify({
            type:    correct ? 'strong_topic' : 'mistake',
            subject: q.subject,
            topic:   q.topic,
            content: q.q.slice(0, 80),
            signal:  correct ? 0.5 : -0.5,
          }),
        })
      } catch {  }
    }
  }

  function pickAnswer(i: number) {
    const next = [...answers]
    next[idx] = i
    setAnswers(next)
    try {
      const q = questions[idx]
      if (q) {
        const correct = i === q.answer
        track({
          type: 'quiz_answered',
          subject: q.subject,
          topic:   q.topic,
          correct,
          score:   correct ? 100 : 0,
          difficulty: ({ easy: 0.3, medium: 0.55, hard: 0.8 } as any)[diff.id] ?? 0.5,
          modality: 'interactive',
        })
      }
    } catch {  }
    setTimeout(() => advance(i), 250)
  }

  async function startSession() {
    if (pickedTopics.length === 0) { setErr('Pick at least one weak topic'); return }
    setErr(''); setPhase('loading')
    try {
      const reply = await chat({
        messages: [
          { role: 'system', content: `You are an expert exam question writer for Indian school students (CBSE/ICSE/state boards). Generate ${diff.count} ${diff.label}-difficulty MCQs targeting ONLY the topics provided. Mix conceptual + applied questions. Each question has exactly 4 options with one correct answer (index 0-3). Keep questions exam-realistic, concise, and unambiguous.

Return ONLY a JSON array, no other text:
[
  {"q":"...","options":["A","B","C","D"],"answer":2,"explain":"why C is right + one tip","topic":"...","subject":"..."}
]` },
          { role: 'user', content: `Topics: ${pickedTopics.join(', ')}.\n${weakTopics.length ? 'These came from the student\'s weak-topic memory — focus on common pitfalls.' : ''}` },
        ],
      })

      const match = reply.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('AI returned no questions. Try again.')
      const parsed = JSON.parse(match[0]) as Question[]
      const valid = parsed.filter(q => q.q && Array.isArray(q.options) && q.options.length === 4 && typeof q.answer === 'number')
      if (valid.length < 3) throw new Error('Not enough valid questions returned. Try again.')
      setQuestions(valid)
      setAnswers(new Array(valid.length).fill(null))
      setIdx(0)
      setPhase('live')
    } catch (e: any) {
      setErr(e.message)
      setPhase('setup')
    }
  }

  function reset() {
    setPhase('setup'); setQuestions([]); setAnswers([]); setIdx(0); setErr('')
    loadMemory()
  }

  if (phase === 'setup') return <SetupView
    diff={diff} setDiff={setDiff}
    weakTopics={weakTopics} memoryReady={memoryReady}
    pickedTopics={pickedTopics} setPicked={setPicked}
    err={err} onStart={startSession}
  />

  if (phase === 'loading') return <LoadingView />

  if (phase === 'live') {
    const q = questions[idx]
    if (!q) return null
    return <LiveView
      q={q} idx={idx} total={questions.length}
      secsLeft={secsLeft} maxSecs={diff.secs}
      picked={answers[idx]} onPick={pickAnswer}
    />
  }

  if (phase === 'review' || phase === 'done') return <ResultsView
    questions={questions} answers={answers} onReset={reset}
  />

  return null
}

function SetupView({
  diff, setDiff, weakTopics, memoryReady, pickedTopics, setPicked, err, onStart,
}: any) {
  function toggle(t: string) {
    setPicked((p: string[]) => p.includes(t) ? p.filter(x => x !== t) : [...p, t])
  }
  return (
    <div style={{ padding: '28px 36px', maxWidth: 880, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: 'linear-gradient(135deg, #66D9FF, #A5B4FC)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 18px rgba(102, 217, 255, 0.03)', flexShrink: 0,
        }}>
          <Zap size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Revision Simulator</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            Real exam pressure · timed MCQs · targets your weakest topics
          </p>
        </div>
      </div>

      <div style={{ ...card, padding: 18, marginBottom: 14 }}>
        <label style={{
          fontSize: 11, fontWeight: 700, color: '#9CA3AF',
          textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', marginBottom: 10,
        }}>
          Difficulty
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {DIFFICULTIES.map(d => {
            const active = diff.id === d.id
            return (
              <button key={d.id} onClick={() => setDiff(d)} style={{
                padding: '14px 12px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${active ? d.color : '#1f2532'}`,
                background: active ? `${d.color}12` : '#0E1117',
                fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: active ? d.color : '#fafafa', marginBottom: 4 }}>
                  {d.label}
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                  {d.count} questions · {d.secs}s each
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ ...card, padding: 18, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Brain size={13} color="#A5B4FC" />
          <label style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1.5 }}>
            Topics to target ({pickedTopics.length} picked)
          </label>
        </div>

        {!memoryReady && (
          <div style={{ fontSize: 12, color: '#6B7280', padding: '12px 0' }}>Loading your weak topics…</div>
        )}

        {memoryReady && weakTopics.length === 0 && (
          <div style={{
            padding: '16px', background: 'rgba(102, 217, 255, 0.05)',
            border: '1px solid rgba(102, 217, 255, 0.2)', borderRadius: 8,
          }}>
            <p style={{ fontSize: 12, color: '#66D9FF', margin: 0, marginBottom: 8 }}>
              No weak topics in memory yet. Type a few topics manually:
            </p>
            <input
              type="text"
              placeholder="e.g. Quadratic equations, Photosynthesis"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const t = (e.target as HTMLInputElement).value.trim()
                  if (t) {
                    setPicked((p: string[]) => p.includes(t) ? p : [...p, t]);
                    (e.target as HTMLInputElement).value = ''
                  }
                }
              }}
              style={{
                width: '100%', background: '#0E1117', border: '1px solid #1f2532',
                borderRadius: 7, padding: '8px 12px', fontSize: 12, color: '#fafafa',
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {memoryReady && weakTopics.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {weakTopics.map(t => {
              const picked = pickedTopics.includes(t.topic)
              return (
                <button key={t.topic} onClick={() => toggle(t.topic)} style={{
                  padding: '6px 12px', borderRadius: 7,
                  border: `1px solid ${picked ? '#A5B4FC' : '#1f2532'}`,
                  background: picked ? 'rgba(165, 180, 252, 0.1)' : '#0E1117',
                  color: picked ? '#A5B4FC' : '#9CA3AF',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {picked && <Target size={10} />} {t.topic}
                  {t.subject && <span style={{ color: '#6B7280', fontWeight: 400 }}>· {t.subject}</span>}
                </button>
              )
            })}
          </div>
        )}

        {pickedTopics.length > 0 && weakTopics.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 11, color: '#6B7280' }}>
            Picked manually too:&nbsp;
            {pickedTopics.filter(t => !weakTopics.some((w: any) => w.topic === t)).map(t => (
              <span key={t} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 6,
                padding: '2px 8px', borderRadius: 4, background: '#1a1f2e', color: '#B1B5BA',
              }}>
                {t}
                <button onClick={() => setPicked((p: string[]) => p.filter(x => x !== t))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0 }}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {err && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(102, 217, 255, 0.08)', border: '1px solid rgba(102, 217, 255, 0.25)', borderRadius: 8, fontSize: 12, color: '#66D9FF' }}>
          {err}
        </div>
      )}

      <motion.button
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
        onClick={onStart} disabled={pickedTopics.length === 0}
        style={{
          width: '100%', padding: '14px', borderRadius: 11, border: 'none',
          background: pickedTopics.length === 0 ? '#1a1f2e'
            : 'linear-gradient(135deg, #66D9FF, #A5B4FC)',
          color: pickedTopics.length === 0 ? '#6B7280' : '#fff',
          fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
          cursor: pickedTopics.length === 0 ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: pickedTopics.length === 0 ? 'none' : '0 0 24px rgba(102, 217, 255, 0.35)',
        }}>
        <Zap size={15} /> Start Simulation
      </motion.button>
    </div>
  )
}

function LoadingView() {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '3px solid #1f2532', borderTopColor: '#66D9FF',
        }} />
      <p style={{ fontSize: 14, color: '#B1B5BA' }}>AI is crafting your simulation…</p>
      <p style={{ fontSize: 11, color: '#6B7280' }}>Targeting your weak topics with exam-grade questions</p>
    </div>
  )
}

function LiveView({ q, idx, total, secsLeft, maxSecs, picked, onPick }: any) {
  const pct = (secsLeft / maxSecs) * 100
  const dangerColor = secsLeft < 10 ? '#66D9FF' : secsLeft < 20 ? '#A5B4FC' : '#A5B4FC'
  return (
    <div style={{ padding: '28px 36px', maxWidth: 760, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            Question {idx + 1} of {total}
          </div>
          <div style={{ height: 4, background: '#1a1f2e', borderRadius: 2, overflow: 'hidden' }}>
            <motion.div
              animate={{ width: `${((idx + 1) / total) * 100}%` }}
              style={{ height: '100%', background: 'linear-gradient(90deg, #4F7CFF, #4F7CFF)' }} />
          </div>
        </div>
        <div style={{
          width: 64, height: 64, position: 'relative',
        }}>
          <svg viewBox="-32 -32 64 64" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <circle r={26} fill="none" stroke="#1a1f2e" strokeWidth={3} />
            <motion.circle
              r={26} fill="none" stroke={dangerColor} strokeWidth={3} strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 26}
              animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - pct / 100) }}
              transition={{ duration: 0.95, ease: 'linear' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Clock size={11} color={dangerColor} />
            <div style={{ fontSize: 14, fontWeight: 800, color: dangerColor, fontFamily: 'monospace' }}>
              {secsLeft}
            </div>
          </div>
        </div>
      </div>

      <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{ ...card, padding: 22, marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#66D9FF', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
          {q.subject || 'Topic'} · {q.topic}
        </div>
        <div style={{
          fontSize: 16, color: '#fafafa', fontWeight: 600, lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
        }}>
          {q.q}
        </div>
      </motion.div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {q.options.map((opt: string, i: number) => {
          const isPicked = picked === i
          return (
            <motion.button key={i}
              whileHover={{ x: 3 }} whileTap={{ scale: 0.99 }}
              onClick={() => onPick(i)} disabled={picked !== null && picked !== undefined}
              style={{
                padding: '13px 16px', borderRadius: 10,
                border: `1px solid ${isPicked ? '#4F7CFF' : '#1f2532'}`,
                background: isPicked ? 'rgba(79, 124, 255, 0.1)' : '#0E1117',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 12,
                transition: 'all 0.15s',
              }}>
              <div style={{
                width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                background: isPicked ? '#4F7CFF' : '#1a1f2e',
                color: isPicked ? '#fff' : '#9CA3AF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
              }}>
                {String.fromCharCode(65 + i)}
              </div>
              <span style={{ flex: 1, fontSize: 14, color: '#e4e4e7' }}>{opt}</span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

function ResultsView({ questions, answers, onReset }: any) {
  const correct = answers.filter((a: any, i: number) => a === questions[i].answer).length
  const total = questions.length
  const pct = Math.round((correct / total) * 100)
  const grade = pct >= 90 ? 'A+' : pct >= 75 ? 'A' : pct >= 60 ? 'B' : pct >= 40 ? 'C' : 'D'
  const gradeColor = pct >= 75 ? '#A5B4FC' : pct >= 60 ? '#A5B4FC' : pct >= 40 ? '#A5B4FC' : '#66D9FF'

  return (
    <div style={{ padding: '28px 36px', maxWidth: 880, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ ...card, padding: 28, marginBottom: 22, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 200, height: 200,
          borderRadius: '50%', background: `${gradeColor}20`, filter: 'blur(60px)',
        }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
          <div style={{
            width: 80, height: 80, borderRadius: 18,
            background: `${gradeColor}18`, border: `2px solid ${gradeColor}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, fontWeight: 800, color: gradeColor, flexShrink: 0,
          }}>
            {grade}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              Simulation Complete
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#fafafa', lineHeight: 1, marginBottom: 6 }}>
              {correct} <span style={{ color: '#9CA3AF' }}>/ {total}</span> · {pct}%
            </div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>
              {pct >= 75 ? 'Strong showing — these topics are clicking.' :
               pct >= 50 ? 'Solid effort — review the explanations below.' :
               'Tough one. Hit the explanations and circle back tomorrow.'}
            </div>
          </div>
          <Trophy size={40} color={gradeColor} style={{ flexShrink: 0, opacity: 0.7 }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Sparkles size={14} color="#A5B4FC" />
        <div style={{ fontSize: 12, color: '#A5B4FC' }}>
          Results saved to your AI Memory — Kyno will weight these in future personalization.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
        {questions.map((q: Question, i: number) => {
          const userAns = answers[i]
          const isCorrect = userAns === q.answer
          return (
            <div key={i} style={{
              ...card, padding: 16,
              borderColor: isCorrect ? 'rgba(165, 180, 252, 0.3)' : 'rgba(102, 217, 255, 0.3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  background: isCorrect ? 'rgba(165, 180, 252, 0.15)' : 'rgba(102, 217, 255, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isCorrect ? <CheckCircle2 size={13} color="#A5B4FC" /> : <XCircle size={13} color="#66D9FF" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                    Q{i + 1} · {q.topic}
                  </div>
                  <div style={{ fontSize: 13, color: '#fafafa', fontWeight: 600, lineHeight: 1.5 }}>
                    {q.q}
                  </div>
                </div>
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 6, marginBottom: 10,
              }}>
                {q.options.map((opt, j) => {
                  const isAnswer = j === q.answer
                  const isPicked = j === userAns
                  return (
                    <div key={j} style={{
                      padding: '7px 10px', borderRadius: 6, fontSize: 12,
                      border: `1px solid ${isAnswer ? 'rgba(165, 180, 252, 0.4)' :
                        isPicked && !isAnswer ? 'rgba(102, 217, 255, 0.14)' : '#1a1f2e'}`,
                      background: isAnswer ? 'rgba(165, 180, 252, 0.08)' :
                        isPicked && !isAnswer ? 'rgba(102, 217, 255, 0.08)' : '#0E1117',
                      color: isAnswer ? '#A5B4FC' : isPicked && !isAnswer ? '#66D9FF' : '#B1B5BA',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{ fontWeight: 700, fontSize: 10 }}>{String.fromCharCode(65 + j)}</span>
                      <span>{opt}</span>
                    </div>
                  )
                })}
              </div>

              <div style={{
                fontSize: 11.5, color: '#B1B5BA', lineHeight: 1.55,
                padding: '8px 10px', background: '#0E1117',
                border: '1px solid #1a1f2e', borderRadius: 7,
              }}>
                <strong style={{ color: '#A5B4FC' }}>Why:</strong> {q.explain}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <motion.button whileHover={{ scale: 1.03 }} onClick={onReset}
          style={{
            padding: '11px 24px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #66D9FF, #A5B4FC)',
            color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
            boxShadow: '0 0 20px rgba(102, 217, 255, 0.03)',
          }}>
          <RefreshCw size={13} /> Run Another Simulation
        </motion.button>
      </div>
    </div>
  )
}
