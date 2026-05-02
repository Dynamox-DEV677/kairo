import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { chat } from '../lib/openrouter'

const SYSTEM = `You are Kairo, an expert study coach for Indian board exam students.
Create a detailed, realistic day-by-day study plan. Format as markdown with clear structure,
daily schedule, subject breakdown, revision days and mock test days. Be specific and motivating.`

const SUBJECTS = ['Mathematics','Physics','Chemistry','Biology','English','Hindi','History','Geography','Political Science','Economics','Computer Science']

export default function StudyPlan() {
  const [form, setForm] = useState({ days: 30, subjects: [] as string[], weakAreas: '', hours: 6, board: 'CBSE', cls: '10' })
  const [plan, setPlan] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggleSubject = (s: string) => setForm(f => ({ ...f, subjects: f.subjects.includes(s) ? f.subjects.filter(x => x !== s) : [...f.subjects, s] }))

  async function generate() {
    if (!form.subjects.length) { setError('Select at least one subject'); return }
    setLoading(true); setError(''); setPlan('')
    try {
      const r = await chat({ messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: `${form.days}-day plan, Class ${form.cls} ${form.board}. Subjects: ${form.subjects.join(', ')}. Weak: ${form.weakAreas || 'none'}. Daily hours: ${form.hours}.` }] })
      setPlan(r)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const inp = (extra = {}) => ({ style: { background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', width: '100%', ...extra } })

  return (
    <div style={{ padding: '28px 36px', maxWidth: 900, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Study Plan Builder</h1>
        <p style={{ fontSize: 13, color: '#52525b', marginTop: 4 }}>Personalised day-by-day board exam preparation</p>
      </div>

      {!plan && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 28, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 11, color: '#71717a', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>Board</label>
              <select {...inp({ appearance: 'none' })} value={form.board} onChange={e => setForm(f => ({ ...f, board: e.target.value }))}>
                {['CBSE','ICSE','Maharashtra','Tamil Nadu','Karnataka','UP Board'].map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#71717a', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>Class</label>
              <select {...inp({ appearance: 'none' })} value={form.cls} onChange={e => setForm(f => ({ ...f, cls: e.target.value }))}>
                {['8','9','10','11','12'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#71717a', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>Days until exam</label>
              <input type="number" min={7} max={180} {...inp()} value={form.days} onChange={e => setForm(f => ({ ...f, days: +e.target.value }))} />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: '#71717a', display: 'block', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Daily study hours: <span style={{ color: '#818cf8' }}>{form.hours}h</span>
            </label>
            <input type="range" min={2} max={12} value={form.hours} onChange={e => setForm(f => ({ ...f, hours: +e.target.value }))} style={{ width: '100%', accentColor: '#6366f1' }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: '#71717a', display: 'block', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>Subjects</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SUBJECTS.map(s => (
                <motion.button key={s} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => toggleSubject(s)}
                  style={{ padding: '6px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    background: form.subjects.includes(s) ? 'rgba(99,102,241,0.15)' : '#161616',
                    border: `1px solid ${form.subjects.includes(s) ? '#6366f1' : '#1e1e1e'}`,
                    color: form.subjects.includes(s) ? '#818cf8' : '#52525b' }}>
                  {s}
                </motion.button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11, color: '#71717a', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>Weak areas (optional)</label>
            <input {...inp()} placeholder="e.g. Calculus, Organic Chemistry" value={form.weakAreas} onChange={e => setForm(f => ({ ...f, weakAreas: e.target.value }))} />
          </div>

          {error && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 16 }}>{error}</p>}

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={generate} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 22px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #7c3aed)', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 0 20px rgba(99,102,241,0.3)', opacity: loading ? 0.6 : 1 }}>
            <Sparkles size={14} />
            {loading ? 'Building plan…' : 'Build study plan'}
          </motion.button>
        </motion.div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
          </div>
          <p style={{ fontSize: 13, color: '#52525b' }}>Building your personalised plan…</p>
        </div>
      )}

      {plan && !loading && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: '#52525b' }}>Your {form.days}-day plan is ready</p>
            <button onClick={() => setPlan('')} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 7, background: '#161616', border: '1px solid #1e1e1e', color: '#71717a', cursor: 'pointer', fontFamily: 'inherit' }}>Rebuild plan</button>
          </div>
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: '28px 32px' }}>
            <div className="prose-ai"><ReactMarkdown remarkPlugins={[remarkGfm]}>{plan}</ReactMarkdown></div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
