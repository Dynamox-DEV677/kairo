/**
 * Adaptive Learning Engine — generates a personalized next-step learning path
 * from your AI Memory: weak topics, recent mistakes, mastered areas, plus
 * an AI-curated "next 3 actions" plan tied to specific Kairo features.
 */
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Compass, Sparkles, Target, RefreshCw, TrendingUp, AlertTriangle,
  ArrowRight, Brain, Zap, BookMarked, MessageCircle, Camera,
} from 'lucide-react'
import { api } from '../lib/api'
import { chat } from '../lib/openrouter'

interface MemEntry {
  id: string; type: string; subject: string | null; topic: string | null
  content: string | null; signal: number; hits: number; last_seen: string
}

interface MemData {
  total: number
  weak: MemEntry[]
  strong: MemEntry[]
  improved: MemEntry[]
  mistakes: MemEntry[]
}

interface Action {
  step:    number
  title:   string
  why:     string
  feature: 'doubt' | 'flashcards' | 'simulator' | 'camera' | 'memory' | 'study-plan'
  topic?:  string
  est_min: number
}

const FEATURE_META: Record<Action['feature'], { label: string; icon: any; color: string; route: string }> = {
  'doubt':       { label: "Ask in Kairo's Solver",   icon: MessageCircle, color: '#a78bfa', route: 'doubt' },
  'flashcards':  { label: 'Generate Flashcards',     icon: BookMarked,    color: '#c4b5fd', route: 'flashcards' },
  'simulator':   { label: 'Run Revision Simulator',  icon: Zap,           color: '#c4b5fd', route: 'simulator' },
  'camera':      { label: 'Snap a Textbook Photo',   icon: Camera,        color: '#c4b5fd', route: 'camera' },
  'memory':      { label: 'Review AI Memory',        icon: Brain,         color: '#a78bfa', route: 'memory' },
  'study-plan':  { label: 'Re-build Study Plan',     icon: Compass,       color: '#c4b5fd', route: 'study-plan' },
}

const card: React.CSSProperties = { background: '#111', border: '1px solid #1e1e1e', borderRadius: 14 }

export default function AdaptivePath() {
  const [mem, setMem]         = useState<MemData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actions, setActions] = useState<Action[] | null>(null)
  const [busy, setBusy]       = useState(false)
  const [err, setErr]         = useState('')
  const [thoughts, setThoughts] = useState('')

  const loadMem = useCallback(async () => {
    setLoading(true); setErr('')
    try { setMem(await api('/memory')) }
    catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { loadMem() }, [loadMem])

  // Difficulty signal: avg signal across weak topics + count of repeat mistakes
  const stats = (() => {
    if (!mem) return null
    const weakAvg = mem.weak.length
      ? mem.weak.reduce((s, m) => s + m.signal, 0) / mem.weak.length
      : 0
    const strongAvg = mem.strong.length
      ? mem.strong.reduce((s, m) => s + m.signal, 0) / mem.strong.length
      : 0
    const repeatHits = mem.mistakes.filter(m => m.hits >= 2).length
    return {
      weakCount:   mem.weak.length,
      strongCount: mem.strong.length,
      improvedCount: mem.improved.length,
      weakAvg, strongAvg, repeatHits,
      // Difficulty hint from memory (gauges how challenged the student is)
      difficulty: weakAvg < -0.5 ? 'hard' : weakAvg < -0.2 ? 'medium' : 'easy',
    }
  })()

  async function generate() {
    if (!mem) return
    setBusy(true); setErr(''); setActions(null); setThoughts('')

    const memSummary = [
      mem.weak.slice(0, 6).map(m => `WEAK: ${m.topic} (${m.subject || '—'}, hits ${m.hits}, signal ${m.signal.toFixed(2)})`),
      mem.improved.slice(0, 4).map(m => `IMPROVED: ${m.topic} (signal ${m.signal.toFixed(2)})`),
      mem.strong.slice(0, 3).map(m => `STRONG: ${m.topic} (signal ${m.signal.toFixed(2)})`),
    ].flat().join('\n')

    const userMsg = mem.total === 0
      ? `I'm a new student. Suggest 3 actions to bootstrap learning across general school subjects.`
      : `Here's my AI Memory:\n${memSummary}\n\nGive me my next 3 actions in priority order. Tie each to one Kairo feature.`

    try {
      const reply = await chat({
        messages: [
          { role: 'system', content: `You are Kairo's adaptive learning coach. Pick the 3 highest-leverage next steps for this student.

The available Kairo features and when to recommend each:
- "doubt"        : conceptual questions, math problems, "I don't understand X"
- "flashcards"   : memorization, definitions, formulas, vocabulary
- "simulator"    : timed exam practice on weak topics (only recommend if student has weak topics)
- "camera"       : student has a textbook page or homework sheet to scan
- "memory"       : student should reflect on patterns
- "study-plan"   : student needs schedule restructuring

Return ONLY a JSON object in this exact shape:
{
  "thoughts": "1-2 sentences summarizing what you noticed about this student",
  "actions": [
    {"step": 1, "title": "...", "why": "...", "feature": "simulator", "topic": "Quadratic equations", "est_min": 25}
  ]
}

3 actions. Each title under 60 chars. "why" under 120 chars. est_min realistic. NO markdown, NO prose outside the JSON.` },
          { role: 'user', content: userMsg },
        ],
      })

      // Strip code fences and extract JSON
      const cleaned = reply
        .replace(/<\/?think(?:ing)?>[\s\S]*?<\/?think(?:ing)?>/gi, '')
        .replace(/```(?:json)?\s*/gi, '')
        .replace(/```/g, '')
        .trim()

      let parsed: { thoughts: string; actions: Action[] } | null = null
      try { parsed = JSON.parse(cleaned) } catch { /* fall through */ }
      if (!parsed) {
        const m = cleaned.match(/\{[\s\S]*\}/)
        if (m) try { parsed = JSON.parse(m[0]) } catch { /* still null */ }
      }
      if (!parsed?.actions?.length) throw new Error('AI returned no plan. Try again.')

      setThoughts(parsed.thoughts || '')
      setActions(parsed.actions.slice(0, 3))
    } catch (e: any) { setErr(e.message) }
    finally { setBusy(false) }
  }

  function jump(action: Action) {
    const route = FEATURE_META[action.feature]?.route
    if (!route) return
    if (action.feature === 'doubt' && action.topic) {
      // Pre-fill the doubt
      window.dispatchEvent(new CustomEvent('kairo:load-chat', { detail: { id: 'new' } }))
      setTimeout(() => {
        // Stuff the topic into the chat textarea via a focus event hint
        const ta = document.querySelector('textarea') as HTMLTextAreaElement | null
        if (ta) {
          ta.value = `Help me with: ${action.topic}`
          ta.dispatchEvent(new Event('input', { bubbles: true }))
          ta.focus()
        }
      }, 300)
    }
    // Trigger sidebar navigation
    const setActiveFn = (window as any).__kairoSetActive
    if (typeof setActiveFn === 'function') setActiveFn(route)
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1000, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: 'linear-gradient(135deg, #7c3aed, #38bdf8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 18px rgba(124, 58, 237,0.4)', flexShrink: 0,
        }}>
          <Compass size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Adaptive Path</h1>
          <p style={{ fontSize: 13, color: '#52525b', marginTop: 4 }}>
            AI reads your memory and tells you exactly what to do next.
          </p>
        </div>
        <button onClick={loadMem} disabled={loading}
          style={{
            padding: '8px 12px', borderRadius: 8, border: '1px solid #1e1e1e',
            background: '#161616', color: '#71717a', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
          }}>
          <RefreshCw size={12} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
        </button>
      </div>

      {err && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(167, 139, 250,0.08)', border: '1px solid rgba(167, 139, 250,0.25)', borderRadius: 8, fontSize: 12, color: '#a78bfa' }}>
          {err}
        </div>
      )}

      {/* Memory snapshot */}
      {stats && (
        <div style={{ ...card, padding: 18, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Brain size={14} color="#c4b5fd" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>Memory Snapshot</div>
              <div style={{ fontSize: 11, color: '#52525b' }}>
                Difficulty signal: {' '}
                <span style={{
                  color: stats.difficulty === 'hard' ? '#a78bfa'
                    : stats.difficulty === 'medium' ? '#c4b5fd' : '#c4b5fd',
                  fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
                }}>{stats.difficulty}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <Tile icon={AlertTriangle} label="Weak topics" value={stats.weakCount} color="#c4b5fd" />
            <Tile icon={Target}        label="Repeat mistakes" value={stats.repeatHits} color="#a78bfa" />
            <Tile icon={TrendingUp}    label="Improved" value={stats.improvedCount} color="#c4b5fd" />
            <Tile icon={Sparkles}      label="Strong" value={stats.strongCount} color="#a78bfa" />
          </div>
        </div>
      )}

      {/* Generate button or actions */}
      {!actions && (
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={generate} disabled={busy || !mem}
          style={{
            width: '100%', padding: '14px', borderRadius: 11, border: 'none',
            background: busy || !mem ? '#1c1c1c' : 'linear-gradient(135deg, #7c3aed, #38bdf8)',
            color: busy || !mem ? '#52525b' : '#fff',
            fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
            cursor: busy || !mem ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: busy || !mem ? 'none' : '0 0 22px rgba(124, 58, 237,0.35)',
          }}>
          <Sparkles size={15} />{busy ? 'Reading your memory…' : 'Generate My Adaptive Path'}
        </motion.button>
      )}

      {/* Plan output */}
      <AnimatePresence>
        {actions && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {thoughts && (
              <div style={{
                ...card, padding: 16, marginBottom: 14,
                background: 'rgba(124, 58, 237,0.04)', border: '1px solid rgba(124, 58, 237,0.2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Sparkles size={14} color="#c4b5fd" style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: 13, color: '#e4e4e7', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
                    {thoughts}
                  </p>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {actions.map((a, i) => {
                const meta = FEATURE_META[a.feature] || FEATURE_META.doubt
                const Icon = meta.icon
                return (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    whileHover={{ x: 3 }}
                    onClick={() => jump(a)}
                    style={{
                      ...card, padding: 18, cursor: 'pointer',
                      borderColor: `${meta.color}40`,
                      borderLeft: `3px solid ${meta.color}`,
                      display: 'flex', alignItems: 'flex-start', gap: 14,
                      transition: 'all 0.15s',
                    }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: `${meta.color}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, position: 'relative',
                    }}>
                      <Icon size={17} color={meta.color} />
                      <div style={{
                        position: 'absolute', top: -6, right: -6,
                        width: 18, height: 18, borderRadius: 5,
                        background: meta.color, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 800,
                      }}>{a.step}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', margin: 0 }}>
                          {a.title}
                        </h3>
                        <span style={{ fontSize: 10, color: '#52525b' }}>~{a.est_min} min</span>
                      </div>
                      <p style={{ fontSize: 12.5, color: '#a1a1aa', margin: 0, marginBottom: 8, lineHeight: 1.5 }}>
                        {a.why}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 10.5, color: meta.color, fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: 0.8,
                        }}>{meta.label}</span>
                        {a.topic && (
                          <span style={{ fontSize: 11, color: '#71717a' }}>· {a.topic}</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight size={16} color={meta.color} style={{ flexShrink: 0, opacity: 0.7 }} />
                  </motion.div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={generate} disabled={busy} style={{
                padding: '8px 16px', borderRadius: 8,
                border: '1px solid rgba(124, 58, 237,0.3)',
                background: 'rgba(124, 58, 237,0.08)', color: '#c4b5fd',
                cursor: busy ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <RefreshCw size={12} style={{ animation: busy ? 'spin 0.8s linear infinite' : 'none' }} />
                Re-generate Path
              </button>
              <p style={{ fontSize: 11, color: '#52525b', alignSelf: 'center', margin: 0 }}>
                Click any step to jump to that feature.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Tile({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div style={{
      padding: 12, background: '#0d0d0d',
      border: `1px solid ${color}30`, borderRadius: 9,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <Icon size={11} color={color} />
        <span style={{ fontSize: 9.5, color: '#71717a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#fafafa', lineHeight: 1 }}>{value}</div>
    </div>
  )
}
