import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles, Loader2, Flame, Brain, Target, TrendingUp, Calendar,
  AlertTriangle, CheckCircle2, Settings2, Network, History, Gauge, ArrowRight,
} from 'lucide-react'
import KairoGyro from '../components/KairoGyro'
import { GameBar } from '../components/GameBar'
import { getProfile, getMistakes } from '../lib/twin'
import { loadGame } from '../lib/game'

interface ExamDate { name: string; date: string }
interface Profile {
  name: string
  exam: 'jee' | 'neet'
  examDates: ExamDate[]
  goal: string
  weakTopics: string[]
  strongTopics: string[]
  streak: number
  studyHours: number
  recentAccuracy: number | null
}
const PROFILE_KEY = 'kairo_student_profile'
function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (raw) {
      const saved = { ...defaultProfile(), ...JSON.parse(raw) }
      try {
        const p = JSON.parse(localStorage.getItem('kairo_profile') || '{}')
        if (p.name) saved.name = p.name
      } catch {}
      return saved
    }
  } catch {}
  return defaultProfile()
}
function defaultProfile(): Profile {
  let name = 'Student', goal = '', weak: string[] = [], strong: string[] = [], exam: 'jee' | 'neet' = 'jee'
  try { const p = JSON.parse(localStorage.getItem('kairo_profile') || '{}'); name = p.name || p.full_name || 'Student' } catch {}
  try {
    const kp = getProfile()
    if (kp) {
      name = kp.nickname || kp.name || name
      goal = kp.goal || ''
      weak = kp.weak || []
      strong = kp.strong || []
      if (/neet/i.test(kp.goal || '')) exam = 'neet'
    }
  } catch {}
  return {
    name, exam, examDates: [], goal, weakTopics: weak, strongTopics: strong,
    streak: 0, studyHours: 0, recentAccuracy: null,
  }
}

interface Brief {
  greetingNote: string
  todaysFocus: { task: string; subject: string; why: string }[]
  mentorNote: string
  predictedScore: number
  potentialScore: number
  scoreScale: string
  mainWeakness: string
  motivation: number
  trend: 'improving' | 'steady' | 'dipping'
  examDates: (ExamDate & { days: number })[]
  nextExam: (ExamDate & { days: number }) | null
}

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(14px) saturate(140%)',
  WebkitBackdropFilter: 'blur(14px) saturate(140%)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 16,
}
const lbl: React.CSSProperties = {
  fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2,
}
const inp: React.CSSProperties = {
  background: '#141A2A', border: '1px solid #1f2532', borderRadius: 8,
  padding: '8px 11px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit',
  outline: 'none', width: '100%', boxSizing: 'border-box',
}
const subjStatus = (t: string, weak: string[], strong: string[]) =>
  weak.some(w => t.toLowerCase().includes(w.toLowerCase()) || w.toLowerCase().includes(t.toLowerCase())) ? 'weak'
  : strong.some(s => t.toLowerCase().includes(s.toLowerCase())) ? 'strong' : 'mixed'

function greetingFor() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

interface Props { onNavigate?: (view: string) => void }

export default function KairoHome({ onNavigate }: Props) {
  const [profile, setProfile] = useState<Profile>(loadProfile)
  const [brief, setBrief] = useState<Brief | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const saveProfile = useCallback((p: Profile) => {
    setProfile(p)
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)) } catch {}
  }, [])

  const fetchBrief = useCallback(async () => {
    setLoading(true); setError(null)

    const attempt = async () => {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 30000)
      try {
        const r = await fetch('/api/council/brief', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile), signal: ctrl.signal,
        })
        if (!r.ok) throw new Error('Server returned ' + r.status)
        const data = await r.json()
        if (data.error) throw new Error(data.error)
        return data
      } finally { clearTimeout(timer) }
    }

    try {
      let data
      try {
        data = await attempt()
      } catch {
        data = await attempt()
      }
      setBrief(data)
    } catch {
      setError("Couldn't reach your AI council just now. Tap “Refresh brief” to try again — everything else still works.")
    } finally { setLoading(false) }
  }, [profile])

  useEffect(() => { fetchBrief() /* eslint-disable-next-line */ }, [])

  useEffect(() => {
    const onProfile = () => setProfile(loadProfile())
    window.addEventListener('kairo:profile', onProfile)
    return () => window.removeEventListener('kairo:profile', onProfile)
  }, [])

  const nextExam = brief?.nextExam || (profile.examDates
    .map(e => ({ ...e, days: Math.max(0, Math.round((+new Date(e.date) - Date.now()) / 86400000)) }))
    .sort((a, b) => a.days - b.days)[0])

  const go = (v: string) => {
    if (onNavigate) return onNavigate(v)
    const setter = (window as any).__kairoSetActive
    if (typeof setter === 'function') setter(v)
  }

  return (
    <div style={{ padding: 24, maxWidth: 1150, margin: '0 auto', color: '#fafafa', height: '100%', overflowY: 'auto', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 36, fontWeight: 900, margin: 0, letterSpacing: -0.6, fontFamily: 'var(--kyno-display)' }}>
            {greetingFor()}, <span style={{ color: '#7C5CFF' }}>{profile.name}.</span>
          </h1>
          <p style={{ color: '#9CA3AF', fontSize: 14, marginTop: 6 }}>
            {brief?.greetingNote || 'Your AI council is reading your progress…'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setEditing(e => !e)} className="kyno-ghost" style={ghostBtn}>
            <Settings2 size={13} /> Profile
          </button>
          <button onClick={fetchBrief} disabled={loading} className="kyno-chunky" style={primaryBtn}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {loading ? 'Thinking…' : 'Refresh brief'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(255,77,109,0.10)', border: '1px solid rgba(255,77,109,0.30)', borderRadius: 8, color: '#ff8aa0', fontSize: 13 }}>
          {error}
        </div>
      )}

      {editing && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ ...card, padding: 18, marginBottom: 18, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
            <div><div style={lbl}>Name</div><input style={inp} value={profile.name} onChange={e => {
              saveProfile({ ...profile, name: e.target.value })
              try {
                const p = JSON.parse(localStorage.getItem('kairo_profile') || '{}')
                localStorage.setItem('kairo_profile', JSON.stringify({ ...p, name: e.target.value }))
              } catch {}
            }} onBlur={async e => {
              try {
                const p = JSON.parse(localStorage.getItem('kairo_profile') || '{}')
                if (p.id && !p.localMode) {
                  const { supabase } = await import('../lib/supabase')
                  await supabase.from('users').update({ name: e.target.value }).eq('id', p.id)
                }
              } catch {}
            }} /></div>
            <div><div style={lbl}>Primary exam</div>
              <select style={inp} value={profile.exam} onChange={e => saveProfile({ ...profile, exam: e.target.value as any })}>
                <option value="jee">JEE</option><option value="neet">NEET</option>
              </select>
            </div>
            <div><div style={lbl}>Goal</div><input style={inp} value={profile.goal} onChange={e => saveProfile({ ...profile, goal: e.target.value })} /></div>
            <div><div style={lbl}>Study hours/day</div><input style={inp} type="number" value={profile.studyHours} onChange={e => saveProfile({ ...profile, studyHours: +e.target.value })} /></div>
            <div><div style={lbl}>Streak (days)</div><input style={inp} type="number" value={profile.streak} onChange={e => saveProfile({ ...profile, streak: +e.target.value })} /></div>
            <div><div style={lbl}>Recent accuracy %</div><input style={inp} type="number" value={profile.recentAccuracy ?? ''} onChange={e => saveProfile({ ...profile, recentAccuracy: e.target.value === '' ? null : +e.target.value })} /></div>
            <div style={{ gridColumn: '1 / -1' }}><div style={lbl}>Weak topics (comma-sep)</div><input style={inp} value={profile.weakTopics.join(', ')} onChange={e => saveProfile({ ...profile, weakTopics: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></div>
            <div style={{ gridColumn: '1 / -1' }}><div style={lbl}>Strong topics (comma-sep)</div><input style={inp} value={profile.strongTopics.join(', ')} onChange={e => saveProfile({ ...profile, strongTopics: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></div>
            <div style={{ gridColumn: '1 / -1' }}><div style={lbl}>Exam dates</div>
              {profile.examDates.map((ex, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <input style={{ ...inp, flex: 2 }} value={ex.name} onChange={e => { const a = [...profile.examDates]; a[i] = { ...a[i], name: e.target.value }; saveProfile({ ...profile, examDates: a }) }} />
                  <input style={{ ...inp, flex: 1 }} type="date" value={ex.date} onChange={e => { const a = [...profile.examDates]; a[i] = { ...a[i], date: e.target.value }; saveProfile({ ...profile, examDates: a }) }} />
                </div>
              ))}
              <button onClick={() => saveProfile({ ...profile, examDates: [...profile.examDates, { name: 'My exam', date: '' }] })} className="kyno-ghost" style={{ ...ghostBtn, marginTop: 4 }}>+ Add exam</button>
            </div>
          </div>
          <button onClick={() => { setEditing(false); fetchBrief() }} className="kyno-chunky" style={{ ...primaryBtn, marginTop: 12 }}>Save & re-brief</button>
        </motion.div>
      )}

      <GameBar />

      {loading && !brief && (
        <div style={{ padding: '28px 0 8px' }}>
          <KairoGyro fullPage label="Your council is thinking" sub="mentor · planner · analyst · exam · motivation · memory" />
        </div>
      )}

      <div className="kg-gamebar" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr 0.8fr', gap: 16, marginBottom: 16 }}>
        <div style={{ ...card, padding: 18 }}>
          <div style={{ ...lbl, color: '#A5B4FC', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={12} /> Exam tracker</div>
          {(() => {
            const list = brief?.examDates || profile.examDates
              .filter(e => e.date)
              .map(e => ({ ...e, days: Math.max(0, Math.round((+new Date(e.date) - Date.now()) / 86400000)) }))
            if (!list.length) return (
              <button onClick={() => setEditing(true)} className="kyno-ghost" style={{ ...ghostBtn, width: '100%', justifyContent: 'center' }}>
                <Calendar size={13} /> Add your exam date
              </button>
            )
            return list.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 14, color: '#fafafa', fontWeight: 600 }}>{e.name}</span>
                <span><b style={{ fontSize: 24, fontWeight: 900, color: e.days < 30 ? '#ff4d6d' : '#A5B4FC' }}>{e.days}</b> <span style={{ fontSize: 11, color: '#9CA3AF' }}>days</span></span>
              </div>
            ))
          })()}
        </div>

        <div style={{ ...card, padding: 18 }}>
          <div style={{ ...lbl, color: '#A5B4FC', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp size={12} /> AI prediction</div>
          {brief ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: '#fafafa' }}>{brief.predictedScore}</span>
                <ArrowRight size={18} style={{ color: '#5B616E' }} />
                <span style={{ fontSize: 36, fontWeight: 900, color: '#66ff9a' }}>{brief.potentialScore}</span>
                <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 4 }}>/ {brief.scoreScale}</span>
              </div>
              <div style={{ height: 8, background: '#141A2A', borderRadius: 4, marginTop: 12, overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, brief.predictedScore / +brief.scoreScale * 100)}%`, background: '#7C5CFF' }} />
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, brief.potentialScore / +brief.scoreScale * 100)}%`, background: 'rgba(102,255,154,0.25)', zIndex: -0 }} />
              </div>
              <div style={{ fontSize: 12, color: '#ff8aa0', marginTop: 10 }}>
                Fix first: <b>{brief.mainWeakness}</b>
              </div>
            </>
          ) : <div style={{ color: '#5B616E', fontSize: 13 }}>—</div>}
        </div>

        <div style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ ...lbl, color: '#ffb44a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Gauge size={12} /> Motivation</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#ffb44a' }}>{brief?.motivation ?? '—'}<span style={{ fontSize: 16 }}>%</span></div>
            <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'capitalize' }}>{brief?.trend || ''}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Flame size={20} style={{ color: '#ff7a4a' }} />
            <span><b style={{ fontSize: 22, fontWeight: 900 }}>{loadGame().streak}</b> <span style={{ fontSize: 11, color: '#9CA3AF' }}>day streak</span></span>
          </div>
        </div>
      </div>

      <div className="kg-gamebar" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ ...card, padding: 18, borderColor: 'rgba(165,180,252,0.25)' }}>
          <div style={{ ...lbl, color: '#A5B4FC', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}><Target size={12} /> Today's focus</div>
          {brief?.todaysFocus?.length ? brief.todaysFocus.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0, width: 8, height: 8, borderRadius: '50%', background: '#A5B4FC', marginTop: 7 }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fafafa' }}>{f.task}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}><span style={{ color: '#A5B4FC' }}>{f.subject}</span> · {f.why}</div>
              </div>
            </div>
          )) : <div style={{ color: '#5B616E', fontSize: 13 }}>Refresh to generate today's mission.</div>}
        </div>
        <div style={{ ...card, padding: 18 }}>
          <div style={{ ...lbl, color: '#A5B4FC', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Brain size={12} /> Mentor note</div>
          <div style={{ fontSize: 14, lineHeight: 1.55, color: '#fafafa' }}>{brief?.mentorNote || '—'}</div>
        </div>
      </div>

      <div style={{ ...card, padding: 18, marginBottom: 16 }}>
        <div style={{ ...lbl, color: '#ff8aa0', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={12} /> Weakness radar</div>
        {(() => {
          let weak = profile.weakTopics
          if (!weak.length) { try { weak = getMistakes().slice(0, 8).map(m => (m.topic || '').replace(/^\w/, c => c.toUpperCase())) } catch {  } }
          const items = [...weak.map(t => ({ t, s: 'weak' as const })), ...profile.strongTopics.map(t => ({ t, s: 'strong' as const }))]
          if (!items.length) return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px' }}>
              <Gauge size={18} style={{ color: '#6B7280', flexShrink: 0 }} />
              <div style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.5 }}>
                No weak spots yet — take a quiz or ask Kyno a doubt, and your radar fills in automatically.
              </div>
            </div>
          )
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {items.map((x, i) => (
                <span key={i} style={{
                  fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 999,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  color: x.s === 'weak' ? '#ff8aa0' : '#66ff9a',
                  background: x.s === 'weak' ? 'rgba(255,138,160,0.12)' : 'rgba(102,255,154,0.10)',
                  border: '1px solid ' + (x.s === 'weak' ? 'rgba(255,138,160,0.35)' : 'rgba(102,255,154,0.30)'),
                }}>
                  {x.s === 'weak' ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}{x.t}
                </span>
              ))}
            </div>
          )
        })()}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        {[
          { v: 'topic-architect', icon: Target,  title: 'Topic Architect', sub: 'Plan any topic end-to-end' },
          { v: 'knowledge',       icon: Network, title: 'Memory Graph',    sub: 'See your knowledge grow' },
          { v: 'mistakes',        icon: History, title: 'Mistake Intel',   sub: 'Why you got it wrong' },
          { v: 'exam-planner',    icon: Calendar,title: 'Exam Planner',    sub: 'Your road to the date' },
        ].map((q, i) => {
          const Icon = q.icon
          return (
            <button key={i} onClick={() => go(q.v)} className="kyno-tile" style={{ padding: 16, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Icon size={18} style={{ color: '#A5B4FC' }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fafafa' }}>{q.title}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>{q.sub}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Layout only — the .kyno-ghost class provides the purple hairline, colour, font and press-down.
const ghostBtn: React.CSSProperties = {
  padding: '9px 16px', fontSize: 12,
  display: 'inline-flex', alignItems: 'center', gap: 6,
}
// Chunky Duolingo-style primary button. Layout only here — the .kyno-chunky class
// provides the violet fill, dark text, thick bottom border and press-down on tap.
const primaryBtn: React.CSSProperties = {
  padding: '11px 18px', fontSize: 13,
  display: 'inline-flex', alignItems: 'center', gap: 7,
}
