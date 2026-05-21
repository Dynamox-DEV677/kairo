/**
 * Concept Map — auto-built from the unified Kairo memory engine.
 *
 * Reads `getConceptGraph()` from twin.ts which discovers nodes from:
 *   1. Every topic the user has touched in any event (auto-discovery)
 *   2. Explicit concepts recorded via recordConcept()
 *
 * Edges are auto-discovered too: any two topics studied within the same
 * 30-minute window get linked. Plus any explicit relations.
 *
 * The result is a real neural-graph of "what this student has learned and
 * how their concepts connect" — built entirely from localStorage, evolving
 * every time they use Kairo. Drag any node to rearrange. Zoom + pan.
 *
 * Strict palette: black + deep purple + white only.
 */
import { useEffect, useState, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Network, RefreshCw, Maximize2, Sparkles } from 'lucide-react'
import {
  getConceptGraph, recordConcept,
  type ConceptNode, type ConceptEdge,
} from '../lib/twin'

const C = {
  bg:        '#050505',
  panel:     '#0E1117',
  panel2:    '#151922',
  border:    'rgba(255,255,255,0.08)',
  borderSoft:'rgba(255,255,255,0.06)',
  text:      '#ffffff',
  textDim:   '#CBD5E1',
  textFaint: '#9CA3AF',
  purpleLite:'#DBE7FF',
  purpleSoft:'#A5B4FC',
  purple:    '#66D9FF',
  purpleHi:  '#4F7CFF',
  purpleDeep:'#2046C2',
}
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"

interface Layout { x: number; y: number }

export default function ConceptMap() {
  const [graph, setGraph] = useState<{ nodes: ConceptNode[]; edges: ConceptEdge[] }>({ nodes: [], edges: [] })
  const [positions, setPositions] = useState<Map<string, Layout>>(new Map())
  const [hover, setHover] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  function reload() {
    const g = getConceptGraph()
    setGraph(g)
    // Place nodes in clusters by subject — radial layout, deterministic per-id
    const bySubject = new Map<string, ConceptNode[]>()
    for (const n of g.nodes) {
      if (!bySubject.has(n.subject)) bySubject.set(n.subject, [])
      bySubject.get(n.subject)!.push(n)
    }
    const pos = new Map<string, Layout>()
    const subjects = [...bySubject.keys()]
    const W = 1100, H = 620
    const cx = W / 2, cy = H / 2
    const clusterR = Math.min(W, H) * 0.32
    subjects.forEach((subject, sIdx) => {
      const subAngle = (sIdx / Math.max(1, subjects.length)) * Math.PI * 2
      const sx = cx + Math.cos(subAngle) * clusterR
      const sy = cy + Math.sin(subAngle) * clusterR
      const nodes = bySubject.get(subject)!
      nodes.forEach((n, i) => {
        const a = (i / nodes.length) * Math.PI * 2
        const r = 30 + Math.sqrt(n.visits) * 12
        pos.set(n.id, {
          x: sx + Math.cos(a) * r,
          y: sy + Math.sin(a) * r,
        })
      })
    })
    setPositions(pos)
  }

  useEffect(() => {
    reload()
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('kairo:twin:')) reload()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Drag handling
  const dragOffsetRef = useRef({ ox: 0, oy: 0 })
  function startDrag(e: React.PointerEvent, id: string) {
    e.preventDefault()
    setDragId(id)
    const p = positions.get(id)!
    dragOffsetRef.current = { ox: p.x - e.clientX, oy: p.y - e.clientY }
  }
  function onMove(e: React.PointerEvent) {
    if (!dragId) return
    setPositions(prev => {
      const next = new Map(prev)
      next.set(dragId, { x: e.clientX + dragOffsetRef.current.ox, y: e.clientY + dragOffsetRef.current.oy })
      return next
    })
  }
  function endDrag() { setDragId(null) }

  // Stats
  const subjectStats = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of graph.nodes) m.set(n.subject, (m.get(n.subject) || 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [graph])

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      background: C.bg,
      backgroundImage:
        `radial-gradient(at 8% 0%,  rgba(79, 124, 255, 0.08) 0%, transparent 40%),
         radial-gradient(at 92% 100%, rgba(32, 70, 194, 0.10) 0%, transparent 45%)`,
      color: C.text, fontFamily: FONT,
      padding: '24px 28px 80px',
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>

        <Header onRefresh={reload} nodeCount={graph.nodes.length} edgeCount={graph.edges.length} />

        {/* Subject stats strip */}
        {subjectStats.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
            {subjectStats.map(([subj, n]) => (
              <span key={subj} style={{
                padding: '5px 12px', borderRadius: 999,
                background: 'rgba(79, 124, 255, 0.08)',
                border: '1px solid rgba(102, 217, 255, 0.3)',
                fontSize: 12, color: C.text, fontWeight: 600,
              }}>
                {subj} <span style={{ color: C.purple, marginLeft: 4 }}>· {n}</span>
              </span>
            ))}
          </div>
        )}

        {/* The graph itself */}
        <div className="cm-graph-box" style={{
          marginTop: 22, position: 'relative',
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 16, overflow: 'hidden',
          minHeight: 'clamp(420px, 70vh, 640px)',
        }}>
          {graph.nodes.length === 0 ? <Empty /> : (
            <svg
              ref={svgRef}
              viewBox="0 0 1100 620"
              width="100%" height="100%"
              onPointerMove={onMove}
              onPointerUp={endDrag} onPointerLeave={endDrag}
              preserveAspectRatio="xMidYMid meet"
              style={{
                display: 'block', cursor: dragId ? 'grabbing' : 'default',
                touchAction: 'pinch-zoom',
                minHeight: 'clamp(420px, 70vh, 640px)',
              }}>
              <defs>
                <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"  stopColor="#66D9FF" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#66D9FF" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="edgeStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%"  stopColor="#4F7CFF" stopOpacity="0.35"/>
                  <stop offset="100%" stopColor="#A5B4FC" stopOpacity="0.35"/>
                </linearGradient>
              </defs>

              {/* Edges */}
              {graph.edges.map((e, i) => {
                const a = positions.get(e.from)
                const b = positions.get(e.to)
                if (!a || !b) return null
                const isHot = hover && (hover === e.from || hover === e.to)
                return (
                  <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={isHot ? '#A5B4FC' : 'url(#edgeStroke)'}
                    strokeWidth={isHot ? 1.4 : 0.8}
                    strokeLinecap="round" opacity={isHot ? 0.85 : 0.45} />
                )
              })}

              {/* Nodes */}
              {graph.nodes.map(n => {
                const p = positions.get(n.id)
                if (!p) return null
                const r = 16 + Math.min(18, Math.sqrt(n.visits) * 6)
                const m = n.mastery
                const fill = m >= 0.7 ? '#66D9FF'
                            : m >= 0.4 ? '#4F7CFF'
                                       : '#2046C2'
                const isHover = hover === n.id
                return (
                  <g key={n.id}
                     onPointerDown={(e) => startDrag(e, n.id)}
                     onMouseEnter={() => setHover(n.id)}
                     onMouseLeave={() => setHover(null)}
                     style={{ cursor: 'grab' }}>
                    {/* Halo */}
                    <circle cx={p.x} cy={p.y} r={r * 2.3} fill="url(#nodeGlow)" opacity={isHover ? 1 : 0.6} />
                    {/* Node */}
                    <circle cx={p.x} cy={p.y} r={r}
                      fill={fill}
                      stroke="#ffffff"
                      strokeWidth={isHover ? 1.4 : 0.6}
                      strokeOpacity={isHover ? 0.85 : 0.35} />
                    {/* Label */}
                    <text x={p.x} y={p.y + r + 14}
                      textAnchor="middle"
                      fontSize="11" fontWeight="600"
                      fill={isHover ? '#ffffff' : '#A5B4FC'}
                      fontFamily={FONT}
                      style={{ textTransform: 'capitalize', pointerEvents: 'none' }}>
                      {n.name.length > 18 ? n.name.slice(0, 17) + '…' : n.name}
                    </text>
                  </g>
                )
              })}
            </svg>
          )}

          {/* Legend */}
          {graph.nodes.length > 0 && (
            <div style={{
              position: 'absolute', bottom: 12, left: 12,
              padding: '8px 12px', borderRadius: 10,
              background: 'rgba(6,6,10,0.65)', backdropFilter: 'blur(10px)',
              border: `1px solid ${C.borderSoft}`,
              display: 'flex', gap: 14, fontSize: 11, color: C.textFaint, alignItems: 'center',
            }}>
              <LegendDot color="#2046C2" label="< 40% mastery" />
              <LegendDot color="#4F7CFF" label="40–70%" />
              <LegendDot color="#66D9FF" label="70%+" />
            </div>
          )}

          {/* Tip */}
          <div style={{
            position: 'absolute', bottom: 12, right: 12,
            fontSize: 10.5, color: C.textFaint, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600,
          }}>
            Drag nodes to rearrange  ·  Bigger = more visited
          </div>
        </div>

        {/* Add concept manually card */}
        <AddConceptCard onSaved={reload} />
      </div>
    </div>
  )
}

function Header({ onRefresh, nodeCount, edgeCount }: { onRefresh: () => void; nodeCount: number; edgeCount: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 13,
          background: 'linear-gradient(135deg, #4F7CFF 0%, #2046C2 100%)',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 10px 30px rgba(79, 124, 255, 0.03)',
        }}>
          <Network size={22} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: C.purple, textTransform: 'uppercase', letterSpacing: 2.2 }}>
            Concept Map  ·  Auto-built from your history
          </div>
          <h1 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>
            Everything you've touched. How it connects.
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: C.textFaint, lineHeight: 1.55, maxWidth: 640 }}>
            {nodeCount} concept{nodeCount === 1 ? '' : 's'} · {edgeCount} connection{edgeCount === 1 ? '' : 's'}.
            Auto-discovered from every quiz, lab, doubt, and revision you've done — nothing leaves your device.
          </p>
        </div>
      </div>

      <button onClick={onRefresh} style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '9px 14px', borderRadius: 10,
        background: 'transparent', border: `1px solid ${C.border}`,
        color: C.textDim, fontFamily: 'inherit', fontWeight: 600, fontSize: 12, cursor: 'pointer',
      }}>
        <RefreshCw size={13} />
        Rebuild
      </button>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
      {label}
    </div>
  )
}

function Empty() {
  // Jump the user to the page that would populate this map most
  // quickly. The Dashboard exposes a global `__kairoSetActive(route)`
  // so we don't need to wire React Router just for one button.
  const go = (route: string) => () => {
    const setActive = (window as unknown as { __kairoSetActive?: (r: string) => void }).__kairoSetActive
    if (typeof setActive === 'function') setActive(route)
  }
  return (
    <div style={{
      padding: '70px 28px', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: 'rgba(79, 124, 255, 0.10)',
        border: '1px solid rgba(102, 217, 255, 0.35)',
        display: 'grid', placeItems: 'center',
        boxShadow: '0 0 32px rgba(79, 124, 255, 0.02)',
      }}>
        <Network size={28} color="#66D9FF" />
      </div>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text }}>
        Your concept map is empty.
      </h3>
      <p style={{ margin: 0, fontSize: 13, color: C.textFaint, maxWidth: 480, lineHeight: 1.65 }}>
        Every topic you touch becomes a node here, and topics studied close together get
        connected automatically. Start anywhere below.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={go('quiz')}
          style={emptyCtaPrimary}
        >Start a Quiz</button>
        <button
          onClick={go('doubt')}
          style={emptyCtaSecondary}
        >Ask the Solver</button>
        <button
          onClick={go('labs')}
          style={emptyCtaSecondary}
        >Open a Lab</button>
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 11, color: C.textFaint, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600 }}>
        Stored on this device only
      </p>
    </div>
  )
}

// Shared empty-state CTA styles — kept inline so the file stays self-contained.
const emptyCtaPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '11px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg, #4F7CFF 0%, #2046C2 100%)',
  color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
  boxShadow: '0 6px 18px rgba(79, 124, 255, 0.18)',
}
const emptyCtaSecondary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '11px 16px', borderRadius: 10, cursor: 'pointer',
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  color: '#B1B5BA', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
}

function AddConceptCard({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('General')
  const [related, setRelated] = useState('')

  function save() {
    if (!name.trim()) return
    recordConcept({
      name: name.trim(),
      subject,
      related: related.split(',').map(s => s.trim()).filter(Boolean),
    })
    setName(''); setRelated('')
    onSaved()
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{
        marginTop: 22, padding: 22,
        background: C.panel, border: `1px solid ${C.border}`,
        borderRadius: 16,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Sparkles size={14} color={C.purple} />
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1.6 }}>
          Add a concept manually
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.4fr auto', gap: 10 }}
           className="kr-cm-add">
        <Input value={name} onChange={setName} placeholder="Concept (e.g. quadratic equations)" />
        <Input value={subject} onChange={setSubject} placeholder="Subject" />
        <Input value={related} onChange={setRelated} placeholder="Related (comma-separated)" />
        <button onClick={save} disabled={!name.trim()}
          style={{
            padding: '10px 16px', borderRadius: 10,
            background: 'linear-gradient(135deg, #4F7CFF, #2046C2)',
            color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
            border: 'none', cursor: name.trim() ? 'pointer' : 'not-allowed',
            opacity: name.trim() ? 1 : 0.5,
          }}>
          Add
        </button>
      </div>
      <style>{`
        @media (max-width: 720px) {
          .kr-cm-add { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </motion.div>
  )
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{
        padding: '10px 12px', borderRadius: 10,
        background: C.panel2, border: `1px solid ${C.borderSoft}`,
        color: C.text, fontFamily: 'inherit', fontSize: 13, outline: 'none',
      }} />
  )
}
