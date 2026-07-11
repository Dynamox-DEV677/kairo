import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Bot, User, Users, Phone, Mail, CheckCircle, Clock, XCircle,
  Settings, BarChart3, Trash2, ExternalLink, Save, Sparkles,
} from 'lucide-react'

// ── Auth-aware fetch (auto-refreshes expired Supabase JWTs) ──────────────────
import { api, friendlyError } from '../lib/api'

// Public fetch (no auth) — for the chat preview
async function publicApi(path: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

interface AdmissionConfig {
  description?:     string
  grades?:          string
  fees?:            string
  timings?:         string
  contact?:         string
  address?:         string
  facilities?:      string
  documents?:       string
  admission_dates?: string
}

interface SchoolCtx {
  school_id:   string
  school_name: string
  school_logo: string | null
  config:      AdmissionConfig
}

interface Lead {
  id:          string
  parent_name: string | null
  child_name:  string | null
  grade:       string | null
  phone:       string | null
  email:       string | null
  message:     string | null
  status:      'new' | 'contacted' | 'admitted' | 'rejected' | 'not_interested'
  notes:       string | null
  created_at:  string
}

const STATUS_META: Record<string, { color: string; icon: any; label: string }> = {
  new:            { color: '#A5B4FC', icon: Clock,         label: 'New' },
  contacted:      { color: '#66D9FF', icon: Phone,         label: 'Contacted' },
  admitted:       { color: '#A5B4FC', icon: CheckCircle,   label: 'Admitted' },
  rejected:       { color: '#66D9FF', icon: XCircle,       label: 'Rejected' },
  not_interested: { color: '#9CA3AF', icon: XCircle,       label: 'Not Interested' },
}

const card = { background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(14px) saturate(140%)', WebkitBackdropFilter: 'blur(14px) saturate(140%)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }
const inp: React.CSSProperties = {
  background: '#0E1117', border: '1px solid #1f2532', borderRadius: 8,
  padding: '9px 12px', fontSize: 13, color: '#fafafa',
  fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 5,
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8,
}

// ─── Top-level component ───────────────────────────────────────────────────────
export default function AdmissionBot() {
  const [tab, setTab] = useState('chat')
  const [ctx, setCtx] = useState<SchoolCtx | null>(null)
  const [err, setErr] = useState('')

  const profile = (() => {
    try { return JSON.parse(localStorage.getItem('kairo_profile') || 'null') } catch { return null }
  })()
  const schoolId = profile?.school_id || ''
  const isAdmin  = profile?.role === 'admin'

  const loadCtx = useCallback(async () => {
    if (!schoolId) return
    try {
      const data = isAdmin
        ? await api('/admission/config')
        : await publicApi(`/admission/public-config/${schoolId}`)
      setCtx({
        school_id:   schoolId,
        school_name: data.school_name || 'School',
        school_logo: data.school_logo || null,
        config:      data.config || {},
      })
    } catch (e: any) { setErr(e.message) }
  }, [schoolId, isAdmin])

  useEffect(() => { loadCtx() }, [loadCtx])

  const TABS = isAdmin
    ? [
        { id: 'chat',     label: 'Bot Preview', icon: Bot },
        { id: 'leads',    label: 'Leads',       icon: Users },
        { id: 'stats',    label: 'Stats',       icon: BarChart3 },
        { id: 'settings', label: 'Settings',    icon: Settings },
      ]
    : [
        { id: 'chat', label: 'Chat Bot', icon: Bot },
      ]

  if (!schoolId) {
    return (
      <div style={{ padding: 36, textAlign: 'center', color: '#9CA3AF' }}>
        Join a school first to use the Admission Bot.
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1100, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>
          Admission Bot
        </h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
          24/7 AI lead-gen for prospective parents · School-aware · Auto lead capture
        </p>
      </div>

      {err && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(102, 217, 255, 0.08)', border: '1px solid rgba(102, 217, 255, 0.25)', borderRadius: 8, fontSize: 12, color: '#66D9FF' }}>
          {err}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 22, background: '#0E1117', border: '1px solid #1f2532', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px',
            borderRadius: 7, border: 'none', fontFamily: 'inherit',
            fontSize: 12, fontWeight: tab === t.id ? 600 : 400, cursor: 'pointer',
            background: tab === t.id ? '#1f2532' : 'transparent',
            color: tab === t.id ? '#66D9FF' : '#6B7280',
            transition: 'all 0.12s',
          }}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
          {tab === 'chat'     && ctx && <ChatTab ctx={ctx} />}
          {tab === 'leads'    && isAdmin && <LeadsTab />}
          {tab === 'stats'    && isAdmin && <StatsTab />}
          {tab === 'settings' && isAdmin && ctx && <SettingsTab ctx={ctx} onSaved={loadCtx} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ─── Chat ───────────────────────────────────────────────────────────────────
interface Msg { role: 'user' | 'assistant'; content: string }

function ChatTab({ ctx }: { ctx: SchoolCtx }) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: `Hello! Welcome to ${ctx.school_name}. I'm here to help with admission queries. How can I assist you today?` },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showLead, setShowLead] = useState(false)
  const [leadSaved, setLeadSaved] = useState(false)
  const [leadForm, setLeadForm] = useState({ parent_name: '', child_name: '', grade: '', phone: '', email: '' })
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    if (!input.trim() || loading) return
    const userMsg: Msg = { role: 'user', content: input.trim() }
    setMessages(m => [...m, userMsg])
    setInput('')
    setLoading(true)
    try {
      const { reply } = await publicApi('/admission/chat', {
        method: 'POST',
        body: JSON.stringify({
          school_id: ctx.school_id,
          message: userMsg.content,
          conversation_history: messages,
        }),
      })
      setMessages(m => [...m, { role: 'assistant', content: reply }])
      const userCount = messages.filter(m => m.role === 'user').length + 1
      if (userCount === 3 && !leadSaved) setShowLead(true)
    } catch (e: any) {
      setMessages(m => [...m, { role: 'assistant', content: 'Sorry, I had trouble responding just now — please try that again in a moment.' }])
    }
    setLoading(false)
  }

  async function saveLead() {
    if (!leadForm.phone && !leadForm.email) {
      alert('Please give a phone or email so the team can reach you.')
      return
    }
    try {
      await publicApi('/admission/lead', {
        method: 'POST',
        body: JSON.stringify({ school_id: ctx.school_id, ...leadForm }),
      })
      setLeadSaved(true); setShowLead(false)
      setMessages(m => [...m, {
        role: 'assistant',
        content: `Thank you, ${leadForm.parent_name || 'there'}! We've saved your details. Our admissions team will contact you${leadForm.phone ? ' at ' + leadForm.phone : ''} within 24 hours.`,
      }])
    } catch (e: any) { alert(friendlyError(e)) }
  }

  const quickQs = [
    'What are your fees?',
    'How do I apply?',
    'What grades do you offer?',
    'When is the next admission window?',
    'What documents are needed?',
  ]

  return (
    <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, minHeight: 540 }}>
      {/* Chat window */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #1a1f2e', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#4F7CFF,#4F7CFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {ctx.school_logo
              ? <img src={ctx.school_logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Bot size={18} color="#fff" />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>{ctx.school_name}</div>
            <div style={{ fontSize: 11, color: '#A5B4FC', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#A5B4FC', display: 'inline-block' }} /> Online
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: m.role === 'user' ? '#4F7CFF' : '#1f2532',
              }}>
                {m.role === 'user' ? <User size={13} color="#fff" /> : <Bot size={13} color="#66D9FF" />}
              </div>
              <div style={{
                maxWidth: '75%', padding: '9px 13px',
                borderRadius: m.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                background: m.role === 'user' ? 'linear-gradient(135deg,#4F7CFF,#4F7CFF)' : '#1a1f2e',
                fontSize: 13, color: '#fafafa', lineHeight: 1.55, whiteSpace: 'pre-wrap',
              }}>
                {m.content}
              </div>
            </motion.div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: '#1f2532', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={13} color="#66D9FF" />
              </div>
              <div style={{ padding: '10px 14px', background: '#1a1f2e', borderRadius: '4px 12px 12px 12px', display: 'flex', gap: 5 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#4F7CFF', animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: '12px 14px', borderTop: '1px solid #1a1f2e', display: 'flex', gap: 8 }}>
          <input
            style={{ ...inp, flex: 1 }}
            placeholder="Type your question…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
          />
          <button onClick={send} disabled={!input.trim() || loading} style={{
            width: 38, height: 38, borderRadius: 9, border: 'none',
            cursor: input.trim() ? 'pointer' : 'not-allowed',
            background: input.trim() ? 'linear-gradient(135deg,#4F7CFF,#4F7CFF)' : '#1a1f2e',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Send size={14} color={input.trim() ? '#fff' : '#6B7280'} />
          </button>
        </div>
      </div>

      {/* Right panel */}
      <div>
        <AnimatePresence>
          {showLead && !leadSaved && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ ...card, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa', marginBottom: 4 }}>Save your details</div>
              <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 14 }}>Get a callback from our admissions team.</p>
              {([
                ['parent_name', 'Parent Name'],
                ['child_name',  "Child's Name"],
                ['grade',       'Grade Applying'],
                ['phone',       'Phone'],
                ['email',       'Email'],
              ] as const).map(([k, l]) => (
                <div key={k} style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>{l}</label>
                  <input style={inp} value={(leadForm as any)[k]} onChange={e => setLeadForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <button onClick={saveLead} style={{
                width: '100%', padding: '9px', borderRadius: 8, border: 'none',
                background: 'linear-gradient(135deg,#4F7CFF,#4F7CFF)', color: '#fff',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Submit Enquiry
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            Quick Questions
          </div>
          {quickQs.map(q => (
            <button key={q} onClick={() => setInput(q)} style={{
              width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 7,
              border: '1px solid #1f2532', background: 'transparent', color: '#9CA3AF',
              fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', marginBottom: 6,
              transition: 'all 0.1s',
            }}
              onMouseEnter={e => { (e.currentTarget).style.borderColor = '#4F7CFF'; (e.currentTarget).style.color = '#A5B4FC' }}
              onMouseLeave={e => { (e.currentTarget).style.borderColor = '#1f2532'; (e.currentTarget).style.color = '#9CA3AF' }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Leads ─────────────────────────────────────────────────────────────────
function LeadsTab() {
  const [leads, setLeads]     = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all')
  const [err, setErr]         = useState('')

  const load = useCallback(() => {
    setLoading(true); setErr('')
    api('/admission/leads' + (filter === 'all' ? '' : `?status=${filter}`))
      .then(d => setLeads(Array.isArray(d) ? d : []))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { load() }, [load])

  async function updateStatus(id: string, status: string) {
    try { await api(`/admission/leads/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }); load() }
    catch (e: any) { alert(friendlyError(e)) }
  }

  async function remove(id: string) {
    if (!confirm('Delete this lead permanently?')) return
    try { await api(`/admission/leads/${id}`, { method: 'DELETE' }); load() }
    catch (e: any) { alert(friendlyError(e)) }
  }

  const allStatuses = ['all', 'new', 'contacted', 'admitted', 'rejected', 'not_interested']

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {allStatuses.map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '5px 12px', borderRadius: 6, border: '1px solid #1f2532',
            fontFamily: 'inherit', fontSize: 11, fontWeight: filter === s ? 600 : 400,
            cursor: 'pointer',
            background: filter === s ? '#1f2532' : 'transparent',
            color: filter === s ? '#66D9FF' : '#6B7280',
          }}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {err     && <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(102, 217, 255, 0.08)', border: '1px solid rgba(102, 217, 255, 0.25)', borderRadius: 8, fontSize: 12, color: '#66D9FF' }}>{err}</div>}
      {loading && <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7280' }}>Loading…</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!loading && leads.map(l => {
          const meta = STATUS_META[l.status] || STATUS_META.new
          const SIcon = meta.icon
          return (
            <div key={l.id} style={{ ...card, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                background: `${meta.color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <SIcon size={16} color={meta.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>
                  {l.parent_name || 'Unknown parent'}
                  {l.child_name ? ` → ${l.child_name}` : ''}
                  {l.grade ? <span style={{ marginLeft: 6, fontSize: 11, color: '#66D9FF' }}>({l.grade})</span> : null}
                </div>
                <div style={{ fontSize: 11, color: '#6B7280', display: 'flex', gap: 12, marginTop: 2, flexWrap: 'wrap' }}>
                  {l.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={10} />{l.phone}</span>}
                  {l.email && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={10} />{l.email}</span>}
                  <span style={{ color: '#4B5563' }}>{new Date(l.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <select value={l.status} onChange={e => updateStatus(l.id, e.target.value)} style={{
                background: '#0E1117', border: '1px solid #1f2532', borderRadius: 6,
                padding: '4px 8px', fontSize: 11, color: meta.color,
                fontFamily: 'inherit', cursor: 'pointer',
              }}>
                {(['new', 'contacted', 'admitted', 'rejected', 'not_interested'] as const).map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
              <button onClick={() => remove(l.id)} title="Delete"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#4B5563', padding: 4, display: 'flex',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#66D9FF')}
                onMouseLeave={e => (e.currentTarget.style.color = '#4B5563')}
              >
                <Trash2 size={13} />
              </button>
            </div>
          )
        })}
        {!loading && leads.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', fontSize: 13, color: '#4B5563' }}>
            No leads yet. Share your bot link with parents to start collecting enquiries.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Stats ──────────────────────────────────────────────────────────────────
function StatsTab() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    api('/admission/stats')
      .then(setStats)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7280' }}>Loading…</div>
  if (err)     return <div style={{ color: '#66D9FF', fontSize: 13 }}>{err}</div>
  if (!stats)  return null

  const conversion = stats.total > 0 ? Math.round((stats.admitted / stats.total) * 100) : 0

  const tiles = [
    { label: 'Total leads', value: stats.total,     color: '#66D9FF' },
    { label: 'New',         value: stats.new,        color: '#A5B4FC' },
    { label: 'Contacted',   value: stats.contacted,  color: '#66D9FF' },
    { label: 'Admitted',    value: stats.admitted,   color: '#A5B4FC' },
    { label: 'Rejected',    value: stats.rejected,   color: '#66D9FF' },
    { label: 'Conversion',  value: `${conversion}%`, color: '#A5B4FC' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
      {tiles.map(t => (
        <div key={t.label} style={{
          background: '#0E1117', border: `1px solid ${t.color}30`, borderRadius: 12,
          padding: 18,
        }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: t.color, lineHeight: 1.1 }}>{t.value}</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>{t.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Settings ──────────────────────────────────────────────────────────────
function SettingsTab({ ctx, onSaved }: { ctx: SchoolCtx; onSaved: () => void }) {
  const [cfg, setCfg]       = useState<AdmissionConfig>(ctx.config || {})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState('')
  const [err, setErr]       = useState('')

  function set<K extends keyof AdmissionConfig>(k: K, v: string) {
    setCfg(p => ({ ...p, [k]: v }))
  }

  async function save() {
    setSaving(true); setErr(''); setMsg('')
    try {
      await api('/admission/config', { method: 'PUT', body: JSON.stringify(cfg) })
      setMsg('Saved. The bot now uses these details.')
      onSaved()
    } catch (e: any) { setErr(e.message) }
    finally { setSaving(false) }
  }

  const fields: Array<{ key: keyof AdmissionConfig; label: string; placeholder: string; rows?: number }> = [
    { key: 'description',     label: 'School description',  placeholder: 'A premier CBSE school offering Classes 1–12 with focus on board excellence and holistic development.', rows: 3 },
    { key: 'grades',          label: 'Grades offered',      placeholder: 'Class 1 to Class 12 (CBSE)' },
    { key: 'fees',            label: 'Fee range',           placeholder: '₹40,000 – ₹80,000 per year' },
    { key: 'timings',         label: 'School timings',      placeholder: 'Mon–Fri, 8:00 AM – 3:30 PM' },
    { key: 'admission_dates', label: 'Admission window',    placeholder: 'Applications open: Jan 15 – Mar 31' },
    { key: 'documents',       label: 'Documents required',  placeholder: 'Birth certificate, last school TC, parent ID, photographs', rows: 2 },
    { key: 'facilities',      label: 'Facilities',          placeholder: 'Smart classrooms, science labs, library, sports ground, canteen', rows: 2 },
    { key: 'address',         label: 'Address',             placeholder: 'Full address with pincode' },
    { key: 'contact',         label: 'Contact (phone/email)', placeholder: '+91 98765 43210 · admissions@school.edu.in' },
  ]

  const shareUrl = `${window.location.origin}/admit?school=${ctx.school_id}`

  return (
    <div>
      <div style={{ ...card, padding: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9, background: 'rgba(79, 124, 255, 0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Sparkles size={16} color="#66D9FF" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fafafa' }}>Public bot link</div>
          <div style={{ fontSize: 11, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Share with parents — opens the chat without login
          </div>
        </div>
        <code style={{
          fontSize: 11, padding: '5px 10px', background: '#0E1117',
          border: '1px solid #1f2532', borderRadius: 6, color: '#A5B4FC',
        }}>{shareUrl}</code>
        <button onClick={() => { navigator.clipboard.writeText(shareUrl); setMsg('Link copied') }}
          style={{
            padding: '6px 10px', borderRadius: 7, border: '1px solid #1f2532',
            background: '#151922', color: '#9CA3AF', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
          <ExternalLink size={11} /> Copy
        </button>
      </div>

      <div style={{ ...card, padding: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {fields.map(f => (
            <div key={f.key} style={{ gridColumn: f.rows ? '1 / -1' : 'auto' }}>
              <label style={labelStyle}>{f.label}</label>
              {f.rows
                ? <textarea rows={f.rows} placeholder={f.placeholder}
                    value={cfg[f.key] || ''}
                    onChange={e => set(f.key, e.target.value)}
                    style={{ ...inp, resize: 'vertical', lineHeight: 1.55 }} />
                : <input placeholder={f.placeholder}
                    value={cfg[f.key] || ''}
                    onChange={e => set(f.key, e.target.value)}
                    style={inp} />}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
          <button onClick={save} disabled={saving} style={{
            padding: '10px 18px', borderRadius: 8, border: 'none',
            background: saving ? '#1a1f2e' : 'linear-gradient(135deg,#4F7CFF,#4F7CFF)',
            color: saving ? '#6B7280' : '#fff',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <Save size={13} />{saving ? 'Saving…' : 'Save Settings'}
          </button>
          {msg && <span style={{ fontSize: 12, color: '#A5B4FC' }}>{msg}</span>}
          {err && <span style={{ fontSize: 12, color: '#66D9FF' }}>{err}</span>}
        </div>

        <p style={{ fontSize: 11, color: '#4B5563', marginTop: 14 }}>
          The bot uses these fields to answer parent questions accurately. Empty fields are simply skipped.
        </p>
      </div>
    </div>
  )
}
