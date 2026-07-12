import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserCheck, UserX, AlertTriangle, BarChart2, ChevronDown } from 'lucide-react'
import { get, post, friendlyError } from '../lib/api'

const SCHOOL_ID = 'demo_school'
const TODAY = new Date().toISOString().slice(0, 10)

const TABS = [
  { id: 'mark',    label: 'Mark Today',  icon: UserCheck },
  { id: 'at-risk', label: 'At Risk',     icon: AlertTriangle },
  { id: 'stats',   label: 'Student Stats', icon: BarChart2 },
]

const card  = { background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(14px) saturate(140%)', WebkitBackdropFilter: 'blur(14px) saturate(140%)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }
const label = { fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 } as React.CSSProperties
const inp   = { background: '#0E1117', border: '1px solid #1f2532', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', width: '100%' } as React.CSSProperties

type AttStatus = 'present' | 'absent' | 'late' | 'excused'
const STATUS_COLORS: Record<AttStatus, string> = { present: '#A5B4FC', absent: '#66D9FF', late: '#A5B4FC', excused: '#66D9FF' }

export default function Attendance() {
  const [tab, setTab] = useState('mark')

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1000, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Attendance Tracker</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Mark daily attendance · Detect at-risk students · View analytics</p>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#0E1117', border: '1px solid #1f2532', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px',
            borderRadius: 7, border: 'none', fontFamily: 'inherit',
            fontSize: 12, fontWeight: tab === t.id ? 600 : 400, cursor: 'pointer',
            background: tab === t.id ? '#1f2532' : 'transparent',
            color: tab === t.id ? '#66D9FF' : '#6B7280',
          }}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === 'mark'    && <MarkTab />}
          {tab === 'at-risk' && <AtRiskTab />}
          {tab === 'stats'   && <StatsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function MarkTab() {
  const [students, setStudents]   = useState<any[]>([])
  const [attendance, setAttendance] = useState<Record<string, AttStatus>>({})
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [date, setDate]           = useState(TODAY)

  useEffect(() => {
    setLoading(true)
    get(`/students?school_id=${SCHOOL_ID}`)
      .then(s => {
        const arr = Array.isArray(s) ? s : []
        setStudents(arr)
        const def: Record<string, AttStatus> = {}
        arr.forEach((st: any) => { def[st._id] = 'present' })
        setAttendance(def)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function toggle(id: string) {
    setAttendance(a => {
      const cycle: AttStatus[] = ['present', 'late', 'absent', 'excused']
      const curr = a[id] || 'present'
      const next = cycle[(cycle.indexOf(curr) + 1) % cycle.length]
      return { ...a, [id]: next }
    })
  }

  async function save() {
    setSaving(true); setSaved(false)
    try {
      const records = Object.entries(attendance).map(([student_id, status]) => ({ student_id, status }))
      await post('/attendance/bulk', { school_id: SCHOOL_ID, date, records })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { alert(friendlyError(e)) }
    finally { setSaving(false) }
  }

  const counts = {
    present: Object.values(attendance).filter(s => s === 'present').length,
    absent:  Object.values(attendance).filter(s => s === 'absent').length,
    late:    Object.values(attendance).filter(s => s === 'late').length,
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Present', count: counts.present, color: '#A5B4FC' },
          { label: 'Absent',  count: counts.absent,  color: '#66D9FF' },
          { label: 'Late',    count: counts.late,    color: '#A5B4FC' },
          { label: 'Total',   count: students.length, color: '#66D9FF' },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.count}</span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{s.label}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <div>
          <label style={label}>Date</label>
          <input type="date" style={{ ...inp, width: 'auto' }} value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <button onClick={save} disabled={saving} style={{
          marginTop: 20, display: 'flex', alignItems: 'center', gap: 7,
          padding: '9px 20px', borderRadius: 9, border: 'none',
          background: saved ? '#A5B4FC' : 'linear-gradient(135deg,#4F7CFF,#4F7CFF)',
          color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Attendance'}
        </button>
        <button onClick={() => setAttendance(a => { const n = { ...a }; Object.keys(n).forEach(k => { n[k] = 'present' }); return n })}
          style={{ marginTop: 20, padding: '9px 14px', borderRadius: 9, border: '1px solid #1f2532', background: 'transparent', color: '#6B7280', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>
          All Present
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {students.map(s => {
          const status = attendance[s._id] || 'present'
          const color  = STATUS_COLORS[status]
          return (
            <div key={s._id} onClick={() => toggle(s._id)} style={{
              ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
              borderColor: status === 'absent' ? '#66D9FF30' : '#1f2532',
              transition: 'border-color 0.15s',
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700, color }}>
                {s.name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>{s.name}</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>Class {s.class}</div>
              </div>
              <motion.div animate={{ backgroundColor: `${color}20`, borderColor: color }} style={{
                padding: '4px 14px', borderRadius: 20, border: '1px solid', fontSize: 11, fontWeight: 700, color,
              }}>
                {status}
              </motion.div>
            </div>
          )
        })}
        {students.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: '#4B5563' }}>No students found. Add students in Fee Reminder → Students.</div>}
      </div>
    </div>
  )
}

function AtRiskTab() {
  const [data, setData]         = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [threshold, setThreshold] = useState(75)

  function load() {
    setLoading(true)
    get(`/attendance/at-risk?school_id=${SCHOOL_ID}&threshold=${threshold}`)
      .then(setData).catch(console.error).finally(() => setLoading(false))
  }
  useEffect(load, [threshold])

  if (loading) return <Spinner />

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <div>
          <label style={label}>Alert Threshold</label>
          <select style={{ ...inp, width: 'auto' }} value={threshold} onChange={e => setThreshold(Number(e.target.value))}>
            {[90, 85, 80, 75, 70, 60].map(v => <option key={v} value={v}>Below {v}%</option>)}
          </select>
        </div>
        {data && (
          <div style={{ marginTop: 18, fontSize: 13, color: data.count > 0 ? '#66D9FF' : '#A5B4FC', fontWeight: 600 }}>
            {data.count > 0 ? `⚠ ${data.count} students at risk` : '✓ All students above threshold'}
          </div>
        )}
      </div>

      {data?.students?.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', fontSize: 13, color: '#A5B4FC' }}>
          ✓ No students below {threshold}% attendance
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data?.students?.map((s: any) => {
          const pct = s.percentage
          const color = pct < 50 ? '#66D9FF' : pct < 65 ? '#A5B4FC' : '#A5B4FC'
          return (
            <div key={s.student_id} style={{ ...card, padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={20} color={color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>{s.student_name}</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>Class {s.class} · {s.parent_email}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color }}>{pct}%</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>{s.absent_days} absent / {s.total_days} days</div>
                </div>
              </div>
              <div style={{ height: 4, background: '#1f2532', borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                  style={{ height: '100%', background: color, borderRadius: 2 }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatsTab() {
  const [students, setStudents] = useState<any[]>([])
  const [selected, setSelected] = useState('')
  const [stats, setStats]       = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [loadingStats, setLoadingStats] = useState(false)

  useEffect(() => {
    get(`/students?school_id=${SCHOOL_ID}`).then(s => { const arr = Array.isArray(s) ? s : []; setStudents(arr); if (arr.length) setSelected(arr[0]._id) }).catch(console.error).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selected) return
    setLoadingStats(true)
    get(`/attendance/stats/${selected}`).then(setStats).catch(console.error).finally(() => setLoadingStats(false))
  }, [selected])

  if (loading) return <Spinner />

  const pct = stats?.percentage || 0
  const pctColor = pct >= 75 ? '#A5B4FC' : pct >= 60 ? '#A5B4FC' : '#66D9FF'

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <label style={label}>Select Student</label>
        <select style={{ ...inp, maxWidth: 300 }} value={selected} onChange={e => setSelected(e.target.value)}>
          {students.map(s => <option key={s._id} value={s._id}>{s.name} — Class {s.class}</option>)}
        </select>
      </div>

      {loadingStats && <Spinner />}

      {stats && !loadingStats && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Attendance',  value: `${pct}%`,        color: pctColor },
              { label: 'Present',     value: stats.present,    color: '#A5B4FC' },
              { label: 'Absent',      value: stats.absent,     color: '#66D9FF' },
              { label: 'Late',        value: stats.late,       color: '#A5B4FC' },
              { label: 'Total Days',  value: stats.total,      color: '#66D9FF' },
            ].map(s => (
              <div key={s.label} style={{ ...card, padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ ...card, padding: 20, display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16 }}>
            <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="32" fill="none" stroke="#1f2532" strokeWidth="8" />
                <circle cx="40" cy="40" r="32" fill="none" stroke={pctColor} strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 32}`}
                  strokeDashoffset={`${2 * Math.PI * 32 * (1 - pct / 100)}`}
                  strokeLinecap="round" transform="rotate(-90 40 40)" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: pctColor }}>{pct}%</div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', marginBottom: 4 }}>
                {pct >= 75 ? '✓ Good Attendance' : pct >= 60 ? '⚠ Needs Improvement' : '🚨 At Risk — Immediate Action Required'}
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                {pct < 75 ? `Needs ${Math.ceil((0.75 * stats.total - stats.present) / 0.25)} more present days to reach 75%` : 'Keep it up!'}
              </div>
            </div>
          </div>

          {stats.records?.length > 0 && (
            <div style={card}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #1a1f2e', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>
                Recent Records
              </div>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {[...stats.records].reverse().slice(0, 30).map((r: any, i: number) => (
                  <div key={i} style={{ padding: '9px 18px', borderBottom: '1px solid #0E1117', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#B1B5BA' }}>{r.date}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[r.status as AttStatus] || '#9CA3AF', background: `${STATUS_COLORS[r.status as AttStatus] || '#9CA3AF'}15`, padding: '2px 10px', borderRadius: 20 }}>
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #1f2532', borderTopColor: '#4F7CFF', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}
