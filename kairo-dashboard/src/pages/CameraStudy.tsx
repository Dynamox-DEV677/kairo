/**
 * Camera Study Mode
 * Snap a photo of homework / textbook / notes → AI explains, solves,
 * makes flashcards, or summarizes.
 *
 * Uses OpenRouter free vision models (Qwen2.5-VL / Nemotron Nano Omni / Qianfan-OCR-Fast).
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import {
  Camera, Upload, X, Sparkles, FileText, BookmarkPlus,
  Lightbulb, RotateCcw, Loader2, CheckCircle2,
} from 'lucide-react'
import { saveRecentChat, makeTitle } from '../lib/recentChats'

// ── Vision-capable free models on OpenRouter ─────────────────────────────────
const VISION_MODELS = [
  {
    id: 'qwen/qwen2.5-vl-72b-instruct:free',
    label: 'Qwen 2.5 VL 72B',
    desc:  'Strong general image understanding · best for diagrams + handwriting',
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    label: 'Nemotron Nano Omni 30B',
    desc:  'Multimodal reasoning · solid for math + science problems',
  },
  {
    id: 'qianfan/qianfan-ocr-fast:free',
    label: 'Qianfan OCR Fast',
    desc:  'OCR-specialized · fastest for plain text extraction',
  },
]

// IMPORTANT: every prompt enforces strict markdown rules so ReactMarkdown renders nicely.
// "## Heading" with a space, "**bold**", "- bullet", $math$. NO "#Heading" without space.
const MD_RULES = `

Format your response in clean markdown:
- Headings start with "## " (TWO hashes and a SPACE, never "##Heading")
- Use blank lines between paragraphs and sections
- Use **bold** for emphasis, - for bullet lists, 1. for numbered lists
- Use $...$ for inline math, $$...$$ for display math
- No code fences around prose
- No <think> tags`

const ACTIONS = [
  { id: 'solve',     label: 'Solve',         icon: Sparkles,     color: '#4F7CFF',
    prompt: 'Read the question(s) in this image carefully. Solve each one step-by-step with clear working.' + MD_RULES },
  { id: 'explain',   label: 'Explain',       icon: Lightbulb,    color: '#A5B4FC',
    prompt: 'Explain the concept(s) shown in this image as if teaching a Class 10 student in India. Use simple language, give an analogy, end with a 3-line summary under "## Summary".' + MD_RULES },
  { id: 'flashcards', label: 'Flashcards',   icon: BookmarkPlus, color: '#A5B4FC',
    prompt: 'Create 8-10 high-quality flashcards from the content in this image. Return ONLY a JSON array: [{"front":"question","back":"answer"}]. No other text, no markdown, no explanation.' },
  { id: 'summarize', label: 'Summarize',     icon: FileText,     color: '#A5B4FC',
    prompt: 'Summarize the content in this image into clear bullet points organized under "## Section Name" headings. Capture all key facts, formulas, and definitions. Keep it tight.' + MD_RULES },
]

interface VisionMsg {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  >
}

export default function CameraStudy() {
  const [imageData, setImageData] = useState<string | null>(null)
  const [model, setModel]         = useState(VISION_MODELS[0].id)
  const [busy, setBusy]           = useState(false)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [result, setResult]       = useState('')
  const [err, setErr]             = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const [streamRef, setStreamRef] = useState<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef     = useRef<HTMLVideoElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)

  // Stop any active camera when leaving the page
  useEffect(() => () => stopCamera(), [streamRef])

  function stopCamera() {
    if (streamRef) {
      streamRef.getTracks().forEach(t => t.stop())
      setStreamRef(null)
    }
    setShowCamera(false)
  }

  async function openCamera() {
    setErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1440 } },
      })
      setStreamRef(stream)
      setShowCamera(true)
      // Wait one frame so the <video> element is mounted
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream
      })
    } catch (e: any) {
      setErr('Camera unavailable: ' + (e.message || 'permission denied'))
    }
  }

  function snap() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)
    setImageData(canvas.toDataURL('image/jpeg', 0.9))
    stopCamera()
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setErr('Please upload an image file.')
      return
    }
    if (file.size > 6 * 1024 * 1024) {
      setErr('Image too large (max 6 MB). Try a smaller photo.')
      return
    }
    const reader = new FileReader()
    reader.onload = ev => {
      setImageData(ev.target?.result as string)
      setErr('')
    }
    reader.readAsDataURL(file)
  }

  const run = useCallback(async (action: typeof ACTIONS[0]) => {
    if (!imageData) return
    setBusy(true); setActiveAction(action.id); setErr(''); setResult('')
    try {
      const messages: VisionMsg[] = [
        {
          role: 'user',
          content: [
            { type: 'text',      text: action.prompt },
            { type: 'image_url', image_url: { url: imageData } },
          ],
        },
      ]
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      const text = data?.choices?.[0]?.message?.content
      if (!text) throw new Error('Empty response — try a different model.')
      setResult(typeof text === 'string' ? text : JSON.stringify(text))

      // Auto-save to recent chats so the user can come back to it
      saveRecentChat({
        id: `cam_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: makeTitle(`📷 ${action.label}: ${typeof text === 'string' ? text.slice(0, 80) : ''}`),
        messages: [
          { id: '1', role: 'user', content: `[Camera Study · ${action.label}]` },
          { id: '2', role: 'assistant', content: typeof text === 'string' ? text : '' },
        ],
        updated: Date.now(),
      })

      // If flashcards, also offer to navigate to flashcards page
      if (action.id === 'flashcards') {
        try {
          const match = (typeof text === 'string' ? text : '').match(/\[[\s\S]*\]/)
          if (match) {
            const cards = JSON.parse(match[0])
            localStorage.setItem('kairo_camera_flashcards', JSON.stringify(cards))
          }
        } catch { /* ignore */ }
      }
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }, [imageData, model])

  const reset = () => {
    setImageData(null); setResult(''); setActiveAction(null); setErr('')
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1100, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: 'linear-gradient(135deg, #4F7CFF, #4F7CFF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 18px rgba(79, 124, 255, 0.4)', flexShrink: 0,
        }}>
          <Camera size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Camera Study Mode</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            Snap a photo of homework, textbook, or notes — AI explains, solves, or turns it into flashcards.
          </p>
        </div>
      </div>

      {/* Model picker */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', marginBottom: 8 }}>
          Vision Model
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {VISION_MODELS.map(m => (
            <button key={m.id} onClick={() => setModel(m.id)} style={{
              padding: '10px 14px', borderRadius: 9,
              border: `1px solid ${model === m.id ? '#4F7CFF' : '#1f2532'}`,
              background: model === m.id ? 'rgba(79, 124, 255, 0.10)' : '#0E1117',
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              transition: 'all 0.15s',
            }}>
              <div style={{
                fontSize: 12, fontWeight: 700,
                color: model === m.id ? '#A5B4FC' : '#d4d4d8', marginBottom: 3,
              }}>
                {m.label}
              </div>
              <div style={{ fontSize: 10.5, color: '#6B7280', lineHeight: 1.4 }}>{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Image area */}
      {!imageData && !showCamera && (
        <div
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          style={{
            border: '2px dashed #2d2d4d', borderRadius: 14, padding: '46px 24px',
            background: '#0E1117', textAlign: 'center', marginBottom: 14,
          }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16, margin: '0 auto 14px',
            background: 'rgba(79, 124, 255, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Upload size={26} color="#66D9FF" />
          </div>
          <p style={{ fontSize: 14, color: '#fafafa', fontWeight: 600, margin: '0 0 6px' }}>
            Drag a photo here, or pick a source
          </p>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 18px' }}>
            JPG / PNG / HEIC up to 6 MB · works best with clear, in-focus shots
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => fileInputRef.current?.click()} style={{
              padding: '10px 18px', borderRadius: 9, border: 'none',
              background: 'linear-gradient(135deg, #4F7CFF, #4F7CFF)', color: '#fff',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <Upload size={13} /> Upload Image
            </button>
            <button onClick={openCamera} style={{
              padding: '10px 18px', borderRadius: 9,
              border: '1px solid #1f2532', background: '#151922', color: '#B1B5BA',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <Camera size={13} /> Use Camera
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </div>
      )}

      {/* Live camera preview */}
      <AnimatePresence>
        {showCamera && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              border: '1px solid #2d2d4d', borderRadius: 14, padding: 12,
              background: '#000', textAlign: 'center', marginBottom: 14,
            }}>
            <video ref={videoRef} autoPlay playsInline
              style={{ width: '100%', maxHeight: 400, borderRadius: 8, objectFit: 'cover' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 10 }}>
              <button onClick={snap} style={{
                padding: '11px 22px', borderRadius: 9, border: 'none',
                background: 'linear-gradient(135deg,#4F7CFF,#4F7CFF)', color: '#fff',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
                <Camera size={14} /> Capture
              </button>
              <button onClick={stopCamera} style={{
                padding: '11px 18px', borderRadius: 9, border: '1px solid #1f2532',
                background: '#151922', color: '#B1B5BA',
                fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
              }}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image preview + actions */}
      {imageData && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div style={{
            background: '#0E1117', border: '1px solid #1f2532', borderRadius: 14, padding: 12,
            position: 'relative',
          }}>
            <img src={imageData} alt="Captured"
              style={{ width: '100%', borderRadius: 8, display: 'block', maxHeight: 400, objectFit: 'contain', background: '#000' }} />
            <button onClick={reset} title="Remove" style={{
              position: 'absolute', top: 18, right: 18, width: 28, height: 28, borderRadius: 7,
              background: 'rgba(0,0,0,0.6)', border: '1px solid #2d2d4d', color: '#fff',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={13} />
            </button>
          </div>

          {/* Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {ACTIONS.map(a => {
              const isActive = activeAction === a.id && busy
              return (
                <motion.button key={a.id}
                  whileHover={{ y: busy ? 0 : -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => run(a)}
                  disabled={busy}
                  style={{
                    padding: 16, borderRadius: 12,
                    border: `1px solid ${isActive ? a.color : '#1f2532'}`,
                    background: isActive ? `${a.color}10` : '#0E1117',
                    cursor: busy ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', textAlign: 'left',
                    display: 'flex', flexDirection: 'column', gap: 8,
                    transition: 'all 0.15s',
                    opacity: busy && !isActive ? 0.5 : 1,
                  }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `${a.color}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isActive
                      ? <Loader2 size={15} color={a.color} style={{ animation: 'spin 0.8s linear infinite' }} />
                      : <a.icon size={15} color={a.color} />}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>
                    {isActive ? `${a.label}…` : a.label}
                  </div>
                </motion.button>
              )
            })}
          </div>
        </motion.div>
      )}

      {err && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(102, 217, 255, 0.08)', border: '1px solid rgba(102, 217, 255, 0.25)', borderRadius: 8, fontSize: 12, color: '#66D9FF' }}>
          {err}
        </div>
      )}

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              background: '#0E1117', border: '1px solid #2d2b55', borderRadius: 14,
              padding: 22,
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <CheckCircle2 size={15} color="#A5B4FC" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                AI Result
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6B7280' }}>
                Saved to recent chats
              </span>
            </div>
            <div className="prose-ai" style={{ fontSize: 14, color: '#e4e4e7', lineHeight: 1.7 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {cleanMarkdown(result)}
              </ReactMarkdown>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => navigator.clipboard.writeText(result)} style={{
                padding: '6px 12px', borderRadius: 7, border: '1px solid #1f2532',
                background: '#151922', color: '#B1B5BA', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5,
              }}>
                Copy
              </button>
              <button onClick={reset} style={{
                padding: '6px 12px', borderRadius: 7, border: '1px solid #1f2532',
                background: '#151922', color: '#B1B5BA', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <RotateCcw size={11} /> Try another image
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Markdown post-processor ────────────────────────────────────────────────
// Vision LLMs sometimes emit malformed markdown (#Heading instead of # Heading,
// stray <think> blocks, code fences around plain text). Clean it up before
// passing to ReactMarkdown so headings, bold, lists actually render.
function cleanMarkdown(s: string): string {
  return s
    // Strip reasoning model thought-blocks
    .replace(/<\/?think(?:ing)?>[\s\S]*?<\/?think(?:ing)?>/gi, '')
    // "##Step" → "## Step" (require space after hashes)
    .replace(/^(\s*#{1,6})([^\s#])/gm, '$1 $2')
    // Stray code fences with no language at the very start/end of plain prose
    .replace(/^\s*```\s*$/gm, '')
    // Collapse 3+ blank lines into 2
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
