import { useMemo, useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Map as MapIcon, X, Play } from 'lucide-react'
import { loadState, getProfile, getDashboard } from '../lib/twin'
import { graphForProfile } from '../lib/syllabusFor'
import { nodeStates, coverage, subjectOfNode, type GraphNode, type NodeState } from '../lib/syllabusGraph.core'
import { rankNodes, reasonFor } from '../lib/syllabusRank.core'

/**
 * The Syllabus Map (brief part D-1): the WHOLE syllabus as a grid, one cell
 * per chapter, coloured by state. The untouched region visible at a glance
 * IS the product. Composition only — every number comes from the pure cores
 * (syllabusGraph/syllabusRank); no scheduling logic lives here.
 */

const C = {
  panel: '#141A2A', border: 'rgba(255,255,255,0.08)',
  text: '#fafafa', dim: '#B1B5BA', faint: '#9CA3AF', purple: '#A5B4FC',
}

const STATE_STYLE: Record<NodeState['state'], { bg: string; border: string; label: string }> = {
  UNTOUCHED: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.14)', label: 'never opened' },
  SEEN:      { bg: 'rgba(109,174,245,0.16)', border: 'rgba(109,174,245,0.45)', label: 'read, not tested' },
  PRACTISED: { bg: 'rgba(255,176,32,0.16)',  border: 'rgba(255,176,32,0.5)',   label: 'started' },
  SOLID:     { bg: 'rgba(52,211,153,0.18)',  border: 'rgba(52,211,153,0.55)',  label: 'solid' },
  FADING:    { bg: 'rgba(255,122,144,0.16)', border: 'rgba(255,122,144,0.5)',  label: 'fading' },
}

export default function SyllabusMap() {
  const [tick, setTick] = useState(0)
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null)
  const [open, setOpen] = useState<GraphNode | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // stay-mounted staleness rule: recompute when shown again
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) setTick(t => t + 1) })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const graph = useMemo(() => { try { return graphForProfile(getProfile() as any) } catch { return null } }, [tick])

  const { states, cov, ranked } = useMemo(() => {
    if (!graph) return { states: null, cov: null, ranked: [] }
    try {
      const st = nodeStates(graph, { events: loadState().events, mastery: getDashboard().mastery })
      return { states: st, cov: coverage(graph, st), ranked: rankNodes(graph, st, { max: 3 }) }
    } catch { return { states: null, cov: null, ranked: [] } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, tick])

  if (!graph) return null // no map for this board/class yet — say nothing false

  const bigUntouched = (cov?.untouched || []).filter(c => (c.typical_marks ?? 0) >= 6)
  const bigMarks = Math.round(bigUntouched.reduce((s, c) => s + (c.typical_marks ?? 0), 0))
  const go = (view: string) => { try { (window as any).__kairoSetActive?.(view) } catch {} }

  const cells = graph.chapters.filter(c =>
    !subjectFilter || subjectOfNode(graph, c)?.id === subjectFilter)

  return (
    <div ref={rootRef} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <MapIcon size={15} color={C.purple} />
        <span style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>Syllabus map · {graph.label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: C.faint }}>{cov?.pct}% touched of {cov?.total} chapters</span>
      </div>

      {/* the headline the brief specifies — plain, and it stings */}
      {cov && cov.untouched.length > 0 ? (
        <div style={{ fontSize: 12.5, color: C.dim, marginBottom: 14, lineHeight: 1.55 }}>
          You have never opened <b style={{ color: C.text }}>{cov.untouched.length} chapter{cov.untouched.length === 1 ? '' : 's'}</b>
          {bigUntouched.length > 0 && <> — {bigUntouched.length} of them worth <b style={{ color: C.text }}>{bigMarks} marks</b></>}.
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: '#34D399', marginBottom: 14 }}>Every chapter touched — now it's about keeping them solid.</div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className={`kyno-chip${subjectFilter === null ? ' on' : ''}`} onClick={() => setSubjectFilter(null)} style={{ padding: '5px 12px', fontSize: 11 }}>All</button>
        {graph.subjects.map(s => (
          <button key={s.id} className={`kyno-chip${subjectFilter === s.id ? ' on' : ''}`} onClick={() => setSubjectFilter(s.id)} style={{ padding: '5px 12px', fontSize: 11 }}>{s.name}</button>
        ))}
      </div>

      {/* the grid — one cell per chapter */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 7 }}>
        {cells.map(c => {
          const st = states?.get(c.id)
          const sty = STATE_STYLE[st?.state || 'UNTOUCHED']
          return (
            <button key={c.id} onClick={() => setOpen(open?.id === c.id ? null : c)}
              title={`${c.name} — ${sty.label}`}
              style={{
                padding: '9px 10px', borderRadius: 9, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                background: sty.bg, border: `1.5px solid ${open?.id === c.id ? C.purple : sty.border}`,
                minHeight: 52,
              }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: C.text, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{c.name}</div>
              <div style={{ fontSize: 9, color: C.faint, marginTop: 3 }}>{Math.round(c.typical_marks ?? 0)}m · {sty.label}</div>
            </button>
          )
        })}
      </div>

      {/* legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
        {Object.entries(STATE_STYLE).map(([k, v]) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9.5, color: C.faint }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: v.bg, border: `1px solid ${v.border}` }} />{v.label}
          </span>
        ))}
      </div>

      {/* tapped chapter detail */}
      {open && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{open.name}</div>
              <div style={{ fontSize: 11.5, color: C.dim, marginTop: 3 }}>
                {reasonFor(open, states?.get(open.id))} · ~{Math.round((open.est_study_minutes || 0) / 60)}h first pass
              </div>
              {(open.topics || []).length > 0 && (
                <div style={{ fontSize: 10.5, color: C.faint, marginTop: 6 }}>{(open.topics || []).join(' · ')}</div>
              )}
            </div>
            <button onClick={() => setOpen(null)} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', flexShrink: 0 }}><X size={14} /></button>
          </div>
          <button className="kyno-chunky" onClick={() => go('quiz')}
            style={{ marginTop: 10, padding: '8px 16px', borderRadius: 10, border: 'none', background: '#7C5CFF', color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <Play size={11} style={{ verticalAlign: -1, marginRight: 6 }} />Start a session on this
          </button>
        </motion.div>
      )}

      {/* the top three moves, stated with reasons */}
      {ranked.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${C.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, textTransform: 'uppercase', color: C.faint, marginBottom: 8 }}>Best marks-per-minute right now</div>
          {ranked.map(r => (
            <div key={r.node.id} style={{ fontSize: 11.5, color: C.dim, padding: '3px 0' }}>
              <b style={{ color: C.text }}>{r.node.name}</b> — {r.reason}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
