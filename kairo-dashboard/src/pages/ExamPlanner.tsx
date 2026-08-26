import { useState, useEffect, useCallback } from 'react'
import { aiHeaders } from '../lib/devKey'
import { readjustPlan, planDayIndex, missedBlocks } from '../lib/replan.core'
import SyllabusMap from '../components/SyllabusMap'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Target, Calendar, Clock, AlertTriangle, Trophy, BookOpen,
  Loader2, ChevronRight, RefreshCw, Save, Printer, Folder, X, Check, Brain,
} from 'lucide-react'
import KairoGyro from '../components/KairoGyro'
import { awardXP } from '../lib/game'
import { authToken, storedProfileRaw } from '../lib/storage'

// Plans are now scoped to the signed-in user server-side, so every call to a
// plan route has to carry the token or it will (correctly) 401.
const authFetch = (url: string, init: RequestInit = {}) => fetch(url, {
  ...init,
  headers: {
    ...(init.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${authToken() || ''}`,
  },
})

interface ExamMeta { id: string; label: string; subjects: string[]; durationHrs: number | null }
interface TopicPriority { subject: string; topic: string; weight: 'HIGH' | 'MED' | 'LOW'; reason: string }
interface ScheduleBlock { time: string; subject: string; topic: string; type: 'concept'|'practice'|'PYQ'|'revision'|'mock'|'rest' }
interface ScheduleDay   { day: string; blocks: ScheduleBlock[] }
interface ScheduleWeek  { week: number; focus: string; days: ScheduleDay[] }
interface Milestone     { atDay: number; checkpoint: string; target: string }
interface ExamPlan {
  exam: string; totalDays: number; summary: string;
  topicPriorities: TopicPriority[]; weeklySchedule: ScheduleWeek[];
  milestones: Milestone[]; answerStrategy: string; tips: string;
}
interface SavedPlanRow {
  id: string; exam: string; exam_date: string; hours_per_day: number;
  created_at: string; updated_at: string;
  completion_state: Record<string, true>;
  mock_scores: { date: string; score: number; note?: string }[];
}

function getUserId(): string | null {
  try {
    const raw = storedProfileRaw()
    if (raw) {
      const p = JSON.parse(raw)
      return p?.id || p?.user_id || null
    }
  } catch {  }
  return null
}
function blockKey(week: number, day: string, idx: number) { return `${week}-${day}-${idx}` }

const card: React.CSSProperties = {
  background: '#141A2A',


  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 14,
}
const inp: React.CSSProperties = {
  background: '#141A2A', border: '1px solid #1f2532', borderRadius: 8,
  padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit',
  outline: 'none', width: '100%', boxSizing: 'border-box',
}
const lbl: React.CSSProperties = {
  fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 5,
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8,
}
// Layout ONLY. The gradient, radius, 3D edge and press all come from
// .kyno-chunky so this button matches every other primary button in the app.
// It used to hard-code its own 135deg gradient here, which is precisely how the
// button system drifted apart in the first place.
const btnPrimary: React.CSSProperties = {
  padding: '11px 22px', fontSize: 13, letterSpacing: 0.5,
  display: 'inline-flex', alignItems: 'center', gap: 8,
}
const btnGhost: React.CSSProperties = {
  background: 'transparent', color: '#A1A1AA',
  border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10,
  padding: '9px 16px', fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
}
const weightChip = (w: TopicPriority['weight']): React.CSSProperties => ({
  fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
  letterSpacing: 1, textTransform: 'uppercase',
  color: w === 'HIGH' ? '#ff8aa0' : w === 'MED' ? '#ffd180' : '#A1A1AA',
  background: w === 'HIGH' ? 'rgba(255,77,109,0.16)'
            : w === 'MED'  ? 'rgba(255,180,74,0.14)'
            :                'rgba(255,255,255,0.05)',
  border: '1px solid ' + (w === 'HIGH' ? 'rgba(255,77,109,0.40)'
                       :  w === 'MED'  ? 'rgba(255,180,74,0.32)'
                       :                 'rgba(255,255,255,0.10)'),
})
const blockTypeColor = (t: ScheduleBlock['type']): string => ({
  concept:'#A5B4FC', practice:'#A5B4FC', PYQ:'#ffb44a',
  revision:'#9a4ad8', mock:'#ff4d6d', rest:'#5B616E',
}[t] || '#A1A1AA')

const PRINT_STYLE = `
@media print {
  body { background: #fff !important; color: #000 !important; }
  #exam-planner-form, #exam-planner-saved, #exam-planner-actions { display: none !important; }
  #exam-planner-plan { background: #fff !important; color: #000 !important; }
  #exam-planner-plan * {
    background: #fff !important; color: #000 !important;
    border-color: #ccc !important; box-shadow: none !important;
    backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
  }
  #exam-planner-plan h1, #exam-planner-plan h3 { color: #1a1a1a !important; }
  @page { size: A4 portrait; margin: 12mm; }
}`

export default function ExamPlanner() {
  const [exams, setExams]   = useState<ExamMeta[]>([])
  const [exam, setExam]     = useState<string>('jee-main')
  const [examDate, setExamDate] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() + 60)
    return d.toISOString().slice(0, 10)
  })
  const [hoursPerDay, setHoursPerDay] = useState(4)
  const [weakAreas, setWeakAreas]     = useState<string>('')
  const [currentLevel, setCurrentLevel] = useState<'beginner'|'mid'|'strong'>('mid')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const [plan, setPlan]                       = useState<ExamPlan | null>(null)
  const [planId, setPlanId]                   = useState<string | null>(null)
  const [completion, setCompletion]           = useState<Record<string, true>>({})
  const [savedPlans, setSavedPlans]           = useState<SavedPlanRow[]>([])
  const [showSavedList, setShowSavedList]     = useState(false)
  const [showMockForm, setShowMockForm]       = useState(false)
  const [mockScore, setMockScore]             = useState<number>(60)
  const [mockNote, setMockNote]               = useState<string>('')

  const userId = getUserId()

  useEffect(() => {
    fetch('/api/exam-planner/exams')
      .then(r => r.ok ? r.json() : [])
      .then(setExams)
      .catch(() => {})

    const token = authToken()
    if (token) {
      fetch('/api/memory/weak-topics', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && Array.isArray(data.topics) && data.topics.length) {
            setWeakAreas(data.topics.slice(0, 8).join(', '))
          }
        })
        .catch(() => {})
    }

    if (userId) {
      authFetch(`/api/exam-planner/list`)
        .then(r => r.ok ? r.json() : [])
        .then(d => { if (Array.isArray(d)) setSavedPlans(d) })
        .catch(() => {})
    }
  }, [userId])

  const generate = useCallback(async () => {
    setLoading(true); setError(null); setPlan(null); setPlanId(null); setCompletion({})
    try {
      const r = await fetch('/api/exam-planner/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...aiHeaders() },
        body: JSON.stringify({
          exam, examDate, hoursPerDay,
          weakAreas: weakAreas.split(',').map(s => s.trim()).filter(Boolean),
          currentLevel,
        }),
      })
      if (!r.ok) throw new Error('Server returned ' + r.status)
      const data = await r.json()
      if (data.error) throw new Error(data.error)
      setPlan(data)
      try { awardXP('exam_plan') } catch {  }
    } catch (e: any) {
      setError(e.message || 'Failed to generate plan')
    } finally {
      setLoading(false)
    }
  }, [exam, examDate, hoursPerDay, weakAreas, currentLevel])

  const savePlan = useCallback(async () => {
    if (!plan || !userId) {
      setError(userId ? 'No plan to save' : 'Log in to save plans')
      return
    }
    try {
      const r = await authFetch('/api/exam-planner/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...aiHeaders() },
        body: JSON.stringify({
          user_id: userId, exam, exam_date: examDate,
          hours_per_day: hoursPerDay, plan_json: plan,
        }),
      })
      if (!r.ok) throw new Error('Save failed (' + r.status + ')')
      const row = await r.json()
      setPlanId(row.id)
      setSavedPlans(prev => [row, ...prev])
    } catch (e: any) { setError(e.message) }
  }, [plan, userId, exam, examDate, hoursPerDay])

  const [planCreatedAt, setPlanCreatedAt] = useState<number | null>(null)

  // C13 — how far behind this plan the student actually is, from their own
  // check-ins. Deterministic; see replan.core.js.
  const behind = (plan && planCreatedAt)
    ? missedBlocks(plan, completion, planDayIndex(planCreatedAt, Date.now())).length
    : 0

  const refit = useCallback(async () => {
    if (!plan || !planCreatedAt) return
    const r = readjustPlan(plan, completion, planDayIndex(planCreatedAt, Date.now()))
    if (!r.changed && r.overflow.length === 0) return
    setPlan(r.plan)
    if (r.overflow.length) {
      setError(`Re-fitted ${r.moved} missed block${r.moved === 1 ? '' : 's'}. ${r.overflow.length} would not fit before the exam — they are the lowest-priority ones (${r.overflow.map(b => b.topic).filter(Boolean).slice(0, 3).join(', ')}…). Trimming scope beats pretending.`)
    }
    if (planId) {
      try {
        await authFetch(`/api/exam-planner/${planId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...aiHeaders() },
          body: JSON.stringify({ plan_json: r.plan, hours_per_day: hoursPerDay }),
        })
      } catch { /* local re-fit still applied; sync retries on next save */ }
    }
  }, [plan, planCreatedAt, completion, planId, hoursPerDay])

  const loadPlan = useCallback(async (id: string) => {
    setLoading(true); setError(null)
    try {
      const r = await authFetch(`/api/exam-planner/${id}`)
      if (!r.ok) throw new Error('Load failed')
      const row = await r.json()
      setPlan(row.plan_json)
      setPlanId(row.id)
      setCompletion(row.completion_state || {})
      setPlanCreatedAt(Date.parse(row.created_at) || null)
      setExam(row.exam); setExamDate(row.exam_date); setHoursPerDay(row.hours_per_day)
      setShowSavedList(false)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  const toggleCheckin = useCallback(async (week: number, day: string, idx: number) => {
    const key = blockKey(week, day, idx)
    const nextDone = !completion[key]
    setCompletion(prev => {
      const c = { ...prev }
      if (nextDone) c[key] = true
      else delete c[key]
      return c
    })
    if (!planId) return
    try {
      await authFetch(`/api/exam-planner/${planId}/checkin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...aiHeaders() },
        body: JSON.stringify({ block_key: key, done: nextDone }),
      })
    } catch {  }
  }, [completion, planId])

  const submitMock = useCallback(async () => {
    if (!plan) return
    setShowMockForm(false); setLoading(true); setError(null)
    try {
      if (planId) {
        await authFetch(`/api/exam-planner/${planId}/mock`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...aiHeaders() },
          body: JSON.stringify({ score: mockScore, note: mockNote }),
        })
      }
      const completionPct = plan.weeklySchedule
        ? Math.round((Object.keys(completion).length /
            Math.max(1, plan.weeklySchedule.reduce((n, w) =>
              n + (w.days || []).reduce((m, d) => m + (d.blocks || []).length, 0), 0))) * 100)
        : 50
      const r = await fetch('/api/exam-planner/replan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...aiHeaders() },
        body: JSON.stringify({
          previousPlan: plan,
          mockScore, completionPercent: completionPct,
          strugglingTopics: weakAreas.split(',').map(s => s.trim()).filter(Boolean),
          hoursPerDay, examDate,
        }),
      })
      if (!r.ok) throw new Error('Replan failed (' + r.status + ')')
      const newPlan = await r.json()
      setPlan(newPlan); setCompletion({})
      if (planId) {
        await authFetch(`/api/exam-planner/${planId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...aiHeaders() },
          body: JSON.stringify({ plan_json: newPlan, hours_per_day: hoursPerDay }),
        })
      }
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [plan, planId, mockScore, mockNote, completion, weakAreas, hoursPerDay, examDate])

  // Clearing the date input gives new Date('') -> NaN, and Math.max(0, NaN) is
  // NaN, so the header used to read "NaN days until your exam".
  const examTime = new Date(examDate).getTime()
  const daysLeft = Number.isFinite(examTime)
    ? Math.max(0, Math.round((examTime - Date.now()) / 86400000))
    : 0

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto', color: '#fafafa', height: '100%', overflowY: 'auto', boxSizing: 'border-box', width: '100%' }}>
      <style>{PRINT_STYLE}</style>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: '#A5B4FC', marginBottom: 8, fontWeight: 700 }}>
            Exam Planner
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, letterSpacing: -0.5 }}>
            What are you preparing for?
          </h1>
          <p style={{ color: '#9CA3AF', fontSize: 14, marginTop: 8 }}>
            Pick an exam, set your timeline, get a syllabus-aware plan in seconds.
          </p>
        </div>
        {savedPlans.length > 0 && (
          <button className="kyno-ghost" onClick={() => setShowSavedList(s => !s)} style={btnGhost}>
            <Folder size={13} /> Saved plans ({savedPlans.length})
          </button>
        )}
      </div>

      {/* The syllabus map absorbs into Exam Planner (brief part D-1): coverage
          and retention are one model, and this is where a student already
          comes to think about the whole syllabus. Renders nothing when no
          graph is seeded for their board/class. */}
      <SyllabusMap />

      <AnimatePresence>
        {showSavedList && (
          <motion.div id="exam-planner-saved"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ ...card, padding: 16, marginBottom: 16, overflow: 'hidden' }}
          >
            <h3 style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#A5B4FC', margin: '0 0 12px' }}>
              Your saved plans
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {savedPlans.map(p => {
                const done = Object.keys(p.completion_state || {}).length
                const lastMock = (p.mock_scores || []).at(-1)
                return (
                  <button key={p.id}
                    onClick={() => loadPlan(p.id)}
                    style={{
                      ...card, padding: 12, textAlign: 'left', cursor: 'pointer',
                      borderColor: planId === p.id ? 'rgba(165,180,252,0.55)' : undefined,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa', marginBottom: 4 }}>
                      {(exams.find(e => e.id === p.exam) || { label: p.exam }).label}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                      Exam: {p.exam_date} · {p.hours_per_day}h/day
                    </div>
                    <div style={{ fontSize: 10, color: '#A5B4FC', marginTop: 6, letterSpacing: 1 }}>
                      ✓ {done} blocks {lastMock ? `· last mock ${lastMock.score}%` : ''}
                    </div>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div id="exam-planner-form" style={{ ...card, padding: 24, marginBottom: 24 }}>
        <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div>
            <label style={lbl}><Target size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Exam</label>
            <select style={inp} value={exam} onChange={e => setExam(e.target.value)}>
              {exams.length === 0 && <option value="jee-main">JEE Main</option>}
              {exams.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}><Calendar size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Exam date</label>
            <input style={inp} type="date" value={examDate} onChange={e => setExamDate(e.target.value)} />
          </div>
          <div>
            <label style={lbl}><Clock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Hours per day · {hoursPerDay}h</label>
            <input type="range" min={1} max={12} step={0.5}
              value={hoursPerDay}
              onChange={e => {
                // An emptied number input parses to NaN, which then poisoned
                // every "hours × days" figure on the page.
                const v = parseFloat(e.target.value)
                setHoursPerDay(Number.isFinite(v) ? Math.min(24, Math.max(0, v)) : 0)
              }}
              style={{ width: '100%', accentColor: '#7C5CFF', height: 6, cursor: 'pointer' }}
            />
          </div>
          <div>
            <label style={lbl}>Your current level</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['beginner', 'mid', 'strong'] as const).map(L => (
                <button className="kyno-chip" key={L} onClick={() => setCurrentLevel(L)}
                  style={{
                    flex: 1, padding: '9px 0', fontSize: 12, fontWeight: 700,
                    background: currentLevel === L ? 'rgba(124, 92, 255,0.22)' : '#141A2A',
                    color: currentLevel === L ? '#fff' : '#A1A1AA',
                    border: '1.5px solid ' + (currentLevel === L ? '#7C5CFF' : '#1f2532'),
                    boxShadow: currentLevel === L ? '0 2px 10px rgba(124, 92, 255,0.28)' : 'none',
                    borderRadius: 8, cursor: 'pointer', textTransform: 'capitalize', letterSpacing: 0.5,
                    transition: 'all 0.15s',
                  }}
                >{L}</button>
              ))}
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>
              <AlertTriangle size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Weak topics
              <span style={{ color: '#A5B4FC', textTransform: 'none', marginLeft: 6, fontSize: 10 }}>
                <Brain size={10} style={{ verticalAlign: 'middle' }} /> auto-filled from your memory
              </span>
            </label>
            <input style={inp} placeholder="e.g. Rotational Mechanics, Organic Reactions"
              value={weakAreas} onChange={e => setWeakAreas(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 }}>
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>
            <b style={{ color: '#A5B4FC' }}>{daysLeft}</b> days until your exam · {hoursPerDay}h × {daysLeft} = <b style={{ color: '#fafafa' }}>{(hoursPerDay * daysLeft).toFixed(0)}h</b> total prep
          </div>
          <button onClick={generate} disabled={loading} className="kyno-chunky" style={btnPrimary}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? 'Planning…' : (plan ? 'Re-generate' : 'Generate plan')}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(255,77,109,0.10)', border: '1px solid rgba(255,77,109,0.30)', borderRadius: 8, color: '#ff8aa0', fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>

      {loading && !plan && (
        <KairoGyro fullPage label="Building your exam plan" sub="priorities · schedule · milestones" />
      )}

      <AnimatePresence>
        {plan && (
          <motion.div id="exam-planner-plan"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.32 }}
          >
            <div id="exam-planner-actions" style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <button className="kyno-ghost" onClick={savePlan} style={btnGhost}>
                <Save size={13} /> {planId ? 'Saved' : 'Save plan'}
              </button>
              <button className="kyno-ghost" onClick={() => window.print()} style={btnGhost}>
                <Printer size={13} /> Export PDF
              </button>
              <button className="kyno-ghost" onClick={() => setShowMockForm(s => !s)} style={btnGhost}>
                <RefreshCw size={13} /> Log mock + re-plan
              </button>
            </div>

            <AnimatePresence>
              {showMockForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ ...card, padding: 16, marginBottom: 14, overflow: 'hidden' }}
                >
                  <h3 style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#A5B4FC', margin: '0 0 10px' }}>
                    How did your mock test go?
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={lbl}>Score % · {mockScore}</label>
                      <input type="range" min={0} max={100} step={1}
                        value={mockScore} onChange={e => setMockScore(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: '#A5B4FC' }}
                      />
                    </div>
                    <div>
                      <label style={lbl}>Notes (optional)</label>
                      <input style={inp} placeholder="weak on Org Chem, time issues"
                        value={mockNote} onChange={e => setMockNote(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    <button onClick={submitMock} disabled={loading} className="kyno-chunky" style={btnPrimary}>
                      <Sparkles size={13} /> Re-plan based on this
                    </button>
                    <button className="kyno-ghost" onClick={() => setShowMockForm(false)} style={btnGhost}>
                      <X size={13} /> Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ ...card, padding: 18, marginBottom: 16, borderColor: 'rgba(165,180,252,0.30)' }}>
              <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#A5B4FC', fontWeight: 700, marginBottom: 6 }}>Strategy</div>
              <div style={{ fontSize: 15, lineHeight: 1.5, color: '#fafafa' }}>{plan.summary}</div>
            </div>

            <div style={{ ...card, padding: 18, marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#A5B4FC', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={14} /> Topic Priorities
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                {plan.topicPriorities?.map((t, i) => (
                  <div key={i} style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>{t.topic}</div>
                      <div style={weightChip(t.weight)}>{t.weight}</div>
                    </div>
                    <div style={{ fontSize: 11, color: '#A5B4FC', marginBottom: 4 }}>{t.subject}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.4 }}>{t.reason}</div>
                  </div>
                ))}
              </div>
            </div>

            {behind > 0 && (
              <div style={{
                ...card, padding: 16, marginBottom: 16,
                border: '1px solid rgba(255,176,32,0.35)', background: 'rgba(255,176,32,0.05)',
              }}>
                <div style={{ fontSize: 12.5, color: '#B1B5BA', lineHeight: 1.6, marginBottom: 10 }}>
                  <b style={{ color: '#fafafa' }}>{behind} planned block{behind === 1 ? '' : 's'} slipped past.</b>{' '}
                  Completely normal — plans meet real weeks. One tap spreads them over the days you
                  have left, most important first, without overloading any single day.
                </div>
                <button className="kyno-chunky" onClick={refit} style={{ padding: '9px 16px', fontSize: 12 }}>
                  Re-fit my plan
                </button>
              </div>
            )}

            <div style={{ ...card, padding: 18, marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#A5B4FC', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={14} /> Weekly schedule
                <span style={{ fontSize: 10, color: '#A1A1AA', fontWeight: 500, letterSpacing: 1, marginLeft: 6 }}>
                  · click a block to mark done
                </span>
              </h3>
              {plan.weeklySchedule?.map(wk => (
                <div key={wk.week} style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 999, background: 'rgba(124, 92, 255,0.22)', color: '#A5B4FC', letterSpacing: 1 }}>
                      WEEK {wk.week}
                    </div>
                    <div style={{ fontSize: 13, color: '#fafafa', fontWeight: 600 }}>{wk.focus}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                    {wk.days?.map(day => (
                      <div key={day.day} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: 10, letterSpacing: 2, color: '#A5B4FC', fontWeight: 700, marginBottom: 6 }}>{day.day}</div>
                        {day.blocks?.map((b, i) => {
                          const key = blockKey(wk.week, day.day, i)
                          const done = !!completion[key]
                          return (
                            <button key={i}
                              onClick={() => toggleCheckin(wk.week, day.day, i)}
                              style={{
                                width: '100%', textAlign: 'left', cursor: 'pointer',
                                background: 'transparent', border: 'none',
                                marginBottom: 6, paddingLeft: 8, paddingRight: 4,
                                borderLeft: `2px solid ${blockTypeColor(b.type)}`,
                                opacity: done ? 0.42 : 1,
                                textDecoration: done ? 'line-through' : 'none',
                                color: 'inherit',
                              }}
                            >
                              <div style={{ fontSize: 10, color: '#9CA3AF' }}>
                                {done && <Check size={9} style={{ marginRight: 3, color: '#A5B4FC' }} />}
                                {b.time}
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: '#fafafa', lineHeight: 1.3 }}>{b.topic}</div>
                              <div style={{ fontSize: 9, color: blockTypeColor(b.type), letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>
                                {b.subject} · {b.type}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ ...card, padding: 18 }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#A5B4FC', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Trophy size={14} /> Milestones
                </h3>
                {plan.milestones?.map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
                    <div style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 10, background: 'rgba(255,180,74,0.16)', border: '1px solid rgba(255,180,74,0.40)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffd180', fontSize: 11, fontWeight: 800 }}>
                      D{m.atDay}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>{m.checkpoint}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>{m.target}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ ...card, padding: 18 }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#A5B4FC', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ChevronRight size={14} /> Answer strategy
                </h3>
                <div style={{ fontSize: 13, lineHeight: 1.55, color: '#fafafa', marginBottom: 12 }}>{plan.answerStrategy}</div>
                <div style={{ fontSize: 12, lineHeight: 1.55, color: '#9CA3AF', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                  💡 {plan.tips}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
