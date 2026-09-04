import { useState, useRef, useEffect } from 'react'
import { studentMessage } from '../lib/aiError.core'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GraduationCap, Send, Loader2, RefreshCw, Save, Award,
  MessageCircleQuestion, Sparkles, ArrowLeft, Check,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { chat } from '../lib/openrouter'
import { saveToNotebook } from '../lib/notebook'
import { getMistakes, recordDoubt, getProfile } from '../lib/twin'
import { awardXP } from '../lib/game'
import { prepMathMarkdown } from '../lib/math.core'
import { subjectLabels } from '../curriculum/subjects'

const SUBJECTS = (() => { const p = getProfile() as any; return subjectLabels({ board: p?.board, cls: p?.cls, general: true }) })()

const card: React.CSSProperties = { background: '#141A2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }
const inp: React.CSSProperties = {
  background: '#141A2A', border: '1px solid #1f2532', borderRadius: 8,
  padding: '10px 12px', fontSize: 13.5, color: '#fafafa',
  fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
}
const lbl: React.CSSProperties = {
  fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 6,
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8,
}

// The confused-learner persona. The whole feature lives or dies on this prompt.
const LEARNER_SYSTEM = (topic: string, subject: string) => `You are "Kiran", a friendly but genuinely confused Class 9 student in India. Your classmate is TEACHING you "${topic}" (${subject}). This is the Feynman technique — they learn by explaining to you.

STAY IN CHARACTER AS THE LEARNER. Never become the teacher.
- React naturally and warmly: "ohhh okay", "hmm wait", "that part I get, but…"
- Ask exactly ONE focused follow-up question per reply — the question a real confused student would actually ask.
- Probe precisely where their explanation was vague, skipped a step, assumed knowledge, or used a term they never defined.
- If they use jargon, ask what it means. If they state a fact with no "why", ask why.
- If they say something factually WRONG, don't correct them — ask a puzzled question that makes them re-examine it ("wait, so does that mean…?").
- If their explanation is genuinely good, say so in one line, then dig one level deeper.
- NEVER give the answer, never lecture, never list facts, never teach back.

Keep every reply SHORT: 2-4 sentences, simple language, plain conversational text. No markdown, no headings, no bullet lists.`

const GRADER_SYSTEM = (topic: string, subject: string) => `You are an expert examiner assessing how well a student TAUGHT "${topic}" (${subject}) to a confused beginner.

In the transcript, turns marked "STUDENT TEACHING" are the person you are grading. Turns marked "KIRAN (learner)" are the AI learner's questions.

Respond in EXACTLY this format and nothing else:

SCORE: <integer 0-100>

## What you nailed
- 2-4 specific bullets. Quote their actual words where it helps.

## Gaps in your explanation
- 2-4 bullets. Each names what was missing, vague or skipped — and why that matters for understanding. Honest but kind.

## Misconceptions to fix
- Any factually incorrect statements they made, with the correction. If there were none, write exactly: None — your facts were solid.

## To reach mastery
- 3 concrete things to do or say differently next time.

Grade on: factual correctness, completeness, clarity, use of a concrete example/analogy, and whether they actually resolved Kiran's confusions. 100 means a confused beginner would now genuinely understand the topic. Be a fair but rigorous examiner — do not inflate the score.`

interface Turn { role: 'student' | 'learner'; text: string }

export default function TeachBack() {
  const [screen, setScreen]   = useState<'setup' | 'session' | 'result'>('setup')
  const [subject, setSubject] = useState('Mathematics')
  const [topic, setTopic]     = useState('')
  const [turns, setTurns]     = useState<Turn[]>([])
  const [draft, setDraft]     = useState('')
  const [busy, setBusy]       = useState(false)
  const [grading, setGrading] = useState(false)
  const [result, setResult]   = useState('')
  const [score, setScore]     = useState<number | null>(null)
  const [err, setErr]         = useState('')
  const [saved, setSaved]     = useState(false)
  const [weakTopics, setWeak] = useState<{ topic: string; count: number }[]>([])
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      setWeak(getMistakes().slice(0, 6).map(m => ({ topic: m.topic, count: m.count || 1 })))
    } catch {  }
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns, busy])

  const studentTurns = turns.filter(t => t.role === 'student').length

  function historyFor(nextStudentText?: string) {
    const msgs = turns.map(t => ({
      role: (t.role === 'student' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: t.text,
    }))
    if (nextStudentText) msgs.push({ role: 'user', content: nextStudentText })
    return msgs
  }

  async function start() {
    if (!topic.trim()) { setErr('Pick a topic you want to teach'); return }
    setErr(''); setScreen('session'); setBusy(true)
    setTurns([]); setResult(''); setScore(null); setSaved(false)
    try {
      const reply = await chat({
        messages: [
          { role: 'system', content: LEARNER_SYSTEM(topic.trim(), subject) },
          { role: 'user', content: `I'm going to teach you ${topic.trim()}. Greet me in one line and ask me to start explaining — like a curious student would.` },
        ],
      })
      setTurns([{ role: 'learner', text: reply.trim() }])
    } catch (e: any) {
      setErr(studentMessage(e))
    } finally { setBusy(false) }
  }

  async function send() {
    const text = draft.trim()
    if (!text || busy) return
    setDraft(''); setErr('')
    setTurns(prev => [...prev, { role: 'student', text }])
    setBusy(true)
    try {
      const reply = await chat({
        messages: [
          { role: 'system', content: LEARNER_SYSTEM(topic.trim(), subject) },
          ...historyFor(text),
        ],
      })
      setTurns(prev => [...prev, { role: 'learner', text: reply.trim() }])
    } catch (e: any) {
      setErr(studentMessage(e))
    } finally { setBusy(false) }
  }

  async function grade() {
    if (studentTurns === 0 || grading) return
    setGrading(true); setErr('')
    const transcript = turns
      .map(t => (t.role === 'student' ? `STUDENT TEACHING: ${t.text}` : `KIRAN (learner): ${t.text}`))
      .join('\n\n')
    try {
      const reply = await chat({
        messages: [
          { role: 'system', content: GRADER_SYSTEM(topic.trim(), subject) },
          { role: 'user', content: `Transcript:\n\n${transcript}\n\nGrade my teaching now, in the exact format.` },
        ],
      })
      const m = reply.match(/SCORE:\s*(\d{1,3})/i)
      const n = m ? Math.max(0, Math.min(100, parseInt(m[1], 10))) : null
      setScore(n)
      setResult(reply.replace(/SCORE:\s*\d{1,3}/i, '').trim())
      setScreen('result')
      try { awardXP('written_graded') } catch {  }   // a graded explanation in your own words
      try {
        recordDoubt({
          question: `Taught back: ${topic.trim()}`,
          answer: reply.slice(0, 1200),
          topic: topic.trim(),
          source: 'chat',
        })
      } catch {  }
    } catch (e: any) {
      setErr(studentMessage(e))
    } finally { setGrading(false) }
  }

  async function saveTranscript() {
    if (!result) return
    const transcript = turns
      .map(t => (t.role === 'student' ? `**Me:** ${t.text}` : `**Kiran:** ${t.text}`))
      .join('\n\n')
    const r = await saveToNotebook({
      kind: 'note',
      title: `Teach-back · ${topic.trim().slice(0, 60)}`,
      content: `**Subject:** ${subject}\n**Score:** ${score ?? '—'}/100\n\n---\n\n${result}\n\n---\n\n### Session transcript\n\n${transcript}`,
      subject,
      tags: ['teach-back'],
      source: 'teach-back',
    })
    if (r) setSaved(true)
  }

  function reset() {
    setScreen('setup'); setTurns([]); setDraft(''); setResult('')
    setScore(null); setErr(''); setSaved(false)
  }

  const scoreColor = score == null ? '#A5B4FC'
    : score >= 80 ? '#34d399' : score >= 60 ? '#ffb020' : 'var(--c-error)'
  const scoreVerdict = score == null ? ''
    : score >= 90 ? 'You truly understand this' : score >= 80 ? 'Strong grasp'
    : score >= 60 ? 'Getting there — real gaps left' : score >= 40 ? 'Shaky understanding'
    : 'Go relearn this one'

  return (
    <div style={{ padding: '28px 36px', maxWidth: 900, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: 'linear-gradient(135deg, #7C5CFF, #4a2fa8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 18px rgba(124, 92, 255, 0.35)', flexShrink: 0,
        }}>
          <GraduationCap size={22} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0, overflowWrap: 'normal' }}>Teach Back</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4, lineHeight: 1.55 }}>
            You can't fake understanding by explaining it. Teach a topic to Kiran — a confused Class 9 student —
            and Kyno grades how well you actually know it.
          </p>
        </div>
      </div>

      {/* ── SETUP ── */}
      {screen === 'setup' && (
        <div style={{ ...card, padding: 22 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Subject</label>
            <select value={subject} onChange={e => setSubject(e.target.value)} style={{ ...inp, appearance: 'none' as any }}>
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: weakTopics.length ? 14 : 18 }}>
            <label style={lbl}>What will you teach?</label>
            <input
              value={topic} onChange={e => setTopic(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') start() }}
              placeholder="e.g. Newton's third law, photosynthesis, quadratic formula"
              style={inp}
            />
          </div>

          {weakTopics.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Or fix a weak spot</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {weakTopics.map(w => (
                  <button key={w.topic} onClick={() => setTopic(w.topic)}
                    className={`kyno-chip${topic === w.topic ? ' on' : ''}`}
                    style={{ padding: '7px 12px', fontSize: 12 }}>
                    {w.topic}
                  </button>
                ))}
              </div>
            </div>
          )}

          {err && <p style={{ fontSize: 12, color: 'var(--c-error)', marginBottom: 12 }}>{err}</p>}

          <button onClick={start} disabled={!topic.trim()} className="kyno-chunky"
            style={{ width: '100%', padding: 12, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Sparkles size={14} /> Start teaching
          </button>

          <p style={{ fontSize: 11, color: '#4B5563', marginTop: 14, lineHeight: 1.6 }}>
            Kiran will keep asking questions until your explanation holds up. Explain in your own words — messy is fine.
          </p>
        </div>
      )}

      {/* ── SESSION ── */}
      {screen === 'session' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <button onClick={reset} className="kyno-ghost" style={{ padding: '7px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ArrowLeft size={12} /> Change topic
            </button>
            <span style={{ fontSize: 12, color: '#6B7280', marginLeft: 'auto' }}>
              Teaching <b style={{ color: '#A5B4FC' }}>{topic}</b> · {studentTurns} {studentTurns === 1 ? 'explanation' : 'explanations'}
            </span>
          </div>

          <div style={{ ...card, padding: 18, marginBottom: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '46vh', overflowY: 'auto' }}>
              {turns.map((t, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', gap: 10, flexDirection: t.role === 'student' ? 'row-reverse' : 'row' }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                    background: t.role === 'student' ? 'rgba(124,92,255,0.18)' : 'rgba(79,216,232,0.14)',
                    border: `1px solid ${t.role === 'student' ? 'rgba(124,92,255,0.4)' : 'rgba(79,216,232,0.35)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800,
                    color: t.role === 'student' ? '#A5B4FC' : 'var(--c-cyan)',
                  }}>
                    {t.role === 'student' ? 'You' : 'K'}
                  </div>
                  <div style={{
                    maxWidth: '78%', padding: '10px 13px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6,
                    background: t.role === 'student' ? 'rgba(124,92,255,0.10)' : '#1A2130',
                    border: `1px solid ${t.role === 'student' ? 'rgba(124,92,255,0.22)' : 'rgba(255,255,255,0.06)'}`,
                    color: '#e4e4e7', whiteSpace: 'pre-wrap',
                  }}>
                    {t.text}
                  </div>
                </motion.div>
              ))}
              {busy && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6B7280', fontSize: 12.5 }}>
                  <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-flex' }}>
                    <Loader2 size={13} />
                  </motion.span>
                  Kiran is thinking…
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          {err && <p style={{ fontSize: 12, color: 'var(--c-error)', marginBottom: 10 }}>{err}</p>}

          <div style={{ ...card, padding: 12 }}>
            <textarea
              rows={3} value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Explain it in your own words…"
              style={{ ...inp, resize: 'vertical', lineHeight: 1.6, marginBottom: 10 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={send} disabled={!draft.trim() || busy} className="kyno-chunky"
                style={{ flex: 1, padding: '11px', fontSize: 13.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                <Send size={13} /> Explain
              </button>
              <button onClick={grade} disabled={studentTurns === 0 || grading} className="kyno-chunky cyan"
                style={{ padding: '11px 16px', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
                {grading
                  ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-flex' }}><Loader2 size={13} /></motion.span>
                  : <Award size={13} />}
                {grading ? 'Grading…' : 'Grade me'}
              </button>
            </div>
            {studentTurns === 0 && (
              <p style={{ fontSize: 11, color: '#4B5563', marginTop: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                <MessageCircleQuestion size={11} /> Explain at least once before grading.
              </p>
            )}
          </div>
        </>
      )}

      {/* ── RESULT ── */}
      {screen === 'result' && (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ ...card, padding: 22, marginBottom: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 10 }}>
                Teaching score · {topic}
              </div>
              <div style={{ fontSize: 54, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>
                {score ?? '—'}<span style={{ fontSize: 20, color: '#6B7280' }}>/100</span>
              </div>
              <div style={{ fontSize: 13.5, color: scoreColor, fontWeight: 700, marginTop: 8 }}>{scoreVerdict}</div>
              <div style={{ height: 8, background: '#171D2D', borderRadius: 4, marginTop: 16, overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${score ?? 0}%` }} transition={{ duration: 0.7, ease: 'easeOut' }}
                  style={{ height: '100%', background: scoreColor, borderRadius: 4 }} />
              </div>
            </div>

            <div style={{ ...card, padding: 22 }}>
              <div className="prose-ai" style={{ fontSize: 13.5, color: '#e4e4e7', lineHeight: 1.7 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {prepMathMarkdown(result)}
                </ReactMarkdown>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 18, paddingTop: 16, borderTop: '1px solid #171D2D', flexWrap: 'wrap' }}>
                <button onClick={saveTranscript} disabled={saved} className="kyno-ghost"
                  style={{ padding: '9px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {saved ? <Check size={12} /> : <Save size={12} />}{saved ? 'Saved to Notebook' : 'Save to Notebook'}
                </button>
                <button onClick={() => setScreen('session')} className="kyno-ghost"
                  style={{ padding: '9px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ArrowLeft size={12} /> Back to session
                </button>
                <button onClick={reset} className="kyno-chunky"
                  style={{ padding: '9px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                  <RefreshCw size={12} /> Teach another topic
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
