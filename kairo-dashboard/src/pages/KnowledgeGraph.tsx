import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Share2, MessageCircle, BookOpen, Network, Activity,
  FunctionSquare, Layers, Calendar, RefreshCw,
} from 'lucide-react'
import { getStudyHistory, type HistoryEntry } from '../lib/twin'

const C = {
  bg:        '#0A0D16',
  panel:     '#141A2A',
  panel2:    '#1C2233',
  border:    'rgba(255,255,255,0.08)',
  borderSoft:'rgba(255,255,255,0.06)',
  text:      '#ffffff',
  textDim:   '#CBD5E1',
  textFaint: '#9CA3AF',
  textVery:  '#6B7280',
  purpleSoft:'#A5B4FC',
  purple:    '#A5B4FC',
  purpleHi:  '#7C6BF6',
  purpleDeep:'#4A2FA8',
}
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"

const KIND_META: Record<HistoryEntry['kind'], { icon: any; label: string }> = {
  event:     { icon: Activity,       label: 'Activity' },
  doubt:     { icon: MessageCircle,  label: 'Doubt'    },
  concept:   { icon: Network,        label: 'Concept'  },
  formula:   { icon: FunctionSquare, label: 'Formula'  },
  flashcard: { icon: Layers,         label: 'Card'     },
}

export default function KnowledgeGraph() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [kindFilter, setKindFilter] = useState<HistoryEntry['kind'] | 'all'>('all')

  function reload() { setEntries(getStudyHistory(200)) }
  useEffect(() => {
    reload()
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('kairo:twin:')) reload()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const filtered = useMemo(
    () => kindFilter === 'all' ? entries : entries.filter(e => e.kind === kindFilter),
    [entries, kindFilter],
  )

  const groups = useMemo(() => {
    const m = new Map<string, HistoryEntry[]>()
    for (const e of filtered) {
      const d = new Date(e.ts); d.setHours(0,0,0,0)
      const k = d.toISOString().slice(0, 10)
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(e)
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const subjectSummary = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of entries) {
      const s = e.subject || 'General'
      m.set(s, (m.get(s) || 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [entries])

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      background: C.bg,
      backgroundImage:
        `radial-gradient(at 8% 0%,  rgba(124, 107, 246, 0.08) 0%, transparent 40%),
         radial-gradient(at 92% 100%, rgba(74, 47, 168, 0.10) 0%, transparent 45%)`,
      color: C.text, fontFamily: FONT, padding: '24px 28px 80px',
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 13, flexShrink: 0,
              background: 'linear-gradient(135deg, #7C6BF6 0%, #4A2FA8 100%)',
              display: 'grid', placeItems: 'center',
              boxShadow: '0 10px 30px rgba(124, 107, 246, 0.03)',
            }}>
              <Share2 size={22} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: C.purple, textTransform: 'uppercase', letterSpacing: 2.2 }}>
                Knowledge Graph  ·  Your learning timeline
              </div>
              <h1 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>
                Everything you've learned. When and how.
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: C.textFaint, lineHeight: 1.55, maxWidth: 640 }}>
                {entries.length} event{entries.length === 1 ? '' : 's'} pulled from your unified Kyno memory. Doubts, quizzes, labs, concepts, formulas, cards — all your activity, chronologically.
              </p>
            </div>
          </div>

          <button onClick={reload} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '9px 14px', borderRadius: 10,
            background: 'transparent', border: `1px solid ${C.border}`,
            color: C.textDim, fontFamily: 'inherit', fontWeight: 600, fontSize: 12, cursor: 'pointer',
          }}>
            <RefreshCw size={13} />
            Rebuild
          </button>
        </div>

        {subjectSummary.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
            {subjectSummary.map(([subj, n]) => (
              <span key={subj} style={{
                padding: '5px 12px', borderRadius: 999,
                background: 'rgba(124, 107, 246, 0.08)',
                border: '1px solid rgba(165, 180, 252, 0.3)',
                fontSize: 12, color: C.text, fontWeight: 600,
              }}>
                {subj} <span style={{ color: C.purple, marginLeft: 4 }}>· {n}</span>
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 18, flexWrap: 'wrap' }}>
          <FilterChip active={kindFilter === 'all'} label={`All ${entries.length}`} onClick={() => setKindFilter('all')} />
          {(['doubt', 'event', 'concept', 'formula', 'flashcard'] as const).map(k => {
            const n = entries.filter(e => e.kind === k).length
            if (n === 0) return null
            const Icon = KIND_META[k].icon
            return (
              <FilterChip key={k} active={kindFilter === k}
                label={<><Icon size={11} /> {KIND_META[k].label} {n}</>}
                onClick={() => setKindFilter(k)} />
            )
          })}
        </div>

        <div style={{ marginTop: 26 }}>
          {groups.length === 0 && <EmptyState />}
          {groups.map(([day, items], gi) => (
            <DayGroup key={day} day={day} items={items} index={gi} />
          ))}
        </div>
      </div>
    </div>
  )
}

function FilterChip({ active, label, onClick }: { active: boolean; label: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '6px 12px', borderRadius: 8,
      background: active ? 'rgba(165, 180, 252, 0.20)' : 'transparent',
      border: `1px solid ${active ? 'rgba(165, 180, 252, 0.18)' : C.borderSoft}`,
      color: active ? C.text : C.textFaint,
      fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
      cursor: 'pointer',
    }}>
      {label}
    </button>
  )
}

function DayGroup({ day, items, index }: { day: string; items: HistoryEntry[]; index: number }) {
  const d = new Date(day + 'T00:00:00')
  const today = new Date(); today.setHours(0,0,0,0)
  const yesterday = new Date(today.getTime() - 86_400_000)
  const isToday     = d.getTime() === today.getTime()
  const isYesterday = d.getTime() === yesterday.getTime()
  const label = isToday ? 'Today' : isYesterday ? 'Yesterday'
                : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: today.getFullYear() === d.getFullYear() ? undefined : 'numeric' })

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.5 }}
      style={{ marginBottom: 28, position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 14, paddingBottom: 10,
        borderBottom: `1px solid ${C.borderSoft}`,
      }}>
        <Calendar size={14} color={C.purple} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: -0.1 }}>{label}</span>
        <span style={{ fontSize: 11, color: C.textFaint, marginLeft: 'auto' }}>
          {items.length} entr{items.length === 1 ? 'y' : 'ies'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((e, i) => <TimelineRow key={i} entry={e} />)}
      </div>
    </motion.div>
  )
}

function TimelineRow({ entry }: { entry: HistoryEntry }) {
  const meta = KIND_META[entry.kind]
  const Icon = meta.icon
  const time = new Date(entry.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })

  const hue = entry.kind === 'doubt'   ? C.purple
            : entry.kind === 'concept' ? C.purpleSoft
            : entry.kind === 'formula' ? C.purpleHi
            : entry.kind === 'flashcard'? C.purpleSoft
                                        : C.purple

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', borderRadius: 11,
      background: C.panel,
      border: `1px solid ${C.borderSoft}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        background: `${hue}1c`, border: `1px solid ${hue}55`,
        display: 'grid', placeItems: 'center',
      }}>
        <Icon size={14} color={hue} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: C.text, fontWeight: 600, lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textTransform: entry.kind === 'concept' || entry.topic ? 'capitalize' : 'none',
        }}>
          {entry.title}
        </div>
        <div style={{ fontSize: 11, color: C.textFaint, marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: hue, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
            {meta.label}
          </span>
          {entry.subject && <span>· {entry.subject}</span>}
          {entry.meta?.score != null && (
            <span>· score <strong style={{ color: C.text }}>{Math.round(entry.meta.score)}%</strong></span>
          )}
          {typeof entry.meta?.correct === 'boolean' && (
            <span style={{ color: entry.meta.correct ? C.purpleSoft : C.purpleDeep }}>
              · {entry.meta.correct ? 'correct' : 'wrong'}
            </span>
          )}
        </div>
      </div>
      <span style={{ fontSize: 11, color: C.textFaint, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {time}
      </span>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{
      padding: '60px 24px', textAlign: 'center',
      background: C.panel, border: `1px dashed ${C.border}`,
      borderRadius: 14,
    }}>
      <Share2 size={32} color={C.purple} style={{ opacity: 0.55 }} />
      <h3 style={{ margin: '14px 0 6px', fontSize: 16, fontWeight: 700, color: C.text }}>
        Your timeline is empty.
      </h3>
      <p style={{ margin: 0, fontSize: 13, color: C.textFaint, maxWidth: 460, marginInline: 'auto', lineHeight: 1.6 }}>
        Ask the Solver, take a quiz, open a lab — every action becomes a row here automatically.
      </p>
    </div>
  )
}
