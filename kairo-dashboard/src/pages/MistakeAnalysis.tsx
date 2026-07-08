/**
 * Mistake Analysis — auto-populated from the unified Kyno memory engine.
 *
 * Every wrong answer or low-score event the user has produced anywhere in
 * Kyno (quiz, battle, revision sim, adaptive quiz, solver) flows into the
 * Twin's event log. This page reads `getMistakes()` from twin.ts which groups
 * them by topic, computes severity, and surfaces a ranked list of weak areas.
 *
 * Strict monochrome palette: black + deep purple + white only.
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, AlertTriangle, Sparkles, Repeat, Plus, X, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { getMistakes, recordMistake, type MistakeRow } from '../lib/twin'
import { chat } from '../lib/openrouter'

const C = {
  bg:        '#050505',
  panel:     '#0E1117',
  panel2:    '#151922',
  border:    'rgba(255,255,255,0.08)',
  borderSoft:'rgba(255,255,255,0.06)',
  text:      '#ffffff',
  textDim:   '#CBD5E1',
  textFaint: '#9CA3AF',
  purpleLite:'#DBE7FF',
  purpleSoft:'#A5B4FC',
  purple:    '#66D9FF',
  purpleHi:  '#4F7CFF',
  purpleDeep:'#2046C2',
}
const GRAD_PILL = 'linear-gradient(135deg, #4F7CFF 0%, #2046C2 100%)'
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"

// The AI sometimes emits LaTeX with \( \) or \[ \] delimiters, but remark-math
// only understands $...$ / $$...$$ — normalise so the math actually renders.
function normalizeMath(md: string): string {
  return md
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, e) => `$$${e}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, e) => `$${e}$`)
}

export default function MistakeAnalysis() {
  const [rows, setRows] = useState<MistakeRow[]>([])
  const [adding, setAdding] = useState(false)
  // Single AI-result modal — shared by both Revise + Explain actions
  const [aiModal, setAiModal] = useState<{ title: string; body: string; loading: boolean } | null>(null)

  async function openAiAction(kind: 'revise' | 'explain', row: MistakeRow) {
    const title = kind === 'revise'
      ? `Revision plan: ${row.topic}`
      : `Why you struggle with: ${row.topic}`
    setAiModal({ title, body: '', loading: true })

    const prompt = kind === 'revise'
      ? `Build a 15-minute focused revision plan for an Indian high-school student on the topic "${row.topic}" (subject: ${row.subject}). The student has gotten this wrong ${row.count} times recently. Output a clean markdown plan with: 1) Concept refresher (3-4 bullets, plain language), 2) One worked example, 3) The single common mistake to watch for, 4) A self-check question with answer hidden under <details>. Keep total under 220 words.`
      : `Explain WHY a student typically gets "${row.topic}" wrong (subject: ${row.subject}). The student has gotten this wrong ${row.count} times. Cover: (a) the most common conceptual misconception, (b) the typical reasoning error, (c) one corrected line of thinking. Clean markdown, no preamble, under 200 words.`

    try {
      const reply = await chat({
        messages: [
          { role: 'system', content: 'You are Kyno, a supportive tutor for Class 9-12 Indian students. Output clean markdown, using tables where useful. Wrap all math in KaTeX delimiters — inline as $...$, block as $$...$$. No preamble.' },
          { role: 'user',   content: prompt },
        ],
      })
      setAiModal({ title, body: reply || '_AI returned no response. Try again in a few seconds._', loading: false })
    } catch (e: any) {
      setAiModal({ title, body: `_Couldn't reach the AI. ${e?.message || 'Try again.'}_`, loading: false })
    }
  }

  function reload() { setRows(getMistakes()) }
  useEffect(() => {
    reload()
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('kairo:twin:')) reload()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const totalMistakes   = rows.reduce((a, r) => a + r.count, 0)
  const recurringTopics = rows.filter(r => r.count >= 3).length
  const highSeverity    = rows.filter(r => r.severity > 0.55).length

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      background: C.bg,
      backgroundImage:
        `radial-gradient(at 8% 0%,  rgba(79, 124, 255, 0.08) 0%, transparent 40%),
         radial-gradient(at 92% 100%, rgba(32, 70, 194, 0.10) 0%, transparent 45%)`,
      color: C.text, fontFamily: FONT,
      padding: '24px 28px 80px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Header onAddManual={() => setAdding(true)} />

        <div className="kr-mst-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 22 }}>
          <Kpi label="Total mistakes"   value={totalMistakes}    hint="across every Kyno activity" />
          <Kpi label="Recurring topics" value={recurringTopics}  hint="≥ 3 wrong attempts" />
          <Kpi label="High-severity"    value={highSeverity}     hint="needs attention now" highlight={highSeverity > 0} />
        </div>

        <div style={{ marginTop: 22 }}>
          <Heatmap rows={rows} />
        </div>

        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.length === 0 && <EmptyState />}
          <AnimatePresence>
            {rows.map((r, i) => (
              <MistakeCard
                key={`${r.subject}-${r.topic}`} row={r} delay={i * 0.04}
                onRevise={() => openAiAction('revise', r)}
                onExplain={() => openAiAction('explain', r)}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {adding && <AddMistakeModal onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload() }} />}
        {aiModal && <AiResultModal {...aiModal} onClose={() => setAiModal(null)} />}
      </AnimatePresence>

      <style>{`
        @media (max-width: 720px) {
          .kr-mst-kpi { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function Header({ onAddManual }: { onAddManual: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 13, background: GRAD_PILL,
          display: 'grid', placeItems: 'center', boxShadow: '0 10px 30px rgba(79, 124, 255, 0.03)',
        }}>
          <Activity size={22} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: C.purple, textTransform: 'uppercase', letterSpacing: 2.2 }}>
            Mistake Analysis  ·  Auto-tracked
          </div>
          <h1 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>
            What Kyno has spotted you struggle with.
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: C.textFaint, lineHeight: 1.55, maxWidth: 640 }}>
            Pulled from every quiz, battle, revision, lab, and adaptive test — grouped by topic, ranked by how much attention each needs right now.
          </p>
        </div>
      </div>

      <button onClick={onAddManual} style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '9px 14px', borderRadius: 10,
        background: 'rgba(79, 124, 255, 0.08)',
        border: '1px solid rgba(102, 217, 255, 0.14)',
        color: C.text, fontFamily: 'inherit', fontWeight: 600, fontSize: 12,
        cursor: 'pointer',
      }}>
        <Plus size={13} color={C.purple} />
        Log a mistake
      </button>
    </div>
  )
}

function Kpi({ label, value, hint, highlight }: { label: string; value: number; hint: string; highlight?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{
      background: C.panel,
      border: `1px solid ${highlight ? 'rgba(102, 217, 255, 0.45)' : C.border}`,
      borderRadius: 14, padding: '16px 18px', position: 'relative', overflow: 'hidden',
      boxShadow: highlight ? '0 0 32px rgba(79, 124, 255, 0.18)' : 'none',
    }}>
      {highlight && (
        <div style={{
          position: 'absolute', top: -30, right: -30,
          width: 130, height: 130, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79, 124, 255, 0.30) 0%, transparent 70%)',
          pointerEvents: 'none', filter: 'blur(10px)',
        }} />
      )}
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1.4 }}>
        {label}
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, color: C.text, marginTop: 4, letterSpacing: -1, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 6 }}>{hint}</div>
    </motion.div>
  )
}

function Heatmap({ rows }: { rows: MistakeRow[] }) {
  const bySubject = new Map<string, MistakeRow[]>()
  for (const r of rows) {
    if (!bySubject.has(r.subject)) bySubject.set(r.subject, [])
    bySubject.get(r.subject)!.push(r)
  }
  if (bySubject.size === 0) return null
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1.6, marginBottom: 12 }}>
        Heatmap by subject
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[...bySubject.entries()].map(([subject, items]) => (
          <div key={subject}>
            <div style={{ fontSize: 11, color: C.textFaint, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>
              {subject}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {items.map(it => {
                const sev = it.severity
                const bg = `rgba(102, 217, 255, ${0.10 + sev * 0.45})`
                const bd = `rgba(102, 217, 255, ${0.3  + sev * 0.45})`
                return (
                  <span key={it.topic} style={{
                    padding: '5px 9px', borderRadius: 7,
                    background: bg, border: `1px solid ${bd}`,
                    fontSize: 11.5, fontWeight: 500, color: C.text,
                    whiteSpace: 'nowrap', textTransform: 'capitalize',
                  }}>
                    {it.topic} <span style={{ marginLeft: 4, color: C.textFaint, fontSize: 10 }}>× {it.count}</span>
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MistakeCard({ row, delay, onRevise, onExplain }: {
  row: MistakeRow; delay: number
  onRevise: () => void; onExplain: () => void
}) {
  const severityLabel = row.severity > 0.55 ? 'High' : row.severity > 0.30 ? 'Medium' : 'Low'
  const severityColor = row.severity > 0.55 ? C.purpleHi : row.severity > 0.30 ? C.purple : C.purpleSoft
  const avgScore = row.recentScores.length ? Math.round(row.recentScores.reduce((a, b) => a + b, 0) / row.recentScores.length) : null
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ delay, duration: 0.4 }}
      style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14,
        padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
      <div style={{ width: 4, height: 44, borderRadius: 2, background: severityColor, boxShadow: `0 0 14px ${severityColor}88` }} />
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1.6 }}>
            {row.subject}
          </span>
          <span style={{
            padding: '2px 8px', borderRadius: 6,
            background: `${severityColor}22`, border: `1px solid ${severityColor}55`,
            fontSize: 10, fontWeight: 700, color: severityColor,
            textTransform: 'uppercase', letterSpacing: 1.2,
          }}>
            {severityLabel} severity
          </span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginTop: 4, textTransform: 'capitalize', letterSpacing: -0.2 }}>
          {row.topic}
        </div>
        <div style={{ fontSize: 12, color: C.textFaint, marginTop: 5, lineHeight: 1.5 }}>
          {row.count} wrong attempt{row.count === 1 ? '' : 's'}
          {avgScore != null && <> · recent avg <strong style={{ color: C.text }}>{avgScore}%</strong></>}
          {' · last '}{formatRelative(row.lastAt)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onRevise} style={chipBtn(C.purple)}><Repeat size={13} />Revise now</button>
        <button onClick={onExplain} style={chipBtn(severityColor, 'outline')}><Sparkles size={13} />Explain</button>
      </div>
    </motion.div>
  )
}

// ─── AI result modal — shared for Revise + Explain ─────────────────────────
function AiResultModal({ title, body, loading, onClose }: {
  title: string; body: string; loading: boolean; onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        display: 'grid', placeItems: 'center', padding: 16,
        overflowY: 'auto',
      }}>
      <motion.div
        initial={{ y: 12, scale: 0.96 }} animate={{ y: 0, scale: 1 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 620,
          background: C.panel,
          border: '1px solid rgba(102, 217, 255, 0.35)',
          borderRadius: 18, padding: 24,
          color: C.text, fontFamily: 'inherit',
          boxShadow: '0 24px 60px rgba(79, 124, 255, 0.03)',
          position: 'relative', maxHeight: '88vh', overflowY: 'auto',
        }}>
        <button onClick={onClose} aria-label="Close" style={{
          position: 'absolute', top: 14, right: 14,
          width: 30, height: 30, borderRadius: 8,
          background: 'transparent', border: `1px solid ${C.border}`,
          color: C.textFaint, cursor: 'pointer', display: 'grid', placeItems: 'center',
        }}>
          <X size={14} />
        </button>

        <div style={{ fontSize: 10.5, fontWeight: 700, color: C.purple, textTransform: 'uppercase', letterSpacing: 2 }}>
          Kyno  ·  AI tutor
        </div>
        <h3 style={{ margin: '4px 0 14px', fontSize: 19, fontWeight: 800, letterSpacing: -0.3 }}>{title}</h3>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.textDim, padding: '14px 0' }}>
            <Loader2 size={16} className="kr-spin" /> Thinking…
            <style>{`@keyframes kr-spin { to { transform: rotate(360deg) } } .kr-spin { animation: kr-spin .8s linear infinite }`}</style>
          </div>
        ) : (
          <div className="prose-ai" style={{ fontSize: 14, color: C.textDim, lineHeight: 1.7 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{normalizeMath(body)}</ReactMarkdown>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

function chipBtn(tint: string, variant: 'solid' | 'outline' = 'solid'): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 12px', borderRadius: 9,
    background: variant === 'solid' ? `${tint}1c` : 'transparent',
    border: `1px solid ${variant === 'solid' ? tint + '55' : C.border}`,
    color: variant === 'solid' ? tint : C.textDim,
    fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
    cursor: 'pointer',
  }
}

function EmptyState() {
  return (
    <div style={{
      padding: '40px 24px', background: C.panel, border: `1px dashed ${C.border}`,
      borderRadius: 14, textAlign: 'center',
    }}>
      <AlertTriangle size={32} color={C.purple} style={{ opacity: 0.6 }} />
      <h3 style={{ margin: '14px 0 6px', fontSize: 16, fontWeight: 700, color: C.text }}>
        Nothing here yet — clean record.
      </h3>
      <p style={{ margin: 0, fontSize: 13, color: C.textFaint, maxWidth: 460, marginInline: 'auto', lineHeight: 1.6 }}>
        Mistakes from quizzes, Battle Mode, Adaptive Quiz, and Revision Sim will appear here automatically once they happen.
        You can also log one manually with the button above.
      </p>
    </div>
  )
}

function AddMistakeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [topic, setTopic] = useState('')
  const [subject, setSubject] = useState('General')
  const [detail, setDetail] = useState('')
  function save() {
    if (!topic.trim()) return
    recordMistake({ topic: topic.trim(), subject, detail })
    onSaved()
  }
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        display: 'grid', placeItems: 'center', padding: 16,
      }}>
      <motion.div
        initial={{ y: 12, scale: 0.96 }} animate={{ y: 0, scale: 1 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 460,
          background: C.panel,
          border: '1px solid rgba(102, 217, 255, 0.35)',
          borderRadius: 18, padding: 22,
          color: C.text, fontFamily: 'inherit',
          boxShadow: '0 24px 60px rgba(79, 124, 255, 0.03)',
        }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Log a mistake</h3>
        <p style={{ margin: '4px 0 14px', fontSize: 12.5, color: C.textFaint }}>
          What did you get wrong? Kyno will use this to build patterns + suggest revisions.
        </p>
        <Label>Topic *</Label>
        <Input value={topic} onChange={setTopic} placeholder="e.g. quadratic equations" autoFocus />
        <Label>Subject</Label>
        <Input value={subject} onChange={setSubject} placeholder="Math · Physics · Biology …" />
        <Label>What went wrong (optional)</Label>
        <Input value={detail} onChange={setDetail} placeholder="forgot the discriminant formula" multiline />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} style={chipBtn(C.textDim, 'outline')}>Cancel</button>
          <button onClick={save} disabled={!topic.trim()} style={{
            padding: '9px 18px', borderRadius: 10,
            background: GRAD_PILL,
            color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
            border: 'none', cursor: topic.trim() ? 'pointer' : 'not-allowed',
            opacity: topic.trim() ? 1 : 0.5,
          }}>
            Save mistake
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 700, color: C.textFaint,
      textTransform: 'uppercase', letterSpacing: 1.4, margin: '12px 0 6px',
    }}>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, autoFocus, multiline }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; multiline?: boolean
}) {
  const sharedStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px', borderRadius: 10,
    background: C.panel2, border: `1px solid ${C.borderSoft}`,
    color: C.text, fontFamily: 'inherit', fontSize: 13, outline: 'none',
  }
  return multiline ? (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      rows={3} style={{ ...sharedStyle, resize: 'vertical', minHeight: 64 }} />
  ) : (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      autoFocus={autoFocus} style={sharedStyle} />
  )
}

function formatRelative(ms: number): string {
  const d = Date.now() - ms
  const s = Math.floor(d / 1000); if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const dd = Math.floor(h / 24); if (dd < 30) return `${dd}d ago`
  return new Date(ms).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}
