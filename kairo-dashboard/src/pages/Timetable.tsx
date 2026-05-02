import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Grid3x3, Plus, Trash2, AlertCircle, Sparkles } from 'lucide-react'
import { get, post, del } from '../lib/api'

const SCHOOL_ID = 'demo_school'
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const PERIODS = [1,2,3,4,5,6,7,8]

const SUBJECT_COLORS: Record<string, string> = {
  Mathematics: '#818cf8', Physics: '#38bdf8', Chemistry: '#34d399',
  Biology: '#86efac', English: '#fb923c', Hindi: '#f472b6',
  History: '#fbbf24', Geography: '#a78bfa', 'Computer Science': '#67e8f9',
  default: '#6366f1',
}

const card = { background: '#111', border: '1px solid #1e1e1e', borderRadius: 14 }
const inp  = { background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', width: '100%' } as React.CSSProperties
const label = { fontSize: 11, color: '#71717a', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 } as React.CSSProperties

const TABS = [
  { id: 'grid',     label: 'Timetable',   icon: Grid3x3 },
  { id: 'clashes',  label: 'Clashes',     icon: AlertCircle },
  { id: 'generate', label: 'AI Generate', icon: Sparkles },
]

export default function Timetable() {
  const [tab, setTab] = useState('grid')

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1100, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Timetable Manager</h1>
        <p style={{ fontSize: 13, color: '#52525b', marginTop: 4 }}>Smart scheduling · Clash detection · AI-generated timetables</p>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px',
            borderRadius: 7, border: 'none', fontFamily: 'inherit',
            fontSize: 12, fontWeight: tab === t.id ? 600 : 400, cursor: 'pointer',
            background: tab === t.id ? '#1e1e2e' : 'transparent',
            color: tab === t.id ? '#818cf8' : '#52525b',
          }}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === 'grid'     && <GridTab />}
          {tab === 'clashes'  && <ClashesTab />}
          {tab === 'generate' && <GenerateTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ── Grid View ─────────────────────────────────────────────────────────────────
function GridTab() {
  const [slots, setSlots]       = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [classFilter, setClass] = useState('10')
  const [adding, setAdding]     = useState(false)
  const [form, setForm]         = useState({ class: '10', subject: 'Mathematics', teacher: '', room: '', day: 'Monday', period: '1', start_time: '', end_time: '' })
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')

  function load() {
    setLoading(true)
    get(`/timetable?school_id=${SCHOOL_ID}&class=${classFilter}`)
      .then(d => setSlots(d.slots || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }
  useEffect(load, [classFilter])

  async function addSlot() {
    setSaving(true); setErr('')
    try {
      await post('/timetable', { school_id: SCHOOL_ID, ...form, period: Number(form.period) })
      setAdding(false); load()
    } catch (e: any) {
      if (e.message.includes('Clash')) { setErr(e.message + ' — save anyway?'); return }
      setErr(e.message)
    }
    finally { setSaving(false) }
  }

  async function addForce() {
    setSaving(true); setErr('')
    try {
      await post('/timetable', { school_id: SCHOOL_ID, ...form, period: Number(form.period), force: true })
      setAdding(false); load()
    } catch (e: any) { setErr(e.message) }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    await del(`/timetable/${id}`); load()
  }

  // Build grid lookup: slot[day][period]
  const grid: Record<string, Record<number, any>> = {}
  DAYS.forEach(d => { grid[d] = {} })
  slots.forEach(s => { if (grid[s.day]) grid[s.day][s.period] = s })

  const classes = ['6','7','8','9','10','11','12']

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18 }}>
        <div>
          <label style={label}>Class</label>
          <select style={{ ...inp, width: 'auto' }} value={classFilter} onChange={e => { setClass(e.target.value); setForm(f => ({ ...f, class: e.target.value })) }}>
            {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
        </div>
        <button onClick={() => setAdding(a => !a)} style={{
          marginTop: 18, display: 'flex', alignItems: 'center', gap: 7,
          padding: '9px 18px', borderRadius: 9, border: 'none',
          background: 'linear-gradient(135deg,#6366f1,#7c3aed)', color: '#fff',
          fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          <Plus size={13} /> Add Period
        </button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {adding && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ ...card, padding: 18, marginBottom: 18, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={label}>Day</label>
                <select style={inp} value={form.day} onChange={e => setForm(f => ({ ...f, day: e.target.value }))}>
                  {DAYS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Period</label>
                <select style={inp} value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}>
                  {PERIODS.map(p => <option key={p} value={p}>Period {p}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Subject</label>
                <select style={inp} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
                  {Object.keys(SUBJECT_COLORS).filter(s => s !== 'default').map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Teacher</label>
                <input style={inp} placeholder="Teacher name" value={form.teacher} onChange={e => setForm(f => ({ ...f, teacher: e.target.value }))} />
              </div>
              <div>
                <label style={label}>Room</label>
                <input style={inp} placeholder="Room no." value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} />
              </div>
              <div>
                <label style={label}>Start Time</label>
                <input style={inp} type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div>
                <label style={label}>End Time</label>
                <input style={inp} type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
              </div>
            </div>
            {err && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 12, color: '#fbbf24' }}>{err}</p>
                {err.includes('anyway') && (
                  <button onClick={addForce} style={{ padding: '5px 14px', borderRadius: 7, border: 'none', background: '#fbbf2420', color: '#fbbf24', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>
                    Save Anyway (Override Clash)
                  </button>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addSlot} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#6366f1,#7c3aed)', color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Saving…' : 'Add'}
              </button>
              <button onClick={() => { setAdding(false); setErr('') }} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #1e1e1e', background: 'transparent', color: '#52525b', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timetable grid */}
      {loading ? <Spinner /> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 4 }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 10px', fontSize: 10, color: '#52525b', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Period</th>
                {DAYS.map(d => (
                  <th key={d} style={{ padding: '8px 10px', fontSize: 10, color: '#818cf8', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{d.slice(0,3)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map(p => (
                <tr key={p}>
                  <td style={{ padding: '4px 8px', fontSize: 11, color: '#52525b', fontWeight: 600 }}>P{p}</td>
                  {DAYS.map(d => {
                    const slot = grid[d]?.[p]
                    const color = slot ? (SUBJECT_COLORS[slot.subject] || SUBJECT_COLORS.default) : null
                    return (
                      <td key={d} style={{ padding: 3 }}>
                        {slot ? (
                          <div style={{
                            background: `${color}18`, border: `1px solid ${color}40`,
                            borderRadius: 8, padding: '6px 8px', position: 'relative', minWidth: 90,
                            borderLeft: `3px solid ${color}`,
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color }}>{slot.subject}</div>
                            {slot.teacher && <div style={{ fontSize: 9, color: '#71717a', marginTop: 1 }}>{slot.teacher}</div>}
                            {slot.room    && <div style={{ fontSize: 9, color: '#52525b' }}>Room {slot.room}</div>}
                            {slot.has_clash && <div style={{ fontSize: 8, color: '#fbbf24' }}>⚠ clash</div>}
                            <button onClick={() => remove(slot._id)} style={{
                              position: 'absolute', top: 3, right: 3,
                              background: 'none', border: 'none', cursor: 'pointer', padding: 1,
                              opacity: 0, transition: 'opacity 0.1s', color: '#f87171',
                            }}
                              className="delete-btn">
                              <Trash2 size={9} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ height: 52, borderRadius: 8, border: '1px dashed #1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 90 }}>
                            <span style={{ fontSize: 10, color: '#27272a' }}>—</span>
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`.delete-btn:hover { opacity: 1 !important }`}</style>
    </div>
  )
}

// ── Clashes ───────────────────────────────────────────────────────────────────
function ClashesTab() {
  const [data, setData]       = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get('/timetable/clashes').then(d => setData(d.clashed_slots || [])).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div>
      {data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 14, color: '#34d399', fontWeight: 600 }}>No clashes detected</div>
          <div style={{ fontSize: 12, color: '#52525b', marginTop: 4 }}>Your timetable is clean!</div>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 13, color: '#fbbf24', marginBottom: 16 }}>⚠ {data.length} slot(s) with clashes</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.map(s => (
              <div key={s._id} style={{ ...card, padding: '14px 18px', borderColor: '#fbbf2430', display: 'flex', gap: 14, alignItems: 'center' }}>
                <AlertCircle size={20} color="#fbbf24" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>{s.subject} — Class {s.class}</div>
                  <div style={{ fontSize: 11, color: '#71717a' }}>{s.day} · Period {s.period}{s.teacher ? ` · ${s.teacher}` : ''}{s.room ? ` · Room ${s.room}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── AI Generate ───────────────────────────────────────────────────────────────
function GenerateTab() {
  const [cls, setCls]           = useState('10')
  const [subjects, setSubjects] = useState([
    { name: 'Mathematics', teacher: 'Mr. Rajan', periods_per_week: 6 },
    { name: 'Physics',     teacher: 'Mrs. Priya', periods_per_week: 4 },
    { name: 'Chemistry',   teacher: 'Mr. Kumar',  periods_per_week: 4 },
    { name: 'English',     teacher: 'Ms. Deepa',  periods_per_week: 4 },
    { name: 'Hindi',       teacher: 'Mr. Sharma', periods_per_week: 3 },
  ])
  const [result, setResult]     = useState<any>(null)
  const [loading, setLoading]   = useState(false)
  const [err, setErr]           = useState('')

  async function generate() {
    setLoading(true); setErr(''); setResult(null)
    try {
      const data = await post('/timetable/generate', { school_id: SCHOOL_ID, class: cls, subjects })
      setResult(data)
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  function updateSubject(i: number, key: string, val: any) {
    setSubjects(s => s.map((item, idx) => idx === i ? { ...item, [key]: val } : item))
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1.5fr' : '1fr', gap: 20 }}>
      <div style={card}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>Configure Timetable</div>
        </div>
        <div style={{ padding: 18 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Class</label>
            <select style={{ ...inp, maxWidth: 120 }} value={cls} onChange={e => setCls(e.target.value)}>
              {['6','7','8','9','10','11','12'].map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Subjects</div>
            {subjects.map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: 8, marginBottom: 8 }}>
                <input style={inp} placeholder="Subject" value={s.name} onChange={e => updateSubject(i, 'name', e.target.value)} />
                <input style={inp} placeholder="Teacher" value={s.teacher} onChange={e => updateSubject(i, 'teacher', e.target.value)} />
                <input style={inp} type="number" placeholder="Periods/wk" value={s.periods_per_week} onChange={e => updateSubject(i, 'periods_per_week', Number(e.target.value))} />
              </div>
            ))}
            <button onClick={() => setSubjects(s => [...s, { name: '', teacher: '', periods_per_week: 3 }])} style={{ fontSize: 11, color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              + Add Subject
            </button>
          </div>

          {err && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 12 }}>{err}</p>}

          <button onClick={generate} disabled={loading} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px', borderRadius: 9, border: 'none',
            background: 'linear-gradient(135deg,#6366f1,#7c3aed)', color: '#fff',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <Sparkles size={14} /> {loading ? 'Generating…' : 'Generate with AI'}
          </button>
        </div>
      </div>

      {result && (
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399' }}>✓ {result.title || `Class ${result.class} Timetable`}</div>
          </div>
          <div style={{ padding: 16, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 3 }}>
              <thead>
                <tr>
                  <th style={{ fontSize: 9, color: '#52525b', padding: '4px 6px', textTransform: 'uppercase' }}>Period</th>
                  {Object.keys(result.timetable || {}).map(d => (
                    <th key={d} style={{ fontSize: 9, color: '#818cf8', padding: '4px 6px', textTransform: 'uppercase' }}>{d.slice(0,3)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map(p => (
                  <tr key={p}>
                    <td style={{ fontSize: 10, color: '#52525b', padding: '3px 6px', fontWeight: 600 }}>P{p}</td>
                    {Object.values(result.timetable || {}).map((daySlots: any, di) => {
                      const slot = Array.isArray(daySlots) ? daySlots.find((s: any) => s.period === p) : null
                      const color = slot ? (SUBJECT_COLORS[slot.subject] || SUBJECT_COLORS.default) : null
                      return (
                        <td key={di} style={{ padding: 3 }}>
                          {slot ? (
                            <div style={{ background: `${color}18`, borderRadius: 6, padding: '4px 7px', borderLeft: `2px solid ${color}`, minWidth: 70 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color }}>{slot.subject}</div>
                              {slot.teacher && <div style={{ fontSize: 8, color: '#71717a' }}>{slot.teacher}</div>}
                            </div>
                          ) : (
                            <div style={{ height: 38, borderRadius: 6, border: '1px dashed #1a1a1a', minWidth: 70 }} />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {result.notes && <p style={{ fontSize: 11, color: '#71717a', marginTop: 12, padding: '10px 12px', background: '#0d0d0d', borderRadius: 8 }}>{result.notes}</p>}
          </div>
        </motion.div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #1e1e1e', borderTopColor: '#6366f1', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}
