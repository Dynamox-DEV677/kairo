import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { chat } from '../lib/openrouter'

const SYSTEM = `You are Kora, an expert pedagogy advisor for Indian school teachers.
Create a detailed NEP 2020-aligned lesson plan including:
- Learning objectives, materials needed, introduction/hook
- Main teaching activities, student activities
- Assessment, homework, teacher notes
Format clearly with markdown.`

export default function LessonPlan() {
  const [topic, setTopic] = useState('')
  const [subject, setSubject] = useState('Mathematics')
  const [cls, setCls] = useState('9')
  const [duration, setDuration] = useState('45')
  const [board, setBoard] = useState('CBSE')
  const [plan, setPlan] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sel = (v: string, set: (v: string) => void, opts: string[]) => (
    <select value={v} onChange={e => set(e.target.value)} style={{ width: '100%', background: '#0E1117', border: '1px solid #1f2532', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', appearance: 'none' }}>
      {opts.map(o => <option key={o}>{o}</option>)}
    </select>
  )

  async function generate() {
    if (!topic.trim()) { setError('Enter a topic'); return }
    setLoading(true); setError(''); setPlan('')
    try {
      const r = await chat({ messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: `${duration}-min lesson plan. Subject: ${subject}. Class: ${cls}. Board: ${board}. Topic: ${topic}` }] })
      setPlan(r)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 900, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Lesson Plan Builder</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>NEP 2020-aligned lesson plans in seconds</p>
      </div>

      <div style={{ background: '#0E1117', border: '1px solid #1f2532', borderRadius: 14, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
          {[
            { label: 'Board', v: board, set: setBoard, opts: ['CBSE','ICSE','Maharashtra','Tamil Nadu','Karnataka'] },
            { label: 'Subject', v: subject, set: setSubject, opts: ['Mathematics','Physics','Chemistry','Biology','English','Hindi','History','Geography','Science'] },
            { label: 'Class', v: cls, set: setCls, opts: ['6','7','8','9','10','11','12'] },
            { label: 'Duration (min)', v: duration, set: setDuration, opts: ['30','40','45','50','60'] },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>{f.label}</label>
              {sel(f.v, f.set, f.opts)}
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Topic</label>
          <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && generate()}
            placeholder="e.g. Introduction to Quadratic Equations"
            style={{ width: '100%', background: '#0E1117', border: '1px solid #1f2532', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none' }} />
        </div>
        {error && <p style={{ fontSize: 12, color: '#66D9FF', marginBottom: 14 }}>{error}</p>}
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={generate} disabled={loading || !topic.trim()}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 22px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #4F7CFF, #4F7CFF)', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, boxShadow: '0 0 20px rgba(79, 124, 255, 0.03)' }}>
          <Sparkles size={14} />{loading ? 'Building…' : 'Build lesson plan'}
        </motion.button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#4F7CFF', animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
          </div>
          <p style={{ fontSize: 13, color: '#6B7280' }}>Building lesson plan…</p>
        </div>
      )}

      {plan && !loading && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={() => setPlan('')} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 7, background: '#151922', border: '1px solid #1f2532', color: '#9CA3AF', cursor: 'pointer', fontFamily: 'inherit' }}>New plan</button>
          </div>
          <div style={{ background: '#0E1117', border: '1px solid #1f2532', borderRadius: 14, padding: '28px 32px' }}>
            <div className="prose-ai"><ReactMarkdown remarkPlugins={[remarkGfm]}>{plan}</ReactMarkdown></div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
