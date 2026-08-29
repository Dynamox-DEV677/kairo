import { useState, useEffect } from 'react'
import { studentMessage } from '../lib/aiError.core'
import { motion, AnimatePresence } from 'framer-motion'
import { DollarSign, Users, Mail, Settings, Send, CheckCircle, XCircle, Clock, Plus, Trash2, RefreshCw, BarChart2 } from 'lucide-react'
import { get, post, put, del } from '../lib/api'

const SCHOOL_ID = 'demo_school'

const TABS = [
  { id: 'stats',      label: 'Stats',      icon: BarChart2 },
  { id: 'students',   label: 'Students',   icon: Users },
  { id: 'fees',       label: 'Fees',       icon: DollarSign },
  { id: 'send',       label: 'Send Email', icon: Send },
  { id: 'setup',      label: 'Setup',      icon: Settings },
]

const card = { background: '#141A2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 20 }
const inp  = { background: '#141A2A', border: '1px solid #1f2532', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', width: '100%' } as React.CSSProperties
const label = { fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 } as React.CSSProperties
const btn = (active = true) => ({ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: 'none', background: active ? 'linear-gradient(135deg,#7C5CFF,#7C5CFF)' : '#171D2D', color: active ? '#fff' : '#6B7280', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: active ? 'pointer' : 'not-allowed' } as React.CSSProperties)

export default function FeeReminder() {
  const [tab, setTab] = useState('stats')

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1000, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Fee Reminder System</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Automated Gmail reminders · AI-generated content · Smart scheduling</p>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#141A2A', border: '1px solid #1f2532', borderRadius: 10, padding: 4 }}>
        {TABS.map(t => (
          <button className="kyno-chip" key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '7px 10px', borderRadius: 7, border: 'none', fontFamily: 'inherit',
            fontSize: 12, fontWeight: tab === t.id ? 600 : 400, cursor: 'pointer',
            background: tab === t.id ? '#1f2532' : 'transparent',
            color: tab === t.id ? '#A5B4FC' : '#6B7280',
            transition: 'all 0.15s',
          }}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === 'stats'    && <StatsTab />}
          {tab === 'students' && <StudentsTab />}
          {tab === 'fees'     && <FeesTab />}
          {tab === 'send'     && <SendTab />}
          {tab === 'setup'    && <SetupTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function StatsTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get(`/emails/stats?school_id=${SCHOOL_ID}`).then(setData).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (!data)   return <ErrorMsg msg="Could not load stats. Is the backend running?" />

  const statBoxes = [
    { label: 'Total Emails', value: data.emails.total,   color: '#A5B4FC', icon: Mail },
    { label: 'Sent',         value: data.emails.sent,    color: '#A5B4FC', icon: CheckCircle },
    { label: 'Failed',       value: data.emails.failed,  color: '#A5B4FC', icon: XCircle },
    { label: 'Pending Fees', value: data.fees.pending,   color: '#A5B4FC', icon: Clock },
    { label: 'Total Students Fees', value: data.fees.total, color: '#A5B4FC', icon: Users },
    { label: 'Pending Amount', value: `₹${data.fees.pending_amount?.toLocaleString()}`, color: '#A5B4FC', icon: DollarSign },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
      {statBoxes.map(s => (
        <div key={s.label} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <s.icon size={16} color={s.color} />
            </div>
            <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>{s.label}</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#fafafa' }}>{s.value}</div>
        </div>
      ))}
    </div>
  )
}

function StudentsTab() {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [adding, setAdding]     = useState(false)
  const [form, setForm]         = useState({ name: '', class: '', parent_email: '', phone: '' })
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')

  function load() {
    setLoading(true)
    get(`/students?school_id=${SCHOOL_ID}`).then(s => setStudents(Array.isArray(s) ? s : [])).catch(console.error).finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function addStudent() {
    if (!form.name || !form.class || !form.parent_email) { setErr('Name, class and email required'); return }
    setSaving(true); setErr('')
    try {
      await post('/students', { school_id: SCHOOL_ID, ...form })
      setForm({ name: '', class: '', parent_email: '', phone: '' })
      setAdding(false); load()
    } catch (e: any) { setErr(studentMessage(e)) }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Deactivate this student?')) return
    await del(`/students/${id}`); load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#9CA3AF' }}>{students.length} active students</span>
        <button className="kyno-ghost" onClick={() => setAdding(a => !a)} style={btn()}>
          <Plus size={13} /> Add Student
        </button>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ ...card, marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              {[['name','Student Name'],['class','Class'],['parent_email','Parent Email'],['phone','Phone (optional)']].map(([k,l]) => (
                <div key={k}>
                  <label style={label}>{l}</label>
                  <input style={inp} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
            {err && <p style={{ fontSize: 12, color: '#A5B4FC', marginBottom: 10 }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="kyno-ghost" onClick={addStudent} disabled={saving} style={btn(!saving)}><Plus size={13} />{saving ? 'Saving…' : 'Save'}</button>
              <button className="kyno-ghost" onClick={() => setAdding(false)} style={btn(false)}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {students.map(s => (
          <div key={s._id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#1f2532', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, fontWeight: 700, color: '#A5B4FC' }}>
              {s.name.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>{s.name}</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>Class {s.class} · {s.parent_email}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {s.pending_fees > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, background: '#A5B4FC20', color: '#A5B4FC', borderRadius: 5, padding: '2px 8px' }}>
                  ₹{s.pending_amount} due
                </span>
              )}
              <button className="kyno-text" onClick={() => remove(s._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4B5563', padding: 4 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#A5B4FC')} onMouseLeave={e => (e.currentTarget.style.color = '#4B5563')}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        {students.length === 0 && <EmptyState msg="No students yet. Add one above." />}
      </div>
    </div>
  )
}

function FeesTab() {
  const [fees, setFees]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm]     = useState({ student_id: '', amount: '', due_date: '', label: 'Monthly Fee' })
  const [students, setStudents] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const [filter, setFilter] = useState('all')

  function load() {
    setLoading(true)
    Promise.all([
      get(`/fees?school_id=${SCHOOL_ID}`),
      get(`/students?school_id=${SCHOOL_ID}`),
    ]).then(([f, s]) => { setFees(Array.isArray(f) ? f : []); setStudents(Array.isArray(s) ? s : []) }).catch(console.error).finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function addFee() {
    if (!form.student_id || !form.amount || !form.due_date) { setErr('All fields required'); return }
    setSaving(true); setErr('')
    try {
      await post('/fees', { school_id: SCHOOL_ID, ...form, amount: Number(form.amount) })
      setForm({ student_id: '', amount: '', due_date: '', label: 'Monthly Fee' })
      setAdding(false); load()
    } catch (e: any) { setErr(studentMessage(e)) }
    finally { setSaving(false) }
  }

  async function markPaid(id: string) {
    await put(`/fees/${id}`, { status: 'paid' }); load()
  }

  const filtered = filter === 'all' ? fees : fees.filter(f => f.status === filter)

  if (loading) return <Spinner />

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all','pending','paid','waived'].map(s => (
            <button className="kyno-chip" key={s} onClick={() => setFilter(s)} style={{
              padding: '5px 12px', borderRadius: 6, border: '1px solid #1f2532', fontFamily: 'inherit',
              fontSize: 11, fontWeight: filter === s ? 600 : 400, cursor: 'pointer',
              background: filter === s ? '#1f2532' : 'transparent',
              color: filter === s ? '#A5B4FC' : '#6B7280',
            }}>{s}</button>
          ))}
        </div>
        <button className="kyno-ghost" onClick={() => setAdding(a => !a)} style={btn()}><Plus size={13} /> Add Fee</button>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ ...card, marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={label}>Student</label>
                <select style={inp} value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}>
                  <option value="">Select…</option>
                  {students.map(s => <option key={s._id} value={s._id}>{s.name} – {s.class}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Amount (₹)</label>
                <input style={inp} type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label style={label}>Due Date</label>
                <input style={inp} type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div>
                <label style={label}>Label</label>
                <input style={inp} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
              </div>
            </div>
            {err && <p style={{ fontSize: 12, color: '#A5B4FC', marginBottom: 10 }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="kyno-ghost" onClick={addFee} disabled={saving} style={btn(!saving)}>{saving ? 'Saving…' : 'Save Fee'}</button>
              <button className="kyno-ghost" onClick={() => setAdding(false)} style={btn(false)}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map(f => (
          <div key={f._id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>{f.student_name || f.student_id}</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>{f.label} · Due {f.due_date}</div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fafafa' }}>₹{f.amount?.toLocaleString()}</span>
            <StatusBadge status={f.status} />
            {f.status === 'pending' && (
              <button className="kyno-ghost" onClick={() => markPaid(f._id)} style={{ ...btn(), padding: '5px 12px', fontSize: 11 }}>Mark Paid</button>
            )}
          </div>
        ))}
        {filtered.length === 0 && <EmptyState msg={`No ${filter === 'all' ? '' : filter} fees.`} />}
      </div>
    </div>
  )
}

function SendTab() {
  const [mode, setMode]           = useState<'ai' | 'manual'>('ai')
  const [tone, setTone]           = useState('friendly')
  const [senderName, setSenderName] = useState('')
  const [message, setMessage]     = useState('')
  const [polishing, setPolishing] = useState(false)
  const [sending, setSending]     = useState(false)
  const [result, setResult]       = useState<any>(null)
  const [err, setErr]             = useState('')

  async function polishWithAI() {
    if (!message.trim()) return
    setPolishing(true)
    try {
      const data = await post('/ai/chat', {
        messages: [{
          role: 'user',
          content: `You are an expert school communication writer. Improve this fee reminder email message — keep it professional, warm, and clear. Return ONLY the improved message text, no explanations:\n\n${message}`,
        }],
      })
      const improved = data?.choices?.[0]?.message?.content?.trim()
      if (improved) setMessage(improved)
    } catch (e: any) { setErr(studentMessage(e)) }
    finally { setPolishing(false) }
  }

  async function send() {
    setSending(true); setErr(''); setResult(null)
    try {
      const payload: any = { school_id: SCHOOL_ID, tone }
      if (senderName.trim())        payload.sender_name    = senderName.trim()
      if (mode === 'manual' && message.trim()) payload.custom_message = message.trim()
      setResult(await post('/emails/send-bulk', payload))
    } catch (e: any) { setErr(studentMessage(e)) }
    finally { setSending(false) }
  }

  async function retry() {
    setSending(true); setErr(''); setResult(null)
    try { setResult(await post('/emails/retry', { school_id: SCHOOL_ID })) }
    catch (e: any) { setErr(studentMessage(e)) }
    finally { setSending(false) }
  }

  return (
    <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', margin: '0 0 16px' }}>Send Reminders</h3>

        <div style={{ padding: '10px 14px', background: '#141A2A', borderRadius: 8, border: '1px solid #1f2532', marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>📧 Sends a reminder to all students with <strong style={{ color: '#A5B4FC' }}>pending fees</strong>. Set up Gmail in the Setup tab first.</p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={label}>Your Name (shown in Gmail "From")</label>
          <input
            style={inp}
            placeholder="e.g. DPS Fee Office, Principal Sharma…"
            value={senderName}
            onChange={e => setSenderName(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={label}>Message Mode</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['ai', 'manual'] as const).map(m => (
              <button className="kyno-chip" key={m} onClick={() => setMode(m)} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${mode === m ? '#7C5CFF' : '#1f2532'}`,
                background: mode === m ? 'rgba(124, 92, 255, 0.12)' : '#141A2A',
                color: mode === m ? '#A5B4FC' : '#6B7280',
                fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {m === 'ai' ? '✨ AI Generated' : '✏️ Write Yourself'}
              </button>
            ))}
          </div>
        </div>

        {mode === 'ai' && (
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Tone</label>
            <select style={inp} value={tone} onChange={e => setTone(e.target.value)}>
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        )}

        {mode === 'manual' && (
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Your Message</label>
            <textarea
              style={{ ...inp, minHeight: 130, resize: 'vertical', lineHeight: 1.6 }}
              placeholder="Write your fee reminder message here…"
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
            <button className="kyno-ghost"
              onClick={polishWithAI}
              disabled={polishing || !message.trim()}
              style={{
                marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8,
                border: '1px solid rgba(124, 92, 255, 0.14)',
                background: 'rgba(124, 92, 255, 0.08)',
                color: polishing || !message.trim() ? '#4B5563' : '#A5B4FC',
                fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                cursor: polishing || !message.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {polishing
                ? <><div style={{ width: 11, height: 11, border: '2px solid #4B5563', borderTopColor: '#A5B4FC', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Polishing…</>
                : <>✨ Polish with AI</>}
            </button>
          </div>
        )}

        {err && <p style={{ fontSize: 12, color: '#A5B4FC', marginBottom: 12 }}>{err}</p>}

        <button className="kyno-ghost" onClick={send} disabled={sending} style={{ ...btn(!sending), width: '100%', justifyContent: 'center' }}>
          <Send size={13} />{sending ? 'Sending…' : 'Send Now'}
        </button>
        <button className="kyno-ghost" onClick={retry} disabled={sending} style={{ ...btn(false), width: '100%', justifyContent: 'center', marginTop: 8 }}>
          <RefreshCw size={13} /> Retry Failed
        </button>
      </div>

      {result && (
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} style={card}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: result.sent > 0 ? '#A5B4FC' : '#A5B4FC', margin: '0 0 14px' }}>
            {result.sent > 0 ? '✓ Emails Sent' : result.message ? '⚠ Nothing to send' : '⚠ Check Results'}
          </h3>
          {result.message && (
            <p style={{ fontSize: 12, color: '#A5B4FC', marginBottom: 14, padding: '10px 14px', background: '#A5B4FC10', borderRadius: 8, border: '1px solid #A5B4FC30' }}>
              {result.message}
            </p>
          )}
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            {[['Sent', result.sent, '#A5B4FC'], ['Failed', result.failed, '#A5B4FC'], ['Skipped', result.skipped, '#A5B4FC']].map(([l, v, c]) => (
              <div key={l as string} style={{ flex: 1, background: '#141A2A', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: c as string }}>{v as number}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF' }}>{l}</div>
              </div>
            ))}
          </div>
          {result.skip_reasons?.length > 0 && (
            <div style={{ background: '#141A2A', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Skip Reasons</div>
              {result.skip_reasons.map((r: any, i: number) => (
                <div key={i} style={{ fontSize: 11, color: '#A5B4FC', marginBottom: 4 }}>⚠ {r.student || r.fee_id}: {r.reason}</div>
              ))}
            </div>
          )}
          {result.failed > 0 && (
            <p style={{ fontSize: 11, color: '#A5B4FC', marginTop: 10 }}>Failed emails need Gmail credentials. Go to Setup tab.</p>
          )}
          {result.skipped > 0 && result.skip_reasons?.[0]?.reason?.includes('24h') && (
            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 10 }}>Already sent today — throttled to once per 24h per fee.</p>
          )}
        </motion.div>
      )}
    </div>
  )
}

function SetupTab() {
  const [creds, setCreds] = useState({ gmail: '', app_password: '' })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function save() {
    if (!creds.gmail || !creds.app_password) { setErr('Gmail and App Password required'); return }
    setSaving(true); setErr(''); setMsg('')
    try {
      const r = await post('/credentials/save', { school_id: SCHOOL_ID, ...creds })
      setMsg(r.message || 'Credentials saved!')
    } catch (e: any) { setErr(studentMessage(e)) }
    finally { setSaving(false) }
  }

  async function test() {
    if (!creds.gmail || !creds.app_password) { setErr('Fill in credentials first'); return }
    setTesting(true); setErr(''); setMsg('')
    try {
      const r = await post('/credentials/test', creds)
      setMsg(r.message)
    } catch (e: any) { setErr(studentMessage(e)) }
    finally { setTesting(false) }
  }

  return (
    <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', margin: '0 0 16px' }}>Gmail SMTP Setup</h3>
        <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
          Generate a 16-char App Password at{' '}
          <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener" style={{ color: '#A5B4FC' }}>myaccount.google.com/apppasswords</a>
        </p>
        <div style={{ marginBottom: 12 }}>
          <label style={label}>Gmail Address</label>
          <input style={inp} type="email" placeholder="school@gmail.com" value={creds.gmail} onChange={e => setCreds(c => ({ ...c, gmail: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>App Password (16 chars)</label>
          <input style={inp} type="password" placeholder="xxxx xxxx xxxx xxxx" value={creds.app_password} onChange={e => setCreds(c => ({ ...c, app_password: e.target.value }))} />
        </div>
        {err && <p style={{ fontSize: 12, color: '#A5B4FC', marginBottom: 10 }}>{err}</p>}
        {msg && <p style={{ fontSize: 12, color: '#A5B4FC', marginBottom: 10 }}>{msg}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="kyno-ghost" onClick={test} disabled={testing} style={btn(!testing)}>{testing ? 'Testing…' : 'Test SMTP'}</button>
          <button className="kyno-ghost" onClick={save} disabled={saving} style={btn(!saving)}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', margin: '0 0 16px' }}>Scheduler Info</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['Daily reminders', '08:00 AM IST (auto)'],
            ['Retry failed', 'Every 6 hours'],
            ['Before due', '3 days before'],
            ['On due date', 'Same day'],
            ['After due', '1, 3, 7 days after'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#9CA3AF' }}>{k}</span>
              <span style={{ color: '#B1B5BA', fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: any = { pending: '#A5B4FC', paid: '#A5B4FC', waived: '#A5B4FC', failed: '#A5B4FC', sent: '#A5B4FC' }
  return (
    <span style={{ fontSize: 10, fontWeight: 700, background: `${colors[status] || '#9CA3AF'}20`, color: colors[status] || '#9CA3AF', borderRadius: 5, padding: '2px 8px' }}>
      {status}
    </span>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #1f2532', borderTopColor: '#7C5CFF', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: '#4B5563' }}>{msg}</div>
}

function ErrorMsg({ msg }: { msg: string }) {
  return <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: '#A5B4FC' }}>{msg}</div>
}
