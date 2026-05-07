/**
 * AI Mistake Analysis — surfaces patterns from ai_memory.mistakes + weak_topics
 *
 * Sections:
 *  - Top stats (total mistakes, repeat offenders, subjects affected)
 *  - Subject distribution (donut)
 *  - Top recurring mistakes (sorted by hits × |signal|)
 *  - Mistakes over time (last 30 days bar chart)
 *  - Forgotten chapters (high hits but old last_seen)
 *  - "AI Insight" — sends data back to AI, asks for patterns + action plan
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle, TrendingDown, Target, Clock,
  Sparkles, RefreshCw, BookOpen, Activity,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../lib/api'
import { chat } from '../lib/openrouter'

interface MemoryEntry {
  id: string
  type: string
  subject: string | null
  topic: string | null
  content: string | null
  signal: number
  hits: number
  last_seen: string
  created_at: string
}

const card: React.CSSProperties = {
  background: '#111', border: '1px solid #1e1e1e', borderRadius: 14,
}

const SUBJECT_COLORS = ['#6366f1', '#34d399', '#fbbf24', '#f472b6', '#38bdf8', '#fb923c', '#a78bfa', '#f87171']

export default function MistakeAnalysis() {
  const [data, setData]       = useState<{ mistakes: MemoryEntry[]; weak: MemoryEntry[]; all: MemoryEntry[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [insight, setInsight] = useState('')
  const [insightBusy, setInsightBusy] = useState(false)
  const [err, setErr]         = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try { setData(await api('/memory')) }
    catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Combine mistakes + weak topics for analysis
  const struggles = useMemo(() => {
    if (!data) return []
    const seen = new Set<string>()
    const merged: MemoryEntry[] = []
    for (const m of [...data.mistakes, ...data.weak]) {
      if (!seen.has(m.id)) { seen.add(m.id); merged.push(m) }
    }
    return merged
  }, [data])

  // Subject distribution
  const subjectDist = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const m of struggles) {
      const s = m.subject || 'Uncategorized'
      counts[s] = (counts[s] || 0) + m.hits
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([subject, count], i) => ({
        subject,
        count,
        pct:   total > 0 ? (count / total) * 100 : 0,
        color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
      }))
  }, [struggles])

  // Top repeat offenders by urgency = hits × |signal|
  const repeats = useMemo(() => struggles
    .map(m => ({ ...m, urgency: m.hits * Math.abs(m.signal) }))
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, 8), [struggles])

  // Last 30-day bar chart by created_at
  const timeline = useMemo(() => {
    const days: { date: string; count: number }[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      days.push({ date: d.toISOString().slice(0, 10), count: 0 })
    }
    const byDay: Record<string, number> = {}
    for (const m of data?.mistakes || []) {
      const k = m.created_at.slice(0, 10)
      byDay[k] = (byDay[k] || 0) + 1
    }
    return days.map(d => ({ ...d, count: byDay[d.date] || 0 }))
  }, [data])

  const maxCount = Math.max(...timeline.map(d => d.count), 1)

  // Forgotten chapters — high hits + last_seen > 14 days ago
  const forgotten = useMemo(() => {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000
    return struggles
      .filter(m => m.hits >= 2 && new Date(m.last_seen).getTime() < cutoff)
      .slice(0, 6)
  }, [struggles])

  async function generateInsight() {
    if (!data || struggles.length === 0) return
    setInsightBusy(true); setErr('')
    try {
      const summary = struggles.slice(0, 30).map(m =>
        `- ${m.subject || 'General'} | ${m.topic || m.content} | seen ${m.hits}× | signal ${m.signal.toFixed(2)}`
      ).join('\n')

      const reply = await chat({
        messages: [
          { role: 'system', content: `You are an expert AI tutor for Indian school students. Analyze a student's mistake history and produce a tight, actionable report. Use markdown with headings:\n## Patterns I See\n## Root Causes (your best guesses)\n## What to Practice This Week (3-5 specific items, in priority order)\n## A Mantra\nBe direct, warm, and specific. No fluff.` },
          { role: 'user',   content: `Here are the topics I've been struggling with (signal -1 = always wrong, +1 = mastered):\n\n${summary}\n\nGive me your honest analysis and an action plan I can start tonight.` },
        ],
      })
      setInsight(reply)
    } catch (e: any) { setErr(e.message) }
    finally { setInsightBusy(false) }
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1100, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: 'linear-gradient(135deg, #f87171, #fb923c)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 18px rgba(248,113,113,0.35)', flexShrink: 0,
        }}>
          <Activity size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Mistake Analysis</h1>
          <p style={{ fontSize: 13, color: '#52525b', marginTop: 4 }}>
            Where you keep slipping — and what to fix first.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: '8px 14px', borderRadius: 8, border: '1px solid #1e1e1e',
            background: '#161616', color: '#71717a', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
          }}>
          <RefreshCw size={12} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {err && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, fontSize: 12, color: '#f87171' }}>
          {err}
        </div>
      )}

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#52525b' }}>Analyzing your mistakes…</div>
      )}

      {data && struggles.length === 0 && (
        <div style={{ ...card, padding: '60px 32px', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18, margin: '0 auto 18px',
            background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={28} color="#34d399" />
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#fafafa', margin: 0, marginBottom: 8 }}>
            No mistakes tracked yet
          </h3>
          <p style={{ fontSize: 13, color: '#71717a', maxWidth: 460, margin: '0 auto', lineHeight: 1.6 }}>
            Take quizzes, get essays graded, or use the Doubt Solver — Kairo will start tracking patterns and surface them here.
          </p>
        </div>
      )}

      {data && struggles.length > 0 && (
        <>
          {/* Top stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}>
            <Stat icon={AlertTriangle} label="Total mistakes" value={data.mistakes.reduce((s, m) => s + m.hits, 0)} color="#f87171" />
            <Stat icon={Target}        label="Repeat offenders" value={repeats.filter(m => m.hits >= 2).length} color="#fb923c" />
            <Stat icon={BookOpen}      label="Subjects affected" value={subjectDist.length} color="#fbbf24" />
            <Stat icon={Clock}         label="Forgotten" value={forgotten.length} color="#a78bfa" />
          </div>

          {/* AI Insight section */}
          <div style={{ ...card, padding: 22, marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Sparkles size={15} color="#a5b4fc" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>AI Insight</div>
                <div style={{ fontSize: 11, color: '#52525b' }}>Let AI read your mistake history and tell you what to fix first</div>
              </div>
              <button onClick={generateInsight} disabled={insightBusy}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: insightBusy ? '#1c1c1c' : 'linear-gradient(135deg,#6366f1,#7c3aed)',
                  color: insightBusy ? '#52525b' : '#fff',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                  cursor: insightBusy ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                <Sparkles size={12} />{insightBusy ? 'Analyzing…' : insight ? 'Regenerate' : 'Generate Insight'}
              </button>
            </div>
            {insight && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="prose-ai"
                style={{
                  background: '#0d0d0d', border: '1px solid #1e1e2e',
                  borderRadius: 10, padding: 16, fontSize: 13, color: '#e4e4e7', lineHeight: 1.65,
                }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{insight}</ReactMarkdown>
              </motion.div>
            )}
            {!insight && !insightBusy && (
              <p style={{ fontSize: 12, color: '#52525b', fontStyle: 'italic', margin: 0 }}>
                Click "Generate Insight" to get a personalized analysis of your weak areas.
              </p>
            )}
          </div>

          {/* Two-col: Subject distribution + Repeat offenders */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }}>
            {/* Subject distribution */}
            <div style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <BookOpen size={14} color="#fbbf24" />
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>Subject Distribution</div>
              </div>
              {subjectDist.map(s => (
                <div key={s.subject} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#d4d4d8' }}>{s.subject}</span>
                    <span style={{ fontSize: 11, color: '#71717a' }}>
                      {s.count} · {s.pct.toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ height: 8, background: '#0d0d0d', borderRadius: 4, overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${s.pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      style={{ height: '100%', background: s.color }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Repeat offenders */}
            <div style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <TrendingDown size={14} color="#f87171" />
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>Top Recurring Mistakes</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {repeats.slice(0, 7).map((m, i) => (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', background: '#0d0d0d',
                    border: '1px solid #1a1a1a', borderRadius: 7,
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 5,
                      background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: '#f87171', flexShrink: 0,
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12.5, color: '#fafafa', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{m.topic || m.content}</div>
                      <div style={{ fontSize: 10, color: '#52525b', marginTop: 1 }}>
                        {m.subject ? m.subject + ' · ' : ''}{m.hits}× · urgency {m.urgency.toFixed(1)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div style={{ ...card, padding: 18, marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Clock size={14} color="#818cf8" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>Mistakes — Last 30 Days</div>
                <div style={{ fontSize: 11, color: '#52525b' }}>Each bar = mistakes logged that day</div>
              </div>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(30, 1fr)',
              gap: 2, alignItems: 'end', height: 80,
            }}>
              {timeline.map(d => (
                <div key={d.date} title={`${d.date}: ${d.count} mistakes`}
                  style={{
                    height: `${(d.count / maxCount) * 100}%`,
                    minHeight: 2,
                    background: d.count === 0 ? '#1a1a1a'
                      : d.count > maxCount * 0.66 ? '#f87171'
                      : d.count > maxCount * 0.33 ? '#fb923c'
                      : '#fbbf24',
                    borderRadius: 2,
                    transition: 'height 0.3s',
                  }} />
              ))}
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 10, color: '#3f3f46', marginTop: 6,
            }}>
              <span>30 days ago</span>
              <span>today</span>
            </div>
          </div>

          {/* Forgotten chapters */}
          {forgotten.length > 0 && (
            <div style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Clock size={14} color="#a78bfa" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>Forgotten Chapters</div>
                  <div style={{ fontSize: 11, color: '#52525b' }}>You struggled here, then haven't touched it in 2+ weeks</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                {forgotten.map(m => {
                  const days = Math.floor((Date.now() - new Date(m.last_seen).getTime()) / (24 * 60 * 60 * 1000))
                  return (
                    <div key={m.id} style={{
                      padding: '10px 12px', background: 'rgba(167,139,250,0.06)',
                      border: '1px solid rgba(167,139,250,0.2)', borderRadius: 8,
                    }}>
                      <div style={{ fontSize: 12.5, color: '#fafafa', fontWeight: 600, marginBottom: 4 }}>
                        {m.topic || m.content}
                      </div>
                      <div style={{ fontSize: 10, color: '#a78bfa' }}>
                        {m.subject ? m.subject + ' · ' : ''}last seen {days}d ago · seen {m.hits}×
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Stat ─────────────────────────────────────────────────────────────────────
function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={15} color={color} />
        </div>
        <span style={{ fontSize: 11, color: '#71717a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#fafafa', lineHeight: 1 }}>{value}</div>
    </div>
  )
}
