import { useMemo, useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Landmark, CheckCircle2, XCircle, Play, RotateCcw, ArrowRight } from 'lucide-react'
import { PrimaryButton } from '../components/PrimaryButton'
import ReportQuestion from '../components/ReportQuestion'
import { loadState, track } from '../lib/twin'
import {
  museumEntries, drillDeck, rotatedOptions, museumStats,
  type MuseumEntry,
} from '../lib/museum.core'

/**
 * The Mistake Museum — every wrong answer auto-filed into one re-testable
 * wall. Cards re-drill in place; two consecutive rights retire a card to
 * "Fixed" (computed from the same event log, so drilling here updates the
 * museum with no second store). Old misses recorded before Kyno kept full
 * question text appear as honest topic rows, never reconstructed cards.
 */

const C = {
  bg: '#0A0D16', panel: '#141A2A', border: 'rgba(255,255,255,0.08)',
  text: '#fafafa', dim: '#B1B5BA', faint: '#9CA3AF',
  purple: '#A5B4FC', green: '#34D399', amber: '#FFB020', red: '#FF7A90', blue: '#6DAEF5',
}
const card: React.CSSProperties = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }

const WHY_LABEL: Record<string, { label: string; color: string }> = {
  careless: { label: 'likely careless — fast on an easy one', color: C.amber },
  concept:  { label: 'likely a concept gap', color: C.purple },
  timing:   { label: 'likely time pressure', color: C.blue },
}

type Filter = 'all' | 'fixed' | 'careless' | 'concept' | 'timing' | `s:${string}`

export default function MistakeMuseum() {
  const [tick, setTick] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')
  const [drill, setDrill] = useState<MuseumEntry[] | null>(null)

  // Pages stay mounted (display:none) across tab switches, so a mount-time
  // memo goes stale: an exam miss filed elsewhere would not appear on revisit.
  // Recompute whenever this page actually becomes visible again.
  const rootRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) setTick(t => t + 1)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const { entries, legacy } = useMemo(() => {
    // loadState().events is the FULL event log (twin caps it itself) — the
    // dashboard snapshot only keeps the last 30, which would forget misses.
    try { return museumEntries(loadState().events) }
    catch { return { entries: [], legacy: [] } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const stats = useMemo(() => museumStats(entries), [entries])
  const open = entries.filter(e => !e.fixed)
  const fixed = entries.filter(e => e.fixed)

  const shown = useMemo(() => {
    if (filter === 'all') return open
    if (filter === 'fixed') return fixed
    if (filter.startsWith('s:')) return open.filter(e => (e.subject || 'General') === filter.slice(2))
    return open.filter(e => e.why === filter)
  }, [filter, entries]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (view: string) => { try { (window as any).__kairoSetActive?.(view) } catch {} }

  if (drill) {
    return <DrillMode deck={drill} onDone={() => { setDrill(null); setTick(t => t + 1) }} />
  }

  return (
    <div ref={rootRef} style={{ width: '100%', height: '100%', overflowY: 'auto', background: C.bg, padding: '24px 20px 80px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: 'linear-gradient(135deg, #A5B4FC 0%, #7C5CFF 60%, #0B1530 100%)', display: 'grid', placeItems: 'center' }}>
            <Landmark size={22} color="#000" strokeWidth={2.4} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: -0.4 }}>Mistake Museum</h1>
            <div style={{ fontSize: 12, color: C.faint }}>Every miss, filed automatically. Beat a card twice in a row and it retires.</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, margin: '14px 0', flexWrap: 'wrap' }}>
          <Chip on={filter === 'all'} onClick={() => setFilter('all')}>All open · {stats.open}</Chip>
          {Object.entries(stats.bySubject).map(([s, n]) => (
            <Chip key={s} on={filter === `s:${s}`} onClick={() => setFilter(`s:${s}` as Filter)}>{s} · {n}</Chip>
          ))}
          {(['careless', 'concept', 'timing'] as const).filter(w => stats.byWhy[w] > 0).map(w => (
            <Chip key={w} on={filter === w} onClick={() => setFilter(w)}>{w} · {stats.byWhy[w]}</Chip>
          ))}
          <Chip on={filter === 'fixed'} onClick={() => setFilter('fixed')}>✓ Fixed · {stats.fixed}</Chip>
        </div>

        {open.length > 0 && filter !== 'fixed' && (
          <div style={{ marginBottom: 16 }}>
            <PrimaryButton onClick={() => setDrill(drillDeck(shown.length ? shown : open))}>
              <Play size={13} /> Drill {filter === 'all' ? `my ${Math.min(20, open.length)} misses` : `these ${Math.min(20, shown.length)}`}
            </PrimaryButton>
          </div>
        )}

        {entries.length === 0 && legacy.length === 0 && (
          <div style={{ ...card, textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 14, color: C.dim, marginBottom: 6 }}>Nothing in the museum yet.</div>
            <div style={{ fontSize: 12, color: C.faint, marginBottom: 16 }}>Take a quiz — any miss files itself here with the full question, ready to re-beat.</div>
            <PrimaryButton variant="secondary" onClick={() => go('quiz')}>Take a quiz <ArrowRight size={13} /></PrimaryButton>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map(e => <EntryCard key={e.id} e={e} />)}
        </div>

        {filter === 'all' && legacy.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: C.faint, marginBottom: 10 }}>
              Older misses <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>· from before Kyno kept full questions — re-drill by topic</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {legacy.map(g => (
                <div key={`${g.subject}|${g.topic}`} style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px' }}>
                  <span style={{ fontSize: 12.5, color: C.dim, flex: 1, minWidth: 0 }}>
                    <b style={{ color: C.text }}>{g.topic}</b>{g.subject ? ` · ${g.subject}` : ''} — {g.count} miss{g.count === 1 ? '' : 'es'}
                  </span>
                  <button className="kyno-ghost" onClick={() => go('quiz')}
                    style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', background: 'transparent', color: C.purple, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700 }}>
                    Drill topic
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`kyno-chip${on ? ' on' : ''}`} style={{ padding: '7px 13px', fontSize: 11.5 }}>
      {children}
    </button>
  )
}

function EntryCard({ e }: { e: MuseumEntry }) {
  const why = WHY_LABEL[e.why] || WHY_LABEL.concept
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={card}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, lineHeight: 1.5, marginBottom: 8 }}>{e.question}</div>
      {e.options && e.chosenIndex != null && e.correctIndex != null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {e.chosenIndex !== e.correctIndex && (
            <span style={{ display: 'flex', gap: 7, alignItems: 'baseline', fontSize: 12, color: C.red }}>
              <XCircle size={12} style={{ flexShrink: 0, alignSelf: 'center' }} /> you: {e.options[e.chosenIndex]}
            </span>
          )}
          <span style={{ display: 'flex', gap: 7, alignItems: 'baseline', fontSize: 12, color: C.green }}>
            <CheckCircle2 size={12} style={{ flexShrink: 0, alignSelf: 'center' }} /> {e.options[e.correctIndex]}
          </span>
        </div>
      )}
      {e.explanation && <div style={{ fontSize: 11.5, color: C.dim, lineHeight: 1.55, marginBottom: 8 }}>{e.explanation}</div>}
      {e.options && e.correctIndex != null && (
        <ReportQuestion question={e.question} options={e.options} claimed={e.options[e.correctIndex]} source="museum" style={{ marginTop: 0, marginBottom: 8 }} />
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10.5, color: why.color, fontWeight: 600 }}>{e.fixed ? '✓ fixed — beaten twice in a row' : why.label}</span>
        <span style={{ fontSize: 10.5, color: C.faint }}>
          {(e.subject || 'General')}{e.topic ? ` · ${e.topic}` : ''} · missed {e.misses}×{!e.fixed && e.correctStreak > 0 ? ` · ${e.correctStreak}/2 to retire` : ''}
        </span>
      </div>
    </motion.div>
  )
}

/** In-place drill over the museum's own cards. Answers are tracked like any
 *  quiz answer (with payload), so retirement happens with no extra store. */
function DrillMode({ deck, onDone }: { deck: MuseumEntry[]; onDone: () => void }) {
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [right, setRight] = useState(0)
  const shownAt = useRef(Date.now())

  const entry = deck[idx]
  const rot = useMemo(() => entry ? rotatedOptions(entry) : { options: [], correctIndex: -1 }, [entry])

  if (!entry) return null

  function pick(i: number) {
    if (picked != null) return
    setPicked(i)
    const correct = i === rot.correctIndex
    if (correct) setRight(r => r + 1)
    try {
      track({
        type: 'quiz_answered',
        subject: entry.subject || undefined,
        topic: entry.topic || undefined,
        correct,
        score: correct ? 100 : 0,
        durationMs: Date.now() - shownAt.current,
        modality: 'repetition',
        payload: correct
          ? { q: entry.question }
          : { q: entry.question, options: entry.options, correctIndex: entry.correctIndex, chosenIndex: entry.options!.indexOf(rot.options[i]), explanation: entry.explanation || undefined },
      })
    } catch {}
  }

  function next() {
    if (idx + 1 >= deck.length) { onDone(); return }
    setIdx(i => i + 1); setPicked(null); shownAt.current = Date.now()
  }

  const done = idx + 1 >= deck.length && picked != null

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: C.bg, padding: '24px 20px 80px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: C.faint }}>Re-beating miss {idx + 1} of {deck.length}</span>
          <span style={{ fontSize: 12, color: C.purple, fontWeight: 700 }}>{right} beaten</span>
        </div>
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, lineHeight: 1.55, marginBottom: 14 }}>{entry.question}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rot.options.map((opt, i) => {
              const revealed = picked != null
              const isRight = i === rot.correctIndex
              const isPick = i === picked
              return (
                <button key={i} onClick={() => pick(i)}
                  style={{
                    padding: '12px 14px', borderRadius: 10, textAlign: 'left', fontFamily: 'inherit', fontSize: 13,
                    cursor: revealed ? 'default' : 'pointer', color: '#e4e4e7',
                    background: revealed && isRight ? 'rgba(52,211,153,0.12)' : revealed && isPick ? 'rgba(255,122,144,0.10)' : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${revealed && isRight ? 'rgba(52,211,153,0.5)' : revealed && isPick ? 'rgba(255,122,144,0.45)' : 'rgba(255,255,255,0.08)'}`,
                  }}>
                  {opt}
                </button>
              )
            })}
          </div>
          {picked != null && entry.explanation && (
            <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 9, background: '#0d1117', border: `1px solid ${C.border}`, fontSize: 12, color: C.dim, lineHeight: 1.55 }}>
              {entry.explanation}
            </div>
          )}
          {picked != null && (
            <div style={{ marginTop: 14 }}>
              <PrimaryButton full onClick={done ? onDone : next}>
                {done ? <>Back to the museum <RotateCcw size={13} /></> : <>Next <ArrowRight size={13} /></>}
              </PrimaryButton>
            </div>
          )}
        </div>
        <div style={{ fontSize: 10.5, color: C.faint, marginTop: 12, textAlign: 'center' }}>
          Options are rotated so "it was B" can't save you. Beat a card twice in a row and it retires to Fixed.
        </div>
      </div>
    </div>
  )
}

