import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Copy, Check, Mail, ChevronDown, Search, User, X, Edit3 } from 'lucide-react'
import { chat } from '../lib/openrouter'

function token() { return localStorage.getItem('kairo_token') || '' }
async function apiFetch(path: string) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
  })
  if (!res.ok) return null
  return res.json()
}

interface Student { id: string; name: string; class_name?: string; subject?: string }

const SYSTEM = `You are Kyno, assisting Indian school teachers and admins.
Write professional, polite parent messages suitable for WhatsApp, SMS or email (under 160 words).
If bilingual requested, provide English version then Hindi version separated by a line.`

const TEMPLATES = [
  { label: '📅 Absent today',     prompt: 'Student was absent today without prior notice.' },
  { label: '📉 Poor performance', prompt: 'Student has shown declining performance in recent tests.' },
  { label: '💰 Fee reminder',     prompt: 'Monthly school fee is pending and should be paid by the due date.' },
  { label: '🤝 Parent meeting',   prompt: 'Parent-teacher meeting is scheduled. Request the parent to attend.' },
  { label: '🏆 Achievement',      prompt: 'Student performed exceptionally well and achieved top rank in class.' },
  { label: '⚠️ Behaviour issue',  prompt: 'Student has been misbehaving in class and needs parental guidance.' },
  { label: '📝 Homework missing', prompt: 'Student has not submitted homework for the past week.' },
  { label: '🤒 Health concern',   prompt: 'Student appeared unwell today and should see a doctor.' },
]

function NamePicker({
  value,
  onChange,
  students,
}: {
  value: string
  onChange: (name: string) => void
  students: Student[]
}) {
  const [open, setOpen]         = useState(false)
  const [query, setQuery]       = useState(value)
  const ref                     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query.trim()
    ? students.filter(s => s.name.toLowerCase().includes(query.toLowerCase()))
    : students

  function select(s: Student) {
    onChange(s.name)
    setQuery(s.name)
    setOpen(false)
  }

  function clear() {
    onChange('')
    setQuery('')
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#141A2A', border: '1px solid #1f2532', borderRadius: 8,
        padding: '0 12px', transition: 'border-color 0.15s',
      }}
        onFocus={() => {}}
      >
        <Search size={13} color="#6B7280" style={{ flexShrink: 0 }} />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={students.length > 0 ? 'Search or type student name…' : 'Type student name…'}
          style={{
            flex: 1, padding: '10px 0', background: 'none', border: 'none',
            fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none',
          }}
        />
        {query && (
          <button className="kyno-ghost" onClick={clear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 0 }}>
            <X size={13} />
          </button>
        )}
        {students.length > 0 && (
          <button className="kyno-ghost" onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 0 }}>
            <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && students.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50,
              background: '#1C2233', border: '1px solid #2a2a2a', borderRadius: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxHeight: 220, overflowY: 'auto',
            }}
          >
            {filtered.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 12, color: '#6B7280' }}>
                No students found — your typed name will be used.
              </div>
            ) : (
              filtered.map(s => (
                <button
                  key={s.id}
                  onClick={() => select(s)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', background: 'none', border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    borderBottom: '1px solid #1f2532',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1f2532' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                    background: 'linear-gradient(135deg, #7C5CFF, #7C5CFF)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: '#fff',
                  }}>
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>{s.name}</div>
                    {(s.class_name || s.subject) && (
                      <div style={{ fontSize: 11, color: '#6B7280' }}>
                        {[s.class_name && `Class ${s.class_name}`, s.subject].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function ParentMessage() {
  const [studentName, setStudentName] = useState('')
  const [situation, setSituation]     = useState('')
  const [tone, setTone]               = useState('Professional')
  const [bilingual, setBilingual]     = useState(false)
  const [message, setMessage]         = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [copied, setCopied]           = useState(false)
  const [editing, setEditing]         = useState(false)

  const [students, setStudents]       = useState<Student[]>([])

  useEffect(() => {
    const raw = localStorage.getItem('kairo_profile')
    if (!raw) return
    try {
      const profile = JSON.parse(raw)
      const schoolId = profile.school_id
      if (!schoolId) return
      apiFetch(`/schools/${schoolId}/members?role=student`)
        .then(d => { if (d?.members) setStudents(d.members) })
        .catch(() => {})
    } catch {}
  }, [])

  async function generate() {
    if (!situation.trim()) { setError('Please describe the situation first.'); return }
    setLoading(true); setError(''); setMessage(''); setEditing(false)
    try {
      const r = await chat({
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: `Write a ${tone.toLowerCase()} parent message.\nStudent: ${studentName.trim() || 'the student'}\nSituation: ${situation}\n${bilingual ? 'Provide both English and Hindi versions.' : 'English only.'}`,
          },
        ],
      })
      setMessage(r)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  function copy() {
    navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function openGmail() {
    const subject = encodeURIComponent(`Message regarding ${studentName || 'your child'}`)
    const body    = encodeURIComponent(message)
    window.open(`https://mail.google.com/mail/?view=cm&su=${subject}&body=${body}`, '_blank')
  }

  function openMailto() {
    const subject = encodeURIComponent(`Message regarding ${studentName || 'your child'}`)
    const body    = encodeURIComponent(message)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 960, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Parent Message Writer</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
          AI-crafted WhatsApp, SMS &amp; email messages — edit and send in seconds
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: message ? '1fr 1fr' : '1fr', gap: 24 }}>

        <div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 8,
              textTransform: 'uppercase', letterSpacing: 0.8 }}>Quick templates</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TEMPLATES.map(t => (
                <motion.button className="kyno-chip" key={t.label} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setSituation(t.prompt)}
                  style={{
                    padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                    background: situation === t.prompt ? 'rgba(124, 92, 255, 0.15)' : '#1C2233',
                    border: `1px solid ${situation === t.prompt ? '#7C5CFF' : '#1f2532'}`,
                    color: situation === t.prompt ? '#A5B4FC' : '#9CA3AF',
                    transition: 'all 0.1s',
                  }}>
                  {t.label}
                </motion.button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 6,
              textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Student name
              {students.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, color: '#6B7280', textTransform: 'none', letterSpacing: 0 }}>
                  · {students.length} students in your school
                </span>
              )}
            </label>
            <NamePicker value={studentName} onChange={setStudentName} students={students} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 6,
              textTransform: 'uppercase', letterSpacing: 0.8 }}>Situation</label>
            <textarea rows={4} value={situation} onChange={e => setSituation(e.target.value)}
              placeholder="Describe what happened or what you need to communicate…"
              style={{ width: '100%', background: '#141A2A', border: '1px solid #1f2532', borderRadius: 8,
                padding: '10px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit',
                outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
              onFocus={e => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#7C5CFF' }}
              onBlur={e => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#1f2532' }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 8,
              textTransform: 'uppercase', letterSpacing: 0.8 }}>Tone</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['Professional', 'Friendly', 'Urgent', 'Formal', 'Empathetic'].map(t => (
                <motion.button className="kyno-chip" key={t} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={() => setTone(t)}
                  style={{
                    padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    background: tone === t ? 'rgba(124, 92, 255, 0.15)' : '#1C2233',
                    border: `1px solid ${tone === t ? '#7C5CFF' : '#1f2532'}`,
                    color: tone === t ? '#A5B4FC' : '#6B7280',
                    transition: 'all 0.12s',
                  }}>
                  {t}
                </motion.button>
              ))}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer' }}>
            <input type="checkbox" checked={bilingual} onChange={e => setBilingual(e.target.checked)}
              style={{ accentColor: '#7C5CFF', width: 15, height: 15 }} />
            <span style={{ fontSize: 13, color: '#9CA3AF' }}>Include Hindi translation</span>
          </label>

          {error && (
            <div style={{ fontSize: 12, color: '#A5B4FC', background: 'rgba(124, 92, 255, 0.08)',
              border: '1px solid rgba(124, 92, 255, 0.2)', borderRadius: 7, padding: '8px 12px', marginBottom: 14 }}>
              {error}
            </div>
          )}

          <motion.button className="kyno-chunky" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={generate}
            disabled={loading || !situation.trim()}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '11px 22px',
              borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #7C5CFF, #7C5CFF)', color: '#fff',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              cursor: loading || !situation.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !situation.trim() ? 0.6 : 1,
              boxShadow: '0 0 20px rgba(124, 92, 255, 0.03)',
            }}>
            <Sparkles size={14} />{loading ? 'Writing…' : 'Write message'}
          </motion.button>
        </div>

        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              style={{ background: '#141A2A', border: '1px solid #1f2532', borderRadius: 14,
                padding: 20, display: 'flex', flexDirection: 'column', gap: 0 }}>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Generated message
                </span>
                <button className="kyno-ghost" onClick={() => setEditing(e => !e)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                    color: editing ? '#A5B4FC' : '#9CA3AF',
                    background: editing ? 'rgba(124, 92, 255, 0.1)' : 'none',
                    border: `1px solid ${editing ? '#7C5CFF' : '#1f2532'}`,
                    borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  <Edit3 size={11} />{editing ? 'Done editing' : 'Edit'}
                </button>
              </div>

              {editing ? (
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={12}
                  style={{
                    flex: 1, width: '100%', background: '#141A2A', border: '1px solid #7C5CFF',
                    borderRadius: 8, padding: '12px', fontSize: 14, color: '#d4d4d8',
                    fontFamily: 'inherit', lineHeight: 1.7, outline: 'none', resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              ) : (
                <div
                  onClick={() => setEditing(true)}
                  title="Click to edit"
                  style={{
                    flex: 1, fontSize: 14, color: '#d4d4d8', lineHeight: 1.7,
                    whiteSpace: 'pre-wrap', cursor: 'text',
                    minHeight: 120, padding: '2px 0',
                  }}>
                  {message}
                </div>
              )}

              <div style={{ fontSize: 11, color: '#4B5563', marginTop: 8, marginBottom: 14 }}>
                {message.length} characters · {message.split(/\s+/).filter(Boolean).length} words
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <motion.button className="kyno-ghost" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={copy}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
                    color: copied ? '#A5B4FC' : '#fafafa',
                    background: copied ? 'rgba(165, 180, 252, 0.12)' : '#171D2D',
                    border: `1px solid ${copied ? 'rgba(165, 180, 252, 0.3)' : '#2a2a2a'}`,
                    borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}>
                  {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                </motion.button>

                <motion.button className="kyno-ghost" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={openGmail}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
                    color: '#ea4335', background: 'rgba(234,67,53,0.1)', border: '1px solid rgba(234,67,53,0.25)',
                    borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  <Mail size={12} /> Open in Gmail
                </motion.button>

                <motion.button className="kyno-ghost" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={openMailto}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
                    color: '#9CA3AF', background: '#1C2233', border: '1px solid #1f2532',
                    borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  <Mail size={12} /> Mail app
                </motion.button>

                <motion.button className="kyno-ghost" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={generate} disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
                    color: '#A5B4FC', background: 'rgba(124, 92, 255, 0.1)', border: '1px solid rgba(124, 92, 255, 0.25)',
                    borderRadius: 8, padding: '8px 14px', cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', opacity: loading ? 0.5 : 1,
                  }}>
                  <Sparkles size={12} /> Regenerate
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
