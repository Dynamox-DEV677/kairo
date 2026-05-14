/**
 * Autonomous AI Teacher Assistant
 *
 * Teacher inputs a chapter/topic + grade + duration → AI returns ALL of:
 *   - Lesson plan
 *   - Homework set
 *   - Flashcards (Q/A pairs)
 *   - Quiz with answer key
 *   - Revision sheet (key formulas + summary)
 *
 * Each artifact is independently downloadable, copyable, savable to notebook.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, FileText, BookMarked, ClipboardList, BookOpen,
  CheckCircle2, Copy, Download, Save, Loader2, RefreshCw, Bot,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { chat } from '../lib/openrouter'
import { saveToNotebook } from '../lib/notebook'

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Hindi', 'History', 'Geography', 'Political Science', 'Economics', 'Computer Science']
const GRADES   = ['6', '7', '8', '9', '10', '11', '12']

const card: React.CSSProperties = { background: '#111', border: '1px solid #1e1e1e', borderRadius: 14 }
const inp: React.CSSProperties = {
  background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8,
  padding: '9px 12px', fontSize: 13, color: '#fafafa',
  fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
}
const lbl: React.CSSProperties = {
  fontSize: 11, color: '#71717a', display: 'block', marginBottom: 5,
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8,
}

interface Flashcard { front: string; back: string }
interface QuizItem  { q: string; options: string[]; answer: number; explain: string }

interface Pack {
  lesson_plan:    string   // markdown
  homework:       string   // markdown
  flashcards:     Flashcard[]
  quiz:           QuizItem[]
  revision_sheet: string   // markdown
  meta:           { subject: string; topic: string; grade: string; duration: number }
}

const ARTIFACTS = [
  { id: 'lesson_plan',    label: 'Lesson Plan',    icon: FileText,      color: '#a78bfa' },
  { id: 'homework',       label: 'Homework',        icon: ClipboardList, color: '#c4b5fd' },
  { id: 'flashcards',     label: 'Flashcards',      icon: BookMarked,    color: '#c4b5fd' },
  { id: 'quiz',           label: 'Quiz',            icon: CheckCircle2,  color: '#c4b5fd' },
  { id: 'revision_sheet', label: 'Revision Sheet',  icon: BookOpen,      color: '#c4b5fd' },
]

export default function TeacherAssistant() {
  const [board, setBoard]       = useState('CBSE')
  const [grade, setGrade]       = useState('10')
  const [subject, setSubject]   = useState('Mathematics')
  const [topic, setTopic]       = useState('')
  const [duration, setDuration] = useState(45)
  const [pack, setPack]         = useState<Pack | null>(null)
  const [progress, setProgress] = useState<string>('')
  const [busy, setBusy]         = useState(false)
  const [err, setErr]           = useState('')
  const [activeTab, setActiveTab] = useState<string>('lesson_plan')
  const [savedTabs, setSavedTabs] = useState<Set<string>>(new Set())

  async function generate() {
    if (!topic.trim()) { setErr('Enter a chapter or topic'); return }
    setErr(''); setBusy(true); setPack(null); setSavedTabs(new Set())

    const ctx = `${board} Class ${grade} · ${subject} · ${duration} min lesson`

    try {
      // Generate sequentially with progress feedback (smaller calls = lower failure risk)
      setProgress('Drafting lesson plan…')
      const lessonPlan = await chat({
        messages: [
          { role: 'system', content: `You are an expert teacher's assistant for ${ctx}. Write a clear, ready-to-use lesson plan.

Use this markdown structure:
## Learning Objectives
3-4 bullets

## Materials Needed
1-line list

## Lesson Flow (${duration} min)
| Phase | Time | Activity |
| --- | --- | --- |

## Key Concepts
3-5 bullets

## Common Misconceptions
2-3 specific traps

## Assessment Strategy
1 short paragraph` },
          { role: 'user', content: `Topic: ${topic}` },
        ],
      })

      setProgress('Crafting homework set…')
      const homework = await chat({
        messages: [
          { role: 'system', content: `You are an expert teacher. Write a homework assignment for ${ctx}.

Markdown structure:
## Instructions
2-3 lines, clear expectations.

## Questions (8-10 total, mixed difficulty)
1. ...
2. ...

## Submission Notes
1 line` },
          { role: 'user', content: `Topic: ${topic}` },
        ],
      })

      setProgress('Building flashcards…')
      const flashcardsRaw = await chat({
        messages: [
          { role: 'system', content: `Generate exactly 10 high-quality flashcards for ${ctx}. Return ONLY a JSON array, no other text:
[{"front":"...","back":"..."}]` },
          { role: 'user', content: `Topic: ${topic}` },
        ],
      })

      setProgress('Writing quiz with answer key…')
      const quizRaw = await chat({
        messages: [
          { role: 'system', content: `Generate exactly 8 MCQs for ${ctx}. Each has 4 options, one correct (index 0-3), and a 1-line explanation. Return ONLY a JSON array:
[{"q":"...","options":["A","B","C","D"],"answer":2,"explain":"..."}]` },
          { role: 'user', content: `Topic: ${topic}` },
        ],
      })

      setProgress('Compiling revision sheet…')
      const revision = await chat({
        messages: [
          { role: 'system', content: `Write a one-page revision sheet for ${ctx}. Include all key definitions, formulas, and a quick summary.

Markdown structure:
## ${topic} — Revision Sheet
**Quick summary** — 2 lines.

### Key definitions
- term: ...

### Formulas / facts
- ...

### Quick recall (5 questions, no answers)
1. ...` },
          { role: 'user', content: `Topic: ${topic}` },
        ],
      })

      // Parse the JSON artifacts robustly
      const flashcards = parseJsonArray<Flashcard>(flashcardsRaw)
      const quiz       = parseJsonArray<QuizItem>(quizRaw)

      setPack({
        lesson_plan:    lessonPlan,
        homework,
        flashcards,
        quiz,
        revision_sheet: revision,
        meta: { subject, topic, grade, duration },
      })
      setActiveTab('lesson_plan')
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  function downloadAs(name: string, content: string) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${pack?.meta?.topic?.replace(/\s+/g, '_')}_${name}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  function copyText(s: string) {
    navigator.clipboard.writeText(s).catch(() => {})
  }

  async function saveCurrentTab() {
    if (!pack) return
    let content = ''
    let kind: any = 'note'
    if (activeTab === 'lesson_plan')    { content = pack.lesson_plan;  kind = 'plan' }
    if (activeTab === 'homework')       { content = pack.homework;     kind = 'note' }
    if (activeTab === 'flashcards')     {
      content = pack.flashcards.map((c, i) => `**${i + 1}. ${c.front}**\n\n${c.back}`).join('\n\n---\n\n')
      kind = 'flashcards'
    }
    if (activeTab === 'quiz') {
      content = pack.quiz.map((q, i) => `**Q${i + 1}.** ${q.q}\n\n${q.options.map((o, j) => `${String.fromCharCode(65 + j)}. ${o}`).join('\n')}\n\n_Answer: ${String.fromCharCode(65 + q.answer)} — ${q.explain}_`).join('\n\n---\n\n')
      kind = 'note'
    }
    if (activeTab === 'revision_sheet') { content = pack.revision_sheet; kind = 'summary' }

    const r = await saveToNotebook({
      kind,
      title: `${pack.meta.topic} · ${ARTIFACTS.find(a => a.id === activeTab)?.label}`,
      content,
      subject: pack.meta.subject,
      tags: [pack.meta.subject, `Class ${pack.meta.grade}`],
      source: 'teacher-assistant',
    })
    if (r) {
      setSavedTabs(prev => new Set(prev).add(activeTab))
    }
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1100, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: 'linear-gradient(135deg, #a78bfa, #a78bfa)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 18px rgba(167, 139, 250,0.4)', flexShrink: 0,
        }}>
          <Bot size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>AI Teacher Assistant</h1>
          <p style={{ fontSize: 13, color: '#52525b', marginTop: 4 }}>
            One topic in · lesson plan, homework, flashcards, quiz, revision sheet out.
          </p>
        </div>
      </div>

      {/* Setup form */}
      {!pack && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          style={{ ...card, padding: 22, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Board</label>
              <select value={board} onChange={e => setBoard(e.target.value)} style={{ ...inp, appearance: 'none' as any }}>
                {['CBSE', 'ICSE', 'Maharashtra', 'Tamil Nadu', 'Karnataka', 'UP Board'].map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Grade</label>
              <select value={grade} onChange={e => setGrade(e.target.value)} style={{ ...inp, appearance: 'none' as any }}>
                {GRADES.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Subject</label>
              <select value={subject} onChange={e => setSubject(e.target.value)} style={{ ...inp, appearance: 'none' as any }}>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Chapter / Topic</label>
            <input value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Quadratic Equations · Photosynthesis · The French Revolution"
              style={inp} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={lbl}>Lesson duration: {duration} min</label>
            <input type="range" min={20} max={90} step={5}
              value={duration} onChange={e => setDuration(Number(e.target.value))}
              style={{ width: '100%' }} />
          </div>

          {err && <p style={{ fontSize: 12, color: '#a78bfa', marginBottom: 12 }}>{err}</p>}

          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={generate} disabled={busy || !topic.trim()}
            style={{
              width: '100%', padding: '13px', borderRadius: 11, border: 'none',
              background: busy || !topic.trim() ? '#1c1c1c' : 'linear-gradient(135deg, #a78bfa, #a78bfa)',
              color: busy || !topic.trim() ? '#52525b' : '#fff',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
              cursor: busy || !topic.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: busy || !topic.trim() ? 'none' : '0 0 22px rgba(167, 139, 250,0.4)',
            }}>
            {busy
              ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> {progress || 'Generating…'}</>
              : <><Sparkles size={14} /> Generate Full Teaching Pack</>}
          </motion.button>

          {busy && (
            <div style={{
              marginTop: 14, padding: '10px 14px', borderRadius: 8,
              background: 'rgba(167, 139, 250,0.06)', border: '1px solid rgba(167, 139, 250,0.2)',
              fontSize: 11.5, color: '#c4b5fd',
            }}>
              This runs 5 AI calls in sequence — typically 30-60 seconds total.
            </div>
          )}
        </motion.div>
      )}

      {/* Pack — tabbed view */}
      {pack && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header bar with reset */}
          <div style={{
            ...card, padding: '14px 18px', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>
                {pack.meta.topic}
              </div>
              <div style={{ fontSize: 11, color: '#52525b', marginTop: 2 }}>
                {board} Class {pack.meta.grade} · {pack.meta.subject} · {pack.meta.duration} min
              </div>
            </div>
            <button onClick={() => { setPack(null); setTopic('') }}
              style={{
                padding: '7px 12px', borderRadius: 7, border: '1px solid #1e1e1e',
                background: '#161616', color: '#71717a', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5,
              }}>
              <RefreshCw size={11} /> New Pack
            </button>
          </div>

          {/* Tab strip */}
          <div style={{
            display: 'flex', gap: 4, marginBottom: 12, background: '#0d0d0d',
            border: '1px solid #1e1e1e', borderRadius: 10, padding: 4, overflowX: 'auto',
          }}>
            {ARTIFACTS.map(a => {
              const isActive = activeTab === a.id
              const isSaved = savedTabs.has(a.id)
              return (
                <button key={a.id} onClick={() => setActiveTab(a.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                    borderRadius: 7, border: 'none', fontFamily: 'inherit',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                    background: isActive ? '#1e1e2e' : 'transparent',
                    color: isActive ? a.color : '#52525b',
                  }}>
                  <a.icon size={12} /> {a.label}
                  {isSaved && <CheckCircle2 size={11} color="#c4b5fd" />}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div style={{ ...card, padding: 22 }}>
            {/* Toolbar */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 14,
              paddingBottom: 12, borderBottom: '1px solid #1a1a1a',
            }}>
              <button onClick={saveCurrentTab} disabled={savedTabs.has(activeTab)} style={toolBtn(savedTabs.has(activeTab) ? '#c4b5fd' : '#c4b5fd')}>
                <Save size={11} />{savedTabs.has(activeTab) ? 'Saved' : 'Save to Notebook'}
              </button>
              <button onClick={() => {
                let c = ''
                if (activeTab === 'lesson_plan')    c = pack.lesson_plan
                if (activeTab === 'homework')       c = pack.homework
                if (activeTab === 'flashcards')     c = JSON.stringify(pack.flashcards, null, 2)
                if (activeTab === 'quiz')           c = JSON.stringify(pack.quiz, null, 2)
                if (activeTab === 'revision_sheet') c = pack.revision_sheet
                copyText(c)
              }} style={toolBtn('#71717a')}>
                <Copy size={11} /> Copy
              </button>
              <button onClick={() => {
                let c = ''
                if (activeTab === 'lesson_plan')    c = pack.lesson_plan
                if (activeTab === 'homework')       c = pack.homework
                if (activeTab === 'flashcards')     c = pack.flashcards.map((f, i) => `Q${i + 1}: ${f.front}\nA: ${f.back}`).join('\n\n')
                if (activeTab === 'quiz')           c = pack.quiz.map((q, i) => `Q${i + 1}. ${q.q}\n${q.options.map((o, j) => `${String.fromCharCode(65 + j)}. ${o}`).join('\n')}\nAnswer: ${String.fromCharCode(65 + q.answer)}\n${q.explain}`).join('\n\n')
                if (activeTab === 'revision_sheet') c = pack.revision_sheet
                downloadAs(activeTab, c)
              }} style={toolBtn('#71717a')}>
                <Download size={11} /> Download .md
              </button>
            </div>

            {/* Render */}
            {activeTab === 'flashcards' ? (
              <FlashcardsView cards={pack.flashcards} />
            ) : activeTab === 'quiz' ? (
              <QuizView items={pack.quiz} />
            ) : (
              <div className="prose-ai" style={{ fontSize: 13.5, color: '#e4e4e7', lineHeight: 1.7 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {activeTab === 'lesson_plan'    ? pack.lesson_plan
                   : activeTab === 'homework'      ? pack.homework
                   : pack.revision_sheet}
                </ReactMarkdown>
              </div>
            )}
          </div>

          <p style={{ fontSize: 11, color: '#52525b', textAlign: 'center', marginTop: 12 }}>
            Save any artifact to your AI Notebook so you can reuse it later.
          </p>
        </motion.div>
      )}
    </div>
  )
}

// ─── Flashcards view ──────────────────────────────────────────────────────────
function FlashcardsView({ cards }: { cards: Flashcard[] }) {
  if (cards.length === 0) return <p style={{ color: '#52525b', fontSize: 13 }}>No flashcards generated.</p>
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
      {cards.map((c, i) => (
        <div key={i} style={{
          background: '#0d0d0d', border: '1px solid #2d2b55', borderRadius: 10, padding: 14,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            #{i + 1} · Front
          </div>
          <div style={{ fontSize: 13, color: '#fafafa', fontWeight: 600, marginBottom: 10, lineHeight: 1.5 }}>
            {c.front}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            Back
          </div>
          <div style={{ fontSize: 12.5, color: '#c7d2fe', lineHeight: 1.5 }}>{c.back}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Quiz view ────────────────────────────────────────────────────────────────
function QuizView({ items }: { items: QuizItem[] }) {
  const [showAnswers, setShowAnswers] = useState(false)
  if (items.length === 0) return <p style={{ color: '#52525b', fontSize: 13 }}>No quiz items generated.</p>
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={() => setShowAnswers(s => !s)} style={{
          padding: '5px 12px', borderRadius: 6,
          border: `1px solid ${showAnswers ? '#c4b5fd' : '#1e1e1e'}`,
          background: showAnswers ? 'rgba(196, 181, 253,0.1)' : '#161616',
          color: showAnswers ? '#c4b5fd' : '#71717a',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
        }}>{showAnswers ? 'Hide Answers' : 'Reveal Answers'}</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((q, i) => (
          <div key={i} style={{
            background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10, padding: 14,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', marginBottom: 10 }}>
              <span style={{ color: '#c4b5fd', fontWeight: 800, marginRight: 6 }}>Q{i + 1}.</span>
              {q.q}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: showAnswers ? 10 : 0 }}>
              {q.options.map((o, j) => {
                const isAnswer = j === q.answer
                return (
                  <div key={j} style={{
                    padding: '7px 10px', borderRadius: 6, fontSize: 12,
                    border: `1px solid ${showAnswers && isAnswer ? 'rgba(196, 181, 253,0.4)' : '#1a1a1a'}`,
                    background: showAnswers && isAnswer ? 'rgba(196, 181, 253,0.08)' : '#0a0a0a',
                    color: showAnswers && isAnswer ? '#c4b5fd' : '#a1a1aa',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ fontWeight: 700, fontSize: 10 }}>{String.fromCharCode(65 + j)}</span>
                    <span>{o}</span>
                  </div>
                )
              })}
            </div>
            {showAnswers && (
              <div style={{
                fontSize: 11.5, color: '#a1a1aa', lineHeight: 1.5,
                padding: '7px 10px', background: '#0a0a0a',
                border: '1px solid #1a1a1a', borderRadius: 6,
              }}>
                <strong style={{ color: '#c4b5fd' }}>Why:</strong> {q.explain}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseJsonArray<T>(raw: string): T[] {
  const cleaned = raw
    .replace(/<\/?think(?:ing)?>[\s\S]*?<\/?think(?:ing)?>/gi, '')
    .replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  try {
    const direct = JSON.parse(cleaned)
    if (Array.isArray(direct)) return direct
  } catch {}
  const m = cleaned.match(/\[[\s\S]*\]/)
  if (m) {
    try { return JSON.parse(m[0]) } catch {}
  }
  return []
}

const toolBtn = (color: string): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: 6,
  border: `1px solid ${color}30`,
  background: 'transparent', color, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
  display: 'flex', alignItems: 'center', gap: 5,
})
