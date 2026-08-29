import { useState, useMemo, useEffect } from 'react'
import ErrorNote from '../components/ErrorNote'
import { studentMessage } from '../lib/aiError.core'
import { motion, AnimatePresence } from 'framer-motion'
import { Edit3, Expand, Star, Shield, ArrowRight, Copy, Check, PencilLine, Sparkles, AlertTriangle, BookOpen, Zap } from 'lucide-react'
import { post } from '../lib/api'
import { chat } from '../lib/openrouter'
import { KEYS, getRaw, setRaw } from '../lib/storage'
import { subjectLabels } from '../curriculum/subjects'
import { getProfile } from '../lib/twin'

const SCHOOL_ID = 'demo_school'

const TABS = [
  { id: 'editor',      label: 'Editor',           icon: PencilLine },
  { id: 'improve',     label: 'Tone Improver',    icon: Edit3  },
  { id: 'expand',      label: 'Expand Answer',    icon: Expand },
  { id: 'topper',      label: 'Topper Level',     icon: Star   },
  { id: 'plagiarism',  label: 'Plagiarism Check', icon: Shield },
]

const card  = { background: '#141A2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 20 } as React.CSSProperties
const inp   = { background: '#141A2A', border: '1px solid #1f2532', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', width: '100%' } as React.CSSProperties
const label = { fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 } as React.CSSProperties
const btn   = (active = true) => ({ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: 'none', background: active ? 'linear-gradient(135deg,#7C5CFF,#7C5CFF)' : '#171D2D', color: active ? '#fff' : '#6B7280', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: active ? 'pointer' : 'not-allowed' } as React.CSSProperties)

export default function WritingTools() {
  const [tab, setTab] = useState('editor')

  return (
    <div style={{ padding: '28px 36px', maxWidth: 900, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Writing Tools</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>AI-powered writing enhancement for exam success</p>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#141A2A', border: '1px solid #1f2532', borderRadius: 10, padding: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {TABS.map(t => (
          <button className="kyno-chunky" key={t.id} onClick={() => setTab(t.id)} style={{
            flex: '1 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 7, border: 'none', fontFamily: 'inherit',
            fontSize: 12, fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer',
            whiteSpace: 'nowrap',
            background: tab === t.id ? 'linear-gradient(135deg,#7C5CFF,#6455e0)' : 'transparent',
            color: tab === t.id ? '#fff' : '#6B7280', transition: 'all 0.15s',
            boxShadow: tab === t.id ? '0 4px 12px rgba(124, 92, 255,0.35)' : 'none',
          }}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === 'editor'     && <Editor />}
          {tab === 'improve'    && <ToneImprover />}
          {tab === 'expand'     && <ExpandTool />}
          {tab === 'topper'     && <TopperTool />}
          {tab === 'plagiarism' && <PlagiarismTool />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function ResultBox({ title, text, color = '#A5B4FC' }: { title: string; text: string; color?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ ...card, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color }}>{title}</span>
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#A5B4FC' : '#6B7280', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <div style={{ fontSize: 13, color: '#e4e4e7', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{text}</div>
    </div>
  )
}

const WEAK_VERBS = new Set(['got', 'get', 'gets', 'made', 'make', 'makes', 'did', 'do', 'does', 'have', 'has', 'had', 'thing', 'things', 'stuff'])
const HEDGE_WORDS = new Set(['very', 'really', 'quite', 'somewhat', 'pretty', 'just', 'rather', 'kind', 'sort', 'actually', 'basically', 'literally'])
const PASSIVE_AUX = ['is being', 'was being', 'are being', 'were being', 'has been', 'have been', 'had been', 'will be', 'be ']

function analyze(text: string) {
  const trimmed = text.trim()
  if (!trimmed) {
    return {
      words: 0, sentences: 0, paragraphs: 0, avgSentence: 0,
      gradeLevel: 0, clarity: 0,
      longSentences: [] as { text: string; words: number }[],
      passiveCount: 0,
      weakVerbs: [] as string[],
      hedges:    [] as string[],
      repeats:   [] as { word: string; count: number }[],
    }
  }
  const paragraphs = trimmed.split(/\n\s*\n/).filter(Boolean).length
  const sentencesArr = trimmed.split(/[.!?]+(?:\s|$)/).map(s => s.trim()).filter(Boolean)
  const sentences = sentencesArr.length
  const wordsArr = trimmed.toLowerCase().match(/\b[a-z']+\b/g) || []
  const words = wordsArr.length
  const avgSentence = sentences ? words / sentences : 0

  const syllables = wordsArr.reduce((acc, w) => acc + Math.max(1, (w.match(/[aeiouy]+/g) || []).length), 0)
  const gradeLevel = words && sentences
    ? Math.max(1, Math.min(20, +(0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59).toFixed(1)))
    : 0

  const longSentences: { text: string; words: number }[] = []
  for (const s of sentencesArr) {
    const wc = (s.match(/\b[a-z']+\b/gi) || []).length
    if (wc > 28) longSentences.push({ text: s.length > 100 ? s.slice(0, 100) + '…' : s, words: wc })
  }

  let passiveCount = 0
  const lower = ' ' + trimmed.toLowerCase() + ' '
  for (const p of PASSIVE_AUX) {
    const re = new RegExp(`\\b${p.trim()}\\s+\\w+ed\\b`, 'g')
    const m  = lower.match(re)
    if (m) passiveCount += m.length
  }

  const weakVerbs: string[] = []
  const hedges:    string[] = []
  for (const w of wordsArr) {
    if (WEAK_VERBS.has(w) && !weakVerbs.includes(w)) weakVerbs.push(w)
    if (HEDGE_WORDS.has(w) && !hedges.includes(w))   hedges.push(w)
  }

  const stop = new Set(['the','a','an','and','or','but','of','to','in','on','at','for','with','from','by','as','is','are','was','were','be','been','being','it','this','that','these','those','i','you','we','they','he','she','his','her','their','my','our','your','its','if','so','not','no','do','does','did','have','has','had','can','will','would','could','should'])
  const counts: Record<string, number> = {}
  for (const w of wordsArr) if (!stop.has(w) && w.length > 3) counts[w] = (counts[w] || 0) + 1
  const repeats = Object.entries(counts)
    .filter(([, c]) => c >= 4)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word, count]) => ({ word, count }))

  const sentencePenalty = Math.min(40, longSentences.length * 8 + Math.max(0, (avgSentence - 22) * 1.5))
  const passivePenalty  = Math.min(25, passiveCount * 5)
  const weakPenalty     = Math.min(15, weakVerbs.length * 3 + hedges.length * 2)
  const repeatPenalty   = Math.min(20, repeats.reduce((a, r) => a + r.count - 3, 0))
  const clarity = Math.max(0, Math.min(100, Math.round(100 - sentencePenalty - passivePenalty - weakPenalty - repeatPenalty)))

  return { words, sentences, paragraphs, avgSentence, gradeLevel, clarity, longSentences, passiveCount, weakVerbs, hedges, repeats }
}

function Editor() {
  const [text, setText]   = useState('')
  const [critique, setCritique] = useState<{ verdict: string; rewrites: string[]; suggestions: string[] } | null>(null)
  const [loading, setLoading]   = useState(false)
  const [err, setErr]           = useState('')

  useEffect(() => {
    const saved = getRaw(KEYS.writingDraft)
    if (saved) setText(saved)
  }, [])
  useEffect(() => {
    const t = setTimeout(() => setRaw(KEYS.writingDraft, text), 400)
    return () => clearTimeout(t)
  }, [text])

  const stats = useMemo(() => analyze(text), [text])

  async function askKyno() {
    if (!text.trim() || text.length < 60) { setErr('Write at least 60 characters before asking Kyno.'); return }
    setErr(''); setLoading(true); setCritique(null)
    try {
      const reply = await chat({
        messages: [
          { role: 'system', content: `You are Kyno's writing editor. Read the student's text and return ONLY this JSON:
{"verdict":"1 sentence verdict (max 28 words)","rewrites":["clearer rewrite of the weakest sentence","another rewrite of any other weak sentence"],"suggestions":["1 short tip","1 short tip","1 short tip"]}

Rules:
- "verdict" is honest but kind, in 2nd person.
- "rewrites" must be tighter than the original (cut filler, prefer active voice).
- "suggestions" each ≤ 18 words, specific and actionable.` },
          { role: 'user', content: text },
        ],
      })
      const m = reply.match(/\{[\s\S]*\}/)
      if (!m) throw new Error('AI returned no critique.')
      const parsed = JSON.parse(m[0])
      setCritique({
        verdict:    String(parsed.verdict || '').slice(0, 240),
        rewrites:   Array.isArray(parsed.rewrites)    ? parsed.rewrites.slice(0, 3).map((s: any) => String(s).slice(0, 400))    : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5).map((s: any) => String(s).slice(0, 200)) : [],
      })
    } catch (e: any) {
      setErr(studentMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const clarityColor = stats.clarity >= 80 ? '#A5B4FC' : stats.clarity >= 60 ? '#DBE7FF' : '#A5B4FC'
  const clarityLabel = stats.clarity >= 80 ? 'Crystal' : stats.clarity >= 60 ? 'Good' : stats.clarity >= 40 ? 'Cloudy' : 'Foggy'

  return (
    <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14 }}>
      <div>
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid #1f2532',
            display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#9CA3AF',
          }}>
            <PencilLine size={12} color="#A5B4FC" />
            <span style={{ flex: 1, fontWeight: 600, letterSpacing: 0.4 }}>Draft · auto-saved on this device</span>
            <span>{stats.words} words · {stats.sentences} sentences</span>
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Start writing. Kyno scores your clarity in real time on the right →"
            style={{
              width: '100%', minHeight: 420, padding: '18px 20px',
              background: 'transparent', border: 'none', outline: 'none',
              color: '#fafafa', fontSize: 15, lineHeight: 1.7,
              fontFamily: '"Charter", "Iowan Old Style", Georgia, serif',
              resize: 'vertical',
            }}
          />
        </div>

        {err && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(165, 180, 252, 0.08)', border: '1px solid rgba(165, 180, 252, 0.25)', borderRadius: 8, fontSize: 12, color: '#A5B4FC' }}>
            {err}
          </div>
        )}

        <button className="kyno-chunky" onClick={askKyno} disabled={loading}
          style={{
            marginTop: 12, width: '100%', padding: '13px', borderRadius: 10, border: 'none',
            background: loading ? '#171D2D' : 'linear-gradient(135deg, #A5B4FC, #7C5CFF)',
            color: loading ? '#9CA3AF' : '#000',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
          <Sparkles size={14} /> {loading ? 'Kyno is reading…' : 'Ask Kyno for a critique'}
        </button>

        <AnimatePresence>
          {critique && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ ...card, marginTop: 12, borderColor: 'rgba(165, 180, 252, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #A5B4FC, #7C5CFF)', display: 'grid', placeItems: 'center' }}>
                  <Sparkles size={13} color="#000" />
                </div>
                <span style={{ fontSize: 11, color: '#A5B4FC', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.4 }}>Kyno's verdict</span>
              </div>
              <p style={{ margin: 0, fontSize: 14, color: '#fafafa', fontWeight: 600, lineHeight: 1.55 }}>"{critique.verdict}"</p>

              {critique.rewrites.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(165, 180, 252, 0.18)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 8 }}>Cleaner rewrites</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {critique.rewrites.map((r, i) => (
                      <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(165, 180, 252, 0.06)', border: '1px solid rgba(165, 180, 252, 0.18)', fontSize: 13, color: '#e4e4e7', lineHeight: 1.55, fontFamily: '"Charter", Georgia, serif' }}>
                        {r}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {critique.suggestions.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(165, 180, 252, 0.18)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 8 }}>How to tighten it</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {critique.suggestions.map((s, i) => (
                      <li key={i} style={{ fontSize: 13, color: '#d4d4d8', lineHeight: 1.55 }}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 0, alignSelf: 'flex-start' }}>
        <div style={{ ...card, textAlign: 'center', padding: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1.4 }}>Clarity score</div>
          <div style={{ position: 'relative', width: 132, height: 132, margin: '10px auto 6px' }}>
            <svg viewBox="0 0 132 132" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx={66} cy={66} r={56} fill="none" stroke="#171D2D" strokeWidth={10} />
              <motion.circle cx={66} cy={66} r={56} fill="none"
                stroke={clarityColor} strokeWidth={10} strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 56}
                animate={{ strokeDashoffset: 2 * Math.PI * 56 * (1 - stats.clarity / 100) }}
                transition={{ duration: 0.6 }} />
            </svg>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: clarityColor, letterSpacing: -1.4, lineHeight: 1 }}>{stats.clarity}</div>
              <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.4 }}>/ 100</div>
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: clarityColor }}>{clarityLabel}</div>
        </div>

        <div style={{ ...card, padding: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 10 }}>At a glance</div>
          <StatRow icon={BookOpen}      label="Grade level" value={stats.gradeLevel ? `${stats.gradeLevel}` : '—'} />
          <StatRow icon={Zap}           label="Avg sentence" value={stats.avgSentence ? `${stats.avgSentence.toFixed(1)} words` : '—'} />
          <StatRow icon={Edit3}         label="Paragraphs"   value={`${stats.paragraphs || 0}`} />
        </div>

        {(stats.longSentences.length > 0 || stats.passiveCount > 0 || stats.weakVerbs.length > 0 || stats.hedges.length > 0 || stats.repeats.length > 0) && (
          <div style={{ ...card, padding: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 10 }}>Issues found</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {stats.longSentences.length > 0 && <IssueChip label={`${stats.longSentences.length} long sentence${stats.longSentences.length === 1 ? '' : 's'}`} color="#A5B4FC" />}
              {stats.passiveCount > 0       && <IssueChip label={`${stats.passiveCount} passive`} color="#DBE7FF" />}
              {stats.weakVerbs.map(w => <IssueChip key={w} label={`"${w}"`} color="#A5B4FC" />)}
              {stats.hedges.map(w  => <IssueChip key={w} label={`hedge: "${w}"`} color="#A5B4FC" />)}
              {stats.repeats.map(r => <IssueChip key={r.word} label={`${r.word} ×${r.count}`} color="#4A2FA8" />)}
            </div>
            {stats.longSentences.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #171D2D' }}>
                {stats.longSentences.slice(0, 2).map((s, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#B1B5BA', marginBottom: 6, padding: '6px 8px', borderRadius: 6, background: 'rgba(165, 180, 252, 0.06)', borderLeft: '2px solid #A5B4FC' }}>
                    <span style={{ color: '#A5B4FC', fontWeight: 700 }}>{s.words}w · </span>
                    {s.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {stats.clarity >= 85 && stats.words > 100 && (
          <div style={{ ...card, padding: 14, borderColor: 'rgba(165, 180, 252, 0.3)', background: 'rgba(165, 180, 252, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={13} color="#A5B4FC" />
              <div style={{ fontSize: 12, color: '#A5B4FC', fontWeight: 700 }}>This reads beautifully.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
      <Icon size={12} color="#9CA3AF" />
      <span style={{ flex: 1, fontSize: 12, color: '#B1B5BA' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>{value}</span>
    </div>
  )
}

function IssueChip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      padding: '4px 9px', borderRadius: 999,
      background: `${color}14`, border: `1px solid ${color}40`,
      fontSize: 11, fontWeight: 600, color,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      <AlertTriangle size={10} /> {label}
    </span>
  )
}

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
    catch (e: any) { setErr(studentMessage(e)) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={label}>Subject</label>
          <select style={inp} value={subject} onChange={e => setSubject(e.target.value)}>
            {subjectLabels({ board: (getProfile() as any)?.board, cls: (getProfile() as any)?.cls, general: true }).map(s => <option key={s}>{s}</option>)}
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
      <ErrorNote error={err} />
      <button className="kyno-ghost" onClick={run} disabled={loading} style={btn(!loading)}>
        <ArrowRight size={13} /> {loading ? 'Improving…' : 'Improve Tone'}
      </button>
      {result?.improved && <ResultBox title={`✓ ${tone.charAt(0).toUpperCase() + tone.slice(1)} Version`} text={result.improved} />}
    </div>
  )
}

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
    catch (e: any) { setErr(studentMessage(e)) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={label}>Subject</label>
          <select style={inp} value={subject} onChange={e => setSubject(e.target.value)}>
            {subjectLabels({ board: (getProfile() as any)?.board, cls: (getProfile() as any)?.cls, general: true }).map(s => <option key={s}>{s}</option>)}
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
      {err && <p style={{ color: '#4A2FA8', fontSize: 12, marginBottom: 10 }}>{err}</p>}
      <button className="kyno-ghost" onClick={run} disabled={loading} style={btn(!loading)}>
        <Expand size={13} /> {loading ? 'Expanding…' : `Expand to ${words} words`}
      </button>
      {result?.expanded && <ResultBox title="✓ Expanded Answer" text={result.expanded} color="#A5B4FC" />}
    </div>
  )
}

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
    catch (e: any) { setErr(studentMessage(e)) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ ...card, marginBottom: 16, background: '#1a1a2e', border: '1px solid #7C5CFF30' }}>
        <p style={{ fontSize: 12, color: '#A5B4FC', margin: 0 }}>⭐ This tool rewrites your answer the way a top-scorer would write it — with precise vocabulary, strong structure, and exam keywords.</p>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={label}>Subject</label>
        <select style={{ ...inp, marginBottom: 12 }} value={subject} onChange={e => setSubject(e.target.value)}>
          {subjectLabels({ board: (getProfile() as any)?.board, cls: (getProfile() as any)?.cls, general: true }).map(s => <option key={s}>{s}</option>)}
        </select>
        <label style={label}>Your Current Answer</label>
        <textarea style={{ ...inp, height: 160, resize: 'vertical' }} value={text} onChange={e => setText(e.target.value)} placeholder="Write your current answer — any quality is fine…" />
      </div>
      {err && <p style={{ color: '#4A2FA8', fontSize: 12, marginBottom: 10 }}>{err}</p>}
      <button className="kyno-chunky" onClick={run} disabled={loading} style={{ ...btn(!loading), background: loading ? '#171D2D' : 'linear-gradient(135deg,#A5B4FC,#7C5CFF)' }}>
        <Star size={13} /> {loading ? 'Rewriting…' : 'Make it Topper-Level ✦'}
      </button>
      {result?.rewritten && (
        <div>
          <ResultBox title="✓ Topper-Level Answer" text={result.rewritten} color="#A5B4FC" />
          <div style={{ ...card, marginTop: 10, background: '#0d1117', border: '1px solid #A5B4FC30' }}>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Compare your original and the rewritten version. Study the vocabulary and structure differences — that's what examiners reward.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function PlagiarismTool() {
  const [text, setText]       = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<any>(null)
  const [err, setErr]         = useState('')

  async function run() {
    if (text.length < 50) { setErr('Enter at least 50 characters'); return }
    setLoading(true); setErr(''); setResult(null)
    try { setResult(await post('/writing/plagiarism', { text, school_id: SCHOOL_ID })) }
    catch (e: any) { setErr(studentMessage(e)) }
    finally { setLoading(false) }
  }

  const riskColors: Record<string, string> = { low: '#A5B4FC', medium: '#A5B4FC', high: '#4A2FA8', unknown: '#9CA3AF' }

  return (
    <div>
      <div style={{ ...card, marginBottom: 16, background: '#111827' }}>
        <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>🔍 Checks for signs of copied content, inconsistent writing style, and over-reliance on textbook phrases. Basic AI-based check — not a web crawler.</p>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={label}>Text to Check</label>
        <textarea style={{ ...inp, height: 180, resize: 'vertical' }} value={text} onChange={e => setText(e.target.value)} placeholder="Paste the essay or answer to check…" />
      </div>
      {err && <p style={{ color: '#4A2FA8', fontSize: 12, marginBottom: 10 }}>{err}</p>}
      <button className="kyno-ghost" onClick={run} disabled={loading} style={btn(!loading)}>
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
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>Originality Score</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
                  background: `${riskColors[result.risk_level]}20`, color: riskColors[result.risk_level] }}>
                  {(result.risk_level || 'unknown').toUpperCase()} RISK
                </span>
              </div>
            </div>
            {result.summary && <p style={{ fontSize: 13, color: '#B1B5BA', margin: 0 }}>{result.summary}</p>}
          </div>
          {result.flags?.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Flagged Phrases</div>
              {result.flags.map((f: any, i: number) => (
                <div key={i} style={{ fontSize: 12, color: '#A5B4FC', marginBottom: 8, padding: '8px 12px', background: '#A5B4FC08', borderRadius: 6, borderLeft: '3px solid #A5B4FC' }}>
                  <strong>"{f.phrase}"</strong> — {f.reason}
                </div>
              ))}
            </div>
          )}
          {result.recommendation && (
            <div style={{ ...card, marginTop: 10, borderColor: '#A5B4FC30' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#A5B4FC', marginBottom: 6 }}>RECOMMENDATION</div>
              <p style={{ fontSize: 13, color: '#B1B5BA', margin: 0 }}>{result.recommendation}</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
