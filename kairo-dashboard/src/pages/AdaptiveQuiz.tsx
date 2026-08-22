import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, CheckCircle, XCircle, Trophy, RotateCcw, History, Target, Zap, BarChart3, Award, ArrowRight } from 'lucide-react'
import { post, get } from '../lib/api'
import { track, getProfile } from '../lib/twin'
import { awardXP } from '../lib/game'

const SCHOOL_ID = 'demo_school'

const card  = { background: '#141A2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 20 } as React.CSSProperties
const inp   = { background: '#141A2A', border: '1px solid #1f2532', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', width: '100%' } as React.CSSProperties
const lbl   = { fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 } as React.CSSProperties
const btn   = (active = true, color?: string) => ({ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: 'none', background: active ? (color || 'linear-gradient(135deg,#7C5CFF,#6455e0)') : '#171D2D', color: active ? '#fff' : '#6B7280', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: active ? 'pointer' : 'not-allowed' } as React.CSSProperties)

const SUBJECTS = ['Physics','Chemistry','Biology','Mathematics','History','Geography','Economics','English','Computer Science']

type Screen = 'setup' | 'quiz' | 'result' | 'history'

export default function AdaptiveQuiz() {
  const [screen, setScreen] = useState<Screen>('setup')
  // Seed from the student's own profile. This used to hard-code CBSE Class 10,
  // so a Cambridge student generating a quiz got CBSE questions no matter what
  // they had set in Settings.
  const [form, setForm] = useState(() => {
    const p = getProfile()
    return {
      subject: 'Mathematics', topic: '',
      class: String(p?.cls || '10').replace(/\D/g, '') || '10',
      board: p?.board || 'CBSE',
      difficulty: 'medium', total_questions: 10,
    }
  })
  const [questions, setQuestions] = useState<any[]>([])
  const [sessionId, setSessionId] = useState('local')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [finalResult, setFinalResult] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])

  async function startQuiz() {
    setLoading(true); setErr('')
    try {
      const r = await post('/quiz/start', { school_id: SCHOOL_ID, ...form })
      const wanted = Number(form.total_questions) || 10
      setQuestions((r.questions || []).slice(0, wanted))
      setSessionId(r.session_id || 'local')
      setScreen('quiz')
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  async function onComplete(score: number, answers: any[]) {
    try { awardXP('quiz_done') } catch {  }
    try {
      const r = await post('/quiz/complete', { school_id: SCHOOL_ID, session_id: sessionId, score, total: questions.length, answers, subject: form.subject })
      setFinalResult({ score, total: questions.length, ...r })
    } catch {
      setFinalResult({ score, total: questions.length, percent: Math.round(score / questions.length * 100) })
    }
    setScreen('result')
  }

  async function loadHistory() {
    try { setHistory(await get(`/quiz/history?school_id=${SCHOOL_ID}`)) }
    catch {}
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 800, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Adaptive Quiz</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>MCQ quiz that adapts to your difficulty level</p>
        </div>
        <button className="kyno-ghost" onClick={() => { if (screen !== 'history') { loadHistory(); setScreen('history') } else setScreen('setup') }}
          style={{ ...btn(true, '#141A2A'), border: '1px solid #1f2532', color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0 }}>
          <History size={13} /> History
        </button>
      </div>

      <AnimatePresence mode="wait">
        {screen === 'setup' && (
          <motion.div key="setup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <SetupScreen form={form} setForm={setForm} onStart={startQuiz} loading={loading} err={err} />
          </motion.div>
        )}
        {screen === 'quiz' && (
          <motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <QuizScreen questions={questions} onComplete={onComplete} />
          </motion.div>
        )}
        {screen === 'result' && finalResult && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <ResultScreen result={finalResult} onRetry={() => setScreen('setup')} />
          </motion.div>
        )}
        {screen === 'history' && (
          <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <HistoryScreen history={history} onBack={() => setScreen('setup')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SetupScreen({ form, setForm, onStart, loading, err }: any) {
  return (
    <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', margin: '0 0 16px' }}>Quiz Settings</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Subject</label>
          <select style={inp} value={form.subject} onChange={e => setForm((f: any) => ({ ...f, subject: e.target.value }))}>
            {SUBJECTS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Topic (optional)</label>
          <input style={inp} value={form.topic} onChange={e => setForm((f: any) => ({ ...f, topic: e.target.value }))} placeholder="e.g. Trigonometry, Photosynthesis…" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Class</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['8','9','10','11','12'].map(c => (
              <button key={c} type="button" onClick={() => setForm((f: any) => ({ ...f, class: c }))}
                className={`kyno-chip${String(form.class) === c ? ' on' : ''}`}
                style={{ padding: '7px 14px', fontSize: 12 }}>Class {c}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Questions</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[5,10,15,20].map(n => (
              <button key={n} type="button" onClick={() => setForm((f: any) => ({ ...f, total_questions: n }))}
                className={`kyno-chip${form.total_questions === n ? ' on' : ''}`}
                style={{ padding: '7px 14px', fontSize: 12 }}>{n}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Starting Difficulty</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['easy','Easy'],['medium','Medium'],['hard','Hard']].map(([v, l]) => (
              <button key={v} onClick={() => setForm((f: any) => ({ ...f, difficulty: v }))}
                className={`kyno-chip${form.difficulty === v ? ' on' : ''}`}
                style={{ flex: 1, padding: '8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{l}</button>
            ))}
          </div>
        </div>
        {err && <p style={{ color: '#A5B4FC', fontSize: 12, marginBottom: 12 }}>{err}</p>}
        <button onClick={onStart} disabled={loading} className="kyno-chunky" style={{ ...btn(!loading), width: '100%', justifyContent: 'center' }}>
          <Brain size={13} /> {loading ? 'Generating Quiz…' : 'Start Quiz'}
        </button>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', margin: '0 0 14px' }}>How it works</h3>
        {[
          [Target,   'AI generates MCQ questions', 'Board-pattern questions at your chosen difficulty'],
          [Zap,      'Instant feedback', "See if you're right immediately with explanation"],
          [BarChart3,'Score tracking', 'Track performance over time in History'],
          [Award,    'XP rewards', 'Earn XP for completing quizzes and perfect scores'],
        ].map(([Icon, title, desc]: any) => (
          <div key={title as string} style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'flex-start' }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: 'rgba(165, 180, 252, 0.12)',
              border: '1px solid rgba(165, 180, 252, 0.32)',
              display: 'grid', placeItems: 'center',
            }}>
              <Icon size={14} color="#A5B4FC" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e4e7' }}>{title}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuizScreen({ questions, onComplete }: any) {
  const [index, setIndex] = useState(0)
  const qShownRef = useRef(Date.now())
  useEffect(() => { qShownRef.current = Date.now() }, [index])
  const [selected, setSelected] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const [answers, setAnswers] = useState<any[]>([])

  const q = questions[index]
  if (!q) return null

  function select(opt: string) {
    if (revealed) return
    setSelected(opt)
    setRevealed(true)
    const letter = opt.charAt(0)
    const correct = letter === q.correct
    if (correct) setScore(s => s + 1)
    setAnswers(a => [...a, { question_index: index, answer: letter, correct }])
    try {
      track({
        type:    'quiz_answered',
        subject: (q as any).subject,
        topic:   (q as any).topic,
        correct,
        score:   correct ? 100 : 0,
        difficulty: ({ easy: 0.3, medium: 0.5, hard: 0.75 } as any)[(q as any).difficulty] ?? 0.5,
        durationMs: Date.now() - qShownRef.current,
        modality: 'interactive',
      })
    } catch {  }
  }

  function next() {
    if (index + 1 >= questions.length) {
      onComplete(score + (selected?.charAt(0) === q.correct ? 0 : 0), answers)
      return
    }
    setIndex(i => i + 1)
    setSelected(null)
    setRevealed(false)
  }

  function handleNext() {
    const letter = selected?.charAt(0)
    const correct = letter === q.correct
    const finalScore = correct ? score : score
    if (index + 1 >= questions.length) {
      onComplete(finalScore, answers)
    } else {
      next()
    }
  }

  const optColors: Record<string, string> = {
    correct: '#A5B4FC', wrong: '#A5B4FC', neutral: '#1f2532',
  }

  function optBg(opt: string) {
    if (!revealed) return opt === selected ? '#7C5CFF20' : 'transparent'
    const letter = opt.charAt(0)
    if (letter === q.correct) return '#A5B4FC20'
    if (opt === selected && letter !== q.correct) return '#A5B4FC20'
    return 'transparent'
  }

  function optBorder(opt: string) {
    if (!revealed) return opt === selected ? '#7C5CFF' : '#1f2532'
    const letter = opt.charAt(0)
    if (letter === q.correct) return '#A5B4FC'
    if (opt === selected && letter !== q.correct) return '#A5B4FC'
    return '#1f2532'
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>Question {index + 1} of {questions.length}</span>
        <span style={{ fontSize: 12, color: '#A5B4FC', fontWeight: 600 }}>Score: {score}/{index + (revealed ? 1 : 0)}</span>
      </div>
      <div style={{ height: 4, background: '#1f2532', borderRadius: 2, marginBottom: 20 }}>
        <div style={{ height: '100%', background: 'linear-gradient(90deg,#7C5CFF,#9d8dff)', borderRadius: 2, width: `${((index + 1) / questions.length) * 100}%`, transition: 'width 0.3s' }} />
      </div>

      <div style={card}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: q.difficulty === 'easy' ? '#34d39918' : q.difficulty === 'hard' ? '#FF5A6E18' : '#ffb02018', color: q.difficulty === 'easy' ? '#34d399' : q.difficulty === 'hard' ? '#FF5A6E' : '#ffb020', fontWeight: 700, flexShrink: 0 }}>
            {q.difficulty}
          </span>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#fafafa', lineHeight: 1.5 }}>{q.question}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {q.options.map((opt: string) => (
            <button key={opt} onClick={() => select(opt)} style={{
              padding: '12px 14px', borderRadius: 9, border: `1px solid ${optBorder(opt)}`,
              background: optBg(opt), color: '#e4e4e7', fontSize: 13, textAlign: 'left',
              cursor: revealed ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              {revealed && opt.charAt(0) === q.correct && <CheckCircle size={14} color="#A5B4FC" />}
              {revealed && opt === selected && opt.charAt(0) !== q.correct && <XCircle size={14} color="#A5B4FC" />}
              {opt}
            </button>
          ))}
        </div>

        {revealed && q.explanation && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            style={{ padding: '10px 14px', background: '#0d1117', borderRadius: 8, border: '1px solid #1f2532', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#A5B4FC', marginBottom: 4 }}>EXPLANATION</div>
            <div style={{ fontSize: 12, color: '#B1B5BA' }}>{q.explanation}</div>
          </motion.div>
        )}

        {revealed && (
          <button className="kyno-ghost" onClick={handleNext} style={{ ...btn(), width: '100%', justifyContent: 'center' }}>
            {index + 1 >= questions.length ? (<><BarChart3 size={13} /> See Results</>) : (<>Next Question <ArrowRight size={13} /></>)}
          </button>
        )}
      </div>
    </div>
  )
}

function ResultScreen({ result, onRetry }: any) {
  const pct = result.percent || Math.round((result.score / result.total) * 100)
  const grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : 'D'
  const color = pct >= 80 ? '#A5B4FC' : pct >= 60 ? '#A5B4FC' : '#A5B4FC'

  return (
    <div>
      <motion.div style={{ ...card, textAlign: 'center', marginBottom: 16 }} initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
        <Trophy size={40} color={color} style={{ margin: '0 auto 12px' }} />
        <div style={{ fontSize: 48, fontWeight: 800, color, marginBottom: 4 }}>{pct}%</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#fafafa', marginBottom: 4 }}>Grade: {grade}</div>
        <div style={{ fontSize: 13, color: '#9CA3AF' }}>{result.score} out of {result.total} correct</div>
        {result.xp_earned && (
          <div style={{ marginTop: 12, fontSize: 13, color: '#A5B4FC', fontWeight: 600 }}>+{result.xp_earned} XP earned ⭐</div>
        )}
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        {[['Score', `${result.score}/${result.total}`, '#fafafa'], ['Percentage', `${pct}%`, color], ['Grade', grade, color]].map(([l, v, c]) => (
          <div key={l as string} style={{ ...card, textAlign: 'center', padding: '14px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: c as string }}>{v}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>{l}</div>
          </div>
        ))}
      </div>

      <button className="kyno-ghost" onClick={onRetry} style={{ ...btn(), width: '100%', justifyContent: 'center' }}>
        <RotateCcw size={13} /> Take Another Quiz
      </button>
    </div>
  )
}

function HistoryScreen({ history, onBack }: any) {
  return (
    <div>
      <button className="kyno-ghost" onClick={onBack} style={{ ...btn(true, '#171D2D'), color: '#9CA3AF', marginBottom: 16, border: '1px solid #1f2532' }}>← Back to Setup</button>

      {history.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#4B5563', fontSize: 13 }}>No completed quizzes yet.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {history.map((h: any, i: number) => {
          const color = h.percent >= 80 ? '#A5B4FC' : h.percent >= 60 ? '#A5B4FC' : '#A5B4FC'
          return (
            <div key={h._id || i} style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color }}>{h.grade || '?'}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>{h.subject}{h.topic ? ` — ${h.topic}` : ''}</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>{h.score}/{h.total} correct · {new Date(h.completed_at).toLocaleDateString('en-IN')}</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color }}>{h.percent}%</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
