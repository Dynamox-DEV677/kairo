/**
 * Knowledge Graph — your personal mind-web of concepts and relationships.
 * Builds on top of ai_memory + concept_relations table.
 * Pure SVG force-directed simulation.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Network, Sparkles, Plus, RefreshCw, Trash2, Filter,
  ZoomIn, ZoomOut, Maximize2, AlertTriangle,
} from 'lucide-react'
import { api } from '../lib/api'
import { chat } from '../lib/openrouter'

interface KNode {
  id:      string
  label:   string
  subject: string | null
  signal:  number
  hits:    number
  // Simulation state
  x: number; y: number; vx: number; vy: number
}
interface KEdge {
  id:         string
  from:       string
  to:         string
  kind:       string
  confidence: number
}

const KIND_COLORS: Record<string, string> = {
  prerequisite_of: '#fbbf24',
  related_to:      '#818cf8',
  builds_on:       '#34d399',
  contrasts_with:  '#f87171',
  example_of:      '#a78bfa',
}
const KIND_LABEL: Record<string, string> = {
  prerequisite_of: 'requires',
  related_to:      'related',
  builds_on:       'builds on',
  contrasts_with:  'contrasts',
  example_of:      'example of',
}

const card: React.CSSProperties = { background: '#111', border: '1px solid #1e1e1e', borderRadius: 14 }

export default function KnowledgeGraph() {
  const [nodes, setNodes]     = useState<KNode[]>([])
  const [edges, setEdges]     = useState<KEdge[]>([])
  const [stats, setStats]     = useState<{ node_count: number; edge_count: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')
  const [zoom, setZoom]       = useState(1)
  const [pan, setPan]         = useState({ x: 0, y: 0 })
  const [hoverNode, setHover] = useState<string | null>(null)
  const [showExtract, setShowExtract] = useState(false)
  const [extractTopic, setExtractTopic] = useState('')
  const [extractSubject, setExtractSubject] = useState('')
  const [extractBusy, setExtractBusy] = useState(false)
  const [filterKind, setFilterKind] = useState<string>('all')

  const animRef = useRef<number | null>(null)
  const draggingRef = useRef<{ id: string; offX: number; offY: number } | null>(null)
  const panRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const g = await api('/knowledge/graph')
      setStats(g.stats)
      // Initialize positions on a circle
      const N = g.nodes.length
      const initialized: KNode[] = (g.nodes || []).map((n: any, i: number) => {
        const angle = (i / Math.max(N, 1)) * Math.PI * 2
        const r = 100 + Math.random() * 80
        return {
          ...n,
          x: Math.cos(angle) * r,
          y: Math.sin(angle) * r,
          vx: 0, vy: 0,
        }
      })
      setNodes(initialized)
      setEdges(g.edges || [])
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Force-directed simulation tick
  useEffect(() => {
    if (nodes.length === 0) return
    let frame = 0
    const COOL_DOWN_FRAMES = 600

    const tick = () => {
      frame++
      const decay = Math.max(0.05, 1 - frame / COOL_DOWN_FRAMES)
      setNodes(prev => {
        const next = prev.map(n => ({ ...n }))
        const idx: Record<string, KNode> = {}
        for (const n of next) idx[n.id] = n

        // Repulsion between every pair
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const a = next[i], b = next[j]
            const dx = b.x - a.x, dy = b.y - a.y
            const dist2 = dx * dx + dy * dy + 0.01
            const dist = Math.sqrt(dist2)
            const force = 1800 / dist2
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force
            a.vx -= fx; a.vy -= fy
            b.vx += fx; b.vy += fy
          }
        }

        // Spring attraction along edges
        for (const e of edges) {
          const a = idx[e.from], b = idx[e.to]
          if (!a || !b) continue
          const dx = b.x - a.x, dy = b.y - a.y
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.01
          const targetDist = 110
          const k = 0.012
          const force = (dist - targetDist) * k
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          a.vx += fx; a.vy += fy
          b.vx -= fx; b.vy -= fy
        }

        // Gentle pull to center
        for (const n of next) {
          n.vx -= n.x * 0.0015
          n.vy -= n.y * 0.0015
          // Apply velocity, damped
          n.vx *= 0.85
          n.vy *= 0.85
          // If user is dragging this node, freeze position
          if (draggingRef.current?.id === n.id) {
            n.vx = 0; n.vy = 0
          } else {
            n.x += n.vx * decay
            n.y += n.vy * decay
          }
        }
        return next
      })
      if (frame < COOL_DOWN_FRAMES) animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, edges.length])

  async function extract() {
    if (!extractTopic.trim()) return
    setExtractBusy(true); setErr('')
    try {
      // Ask AI to propose relations
      const reply = await chat({
        messages: [
          { role: 'system', content: `You map concept relationships for an Indian school student.

Given a topic, return 4-7 distinct relationships. Use only these kinds:
- prerequisite_of: this concept must be learned before the target
- related_to:     general semantic relationship
- builds_on:      target extends/deepens this concept
- contrasts_with: complementary opposite
- example_of:     concrete instance

Return ONLY a JSON array, NO prose:
[{"to_topic":"Linear equations","kind":"prerequisite_of","confidence":0.9}, ...]

Rules:
- to_topic: 2-5 words, school-curriculum-friendly
- confidence: 0..1
- 4-7 items, no duplicates` },
          { role: 'user', content: `Topic: ${extractTopic}${extractSubject ? ` (subject: ${extractSubject})` : ''}` },
        ],
      })

      const cleaned = reply
        .replace(/<\/?think(?:ing)?>[\s\S]*?<\/?think(?:ing)?>/gi, '')
        .replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
      const m = cleaned.match(/\[[\s\S]*\]/)
      if (!m) throw new Error('AI returned no relations.')
      const relations = JSON.parse(m[0])

      const result = await api('/knowledge/extract', {
        method: 'POST',
        body: JSON.stringify({ topic: extractTopic, subject: extractSubject || null, relations }),
      })

      setShowExtract(false)
      setExtractTopic(''); setExtractSubject('')
      load()
      if (result.added === 0) setErr('All those relations were already in your graph.')
    } catch (e: any) { setErr(e.message) }
    finally { setExtractBusy(false) }
  }

  async function deleteEdge(id: string) {
    try {
      await api(`/knowledge/relation/${id}`, { method: 'DELETE' })
      setEdges(prev => prev.filter(e => e.id !== id))
    } catch (e: any) { alert(e.message) }
  }

  function fitView() { setZoom(1); setPan({ x: 0, y: 0 }) }

  // Drag/pan handlers
  function onSvgMouseDown(e: React.MouseEvent) {
    if ((e.target as Element).tagName === 'svg' || e.target === svgRef.current) {
      panRef.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
    }
  }
  function onMouseMove(e: React.MouseEvent) {
    if (draggingRef.current) {
      // Convert client coords to SVG coords (rough)
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return
      const cx = (e.clientX - rect.left - rect.width / 2 - pan.x) / zoom
      const cy = (e.clientY - rect.top - rect.height / 2 - pan.y) / zoom
      setNodes(prev => prev.map(n => n.id === draggingRef.current!.id
        ? { ...n, x: cx + draggingRef.current!.offX, y: cy + draggingRef.current!.offY }
        : n))
    } else if (panRef.current) {
      setPan({
        x: panRef.current.px + (e.clientX - panRef.current.mx),
        y: panRef.current.py + (e.clientY - panRef.current.my),
      })
    }
  }
  function onMouseUp() {
    draggingRef.current = null
    panRef.current = null
  }
  function onNodeDown(e: React.MouseEvent, n: KNode) {
    e.stopPropagation()
    draggingRef.current = { id: n.id, offX: 0, offY: 0 }
  }

  const visibleEdges = filterKind === 'all' ? edges : edges.filter(e => e.kind === filterKind)
  const idx: Record<string, KNode> = {}
  for (const n of nodes) idx[n.id] = n

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1200, margin: '0 auto', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16, flexShrink: 0 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: 'linear-gradient(135deg, #818cf8, #38bdf8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 18px rgba(129,140,248,0.4)', flexShrink: 0,
        }}>
          <Network size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Knowledge Graph</h1>
          <p style={{ fontSize: 13, color: '#52525b', marginTop: 4 }}>
            How everything you've learned connects · {stats?.node_count || 0} concepts · {stats?.edge_count || 0} links
          </p>
        </div>
        <button onClick={() => setShowExtract(true)}
          style={{
            padding: '9px 14px', borderRadius: 9, border: 'none',
            background: 'linear-gradient(135deg,#6366f1,#7c3aed)', color: '#fff',
            fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
          <Plus size={13} /> Extract Concepts
        </button>
        <button onClick={load} disabled={loading}
          style={{
            padding: '9px 12px', borderRadius: 9, border: '1px solid #1e1e1e',
            background: '#161616', color: '#71717a', cursor: 'pointer',
            display: 'flex', alignItems: 'center',
          }}>
          <RefreshCw size={12} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Filter strip */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
        <Filter size={11} color="#52525b" />
        <button onClick={() => setFilterKind('all')} style={pillStyle(filterKind === 'all', '#71717a')}>all</button>
        {Object.entries(KIND_LABEL).map(([k, l]) => (
          <button key={k} onClick={() => setFilterKind(k)} style={pillStyle(filterKind === k, KIND_COLORS[k])}>{l}</button>
        ))}
      </div>

      {err && (
        <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, fontSize: 12, color: '#f87171', flexShrink: 0 }}>
          {err}
        </div>
      )}

      {/* Canvas */}
      <div style={{ ...card, flex: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid #1e1e2e', borderTopColor: '#818cf8' }} />
            <p style={{ fontSize: 13, color: '#71717a' }}>Building your knowledge web…</p>
          </div>
        )}

        {!loading && nodes.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12, color: '#3f3f46', textAlign: 'center', padding: 24,
          }}>
            <AlertTriangle size={32} color="#52525b" />
            <p style={{ fontSize: 13, color: '#71717a', margin: 0, fontWeight: 600 }}>Your graph is empty</p>
            <p style={{ fontSize: 12, color: '#52525b', margin: 0, maxWidth: 340, lineHeight: 1.6 }}>
              Use Doubt Solver, take quizzes, or click "Extract Concepts" to seed it with a topic.
            </p>
          </div>
        )}

        {nodes.length > 0 && (
          <>
            {/* Zoom controls */}
            <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={() => setZoom(z => Math.min(3, z * 1.2))} style={iconBtn}><ZoomIn size={13} /></button>
              <button onClick={() => setZoom(z => Math.max(0.3, z / 1.2))} style={iconBtn}><ZoomOut size={13} /></button>
              <button onClick={fitView} style={iconBtn}><Maximize2 size={13} /></button>
            </div>

            <svg
              ref={svgRef}
              width="100%" height="100%"
              viewBox="-500 -350 1000 700"
              onMouseDown={onSvgMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              style={{ display: 'block', userSelect: 'none' }}
            >
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* Edges */}
                {visibleEdges.map(e => {
                  const from = idx[e.from], to = idx[e.to]
                  if (!from || !to) return null
                  const isHovered = hoverNode === e.from || hoverNode === e.to
                  const color = KIND_COLORS[e.kind] || '#52525b'
                  return (
                    <g key={e.id}>
                      <line
                        x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                        stroke={color}
                        strokeWidth={isHovered ? 2 : 1.2}
                        opacity={isHovered ? 0.95 : 0.45}
                        strokeDasharray={e.kind === 'contrasts_with' ? '4 3' : 'none'}
                      />
                      {isHovered && (
                        <text
                          x={(from.x + to.x) / 2}
                          y={(from.y + to.y) / 2 - 4}
                          fill={color}
                          fontSize={9}
                          textAnchor="middle"
                          style={{ paintOrder: 'stroke', stroke: '#0a0a0a', strokeWidth: 3 }}
                        >{KIND_LABEL[e.kind]}</text>
                      )}
                    </g>
                  )
                })}

                {/* Nodes */}
                {nodes.map(n => {
                  const r = 22 + Math.min(15, n.hits * 2)
                  const color = n.signal < -0.3 ? '#f87171'
                    : n.signal > 0.3 ? '#34d399' : '#818cf8'
                  const isHovered = hoverNode === n.id
                  return (
                    <g key={n.id} transform={`translate(${n.x}, ${n.y})`}
                      style={{ cursor: 'grab' }}
                      onMouseDown={e => onNodeDown(e, n)}
                      onMouseEnter={() => setHover(n.id)}
                      onMouseLeave={() => setHover(null)}
                    >
                      <circle r={r + 4} fill={color} opacity={isHovered ? 0.3 : 0.12} />
                      <circle r={r} fill={`${color}25`} stroke={color}
                        strokeWidth={isHovered ? 2.5 : 1.5} />
                      <text textAnchor="middle" dominantBaseline="middle" fill="#fafafa"
                        fontSize={9.5} fontWeight={600}
                        style={{ pointerEvents: 'none' }}>
                        {wrapLabel(n.label, 14)}
                      </text>
                    </g>
                  )
                })}
              </g>
            </svg>

            {hoverNode && (() => {
              const n = idx[hoverNode]
              if (!n) return null
              const incoming = edges.filter(e => e.to === n.id)
              const outgoing = edges.filter(e => e.from === n.id)
              return (
                <div style={{
                  position: 'absolute', bottom: 14, left: 14, right: 14,
                  padding: '12px 16px', borderRadius: 9, pointerEvents: 'none',
                  background: 'rgba(13,13,13,0.95)', border: '1px solid #2d2b55',
                  backdropFilter: 'blur(6px)',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa', marginBottom: 4 }}>
                    {n.label}
                    {n.subject && <span style={{ marginLeft: 8, fontSize: 10, color: '#a1a1aa', fontWeight: 500 }}>· {n.subject}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#71717a' }}>
                    Signal {n.signal.toFixed(2)} · seen {n.hits}× · {incoming.length} in / {outgoing.length} out
                  </div>
                </div>
              )
            })()}
          </>
        )}
      </div>

      {/* Legend */}
      {nodes.length > 0 && (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'center', marginTop: 10, flexShrink: 0, flexWrap: 'wrap',
        }}>
          {[
            { c: '#34d399', l: 'Mastered' },
            { c: '#818cf8', l: 'Neutral' },
            { c: '#f87171', l: 'Weak' },
          ].map(n => (
            <div key={n.l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: n.c }} />
              <span style={{ fontSize: 10.5, color: '#71717a' }}>{n.l}</span>
            </div>
          ))}
          <span style={{ fontSize: 10.5, color: '#3f3f46', marginLeft: 'auto' }}>
            Drag nodes · drag canvas · hover edges to see relationship type
          </span>
        </div>
      )}

      {/* Extract modal */}
      <AnimatePresence>
        {showExtract && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowExtract(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            }}>
            <motion.div onClick={e => e.stopPropagation()}
              initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }}
              style={{ ...card, padding: 22, width: 480, maxWidth: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Sparkles size={15} color="#a5b4fc" />
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fafafa', margin: 0 }}>Extract Concept Relations</h3>
              </div>
              <p style={{ fontSize: 12, color: '#71717a', marginBottom: 14 }}>
                AI will infer 4-7 relationships and add them to your graph.
              </p>
              <input value={extractTopic} onChange={e => setExtractTopic(e.target.value)}
                placeholder="Topic — e.g. Quadratic Equations"
                style={{
                  width: '100%', background: '#0d0d0d', border: '1px solid #1e1e1e',
                  borderRadius: 7, padding: '9px 12px', fontSize: 13, color: '#fafafa',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 8,
                }} />
              <input value={extractSubject} onChange={e => setExtractSubject(e.target.value)}
                placeholder="Subject (optional) — e.g. Mathematics"
                style={{
                  width: '100%', background: '#0d0d0d', border: '1px solid #1e1e1e',
                  borderRadius: 7, padding: '9px 12px', fontSize: 13, color: '#fafafa',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 14,
                }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowExtract(false)}
                  style={{
                    padding: '8px 14px', borderRadius: 7, border: '1px solid #1e1e1e',
                    background: '#161616', color: '#71717a', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 12,
                  }}>Cancel</button>
                <button onClick={extract} disabled={extractBusy || !extractTopic.trim()}
                  style={{
                    padding: '8px 14px', borderRadius: 7, border: 'none',
                    background: extractBusy || !extractTopic.trim() ? '#1c1c1c' : 'linear-gradient(135deg,#6366f1,#7c3aed)',
                    color: '#fff', cursor: extractBusy || !extractTopic.trim() ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                  <Sparkles size={11} />{extractBusy ? 'Extracting…' : 'Extract'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 7,
  background: '#161616', border: '1px solid #1e1e1e',
  color: '#71717a', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
function pillStyle(active: boolean, color: string): React.CSSProperties {
  return {
    padding: '4px 10px', borderRadius: 5,
    border: `1px solid ${active ? color : '#1e1e1e'}`,
    background: active ? `${color}15` : 'transparent',
    color: active ? color : '#71717a',
    fontFamily: 'inherit', fontSize: 10, fontWeight: 600, cursor: 'pointer',
    textTransform: 'lowercase',
  }
}
function wrapLabel(text: string, max: number) {
  if (text.length <= max) return <tspan>{text}</tspan>
  const idx = text.lastIndexOf(' ', max)
  const cut = idx > 0 ? idx : max
  return <>
    <tspan x={0} dy={-5}>{text.slice(0, cut)}</tspan>
    <tspan x={0} dy={11}>{text.slice(cut).trim()}</tspan>
  </>
}
