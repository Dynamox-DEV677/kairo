import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { chat } from '../lib/openrouter'

const SYSTEM = `You are Kairo, an expert exam analyst for Indian board exams.
Predict the most likely exam topics based on 10-year patterns. Provide:
1. High probability topics (very likely) — with reasoning
2. Medium probability topics
3. Topics to revise lightly
4. Question types and marks-wise prediction
Be specific and use markdown formatting.`

const sel = (value: string, onChange: (v: string) => void, options: string[]) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    style={{ width: '100%', background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', appearance: 'none' }}>
    {options.map(o => <option key={o}>{o}</option>)}
  </select>
)

export default function ExamPredictor() {
  const [board, setBoard] = useState('CBSE')
  const [cls, setCls] = useState('10')
  const [subject, setSubject] = useState('Mathematics')
  const [prediction, setPrediction] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function predict() {
    setLoading(true); setError(''); setPrediction('')
    try {
      const r = await chat({ messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: `Board: ${board}, Class: ${cls}, Subject: ${subject}. Predict what topics are most likely in this year's board exam.` }] })
      setPrediction(r)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 900, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Exam Predictor</h1>
        <p style={{ fontSize: 13, color: '#52525b', marginTop: 4 }}>10-year pattern analysis — highest probability topics</p>
      </div>

      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Board</label>
            {sel(board, setBoard, ['CBSE','ICSE','Maharashtra HSC','Tamil Nadu','Karnataka','UP Board','Bihar Board'])}
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Class</label>
            {sel(cls, setCls, ['9','10','11','12'])}
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Subject</label>
            {sel(subject, setSubject, ['Mathematics','Physics','Chemistry','Biology','English','Hindi','History','Geography','Economics','Accounts','Business Studies','Computer Science'])}
          </div>
        </div>

        {error && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 14 }}>{error}</p>}

        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={predict} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 22px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #6366f1, #7c3aed)', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}>
          <Sparkles size={14} />
          {loading ? 'Analysing patterns…' : 'Predict exam topics'}
        </motion.button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
          </div>
          <p style={{ fontSize: 13, color: '#52525b' }}>Analysing 10 years of question papers…</p>
        </div>
      )}

      {prediction && !loading && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: '28px 32px' }}>
          <div className="prose-ai"><ReactMarkdown remarkPlugins={[remarkGfm]}>{prediction}</ReactMarkdown></div>
        </motion.div>
      )}
    </div>
  )
}
