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
import { Network, RefreshCw, Maximize2, Sparkles, Brush, Workflow } from 'lucide-react'
import {
  getConceptGraph, recordConcept,
  type ConceptNode, type ConceptEdge,
} from '../lib/twin'

// ──────────────────────────────────────────────────────────────────────────
// Illustrated view — hand-drawn cloud / doodle style.
//
// The Concept Map can render in two modes:
//   • 'illustrated' (default): paper-notebook look with pastel cloud nodes,
//     curvy doodle arrows, scattered sparkle stars, sticky-note labels.
//     Easier to read at a glance for students; reads like a study sheet.
//   • 'pro': the original force-graph view — every concept + auto-discovered
//     edges, drag-to-rearrange. Power tool, still here.
//
// Mode preference is persisted to localStorage so it sticks across sessions.
// ──────────────────────────────────────────────────────────────────────────
type ViewMode = 'illustrated' | 'pro'

// Pastel palette + accent — same hue across stages so the page reads as
// one coherent design rather than crayon-box random. Each cloud picks
// from this rotation so colours don't repeat back-to-back.
const PASTELS = [
  { fill: '#FFF3B0', edge: '#E0A800', text: '#7A5A00' },  // butter yellow
  { fill: '#C7E0FF', edge: '#6FA8FF', text: '#1A4DBF' },  // sky blue
  { fill: '#D8C8FF', edge: '#8B6BFF', text: '#3F1F9B' },  // lavender
  { fill: '#FFC9D7', edge: '#FF7AA0', text: '#9B1C45' },  // blush pink
  { fill: '#B7E9C5', edge: '#4FBF7A', text: '#1F6B3A' },  // mint green
  { fill: '#FFD7B8', edge: '#FF9248', text: '#9B4A0A' },  // peach
  { fill: '#FFB7B7', edge: '#FF6868', text: '#9B1818' },  // coral
]
const PAPER_BG = '#FCFAF4'   // warm off-white "notebook" background
const PAPER_INK = '#1F2532'  // matte ink for arrows + outlines

const HANDWRITTEN_FONT = "'Caveat', 'Patrick Hand', 'Comic Neue', 'Marker Felt', cursive"

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
  // View mode — illustrated (default) or pro. Persisted per device.
  const [mode, setMode] = useState<ViewMode>(() => {
    try { return (localStorage.getItem('kairo:conceptmap:view') as ViewMode) || 'illustrated' }
    catch { return 'illustrated' }
  })
  // The concept currently shown as the centre of the illustrated map.
  // Defaults to the most-visited concept; user can click any satellite
  // to recentre the map there.
  const [centerId, setCenterId] = useState<string | null>(null)
  useEffect(() => {
    try { localStorage.setItem('kairo:conceptmap:view', mode) } catch { /* ignore */ }
  }, [mode])

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

        <Header
          onRefresh={reload}
          nodeCount={graph.nodes.length}
          edgeCount={graph.edges.length}
          mode={mode}
          setMode={setMode}
        />

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

        {/* The map itself — illustrated or pro */}
        <div className="cm-graph-box" style={{
          marginTop: 22, position: 'relative',
          background: mode === 'illustrated' ? PAPER_BG : C.panel,
          border: `1px solid ${mode === 'illustrated' ? 'rgba(0,0,0,0.06)' : C.border}`,
          borderRadius: 16, overflow: 'hidden',
          minHeight: 'clamp(420px, 70vh, 640px)',
          transition: 'background 0.3s ease',
        }}>
          {graph.nodes.length === 0 ? <Empty /> : mode === 'illustrated' ? (
            <IllustratedMap
              graph={graph}
              centerId={centerId}
              setCenterId={setCenterId}
            />
          ) : (
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

          {/* Legend — Pro view only (mastery is meaningless in the illustrated layout) */}
          {graph.nodes.length > 0 && mode === 'pro' && (
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

          {/* Tip — Pro view only */}
          {mode === 'pro' && (
            <div style={{
              position: 'absolute', bottom: 12, right: 12,
              fontSize: 10.5, color: C.textFaint, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600,
            }}>
              Drag nodes to rearrange  ·  Bigger = more visited
            </div>
          )}
        </div>

        {/* Add concept manually card */}
        <AddConceptCard onSaved={reload} />
      </div>
    </div>
  )
}

function Header({ onRefresh, nodeCount, edgeCount, mode, setMode }: {
  onRefresh: () => void
  nodeCount: number
  edgeCount: number
  mode: ViewMode
  setMode: (m: ViewMode) => void
}) {
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

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* View-mode segmented control — Illustrated ↔ Pro */}
        <div style={{
          display: 'inline-flex', padding: 3,
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10,
        }}>
          <ModeChip
            active={mode === 'illustrated'}
            onClick={() => setMode('illustrated')}
            icon={Brush}
            label="Illustrated"
          />
          <ModeChip
            active={mode === 'pro'}
            onClick={() => setMode('pro')}
            icon={Workflow}
            label="Pro"
          />
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
    </div>
  )
}

function ModeChip({ active, onClick, icon: Icon, label }: {
  active: boolean
  onClick: () => void
  icon: React.ElementType
  label: string
}) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 11px', borderRadius: 7, border: 'none',
      background: active ? 'rgba(79, 124, 255, 0.15)' : 'transparent',
      color: active ? '#A5B4FC' : '#9CA3AF',
      fontFamily: 'inherit', fontWeight: 700, fontSize: 11.5, cursor: 'pointer',
      transition: 'all 0.18s',
    }}>
      <Icon size={12} />
      {label}
    </button>
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

// ══════════════════════════════════════════════════════════════════════════
// ILLUSTRATED CONCEPT MAP
// ══════════════════════════════════════════════════════════════════════════
// Hand-drawn "study sheet" view. Picks the most-visited concept as the centre
// (or user-selected) and shows up to 6 connected concepts as satellites in
// pastel cloud shapes with curvy doodle arrows between them.
//
// Everything is generated at render time from a deterministic hash of each
// concept name so positions, rotations, and cloud shapes stay stable
// between renders — the layout doesn't jitter when the page rebuilds.

const VIEWBOX_W = 1100
const VIEWBOX_H = 600

/** Tiny deterministic pseudo-random keyed off a string. Same name → same number. */
function hash01(s: string, salt = 0): number {
  let h = 0x811c9dc5 ^ salt
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  }
  return ((h >>> 0) % 100000) / 100000
}

interface IllustratedMapProps {
  graph: { nodes: ConceptNode[]; edges: ConceptEdge[] }
  centerId: string | null
  setCenterId: (id: string | null) => void
}

function IllustratedMap({ graph, centerId, setCenterId }: IllustratedMapProps) {
  // ── Pick centre + satellites ────────────────────────────────────────────
  const { center, satellites } = useMemo(() => {
    if (graph.nodes.length === 0) return { center: null, satellites: [] }

    // Centre: explicit selection if it still exists, else most-visited concept.
    let center: ConceptNode | undefined =
      centerId ? graph.nodes.find(n => n.id === centerId) : undefined
    if (!center) {
      center = [...graph.nodes].sort((a, b) => (b.visits ?? 0) - (a.visits ?? 0))[0]
    }

    // Satellites: any concept connected to centre via an edge. If we end up
    // with fewer than 5, fill from same-subject siblings (sorted by visits),
    // then from the global top-visited list. Either way we cap at 6.
    const connected = new Set<string>()
    for (const e of graph.edges) {
      if (e.from === center.id) connected.add(e.to)
      else if (e.to === center.id) connected.add(e.from)
    }
    let sats = graph.nodes
      .filter(n => connected.has(n.id) && n.id !== center!.id)
      .sort((a, b) => (b.visits ?? 0) - (a.visits ?? 0))

    if (sats.length < 5) {
      const sameSubject = graph.nodes
        .filter(n => n.id !== center!.id && n.subject === center!.subject && !sats.some(s => s.id === n.id))
        .sort((a, b) => (b.visits ?? 0) - (a.visits ?? 0))
      sats = [...sats, ...sameSubject]
    }
    if (sats.length < 5) {
      const filler = graph.nodes
        .filter(n => n.id !== center!.id && !sats.some(s => s.id === n.id))
        .sort((a, b) => (b.visits ?? 0) - (a.visits ?? 0))
      sats = [...sats, ...filler]
    }
    return { center, satellites: sats.slice(0, 6) }
  }, [graph, centerId])

  if (!center) return null

  // Layout — satellites in a roomy ellipse around the centre. Slight
  // per-cloud jitter so it doesn't read as a perfect circle.
  const cx = VIEWBOX_W / 2
  const cy = VIEWBOX_H / 2
  const rx = 380
  const ry = 220
  const count = satellites.length || 1

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      minHeight: 'clamp(420px, 70vh, 640px)',
      // Subtle paper texture — radial gradients give a warm hand-made feel
      backgroundImage: `
        radial-gradient(circle at 30% 20%, rgba(252, 230, 200, 0.22) 0%, transparent 40%),
        radial-gradient(circle at 80% 75%, rgba(220, 220, 255, 0.20) 0%, transparent 40%),
        radial-gradient(circle at 10% 90%, rgba(255, 220, 230, 0.18) 0%, transparent 35%)
      `,
    }}>
      {/* Google Font — Caveat — embedded inline so the page works offline-first */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&display=swap');
      `}</style>

      <svg
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', minHeight: 'clamp(420px, 70vh, 640px)' }}
      >
        <defs>
          {/* Hand-drawn arrowhead — used by every doodle arrow */}
          <marker
            id="doodleArrow"
            viewBox="0 0 10 10"
            refX="8" refY="5"
            markerWidth="5" markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 9 5 L 0 10 Z" fill={PAPER_INK} />
          </marker>
        </defs>

        {/* ── Background sparkles (scattered around the canvas) ──────────── */}
        {Array.from({ length: 14 }, (_, i) => {
          const px = 60 + hash01('sparkle-x' + i) * (VIEWBOX_W - 120)
          const py = 40 + hash01('sparkle-y' + i) * (VIEWBOX_H - 80)
          const sz = 6 + hash01('sparkle-s' + i) * 10
          const rot = hash01('sparkle-r' + i) * 360
          return <Sparkle key={i} x={px} y={py} size={sz} rotation={rot} />
        })}

        {/* ── Doodle arrows from centre to each satellite ───────────────── */}
        {satellites.map((sat, i) => {
          const angle = (i / count) * Math.PI * 2 - Math.PI / 2
          const jitter = (hash01(sat.id + 'jit', 7) - 0.5) * 0.4
          const tx = cx + Math.cos(angle + jitter) * rx
          const ty = cy + Math.sin(angle + jitter) * ry
          return (
            <DoodleArrow
              key={'arr-' + sat.id}
              from={{ x: cx, y: cy }}
              to={{ x: tx, y: ty }}
              seed={sat.id}
            />
          )
        })}

        {/* ── Centre cloud ─────────────────────────────────────────────── */}
        <CloudNode
          x={cx} y={cy}
          width={300} height={220}
          fill="#FFF3B0" edge="#E0A800" text="#5A4500"
          title="ILLUSTRATED"
          titleSmall="CONCEPT MAP"
          subtitle={center.name}
          handwritten
          big
          seed={center.id}
          onClick={() => setCenterId(null)}
        />

        {/* ── Satellite clouds ─────────────────────────────────────────── */}
        {satellites.map((sat, i) => {
          const angle  = (i / count) * Math.PI * 2 - Math.PI / 2
          const jitter = (hash01(sat.id + 'jit', 7) - 0.5) * 0.4
          const tx     = cx + Math.cos(angle + jitter) * rx
          const ty     = cy + Math.sin(angle + jitter) * ry
          const pal    = PASTELS[i % PASTELS.length]
          return (
            <g key={sat.id}>
              {/* Numbered badge — sits over the cloud's top-left */}
              <NumberBadge
                x={tx - 110}
                y={ty - 70}
                num={i + 1}
                fill={pal.fill}
                stroke={pal.edge}
              />
              <CloudNode
                x={tx} y={ty}
                width={200} height={130}
                fill={pal.fill} edge={pal.edge} text={pal.text}
                title="A great title"
                subtitle={sat.name}
                seed={sat.id}
                onClick={() => setCenterId(sat.id)}
              />
            </g>
          )
        })}

        {/* ── Sticky "highlighted title" labels — 3 outer tags pinned to
              the canvas edges, chosen from leftover concepts so the
              composition feels populated even with a small graph. ───── */}
        {graph.nodes
          .filter(n => n.id !== center.id && !satellites.some(s => s.id === n.id))
          .slice(0, 3)
          .map((n, i) => {
            const slots = [
              { x: 110, y: 80 },
              { x: VIEWBOX_W - 110, y: 90 },
              { x: VIEWBOX_W - 130, y: VIEWBOX_H - 80 },
            ]
            const s = slots[i]
            return (
              <StickyTag
                key={'tag-' + n.id}
                x={s.x}
                y={s.y}
                label={n.name}
                fill={PASTELS[(i + 3) % PASTELS.length].fill}
                edge={PASTELS[(i + 3) % PASTELS.length].edge}
              />
            )
          })}
      </svg>

      {/* Hint card overlay — desktop only, bottom-left */}
      <div style={{
        position: 'absolute', bottom: 14, left: 16,
        fontFamily: HANDWRITTEN_FONT,
        fontSize: 18, color: '#5A4500', fontWeight: 700,
        background: 'rgba(255, 248, 220, 0.78)',
        padding: '6px 12px',
        borderRadius: 14,
        border: '1.5px solid rgba(224, 168, 0, 0.4)',
        transform: 'rotate(-2deg)',
      }}>
        ✨ Click any cloud to recentre the map
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Cloud node — hand-drawn-feeling blob with title + subtitle inside
// ──────────────────────────────────────────────────────────────────────────
interface CloudNodeProps {
  x: number; y: number
  width: number; height: number
  fill: string; edge: string; text: string
  title: string
  titleSmall?: string
  subtitle: string
  big?: boolean
  handwritten?: boolean
  seed: string
  onClick?: () => void
}
function CloudNode({
  x, y, width, height, fill, edge, text,
  title, titleSmall, subtitle, big, handwritten, seed, onClick,
}: CloudNodeProps) {
  // Slight rotation per cloud — pulled from a stable hash so it doesn't jitter
  const tilt = (hash01(seed + 'tilt', 13) - 0.5) * 6
  const path = useMemo(() => cloudPath(width, height, seed), [width, height, seed])

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${tilt})`}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      {/* The cloud silhouette — fill + a slightly-offset double stroke for hand-drawn feel */}
      <path d={path} fill={fill} stroke={edge} strokeWidth={2.5} strokeLinejoin="round" />
      <path d={path} fill="none" stroke={edge} strokeWidth={1} strokeLinejoin="round" opacity={0.5}
        transform="translate(1.5, 1.5)" />

      {/* Inside text — handwritten or sans depending on cloud */}
      {handwritten ? (
        <>
          <text
            textAnchor="middle"
            y={titleSmall ? -8 : 0}
            fontFamily={HANDWRITTEN_FONT}
            fontSize={big ? 38 : 22}
            fontWeight={700}
            fill={text}
          >
            {title}
          </text>
          {titleSmall && (
            <text
              textAnchor="middle"
              y={26}
              fontFamily={HANDWRITTEN_FONT}
              fontSize={big ? 32 : 18}
              fontWeight={700}
              fill={text}
            >
              {titleSmall}
            </text>
          )}
          <text
            textAnchor="middle"
            y={big ? 64 : 42}
            fontFamily="'Inter', sans-serif"
            fontSize={11}
            fontWeight={500}
            fill={text}
            opacity={0.85}
            style={{ textTransform: 'capitalize' }}
          >
            {clip(subtitle, 26)}
          </text>
        </>
      ) : (
        <>
          <text
            textAnchor="middle"
            y={-12}
            fontFamily={HANDWRITTEN_FONT}
            fontSize={22}
            fontWeight={700}
            fill={text}
          >
            {title}
          </text>
          <text
            textAnchor="middle"
            y={12}
            fontFamily="'Inter', sans-serif"
            fontSize={11.5}
            fontWeight={600}
            fill={text}
            style={{ textTransform: 'capitalize' }}
          >
            {clip(subtitle, 26)}
          </text>
          <text
            textAnchor="middle"
            y={32}
            fontFamily="'Inter', sans-serif"
            fontSize={9.5}
            fontWeight={500}
            fill={text}
            opacity={0.7}
          >
            Click to focus →
          </text>
        </>
      )}
    </g>
  )
}

function clip(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

/**
 * Build a cloud silhouette path centred on (0, 0) within the given bounding box.
 * Uses 7 sinusoidal "bumps" around an ellipse so each cloud has its own profile
 * but stays visually balanced.
 */
function cloudPath(width: number, height: number, seed: string): string {
  const bumps = 7
  const rx = width / 2 * 0.95
  const ry = height / 2 * 0.85
  const variance = 0.18    // 0 = ellipse, higher = bumpier
  const pts: { x: number; y: number; cx: number; cy: number }[] = []
  for (let i = 0; i < bumps; i++) {
    const a = (i / bumps) * Math.PI * 2 - Math.PI / 2
    // Per-bump radius offset — stable per seed.
    const off = (hash01(seed + 'bump' + i, 31) - 0.5) * 2 * variance
    const r1 = 1 + off
    const x = Math.cos(a) * rx * r1
    const y = Math.sin(a) * ry * r1
    // Control point for the bump bulge — pushes outward between vertices.
    const aMid = a + Math.PI / bumps
    const bulge = 1 + 0.18 + (hash01(seed + 'mid' + i, 41) - 0.5) * 0.1
    pts.push({
      x, y,
      cx: Math.cos(aMid) * rx * bulge,
      cy: Math.sin(aMid) * ry * bulge,
    })
  }
  // Build the SVG path — Q (quadratic) for each bump gives the rounded cloud feel.
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
  for (let i = 0; i < bumps; i++) {
    const cur  = pts[i]
    const next = pts[(i + 1) % bumps]
    d += ` Q ${cur.cx.toFixed(2)} ${cur.cy.toFixed(2)} ${next.x.toFixed(2)} ${next.y.toFixed(2)}`
  }
  d += ' Z'
  return d
}

// ──────────────────────────────────────────────────────────────────────────
// Doodle arrow — curvy bezier with marker tip
// ──────────────────────────────────────────────────────────────────────────
function DoodleArrow({
  from, to, seed,
}: { from: { x: number; y: number }; to: { x: number; y: number }; seed: string }) {
  // Shrink ends so the arrow doesn't poke through the cloud interiors.
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.sqrt(dx * dx + dy * dy)
  const ux = dx / len
  const uy = dy / len
  const startInset = 110
  const endInset   = 105
  const sx = from.x + ux * startInset
  const sy = from.y + uy * startInset
  const ex = to.x   - ux * endInset
  const ey = to.y   - uy * endInset

  // Control point — perpendicular jog, seeded.
  const mx = (sx + ex) / 2
  const my = (sy + ey) / 2
  const perpX = -uy
  const perpY =  ux
  const curveAmt = 30 + hash01(seed + 'curve', 51) * 60
  const dir = hash01(seed + 'dir', 53) > 0.5 ? 1 : -1
  const cpx = mx + perpX * curveAmt * dir
  const cpy = my + perpY * curveAmt * dir

  return (
    <path
      d={`M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cpx.toFixed(1)} ${cpy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`}
      fill="none"
      stroke={PAPER_INK}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeDasharray="0"
      markerEnd="url(#doodleArrow)"
      opacity={0.78}
    />
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Numbered badge — small coloured circle with a digit, like the reference
// ──────────────────────────────────────────────────────────────────────────
function NumberBadge({ x, y, num, fill, stroke }: { x: number; y: number; num: number; fill: string; stroke: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle r={18} fill={fill} stroke={stroke} strokeWidth={2.2} />
      <text textAnchor="middle" dominantBaseline="central"
        fontFamily="'Inter', sans-serif" fontSize={14} fontWeight={800} fill={stroke}>
        {num}
      </text>
    </g>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Sticky tag — tiny rotated label pinned to the canvas edge
// ──────────────────────────────────────────────────────────────────────────
function StickyTag({ x, y, label, fill, edge }: { x: number; y: number; label: string; fill: string; edge: string }) {
  const tilt = (hash01(label + 'tilt', 17) - 0.5) * 12
  const w = 130
  const h = 44
  return (
    <g transform={`translate(${x}, ${y}) rotate(${tilt})`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={20}
        fill={fill} stroke={edge} strokeWidth={1.8} />
      <text textAnchor="middle" dominantBaseline="central"
        fontFamily={HANDWRITTEN_FONT} fontSize={16} fontWeight={700} fill={PAPER_INK}>
        {clip(label, 18)}
      </text>
    </g>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Sparkle — 4-point doodle star
// ──────────────────────────────────────────────────────────────────────────
function Sparkle({ x, y, size, rotation }: { x: number; y: number; size: number; rotation: number }) {
  // 4-pointed sparkle: two crossed teardrop shapes
  const r = size
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rotation})`} opacity={0.55}>
      <path
        d={`M 0 ${-r} Q ${r * 0.18} 0 0 ${r} Q ${-r * 0.18} 0 0 ${-r} Z`}
        fill={PAPER_INK}
      />
      <path
        d={`M ${-r} 0 Q 0 ${r * 0.18} ${r} 0 Q 0 ${-r * 0.18} ${-r} 0 Z`}
        fill={PAPER_INK}
      />
    </g>
  )
}
