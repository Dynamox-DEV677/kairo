/**
 * AI Memory Brain — what Kairo remembers about you
 *
 * Shows:
 *  - Weak Areas (signal < -0.2)
 *  - Recently Improved (signal > 0.3 + multiple hits)
 *  - Strong Areas (signal > 0.3)
 *  - Recommended Revision (top 5 weakest by hits × |signal|)
 *
 * Student can forget individual entries or wipe everything.
 */
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, AlertTriangle, TrendingUp, Sparkles, X,
  Trash2, RefreshCw, Target, Award,
} from 'lucide-react'
import { api } from '../lib/api'
import { getMistakes, dumpState, clearTwin } from '../lib/twin'

interface MemoryEntry {
  id:        string
  type:      'mistake' | 'weak_topic' | 'strong_topic' | 'preference' | 'note'
  subject:   string | null
  topic:     string | null
  content:   string | null
  signal:    number
  hits:      number
  last_seen: string
  created_at: string
}

interface MemoryData {
  total:    number
  weak:     MemoryEntry[]
  strong:   MemoryEntry[]
  mistakes: MemoryEntry[]
  improved: MemoryEntry[]
  preferences: MemoryEntry[]
  all:      MemoryEntry[]
}

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(14px) saturate(140%)', WebkitBackdropFilter: 'blur(14px) saturate(140%)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14,
}

export default function MemoryBrain() {
  const [data, setData]       = useState<MemoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')
  const [busy, setBusy]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    // localStorage-first — read from twin instead of /api/memory.
    // The DB cleanup deleted the `memory` table; the twin is now the
    // canonical store for everything Kairo "remembers" about the user.
    try {
      const state    = dumpState()
      const mistakes = getMistakes()

      // Map mastery rows + mistakes into the MemoryEntry shape this page expects.
      const all: MemoryEntry[] = []
      for (const m of state.mastery) {
        const signal = (m.mastery - 0.5) * 2          // 0..1 → -1..+1
        all.push({
          id:        `mastery-${m.subject}-${m.topic}`,
          type:      signal < -0.2 ? 'weak_topic' : signal > 0.3 ? 'strong_topic' : 'note',
          subject:   m.subject,
          topic:     m.topic,
          content:   null,
          signal,
          hits:      m.attempts,
          last_seen: new Date(m.lastStudiedAt).toISOString(),
          created_at: new Date(m.lastStudiedAt).toISOString(),
        })
      }
      for (const mi of mistakes) {
        all.push({
          id:        `mistake-${mi.subject}-${mi.topic}`,
          type:      'mistake',
          subject:   mi.subject,
          topic:     mi.topic,
          content:   null,
          signal:    -Math.min(1, mi.severity + 0.2),
          hits:      mi.count,
          last_seen: new Date(mi.lastAt).toISOString(),
          created_at: new Date(mi.lastAt).toISOString(),
        })
      }

      const weak     = all.filter(e => e.signal < -0.2).sort((a, b) => a.signal - b.signal)
      const strong   = all.filter(e => e.signal > 0.3 ).sort((a, b) => b.signal - a.signal)
      const ms       = all.filter(e => e.type === 'mistake')
      const improved = all.filter(e => e.signal > 0.3 && e.hits > 1)

      setData({
        total:        all.length,
        weak,
        strong,
        mistakes:     ms,
        improved,
        preferences:  [],
        all,
      })
    } catch (e: any) {
      setErr(e.message || 'Failed to read local memory.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function forget(_id: string) {
    // Forgetting a single derived entry is a no-op — the twin keeps the
    // underlying event. Use "Wipe Twin" in KairoOS for full reset.
    alert('Use Kairo OS → Wipe Twin to clear individual entries.')
  }

  async function wipeAll() {
    if (!confirm('Forget everything Kairo has learned about you? This cannot be undone.')) return
    clearTwin()
    await load()
  }

  // Recommended revision — top 5 by (hits × |negative signal|)
  const recommended = (data?.weak || [])
    .map(m => ({ ...m, urgency: m.hits * Math.abs(m.signal) }))
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, 5)

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1100, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: 'linear-gradient(135deg, #4F7CFF, #4F7CFF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(79, 124, 255, 0.04)', flexShrink: 0,
        }}>
          <Brain size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>AI Memory Brain</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            Kairo remembers your weak topics, mistakes, and wins — and personalizes every AI response with this context.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: '8px 14px', borderRadius: 8, border: '1px solid #1f2532',
            background: '#151922', color: '#9CA3AF', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
          }}>
          <RefreshCw size={12} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {err && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(102, 217, 255, 0.08)', border: '1px solid rgba(102, 217, 255, 0.25)', borderRadius: 8, fontSize: 12, color: '#66D9FF' }}>
          {err}
        </div>
      )}

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#6B7280' }}>Loading your memory…</div>
      )}

      {data && (
        <>
          {/* Top stat row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}>
            <Stat icon={Brain}          label="Memories"        value={data.total} color="#4F7CFF" />
            <Stat icon={AlertTriangle}  label="Weak Areas"      value={data.weak.length} color="#A5B4FC" />
            <Stat icon={Target}         label="Mistakes Logged" value={data.mistakes.length} color="#66D9FF" />
            <Stat icon={Award}          label="Strong Areas"    value={data.strong.length} color="#A5B4FC" />
          </div>

          {/* Empty state */}
          {data.total === 0 && (
            <div style={{ ...card, padding: '60px 32px', textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18, margin: '0 auto 18px',
                background: 'rgba(79, 124, 255, 0.1)', border: '1px solid rgba(79, 124, 255, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={28} color="#66D9FF" />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#fafafa', margin: 0, marginBottom: 8 }}>
                Your memory is empty
              </h3>
              <p style={{ fontSize: 13, color: '#9CA3AF', maxWidth: 460, margin: '0 auto', lineHeight: 1.6 }}>
                Take a quiz, ask Kairo's Solver, or get an essay graded —
                Kairo will start tracking what you know and what to practice.
              </p>
            </div>
          )}

          {/* Recommended revision */}
          {recommended.length > 0 && (
            <Section title="Recommended Revision" subtitle="Topics with the most repeated struggles" icon={Target} accent="#A5B4FC">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                {recommended.map(m => (
                  <RecCard key={m.id} m={m} />
                ))}
              </div>
            </Section>
          )}

          {/* Two-col: Weak / Strong */}
          {(data.weak.length > 0 || data.strong.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }}>
              {/* Weak */}
              <Section title="Weak Areas" subtitle="Practice these next" icon={AlertTriangle} accent="#A5B4FC" inline>
                <EntryList
                  items={data.weak} accent="#A5B4FC" empty="No weak areas yet — well done."
                  onForget={forget} busy={busy}
                />
              </Section>
              {/* Strong */}
              <Section title="Strong Areas" subtitle="Topics you've mastered" icon={Award} accent="#A5B4FC" inline>
                <EntryList
                  items={data.strong} accent="#A5B4FC" empty="Take more quizzes to build strengths."
                  onForget={forget} busy={busy}
                />
              </Section>
            </div>
          )}

          {/* Recently Improved */}
          {data.improved.length > 0 && (
            <Section title="Recently Improved" subtitle="Topics where your signal turned positive" icon={TrendingUp} accent="#A5B4FC">
              <EntryList items={data.improved} accent="#A5B4FC" empty="Keep practicing to see improvements." onForget={forget} busy={busy} />
            </Section>
          )}

          {/* Wipe-all bar */}
          {data.total > 0 && (
            <div style={{
              marginTop: 24, padding: '12px 16px', background: 'rgba(102, 217, 255, 0.05)',
              border: '1px solid rgba(102, 217, 255, 0.2)', borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <Trash2 size={14} color="#66D9FF" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fafafa' }}>Forget everything</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                  Reset Kairo's memory of you. Future AI responses won't be personalized until new data is collected.
                </div>
              </div>
              <button onClick={wipeAll} disabled={busy === 'all'} style={{
                padding: '7px 14px', borderRadius: 7,
                border: '1px solid rgba(102, 217, 255, 0.14)',
                background: 'rgba(102, 217, 255, 0.1)', color: '#66D9FF',
                fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                cursor: busy === 'all' ? 'not-allowed' : 'pointer',
              }}>
                {busy === 'all' ? 'Clearing…' : 'Wipe Memory'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────
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
        <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#fafafa', lineHeight: 1 }}>{value}</div>
    </div>
  )
}

function Section({ title, subtitle, icon: Icon, accent, children, inline = false }: {
  title: string; subtitle: string; icon: any; accent: string; children: React.ReactNode; inline?: boolean
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      style={{ ...card, padding: 18, marginBottom: inline ? 0 : 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Icon size={15} color={accent} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>{title}</div>
          <div style={{ fontSize: 11, color: '#6B7280' }}>{subtitle}</div>
        </div>
      </div>
      {children}
    </motion.div>
  )
}

function EntryList({ items, accent, empty, onForget, busy }: {
  items: MemoryEntry[]; accent: string; empty: string;
  onForget: (id: string) => void; busy: string | null
}) {
  if (items.length === 0) {
    return <div style={{ fontSize: 12, color: '#4B5563', fontStyle: 'italic', padding: '8px 0' }}>{empty}</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <AnimatePresence>
        {items.map(m => (
          <motion.div key={m.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              padding: '8px 12px', borderRadius: 7,
              background: '#0E1117', border: '1px solid #1a1f2e',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: '#fafafa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.topic || m.content}
              </div>
              <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2, display: 'flex', gap: 8 }}>
                {m.subject && <span>{m.subject}</span>}
                <span>seen {m.hits}×</span>
                <span style={{ color: m.signal < 0 ? '#A5B4FC' : '#A5B4FC' }}>
                  signal {m.signal.toFixed(2)}
                </span>
              </div>
            </div>
            <button onClick={() => onForget(m.id)} disabled={busy === m.id} title="Forget this"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                color: '#4B5563', display: 'flex',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#66D9FF')}
              onMouseLeave={e => (e.currentTarget.style.color = '#4B5563')}>
              <X size={12} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function RecCard({ m }: { m: MemoryEntry & { urgency: number } }) {
  const intensity = Math.min(1, m.urgency / 3)   // visual hint
  return (
    <motion.div whileHover={{ y: -2 }} style={{
      ...card, padding: 14,
      borderColor: `rgba(165, 180, 252, ${0.2 + intensity * 0.3})`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Target size={12} color="#A5B4FC" />
        <span style={{ fontSize: 10, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1 }}>
          Revisit
        </span>
        {m.subject && <span style={{ fontSize: 10, color: '#6B7280' }}>· {m.subject}</span>}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#fafafa', lineHeight: 1.4, marginBottom: 8 }}>
        {m.topic || m.content}
      </div>
      <div style={{
        height: 4, borderRadius: 2, background: '#1a1f2e', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${intensity * 100}%`,
          background: 'linear-gradient(90deg, #A5B4FC, #A5B4FC)', borderRadius: 2,
        }} />
      </div>
      <div style={{ fontSize: 10, color: '#6B7280', marginTop: 6 }}>
        Wrong {m.hits} time{m.hits !== 1 ? 's' : ''} · urgency {m.urgency.toFixed(1)}
      </div>
    </motion.div>
  )
}
