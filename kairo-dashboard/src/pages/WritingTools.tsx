import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Edit3, Expand, Star, Shield, ArrowRight, Copy, Check } from 'lucide-react'
import { post } from '../lib/api'

const SCHOOL_ID = 'demo_school'

const TABS = [
  { id: 'improve',     label: 'Tone Improver',    icon: Edit3  },
  { id: 'expand',      label: 'Expand Answer',    icon: Expand },
  { id: 'topper',      label: 'Topper Level',     icon: Star   },
  { id: 'plagiarism',  label: 'Plagiarism Check', icon: Shield },
]

const card  = { background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 20 } as React.CSSProperties
const inp   = { background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', width: '100%' } as React.CSSProperties
const label = { fontSize: 11, color: '#71717a', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 } as React.CSSProperties
const btn   = (active = true) => ({ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: 'none', background: active ? 'linear-gradient(135deg,#6366f1,#7c3aed)' : '#1c1c1c', color: active ? '#fff' : '#52525b', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: active ? 'pointer' : 'not-allowed' } as React.CSSProperties)

export default function WritingTools() {
  const [tab, setTab] = useState('improve')

  return (
    <div style={{ padding: '28px 36px', maxWidth: 900, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Writing Tools</h1>
        <p style={{ fontSize: 13, color: '#52525b', marginTop: 4 }}>AI-powered writing enhancement for exam success</p>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 10, padding: 4 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '7px 8px', borderRadius: 7, border: 'none', fontFamily: 'inherit',
            fontSize: 12, fontWeight: tab === t.id ? 600 : 400, cursor: 'pointer',
            background: tab === t.id ? '#1e1e2e' : 'transparent',
            color: tab === t.id ? '#818cf8' : '#52525b', transition: 'all 0.15s',
          }}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === 'improve'    && <ToneImprover />}
          {tab === 'expand'     && <ExpandTool />}
          {tab === 'topper'     && <TopperTool />}
          {tab === 'plagiarism' && <PlagiarismTool />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ── Shared Result Box ─────────────────────────────────────────────────────────
function ResultBox({ title, text, color = '#818cf8' }: { title: string; text: string; color?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ ...card, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color }}>{title}</span>
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#34d399' : '#52525b', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <div style={{ fontSize: 13, color: '#e4e4e7', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{text}</div>
    </div>
  )
}

// ── Tone Improver ─────────────────────────────────────────────────────────────
function ToneImprover() {
  const [text, setText]       = useState('')
  const [tone, setTone]       = useState('formal')
  const [subject, setSubject] = useState('General')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<any>(null)
  const [err, setErr]         = useState('')

  async function run() {
    if (!text.trim()) { setErr('Enter some text'); return }
    setLoading(true); setErr(''); setResult(null)
    try { setResult(await post('/writing/improve', { text, tone, subject, school_id: SCHOOL_ID })) }
    catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={label}>Subject</label>
          <select style={inp} value={subject} onChange={e => setSubject(e.target.value)}>
            {['General','Physics','Chemistry','Biology','Mathematics','History','Geography','English','Hindi'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>Target Tone</label>
          <select style={inp} value={tone} onChange={e => setTone(e.target.value)}>
            <option value="formal">Formal (Academic)</option>
            <option value="friendly">Friendly (Conversational)</option>
            <option value="exam">Exam Ready (Precise)</option>
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={label}>Your Text</label>
        <textarea style={{ ...inp, height: 160, resize: 'vertical' }} value={text} onChange={e => setText(e.target.value)} placeholder="Paste your answer or paragraph here…" />
      </div>
      {err && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 10 }}>{err}</p>}
      <button onClick={run} disabled={loading} style={btn(!loading)}>
        <ArrowRight size={13} /> {loading ? 'Improving…' : 'Improve Tone'}
      </button>
      {result?.improved && <ResultBox title={`✓ ${tone.charAt(0).toUpperCase() + tone.slice(1)} Version`} text={result.improved} />}
    </div>
  )
}

// ── Expand Tool ───────────────────────────────────────────────────────────────
function ExpandTool() {
  const [text, setText]         = useState('')
  const [subject, setSubject]   = useState('General')
  const [words, setWords]       = useState('200')
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<any>(null)
  const [err, setErr]           = useState('')

  async function run() {
    if (!text.trim()) { setErr('Enter some text'); return }
    setLoading(true); setErr(''); setResult(null)
    try { setResult(await post('/writing/expand', { text, subject, target_words: Number(words), school_id: SCHOOL_ID })) }
    catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={label}>Subject</label>
          <select style={inp} value={subject} onChange={e => setSubject(e.target.value)}>
            {['General','Physics','Chemistry','Biology','Mathematics','History','Geography','English'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>Target Word Count</label>
          <select style={inp} value={words} onChange={e => setWords(e.target.value)}>
            {['100','150','200','250','300','400','500'].map(w => <option key={w} value={w}>{w} words</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={label}>Short Answer to Expand</label>
        <textarea style={{ ...inp, height: 140, resize: 'vertical' }} value={text} onChange={e => setText(e.target.value)} placeholder="Write a short 2-3 sentence answer…" />
      </div>
      {err && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 10 }}>{err}</p>}
      <button onClick={run} disabled={loading} style={btn(!loading)}>
        <Expand size={13} /> {loading ? 'Expanding…' : `Expand to ${words} words`}
      </button>
      {result?.expanded && <ResultBox title="✓ Expanded Answer" text={result.expanded} color="#34d399" />}
    </div>
  )
}

// ── Topper Tool ───────────────────────────────────────────────────────────────
function TopperTool() {
  const [text, setText]         = useState('')
  const [subject, setSubject]   = useState('General')
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<any>(null)
  const [err, setErr]           = useState('')

  async function run() {
    if (!text.trim()) { setErr('Enter your answer'); return }
    setLoading(true); setErr(''); setResult(null)
    try { setResult(await post('/writing/topper', { text, subject, school_id: SCHOOL_ID })) }
    catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ ...card, marginBottom: 16, background: '#1a1a2e', border: '1px solid #6366f130' }}>
        <p style={{ fontSize: 12, color: '#818cf8', margin: 0 }}>⭐ This tool rewrites your answer the way a top-scorer would write it — with precise vocabulary, strong structure, and exam keywords.</p>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={label}>Subject</label>
        <select style={{ ...inp, marginBottom: 12 }} value={subject} onChange={e => setSubject(e.target.value)}>
          {['General','Physics','Chemistry','Biology','Mathematics','History','Geography','English'].map(s => <option key={s}>{s}</option>)}
        </select>
        <label style={label}>Your Current Answer</label>
        <textarea style={{ ...inp, height: 160, resize: 'vertical' }} value={text} onChange={e => setText(e.target.value)} placeholder="Write your current answer — any quality is fine…" />
      </div>
      {err && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 10 }}>{err}</p>}
      <button onClick={run} disabled={loading} style={{ ...btn(!loading), background: loading ? '#1c1c1c' : 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
        <Star size={13} /> {loading ? 'Rewriting…' : 'Make it Topper-Level ✦'}
      </button>
      {result?.rewritten && (
        <div>
          <ResultBox title="✓ Topper-Level Answer" text={result.rewritten} color="#fbbf24" />
          <div style={{ ...card, marginTop: 10, background: '#0d1117', border: '1px solid #fbbf2430' }}>
            <p style={{ fontSize: 11, color: '#71717a', margin: 0 }}>Compare your original and the rewritten version. Study the vocabulary and structure differences — that's what examiners reward.</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Plagiarism Tool ────────────────────────────────────────────────────────────
function PlagiarismTool() {
  const [text, setText]       = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<any>(null)
  const [err, setErr]         = useState('')

  async function run() {
    if (text.length < 50) { setErr('Enter at least 50 characters'); return }
    setLoading(true); setErr(''); setResult(null)
    try { setResult(await post('/writing/plagiarism', { text, school_id: SCHOOL_ID })) }
    catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const riskColors: Record<string, string> = { low: '#34d399', medium: '#fbbf24', high: '#f87171', unknown: '#71717a' }

  return (
    <div>
      <div style={{ ...card, marginBottom: 16, background: '#111827' }}>
        <p style={{ fontSize: 12, color: '#71717a', margin: 0 }}>🔍 Checks for signs of copied content, inconsistent writing style, and over-reliance on textbook phrases. Basic AI-based check — not a web crawler.</p>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={label}>Text to Check</label>
        <textarea style={{ ...inp, height: 180, resize: 'vertical' }} value={text} onChange={e => setText(e.target.value)} placeholder="Paste the essay or answer to check…" />
      </div>
      {err && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 10 }}>{err}</p>}
      <button onClick={run} disabled={loading} style={btn(!loading)}>
        <Shield size={13} /> {loading ? 'Checking…' : 'Check Now'}
      </button>

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 16 }}>
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: riskColors[result.risk_level] || '#fafafa' }}>
                  {result.originality_score}%
                </div>
                <div style={{ fontSize: 12, color: '#71717a' }}>Originality Score</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
                  background: `${riskColors[result.risk_level]}20`, color: riskColors[result.risk_level] }}>
                  {(result.risk_level || 'unknown').toUpperCase()} RISK
                </span>
              </div>
            </div>
            {result.summary && <p style={{ fontSize: 13, color: '#a1a1aa', margin: 0 }}>{result.summary}</p>}
          </div>
          {result.flags?.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Flagged Phrases</div>
              {result.flags.map((f: any, i: number) => (
                <div key={i} style={{ fontSize: 12, color: '#fbbf24', marginBottom: 8, padding: '8px 12px', background: '#fbbf2408', borderRadius: 6, borderLeft: '3px solid #fbbf24' }}>
                  <strong>"{f.phrase}"</strong> — {f.reason}
                </div>
              ))}
            </div>
          )}
          {result.recommendation && (
            <div style={{ ...card, marginTop: 10, borderColor: '#34d39930' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#34d399', marginBottom: 6 }}>RECOMMENDATION</div>
              <p style={{ fontSize: 13, color: '#a1a1aa', margin: 0 }}>{result.recommendation}</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
