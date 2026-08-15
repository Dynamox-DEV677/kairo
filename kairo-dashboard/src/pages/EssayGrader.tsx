import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { chat } from '../lib/openrouter'

const SYSTEM = `You are Kyno, an expert AI teaching assistant for Indian school students (CBSE/ICSE/state boards).

Your job is to grade the student's answer AND teach them how to write a better one.

Always respond in this exact markdown structure:

## Score
**X / Y marks** (give a fair score with one-line reasoning)

## What you did well
- Bullet points of strengths

## What's missing or wrong
- Specific points the student missed or got wrong

## Better structure
A short outline (intro/body/conclusion or step-1/step-2/step-3) showing how the answer should flow.

## Better wording
Show 1–3 specific phrases from the student's answer rewritten in stronger exam language.

## Model answer
A complete model answer at the right length for the marks. Use clear paragraphs and the exam-friendly phrasing students should aim for.

## Tip for next time
One actionable habit to improve.

Be warm, specific, and constructive. Never be vague.`

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

    let memoryContext = ''
    try {
      const r = await fetch('/api/memory/context', {
        headers: { Authorization: `Bearer ${localStorage.getItem('kairo_token') || ''}` },
      })
      if (r.ok) memoryContext = (await r.json()).context || ''
    } catch {  }

    try {
      const r = await chat({
        messages: [
          { role: 'system', content: SYSTEM + memoryContext },
          { role: 'user',   content: `Subject: ${subject}\nMarks: ${marks}\n\nQuestion: ${question}\n\nStudent Answer:\n${answer}` },
        ],
      })
      setFeedback(r)

      const scoreMatch = r.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/)
      if (scoreMatch) {
        const got   = parseFloat(scoreMatch[1])
        const total = parseFloat(scoreMatch[2])
        const pct   = total > 0 ? got / total : 0
        const topic = (question.split(/[?.\n]/)[0] || '').trim().slice(0, 80)
        if (topic) {
          try {
            await fetch('/api/memory/track', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('kairo_token') || ''}`,
              },
              body: JSON.stringify({
                type:    pct < 0.5 ? 'weak_topic' : pct > 0.85 ? 'strong_topic' : 'note',
                subject,
                topic,
                content: `Graded ${got}/${total}`,
                signal:  Math.max(-1, Math.min(1, (pct - 0.5) * 2)),
              }),
            })
          } catch {  }
        }
      }
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const textarea = (rows: number, placeholder: string, value: string, onChange: (v: string) => void) => (
    <textarea rows={rows} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', background: '#141A2A', border: '1px solid #1f2532', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
      onFocus={e => (e.target as HTMLTextAreaElement).style.borderColor = '#7C5CFF'}
      onBlur={e => (e.target as HTMLTextAreaElement).style.borderColor = '#1f2532'}
    />
  )

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1000, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Grader</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Score · model answer · how to write it better — your AI teaching assistant</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: feedback ? '1fr 1fr' : '1fr', gap: 20 }}>
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Subject</label>
              <select value={subject} onChange={e => setSubject(e.target.value)} style={{ width: '100%', background: '#141A2A', border: '1px solid #1f2532', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', appearance: 'none' }}>
                {['General','English','Hindi','History','Geography','Science','Economics','Political Science','Business Studies'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ width: 110 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Total marks</label>
              <select value={marks} onChange={e => setMarks(e.target.value)} style={{ width: '100%', background: '#141A2A', border: '1px solid #1f2532', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', appearance: 'none' }}>
                {['2','3','4','5','6','8','10','15','20'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Question</label>
            {textarea(3, 'Paste the question here…', question, setQuestion)}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Student answer <span style={{ color: '#4B5563', textTransform: 'none', letterSpacing: 0 }}>({answer.length} chars)</span>
            </label>
            {textarea(10, 'Paste or type the student\'s answer here…', answer, setAnswer)}
          </div>

          {error && <p style={{ fontSize: 12, color: '#A5B4FC', marginBottom: 14 }}>{error}</p>}

          <motion.button className="kyno-chunky" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={grade} disabled={loading || !question.trim() || !answer.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 22px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #7C5CFF, #6455e0)', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, boxShadow: '0 0 20px rgba(124, 92, 255, 0.03)' }}>
            <Sparkles size={14} />
            {loading ? 'Grading…' : `Grade answer (${marks} marks)`}
          </motion.button>
        </div>

        {(feedback || loading) && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            style={{ background: '#141A2A', border: '1px solid #1f2532', borderRadius: 14, padding: 24, overflowY: 'auto', maxHeight: 600 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>AI Feedback</p>
            {loading ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#7C5CFF', animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                <span style={{ fontSize: 13, color: '#6B7280' }}>Grading…</span>
              </div>
            ) : (
              <div className="prose-ai"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{feedback}</ReactMarkdown></div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
