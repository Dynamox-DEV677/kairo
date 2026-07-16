import { useState, useEffect, type JSX } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lightbulb, GitBranch, HelpCircle, Search, Trash2 } from 'lucide-react'
import { post, get, del } from '../lib/api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

const SCHOOL_ID = 'demo_school'

const TABS = [
  { id: 'simplify', label: 'Concept Simplifier', icon: Lightbulb  },
  { id: 'mindmap',  label: 'Mindmap Generator',  icon: GitBranch  },
  { id: 'doubts',   label: 'Doubt History',       icon: HelpCircle },
]

const card  = { background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(14px) saturate(140%)', WebkitBackdropFilter: 'blur(14px) saturate(140%)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 20 } as React.CSSProperties
const inp   = { background: '#141A2A', border: '1px solid #1f2532', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', width: '100%' } as React.CSSProperties
const lbl   = { fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 } as React.CSSProperties
const btn   = (active = true, color?: string) => ({ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: 'none', background: active ? (color || 'linear-gradient(135deg,#7C6BF6,#7C6BF6)') : '#171D2D', color: active ? '#fff' : '#6B7280', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: active ? 'pointer' : 'not-allowed' } as React.CSSProperties)

const SUBJECTS = ['General','Physics','Chemistry','Biology','Mathematics','History','Geography','English','Hindi','Economics']

export default function ConceptTools() {
  const [tab, setTab] = useState('simplify')

  return (
    <div style={{ padding: '28px 36px', maxWidth: 900, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Concept Tools</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Simplify concepts · Visual mindmaps · Doubt history</p>
      </div>

      <div className="seg-scroll" style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#141A2A', border: '1px solid #1f2532', borderRadius: 10, padding: 4 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '7px 8px', borderRadius: 7, border: 'none', fontFamily: 'inherit',
            fontSize: 12, fontWeight: tab === t.id ? 600 : 400, cursor: 'pointer',
            background: tab === t.id ? '#1f2532' : 'transparent',
            color: tab === t.id ? '#A5B4FC' : '#6B7280', transition: 'all 0.15s',
          }}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === 'simplify' && <SimplifyTab />}
          {tab === 'mindmap'  && <MindmapTab />}
          {tab === 'doubts'   && <DoubtsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function SimplifyTab() {
  const [concept, setConcept]   = useState('')
  const [subject, setSubject]   = useState('General')
  const [level, setLevel]       = useState('class8')
  const [question, setQuestion] = useState('')
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<any>(null)
  const [err, setErr]           = useState('')

  async function simplify() {
    if (!concept.trim()) { setErr('Enter a concept'); return }
    setLoading(true); setErr(''); setResult(null)
    try { setResult(await post('/concept/simplify', { concept, subject, level, school_id: SCHOOL_ID })) }
    catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  async function askDoubt() {
    if (!question.trim()) return
    setLoading(true)
    try {
      const r = await post('/concept/doubt', { question, subject, school_id: SCHOOL_ID })
      setResult({ explanation: r.answer })
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div>
        <div style={card}>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Subject</label>
            <select style={inp} value={subject} onChange={e => setSubject(e.target.value)}>
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Explain Like I'm in…</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {[['class5','Class 5'],['class8','Class 8'],['class12','Class 12']].map(([v, l]) => (
                <button key={v} onClick={() => setLevel(v)} style={{
                  padding: '7px', borderRadius: 7, border: `1px solid ${level === v ? '#7C6BF6' : '#1f2532'}`,
                  background: level === v ? '#7C6BF610' : 'transparent',
                  color: level === v ? '#A5B4FC' : '#9CA3AF', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Concept</label>
            <input style={inp} value={concept} onChange={e => setConcept(e.target.value)} placeholder="e.g. Photosynthesis, Newton's Second Law…" />
          </div>
          {err && <p style={{ color: '#A5B4FC', fontSize: 12, marginBottom: 8 }}>{err}</p>}
          <button onClick={simplify} disabled={loading} style={{ ...btn(!loading), width: '100%', justifyContent: 'center' }}>
            <Lightbulb size={13} /> {loading ? 'Simplifying…' : 'Simplify'}
          </button>

          <div style={{ borderTop: '1px solid #1f2532', marginTop: 16, paddingTop: 16 }}>
            <label style={lbl}>Ask a Quick Doubt</label>
            <input style={{ ...inp, marginBottom: 8 }} value={question} onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && askDoubt()}
              placeholder="What is the difference between…?" />
            <button onClick={askDoubt} disabled={loading || !question.trim()} style={{ ...btn(!loading && !!question.trim(), 'linear-gradient(135deg,#A5B4FC,#0284c7)'), width: '100%', justifyContent: 'center' }}>
              <HelpCircle size={13} /> Ask Doubt
            </button>
          </div>
        </div>
      </div>

      <div>
        {result?.explanation && (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} style={card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#A5B4FC', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Explanation
            </div>
            <div className="prose-ai" style={{ fontSize: 14, color: '#e4e4e7', lineHeight: 1.9 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{result.explanation}</ReactMarkdown>
            </div>
            {concept && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: '#141A2A', borderRadius: 8, fontSize: 11, color: '#9CA3AF' }}>
                💡 Tip: Try asking the same concept at a different level for deeper understanding.
              </div>
            )}
          </motion.div>
        )}
        {!result && (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, textAlign: 'center' }}>
            <Lightbulb size={32} color="#4B5563" />
            <p style={{ fontSize: 13, color: '#4B5563', marginTop: 12 }}>Enter a concept and it'll be explained at your chosen level</p>
          </div>
        )}
      </div>
    </div>
  )
}

function MindmapTab() {
  const [chapter, setChapter] = useState('')
  const [subject, setSubject] = useState('General')
  const [loading, setLoading] = useState(false)
  const [mindmap, setMindmap] = useState<any>(null)
  const [err, setErr]         = useState('')

  async function generate() {
    if (!chapter.trim()) { setErr('Enter a chapter name'); return }
    setLoading(true); setErr(''); setMindmap(null)
    try { setMindmap(await post('/concept/mindmap', { chapter, subject, school_id: SCHOOL_ID })) }
    catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  function renderNode(node: any, depth = 0): JSX.Element {
    const colors = ['#A5B4FC','#A5B4FC','#A5B4FC','#A5B4FC','#8FA0FA','#A5B4FC']
    const color = colors[depth % colors.length]
    return (
      <div key={node.id} style={{ marginLeft: depth * 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
          {depth > 0 && <div style={{ width: 20, height: 1, background: '#1f2532', flexShrink: 0 }} />}
          <div style={{ padding: '4px 12px', borderRadius: 6, background: `${color}15`, border: `1px solid ${color}30`, fontSize: 12, color, fontWeight: depth === 0 ? 700 : 500 }}>
            {node.label}
          </div>
        </div>
        {node.children?.map((c: any) => renderNode(c, depth + 1))}
      </div>
    )
  }

  return (
    <div>
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={lbl}>Subject</label>
            <select style={inp} value={subject} onChange={e => setSubject(e.target.value)}>
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Chapter Name</label>
            <input style={inp} value={chapter} onChange={e => setChapter(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generate()}
              placeholder="e.g. Laws of Motion, Cell Biology…" />
          </div>
          <button onClick={generate} disabled={loading} style={{ ...btn(!loading), justifyContent: 'center' }}>
            <GitBranch size={13} /> {loading ? 'Generating…' : 'Create Mindmap'}
          </button>
        </div>
        {err && <p style={{ color: '#A5B4FC', fontSize: 12, marginTop: 10, marginBottom: 0 }}>{err}</p>}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Generating mindmap…</div>}

      {mindmap && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fafafa', marginBottom: 4 }}>{mindmap.title}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{mindmap.subject}</div>
          </div>

          <div style={{ ...card, marginBottom: 12, overflowX: 'auto' }}>
            {mindmap.nodes?.[0]?.children?.map((node: any) => renderNode(node, 0))}
          </div>

          {(mindmap.key_formulas?.length > 0 || mindmap.important_terms?.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {mindmap.key_formulas?.length > 0 && (
                <div style={card}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Key Formulas</div>
                  {mindmap.key_formulas.map((f: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: '#e4e4e7', padding: '4px 0', borderBottom: '1px solid #1f2532' }}>{f}</div>
                  ))}
                </div>
              )}
              {mindmap.important_terms?.length > 0 && (
                <div style={card}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Important Terms</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {mindmap.important_terms.map((t: string, i: number) => (
                      <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, background: '#A5B4FC10', color: '#A5B4FC', border: '1px solid #A5B4FC30' }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {mindmap.exam_tips && (
            <div style={{ ...card, marginTop: 12, borderColor: '#A5B4FC30', background: '#1a1500' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Exam Tips</div>
              <p style={{ fontSize: 13, color: '#DBE7FF', margin: 0 }}>{mindmap.exam_tips}</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

function DoubtsTab() {
  const [doubts, setDoubts]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [subject, setSubject] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  function load() {
    setLoading(true)
    const params = new URLSearchParams({ school_id: SCHOOL_ID })
    if (subject) params.set('subject', subject)
    if (search)  params.set('search', search)
    get(`/concept/doubts?${params}`).then(setDoubts).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [subject])

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }} />
          <input style={{ ...inp, paddingLeft: 30 }} value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()} placeholder="Search doubts… (press Enter)" />
        </div>
        <select style={{ ...inp, width: 150 }} value={subject} onChange={e => { setSubject(e.target.value) }}>
          <option value="">All subjects</option>
          {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Loading…</div>}

      {!loading && doubts.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#4B5563', fontSize: 13 }}>
          No doubts yet. Use the Concept Simplifier to ask a doubt!
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {doubts.map(d => (
          <div key={d._id} style={{ ...card, cursor: 'pointer', padding: '14px 16px' }} onClick={() => setExpanded(expanded === d._id ? null : d._id)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>{d.question}</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{d.subject} · {new Date(d.created_at).toLocaleDateString('en-IN')}</div>
              </div>
              <HelpCircle size={14} color="#6B7280" />
            </div>
            <AnimatePresence>
              {expanded === d._id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: 'hidden' }}>
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #1f2532', fontSize: 13, color: '#B1B5BA', lineHeight: 1.8 }}>
                    {d.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  )
}
