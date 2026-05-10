/**
 * Kairo's Solver — split-view doubt solver.
 *
 *   ┌────────────────────────┐ ┌────────┐
 *   │                        │ │        │
 *   │   image slideshow      │ │  AI    │
 *   │   (auto-cycle 2s)      │ │  text  │
 *   │                        │ │        │
 *   └────────────────────────┘ └────────┘
 *   ┌────────────────────────────────────┐
 *   │  ask anything…                  ▶  │
 *   └────────────────────────────────────┘
 *
 * Image slideshow uses Nano Banana (Gemini 2.5 Flash Image) via the backend
 * `/api/ai/visualize` route. Text uses the existing OpenRouter chat stream.
 */
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, StopCircle, Sparkles, Image as ImageIcon, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { chat, DEFAULT_MODEL } from '../lib/openrouter'

const SYSTEM = `You are Kairo, an expert AI tutor for Indian school students (CBSE/ICSE/state, Class 6–12).
Explain concepts clearly with markdown. Use $...$ for inline math, $$...$$ for display math.
Keep answers focused, friendly, and exam-ready.`

interface KairoSolverProps {
  model?: string
}

interface SolverImage {
  mime: string
  data: string  // base64
  prompt: string
}

export default function KairoSolver({ model = DEFAULT_MODEL }: KairoSolverProps) {
  const [input, setInput]               = useState('')
  const [streaming, setStreaming]       = useState(false)
  const [text, setText]                 = useState('')
  const [topic, setTopic]               = useState('')
  const [images, setImages]             = useState<SolverImage[]>([])
  const [imagesBusy, setImagesBusy]     = useState(false)
  const [imagesErr, setImagesErr]       = useState('')
  const [error, setError]               = useState('')

  const stopRef    = useRef(false)
  const abortRef   = useRef<AbortController | null>(null)
  const accRef     = useRef('')
  const taRef      = useRef<HTMLTextAreaElement>(null)

  async function send() {
    const q = input.trim()
    if (!q || streaming) return

    setText('')
    setImages([])
    setImagesErr('')
    setError('')
    setTopic(q)
    setInput('')
    if (taRef.current) taRef.current.style.height = 'auto'

    stopRef.current = false
    accRef.current = ''
    setStreaming(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    // Kick off image generation in PARALLEL with text streaming.
    setImagesBusy(true)
    fetch('/api/ai/visualize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: q, count: 4 }),
    })
      .then(async r => {
        if (!r.ok) {
          const e = await r.json().catch(() => ({}))
          throw new Error(e.error || `HTTP ${r.status}`)
        }
        return r.json()
      })
      .then((data: { images: SolverImage[] }) => {
        if (!stopRef.current) setImages(data.images || [])
      })
      .catch(e => { if (!stopRef.current) setImagesErr(e.message || 'Image generation failed.') })
      .finally(() => setImagesBusy(false))

    // Stream the text answer.
    try {
      await chat({
        model,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: q },
        ],
        onChunk: (_, full) => {
          if (stopRef.current) return
          accRef.current = full
          setText(full)
        },
        signal: ctrl.signal,
      })
    } catch (e: any) {
      if (!stopRef.current && e?.name !== 'AbortError') {
        setError(e?.message || 'Something went wrong')
      }
    } finally {
      setStreaming(false)
    }
  }

  function stop() {
    stopRef.current = true
    abortRef.current?.abort()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
  }

  const hasResult = !!topic

  return (
    <div style={{
      flex: 1, height: '100%', display: 'flex', flexDirection: 'column',
      padding: '20px 24px 0', overflow: 'hidden',
    }}>
      {/* Empty / hero state */}
      {!hasResult && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, #6366f1, #ec4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 32px rgba(99,102,241,0.4)',
          }}>
            <Sparkles size={28} color="#fff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fafafa', margin: 0, letterSpacing: '-0.5px' }}>
            Kairo's Solver
          </h1>
          <p style={{ fontSize: 13, color: '#71717a', margin: 0, textAlign: 'center', maxWidth: 460, lineHeight: 1.6 }}>
            Ask anything. You get a clear written answer on the right and a live picture-book on the left,
            generated from your question — no more reading walls of text.
          </p>
        </div>
      )}

      {/* Result split */}
      {hasResult && (
        <div style={{
          flex: 1, minHeight: 0, display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: 16, paddingBottom: 16,
        }}>
          {/* LEFT — slideshow */}
          <Slideshow
            images={images} busy={imagesBusy} err={imagesErr} topic={topic}
          />

          {/* RIGHT — text */}
          <div style={{
            background: '#0d0d0d', border: '1px solid #1e1e1e',
            borderRadius: 16, padding: 18, overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{
              fontSize: 10, color: '#a5b4fc', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4,
            }}>
              Kairo says
            </div>
            <div style={{ fontSize: 13.5, color: '#e4e4e7', lineHeight: 1.7, flex: 1 }}>
              {text ? (
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {text}
                </ReactMarkdown>
              ) : (
                <div style={{ color: '#52525b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                  Thinking…
                </div>
              )}
              {error && (
                <p style={{ marginTop: 8, color: '#f87171', fontSize: 12 }}>⚠ {error}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Input bar (always at bottom) */}
      <div style={{
        background: '#0d0d0d', border: '1px solid #1e1e1e',
        borderRadius: 14, padding: 10, display: 'flex', alignItems: 'flex-end', gap: 10,
        marginBottom: 18, marginTop: hasResult ? 0 : 14,
      }}>
        <textarea
          ref={taRef}
          value={input}
          onChange={handleInput}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Ask anything — physics, biology, math, history…"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#fafafa', fontFamily: 'inherit', fontSize: 14, resize: 'none',
            padding: '8px 6px', lineHeight: 1.5, maxHeight: 140,
          }}
        />
        {streaming ? (
          <button onClick={stop} style={btnStop}>
            <StopCircle size={14} /> Stop
          </button>
        ) : (
          <button onClick={() => send()} disabled={!input.trim()} style={{
            ...btnSend, opacity: input.trim() ? 1 : 0.45,
            cursor: input.trim() ? 'pointer' : 'not-allowed',
          }}>
            <Send size={14} /> Solve
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Slideshow ────────────────────────────────────────────────────────────
function Slideshow({ images, busy, err, topic }: {
  images: SolverImage[]; busy: boolean; err: string; topic: string
}) {
  const [idx, setIdx] = useState(0)

  // Auto-cycle every 2 seconds.
  useEffect(() => {
    if (images.length < 2) return
    const t = setInterval(() => setIdx(i => (i + 1) % images.length), 2000)
    return () => clearInterval(t)
  }, [images.length])

  // Reset to first slide whenever the image set changes.
  useEffect(() => { setIdx(0) }, [images])

  const current = images[idx]

  return (
    <div style={{
      background: '#0d0d0d', border: '1px solid #1e1e1e',
      borderRadius: 16, overflow: 'hidden', position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 0,
    }}>
      {/* Topic label, top-left */}
      <div style={{
        position: 'absolute', top: 12, left: 14, zIndex: 4,
        padding: '5px 11px', borderRadius: 6,
        background: 'rgba(13,13,13,0.85)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(99,102,241,0.3)',
        fontSize: 10, color: '#a5b4fc', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: 1.5,
        maxWidth: '70%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {topic}
      </div>

      {/* Image area */}
      {busy && images.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, color: '#a1a1aa' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, #6366f1, #ec4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(99,102,241,0.4)',
          }}>
            <Loader2 size={24} color="#fff" style={{ animation: 'spin 0.8s linear infinite' }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Generating diagrams…</div>
          <div style={{ fontSize: 11, color: '#52525b' }}>Nano Banana is drawing 4 illustrations</div>
        </div>
      )}

      {err && images.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: '#f87171', fontSize: 13, maxWidth: 380 }}>
          ⚠ {err}
        </div>
      )}

      <AnimatePresence mode="wait">
        {current && (
          <motion.img
            key={idx}
            src={`data:${current.mime};base64,${current.data}`}
            alt={current.prompt}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{
              maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
              borderRadius: 12,
            }}
          />
        )}
      </AnimatePresence>

      {/* Pagination dots */}
      {images.length > 1 && (
        <div style={{
          position: 'absolute', bottom: 12, left: 0, right: 0, zIndex: 4,
          display: 'flex', justifyContent: 'center', gap: 6,
        }}>
          {images.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              style={{
                width: i === idx ? 22 : 8, height: 8, borderRadius: 4,
                border: 'none', cursor: 'pointer',
                background: i === idx ? '#a5b4fc' : '#3f3f46',
                transition: 'all 0.3s',
              }}
            />
          ))}
        </div>
      )}

      {/* Prev / next arrows */}
      {images.length > 1 && (
        <>
          <button onClick={() => setIdx(i => (i - 1 + images.length) % images.length)}
            style={{ ...arrowBtn, left: 10 }}>
            <ChevronLeft size={16} color="#fafafa" />
          </button>
          <button onClick={() => setIdx(i => (i + 1) % images.length)}
            style={{ ...arrowBtn, right: 10 }}>
            <ChevronRight size={16} color="#fafafa" />
          </button>
        </>
      )}

      {/* "Generating more…" badge while images keep streaming in */}
      {busy && images.length > 0 && (
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 4,
          padding: '4px 9px', borderRadius: 5,
          background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
          fontSize: 10, color: '#a5b4fc', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <Loader2 size={10} style={{ animation: 'spin 0.8s linear infinite' }} />
          Adding more
        </div>
      )}

      {/* No-image fallback */}
      {!busy && images.length === 0 && !err && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: '#52525b' }}>
          <ImageIcon size={32} />
          <div style={{ fontSize: 12 }}>Waiting for slideshow…</div>
        </div>
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────
const btnSend: React.CSSProperties = {
  padding: '9px 14px', borderRadius: 10,
  background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
  color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
  display: 'flex', alignItems: 'center', gap: 6,
  boxShadow: '0 0 16px rgba(99,102,241,0.35)',
}

const btnStop: React.CSSProperties = {
  padding: '9px 14px', borderRadius: 10,
  background: '#7f1d1d', color: '#fff', border: 'none',
  fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 6,
}

const arrowBtn: React.CSSProperties = {
  position: 'absolute', top: '50%', transform: 'translateY(-50%)',
  width: 30, height: 30, borderRadius: 8, zIndex: 4,
  background: 'rgba(13,13,13,0.85)', backdropFilter: 'blur(8px)',
  border: '1px solid #1e1e1e', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
