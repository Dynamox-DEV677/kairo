/**
 * AI Concept Map — interactive SVG mindmap from any topic.
 * AI extracts 8-15 concepts + their relationships, we lay them out
 * with a simple physics-free radial-of-clusters scheme and let the
 * user drag nodes around.
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Network, Sparkles, RefreshCw, Save, ZoomIn, ZoomOut, Maximize2,
} from 'lucide-react'
import { chat } from '../lib/openrouter'
import { saveToNotebook } from '../lib/notebook'

interface ConceptNode {
  id:    string
  label: string
  level: number       // 0 = central, 1 = main, 2 = leaf
  desc?: string
  // Computed positions
  x?: number
  y?: number
}

interface ConceptEdge {
  from:  string
  to:    string
  label?: string
}

interface ConceptGraph {
  central: string
  nodes:   ConceptNode[]
  edges:   ConceptEdge[]
}

const card: React.CSSProperties = { background: '#111', border: '1px solid #1e1e1e', borderRadius: 14 }

const LEVEL_COLORS = ['#6366f1', '#34d399', '#fbbf24', '#f472b6']
const LEVEL_RADIUS = [38, 32, 26, 22]

export default function ConceptMap() {
  const [topic, setTopic]       = useState('')
  const [graph, setGraph]       = useState<ConceptGraph | null>(null)
  const [loading, setLoading]   = useState(false)
  const [err, setErr]           = useState('')
  const [zoom, setZoom]         = useState(1)
  const [pan, setPan]           = useState({ x: 0, y: 0 })
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hoverId, setHoverId]   = useState<string | null>(null)
  const [savedToNotebook, setSavedToNotebook] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragStart = useRef<{ mx: number; my: number; nx: number; ny: number } | null>(null)
  const panStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)

  // Layout: central node at origin, level-1 in a circle around, level-2 clustered around their parents
  const layoutGraph = useCallback((g: ConceptGraph): ConceptGraph => {
    const nodes = g.nodes.map(n => ({ ...n }))
    const idx: Record<string, ConceptNode> = {}
    for (const n of nodes) idx[n.id] = n

    // Level-0 (central) at origin
    for (const n of nodes) if (n.level === 0) { n.x = 0; n.y = 0 }

    // Level-1 in a ring
    const level1 = nodes.filter(n => n.level === 1)
    const r1 = 240
    level1.forEach((n, i) => {
      const angle = (i / Math.max(level1.length, 1)) * Math.PI * 2 - Math.PI / 2
      n.x = Math.cos(angle) * r1
      n.y = Math.sin(angle) * r1
    })

    // Level-2 around their parent (or central if no parent)
    const level2 = nodes.filter(n => n.level >= 2)
    const childrenByParent: Record<string, ConceptNode[]> = {}
    for (const n of level2) {
      // Find parent via edge
      const incoming = g.edges.find(e => e.to === n.id)
      const parentId = incoming?.from || nodes.find(p => p.level === 0)?.id || nodes[0]?.id
      if (parentId) {
        if (!childrenByParent[parentId]) childrenByParent[parentId] = []
        childrenByParent[parentId].push(n)
      }
    }
    for (const [parentId, children] of Object.entries(childrenByParent)) {
      const parent = idx[parentId]
      if (!parent || parent.x == null) continue
      const r2 = 110
      // Direction from center to parent
      const angleToParent = Math.atan2(parent.y!, parent.x!)
      // Spread children around the parent in an arc facing outward
      children.forEach((c, i) => {
        const spread = Math.PI * 0.6
        const offset = (i - (children.length - 1) / 2) * (spread / Math.max(children.length, 1))
        const angle = angleToParent + offset
        c.x = parent.x! + Math.cos(angle) * r2
        c.y = parent.y! + Math.sin(angle) * r2
      })
    }

    // Any leftover nodes — place outside the ring
    let outerAngle = 0
    for (const n of nodes) {
      if (n.x == null) {
        n.x = Math.cos(outerAngle) * 380
        n.y = Math.sin(outerAngle) * 380
        outerAngle += 0.7
      }
    }

    return { ...g, nodes }
  }, [])

  async function generate() {
    if (!topic.trim()) { setErr('Enter a topic first'); return }
    setErr(''); setLoading(true); setGraph(null); setSavedToNotebook(false)

    try {
      const reply = await chat({
        messages: [
          { role: 'system', content: `You are an expert at building concept maps for Indian school students.

Given a topic, extract:
- 1 central node (the topic itself)
- 4-6 main concepts (level 1)
- 6-12 supporting concepts / examples / formulas (level 2)
- Relationships between them (edges)

Return ONLY this JSON shape, NO markdown, NO prose:

{
  "central": "node_id_of_main_topic",
  "nodes": [
    {"id": "n1", "label": "Quadratic Equations", "level": 0, "desc": "ax² + bx + c = 0"},
    {"id": "n2", "label": "Standard Form", "level": 1, "desc": "..."},
    {"id": "n3", "label": "Discriminant", "level": 2, "desc": "b² - 4ac"}
  ],
  "edges": [
    {"from": "n1", "to": "n2", "label": "has"},
    {"from": "n2", "to": "n3"}
  ]
}

Rules:
- Use short ids like "n1","n2",...
- Labels under 28 chars
- desc under 80 chars
- 10-18 nodes total. 12-22 edges.
- Every level-2 node must have an incoming edge from a level-0 or level-1 node.` },
          { role: 'user', content: `Topic: ${topic}` },
        ],
      })

      const cleaned = reply
        .replace(/<\/?think(?:ing)?>[\s\S]*?<\/?think(?:ing)?>/gi, '')
        .replace(/```(?:json)?\s*/gi, '')
        .replace(/```/g, '')
        .trim()

      let parsed: ConceptGraph | null = null
      try { parsed = JSON.parse(cleaned) } catch { /* fall through */ }
      if (!parsed) {
        const m = cleaned.match(/\{[\s\S]*\}/)
        if (m) try { parsed = JSON.parse(m[0]) } catch { /* still null */ }
      }
      if (!parsed?.nodes?.length) throw new Error('AI returned no graph. Try again.')

      const laidOut = layoutGraph(parsed)
      setGraph(laidOut)
      setZoom(1); setPan({ x: 0, y: 0 })
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  async function saveCurrent() {
    if (!graph) return
    const md = renderToMarkdown(graph)
    const r = await saveToNotebook({
      kind: 'concept_map',
      title: `Concept Map · ${topic}`,
      content: md,
      subject: null,
      tags: [topic.split(' ')[0]],
      source: 'concept-map',
    })
    if (r) setSavedToNotebook(true)
  }

  // Drag handlers
  function onNodeMouseDown(e: React.MouseEvent, n: ConceptNode) {
    if (n.x == null || n.y == null) return
    e.stopPropagation()
    setDraggingId(n.id)
    dragStart.current = { mx: e.clientX, my: e.clientY, nx: n.x, ny: n.y }
  }
  function onMouseMove(e: React.MouseEvent) {
    if (draggingId && dragStart.current) {
      const dx = (e.clientX - dragStart.current.mx) / zoom
      const dy = (e.clientY - dragStart.current.my) / zoom
      setGraph(prev => prev ? {
        ...prev,
        nodes: prev.nodes.map(n => n.id === draggingId
          ? { ...n, x: dragStart.current!.nx + dx, y: dragStart.current!.ny + dy }
          : n),
      } : prev)
    } else if (panStart.current) {
      setPan({
        x: panStart.current.px + (e.clientX - panStart.current.mx),
        y: panStart.current.py + (e.clientY - panStart.current.my),
      })
    }
  }
  function onMouseUp() {
    setDraggingId(null)
    dragStart.current = null
    panStart.current  = null
  }
  function onSvgMouseDown(e: React.MouseEvent) {
    if (e.target === svgRef.current || (e.target as Element).tagName === 'svg') {
      panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
    }
  }

  function fitToView() { setZoom(1); setPan({ x: 0, y: 0 }) }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1200, margin: '0 auto', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18, flexShrink: 0 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: 'linear-gradient(135deg, #a78bfa, #f472b6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 18px rgba(167,139,250,0.4)', flexShrink: 0,
        }}>
          <Network size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Concept Map</h1>
          <p style={{ fontSize: 13, color: '#52525b', marginTop: 4 }}>
            Type any topic — AI builds a visual mindmap. Drag nodes. Zoom. Save to notebook.
          </p>
        </div>
      </div>

      {/* Topic input */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexShrink: 0 }}>
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && generate()}
          placeholder="e.g. Photosynthesis · Newton's Laws · French Revolution · Trigonometry"
          style={{
            flex: 1, background: '#111', border: '1px solid #1e1e1e',
            borderRadius: 9, padding: '10px 14px', fontSize: 14, color: '#fafafa',
            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
          }}
          onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#a78bfa'}
          onBlur={e => (e.target as HTMLInputElement).style.borderColor = '#1e1e1e'}
        />
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={generate} disabled={loading || !topic.trim()}
          style={{
            padding: '10px 20px', borderRadius: 9, border: 'none',
            background: loading || !topic.trim() ? '#1c1c1c'
              : 'linear-gradient(135deg, #a78bfa, #f472b6)',
            color: loading || !topic.trim() ? '#52525b' : '#fff',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
            cursor: loading || !topic.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 7,
            boxShadow: loading || !topic.trim() ? 'none' : '0 0 18px rgba(167,139,250,0.35)',
          }}>
          <Sparkles size={13} />{loading ? 'Mapping…' : 'Generate Map'}
        </motion.button>
      </div>

      {err && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, fontSize: 12, color: '#f87171', flexShrink: 0 }}>
          {err}
        </div>
      )}

      {/* Canvas */}
      <div style={{
        ...card, flex: 1, position: 'relative', overflow: 'hidden',
        cursor: draggingId ? 'grabbing' : panStart.current ? 'grabbing' : 'grab',
      }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 14,
          }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #1e1e2e', borderTopColor: '#a78bfa' }} />
            <p style={{ fontSize: 13, color: '#a1a1aa' }}>AI is mapping concepts…</p>
          </div>
        )}

        {!loading && !graph && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12, color: '#3f3f46',
          }}>
            <Network size={42} />
            <p style={{ fontSize: 13, margin: 0 }}>Enter a topic to begin</p>
          </div>
        )}

        {graph && (
          <>
            {/* Zoom + save controls */}
            <div style={{
              position: 'absolute', top: 12, right: 12, zIndex: 10,
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <button onClick={() => setZoom(z => Math.min(3, z * 1.2))}
                style={iconBtn}><ZoomIn size={13} /></button>
              <button onClick={() => setZoom(z => Math.max(0.3, z / 1.2))}
                style={iconBtn}><ZoomOut size={13} /></button>
              <button onClick={fitToView} title="Reset view"
                style={iconBtn}><Maximize2 size={13} /></button>
              <button onClick={saveCurrent} title="Save to notebook" disabled={savedToNotebook}
                style={{
                  ...iconBtn, color: savedToNotebook ? '#34d399' : '#71717a',
                  borderColor: savedToNotebook ? '#34d39940' : '#1e1e1e',
                }}>
                <Save size={13} />
              </button>
              <button onClick={generate} title="Regenerate"
                style={iconBtn}><RefreshCw size={13} /></button>
            </div>

            {savedToNotebook && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  position: 'absolute', top: 12, left: 12, zIndex: 10,
                  padding: '6px 12px', borderRadius: 7,
                  background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.4)',
                  fontSize: 11, color: '#34d399', fontWeight: 600,
                }}>
                ✓ Saved to AI Notebook
              </motion.div>
            )}

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
                {graph.edges.map((e, i) => {
                  const from = graph.nodes.find(n => n.id === e.from)
                  const to = graph.nodes.find(n => n.id === e.to)
                  if (!from || !to || from.x == null || to.x == null) return null
                  const isHovered = hoverId === e.from || hoverId === e.to
                  return (
                    <g key={i}>
                      <line
                        x1={from.x!} y1={from.y!} x2={to.x!} y2={to.y!}
                        stroke={isHovered ? '#a78bfa' : '#3f3f46'}
                        strokeWidth={isHovered ? 1.6 : 0.9}
                        opacity={isHovered ? 1 : 0.5}
                      />
                      {e.label && isHovered && (
                        <text
                          x={(from.x! + to.x!) / 2}
                          y={(from.y! + to.y!) / 2}
                          fill="#a78bfa"
                          fontSize={9}
                          textAnchor="middle"
                          style={{ paintOrder: 'stroke', stroke: '#0a0a0a', strokeWidth: 3 }}
                        >{e.label}</text>
                      )}
                    </g>
                  )
                })}

                {/* Nodes */}
                {graph.nodes.map(n => {
                  if (n.x == null || n.y == null) return null
                  const lvl = Math.min(n.level, LEVEL_COLORS.length - 1)
                  const color = LEVEL_COLORS[lvl]
                  const r = LEVEL_RADIUS[lvl]
                  const isHovered = hoverId === n.id
                  return (
                    <g key={n.id} transform={`translate(${n.x}, ${n.y})`}
                      style={{ cursor: 'grab' }}
                      onMouseDown={e => onNodeMouseDown(e, n)}
                      onMouseEnter={() => setHoverId(n.id)}
                      onMouseLeave={() => setHoverId(null)}
                    >
                      <circle r={r + 4} fill={color} opacity={isHovered ? 0.25 : 0.12} />
                      <circle r={r} fill={`${color}30`} stroke={color} strokeWidth={isHovered ? 2.5 : 1.5} />
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#fafafa"
                        fontSize={lvl === 0 ? 11 : lvl === 1 ? 10 : 9}
                        fontWeight={lvl === 0 ? 700 : 600}
                        style={{ pointerEvents: 'none' }}
                      >
                        {wrapLabel(n.label, lvl === 0 ? 14 : 12)}
                      </text>
                    </g>
                  )
                })}
              </g>
            </svg>

            {/* Hovered node tooltip */}
            {hoverId && (() => {
              const n = graph.nodes.find(x => x.id === hoverId)
              if (!n?.desc) return null
              return (
                <div style={{
                  position: 'absolute', bottom: 14, left: 14, right: 14,
                  padding: '10px 14px', borderRadius: 9, pointerEvents: 'none',
                  background: 'rgba(13,13,13,0.92)',
                  border: '1px solid #2d2b55', backdropFilter: 'blur(6px)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#fafafa', marginBottom: 4 }}>
                    {n.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#a1a1aa', lineHeight: 1.5 }}>{n.desc}</div>
                </div>
              )
            })()}
          </>
        )}
      </div>

      {/* Legend */}
      {graph && (
        <div style={{
          display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'center',
          marginTop: 10, flexShrink: 0,
        }}>
          {[
            { label: 'Central', color: LEVEL_COLORS[0] },
            { label: 'Main concept', color: LEVEL_COLORS[1] },
            { label: 'Detail', color: LEVEL_COLORS[2] },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
              <span style={{ fontSize: 10.5, color: '#71717a' }}>{l.label}</span>
            </div>
          ))}
          <span style={{ fontSize: 10.5, color: '#3f3f46', marginLeft: 'auto' }}>
            Drag nodes · drag canvas · scroll-zoom or use buttons
          </span>
        </div>
      )}
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 7,
  background: '#161616', border: '1px solid #1e1e1e',
  color: '#71717a', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

// Wrap a label across two SVG <tspan> rows if it's long
function wrapLabel(text: string, max: number) {
  if (text.length <= max) return <tspan>{text}</tspan>
  // Split at the nearest space before max
  const idx = text.lastIndexOf(' ', max)
  const cut = idx > 0 ? idx : max
  return (
    <>
      <tspan x={0} dy={-6}>{text.slice(0, cut)}</tspan>
      <tspan x={0} dy={12}>{text.slice(cut).trim()}</tspan>
    </>
  )
}

function renderToMarkdown(g: ConceptGraph): string {
  const central = g.nodes.find(n => n.id === g.central) || g.nodes.find(n => n.level === 0)
  const lines: string[] = []
  if (central) {
    lines.push(`# ${central.label}`)
    if (central.desc) lines.push(`> ${central.desc}\n`)
  }
  const level1 = g.nodes.filter(n => n.level === 1)
  for (const n1 of level1) {
    lines.push(`## ${n1.label}`)
    if (n1.desc) lines.push(`${n1.desc}\n`)
    const children = g.edges.filter(e => e.from === n1.id).map(e => g.nodes.find(n => n.id === e.to)).filter(Boolean)
    for (const c of children) {
      lines.push(`- **${c!.label}**${c!.desc ? ': ' + c!.desc : ''}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}
