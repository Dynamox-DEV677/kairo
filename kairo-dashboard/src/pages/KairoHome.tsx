/**
 * Kairo Home — the AI Student Operating System command center.
 *
 * The screen a student sees on login: a time-aware greeting, exam
 * countdowns, an AI-generated daily mission + mentor note, a weakness
 * radar, a score prediction (current → potential), and a streak +
 * motivation meter. Driven by a localStorage student profile and the
 * /api/council/brief endpoint (the "AI Council").
 *
 * Deep features (Knowledge Graph, Memory Brain, Mistake Analysis) live
 * on their own pages — this home links into them.
 */
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles, Loader2, Flame, Brain, Target, TrendingUp, Calendar,
  AlertTriangle, CheckCircle2, Settings2, Network, History, Gauge, ArrowRight,
} from 'lucide-react'
import KairoGyro from '../components/KairoGyro'
import { GameBar } from '../components/GameBar'

// ── Profile (localStorage) ─────────────────────────────────────────────
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
      // The account name (kairo_profile, edited in Settings) always wins —
      // the copy cached in this store goes stale when the name changes.
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
  const d = new Date(); d.setDate(d.getDate() + 128)
  const n = new Date(); n.setDate(n.getDate() + 245)
  // Try to reuse the logged-in name from kairo_profile
  let name = 'Student'
  try { const p = JSON.parse(localStorage.getItem('kairo_profile') || '{}'); name = p.name || p.full_name || 'Student' } catch {}
  return {
    name,
    exam: 'jee',
    examDates: [
      { name: 'JEE Main', date: d.toISOString().slice(0, 10) },
      { name: 'NEET', date: n.toISOString().slice(0, 10) },
    ],
    goal: 'Master Rotational Motion',
    weakTopics: ['Rotational Motion', 'Organic Reactions', 'Thermodynamics'],
    strongTopics: ['Kinematics', 'Cell Biology'],
    streak: 1,
    studyHours: 4,
    recentAccuracy: 62,
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

// ── Styles ──────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(14px) saturate(140%)',
  WebkitBackdropFilter: 'blur(14px) saturate(140%)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 16,
}
const lbl: React.CSSProperties = {
  fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2,
}
const inp: React.CSSProperties = {
  background: '#0E1117', border: '1px solid #1f2532', borderRadius: 8,
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
    try {
      const r = await fetch('/api/council/brief', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      if (!r.ok) throw new Error('Server returned ' + r.status)
      const data = await r.json()
      if (data.error) throw new Error(data.error)
      setBrief(data)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }, [profile])

  // Auto-load the brief once on mount
  useEffect(() => { fetchBrief() /* eslint-disable-next-line */ }, [])

  // Home stays mounted while the user is in Settings — re-read the profile
  // when Settings saves a new name so the greeting updates immediately.
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
      {/* ── Greeting header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: 0, letterSpacing: -0.5 }}>
            {greetingFor()}, <span style={{ color: '#66D9FF' }}>{profile.name}.</span>
          </h1>
          <p style={{ color: '#9CA3AF', fontSize: 14, marginTop: 6 }}>
            {brief?.greetingNote || 'Your AI council is reading your progress…'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setEditing(e => !e)} style={ghostBtn}>
            <Settings2 size={13} /> Profile
          </button>
          <button onClick={fetchBrief} disabled={loading} style={primaryBtn}>
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

      {/* ── Profile editor (collapsible) ────────────────────────────── */}
      {editing && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ ...card, padding: 18, marginBottom: 18, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
            <div><div style={lbl}>Name</div><input style={inp} value={profile.name} onChange={e => {
              saveProfile({ ...profile, name: e.target.value })
              // Write through to the account profile so Settings / the rest
              // of the app show the same name (loadProfile prefers it).
              try {
                const p = JSON.parse(localStorage.getItem('kairo_profile') || '{}')
                localStorage.setItem('kairo_profile', JSON.stringify({ ...p, name: e.target.value }))
              } catch {}
            }} onBlur={async e => {
              // Sync to the Supabase users row once, when done typing —
              // App.tsx re-reads it on refresh and would revert otherwise.
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
            </div>
          </div>
          <button onClick={() => { setEditing(false); fetchBrief() }} style={{ ...primaryBtn, marginTop: 12 }}>Save & re-brief</button>
        </motion.div>
      )}

      {/* ── Game bar: level · daily quests · weekly league ──────────── */}
      <GameBar />

      {/* ── Council thinking — gyro while the first brief loads ─────── */}
      {loading && !brief && (
        <div style={{ padding: '28px 0 8px' }}>
          <KairoGyro fullPage label="Your council is thinking" sub="mentor · planner · analyst · exam · motivation · memory" />
        </div>
      )}

      {/* ── Top row: exam countdown + prediction + motivation ───────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr 0.8fr', gap: 16, marginBottom: 16 }}>
        {/* Exam countdowns */}
        <div style={{ ...card, padding: 18 }}>
          <div style={{ ...lbl, color: '#66D9FF', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={12} /> Exam tracker</div>
          {(brief?.examDates || profile.examDates.map(e => ({ ...e, days: Math.max(0, Math.round((+new Date(e.date) - Date.now()) / 86400000)) }))).map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 14, color: '#fafafa', fontWeight: 600 }}>{e.name}</span>
              <span><b style={{ fontSize: 24, fontWeight: 900, color: e.days < 30 ? '#ff4d6d' : '#66D9FF' }}>{e.days}</b> <span style={{ fontSize: 11, color: '#9CA3AF' }}>days</span></span>
            </div>
          ))}
        </div>

        {/* AI Prediction */}
        <div style={{ ...card, padding: 18 }}>
          <div style={{ ...lbl, color: '#66D9FF', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp size={12} /> AI prediction</div>
          {brief ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: '#fafafa' }}>{brief.predictedScore}</span>
                <ArrowRight size={18} style={{ color: '#5B616E' }} />
                <span style={{ fontSize: 36, fontWeight: 900, color: '#66ff9a' }}>{brief.potentialScore}</span>
                <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 4 }}>/ {brief.scoreScale}</span>
              </div>
              {/* progress bar current vs potential */}
              <div style={{ height: 8, background: '#0E1117', borderRadius: 4, marginTop: 12, overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, brief.predictedScore / +brief.scoreScale * 100)}%`, background: '#4F7CFF' }} />
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, brief.potentialScore / +brief.scoreScale * 100)}%`, background: 'rgba(102,255,154,0.25)', zIndex: -0 }} />
              </div>
              <div style={{ fontSize: 12, color: '#ff8aa0', marginTop: 10 }}>
                Fix first: <b>{brief.mainWeakness}</b>
              </div>
            </>
          ) : <div style={{ color: '#5B616E', fontSize: 13 }}>—</div>}
        </div>

        {/* Motivation + streak */}
        <div style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ ...lbl, color: '#ffb44a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Gauge size={12} /> Motivation</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#ffb44a' }}>{brief?.motivation ?? '—'}<span style={{ fontSize: 16 }}>%</span></div>
            <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'capitalize' }}>{brief?.trend || ''}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Flame size={20} style={{ color: '#ff7a4a' }} />
            <span><b style={{ fontSize: 22, fontWeight: 900 }}>{profile.streak}</b> <span style={{ fontSize: 11, color: '#9CA3AF' }}>day streak</span></span>
          </div>
        </div>
      </div>

      {/* ── Today's mission + mentor note ───────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ ...card, padding: 18, borderColor: 'rgba(102,217,255,0.25)' }}>
          <div style={{ ...lbl, color: '#66D9FF', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}><Target size={12} /> Today's focus</div>
          {brief?.todaysFocus?.length ? brief.todaysFocus.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0, width: 8, height: 8, borderRadius: '50%', background: '#66D9FF', marginTop: 7 }} />
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

      {/* ── Weakness radar ──────────────────────────────────────────── */}
      <div style={{ ...card, padding: 18, marginBottom: 16 }}>
        <div style={{ ...lbl, color: '#ff8aa0', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={12} /> Weakness radar</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[...profile.weakTopics.map(t => ({ t, s: 'weak' })), ...profile.strongTopics.map(t => ({ t, s: 'strong' }))].map((x, i) => (
            <span key={i} style={{
              fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 999,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              color: x.s === 'weak' ? '#ff8aa0' : '#66ff9a',
              background: x.s === 'weak' ? 'rgba(255,77,109,0.12)' : 'rgba(102,255,154,0.10)',
              border: '1px solid ' + (x.s === 'weak' ? 'rgba(255,77,109,0.35)' : 'rgba(102,255,154,0.30)'),
            }}>
              {x.s === 'weak' ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}{x.t}
            </span>
          ))}
        </div>
      </div>

      {/* ── Deep-dive links into the rest of the council ────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        {[
          { v: 'topic-architect', icon: Target,  title: 'Topic Architect', sub: 'Plan any topic end-to-end' },
          { v: 'knowledge',       icon: Network, title: 'Memory Graph',    sub: 'See your knowledge grow' },
          { v: 'mistakes',        icon: History, title: 'Mistake Intel',   sub: 'Why you got it wrong' },
          { v: 'exam-planner',    icon: Calendar,title: 'Exam Planner',    sub: 'Your road to the date' },
        ].map((q, i) => {
          const Icon = q.icon
          return (
            <button key={i} onClick={() => go(q.v)} style={{ ...card, padding: 16, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Icon size={18} style={{ color: '#66D9FF' }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fafafa' }}>{q.title}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>{q.sub}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const ghostBtn: React.CSSProperties = {
  background: 'transparent', color: '#A1A1AA', border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
}
const primaryBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg, #4F7CFF 0%, #66D9FF 100%)', color: '#fff', border: 'none',
  borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'inherit',
  boxShadow: '0 6px 20px rgba(79,124,255,0.30)',
}
