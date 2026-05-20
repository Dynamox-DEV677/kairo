/**
 * LabShell — generic wrapper around any Three.js simulation.
 *
 * Provides:
 *  - Mode toggle (3D / Text / Both)
 *  - Sim header with subject + topic
 *  - Right-side AI explanation panel that reacts to sim state
 *  - Loading/Reset/Save controls
 *
 * Each individual lab (GravityLab, PendulumLab, etc.) is a child component
 * that takes a "params" object (controlled by sliders here) and renders the
 * actual <Canvas>. The lab also contributes its own param controls + AI
 * prompt template via props.
 */
import { useState, useRef, useEffect, ReactNode, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Box, Type, Layers, Save, RotateCcw, Pause, Play,
  Sparkles, Loader2, ArrowLeft,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

/** Same normalizer the doubt-solver uses. Coerces non-standard math delimiters
 *  ([ ... ], \[ ... \], \( ... \)) into the $$...$$ / $...$ KaTeX expects. */
function normalizeMath(text: string): string {
  return text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `\n$$${m}$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => `$${m}$`)
    .replace(/^\[\s*([\s\S]*?)\s*\]$/gm, (_, m) => {
      if (m.includes('\\') || /[_^{}]/.test(m)) return `$$${m}$$`
      return _
    })
}

/** Markdown components — match the doubt-solver styling so labs and chat look identical. */
const MARKDOWN_COMPONENTS = {
  p:  ({ children }: any) => <p style={{ margin: '0 0 10px', lineHeight: 1.7 }}>{children}</p>,
  h1: ({ children }: any) => <h1 style={{ fontSize: 17, fontWeight: 800, color: '#fafafa', margin: '14px 0 8px' }}>{children}</h1>,
  h2: ({ children }: any) => <h2 style={{ fontSize: 15, fontWeight: 700, color: '#e4e4e7', margin: '14px 0 6px', letterSpacing: '-0.2px' }}>{children}</h2>,
  h3: ({ children }: any) => <h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#A5B4FC', margin: '10px 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>{children}</h3>,
  strong: ({ children }: any) => <strong style={{ color: '#fafafa', fontWeight: 700 }}>{children}</strong>,
  em:     ({ children }: any) => <em style={{ color: '#A5B4FC' }}>{children}</em>,
  ul: ({ children }: any) => <ul style={{ paddingLeft: 20, margin: '6px 0 10px' }}>{children}</ul>,
  ol: ({ children }: any) => <ol style={{ paddingLeft: 20, margin: '6px 0 10px' }}>{children}</ol>,
  li: ({ children }: any) => <li style={{ marginBottom: 4, color: '#d4d4d8' }}>{children}</li>,
  code: ({ children, className }: any) => {
    const isBlock = !!className
    return isBlock
      ? <pre style={{ background: '#050505', border: '1px solid #27272a', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', margin: '10px 0' }}>
          <code style={{ fontSize: 12.5, color: '#86efac', fontFamily: 'monospace' }}>{children}</code>
        </pre>
      : <code style={{ background: '#1a1a2e', padding: '2px 6px', borderRadius: 4, fontSize: 12.5, color: '#A5B4FC', fontFamily: 'monospace' }}>{children}</code>
  },
  blockquote: ({ children }: any) => <blockquote style={{ borderLeft: '3px solid #4F7CFF', paddingLeft: 12, margin: '8px 0', color: '#B1B5BA', fontStyle: 'italic' }}>{children}</blockquote>,
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid #27272a', margin: '12px 0' }} />,
}
import { chat } from '../lib/openrouter'
import { saveToNotebook } from '../lib/notebook'

type Mode = '3d' | 'text' | 'both'

interface ParamControl<T = any> {
  key:   string
  label: string
  type:  'slider' | 'toggle' | 'select'
  value: T
  min?:  number
  max?:  number
  step?: number
  options?: { value: any; label: string }[]
  unit?: string
}

interface LabShellProps {
  title:       string
  subject:     string
  topic:       string
  description: string                          // 1-2 sentence pitch
  Sim:         (props: { params: any; playing: boolean }) => ReactNode
  defaultParams: Record<string, any>
  controls:    ParamControl[]                  // schema for the sidebar sliders
  aiPrompt:    (params: any) => string         // builds the AI prompt from current params
  onBack?:     () => void
}

export default function LabShell({
  title, subject, topic, description,
  Sim, defaultParams, controls, aiPrompt, onBack,
}: LabShellProps) {
  const [mode, setMode]         = useState<Mode>('both')
  const [params, setParams]     = useState(defaultParams)
  const [playing, setPlaying]   = useState(true)
  const [explanation, setExplanation] = useState('')
  const [aiBusy, setAiBusy]     = useState(false)
  const [aiErr, setAiErr]       = useState('')
  const [savedNote, setSaved]   = useState(false)
  const debounceRef = useRef<number | null>(null)

  // Debounced AI re-fetch on param change
  const refetchExplanation = useCallback(async () => {
    setAiBusy(true); setAiErr('')
    try {
      const reply = await chat({
        messages: [
          { role: 'system', content: `You are Kairo Labs — a museum-quality AI lab assistant for Indian school students (CBSE/ICSE/state, Class 9-12).

You are explaining a ${subject.toLowerCase()} simulation the student is actively interacting with. Your job is to make them feel like they're inside an interactive science documentary.

ALWAYS REACT TO THE CURRENT PARAMETERS. If a slider changed (e.g. gravity went from 9.8 to 1.6), call it out: "Notice how with gravity at 1.6 m/s² (moon-like), the fall slows dramatically." Be specific to the numbers shown.

STRICT FORMATTING RULES:
- Use markdown ## headings (exactly the section names below — no extras)
- Inline math: $F = ma$
- Display math: $$E = mc^2$$ on its own line
- DOUBLE backslashes for LaTeX commands in math: $\\\\frac{1}{2}mv^2$ not $\\frac{1}{2}mv^2$
- Prefer Unicode for arrows + symbols: → ⇌ ⇒ ≈ ≤ ≥ × ÷ — they don't need escaping
- Never wrap the whole answer in $$. Only equations.

Output EXACTLY these 7 sections in order:

## What you're seeing
2 sentences describing the visual + current numeric state. Anchor in the params.

## Core principle
1 sentence stating the underlying law/concept by name.

## Formula breakdown
The primary formula, then per-variable explanations as a tight bullet list. Example:
$$T = 2\\\\pi\\\\sqrt{L/g}$$
- $T$ — period (s)
- $L$ — string length (m)
- $g$ — gravity (m/s²)

## Variable explanations
Explain what happens at the CURRENT slider values vs typical values. Be specific with numbers.

## Real-world applications
2 short bullets. Concrete examples Indian students will recognise.

## What to observe
1 sentence pointing at something visual to watch RIGHT NOW.

## Quick challenge
One short interactive question the student can answer by tweaking sliders. Example: "Drop gravity to 1.6 m/s² (moon). Does the fall time double, halve, or quadruple? Try it."

Keep total length 180-280 words. Tone: friendly, specific, exam-aware.` },
          { role: 'user', content: aiPrompt(params) },
        ],
      })
      setExplanation(reply)
    } catch (e: any) { setAiErr(e.message) }
    finally { setAiBusy(false) }
  }, [params, subject, aiPrompt])

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => { refetchExplanation() }, 800)
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current) }
  }, [refetchExplanation])

  function setParam(key: string, value: any) {
    setParams((p: any) => ({ ...p, [key]: value }))
  }
  function reset() { setParams(defaultParams) }
  async function saveExplanation() {
    if (!explanation) return
    const r = await saveToNotebook({
      kind: 'summary',
      title: `Lab · ${title}`,
      content: `${description}\n\n**Parameters:**\n${Object.entries(params).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n---\n\n${explanation}`,
      subject,
      tags: ['kairo-labs', subject.toLowerCase()],
      source: 'kairo-labs',
    })
    if (r) setSaved(true)
  }

  const showSim  = mode === '3d' || mode === 'both'
  const showText = mode === 'text' || mode === 'both'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '14px 24px', borderBottom: '1px solid #1a1f2e',
        display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
        background: 'rgba(13,13,13,0.7)', backdropFilter: 'blur(12px)',
      }}>
        {onBack && (
          <button onClick={onBack} style={{
            width: 34, height: 34, borderRadius: 8,
            background: '#151922', border: '1px solid #1f2532',
            cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#B1B5BA',
          }}>
            <ArrowLeft size={14} />
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: '#4F7CFF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>
            KAIRO LABS · {subject}
          </div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: '#fafafa', margin: 0, marginTop: 2 }}>
            {title} <span style={{ color: '#6B7280', fontWeight: 400 }}>· {topic}</span>
          </h1>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 4, background: '#0E1117', border: '1px solid #1f2532', borderRadius: 9, padding: 3 }}>
          {([
            { id: '3d',   label: '3D',    Icon: Box },
            { id: 'text', label: 'Text',  Icon: Type },
            { id: 'both', label: 'Both',  Icon: Layers },
          ] as const).map(t => {
            const Icon = t.Icon
            const active = mode === t.id
            return (
              <button key={t.id} onClick={() => setMode(t.id as Mode)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 11px', borderRadius: 6, border: 'none',
                  background: active ? '#1f2532' : 'transparent',
                  color: active ? '#A5B4FC' : '#6B7280',
                  fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                }}>
                <Icon size={11} />{t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Body — split layout (stacks vertically on mobile via .lab-body) */}
      <div className="lab-body" style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: showSim && showText ? '1fr 1fr' : '1fr',
        gap: 0, overflow: 'hidden',
      }}>

        {/* 3D pane */}
        {showSim && (
          <div style={{ position: 'relative', overflow: 'hidden', background: '#000' }}>
            <Sim params={params} playing={playing} />

            {/* Sim controls — bottom overlay */}
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              padding: '12px 16px',
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              {/* Param sliders */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {controls.map(c => (
                  <div key={c.key} style={{ flex: '1 1 200px', minWidth: 200 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#B1B5BA', textTransform: 'uppercase', letterSpacing: 1 }}>
                        {c.label}
                      </span>
                      <span style={{ fontSize: 10, color: '#4F7CFF', fontFamily: 'Consolas, monospace', fontWeight: 700 }}>
                        {params[c.key]}{c.unit ? ' ' + c.unit : ''}
                      </span>
                    </div>
                    {c.type === 'slider' && (
                      <input type="range"
                        min={c.min} max={c.max} step={c.step ?? 1}
                        value={params[c.key]}
                        onChange={e => setParam(c.key, Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#4F7CFF' }} />
                    )}
                    {c.type === 'toggle' && (
                      <button onClick={() => setParam(c.key, !params[c.key])}
                        style={{
                          padding: '4px 10px', borderRadius: 5,
                          border: `1px solid ${params[c.key] ? '#4F7CFF' : '#1f2532'}`,
                          background: params[c.key] ? 'rgba(79, 124, 255, 0.12)' : '#0E1117',
                          color: params[c.key] ? '#A5B4FC' : '#9CA3AF',
                          fontSize: 10, fontWeight: 600, cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}>
                        {params[c.key] ? 'on' : 'off'}
                      </button>
                    )}
                    {c.type === 'select' && c.options && (
                      <select value={params[c.key]} onChange={e => setParam(c.key, e.target.value)}
                        style={{
                          width: '100%', padding: '4px 8px', borderRadius: 5,
                          background: '#0E1117', border: '1px solid #1f2532',
                          color: '#fafafa', fontFamily: 'inherit', fontSize: 11,
                          outline: 'none',
                        }}>
                        {c.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>

              {/* Play/pause/reset */}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => setPlaying(p => !p)} style={btn}>
                  {playing ? <Pause size={11} /> : <Play size={11} />}
                  {playing ? 'Pause' : 'Play'}
                </button>
                <button onClick={reset} style={btn}>
                  <RotateCcw size={11} /> Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI explanation pane */}
        {showText && (
          <div style={{
            overflowY: 'auto', padding: '20px 24px',
            background: '#050505', borderLeft: showSim ? '1px solid #1a1f2e' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Sparkles size={14} color="#A5B4FC" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                AI Lab Assistant
              </span>
              {aiBusy && <Loader2 size={11} color="#6B7280" style={{ animation: 'spin 0.8s linear infinite', marginLeft: 'auto' }} />}
            </div>

            <p style={{ fontSize: 13, color: '#B1B5BA', marginBottom: 18, lineHeight: 1.6, fontStyle: 'italic' }}>
              {description}
            </p>

            {aiErr && (
              <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, fontSize: 12, color: '#f87171' }}>
                {aiErr}
              </div>
            )}

            <AnimatePresence mode="wait">
              {explanation && (
                <motion.div key="exp" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="prose-ai"
                  style={{ fontSize: 13.5, color: '#e4e4e7', lineHeight: 1.7 }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={MARKDOWN_COMPONENTS}>
                    {normalizeMath(explanation)}
                  </ReactMarkdown>
                </motion.div>
              )}
              {!explanation && aiBusy && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: 13, color: '#6B7280' }}>
                  Loading explanation…
                </motion.p>
              )}
            </AnimatePresence>

            {explanation && (
              <div style={{ display: 'flex', gap: 8, marginTop: 18, paddingTop: 14, borderTop: '1px solid #1a1f2e' }}>
                <button onClick={saveExplanation} disabled={savedNote} style={{
                  ...btn, color: savedNote ? '#34d399' : '#A5B4FC',
                  borderColor: savedNote ? 'rgba(52,211,153,0.4)' : 'rgba(79, 124, 255, 0.3)',
                  background: savedNote ? 'rgba(52,211,153,0.08)' : 'rgba(79, 124, 255, 0.08)',
                }}>
                  <Save size={11} />{savedNote ? 'Saved to Notebook' : 'Save to Notebook'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const btn: React.CSSProperties = {
  padding: '6px 11px', borderRadius: 6,
  border: '1px solid #1f2532', background: '#151922',
  color: '#B1B5BA', cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 10.5, fontWeight: 600,
  display: 'flex', alignItems: 'center', gap: 5,
}
