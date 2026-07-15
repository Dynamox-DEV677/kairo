import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, AlertTriangle, Trophy, BarChart3, Target } from 'lucide-react'
import { get, post } from '../lib/api'

const SCHOOL_ID = 'demo_school'

const TABS = [
  { id: 'weak',   label: 'Weak Areas',      icon: AlertTriangle },
  { id: 'class',  label: 'Class Dashboard', icon: BarChart3 },
  { id: 'rank',   label: 'Rank Predictor',  icon: Trophy },
  { id: 'today',  label: 'Study Today',     icon: Target },
]

const card = { background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(14px) saturate(140%)', WebkitBackdropFilter: 'blur(14px) saturate(140%)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 20 } as React.CSSProperties
const inp  = { background: '#0E1117', border: '1px solid #1f2532', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', width: '100%' } as React.CSSProperties
const lbl  = { fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 } as React.CSSProperties
const btn  = (active = true) => ({ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: 'none', background: active ? 'linear-gradient(135deg,#7C6BF6,#7C6BF6)' : '#1a1f2e', color: active ? '#fff' : '#6B7280', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: active ? 'pointer' : 'not-allowed' } as React.CSSProperties)

export default function Analytics() {
  const [tab, setTab] = useState('today')

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1000, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Analytics & Intelligence</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Performance insights · Weak area detection · Rank prediction</p>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#0E1117', border: '1px solid #1f2532', borderRadius: 10, padding: 4 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '7px 8px', borderRadius: 7, border: 'none', fontFamily: 'inherit',
            fontSize: 12, fontWeight: tab === t.id ? 600 : 400, cursor: 'pointer',
            background: tab === t.id ? '#1f2532' : 'transparent',
            color: tab === t.id ? '#A5B4FC' : '#6B7280', transition: 'all 0.15s',
          }}><t.icon size={12} /> {t.label}</button>
        ))}
      </div>
      {tab === 'today' && <StudyTodayTab />}
      {tab === 'weak'  && <WeakAreasTab />}
      {tab === 'class' && <ClassDashTab />}
      {tab === 'rank'  && <RankTab />}
    </div>
  )
}

function StudyTodayTab() {
  const [card2, setCard2] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get(`/analytics/study-today?school_id=${SCHOOL_ID}`)
      .then(setCard2).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (!card2)  return <Err msg="Could not load daily card." />

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ ...card, background: 'linear-gradient(135deg,#1f2532,#0E1117)', borderColor: '#7C6BF630', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          {card2.day} · {card2.date}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#fafafa', marginBottom: 8 }}>{card2.greeting}</div>
        <div style={{ fontSize: 13, color: '#B1B5BA' }}>{card2.daily_goal}</div>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Today's Focus</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fafafa', marginBottom: 2 }}>{card2.focus_subject}</div>
          <div style={{ fontSize: 13, color: '#9CA3AF' }}>{card2.focus_topic}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Quick Win 🏆</div>
          <div style={{ fontSize: 13, color: '#e4e4e7' }}>{card2.quick_win}</div>
        </div>
      </div>

      {card2.priority_tasks?.length > 0 && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Priority Tasks</div>
          {card2.priority_tasks.map((t: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < card2.priority_tasks.length - 1 ? '1px solid #1f2532' : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#7C6BF615', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#A5B4FC', flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#e4e4e7' }}>{t.task}</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>{t.duration} · {t.type}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {card2.motivation_quote && (
        <div style={{ ...card, borderColor: '#A5B4FC30', background: '#0d0d1a', textAlign: 'center' }}>
          <div style={{ fontSize: 15, color: '#A5B4FC', fontStyle: 'italic' }}>"{card2.motivation_quote}"</div>
        </div>
      )}
    </div>
  )
}

function WeakAreasTab() {
  const [data, setData]   = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get(`/analytics/weak-areas?school_id=${SCHOOL_ID}`)
      .then(setData).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (!data)   return <Err msg="Could not load weak areas." />

  const healthColor = data.overall_health === 'good' ? '#A5B4FC' : data.overall_health === 'moderate' ? '#A5B4FC' : '#A5B4FC'

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        {[['Total Essays', data.total_essays, '#A5B4FC'], ['Total Quizzes', data.total_quizzes, '#8FA0FA'], ['Health', data.overall_health?.replace('_',' ').toUpperCase(), healthColor]].map(([l, v, c]) => (
          <div key={l as string} style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: c as string }}>{v}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>{l}</div>
          </div>
        ))}
      </div>

      {(data.weak_areas?.length ?? 0) === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32 }}>🎉</div>
          <div style={{ fontSize: 14, color: '#A5B4FC', fontWeight: 600, marginTop: 8 }}>No weak areas detected!</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Keep taking quizzes and submitting essays to track performance.</div>
        </div>
      ) : (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Needs Attention</div>
          {data.weak_areas.map((w: any, i: number) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: '#e4e4e7' }}>{w.subject}</span>
                <span style={{ fontSize: 12, color: w.avg_score < 50 ? '#A5B4FC' : '#A5B4FC', fontWeight: 600 }}>{w.avg_score}% avg</span>
              </div>
              <div style={{ height: 6, background: '#1f2532', borderRadius: 3 }}>
                <div style={{ height: '100%', background: w.avg_score < 50 ? '#A5B4FC' : '#A5B4FC', borderRadius: 3, width: `${w.avg_score}%`, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{w.attempts} attempt{w.attempts > 1 ? 's' : ''} · {w.type}</div>
            </div>
          ))}
        </div>
      )}

      {data.hard_flashcard_topics?.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Hard Flashcard Topics</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.hard_flashcard_topics.map((t: string, i: number) => (
              <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, background: '#A5B4FC15', color: '#A5B4FC', border: '1px solid #A5B4FC30' }}>{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ClassDashTab() {
  const [data, setData]   = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get(`/analytics/class-performance?school_id=${SCHOOL_ID}`)
      .then(setData).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (!data)   return <Err msg="Could not load class data." />

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        {[['Total Students', data.total_students, '#A5B4FC'], ['Active', data.active_students, '#A5B4FC'], ['Class Avg', `${data.class_average}%`, data.class_average >= 70 ? '#A5B4FC' : '#A5B4FC']].map(([l, v, c]) => (
          <div key={l as string} style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: c as string }}>{v}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {data.top_students?.length > 0 && (
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>🏆 Top Students</div>
            {data.top_students.map((s: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: i === 0 ? '#A5B4FC' : i === 1 ? '#9CA3AF' : '#0B1530', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#000', flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1, fontSize: 12, color: '#e4e4e7' }}>{s.name || s.student_id}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#A5B4FC' }}>{s.avg_score}%</div>
              </div>
            ))}
          </div>
        )}
        {data.needs_attention?.length > 0 && (
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>⚠ Needs Attention</div>
            {data.needs_attention.map((s: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1, fontSize: 12, color: '#e4e4e7' }}>{s.name || s.student_id}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#A5B4FC' }}>{s.avg_score}%</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {data.subject_breakdown?.length > 0 && (
        <div style={{ ...card, marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Subject Performance</div>
          {data.subject_breakdown.map((s: any, i: number) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: '#e4e4e7' }}>{s.subject}</span>
                <span style={{ fontSize: 12, color: s.avg >= 70 ? '#A5B4FC' : '#A5B4FC', fontWeight: 600 }}>{s.avg}%</span>
              </div>
              <div style={{ height: 5, background: '#1f2532', borderRadius: 3 }}>
                <div style={{ height: '100%', background: s.avg >= 70 ? '#A5B4FC' : '#A5B4FC', borderRadius: 3, width: `${s.avg}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RankTab() {
  const [scores, setScores] = useState([
    { subject: 'Mathematics', score: '', max: '100' },
    { subject: 'Science', score: '', max: '100' },
    { subject: 'English', score: '', max: '100' },
    { subject: 'Hindi', score: '', max: '100' },
    { subject: 'Social Studies', score: '', max: '100' },
  ])
  const [cls, setCls]       = useState('10')
  const [board, setBoard]   = useState('CBSE')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [err, setErr]       = useState('')

  async function predict() {
    const filled = scores.filter(s => s.score !== '')
    if (filled.length === 0) { setErr('Enter at least one score'); return }
    setLoading(true); setErr('')
    try {
      const r = await post('/analytics/rank-predict', {
        school_id: SCHOOL_ID,
        scores: filled.map(s => ({ subject: s.subject, score: Number(s.score), max: Number(s.max) })),
        class: cls, board,
      })
      setResult(r)
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: 20 }}>
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', margin: '0 0 16px' }}>Enter Your Scores</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div>
            <label style={lbl}>Class</label>
            <select style={inp} value={cls} onChange={e => setCls(e.target.value)}>
              {['9','10','11','12'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Board</label>
            <select style={inp} value={board} onChange={e => setBoard(e.target.value)}>
              {['CBSE','ICSE','State Board'].map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
        </div>
        {scores.map((s, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 8, marginBottom: 8, alignItems: 'end' }}>
            <div>
              {i === 0 && <label style={lbl}>Subject</label>}
              <input style={inp} value={s.subject} onChange={e => setScores(sc => sc.map((x, j) => j === i ? { ...x, subject: e.target.value } : x))} />
            </div>
            <div>
              {i === 0 && <label style={lbl}>Score</label>}
              <input style={inp} type="number" value={s.score} onChange={e => setScores(sc => sc.map((x, j) => j === i ? { ...x, score: e.target.value } : x))} placeholder="e.g. 85" />
            </div>
            <div>
              {i === 0 && <label style={lbl}>Max</label>}
              <input style={inp} type="number" value={s.max} onChange={e => setScores(sc => sc.map((x, j) => j === i ? { ...x, max: e.target.value } : x))} />
            </div>
          </div>
        ))}
        {err && <p style={{ color: '#A5B4FC', fontSize: 12, margin: '8px 0' }}>{err}</p>}
        <button onClick={predict} disabled={loading} style={{ ...btn(!loading), width: '100%', justifyContent: 'center', marginTop: 8 }}>
          <Trophy size={13} /> {loading ? 'Predicting…' : 'Predict My Rank'}
        </button>
      </div>

      {result && (
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#A5B4FC' }}>{result.percentage}%</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#fafafa' }}>Grade: {result.grade}</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{result.expected_band}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ ...card, padding: 14 }}>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>School Rank</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#A5B4FC' }}>{result.school_rank_estimate}</div>
            </div>
            <div style={{ ...card, padding: 14 }}>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>State Percentile</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#A5B4FC' }}>{result.state_percentile}</div>
            </div>
          </div>
          {result.improvement_tips?.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Tips to Improve</div>
              {result.improvement_tips.map((t: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: '#B1B5BA', marginBottom: 6 }}>→ {t}</div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

function Spinner() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #1f2532', borderTopColor: '#7C6BF6', animation: 'spin 0.8s linear infinite' }} /></div>
}
function Err({ msg }: { msg: string }) {
  return <div style={{ textAlign: 'center', padding: 60, color: '#A5B4FC', fontSize: 13 }}>{msg}</div>
}
