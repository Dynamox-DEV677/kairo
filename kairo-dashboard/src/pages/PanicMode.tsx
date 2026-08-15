import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, Sparkles, Save, RefreshCw, Target,
  Zap, BookOpen, FunctionSquare, Award, Loader2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { chat } from '../lib/openrouter'
import { saveToNotebook } from '../lib/notebook'

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Hindi', 'History', 'Geography', 'Economics', 'Computer Science']

const card: React.CSSProperties = { background: '#141A2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }

interface PanicPack {
  topics:    string         
  questions: string         
  formulas:  string         
  strategy:  string         
  meta:      { subject: string; days: number; weak: string[] }
}

const STAGE_TITLES: Record<string, string> = {
  topics:    'Top 5 Must-Know Topics',
  questions: 'High-Probability Questions',
  formulas:  'Formula Sheet',
  strategy:  'Exam Strategy',
}

export default function PanicMode() {
  const [subject, setSubject] = useState('Mathematics')
  const [days, setDays]       = useState(3)
  const [board, setBoard]     = useState('CBSE')
  const [cls, setCls]         = useState('10')
  const [weakTopics, setWeak] = useState<string[]>([])
  const [busy, setBusy]       = useState(false)
  const [progress, setProg]   = useState('')
  const [pack, setPack]       = useState<PanicPack | null>(null)
  const [activeTab, setTab]   = useState<keyof PanicPack | 'topics'>('topics')
  const [savedTabs, setSaved] = useState<Set<string>>(new Set())
  const [err, setErr]         = useState('')

  const loadWeak = useCallback(async () => {
    try {
      const r = await fetch('/api/memory', {
        headers: { Authorization: `Bearer ${localStorage.getItem('kairo_token') || ''}` },
      })
      if (r.ok) {
        const d = await r.json()
        const weakForSubject = (d.weak || [])
          .filter((m: any) => !m.subject || m.subject === subject)
          .slice(0, 8)
          .map((m: any) => m.topic || m.content)
          .filter(Boolean)
        setWeak(weakForSubject)
      }
    } catch {  }
  }, [subject])

  useEffect(() => { loadWeak() }, [loadWeak])

  async function generate() {
    setErr(''); setBusy(true); setPack(null); setSaved(new Set())

    const ctx = `${board} Class ${cls} · ${subject} · exam in ${days} day${days === 1 ? '' : 's'}`
    const weakLine = weakTopics.length
      ? `Student's weak topics (weight these heavier): ${weakTopics.join(', ')}.`
      : ''

    try {
      setProg('Picking high-yield topics…')
      const topics = await chat({
        messages: [
          { role: 'system', content: `Emergency exam revision for ${ctx}. ${weakLine}

Pick the TOP 5 must-know topics that will most likely appear and produce the most marks. Markdown:

## 1. Topic name
2-line description of why it matters + what to know.

## 2. Topic name
...

Be specific (e.g., "Quadratic equations — discriminant, nature of roots", not just "Algebra"). 5 topics. No fluff.` },
          { role: 'user', content: 'Generate.' },
        ],
      })

      setProg('Predicting likely questions…')
      const questions = await chat({
        messages: [
          { role: 'system', content: `Emergency revision for ${ctx}. ${weakLine}

Generate 10 HIGH-PROBABILITY questions for this exam — the kind that appear year after year. For each:

## Q1. [Question text]
**Answer:** Concise, exam-ready answer (with steps if needed). Use $...$ for math, **bold** for key terms.

10 questions, mixed difficulty. Skip obvious filler — pick ones a student MUST know.` },
          { role: 'user', content: 'Generate.' },
        ],
      })

      setProg('Compiling formula sheet…')
      const formulas = await chat({
        messages: [
          { role: 'system', content: `Emergency revision for ${ctx}.

Compile a one-page formula/facts sheet. Markdown:

## Core formulas
- $formula_in_LaTeX$ — what it does + when to use it

## Key definitions
- term — definition (one line)

## Quick rules
- Memorable rules of thumb / shortcuts.

Keep it scannable. No prose. Bullet only.` },
          { role: 'user', content: 'Generate.' },
        ],
      })

      setProg('Drafting strategy…')
      const strategy = await chat({
        messages: [
          { role: 'system', content: `Emergency revision for ${ctx}, with ${days} day${days === 1 ? '' : 's'} left.

Write a sharp exam-day strategy. Markdown:

## Tonight (or last 24 hours)
3 specific bullets: what to revise, what to skip, sleep timing.

## Hour before the exam
2 bullets: what to do, what NOT to do.

## During the exam
3 bullets: time allocation, attempting strategy, common-trap avoidance.

Be direct. Indian exam context. Under 200 words total.` },
          { role: 'user', content: 'Generate.' },
        ],
      })

      setPack({
        topics, questions, formulas, strategy,
        meta: { subject, days, weak: weakTopics },
      })
      setTab('topics')
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
      setProg('')
    }
  }

  async function saveTab(tab: keyof PanicPack) {
    if (!pack) return
    if (tab === 'meta') return
    const titleMap = {
      topics:    `Panic Mode · Top Topics · ${pack.meta.subject}`,
      questions: `Panic Mode · Likely Questions · ${pack.meta.subject}`,
      formulas:  `Panic Mode · Formula Sheet · ${pack.meta.subject}`,
      strategy:  `Panic Mode · Exam Strategy · ${pack.meta.subject}`,
    }
    const kindMap = {
      topics:    'note' as const,
      questions: 'note' as const,
      formulas:  'summary' as const,
      strategy:  'note' as const,
    }
    const r = await saveToNotebook({
      kind: kindMap[tab],
      title: titleMap[tab],
      content: (pack[tab] as string),
      subject: pack.meta.subject,
      tags: ['panic-mode', `${pack.meta.days}d`],
      source: 'panic-mode',
    })
    if (r) setSaved(s => new Set(s).add(tab))
  }

  const TABS: { id: keyof PanicPack; label: string; icon: any }[] = [
    { id: 'topics',    label: 'Topics',    icon: Target },
    { id: 'questions', label: 'Questions', icon: BookOpen },
    { id: 'formulas',  label: 'Formulas',  icon: FunctionSquare },
    { id: 'strategy',  label: 'Strategy',  icon: Award },
  ]

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1100, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 44, height: 44, borderRadius: 11,
            background: 'linear-gradient(135deg, #A5B4FC, #7C5CFF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 22px rgba(124, 92, 255, 0.03)', flexShrink: 0,
          }}>
          <AlertTriangle size={22} color="#fff" />
        </motion.div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Exam Panic Mode</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            Last-minute revision pack — top topics, likely questions, formula sheet, strategy.
          </p>
        </div>
      </div>

      {!pack && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ ...card, padding: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={lblStyle}>Board</label>
              <select value={board} onChange={e => setBoard(e.target.value)} style={{ ...inpStyle, appearance: 'none' as any }}>
                {['CBSE', 'ICSE', 'Maharashtra', 'Tamil Nadu', 'Karnataka', 'UP Board'].map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={lblStyle}>Class</label>
              <select value={cls} onChange={e => setCls(e.target.value)} style={{ ...inpStyle, appearance: 'none' as any }}>
                {['8','9','10','11','12'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lblStyle}>Subject</label>
              <select value={subject} onChange={e => setSubject(e.target.value)} style={{ ...inpStyle, appearance: 'none' as any }}>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={lblStyle}>Days until exam</label>
              <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ ...inpStyle, appearance: 'none' as any }}>
                {[1, 2, 3, 5, 7, 14].map(d => <option key={d} value={d}>{d} day{d === 1 ? '' : 's'}</option>)}
              </select>
            </div>
          </div>

          {weakTopics.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Sparkles size={11} color="#A5B4FC" />
                <span style={{ fontSize: 11, color: '#A5B4FC', fontWeight: 600 }}>
                  AI will weight these weak topics heavier:
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {weakTopics.map((t, i) => (
                  <span key={i} style={{
                    padding: '4px 9px', borderRadius: 5,
                    background: 'rgba(124, 92, 255, 0.10)', border: '1px solid rgba(124, 92, 255, 0.25)',
                    color: '#A5B4FC', fontSize: 10.5, fontWeight: 600,
                  }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {err && <p style={{ fontSize: 12, color: '#A5B4FC', marginBottom: 12 }}>{err}</p>}

          <motion.button className="kyno-chunky"
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={generate} disabled={busy}
            style={{
              width: '100%', padding: '14px', borderRadius: 11, border: 'none',
              background: busy ? '#171D2D' : 'linear-gradient(135deg, #A5B4FC, #7C5CFF)',
              color: busy ? '#6B7280' : '#fff',
              fontFamily: 'inherit', fontSize: 15, fontWeight: 800,
              cursor: busy ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: busy ? 'none' : '0 0 26px rgba(124, 92, 255, 0.14)',
              letterSpacing: 1.5, textTransform: 'uppercase',
            }}>
            {busy
              ? <><Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> {progress || 'Generating…'}</>
              : <><Zap size={15} /> Activate Panic Mode</>}
          </motion.button>

          {busy && (
            <p style={{ fontSize: 11, color: '#6B7280', marginTop: 12, textAlign: 'center' }}>
              4 AI calls in sequence · 30-45 seconds total
            </p>
          )}
        </motion.div>
      )}

      {pack && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ ...card, padding: '14px 18px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fafafa' }}>
                {pack.meta.subject} · {pack.meta.days} day{pack.meta.days === 1 ? '' : 's'} left
              </div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                {pack.meta.weak.length > 0 ? `Weighted by ${pack.meta.weak.length} weak topic${pack.meta.weak.length === 1 ? '' : 's'}` : 'Pure curriculum priority'}
              </div>
            </div>
            <button className="kyno-ghost" onClick={() => setPack(null)} style={{
              padding: '7px 12px', borderRadius: 7, border: '1px solid #1f2532',
              background: '#1C2233', color: '#9CA3AF', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <RefreshCw size={11} /> New Pack
            </button>
          </div>

          <div style={{
            display: 'flex', gap: 4, marginBottom: 12, background: '#141A2A',
            border: '1px solid #1f2532', borderRadius: 10, padding: 4, overflowX: 'auto',
          }}>
            {TABS.map(t => {
              const Icon = t.icon
              const isActive = activeTab === t.id
              const isSaved = savedTabs.has(t.id)
              return (
                <button className="kyno-chip" key={t.id} onClick={() => setTab(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                    borderRadius: 7, border: 'none', fontFamily: 'inherit',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                    background: isActive ? '#1f2532' : 'transparent',
                    color: isActive ? '#A5B4FC' : '#6B7280',
                  }}>
                  <Icon size={12} /> {t.label}
                  {isSaved && <span style={{ fontSize: 9, color: '#A5B4FC' }}>✓</span>}
                </button>
              )
            })}
          </div>

          <div style={{ ...card, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #171D2D' }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#fafafa' }}>
                {STAGE_TITLES[activeTab]}
              </div>
              <button className="kyno-ghost" onClick={() => saveTab(activeTab as keyof PanicPack)}
                disabled={savedTabs.has(activeTab)} style={{
                padding: '6px 12px', borderRadius: 6,
                border: `1px solid ${savedTabs.has(activeTab) ? 'rgba(165, 180, 252, 0.4)' : 'rgba(124, 92, 255, 0.3)'}`,
                background: savedTabs.has(activeTab) ? 'rgba(165, 180, 252, 0.08)' : 'rgba(124, 92, 255, 0.08)',
                color: savedTabs.has(activeTab) ? '#A5B4FC' : '#A5B4FC',
                cursor: savedTabs.has(activeTab) ? 'default' : 'pointer',
                fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <Save size={11} />{savedTabs.has(activeTab) ? 'Saved' : 'Save to Notebook'}
              </button>
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="prose-ai" style={{ fontSize: 13.5, color: '#e4e4e7', lineHeight: 1.7 }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {pack[activeTab as keyof PanicPack] as string}
                  </ReactMarkdown>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </div>
  )
}

const lblStyle: React.CSSProperties = {
  fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 5,
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8,
}
const inpStyle: React.CSSProperties = {
  background: '#141A2A', border: '1px solid #1f2532', borderRadius: 8,
  padding: '9px 12px', fontSize: 13, color: '#fafafa',
  fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
}
