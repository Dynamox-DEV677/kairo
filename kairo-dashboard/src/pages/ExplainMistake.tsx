/**
 * Explain My Mistake — beyond "wrong answer", AI walks the student through
 * WHY they were wrong, what concept they misunderstood, and how to avoid it next time.
 *
 * Auto-tracks the topic to ai_memory as a weak_topic so it surfaces in future
 * Adaptive Path / Revision Sim suggestions.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Sparkles, RefreshCw, BookOpen, AlertTriangle,
  Lightbulb, ArrowRight, Save,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { chat } from '../lib/openrouter'
import { saveToNotebook } from '../lib/notebook'

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Hindi', 'History', 'Geography', 'Economics', 'Computer Science', 'General']

const card: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(14px) saturate(140%)', WebkitBackdropFilter: 'blur(14px) saturate(140%)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }
const inp: React.CSSProperties = {
  background: '#0E1117', border: '1px solid #1f2532', borderRadius: 8,
  padding: '10px 12px', fontSize: 13.5, color: '#fafafa',
  fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
}
const lbl: React.CSSProperties = {
  fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 6,
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8,
}

const SYSTEM = `You are Kyno, a master AI tutor for Indian school students.

A student got a question wrong. Your job is NOT to grade — it's to teach them how to never make this mistake again.

Always respond in this exact markdown structure:

## Why your answer is wrong
2-3 sentences. Be specific about what's incorrect, not just "it's wrong".

## The concept you missed
Name the underlying concept they misunderstood. 3-5 sentences explaining the concept clearly.

## Where you went off-track
Trace the student's reasoning step-by-step. Identify the exact step where their thinking broke down.

## The correct approach
Step-by-step solution. Use $...$ for inline math, $$...$$ for display math, and **bold** for key phrases.

## How to avoid this next time
3 specific rules / mental checks the student can apply on similar questions.

## Practice prompt
One follow-up question (with the answer below) that tests the same concept slightly differently.

Be warm, direct, and concrete. Never vague. Use the student's mistake as a teaching moment, not a punishment.`

export default function ExplainMistake() {
  const [subject, setSubject]   = useState('Mathematics')
  const [question, setQuestion] = useState('')
  const [myAnswer, setMyAnswer] = useState('')
  const [correctAnswer, setCorrect] = useState('')
  const [busy, setBusy]         = useState(false)
  const [result, setResult]     = useState('')
  const [err, setErr]           = useState('')
  const [savedToBook, setSaved] = useState(false)

  async function explain() {
    if (!question.trim() || !myAnswer.trim()) {
      setErr('Question and your answer are required')
      return
    }
    setErr(''); setBusy(true); setResult(''); setSaved(false)

    // Pull memory context (best-effort)
    let memCtx = ''
    try {
      const r = await fetch('/api/memory/context', {
        headers: { Authorization: `Bearer ${localStorage.getItem('kairo_token') || ''}` },
      })
      if (r.ok) memCtx = (await r.json()).context || ''
    } catch { /* non-fatal */ }

    const userMsg = `Subject: ${subject}

Question:
${question.trim()}

My answer (which is wrong):
${myAnswer.trim()}
${correctAnswer.trim() ? '\nCorrect answer (for your reference):\n' + correctAnswer.trim() : ''}

Now teach me how to never make this mistake again, following your structure exactly.`

    try {
      const reply = await chat({
        messages: [
          { role: 'system', content: SYSTEM + memCtx },
          { role: 'user',   content: userMsg },
        ],
      })
      setResult(reply)

      // Track to AI Memory as weak_topic (best-effort)
      try {
        await fetch('/api/memory/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('kairo_token') || ''}`,
          },
          body: JSON.stringify({
            type:    'weak_topic',
            subject,
            topic:   question.split(/[?.\n]/)[0].trim().slice(0, 80),
            content: 'Got it wrong, asked AI to explain',
            signal:  -0.5,
          }),
        })
      } catch { /* memory is best-effort */ }
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveToBook() {
    if (!result) return
    const r = await saveToNotebook({
      kind: 'note',
      title: `Mistake Explained · ${question.slice(0, 60)}`,
      content: `**Subject:** ${subject}\n\n**Question:** ${question}\n\n**My answer:** ${myAnswer}\n${correctAnswer ? '\n**Correct:** ' + correctAnswer + '\n' : ''}\n\n---\n\n${result}`,
      subject,
      tags: ['mistake-explained'],
      source: 'explain-mistake',
    })
    if (r) setSaved(true)
  }

  function reset() {
    setQuestion(''); setMyAnswer(''); setCorrect(''); setResult(''); setErr(''); setSaved(false)
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1000, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: 'linear-gradient(135deg, #66D9FF, #A5B4FC)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 18px rgba(102, 217, 255, 0.03)', flexShrink: 0,
        }}>
          <AlertTriangle size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Explain My Mistake</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            Got a question wrong? AI walks you through why — concept gap, reasoning trace, and how to never do it again.
          </p>
        </div>
      </div>

      <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: result || busy ? '1fr 1.3fr' : '1fr', gap: 16 }}>
        {/* Form */}
        <div style={{ ...card, padding: 22 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Subject</label>
            <select value={subject} onChange={e => setSubject(e.target.value)}
              style={{ ...inp, appearance: 'none' as any }}>
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>The question</label>
            <textarea rows={3} placeholder="Paste the question you got wrong"
              value={question} onChange={e => setQuestion(e.target.value)}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Your answer (the wrong one)</label>
            <textarea rows={4} placeholder="What you wrote / picked"
              value={myAnswer} onChange={e => setMyAnswer(e.target.value)}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={lbl}>Correct answer <span style={{ color: '#4B5563', textTransform: 'none', letterSpacing: 0 }}>· optional, helps the AI</span></label>
            <textarea rows={2} placeholder="If you know it"
              value={correctAnswer} onChange={e => setCorrect(e.target.value)}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />
          </div>

          {err && <p style={{ fontSize: 12, color: '#66D9FF', marginBottom: 12 }}>{err}</p>}

          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={explain} disabled={busy || !question.trim() || !myAnswer.trim()}
            style={{
              width: '100%', padding: '12px', borderRadius: 10, border: 'none',
              background: busy || !question.trim() || !myAnswer.trim()
                ? '#1a1f2e'
                : 'linear-gradient(135deg, #66D9FF, #A5B4FC)',
              color: busy || !question.trim() || !myAnswer.trim() ? '#6B7280' : '#fff',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
              cursor: busy || !question.trim() || !myAnswer.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: busy || !question.trim() ? 'none' : '0 0 22px rgba(102, 217, 255, 0.35)',
            }}>
            <Brain size={14} />{busy ? 'Analyzing your mistake…' : 'Explain'}
          </motion.button>
        </div>

        {/* Result */}
        <AnimatePresence>
          {(busy || result) && (
            <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
              style={{ ...card, padding: 22, overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
              {busy && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0' }}>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #1f2532', borderTopColor: '#A5B4FC' }} />
                  <p style={{ fontSize: 13, color: '#9CA3AF' }}>Tracing where you went wrong…</p>
                </div>
              )}

              {result && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <Lightbulb size={14} color="#A5B4FC" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                      Tutor explanation
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: '#6B7280' }}>
                      Tracked to AI Memory
                    </span>
                  </div>

                  <div className="prose-ai" style={{ fontSize: 13.5, color: '#e4e4e7', lineHeight: 1.7 }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {result}
                    </ReactMarkdown>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 18, paddingTop: 16, borderTop: '1px solid #1a1f2e' }}>
                    <button onClick={saveToBook} disabled={savedToBook} style={{
                      padding: '8px 14px', borderRadius: 8,
                      border: `1px solid ${savedToBook ? 'rgba(165, 180, 252, 0.4)' : 'rgba(79, 124, 255, 0.3)'}`,
                      background: savedToBook ? 'rgba(165, 180, 252, 0.08)' : 'rgba(79, 124, 255, 0.08)',
                      color: savedToBook ? '#A5B4FC' : '#A5B4FC',
                      cursor: savedToBook ? 'default' : 'pointer',
                      fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <Save size={12} />{savedToBook ? 'Saved to Notebook' : 'Save to Notebook'}
                    </button>
                    <button onClick={reset} style={{
                      padding: '8px 14px', borderRadius: 8, border: '1px solid #1f2532',
                      background: '#151922', color: '#9CA3AF', cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <RefreshCw size={12} /> Another mistake
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
