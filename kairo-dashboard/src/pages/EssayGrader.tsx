import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { chat } from '../lib/openrouter'

const SYSTEM = `You are Kairo, an expert examiner for Indian school board exams.
Grade the student's answer and provide:
1. Score out of the specified marks (e.g. 8/10)
2. What was done well
3. What is missing or incorrect
4. Model answer / key points
5. Tips for improvement
Format with markdown headers.`

export default function EssayGrader() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [marks, setMarks] = useState('5')
  const [subject, setSubject] = useState('General')
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function grade() {
    if (!question.trim() || !answer.trim()) { setError('Fill in both question and answer'); return }
    setLoading(true); setError(''); setFeedback('')
    try {
      const r = await chat({ messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: `Subject: ${subject}\nMarks: ${marks}\n\nQuestion: ${question}\n\nStudent Answer:\n${answer}` }] })
      setFeedback(r)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const textarea = (rows: number, placeholder: string, value: string, onChange: (v: string) => void) => (
    <textarea rows={rows} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
      onFocus={e => (e.target as HTMLTextAreaElement).style.borderColor = '#6366f1'}
      onBlur={e => (e.target as HTMLTextAreaElement).style.borderColor = '#1e1e1e'}
    />
  )

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1000, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Essay Grader</h1>
        <p style={{ fontSize: 13, color: '#52525b', marginTop: 4 }}>Get teacher-level marks and feedback on any answer</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: feedback ? '1fr 1fr' : '1fr', gap: 20 }}>
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Subject</label>
              <select value={subject} onChange={e => setSubject(e.target.value)} style={{ width: '100%', background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', appearance: 'none' }}>
                {['General','English','Hindi','History','Geography','Science','Economics','Political Science','Business Studies'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ width: 110 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Total marks</label>
              <select value={marks} onChange={e => setMarks(e.target.value)} style={{ width: '100%', background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', appearance: 'none' }}>
                {['2','3','4','5','6','8','10','15','20'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Question</label>
            {textarea(3, 'Paste the question here…', question, setQuestion)}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Student answer <span style={{ color: '#3f3f46', textTransform: 'none', letterSpacing: 0 }}>({answer.length} chars)</span>
            </label>
            {textarea(10, 'Paste or type the student\'s answer here…', answer, setAnswer)}
          </div>

          {error && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 14 }}>{error}</p>}

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={grade} disabled={loading || !question.trim() || !answer.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 22px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #7c3aed)', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}>
            <Sparkles size={14} />
            {loading ? 'Grading…' : `Grade answer (${marks} marks)`}
          </motion.button>
        </div>

        {(feedback || loading) && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 24, overflowY: 'auto', maxHeight: 600 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#3f3f46', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>AI Feedback</p>
            {loading ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1', animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                <span style={{ fontSize: 13, color: '#52525b' }}>Grading…</span>
              </div>
            ) : (
              <div className="prose-ai"><ReactMarkdown remarkPlugins={[remarkGfm]}>{feedback}</ReactMarkdown></div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
