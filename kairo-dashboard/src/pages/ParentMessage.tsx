import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Copy, Check } from 'lucide-react'
import { chat } from '../lib/openrouter'

const SYSTEM = `You are Kairo, assisting Indian school teachers and admins.
Write professional, polite parent messages suitable for WhatsApp or SMS (under 150 words).
If bilingual requested, provide English then Hindi versions.`

const TEMPLATES = [
  { label: '📅 Absent today', prompt: 'Student was absent today without prior notice.' },
  { label: '📉 Poor performance', prompt: 'Student has shown declining performance in recent tests.' },
  { label: '💰 Fee reminder', prompt: 'Monthly school fee is pending and should be paid by the due date.' },
  { label: '🤝 Parent meeting', prompt: 'Parent-teacher meeting is scheduled. Request the parent to attend.' },
  { label: '🏆 Achievement', prompt: 'Student performed exceptionally well and achieved top rank in class.' },
  { label: '⚠️ Behaviour issue', prompt: 'Student has been misbehaving in class and needs parental guidance.' },
]

export default function ParentMessage() {
  const [studentName, setStudentName] = useState('')
  const [situation, setSituation] = useState('')
  const [tone, setTone] = useState('Professional')
  const [bilingual, setBilingual] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function generate() {
    if (!situation.trim()) { setError('Describe the situation'); return }
    setLoading(true); setError(''); setMessage('')
    try {
      const r = await chat({ messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: `Write a ${tone.toLowerCase()} parent message.\nStudent: ${studentName || 'the student'}\nSituation: ${situation}\n${bilingual ? 'Provide English and Hindi versions.' : 'English only.'}` }] })
      setMessage(r)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  function copy() { navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 900, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Parent Message Writer</h1>
        <p style={{ fontSize: 13, color: '#52525b', marginTop: 4 }}>Professional WhatsApp and SMS messages in seconds</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: message ? '1fr 1fr' : '1fr', gap: 20 }}>
        <div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Quick templates</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TEMPLATES.map(t => (
                <motion.button key={t.label} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setSituation(t.prompt)}
                  style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                    background: '#161616', border: '1px solid #1e1e1e', color: '#71717a', transition: 'all 0.1s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#fafafa'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#3f3f46' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#71717a'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#1e1e1e' }}>
                  {t.label}
                </motion.button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Student name (optional)</label>
            <input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="e.g. Rahul Sharma"
              style={{ width: '100%', background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none' }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Situation</label>
            <textarea rows={4} value={situation} onChange={e => setSituation(e.target.value)} placeholder="Describe what happened or what you need to communicate…"
              style={{ width: '100%', background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Tone</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {['Professional','Friendly','Urgent','Formal'].map(t => (
                <motion.button key={t} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={() => setTone(t)}
                  style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    background: tone === t ? 'rgba(99,102,241,0.15)' : '#161616',
                    border: `1px solid ${tone === t ? '#6366f1' : '#1e1e1e'}`,
                    color: tone === t ? '#818cf8' : '#52525b' }}>
                  {t}
                </motion.button>
              ))}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer' }}>
            <input type="checkbox" checked={bilingual} onChange={e => setBilingual(e.target.checked)} style={{ accentColor: '#6366f1', width: 15, height: 15 }} />
            <span style={{ fontSize: 13, color: '#71717a' }}>Include Hindi translation</span>
          </label>

          {error && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 14 }}>{error}</p>}

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={generate} disabled={loading || !situation.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 22px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #7c3aed)', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}>
            <Sparkles size={14} />{loading ? 'Writing…' : 'Write message'}
          </motion.button>
        </div>

        {message && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#3f3f46', textTransform: 'uppercase', letterSpacing: 1 }}>Generated message</span>
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={copy}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: copied ? '#34d399' : '#71717a', background: 'none', border: '1px solid #1e1e1e', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                {copied ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy</>}
              </motion.button>
            </div>
            <p style={{ fontSize: 14, color: '#d4d4d8', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{message}</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
