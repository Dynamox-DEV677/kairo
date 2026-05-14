import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Megaphone, Plus, Trash2, Copy, Check, MessageCircle, Phone } from 'lucide-react'
import { post, get, del } from '../lib/api'

const SCHOOL_ID = 'demo_school'

const card  = { background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 20 } as React.CSSProperties
const inp   = { background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', width: '100%' } as React.CSSProperties
const lbl   = { fontSize: 11, color: '#71717a', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 } as React.CSSProperties
const btn   = (active = true) => ({ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: 'none', background: active ? 'linear-gradient(135deg,#7c3aed,#7c3aed)' : '#1c1c1c', color: active ? '#fff' : '#52525b', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: active ? 'pointer' : 'not-allowed' } as React.CSSProperties)

const TYPES = ['general','exam','holiday','event','fee','result','emergency']
const TYPE_COLORS: Record<string, string> = { general: '#a78bfa', exam: '#c4b5fd', holiday: '#c4b5fd', event: '#38bdf8', fee: '#c4b5fd', result: '#a78bfa', emergency: '#a78bfa' }

export default function Announcement() {
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [selected, setSelected]           = useState<any>(null)
  const [showForm, setShowForm]           = useState(false)
  const [loading, setLoading]             = useState(true)
  const [generating, setGenerating]       = useState(false)
  const [err, setErr]                     = useState('')
  const [form, setForm] = useState({ type: 'general', topic: '', audience: 'all', tone: 'formal', details: '', school_name: 'Our School' })

  function load() {
    setLoading(true)
    get(`/announcement?school_id=${SCHOOL_ID}`).then(setAnnouncements).catch(console.error).finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function generate() {
    if (!form.topic.trim()) { setErr('Enter a topic'); return }
    setGenerating(true); setErr('')
    try {
      const a = await post('/announcement/generate', { school_id: SCHOOL_ID, ...form })
      setAnnouncements(prev => [a, ...prev])
      setSelected(a)
      setShowForm(false)
      setForm(f => ({ ...f, topic: '', details: '' }))
    } catch (e: any) { setErr(e.message) }
    finally { setGenerating(false) }
  }

  async function remove(id: string) {
    if (!confirm('Delete this announcement?')) return
    await del(`/announcement/${id}?school_id=${SCHOOL_ID}`)
    if (selected?.id === id) setSelected(null)
    load()
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 270, borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0d0d0d' }}>
        <div style={{ padding: '16px 12px', borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa', marginBottom: 10 }}>Announcements</div>
          <button onClick={() => setShowForm(f => !f)} style={{ ...btn(), width: '100%', justifyContent: 'center', padding: '7px 12px' }}>
            <Plus size={13} /> New Announcement
          </button>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden', borderBottom: '1px solid #1a1a1a' }}>
              <div style={{ padding: 12 }}>
                <label style={lbl}>School Name</label>
                <input style={{ ...inp, marginBottom: 8 }} value={form.school_name} onChange={e => setForm(f => ({ ...f, school_name: e.target.value }))} />
                <label style={lbl}>Type</label>
                <select style={{ ...inp, marginBottom: 8 }} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
                <label style={lbl}>Audience</label>
                <select style={{ ...inp, marginBottom: 8 }} value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}>
                  {['all','students','parents','teachers'].map(a => <option key={a}>{a}</option>)}
                </select>
                <label style={lbl}>Tone</label>
                <select style={{ ...inp, marginBottom: 8 }} value={form.tone} onChange={e => setForm(f => ({ ...f, tone: e.target.value }))}>
                  {['formal','friendly','urgent'].map(t => <option key={t}>{t}</option>)}
                </select>
                <label style={lbl}>Topic / Title</label>
                <input style={{ ...inp, marginBottom: 8 }} value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} placeholder="e.g. Annual Day on Dec 15th" />
                <label style={lbl}>Additional Details</label>
                <textarea style={{ ...inp, height: 70, resize: 'none', marginBottom: 8 }} value={form.details} onChange={e => setForm(f => ({ ...f, details: e.target.value }))} placeholder="Date, venue, action needed…" />
                {err && <p style={{ color: '#a78bfa', fontSize: 11, marginBottom: 8 }}>{err}</p>}
                <button onClick={generate} disabled={generating} style={{ ...btn(!generating), width: '100%', justifyContent: 'center', padding: '7px' }}>
                  {generating ? 'Generating…' : 'Generate'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
          {loading && <div style={{ textAlign: 'center', padding: 20, color: '#52525b', fontSize: 12 }}>Loading…</div>}
          {!loading && announcements.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: '#3f3f46', fontSize: 11 }}>No announcements yet</div>}
          {announcements.map(a => (
            <div key={a.id || a._id} onClick={() => setSelected(a)}
              style={{ padding: '10px', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                background: selected?.id === a.id || selected?._id === a._id ? '#1e1e2e' : 'transparent',
                border: `1px solid ${selected?.id === a.id || selected?._id === a._id ? '#7c3aed30' : 'transparent'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: TYPE_COLORS[a.type] || '#a78bfa', flexShrink: 0 }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e4e4e7', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title || a.topic}</div>
                <button onClick={e => { e.stopPropagation(); remove(a.id || a._id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3f3f46' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#a78bfa')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#3f3f46')}>
                  <Trash2 size={10} />
                </button>
              </div>
              <div style={{ fontSize: 10, color: '#52525b' }}>{a.type} · {a.audience}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {!selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#3f3f46' }}>
            <Megaphone size={48} />
            <p style={{ marginTop: 16, fontSize: 14 }}>Generate or select an announcement</p>
          </div>
        ) : <AnnouncementViewer a={selected} />}
      </div>
    </div>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#c4b5fd' : '#52525b', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
      {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
    </button>
  )
}

function AnnouncementViewer({ a }: { a: any }) {
  return (
    <motion.div key={a.id || a._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 5, background: `${TYPE_COLORS[a.type]}20`, color: TYPE_COLORS[a.type] || '#a78bfa' }}>
          {a.type?.toUpperCase()}
        </span>
        <span style={{ fontSize: 11, color: '#52525b' }}>{a.audience} · {a.tone}</span>
      </div>

      {/* Full Announcement */}
      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 20, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fafafa', flex: 1 }}>{a.title}</div>
          <CopyBtn text={a.body || ''} />
        </div>
        <div style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{a.body}</div>
        {a.key_dates?.length > 0 && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: '#0d0d0d', borderRadius: 8 }}>
            {a.key_dates.map((d: string, i: number) => <div key={i} style={{ fontSize: 11, color: '#c4b5fd', marginBottom: 2 }}>📅 {d}</div>)}
          </div>
        )}
        {a.action_required && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#a78bfa15', borderRadius: 8, border: '1px solid #a78bfa30' }}>
            <div style={{ fontSize: 11, color: '#a78bfa' }}>⚠ Action Required: {a.action_required}</div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* WhatsApp version */}
        {a.whatsapp_message && (
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#c4b5fd' }}>
                <MessageCircle size={13} /> WhatsApp Version
              </div>
              <CopyBtn text={a.whatsapp_message} />
            </div>
            <div style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.8 }}>{a.whatsapp_message}</div>
          </div>
        )}
        {/* SMS version */}
        {a.sms_version && (
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>
                <Phone size={13} /> SMS Version
              </div>
              <CopyBtn text={a.sms_version} />
            </div>
            <div style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.8 }}>{a.sms_version}</div>
            <div style={{ fontSize: 10, color: '#3f3f46', marginTop: 6 }}>{a.sms_version?.length || 0}/160 chars</div>
          </div>
        )}
      </div>

      {a.short_version && (
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 14, marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>Notice Board (1 line)</div>
            <CopyBtn text={a.short_version} />
          </div>
          <div style={{ fontSize: 13, color: '#e4e4e7' }}>{a.short_version}</div>
        </div>
      )}
    </motion.div>
  )
}
