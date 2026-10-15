/**
 * Show your working — a ruled whiteboard inside Doubt Solving.
 *
 * Most maths marks are lost in the middle steps, and the step-at-a-time
 * answer screen already tells a student to try it themselves first. This is
 * where they try: write one step per line, then "Check my working" sends the
 * board (and the typed question) to the vision checker, which marks each line
 * and points at the first slip WITHOUT giving the answer away.
 *
 * Drawing never needs the network; only the check does. Strokes are kept in
 * board-width units (see whiteboard.core) so the keyboard opening, a rotation
 * or a resize never stretches the handwriting.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Eraser, PenLine, Undo2, Trash2, Loader2, Check, X, AlertTriangle } from 'lucide-react'
import { aiHeadersAsync } from '../lib/devKey'
import { studentMessage } from '../lib/aiError.core'
import { eraseHits, inkBounds, normalizeBoardResult, boardVerdict } from '../lib/whiteboard.core.js'
import type { Stroke, BoardResult } from '../lib/whiteboard.core'

const T = {
  bg: '#0B0B14', bgAlt: '#0F0F1A', surface: '#15151F', raised: '#1A1A26',
  border: '#262636', borderCtl: '#2A2A3C', divider: '#1E1E2C',
  text: '#EDEDF5', text2: '#C9C9DC', muted: '#9494AD', faint: '#5E5E78',
  accent: '#7C5CFF', accentPale: '#C4B4FF', accentSurface: '#2A1F52',
  success: '#3DD68C', successBg: '#123D2B', warning: '#F2A65A', warningBg: '#3A2E18',
  paper: '#F7F6FB', ink: '#1B1830', rule: 'rgba(124,92,255,0.13)',
} as const
const FONT = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
const ICON = { strokeWidth: 1.75, absoluteStrokeWidth: false } as const

/** Ruled-line spacing, in CSS pixels. One step per line is the whole idea. */
const LINE_GAP = 44
/** Pen width in board-width units (~2.6px on a 380px-wide board). */
const PEN = 0.007
/** Eraser reach in board-width units. */
const ERASE_R = 0.03

export default function Whiteboard({ open, initialQuestion, onClose, onShowSolution }: {
  open: boolean
  initialQuestion: string
  onClose: () => void
  /** Hand the question to the normal step-by-step solver. */
  onShowSolution: (question: string) => void
}) {
  const [question, setQuestion] = useState(initialQuestion)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<BoardResult | null>(null)

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const live = useRef<Stroke | null>(null)
  const strokesRef = useRef<Stroke[]>([])
  strokesRef.current = strokes
  const abort = useRef<AbortController | null>(null)
  useEffect(() => () => abort.current?.abort(), [])

  /* ── drawing ── */

  const redraw = useCallback(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const w = cv.clientWidth
    const d = window.devicePixelRatio || 1
    ctx.setTransform(d, 0, 0, d, 0, 0)
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = T.ink
    ctx.fillStyle = T.ink
    ctx.lineWidth = Math.max(2, PEN * w)
    const all = live.current ? [...strokesRef.current, live.current] : strokesRef.current
    for (const s of all) {
      const p = s.points
      if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0][0] * w, p[0][1] * w, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); continue }
      ctx.beginPath()
      ctx.moveTo(p[0][0] * w, p[0][1] * w)
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0] * w, p[i][1] * w)
      ctx.stroke()
    }
  }, [])

  // Size the canvas to its box (and the device's pixel density), then redraw.
  useEffect(() => {
    const cv = canvasRef.current
    const wrap = wrapRef.current
    if (!cv || !wrap) return
    const fit = () => {
      const d = window.devicePixelRatio || 1
      const r = wrap.getBoundingClientRect()
      if (!r.width || !r.height) return
      cv.width = Math.round(r.width * d)
      cv.height = Math.round(r.height * d)
      cv.style.width = `${r.width}px`
      cv.style.height = `${r.height}px`
      redraw()
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [redraw, open])

  useEffect(() => { redraw() }, [strokes, redraw])

  const point = (e: React.PointerEvent): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect()
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.width]
  }

  const erase = (x: number, y: number) => {
    const hits = eraseHits(strokesRef.current, x, y, ERASE_R)
    if (hits.length) setStrokes(s => s.filter((_, i) => !hits.includes(i)))
  }

  function down(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const [x, y] = point(e)
    setResult(null)
    if (tool === 'eraser') { erase(x, y); return }
    live.current = { mode: 'pen', points: [[x, y]] }
    redraw()
  }
  function move(e: React.PointerEvent) {
    // Only while touching: a hovering mouse or stylus must not draw or erase.
    if (!(e.buttons & 1)) return
    const [x, y] = point(e)
    if (tool === 'eraser') { erase(x, y); return }
    const s = live.current
    if (!s) return
    const last = s.points[s.points.length - 1]
    if (Math.hypot(x - last[0], y - last[1]) < 0.0015) return
    s.points.push([x, y])
    redraw()
  }
  function up() {
    const s = live.current
    live.current = null
    if (s) setStrokes(all => [...all, s])
  }

  /* ── checking ── */

  /**
   * The board as an image for the checker: black ink on white, cropped to the
   * writing, ruled lines left out (a model reads them as underlines or minus
   * signs). JPEG keeps a full board well under the server's frame limit.
   */
  function snapshot(): string | null {
    const b = inkBounds(strokesRef.current)
    if (!b) return null
    const pad = 0.04
    const minX = Math.max(0, b.minX - pad)
    const minY = Math.max(0, b.minY - pad)
    const w = Math.min(1, b.maxX + pad) - minX
    const h = b.maxY + pad - minY
    const scale = 1100 / Math.max(w, h * 0.75)
    const cv = document.createElement('canvas')
    cv.width = Math.max(200, Math.round(w * scale))
    cv.height = Math.max(120, Math.round(h * scale))
    const ctx = cv.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, cv.width, cv.height)
    ctx.strokeStyle = '#000000'
    ctx.fillStyle = '#000000'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(2.5, PEN * scale)
    for (const s of strokesRef.current) {
      const p = s.points.map(([x, y]) => [(x - minX) * scale, (y - minY) * scale])
      if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0][0], p[0][1], ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); continue }
      ctx.beginPath()
      ctx.moveTo(p[0][0], p[0][1])
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1])
      ctx.stroke()
    }
    return cv.toDataURL('image/jpeg', 0.85)
  }

  async function check() {
    if (busy) return
    const image = snapshot()
    if (!image) { setError('Write your working on the board first, one step per line.'); return }
    setError('')
    setResult(null)
    setBusy(true)
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    try {
      const headers = { 'Content-Type': 'application/json', ...(await aiHeadersAsync()) }
      const r = await fetch('/api/camera/analyze', {
        method: 'POST', headers, signal: ctrl.signal,
        body: JSON.stringify({ image, mode: 'board', context: { question: question.trim() } }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) {
        const e: any = new Error(body?.error || 'The checker did not answer.')
        e.status = r.status
        throw e
      }
      setResult(normalizeBoardResult(body))
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(studentMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const verdict = result ? boardVerdict(result) : null
  const toneColor = verdict?.tone === 'good' ? T.success : verdict?.tone === 'warn' ? T.warning : T.accentPale
  const toneBg = verdict?.tone === 'good' ? T.successBg : verdict?.tone === 'warn' ? T.warningBg : T.accentSurface

  const toolBtn = (on: boolean): React.CSSProperties => ({
    height: 44, minWidth: 44, padding: '0 12px', borderRadius: 13, flexShrink: 0,
    background: on ? T.accentSurface : T.raised, border: `1px solid ${on ? T.accent : T.borderCtl}`,
    color: on ? T.text : T.muted, fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  })

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 60, background: T.bg, color: T.text, fontFamily: FONT,
      display: open ? 'flex' : 'none', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${T.divider}` }}>
        <button onClick={onClose} aria-label="Back" style={{
          width: 44, height: 44, marginLeft: -10, borderRadius: 12, background: 'none', border: 'none',
          display: 'grid', placeItems: 'center', cursor: 'pointer',
        }}>
          <ArrowLeft size={20} color={T.muted} {...ICON} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: 700, color: T.accent }}>SHOW YOUR WORKING</div>
          <div style={{ fontSize: 12.5, color: T.muted }}>One step per line. Kyno finds the first slip.</div>
        </div>
      </div>

      <div style={{ padding: '12px 14px 0' }}>
        <input
          value={question} onChange={e => setQuestion(e.target.value)}
          placeholder="Type the question (optional)" aria-label="The question"
          style={{
            width: '100%', height: 46, borderRadius: 14, padding: '0 14px', boxSizing: 'border-box',
            background: T.raised, border: `1px solid ${T.borderCtl}`, color: T.text,
            fontSize: 16, fontFamily: FONT, outline: 'none',
          }}
        />
      </div>

      {/* the board */}
      <div style={{ flex: 1, minHeight: 220, padding: '12px 14px 0', display: 'flex' }}>
        <div ref={wrapRef} style={{
          position: 'relative', flex: 1, borderRadius: 16, overflow: 'hidden', background: T.paper,
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${LINE_GAP - 1}px, ${T.rule} ${LINE_GAP - 1}px, ${T.rule} ${LINE_GAP}px)`,
        }}>
          <canvas
            ref={canvasRef}
            aria-label="Whiteboard. Draw your working here."
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: tool === 'pen' ? 'crosshair' : 'cell' }}
          />
          {!strokes.length && !busy && (
            <div style={{
              position: 'absolute', left: 16, top: 10, right: 16, pointerEvents: 'none',
              fontSize: 13, color: '#8A86A0', lineHeight: 1.5,
            }}>
              Write each step on its own line, like in your notebook.
            </div>
          )}
        </div>
      </div>

      {/* result */}
      {(result || error) && (
        <div style={{ padding: '10px 14px 0' }}>
          {error ? (
            <div style={{ display: 'flex', gap: 8, padding: 12, borderRadius: 14, background: T.surface, border: `1px solid ${T.border}`, fontSize: 13, color: T.warning, lineHeight: 1.5 }}>
              <AlertTriangle size={16} {...ICON} style={{ flexShrink: 0, marginTop: 2 }} />{error}
            </div>
          ) : result && verdict && (
            <div style={{ padding: 12, borderRadius: 14, background: T.surface, border: `1px solid ${T.border}`, maxHeight: 220, overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ padding: '3px 10px', borderRadius: 100, background: toneBg, color: toneColor, fontSize: 12.5, fontWeight: 700 }}>
                  {verdict.title}
                </span>
                <div style={{ flex: 1 }} />
                {/* The card takes board space; drawing again also clears it. */}
                <button onClick={() => setResult(null)} aria-label="Hide the result" style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0,
                }}>
                  <X size={16} color={T.faint} {...ICON} />
                </button>
              </div>
              {result.feedback && <div style={{ marginTop: 8, fontSize: 13.5, color: T.text2, lineHeight: 1.55 }}>{result.feedback}</div>}
              {result.lines.length > 0 && (
                <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                  {result.lines.map(l => (
                    <div key={l.n} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12.5, color: l.ok ? T.muted : T.text }}>
                      {l.ok ? <Check size={14} color={T.success} {...ICON} style={{ flexShrink: 0 }} /> : <X size={14} color={T.warning} {...ICON} style={{ flexShrink: 0 }} />}
                      <span style={{ fontWeight: 700, minWidth: 18 }}>{l.n}.</span>
                      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{l.text}</span>
                    </div>
                  ))}
                </div>
              )}
              {question.trim() && (
                <button onClick={() => onShowSolution(question.trim())} style={{
                  marginTop: 10, height: 40, padding: '0 14px', borderRadius: 12, background: T.raised,
                  border: `1px solid ${T.borderCtl}`, color: T.accentPale, fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>Show me the solution</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* tools */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', padding: '12px 14px calc(12px + env(safe-area-inset-bottom))',
        overflowX: 'auto',
      }}>
        <button onClick={() => setTool('pen')} aria-pressed={tool === 'pen'} aria-label="Pen" style={toolBtn(tool === 'pen')}>
          <PenLine size={17} {...ICON} />
        </button>
        <button onClick={() => setTool('eraser')} aria-pressed={tool === 'eraser'} aria-label="Eraser" style={toolBtn(tool === 'eraser')}>
          <Eraser size={17} {...ICON} />
        </button>
        <button onClick={() => { setStrokes(s => s.slice(0, -1)); setResult(null) }} disabled={!strokes.length} aria-label="Undo" style={{ ...toolBtn(false), opacity: strokes.length ? 1 : 0.45 }}>
          <Undo2 size={17} {...ICON} />
        </button>
        <button onClick={() => { setStrokes([]); setResult(null); setError('') }} disabled={!strokes.length} aria-label="Clear the board" style={{ ...toolBtn(false), opacity: strokes.length ? 1 : 0.45 }}>
          <Trash2 size={17} {...ICON} />
        </button>
        <button onClick={check} disabled={busy} style={{
          flex: 1, minWidth: 150, height: 48, borderRadius: 14, border: 'none',
          background: busy ? T.raised : T.accent, color: busy ? T.muted : '#fff',
          fontFamily: FONT, fontSize: 14.5, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {busy ? <><Loader2 size={16} {...ICON} className="kyno-spin" /> Checking…</> : 'Check my working'}
        </button>
      </div>
    </div>
  )
}
