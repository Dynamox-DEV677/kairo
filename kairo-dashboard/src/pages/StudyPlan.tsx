/**
 * Smart Timetable / Study Plan — AI-optimized
 *
 * Pulls:
 *  - Weak topics auto-loaded from /api/memory (so AI weights them heavier)
 *  - Per-subject exam dates (user adds them)
 *  - Daily study hours + days available
 *
 * Outputs:
 *  - Visual weekly grid (subjects × days color-coded)
 *  - Day-by-day markdown plan
 *  - Re-optimize button to regenerate as memory updates
 */
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Plus, X, Calendar, Brain, RefreshCw, BookOpen, Target, Zap,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { chat } from '../lib/openrouter'

const SUBJECTS = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology',
  'English', 'Hindi', 'History', 'Geography',
  'Political Science', 'Economics', 'Computer Science',
]
const SUBJECT_COLORS: Record<string, string> = {
  Mathematics: '#66D9FF', Physics: '#38bdf8', Chemistry: '#A5B4FC',
  Biology: '#A5B4FC', English: '#A5B4FC', Hindi: '#A5B4FC',
  History: '#A5B4FC', Geography: '#66D9FF',
  'Political Science': '#DBE7FF', Economics: '#A5B4FC',
  'Computer Science': '#DBE7FF',
}
const colorFor = (s: string) => SUBJECT_COLORS[s] || '#4F7CFF'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const card: React.CSSProperties = { background: '#0E1117', border: '1px solid #1f2532', borderRadius: 14 }
const inp: React.CSSProperties = {
  background: '#0E1117', border: '1px solid #1f2532', borderRadius: 8,
  padding: '9px 12px', fontSize: 13, color: '#fafafa',
  fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
}
const lbl: React.CSSProperties = {
  fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 5,
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8,
}

interface ExamDate { subject: string; date: string }

interface ScheduleBlock {
  day: string         // "Mon"
  start: string       // "16:00"
  end: string         // "17:30"
  subject: string
  topic?: string
  type?: 'study' | 'revision' | 'practice' | 'rest'
}

const SYSTEM = `You are Kairo, an expert AI study coach for Indian board exam students.
Generate a SMART weekly study schedule that:
1. Distributes study time across days based on exam proximity (closer exams = more time).
2. Front-loads weak topics in mornings/early sessions when focus is highest.
3. Builds in spaced revision (revisit weak topics 2-3 times per week).
4. Includes mock-test slots in the final 30% of the runway.
5. Adds 1-2 rest blocks per week so the student doesn't burn out.

Respond with TWO things in this exact format:

\`\`\`json
[
  {"day":"Mon","start":"16:00","end":"17:30","subject":"Mathematics","topic":"Quadratic equations","type":"study"},
  {"day":"Mon","start":"18:00","end":"18:30","subject":"Physics","topic":"Optics revision","type":"revision"}
]
\`\`\`

(JSON array of weekly blocks, 12-22 entries total — that's the visual schedule.)

Then a markdown plan:

## Week at a Glance
A 2-3 sentence summary of the strategy.

## Day-by-Day Notes
Brief tactical guidance for each day (1-2 lines per day).

## Why This Schedule
A short paragraph explaining the priority logic.

Be concrete, realistic, and motivating.`

export default function StudyPlan() {
  const [board, setBoard]     = useState('CBSE')
  const [cls, setCls]         = useState('10')
  const [hours, setHours]     = useState(4)
  const [subjects, setSubjects] = useState<string[]>([])
  const [examDates, setExamDates] = useState<ExamDate[]>([])
  const [weakTopics, setWeakTopics] = useState<string[]>([])
  const [memoryCount, setMemoryCount] = useState(0)
  const [loadingMemory, setLoadingMemory] = useState(true)

  const [plan, setPlan]       = useState<{ markdown: string; blocks: ScheduleBlock[] } | null>(null)
  const [busy, setBusy]       = useState(false)
  const [err, setErr]         = useState('')

  // Auto-pull weak topics from AI memory
  const loadMemory = useCallback(async () => {
    setLoadingMemory(true)
    try {
      const r = await fetch('/api/memory', {
        headers: { Authorization: `Bearer ${localStorage.getItem('kairo_token') || ''}` },
      })
      if (r.ok) {
        const d = await r.json()
        const weakItems = (d.weak || []).slice(0, 12)
        setWeakTopics(weakItems.map((m: any) => m.topic || m.content).filter(Boolean))
        setMemoryCount(d.total || 0)
        // Auto-populate subjects from memory if user hasn't picked any
        if (subjects.length === 0) {
          const memSubjects = new Set<string>()
          for (const m of weakItems) if (m.subject && SUBJECTS.includes(m.subject)) memSubjects.add(m.subject)
          if (memSubjects.size > 0) setSubjects([...memSubjects])
        }
      }
    } catch { /* non-fatal */ }
    finally { setLoadingMemory(false) }
  }, [subjects.length])

  useEffect(() => { loadMemory() }, [loadMemory])

  function toggleSubject(s: string) {
    setSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }
  function addExamDate() {
    setExamDates(prev => [...prev, { subject: subjects[0] || 'Mathematics', date: '' }])
  }
  function updateExamDate(i: number, k: keyof ExamDate, v: string) {
    setExamDates(prev => prev.map((e, idx) => idx === i ? { ...e, [k]: v } : e))
  }
  function removeExamDate(i: number) {
    setExamDates(prev => prev.filter((_, idx) => idx !== i))
  }

  async function generate() {
    if (subjects.length === 0) { setErr('Pick at least one subject'); return }
    setBusy(true); setErr(''); setPlan(null)

    const examLines = examDates.filter(e => e.date)
      .map(e => `- ${e.subject}: ${e.date}`).join('\n')

    const userMsg = `Class ${cls} ${board}.
Subjects to study: ${subjects.join(', ')}.
Daily hours available: ${hours}.
${examLines ? `Exam dates:\n${examLines}` : 'No fixed exam dates yet.'}
${weakTopics.length ? `Weak topics that NEED extra reps:\n${weakTopics.map(t => `- ${t}`).join('\n')}` : ''}

Generate the JSON schedule and markdown plan as instructed.`

    try {
      const reply = await chat({
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user',   content: userMsg },
        ],
      })

      // Extract JSON block
      const jsonMatch = reply.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/)
      let blocks: ScheduleBlock[] = []
      if (jsonMatch) {
        try { blocks = JSON.parse(jsonMatch[1]) } catch { /* ignore */ }
      }
      if (blocks.length === 0) {
        // Fallback — try greedy match
        const greedy = reply.match(/\[\s*\{[\s\S]*?\}\s*\]/)
        if (greedy) try { blocks = JSON.parse(greedy[0]) } catch { /* ignore */ }
      }

      // Strip the JSON block from the markdown
      const markdown = reply.replace(/```(?:json)?\s*\[[\s\S]*?\]\s*```/, '').trim()
      setPlan({ markdown, blocks })
    } catch (e: any) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1100, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: 'linear-gradient(135deg, #A5B4FC, #A5B4FC)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 18px rgba(79, 124, 255, 0.35)', flexShrink: 0,
        }}>
          <Calendar size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Smart Timetable</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            AI-optimized weekly schedule · weighted by your weak topics + upcoming exams
          </p>
        </div>
      </div>

      {/* Memory pulse banner */}
      {!loadingMemory && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          background: weakTopics.length ? 'rgba(79, 124, 255, 0.06)' : 'rgba(82,82,91,0.04)',
          border: `1px solid ${weakTopics.length ? 'rgba(79, 124, 255, 0.2)' : '#1f2532'}`,
          borderRadius: 10, marginBottom: 18,
        }}>
          <Brain size={14} color={weakTopics.length ? '#A5B4FC' : '#9CA3AF'} />
          <span style={{ fontSize: 12, color: weakTopics.length ? '#A5B4FC' : '#9CA3AF' }}>
            {weakTopics.length
              ? <>Pulled <strong>{weakTopics.length} weak topic{weakTopics.length === 1 ? '' : 's'}</strong> from your AI Memory. AI will weight these heavier.</>
              : memoryCount === 0
                ? <>No memory data yet — schedule will be balanced. Use Kairo's Solver, Grader, or quizzes to teach Kairo your weak spots.</>
                : <>Memory has {memoryCount} entries but no weak topics flagged yet.</>}
          </span>
          <button onClick={loadMemory} style={{
            marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
            color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
          }}>
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
      )}

      {/* Setup form */}
      {!plan && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ ...card, padding: 22 }}>
          {/* Row 1: board / class / hours */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
            <div>
              <label style={lbl}>Board</label>
              <select value={board} onChange={e => setBoard(e.target.value)} style={{ ...inp, appearance: 'none' as any }}>
                {['CBSE', 'ICSE', 'Maharashtra', 'Tamil Nadu', 'Karnataka', 'UP Board'].map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Class</label>
              <select value={cls} onChange={e => setCls(e.target.value)} style={{ ...inp, appearance: 'none' as any }}>
                {['8', '9', '10', '11', '12'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Daily study hours</label>
              <input type="number" min={1} max={12} value={hours}
                onChange={e => setHours(Math.max(1, Math.min(12, +e.target.value || 1)))} style={inp} />
            </div>
          </div>

          {/* Subjects */}
          <div style={{ marginBottom: 18 }}>
            <label style={lbl}>Subjects ({subjects.length} selected)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SUBJECTS.map(s => {
                const selected = subjects.includes(s)
                return (
                  <button key={s} onClick={() => toggleSubject(s)} style={{
                    padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
                    border: `1px solid ${selected ? colorFor(s) : '#1f2532'}`,
                    background: selected ? `${colorFor(s)}15` : '#0E1117',
                    color: selected ? colorFor(s) : '#9CA3AF',
                    fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                  }}>{s}</button>
                )
              })}
            </div>
          </div>

          {/* Exam dates */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={lbl}>Exam dates (optional — sharpens AI priorities)</label>
              <button onClick={addExamDate} disabled={subjects.length === 0} style={{
                padding: '5px 10px', borderRadius: 6, border: '1px solid #1f2532',
                background: '#151922', color: '#B1B5BA',
                fontFamily: 'inherit', fontSize: 11, cursor: subjects.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}><Plus size={11} /> Add Exam</button>
            </div>
            <AnimatePresence>
              {examDates.map((e, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <select value={e.subject} onChange={ev => updateExamDate(i, 'subject', ev.target.value)}
                    style={{ ...inp, flex: 1, appearance: 'none' as any }}>
                    {subjects.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <input type="date" value={e.date} onChange={ev => updateExamDate(i, 'date', ev.target.value)}
                    style={{ ...inp, width: 180 }} />
                  <button onClick={() => removeExamDate(i)} style={{
                    width: 36, height: 36, borderRadius: 7, border: '1px solid #1f2532',
                    background: '#151922', color: '#9CA3AF', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}><X size={13} /></button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Weak topics chip row */}
          {weakTopics.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Auto-detected weak topics</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {weakTopics.map((t, i) => (
                  <span key={i} style={{
                    padding: '5px 10px', borderRadius: 6,
                    background: 'rgba(165, 180, 252, 0.08)', border: '1px solid rgba(165, 180, 252, 0.25)',
                    color: '#A5B4FC', fontSize: 11, fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}>
                    <Target size={10} /> {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {err && <p style={{ fontSize: 12, color: '#66D9FF', marginBottom: 12 }}>{err}</p>}

          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={generate} disabled={busy || subjects.length === 0}
            style={{
              padding: '12px 24px', borderRadius: 10, border: 'none',
              background: busy || subjects.length === 0
                ? '#1a1f2e'
                : 'linear-gradient(135deg, #4F7CFF, #4F7CFF)',
              color: busy || subjects.length === 0 ? '#6B7280' : '#fff',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
              cursor: busy || subjects.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: busy || subjects.length === 0 ? 'none' : '0 0 22px rgba(79, 124, 255, 0.35)',
            }}>
            <Sparkles size={14} />{busy ? 'Optimizing your week…' : 'Generate Smart Schedule'}
          </motion.button>
        </motion.div>
      )}

      {/* Results */}
      {plan && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          {/* Visual weekly grid */}
          {plan.blocks.length > 0 && (
            <div style={{ ...card, padding: 18, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Zap size={15} color="#A5B4FC" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>Weekly Schedule</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>{plan.blocks.length} optimized blocks across the week</div>
                </div>
              </div>
              <WeekGrid blocks={plan.blocks} />
            </div>
          )}

          {/* Markdown plan */}
          <div style={{ ...card, padding: 22 }}>
            <div className="prose-ai" style={{
              fontSize: 13.5, color: '#e4e4e7', lineHeight: 1.7,
            }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{plan.markdown}</ReactMarkdown>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={() => { setPlan(null); }} style={{
                padding: '8px 14px', borderRadius: 8, border: '1px solid #1f2532',
                background: '#151922', color: '#B1B5BA', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Plus size={12} /> Edit Setup
              </button>
              <button onClick={generate} disabled={busy} style={{
                padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(79, 124, 255, 0.3)',
                background: 'rgba(79, 124, 255, 0.08)', color: '#A5B4FC', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <RefreshCw size={12} style={{ animation: busy ? 'spin 0.8s linear infinite' : 'none' }} />
                Re-optimize with Latest Memory
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ─── Weekly grid visualization ────────────────────────────────────────────────
function WeekGrid({ blocks }: { blocks: ScheduleBlock[] }) {
  // Group by day
  const byDay: Record<string, ScheduleBlock[]> = {}
  for (const d of DAYS) byDay[d] = []
  for (const b of blocks) {
    const day = b.day.slice(0, 3)
    if (byDay[day]) byDay[day].push(b)
  }
  for (const d of DAYS) byDay[d].sort((a, b) => a.start.localeCompare(b.start))

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8,
    }}>
      {DAYS.map(d => (
        <div key={d}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#9CA3AF',
            textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, textAlign: 'center',
          }}>
            {d}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 80 }}>
            {byDay[d].length === 0 && (
              <div style={{
                padding: '14px 6px', textAlign: 'center', borderRadius: 7,
                border: '1px dashed #1f2532', fontSize: 10, color: '#4B5563',
              }}>rest</div>
            )}
            {byDay[d].map((b, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                style={{
                  padding: '8px 9px', borderRadius: 7,
                  background: `${colorFor(b.subject)}15`,
                  border: `1px solid ${colorFor(b.subject)}40`,
                  borderLeft: `3px solid ${colorFor(b.subject)}`,
                }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: colorFor(b.subject),
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                  {b.start}–{b.end}
                </div>
                <div style={{ fontSize: 11.5, color: '#fafafa', fontWeight: 600, marginTop: 2 }}>
                  {b.subject}
                </div>
                {b.topic && (
                  <div style={{
                    fontSize: 10, color: '#B1B5BA', marginTop: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{b.topic}</div>
                )}
                {b.type && b.type !== 'study' && (
                  <span style={{
                    display: 'inline-block', marginTop: 3,
                    fontSize: 9, padding: '1px 5px', borderRadius: 3,
                    background: b.type === 'revision' ? 'rgba(165, 180, 252, 0.15)'
                      : b.type === 'practice' ? 'rgba(165, 180, 252, 0.15)'
                      : 'rgba(82,82,91,0.15)',
                    color: b.type === 'revision' ? '#A5B4FC'
                      : b.type === 'practice' ? '#A5B4FC'
                      : '#B1B5BA',
                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>{b.type}</span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
