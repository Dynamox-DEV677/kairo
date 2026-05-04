/**
 * ParentDashboard — read-only view of the linked child's marks.
 * Parents can ONLY see: exam marks, subject-wise performance, progress.
 * Parents CANNOT see: homework, submissions, tasks, or edit anything.
 */
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3, TrendingUp, TrendingDown, Award, AlertCircle,
  BookOpen, RefreshCw, GraduationCap, Building2, User,
  ChevronUp, ChevronDown, Star, Target,
} from 'lucide-react'
import type { AuthProfile } from './Login'

// ─── API helper ───────────────────────────────────────────────────────────────
function token() { return localStorage.getItem('kairo_token') || '' }
async function api(path: string): Promise<any> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Mark {
  id: string
  subject: string
  exam_name: string
  marks_obtained: number
  total_marks: number
  remarks: string | null
  created_at: string
  teacher?: { id: string; name: string }
}

interface SubjectSummary {
  subject: string
  percentage: number
  total_obtained: number
  total_max: number
  count: number
}

interface Summary {
  average_percentage: number
  total_exams: number
  strong_subjects: string[]
  weak_subjects: string[]
  subjects: SubjectSummary[]
}

interface Student {
  id: string
  name: string
  class_name?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function grade(pct: number) {
  if (pct >= 90) return { label: 'A+', color: '#34d399' }
  if (pct >= 75) return { label: 'A',  color: '#6ee7b7' }
  if (pct >= 60) return { label: 'B',  color: '#60a5fa' }
  if (pct >= 45) return { label: 'C',  color: '#fbbf24' }
  if (pct >= 33) return { label: 'D',  color: '#fb923c' }
  return { label: 'F', color: '#f87171' }
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────
function BarChart({ subjects }: { subjects: SubjectSummary[] }) {
  const max = Math.max(...subjects.map(s => s.percentage), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {subjects.map((s, i) => {
        const g = grade(s.percentage)
        return (
          <motion.div key={s.subject}
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 100, fontSize: 12, color: '#a1a1aa', flexShrink: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.subject}
              </div>
              <div style={{ flex: 1, height: 20, background: '#1a1a1a', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(s.percentage / max) * 100}%` }}
                  transition={{ duration: 0.7, delay: i * 0.06, ease: 'easeOut' }}
                  style={{
                    height: '100%', borderRadius: 4,
                    background: `linear-gradient(90deg, ${g.color}88, ${g.color})`,
                  }}
                />
                <span style={{
                  position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 11, fontWeight: 700, color: '#fafafa',
                }}>
                  {s.percentage}%
                </span>
              </div>
              <div style={{ width: 28, textAlign: 'right', fontSize: 12, fontWeight: 700, color: g.color }}>
                {g.label}
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
interface ParentDashboardProps {
  profile: AuthProfile
  onLogout?: () => void
}

export default function ParentDashboard({ profile, onLogout }: ParentDashboardProps) {
  const [marks, setMarks]     = useState<Mark[]>([])
  const [student, setStudent] = useState<Student | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')
  const [tab, setTab]         = useState<'overview' | 'details'>('overview')
  const [sortSubject, setSortSubject] = useState('')

  const load = useCallback(() => {
    setLoading(true); setErr('')
    api('/parent/marks')
      .then(d => {
        setMarks(d.marks || [])
        setStudent(d.student || null)
        setSummary(d.summary || null)
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const filteredMarks = sortSubject
    ? marks.filter(m => m.subject === sortSubject)
    : marks

  const subjects = summary?.subjects || []

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Top bar */}
      <div style={{
        background: '#111', borderBottom: '1px solid #1e1e1e',
        padding: '0 24px', display: 'flex', alignItems: 'center',
        height: 56, gap: 16,
      }}>
        {profile.school_logo_url
          ? <img src={profile.school_logo_url} alt="school"
              style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} />
          : <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={16} color="#fff" />
            </div>
        }
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fafafa' }}>
            {profile.school_name || 'School'}
          </div>
          <div style={{ fontSize: 11, color: '#52525b' }}>Parent Portal · Read-only</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 12, color: '#71717a' }}>
            {profile.name}
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('kairo_token')
              localStorage.removeItem('kairo_refresh')
              localStorage.removeItem('kairo_profile')
              if (onLogout) onLogout(); else window.location.reload()
            }}
            style={{ background: 'none', border: '1px solid #1e1e1e', borderRadius: 6, padding: '5px 10px',
              color: '#52525b', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#52525b' }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px' }}>
        {/* Child card */}
        {student && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(124,58,237,0.08))',
              border: '1px solid rgba(99,102,241,0.25)', borderRadius: 14, padding: '18px 22px',
              display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#6366f1,#7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <GraduationCap size={24} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fafafa' }}>{student.name}</div>
              <div style={{ fontSize: 13, color: '#818cf8' }}>
                {student.class_name ? `Class ${student.class_name}` : 'Student'}
                {' · '}Your linked child
              </div>
            </div>
            <button onClick={load} style={{ marginLeft: 'auto', background: 'none', border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 8, padding: '6px 10px', color: '#818cf8', cursor: 'pointer' }}>
              <RefreshCw size={13} />
            </button>
          </motion.div>
        )}

        {/* Error */}
        {err && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, color: '#f87171', fontSize: 13 }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            {err}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #1e1e1e', borderTopColor: '#6366f1' }} />
          </div>
        ) : marks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#52525b' }}>
            <BookOpen size={48} style={{ margin: '0 auto 14px', opacity: 0.3 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#71717a' }}>No marks recorded yet</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>
              Marks will appear here once your child's teacher enters them.
            </div>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            {summary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 24 }}>
                <SummaryCard icon={Target} label="Overall Average" value={`${summary.average_percentage}%`}
                  color={grade(summary.average_percentage).color} sub={grade(summary.average_percentage).label} />
                <SummaryCard icon={BookOpen} label="Total Exams" value={summary.total_exams} color="#818cf8" />
                <SummaryCard icon={TrendingUp} label="Strong Subjects"
                  value={summary.strong_subjects.length || '—'}
                  color="#34d399" sub={summary.strong_subjects.slice(0, 2).join(', ') || 'none yet'} />
                <SummaryCard icon={TrendingDown} label="Needs Work"
                  value={summary.weak_subjects.length || '—'}
                  color="#f87171" sub={summary.weak_subjects.slice(0, 2).join(', ') || 'none'} />
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
              {(['overview', 'details'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: tab === t ? 600 : 400,
                  border: tab === t ? '1px solid rgba(99,102,241,0.4)' : '1px solid #1e1e1e',
                  background: tab === t ? 'rgba(99,102,241,0.12)' : '#111',
                  color: tab === t ? '#818cf8' : '#71717a',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {t === 'overview' ? '📊 Subject Overview' : '📋 All Exams'}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {tab === 'overview' && summary && (
                <motion.div key="overview"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                  {/* Performance bar chart */}
                  <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 20, marginBottom: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', marginBottom: 16, display: 'flex', gap: 8 }}>
                      <BarChart3 size={16} color="#6366f1" /> Subject-wise Performance
                    </div>
                    <BarChart subjects={subjects} />
                  </div>

                  {/* Strong / Weak */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)',
                      borderRadius: 12, padding: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399', marginBottom: 10, display: 'flex', gap: 6 }}>
                        <Star size={14} /> Strong Subjects (≥75%)
                      </div>
                      {summary.strong_subjects.length === 0
                        ? <div style={{ fontSize: 12, color: '#52525b' }}>None yet — keep working!</div>
                        : summary.strong_subjects.map(s => (
                          <div key={s} style={{ fontSize: 13, color: '#6ee7b7', marginBottom: 4 }}>✓ {s}</div>
                        ))
                      }
                    </div>
                    <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                      borderRadius: 12, padding: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171', marginBottom: 10, display: 'flex', gap: 6 }}>
                        <AlertCircle size={14} /> Needs Attention (&lt;50%)
                      </div>
                      {summary.weak_subjects.length === 0
                        ? <div style={{ fontSize: 12, color: '#52525b' }}>All subjects doing well 🎉</div>
                        : summary.weak_subjects.map(s => (
                          <div key={s} style={{ fontSize: 13, color: '#fca5a5', marginBottom: 4 }}>⚠ {s}</div>
                        ))
                      }
                    </div>
                  </div>
                </motion.div>
              )}

              {tab === 'details' && (
                <motion.div key="details"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                  {/* Subject filter */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                    <button onClick={() => setSortSubject('')} style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                      border: !sortSubject ? '1px solid #6366f1' : '1px solid #1e1e1e',
                      background: !sortSubject ? 'rgba(99,102,241,0.12)' : '#161616',
                      color: !sortSubject ? '#818cf8' : '#71717a', fontFamily: 'inherit',
                    }}>All</button>
                    {[...new Set(marks.map(m => m.subject))].map(s => (
                      <button key={s} onClick={() => setSortSubject(s === sortSubject ? '' : s)} style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                        border: sortSubject === s ? '1px solid #6366f1' : '1px solid #1e1e1e',
                        background: sortSubject === s ? 'rgba(99,102,241,0.12)' : '#161616',
                        color: sortSubject === s ? '#818cf8' : '#71717a', fontFamily: 'inherit',
                      }}>{s}</button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filteredMarks.map((m, i) => {
                      const pct = Math.round((m.marks_obtained / m.total_marks) * 100)
                      const g   = grade(pct)
                      return (
                        <motion.div key={m.id}
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '14px 16px',
                            display: 'flex', alignItems: 'center', gap: 14 }}>
                          {/* Grade badge */}
                          <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                            background: `${g.color}18`, border: `1px solid ${g.color}44`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, fontWeight: 800, color: g.color }}>
                            {g.label}
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#fafafa' }}>{m.exam_name}</div>
                            <div style={{ fontSize: 12, color: '#52525b' }}>
                              {m.subject}
                              {m.teacher && ` · ${m.teacher.name}`}
                              {' · '}{fmtDate(m.created_at)}
                            </div>
                            {m.remarks && (
                              <div style={{ fontSize: 12, color: '#71717a', marginTop: 3, fontStyle: 'italic' }}>
                                "{m.remarks}"
                              </div>
                            )}
                          </div>

                          {/* Score */}
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: g.color }}>
                              {m.marks_obtained}
                              <span style={{ fontSize: 12, fontWeight: 400, color: '#52525b' }}>/{m.total_marks}</span>
                            </div>
                            <div style={{ fontSize: 11, color: '#52525b' }}>{pct}%</div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Read-only notice */}
        <div style={{ marginTop: 32, textAlign: 'center', fontSize: 11, color: '#27272a' }}>
          🔒 Parent portal — read-only access to academic marks only
        </div>
      </div>
    </div>
  )
}

// ─── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({ icon: Icon, label, value, color, sub }: {
  icon: React.ElementType; label: string; value: number | string; color: string; sub?: string
}) {
  return (
    <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 16,
      display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} color={color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: '#52525b', marginTop: 1, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
      </div>
    </div>
  )
}
