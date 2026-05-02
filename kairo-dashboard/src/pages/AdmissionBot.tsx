import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Bot, User, Users, Phone, Mail, CheckCircle, Clock, XCircle } from 'lucide-react'
import { post, get, put } from '../lib/api'

const SCHOOL_ID = 'demo_school'
const SCHOOL_INFO = {
  name: 'Kairo Academy',
  description: 'A premier CBSE school offering Classes 1–12 with focus on board excellence and holistic development.',
  grades: 'Class 1 to Class 12 (CBSE)',
  fees: '₹40,000 – ₹80,000 per year',
  contact: '+91 98765 43210',
  address: 'Chennai, Tamil Nadu',
  facilities: 'Smart classrooms, Science labs, Library, Sports ground, Canteen',
}

const TABS = [
  { id: 'chat',  label: 'Chat Bot',   icon: Bot },
  { id: 'leads', label: 'Leads',      icon: Users },
]

const card = { background: '#111', border: '1px solid #1e1e1e', borderRadius: 14 }
const inp  = { background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', width: '100%' } as React.CSSProperties
const label = { fontSize: 11, color: '#71717a', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 } as React.CSSProperties

interface Message { role: 'user' | 'assistant'; content: string }

export default function AdmissionBot() {
  const [tab, setTab] = useState('chat')

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1000, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Admission Enquiry Bot</h1>
        <p style={{ fontSize: 13, color: '#52525b', marginTop: 4 }}>24/7 AI-powered bot · Auto lead capture · Instant replies</p>
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

      {tab === 'chat'  && <ChatTab />}
      {tab === 'leads' && <LeadsTab />}
    </div>
  )
}

// ── Chat ──────────────────────────────────────────────────────────────────────
function ChatTab() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: `Hello! 👋 Welcome to ${SCHOOL_INFO.name}. I'm here to help with admission queries. How can I assist you today?` }
  ])
  const [input, setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [leadForm, setLeadForm] = useState({ parent_name: '', child_name: '', grade: '', phone: '', email: '' })
  const [showLead, setShowLead] = useState(false)
  const [leadSaved, setLeadSaved] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input.trim() }
    setMessages(m => [...m, userMsg])
    setInput('')
    setLoading(true)
    try {
      const { reply } = await post('/admission/chat', {
        school_id: SCHOOL_ID,
        message: userMsg.content,
        conversation_history: messages,
        school_info: SCHOOL_INFO,
      })
      setMessages(m => [...m, { role: 'assistant', content: reply }])

      // Suggest lead form after 3 user messages
      const userCount = messages.filter(m => m.role === 'user').length + 1
      if (userCount === 3 && !leadSaved) setShowLead(true)
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Sorry, I had trouble responding. Please try again.' }])
    }
    setLoading(false)
  }

  async function saveLead() {
    if (!leadForm.phone) return
    try {
      await post('/admission/lead', { school_id: SCHOOL_ID, ...leadForm })
      setLeadSaved(true)
      setShowLead(false)
      setMessages(m => [...m, { role: 'assistant', content: `Thank you, ${leadForm.parent_name || 'there'}! We've saved your details. Our admissions team will contact you at ${leadForm.phone} within 24 hours. 🎓` }])
    } catch (e: any) {
      alert(e.message)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, minHeight: 500 }}>
      {/* Chat window */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>Admission Assistant</div>
            <div style={{ fontSize: 11, color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} /> Online
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: m.role === 'user' ? '#6366f1' : '#1e1e2e' }}>
                {m.role === 'user' ? <User size={13} color="#fff" /> : <Bot size={13} color="#818cf8" />}
              </div>
              <div style={{
                maxWidth: '75%', padding: '9px 13px', borderRadius: m.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                background: m.role === 'user' ? 'linear-gradient(135deg,#6366f1,#7c3aed)' : '#1a1a1a',
                fontSize: 13, color: '#fafafa', lineHeight: 1.55,
              }}>
                {m.content}
              </div>
            </motion.div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: '#1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={13} color="#818cf8" />
              </div>
              <div style={{ padding: '10px 14px', background: '#1a1a1a', borderRadius: '4px 12px 12px 12px', display: 'flex', gap: 5 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', animation: `dot-bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid #1a1a1a', display: 'flex', gap: 8 }}>
          <input
            style={{ ...inp, flex: 1 }}
            placeholder="Type your question…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
          />
          <button onClick={send} disabled={!input.trim() || loading} style={{
            width: 38, height: 38, borderRadius: 9, border: 'none', cursor: 'pointer',
            background: input.trim() ? 'linear-gradient(135deg,#6366f1,#7c3aed)' : '#1c1c1c',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Send size={14} color={input.trim() ? '#fff' : '#52525b'} />
          </button>
        </div>
      </div>

      {/* Lead capture panel */}
      <div>
        <AnimatePresence>
          {showLead && !leadSaved && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ ...card, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa', marginBottom: 4 }}>💬 Save your details</div>
              <p style={{ fontSize: 12, color: '#52525b', marginBottom: 14 }}>Get a callback from our admissions team</p>
              {[['parent_name','Parent Name'],['child_name',"Child's Name"],['grade','Grade Applying'],['phone','Phone *'],['email','Email']].map(([k,l]) => (
                <div key={k} style={{ marginBottom: 10 }}>
                  <label style={label}>{l}</label>
                  <input style={inp} value={(leadForm as any)[k]} onChange={e => setLeadForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <button onClick={saveLead} style={{ width: '100%', padding: '9px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#6366f1,#7c3aed)', color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Submit Enquiry
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick questions */}
        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Quick Questions</div>
          {['What are your fees?','How do I apply for admission?','What classes are available?','Do you have hostel facility?','When does the next session start?'].map(q => (
            <button key={q} onClick={() => { setInput(q); }} style={{
              width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 7,
              border: '1px solid #1e1e1e', background: 'transparent', color: '#71717a',
              fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', marginBottom: 6,
              transition: 'all 0.1s',
            }}
              onMouseEnter={e => { (e.currentTarget).style.borderColor = '#6366f1'; (e.currentTarget).style.color = '#a5b4fc' }}
              onMouseLeave={e => { (e.currentTarget).style.borderColor = '#1e1e1e'; (e.currentTarget).style.color = '#71717a' }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Leads ─────────────────────────────────────────────────────────────────────
function LeadsTab() {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  function load() {
    setLoading(true)
    get('/admission/leads').then(setLeads).catch(console.error).finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function updateStatus(id: string, status: string) {
    await put(`/admission/leads/${id}`, { status }); load()
  }

  const filtered = filter === 'all' ? leads : leads.filter(l => l.status === filter)
  const statusColor: any = { new: '#fbbf24', contacted: '#818cf8', admitted: '#34d399', not_interested: '#f87171' }
  const StatusIcon: any = { new: Clock, contacted: Bot, admitted: CheckCircle, not_interested: XCircle }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0', color: '#52525b' }}>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['all','new','contacted','admitted','not_interested'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '5px 12px', borderRadius: 6, border: '1px solid #1e1e1e', fontFamily: 'inherit',
            fontSize: 11, fontWeight: filter === s ? 600 : 400, cursor: 'pointer',
            background: filter === s ? '#1e1e2e' : 'transparent',
            color: filter === s ? '#818cf8' : '#52525b',
          }}>{s.replace('_',' ')}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(l => {
          const SIcon = StatusIcon[l.status] || Clock
          return (
            <div key={l._id} style={{ ...card, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: `${statusColor[l.status]}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <SIcon size={16} color={statusColor[l.status]} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>
                  {l.parent_name || 'Unknown'} {l.child_name ? `→ ${l.child_name}` : ''}
                  {l.grade ? ` (${l.grade})` : ''}
                </div>
                <div style={{ fontSize: 11, color: '#52525b', display: 'flex', gap: 12, marginTop: 2 }}>
                  {l.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={10} />{l.phone}</span>}
                  {l.email && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={10} />{l.email}</span>}
                </div>
              </div>
              <div style={{ fontSize: 10, color: '#3f3f46' }}>{new Date(l.created_at).toLocaleDateString()}</div>
              <select value={l.status} onChange={e => updateStatus(l._id, e.target.value)} style={{
                background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 6,
                padding: '4px 8px', fontSize: 11, color: statusColor[l.status] || '#a1a1aa',
                fontFamily: 'inherit', cursor: 'pointer',
              }}>
                {['new','contacted','admitted','not_interested'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
              </select>
            </div>
          )
        })}
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: '#3f3f46' }}>No leads yet.</div>}
      </div>
    </div>
  )
}
