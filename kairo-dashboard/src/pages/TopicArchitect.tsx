/**
 * Topic Architect — give a NEET/JEE topic, the AI plans EVERYTHING:
 * what to study, what to skip, must-know concepts, a concept map,
 * generated practice questions, and past-year-question insights.
 *
 * Backend: POST /api/topic-architect/plan
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Loader2, Brain, CheckCircle2, XCircle, Map as MapIcon,
  HelpCircle, History, ListOrdered, Clock, ChevronDown, Target,
} from 'lucide-react'
import KairoGyro from '../components/KairoGyro'

interface StudyPoint { point: string; why: string }
interface MapNode { id: string; label: string }
interface MapLink { from: string; to: string; label: string }
interface PracticeQ {
  q: string; type: string; options?: string[]; answer: string;
  explanation: string; difficulty: string;
}
interface Plan {
  topic: string; subject: string;
  examImportance: 'HIGH' | 'MEDIUM' | 'LOW';
  examWeightPercent: number;
  oneLineVerdict: string;
  whatToStudy: StudyPoint[];
  whatToSkip: StudyPoint[];
  mustKnowConcepts: string[];
  conceptMap: { nodes: MapNode[]; links: MapLink[] };
  practiceQuestions: PracticeQ[];
  pyqInsights: { frequency: string; typicalFormat: string; commonTraps: string; tip: string };
  studyOrder: string[];
  estimatedHours: number;
}

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(14px) saturate(140%)',
  WebkitBackdropFilter: 'blur(14px) saturate(140%)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 14,
}
const inp: React.CSSProperties = {
  background: '#0E1117', border: '1px solid #1f2532', borderRadius: 8,
  padding: '11px 14px', fontSize: 14, color: '#fafafa', fontFamily: 'inherit',
  outline: 'none', width: '100%', boxSizing: 'border-box',
}
const lbl: React.CSSProperties = {
  fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 5,
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8,
}
const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg, #4F7CFF 0%, #66D9FF 100%)', color: '#fff',
  border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 700,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
  boxShadow: '0 6px 24px rgba(79,124,255,0.32)',
}
const h3: React.CSSProperties = {
  fontSize: 13, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase',
  color: '#66D9FF', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8,
}
const importColor = (i: string) => i === 'HIGH' ? '#ff4d6d' : i === 'MEDIUM' ? '#ffb44a' : '#66ff9a'
const diffColor = (d: string) => d === 'hard' ? '#ff4d6d' : d === 'medium' ? '#ffb44a' : '#66ff9a'

const EXAMS = [
  { id: 'neet', label: 'NEET' },
  { id: 'jee', label: 'JEE' },
  { id: 'boards', label: 'Boards' },
  { id: 'general', label: 'General' },
]

export default function TopicArchitect() {
  const [topic, setTopic] = useState('')
  const [exam, setExam] = useState('neet')
  const [depth, setDepth] = useState<'standard' | 'deep'>('standard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [openQ, setOpenQ] = useState<number | null>(null)

  async function generate() {
    if (!topic.trim()) { setError('Enter a topic first.'); return }
    setLoading(true); setError(null); setPlan(null); setOpenQ(null)
    try {
      const r = await fetch('/api/topic-architect/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), exam, depth }),
      })
      if (!r.ok) throw new Error('Server returned ' + r.status)
      const data = await r.json()
      if (data.error) throw new Error(data.error)
      setPlan(data)
    } catch (e: any) {
      setError(e.message || 'Failed to plan this topic')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto', color: '#fafafa', height: '100%', overflowY: 'auto', boxSizing: 'border-box', width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: '#66D9FF', marginBottom: 8, fontWeight: 700 }}>
          Topic Architect
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, letterSpacing: -0.5 }}>
          Give a topic. Get the whole plan.
        </h1>
        <p style={{ color: '#9CA3AF', fontSize: 14, marginTop: 8 }}>
          Kairo acts like a whole coaching institute for one topic — what to study, what to skip,
          concept maps, practice questions, and how it's been asked before.
        </p>
      </div>

      {/* Input bar */}
      <div style={{ ...card, padding: 20, marginBottom: 24 }}>
        <label style={lbl}><Target size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Topic</label>
        <input
          style={inp}
          placeholder="e.g. Human Reproduction · Rotational Motion · Chemical Equilibrium"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') generate() }}
        />
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end', marginTop: 16, flexWrap: 'wrap' }}>
          <div>
            <label style={lbl}>Exam</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {EXAMS.map(e => (
                <button key={e.id} onClick={() => setExam(e.id)} style={{
                  padding: '8px 16px', fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: 'pointer',
                  background: exam === e.id ? 'rgba(102,217,255,0.18)' : '#0E1117',
                  color: exam === e.id ? '#66D9FF' : '#A1A1AA',
                  border: '1px solid ' + (exam === e.id ? 'rgba(102,217,255,0.55)' : '#1f2532'),
                }}>{e.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={lbl}>Depth</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['standard', 'deep'] as const).map(d => (
                <button key={d} onClick={() => setDepth(d)} style={{
                  padding: '8px 16px', fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: 'pointer',
                  textTransform: 'capitalize',
                  background: depth === d ? 'rgba(102,217,255,0.18)' : '#0E1117',
                  color: depth === d ? '#66D9FF' : '#A1A1AA',
                  border: '1px solid ' + (depth === d ? 'rgba(102,217,255,0.55)' : '#1f2532'),
                }}>{d}</button>
              ))}
            </div>
          </div>
          <button onClick={generate} disabled={loading} style={{ ...btnPrimary, marginLeft: 'auto' }}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? 'Planning…' : 'Plan this topic'}
          </button>
        </div>
        {error && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(255,77,109,0.10)', border: '1px solid rgba(255,77,109,0.30)', borderRadius: 8, color: '#ff8aa0', fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>

      {loading && !plan && (
        <KairoGyro fullPage label="Planning your topic" sub="what to study · questions · maps · pyq insights" />
      )}

      <AnimatePresence>
        {plan && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32 }}>
            {/* Verdict band */}
            <div style={{ ...card, padding: 18, marginBottom: 16, borderColor: importColor(plan.examImportance) + '55' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, letterSpacing: 2, padding: '5px 12px', borderRadius: 999,
                  color: importColor(plan.examImportance),
                  background: importColor(plan.examImportance) + '22',
                  border: '1px solid ' + importColor(plan.examImportance) + '55',
                }}>{plan.examImportance} PRIORITY</span>
                <span style={{ fontSize: 13, color: '#9CA3AF' }}>{plan.subject}</span>
                <span style={{ fontSize: 13, color: '#66D9FF', fontWeight: 700 }}>~{plan.examWeightPercent}% of paper</span>
                <span style={{ fontSize: 13, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={13} /> {plan.estimatedHours}h to master
                </span>
              </div>
              <div style={{ fontSize: 16, color: '#fafafa', marginTop: 12, lineHeight: 1.5 }}>{plan.oneLineVerdict}</div>
            </div>

            {/* What to study / skip — two columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ ...card, padding: 18 }}>
                <h3 style={{ ...h3, color: '#66ff9a' }}><CheckCircle2 size={14} /> Study this</h3>
                {plan.whatToStudy?.map((s, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fafafa' }}>{s.point}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{s.why}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...card, padding: 18 }}>
                <h3 style={{ ...h3, color: '#ff8aa0' }}><XCircle size={14} /> Skip / skim</h3>
                {plan.whatToSkip?.map((s, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fafafa' }}>{s.point}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{s.why}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Must-know concept chips */}
            <div style={{ ...card, padding: 18, marginBottom: 16 }}>
              <h3 style={h3}><Brain size={14} /> Must-know concepts</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {plan.mustKnowConcepts?.map((c, i) => (
                  <span key={i} style={{
                    fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 999,
                    background: 'rgba(79,124,255,0.14)', color: '#A5B4FC',
                    border: '1px solid rgba(102,217,255,0.25)',
                  }}>{c}</span>
                ))}
              </div>
            </div>

            {/* Concept map — node + link list (lightweight visual) */}
            <div style={{ ...card, padding: 18, marginBottom: 16 }}>
              <h3 style={h3}><MapIcon size={14} /> Concept map</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {plan.conceptMap?.nodes?.map(n => (
                  <span key={n.id} style={{
                    fontSize: 13, fontWeight: 700, padding: '8px 14px', borderRadius: 10,
                    background: 'rgba(102,217,255,0.12)', color: '#66D9FF',
                    border: '1px solid rgba(102,217,255,0.30)',
                  }}>{n.label}</span>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {plan.conceptMap?.links?.map((l, i) => {
                  const from = plan.conceptMap.nodes.find(n => n.id === l.from)?.label || l.from
                  const to = plan.conceptMap.nodes.find(n => n.id === l.to)?.label || l.to
                  return (
                    <div key={i} style={{ fontSize: 12, color: '#9CA3AF' }}>
                      <span style={{ color: '#66D9FF' }}>{from}</span>
                      <span style={{ color: '#5B616E' }}> ──{l.label}──▸ </span>
                      <span style={{ color: '#66D9FF' }}>{to}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Practice questions — accordion */}
            <div style={{ ...card, padding: 18, marginBottom: 16 }}>
              <h3 style={h3}><HelpCircle size={14} /> Practice questions ({plan.practiceQuestions?.length || 0})</h3>
              {plan.practiceQuestions?.map((q, i) => (
                <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '10px 0' }}>
                  <div onClick={() => setOpenQ(openQ === i ? null : i)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: diffColor(q.difficulty), textTransform: 'uppercase', marginTop: 3, minWidth: 50 }}>{q.difficulty}</span>
                    <span style={{ fontSize: 14, color: '#fafafa', flex: 1 }}>{q.q}</span>
                    <ChevronDown size={16} style={{ color: '#5B616E', transform: openQ === i ? 'rotate(180deg)' : 'none', transition: 'transform .2s', marginTop: 3 }} />
                  </div>
                  <AnimatePresence>
                    {openQ === i && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', paddingLeft: 60 }}>
                        {q.options && q.options.length > 0 && (
                          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {q.options.map((o, k) => (
                              <div key={k} style={{ fontSize: 13, color: '#9CA3AF' }}>{o}</div>
                            ))}
                          </div>
                        )}
                        <div style={{ marginTop: 8, fontSize: 13, color: '#66ff9a', fontWeight: 700 }}>✓ {q.answer}</div>
                        <div style={{ marginTop: 4, fontSize: 12, color: '#9CA3AF' }}>{q.explanation}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {/* PYQ insights + study order — two columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ ...card, padding: 18 }}>
                <h3 style={h3}><History size={14} /> Past-paper insights</h3>
                <div style={{ fontSize: 13, color: '#fafafa', marginBottom: 8 }}>
                  <b style={{ color: '#66D9FF' }}>Frequency:</b> {plan.pyqInsights?.frequency}
                </div>
                <div style={{ fontSize: 13, color: '#fafafa', marginBottom: 8 }}>
                  <b style={{ color: '#66D9FF' }}>Usual format:</b> {plan.pyqInsights?.typicalFormat}
                </div>
                <div style={{ fontSize: 13, color: '#fafafa', marginBottom: 8 }}>
                  <b style={{ color: '#ff8aa0' }}>Common trap:</b> {plan.pyqInsights?.commonTraps}
                </div>
                <div style={{ fontSize: 13, color: '#ffd180', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, marginTop: 4 }}>
                  💡 {plan.pyqInsights?.tip}
                </div>
              </div>
              <div style={{ ...card, padding: 18 }}>
                <h3 style={h3}><ListOrdered size={14} /> Study order</h3>
                {plan.studyOrder?.map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                    <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: 'rgba(79,124,255,0.22)', color: '#A5B4FC', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    <span style={{ fontSize: 13, color: '#fafafa', lineHeight: 1.4 }}>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
