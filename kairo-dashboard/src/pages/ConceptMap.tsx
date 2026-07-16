import { useEffect, useState, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Network, RefreshCw, Maximize2, Sparkles, Brush, Workflow,
  Lightbulb, Search, Target, Handshake, Settings as SettingsIcon,
  Atom, FlaskConical, Microscope, Calculator, BookOpen, Rocket,
  Landmark, Globe, Brain, Zap,
} from 'lucide-react'
import {
  getConceptGraph, recordConcept,
  type ConceptNode, type ConceptEdge,
} from '../lib/twin'

type ViewMode = 'illustrated' | 'pro'

const MONO = {
  bg:          '#08090C',
  bgPattern:   '#14151B',
  ink:         '#FFFFFF',
  inkDim:      '#9CA3AF',
  inkFaint:    '#4B5563',
  accent:      '#FFFFFF',
}
const HEADLINE_FONT = "'Inter Tight', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"

const C = {
  bg:        '#0A0D16',
  panel:     '#141A2A',
  panel2:    '#1C2233',
  border:    'rgba(255,255,255,0.08)',
  borderSoft:'rgba(255,255,255,0.06)',
  text:      '#ffffff',
  textDim:   '#CBD5E1',
  textFaint: '#9CA3AF',
  purpleLite:'#DBE7FF',
  purpleSoft:'#A5B4FC',
  purple:    '#A5B4FC',
  purpleHi:  '#7C6BF6',
  purpleDeep:'#4A2FA8',
}
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"

interface Layout { x: number; y: number }

export default function ConceptMap() {
  const [graph, setGraph] = useState<{ nodes: ConceptNode[]; edges: ConceptEdge[] }>({ nodes: [], edges: [] })
  const [positions, setPositions] = useState<Map<string, Layout>>(new Map())
  const [hover, setHover] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState({ k: 1, x: 0, y: 0 })
  const [mode, setMode] = useState<ViewMode>(() => {
    try { return (localStorage.getItem('kairo:conceptmap:view') as ViewMode) || 'illustrated' }
    catch { return 'illustrated' }
  })
  const [centerId, setCenterId] = useState<string | null>(null)
  useEffect(() => {
    try { localStorage.setItem('kairo:conceptmap:view', mode) } catch {  }
  }, [mode])

  function reload() {
    const g = getConceptGraph()
    setGraph(g)
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

  const dragOffsetRef = useRef({ ox: 0, oy: 0 })
  const ptrs = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchRef = useRef<{ dist: number; k: number; x: number; y: number; mx: number; my: number } | null>(null)
  const panRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)

  function toViewBox(cx: number, cy: number) {
    const svg = svgRef.current
    const m = svg?.getScreenCTM()
    if (!svg || !m) return { x: cx, y: cy }
    const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy
    const p = pt.matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }
  const toContent = (vbx: number, vby: number) => ({ x: (vbx - view.x) / view.k, y: (vby - view.y) / view.k })

  const clampK = (k: number) => Math.max(0.5, Math.min(4, k))
  function zoomBy(factor: number) {
    setView(v => {
      const k = clampK(v.k * factor)
      const cx = 550, cy = 310
      return { k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) }
    })
  }
  const resetView = () => setView({ k: 1, x: 0, y: 0 })

  function startDrag(e: React.PointerEvent, id: string) {
    e.preventDefault(); e.stopPropagation()
    try { (e.target as Element).setPointerCapture(e.pointerId) } catch {  }
    setDragId(id)
    const vb = toViewBox(e.clientX, e.clientY)
    const c = toContent(vb.x, vb.y)
    const p = positions.get(id)!
    dragOffsetRef.current = { ox: p.x - c.x, oy: p.y - c.y }
  }

  function onSurfaceDown(e: React.PointerEvent) {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()]
      const mid = toViewBox((a.x + b.x) / 2, (a.y + b.y) / 2)
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), k: view.k, x: view.x, y: view.y, mx: mid.x, my: mid.y }
      panRef.current = null
    } else if (ptrs.current.size === 1) {
      panRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }
    }
  }

  function onMove(e: React.PointerEvent) {
    if (ptrs.current.has(e.pointerId)) ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pinchRef.current && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()]
      const pr = pinchRef.current
      const k = clampK(pr.k * (Math.hypot(a.x - b.x, a.y - b.y) / (pr.dist || 1)))
      setView({ k, x: pr.mx - (pr.mx - pr.x) * (k / pr.k), y: pr.my - (pr.my - pr.y) * (k / pr.k) })
      return
    }
    if (dragId) {
      const vb = toViewBox(e.clientX, e.clientY)
      const c = toContent(vb.x, vb.y)
      setPositions(prev => {
        const next = new Map(prev)
        next.set(dragId, { x: c.x + dragOffsetRef.current.ox, y: c.y + dragOffsetRef.current.oy })
        return next
      })
      return
    }
    if (panRef.current) {
      const rect = svgRef.current?.getBoundingClientRect()
      const sx = rect ? 1100 / rect.width : 1
      const sy = rect ? 620 / rect.height : 1
      const pn = panRef.current
      setView(v => ({ ...v, x: pn.vx + (e.clientX - pn.x) * sx, y: pn.vy + (e.clientY - pn.y) * sy }))
    }
  }

  function endDrag(e?: React.PointerEvent) {
    if (e) ptrs.current.delete(e.pointerId); else ptrs.current.clear()
    if (ptrs.current.size < 2) pinchRef.current = null
    if (ptrs.current.size === 0) { panRef.current = null; setDragId(null) }
  }

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
        `radial-gradient(at 8% 0%,  rgba(124, 107, 246, 0.08) 0%, transparent 40%),
         radial-gradient(at 92% 100%, rgba(74, 47, 168, 0.10) 0%, transparent 45%)`,
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

        {subjectStats.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
            {subjectStats.map(([subj, n]) => (
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

        <div className="cm-graph-box" style={{
          marginTop: 22, position: 'relative',
          background: mode === 'illustrated' ? MONO.bg : C.panel,
          border: `1px solid ${mode === 'illustrated' ? 'rgba(255,255,255,0.06)' : C.border}`,
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
              onPointerDown={onSurfaceDown}
              onPointerMove={onMove}
              onPointerUp={endDrag} onPointerLeave={endDrag} onPointerCancel={endDrag}
              preserveAspectRatio="xMidYMid meet"
              style={{
                display: 'block', cursor: dragId ? 'grabbing' : (panRef.current ? 'grabbing' : 'grab'),
                touchAction: 'none',
                minHeight: 'clamp(420px, 70vh, 640px)',
              }}>
              <defs>
                <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"  stopColor="#A5B4FC" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#A5B4FC" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="edgeStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%"  stopColor="#7C6BF6" stopOpacity="0.35"/>
                  <stop offset="100%" stopColor="#A5B4FC" stopOpacity="0.35"/>
                </linearGradient>
              </defs>

              <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>

              {graph.edges.map((e, i) => {
                const a = positions.get(e.from)
                const b = positions.get(e.to)
                if (!a || !b) return null
                const isHot = hover && (hover === e.from || hover === e.to)
                // Gentle perpendicular arc so links read as an organic knowledge web, not a grid.
                const dx = b.x - a.x, dy = b.y - a.y
                const dist = Math.sqrt(dx * dx + dy * dy) || 1
                const bow = Math.min(dist * 0.16, 46)
                const cx = (a.x + b.x) / 2 + (-dy / dist) * bow
                const cy = (a.y + b.y) / 2 + (dx / dist) * bow
                return (
                  <path key={i} d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
                    fill="none"
                    stroke={isHot ? '#A5B4FC' : 'url(#edgeStroke)'}
                    strokeWidth={isHot ? 1.6 : 0.9}
                    strokeLinecap="round" opacity={isHot ? 0.9 : 0.45} />
                )
              })}

              {graph.nodes.map(n => {
                const p = positions.get(n.id)
                if (!p) return null
                const r = 16 + Math.min(18, Math.sqrt(n.visits) * 6)
                const m = n.mastery
                const fill = m >= 0.7 ? '#A5B4FC'
                            : m >= 0.4 ? '#7C6BF6'
                                       : '#4A2FA8'
                const isHover = hover === n.id
                return (
                  <g key={n.id}
                     onPointerDown={(e) => startDrag(e, n.id)}
                     onMouseEnter={() => setHover(n.id)}
                     onMouseLeave={() => setHover(null)}
                     style={{ cursor: 'grab' }}>
                    <circle cx={p.x} cy={p.y} r={r * 2.3} fill="url(#nodeGlow)" opacity={isHover ? 1 : 0.6} />
                    <circle cx={p.x} cy={p.y} r={r}
                      fill={fill}
                      stroke="#ffffff"
                      strokeWidth={isHover ? 1.4 : 0.6}
                      strokeOpacity={isHover ? 0.85 : 0.35} />
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
              </g>
            </svg>
          )}

          {graph.nodes.length > 0 && mode === 'pro' && (
            <div style={{
              position: 'absolute', top: 12, right: 12,
              display: 'flex', flexDirection: 'column', gap: 6, zIndex: 3,
            }}>
              {[
                { label: '+', act: () => zoomBy(1.3), title: 'Zoom in' },
                { label: '−', act: () => zoomBy(1 / 1.3), title: 'Zoom out' },
              ].map(b => (
                <button key={b.label} onClick={b.act} title={b.title} aria-label={b.title}
                  style={{
                    width: 40, height: 40, borderRadius: 11, cursor: 'pointer',
                    background: 'rgba(6,6,10,0.72)', backdropFilter: 'blur(10px)',
                    border: `1px solid ${C.borderSoft}`, color: C.text,
                    fontSize: 22, fontWeight: 700, lineHeight: 1,
                    display: 'grid', placeItems: 'center', fontFamily: FONT,
                  }}>{b.label}</button>
              ))}
              <button onClick={resetView} title="Reset view" aria-label="Reset view"
                style={{
                  width: 40, height: 40, borderRadius: 11, cursor: 'pointer',
                  background: 'rgba(6,6,10,0.72)', backdropFilter: 'blur(10px)',
                  border: `1px solid ${C.borderSoft}`, color: C.textFaint,
                  display: 'grid', placeItems: 'center',
                }}>
                <Maximize2 size={16} />
              </button>
            </div>
          )}

          {graph.nodes.length > 0 && mode === 'pro' && (
            <div style={{
              position: 'absolute', bottom: 12, left: 12,
              padding: '8px 12px', borderRadius: 10,
              background: 'rgba(6,6,10,0.65)', backdropFilter: 'blur(10px)',
              border: `1px solid ${C.borderSoft}`,
              display: 'flex', gap: 14, fontSize: 11, color: C.textFaint, alignItems: 'center',
            }}>
              <LegendDot color="#4A2FA8" label="< 40% mastery" />
              <LegendDot color="#7C6BF6" label="40–70%" />
              <LegendDot color="#A5B4FC" label="70%+" />
            </div>
          )}

          {mode === 'pro' && (
            <div style={{
              position: 'absolute', top: 14, left: 14, maxWidth: 190,
              fontSize: 10, color: C.textFaint, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600, lineHeight: 1.5,
              pointerEvents: 'none',
            }}>
              Pinch or +/− to zoom  ·  drag to pan  ·  drag a node to move it
            </div>
          )}
        </div>

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
          width: 46, height: 46, borderRadius: 13, flexShrink: 0,
          background: 'linear-gradient(135deg, #7C6BF6 0%, #4A2FA8 100%)',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 10px 30px rgba(124, 107, 246, 0.03)',
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

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
      background: active ? 'rgba(124, 107, 246, 0.15)' : 'transparent',
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
        background: 'rgba(124, 107, 246, 0.10)',
        border: '1px solid rgba(165, 180, 252, 0.35)',
        display: 'grid', placeItems: 'center',
        boxShadow: '0 0 32px rgba(124, 107, 246, 0.02)',
      }}>
        <Network size={28} color="#A5B4FC" />
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
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 11, color: C.textFaint, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600 }}>
        Stored on this device only
      </p>
    </div>
  )
}

const emptyCtaPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '11px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg, #7C6BF6 0%, #4A2FA8 100%)',
  color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
  boxShadow: '0 6px 18px rgba(124, 107, 246, 0.18)',
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
            background: 'linear-gradient(135deg, #7C6BF6, #4A2FA8)',
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

const VIEWBOX_W = 1100
const VIEWBOX_H = 600

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

function iconForSubject(subject?: string): React.ElementType {
  const s = (subject || '').toLowerCase()
  if (s.includes('math'))     return Calculator
  if (s.includes('physic'))   return Atom
  if (s.includes('chem'))     return FlaskConical
  if (s.includes('bio'))      return Microscope
  if (s.includes('space'))    return Rocket
  if (s.includes('english'))  return BookOpen
  if (s.includes('history'))  return Landmark
  if (s.includes('geo'))      return Globe
  return Lightbulb
}

function IllustratedMap({ graph, centerId, setCenterId }: IllustratedMapProps) {
  const { center, satellites } = useMemo(() => {
    if (graph.nodes.length === 0) return { center: null, satellites: [] }
    let center: ConceptNode | undefined =
      centerId ? graph.nodes.find(n => n.id === centerId) : undefined
    if (!center) {
      center = [...graph.nodes].sort((a, b) => (b.visits ?? 0) - (a.visits ?? 0))[0]
    }
    const connected = new Set<string>()
    for (const e of graph.edges) {
      if (e.from === center.id) connected.add(e.to)
      else if (e.to === center.id) connected.add(e.from)
    }
    let sats = graph.nodes
      .filter(n => connected.has(n.id) && n.id !== center!.id)
      .sort((a, b) => (b.visits ?? 0) - (a.visits ?? 0))
    if (sats.length < 6) {
      const sameSubject = graph.nodes
        .filter(n => n.id !== center!.id && n.subject === center!.subject && !sats.some(s => s.id === n.id))
        .sort((a, b) => (b.visits ?? 0) - (a.visits ?? 0))
      sats = [...sats, ...sameSubject]
    }
    if (sats.length < 6) {
      const filler = graph.nodes
        .filter(n => n.id !== center!.id && !sats.some(s => s.id === n.id))
        .sort((a, b) => (b.visits ?? 0) - (a.visits ?? 0))
      sats = [...sats, ...filler]
    }
    return { center, satellites: sats.slice(0, 6) }
  }, [graph, centerId])

  if (!center) return null

  const cx = VIEWBOX_W / 2
  const cy = VIEWBOX_H / 2
  const POSITIONS: { x: number; y: number; iconSide: 'left' | 'right' }[] = [
    { x: 245, y: 130, iconSide: 'left'  },
    { x: 855, y: 130, iconSide: 'right' },
    { x: 175, y: 300, iconSide: 'left'  },
    { x: 925, y: 300, iconSide: 'right' },
    { x: 245, y: 470, iconSide: 'left'  },
    { x: 855, y: 470, iconSide: 'right' },
  ]

  return (
    <div className="cm-map-wrap" style={{
      position: 'relative',
      width: '100%',
      minHeight: 'clamp(420px, 70vh, 640px)',
      backgroundColor: MONO.bg,
      backgroundImage: `
        linear-gradient(135deg, ${MONO.bgPattern} 25%, transparent 25%),
        linear-gradient(225deg, ${MONO.bgPattern} 25%, transparent 25%),
        linear-gradient(315deg, ${MONO.bgPattern} 25%, transparent 25%),
        linear-gradient( 45deg, ${MONO.bgPattern} 25%, transparent 25%)
      `,
      backgroundSize: '32px 32px',
      backgroundPosition: '16px 0, 16px 0, 0 0, 0 0',
    }}>
      <svg
        className="cm-map-svg"
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', minHeight: 'clamp(420px, 70vh, 640px)' }}
      >
        {satellites.map((sat, i) => {
          const p = POSITIONS[i]
          // Curve each spoke into a gentle petal so the map feels hand-drawn, not radial-rigid.
          const dx = p.x - cx, dy = p.y - cy
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const bow = Math.min(dist * 0.12, 34)
          const mx = (cx + p.x) / 2 + (-dy / dist) * bow
          const my = (cy + p.y) / 2 + (dx / dist) * bow
          return (
            <path
              key={'edge-' + sat.id}
              d={`M ${cx} ${cy} Q ${mx} ${my} ${p.x} ${p.y}`}
              fill="none"
              stroke={MONO.inkFaint}
              strokeWidth={1}
              strokeLinecap="round"
              opacity={0.55}
            />
          )
        })}

        <HexNode
          x={cx} y={cy}
          width={260} height={170}
          title={center.name}
          subtitle={(center.subject || 'Most studied') + ' · ' + (center.visits || 1) + ' visit' + ((center.visits || 1) === 1 ? '' : 's')}
          isCenter
          onClick={() => setCenterId(null)}
        />

        {satellites.map((sat, i) => {
          const p = POSITIONS[i]
          const Icon = iconForSubject(sat.subject)
          return (
            <HexNode
              key={sat.id}
              x={p.x} y={p.y}
              width={240} height={130}
              title={sat.name.toUpperCase()}
              subtitle={(sat.subject || 'Concept').toUpperCase() + ' · ' + (sat.visits || 1) + ' visit' + ((sat.visits || 1) === 1 ? '' : 's')}
              icon={Icon}
              iconSide={p.iconSide}
              onClick={() => setCenterId(sat.id)}
            />
          )
        })}
      </svg>

      <div style={{
        position: 'absolute', bottom: 14, left: 16,
        fontFamily: HEADLINE_FONT, fontSize: 10, fontWeight: 700,
        color: MONO.inkDim, letterSpacing: 2,
        textTransform: 'uppercase',
        background: 'rgba(255, 255, 255, 0.04)',
        padding: '6px 10px',
        borderRadius: 6,
        border: `1px solid rgba(255, 255, 255, 0.08)`,
      }}>
        Click any node to recentre
      </div>
    </div>
  )
}

interface HexNodeProps {
  x: number; y: number
  width: number; height: number
  title: string
  titleSecond?: string
  subtitle: string
  isCenter?: boolean
  icon?: React.ElementType
  iconSide?: 'left' | 'right'
  onClick?: () => void
}
function HexNode({
  x, y, width, height, title, subtitle, isCenter, icon: Icon, iconSide, onClick,
}: HexNodeProps) {
  const chamfer = isCenter ? 22 : 16
  const w2 = width / 2
  const h2 = height / 2
  const c  = chamfer
  const path = [
    `M ${-w2 + c} ${-h2}`,
    `L ${ w2 - c} ${-h2}`,
    `L ${ w2}     ${-h2 + c}`,
    `L ${ w2}     ${ h2 - c}`,
    `L ${ w2 - c} ${ h2}`,
    `L ${-w2 + c} ${ h2}`,
    `L ${-w2}     ${ h2 - c}`,
    `L ${-w2}     ${-h2 + c}`,
    `Z`,
  ].join(' ')

  const iconSize = 28
  const iconOffset = w2 + 32

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <path
        d={path}
        fill="rgba(8, 9, 12, 0.85)"
        stroke={MONO.ink}
        strokeWidth={isCenter ? 2.5 : 1.6}
        strokeLinejoin="miter"
      />

      {isCenter ? (
        <>
          <TwoLineUppercase text={clipText(title, 30)} y={-18} fontSize={26} fontWeight={800} />
          <text textAnchor="middle" y={52}
            fontFamily={HEADLINE_FONT} fontSize={11} fontWeight={600}
            fill={MONO.inkDim} letterSpacing="2.5"
            style={{ textTransform: 'uppercase' }}>
            {clipText(subtitle, 28)}
          </text>
        </>
      ) : (
        <>
          <TwoLineUppercase
            text={clipText(title, 36)}
            y={-12}
            fontSize={18}
            fontWeight={800}
          />
          <text textAnchor="middle" y={36}
            fontFamily={HEADLINE_FONT} fontSize={9.5} fontWeight={600}
            fill={MONO.inkDim} letterSpacing="2"
            style={{ textTransform: 'uppercase' }}>
            {clipText(subtitle, 36)}
          </text>
        </>
      )}

      {Icon && iconSide && (
        <foreignObject
          x={iconSide === 'right' ? iconOffset - iconSize / 2 : -iconOffset - iconSize / 2}
          y={-iconSize / 2}
          width={iconSize}
          height={iconSize}
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              width: iconSize, height: iconSize,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon size={iconSize} color={MONO.ink} strokeWidth={1.5} />
          </div>
        </foreignObject>
      )}
    </g>
  )
}

function clipText(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function TwoLineUppercase({ text, y, fontSize, fontWeight }: {
  text: string; y: number; fontSize: number; fontWeight: number
}) {
  const t = text.trim()
  if (t.length <= 14) {
    return (
      <text textAnchor="middle" y={y + fontSize * 0.4}
        fontFamily={HEADLINE_FONT} fontSize={fontSize} fontWeight={fontWeight}
        fill={MONO.ink} letterSpacing="1.5"
        style={{ textTransform: 'uppercase' }}>
        {t}
      </text>
    )
  }
  const mid = Math.floor(t.length / 2)
  let breakIdx = -1
  for (let off = 0; off < t.length; off++) {
    if (t[mid + off] === ' ') { breakIdx = mid + off; break }
    if (mid - off > 0 && t[mid - off] === ' ') { breakIdx = mid - off; break }
  }
  const line1 = breakIdx > 0 ? t.slice(0, breakIdx) : t.slice(0, mid)
  const line2 = breakIdx > 0 ? t.slice(breakIdx + 1) : t.slice(mid)
  return (
    <>
      <text textAnchor="middle" y={y}
        fontFamily={HEADLINE_FONT} fontSize={fontSize} fontWeight={fontWeight}
        fill={MONO.ink} letterSpacing="1.5"
        style={{ textTransform: 'uppercase' }}>
        {line1}
      </text>
      <text textAnchor="middle" y={y + fontSize + 2}
        fontFamily={HEADLINE_FONT} fontSize={fontSize} fontWeight={fontWeight}
        fill={MONO.ink} letterSpacing="1.5"
        style={{ textTransform: 'uppercase' }}>
        {line2}
      </text>
    </>
  )
}
