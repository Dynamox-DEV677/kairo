/**
 * Kairo's Solver — adaptive AI visual learning engine.
 *
 *   ┌────────────────────────────┐ ┌────────────────────┐
 *   │                            │ │ ## What you're     │
 *   │   Cinematic slideshow      │ │     seeing         │
 *   │   (5 sequential edu        │ │ ...                │
 *   │    images, auto 3.5s,      │ │ ## How it works    │
 *   │    ←/→ keyboard nav,       │ │ Formulas:          │
 *   │    parallax + fade)        │ │   F = ma           │
 *   │                            │ │ Related: ...       │
 *   └────────────────────────────┘ │ [Open in Kairo Labs]│
 *   ┌─────────────────────────────────┐
 *   │  ask anything…              ▶   │
 *   └─────────────────────────────────┘
 *
 * Powered by /api/ai/solver — single call returns:
 *   - markdown text (right panel)
 *   - 5 sequential image slides from Wikimedia / Pexels / Unsplash (left)
 *   - lab route if the topic has an interactive Kairo Lab
 *   - related concept chips, formulas
 */
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, StopCircle, Sparkles, Image as ImageIcon, Loader2,
  ChevronLeft, ChevronRight, Beaker, ExternalLink, BookOpen, Atom,
  Mic, MicOff, Calendar, X,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { recordDoubt, recordFormula, recordConcept } from '../lib/twin'
import { lookupNcert } from '../lib/ncertCacheLookup'

interface ImageSlide {
  url:         string
  thumb?:      string
  caption:     string
  source:      'wikimedia' | 'pexels' | 'unsplash'
  attribution?: string
  pageUrl?:    string
}

interface TextPlan {
  questionType:    string
  topicKeyword:    string | null  // clean noun for Wikipedia article lookup
  supports3D:      boolean
  labRoute:        string | null
  textExplanation: string
  formulas:        string[]
  relatedConcepts: string[]
  cached?:         boolean
  imageQueries:    string[]   // backend now ships these so /images skips the LLM call
  videoQuery?:     string     // search query for the explainer video
  modelUsed?:      string     // 'wikipedia-fallback' when AI was unavailable
}

interface SolverResponse extends TextPlan {
  imageSlides:     ImageSlide[]
  imagesBusy:      boolean       // true while images are still loading
  imagesCached:    boolean
  imagesError?:    string
  videoId:         string | null
  videoBusy:       boolean       // true while video search is in flight
}

interface KairoSolverProps {
  model?: string
  onNavigate?: (page: string) => void
  /** Fired with true once a question is asked (locks model selector),
   *  false when the user clears or starts a fresh question. */
  onActiveChange?: (active: boolean) => void
}

const SUGGESTIONS = [
  'Explain Newton\'s laws of motion',
  'How does the human heart work?',
  'What caused the French Revolution?',
  'Photosynthesis step by step',
  'Solve x² - 5x + 6 = 0',
]

export default function KairoSolver({ onNavigate, onActiveChange }: KairoSolverProps) {
  const [input, setInput]               = useState('')
  const [busy, setBusy]                 = useState(false)
  const [topic, setTopic]               = useState('')
  const [resp, setResp]                 = useState<SolverResponse | null>(null)
  const [error, setError]               = useState('')
  const [retryHint, setRetryHint]       = useState('')   // visible during 429 backoff
  const [voiceOn, setVoiceOn]           = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [examModal, setExamModal]       = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const recogRef = useRef<any>(null)

  // ── Web Speech API setup (browser-native, free) ─────────────────────────
  // Replaces the deleted Voice Tutor page. Toggle the mic, speak your doubt,
  // it transcribes into the input field. Auto-submits when you stop speaking.
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setVoiceSupported(false); return }
    setVoiceSupported(true)
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-IN'
    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        .map((r: any) => r[0]?.transcript || '')
        .join(' ').trim()
      setInput(transcript)
    }
    rec.onend = () => {
      setVoiceOn(false)
      // Auto-submit if we captured something meaningful
      setTimeout(() => {
        setInput(prev => {
          if (prev.trim().length > 3) ask(prev)
          return prev
        })
      }, 50)
    }
    rec.onerror = () => setVoiceOn(false)
    recogRef.current = rec
    return () => { try { rec.abort() } catch {} }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleVoice() {
    if (!recogRef.current) return
    if (voiceOn) {
      try { recogRef.current.stop() } catch {}
      setVoiceOn(false)
    } else {
      setInput('')
      try {
        recogRef.current.start()
        setVoiceOn(true)
      } catch { setVoiceOn(false) }
    }
  }

  async function ask(q: string) {
    const question = q.trim()
    if (!question || busy) return

    setError('')
    setRetryHint('')
    setResp(null)
    setTopic(question)
    setInput('')
    setBusy(true)
    onActiveChange?.(true)   // lock model selector
    if (taRef.current) taRef.current.style.height = 'auto'

    const ctrl = new AbortController()
    abortRef.current = ctrl

    // Sequential pipeline that fits Vercel's 10s timeout:
    //   1. /text  → LLM call only (~3-5s on gpt-oss-20b). Returns plan + queries.
    //   2. /images → pure image search using THOSE queries (~2-3s, no LLM).
    const headers = { 'Content-Type': 'application/json' }

    // Auto-retry the /text call up to 2 times on 429 with a short backoff.
    // OpenRouter's free pool throttles in seconds-long bursts, so a single
    // wait+retry almost always succeeds.
    // OpenRouter's free pool throttles in seconds-long bursts but recovers
    // fast. Retry up to 4 times with increasing backoff — total worst-case
    // wait is ~20s but the AVERAGE retry succeeds in 5-7s.
    async function fetchTextWithRetry(attempt = 0): Promise<TextPlan> {
      const MAX_ATTEMPTS = 4
      const r = await fetch('/api/ai/solver/text', {
        method: 'POST', headers,
        body: JSON.stringify({ question }),
        signal: ctrl.signal,
      })
      if (r.ok) return r.json()
      const errBody = await r.json().catch(() => ({}))
      const isRateLimit = r.status === 429 || errBody.rateLimited
      if (isRateLimit && attempt < MAX_ATTEMPTS) {
        // 2.5s, 4.5s, 6.5s, 8.5s
        const waitMs = 2500 + attempt * 2000
        const remaining = MAX_ATTEMPTS - attempt
        setRetryHint(`Free AI is busy — retrying in ${(waitMs / 1000).toFixed(1)}s (${remaining} more ${remaining === 1 ? 'try' : 'tries'})`)
        await new Promise(res => setTimeout(res, waitMs))
        setRetryHint('Retrying…')
        if (ctrl.signal.aborted) throw new DOMException('aborted', 'AbortError')
        return fetchTextWithRetry(attempt + 1)
      }
      if (isRateLimit) {
        throw new Error(
          "Free AI is overloaded right now. Wait 30-60 seconds and ask again — or try a different question."
        )
      }
      throw new Error(errBody.error || `Text endpoint returned ${r.status}`)
    }

    try {
      // ── Local NCERT cache check FIRST ────────────────────────────────
      // For the top ~20 most-common Class 9-12 concept questions we ship a
      // pre-built TextPlan in the bundle. A hit means zero server load —
      // no LLM call, no Vercel function invocation, no Groq quota burn.
      // Typical hit rate on board-exam season: 30-50% of all questions.
      const cacheHit = lookupNcert(question)
      const text: TextPlan = cacheHit
        ? cacheHit
        : await fetchTextWithRetry()
      setRetryHint('')

      // Kick off the video search in parallel — it doesn't depend on images.
      const videoPromise = fetch('/api/ai/solver/video', {
        method: 'POST', headers,
        body: JSON.stringify({
          query:        text.videoQuery || text.topicKeyword || question,
          topicKeyword: text.topicKeyword,
        }),
        signal: ctrl.signal,
      })
        .then(r => r.ok ? r.json() : { videoId: null })
        .catch(() => ({ videoId: null }))

      // Paint text immediately, mark images + video as still loading
      setResp({
        ...text,
        imageSlides: [],
        imagesBusy:  text.imageQueries.length > 0,
        imagesCached: false,
        videoId:     null,
        videoBusy:   true,
      })
      setBusy(false)   // unlock input — user can keep reading

      // ── Persist to unified memory engine ──────────────────────────────
      // Every successful answer flows into twin.doubts + emits a concept_viewed
      // event + records concept + extracts formulas. Downstream pages
      // (Notebook, Concept Map, Mistake Analysis, Formula Sheet) all read
      // from these. Fire-and-forget — failures should never block the UI.
      try {
        recordDoubt({
          question,
          answer:  text.textExplanation,
          topic:   text.topicKeyword || undefined,
          source:  voiceOn ? 'voice' : 'solver',
        })
        // Concept graph: index this topic + its related concepts
        if (text.topicKeyword) {
          recordConcept({
            name:    text.topicKeyword,
            related: text.relatedConcepts || [],
          })
        }
        // Formula sheet auto-collection: every formula the AI returned
        // gets stored. Parser is forgiving — accepts "F = m·a" or
        // "Newton's 2nd Law: F = ma" or just "F = ma".
        for (const raw of (text.formulas || [])) {
          if (!raw || typeof raw !== 'string') continue
          const parts = raw.split(/[:—–]\s+/, 2)
          const name = parts.length === 2 ? parts[0].trim() : (text.topicKeyword || 'Formula')
          const expr = (parts.length === 2 ? parts[1] : raw).trim()
          if (expr.length < 2 || expr.length > 200) continue
          recordFormula({ name, expr, topic: text.topicKeyword || undefined, source: 'solver' })
        }
      } catch { /* ignore */ }

      // When the video lands, merge it in (independent of images).
      videoPromise.then((v: any) => {
        setResp(prev => prev ? { ...prev, videoId: v?.videoId || null, videoBusy: false } : prev)
      })

      // No queries? skip the second call entirely.
      if (text.imageQueries.length === 0) return

      // Fetch images using the queries we already have — no LLM, fast.
      // Pass the AI's clean topicKeyword (e.g. "Photosynthesis") for the
      // Wikipedia article fallback so we don't misroute on the verbose
      // question ("photosynthesis step by step" → "Climate change" article).
      const imgRes = await fetch('/api/ai/solver/images', {
        method: 'POST', headers,
        body: JSON.stringify({
          queries:      text.imageQueries,
          topicKeyword: text.topicKeyword,
          topic:        question,
        }),
        signal: ctrl.signal,
      })
      if (!imgRes.ok) {
        const e = await imgRes.json().catch(() => ({}))
        setResp(prev => prev ? { ...prev, imagesBusy: false, imagesError: e.error || `Image search failed (${imgRes.status})` } : prev)
        return
      }
      const img = await imgRes.json() as { imageSlides: ImageSlide[]; cached: boolean }
      setResp(prev => prev ? {
        ...prev,
        imageSlides:  img.imageSlides || [],
        imagesBusy:   false,
        imagesCached: img.cached || false,
      } : prev)
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e?.message || 'Something went wrong.')
      setBusy(false)
    }
  }

  function stop() {
    abortRef.current?.abort()
    setBusy(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input) }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
  }

  const showResult = !!topic

  return (
    <div style={{
      flex: 1, height: '100%', display: 'flex', flexDirection: 'column',
      padding: '20px 24px 0', overflow: 'hidden', position: 'relative',
    }}>
      {/* Ambient cinematic glow when result is up */}
      {showResult && (
        <div style={{
          position: 'absolute', top: '20%', left: '10%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79, 124, 255, 0.10) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: 0,
        }} />
      )}

      {/* HERO — empty state */}
      {!showResult && <Hero onPick={ask} />}

      {/* RESULT — split pane (stacks vertically on mobile via .ks-result) */}
      {showResult && (
        <div className="ks-result" style={{
          flex: 1, minHeight: 0, position: 'relative', zIndex: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
          gap: 14, paddingBottom: 14,
        }}>
          {/* LEFT — video on top, slideshow strip below */}
          <LeftPanel
            videoId={resp?.videoId ?? null}
            videoBusy={resp?.videoBusy === true}
            slides={resp?.imageSlides || []}
            imagesBusy={(busy && !resp) || resp?.imagesBusy === true}
            topic={topic}
            questionType={resp?.questionType}
            imagesErr={resp?.imagesError}
          />

          {/* RIGHT — explanation */}
          <ExplanationPanel
            resp={resp}
            busy={busy && !resp}
            error={error}
            retryHint={retryHint}
            onOpenLab={(route) => onNavigate?.('labs:' + route)}
            onAskRelated={(c) => ask(c)}
          />
        </div>
      )}

      {/* INPUT */}
      <div style={{
        background: '#0E1117', border: `1px solid ${voiceOn ? 'rgba(102, 217, 255, 0.55)' : '#1f2532'}`,
        borderRadius: 14, padding: 10,
        display: 'flex', alignItems: 'flex-end', gap: 10,
        marginBottom: 18, marginTop: showResult ? 0 : 14,
        position: 'relative', zIndex: 2,
        transition: 'border-color .2s ease, box-shadow .2s ease',
        boxShadow: voiceOn ? '0 0 28px rgba(79, 124, 255, 0.35)' : 'none',
      }}>
        <textarea
          ref={taRef}
          value={input}
          onChange={handleInput}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={voiceOn
            ? 'Listening… speak your doubt'
            : (showResult ? 'Ask another question…' : 'Ask anything — physics, biology, math, history…')}
          disabled={busy}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#fafafa', fontFamily: 'inherit', fontSize: 14, resize: 'none',
            padding: '8px 6px', lineHeight: 1.5, maxHeight: 140,
          }}
        />
        {/* Voice toggle — only shown if browser supports Web Speech */}
        {voiceSupported && !busy && (
          <button
            onClick={toggleVoice}
            title={voiceOn ? 'Stop listening' : 'Speak your doubt'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 10,
              background: voiceOn ? 'rgba(102, 217, 255, 0.18)' : 'transparent',
              border: `1px solid ${voiceOn ? 'rgba(102, 217, 255, 0.55)' : 'rgba(255,255,255,0.08)'}`,
              color: voiceOn ? '#A5B4FC' : '#B1B5BA',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
              boxShadow: voiceOn ? '0 0 14px rgba(79, 124, 255, 0.32)' : 'none',
            }}>
            {voiceOn ? <Mic size={14} className="kr-voice-pulse" /> : <MicOff size={14} />}
            {voiceOn ? 'Listening' : 'Voice'}
          </button>
        )}
        {/* Exam plan button — replaces the deleted Panic Mode page */}
        {!busy && (
          <button onClick={() => setExamModal(true)} title="Plan your exam"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 10,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#B1B5BA', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}>
            <Calendar size={14} />
            Exam
          </button>
        )}
        {busy ? (
          <button onClick={stop} style={btnStop}>
            <StopCircle size={14} /> Stop
          </button>
        ) : (
          <button onClick={() => ask(input)} disabled={!input.trim()} style={{
            ...btnSend, opacity: input.trim() ? 1 : 0.45,
            cursor: input.trim() ? 'pointer' : 'not-allowed',
          }}>
            <Send size={14} /> Solve
          </button>
        )}
        <style>{`
          @keyframes kr-voice-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.45 } }
          .kr-voice-pulse { animation: kr-voice-pulse 1.2s ease-in-out infinite }
        `}</style>
      </div>

      {/* Exam planner modal — saves to localStorage so Kairo OS countdown works */}
      <AnimatePresence>
        {examModal && <ExamPlanModal onClose={() => setExamModal(false)} />}
      </AnimatePresence>
    </div>
  )
}

// ─── Exam plan modal (replaces deleted PanicMode page) ──────────────────────
function ExamPlanModal({ onClose }: { onClose: () => void }) {
  const [subject, setSubject] = useState('')
  const [date, setDate]       = useState('')
  const [topics, setTopics]   = useState('')
  function save() {
    if (!subject.trim() || !date) return
    try {
      const key = 'kairo:exams'
      const list = JSON.parse(localStorage.getItem(key) || '[]')
      list.push({
        id:       Math.random().toString(36).slice(2, 10),
        subject:  subject.trim(),
        date,
        topics:   topics.split(',').map(t => t.trim()).filter(Boolean),
        createdAt: Date.now(),
      })
      localStorage.setItem(key, JSON.stringify(list))
      onClose()
    } catch { onClose() }
  }
  const daysLeft = date ? Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000)) : 0
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)',
        display: 'grid', placeItems: 'center', padding: 16,
      }}>
      <motion.div
        initial={{ y: 12, scale: 0.96 }} animate={{ y: 0, scale: 1 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 460,
          background: '#0E1117',
          border: '1px solid rgba(102, 217, 255, 0.35)',
          borderRadius: 18, padding: 24,
          color: '#fafafa', fontFamily: 'inherit',
          boxShadow: '0 24px 60px rgba(79, 124, 255, 0.03)',
          position: 'relative',
        }}>
        <button onClick={onClose} aria-label="Close" style={{
          position: 'absolute', top: 14, right: 14,
          width: 30, height: 30, borderRadius: 8,
          background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
          color: '#9CA3AF', cursor: 'pointer', display: 'grid', placeItems: 'center',
        }}>
          <X size={14} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Calendar size={16} color="#66D9FF" />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#66D9FF', textTransform: 'uppercase', letterSpacing: 2 }}>
            Plan an exam
          </span>
        </div>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Add an exam to your countdown</h3>
        <p style={{ margin: '4px 0 14px', fontSize: 12.5, color: '#9CA3AF' }}>
          Saved on this device. Kairo OS will show the countdown + adjust your weak-topic revisions toward the exam date.
        </p>
        <ExamLabel>Subject *</ExamLabel>
        <ExamInput value={subject} onChange={setSubject} placeholder="e.g. Physics" autoFocus />
        <ExamLabel>Date *</ExamLabel>
        <ExamInput type="date" value={date} onChange={setDate} />
        {date && (
          <p style={{ margin: '6px 0 0', fontSize: 11.5, color: daysLeft <= 7 ? '#A5B4FC' : '#9CA3AF' }}>
            {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days from today`}
          </p>
        )}
        <ExamLabel>Topics to focus on (optional)</ExamLabel>
        <ExamInput value={topics} onChange={setTopics} placeholder="comma-separated, e.g. vectors, optics" />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} style={{
            padding: '9px 16px', borderRadius: 9,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
            color: '#B1B5BA', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={save} disabled={!subject.trim() || !date} style={{
            padding: '9px 20px', borderRadius: 9,
            background: 'linear-gradient(135deg, #4F7CFF, #2046C2)',
            color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
            border: 'none', cursor: subject.trim() && date ? 'pointer' : 'not-allowed',
            opacity: subject.trim() && date ? 1 : 0.5,
          }}>Save exam</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ExamLabel({ children }: { children: React.ReactNode }) {
  return <div style={{
    fontSize: 10.5, fontWeight: 700, color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 1.4, margin: '12px 0 6px',
  }}>{children}</div>
}
function ExamInput({ value, onChange, placeholder, autoFocus, type }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; type?: string }) {
  return (
    <input type={type || 'text'} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} autoFocus={autoFocus}
      style={{
        width: '100%', boxSizing: 'border-box',
        padding: '10px 12px', borderRadius: 10,
        background: '#151922', border: '1px solid rgba(255,255,255,0.06)',
        color: '#fafafa', fontFamily: 'inherit', fontSize: 13, outline: 'none',
      }} />
  )
}

// ════════════════════════════════════════════════════════════════════════════
// HERO — empty state with suggestions
// ════════════════════════════════════════════════════════════════════════════
function Hero({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 18,
      position: 'relative',
    }}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: 76, height: 76, borderRadius: 18,
          // Match the rest of the brand — black squircle, soft purple halo.
          background: '#050505',
          border: '1px solid rgba(79, 124, 255, 0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 40px rgba(79, 124, 255, 0.03)',
          padding: 12,
        }}>
        <img
          src="/kairo_logo.png"
          alt="Kairo"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </motion.div>
      <div style={{ textAlign: 'center', maxWidth: 520 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fafafa', margin: 0, letterSpacing: '-0.5px' }}>
          Kairo's Solver
        </h1>
        <p style={{ fontSize: 13.5, color: '#B1B5BA', margin: '8px 0 0', lineHeight: 1.6 }}>
          Ask anything. Kairo writes a clear explanation on the right and builds a
          live picture-book on the left — sourced from Wikimedia and educational image libraries.
        </p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 580, marginTop: 6 }}>
        {SUGGESTIONS.map(s => (
          <motion.button key={s} onClick={() => onPick(s)}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            style={{
              padding: '8px 14px', borderRadius: 100,
              background: 'rgba(79, 124, 255, 0.06)',
              border: '1px solid rgba(79, 124, 255, 0.2)',
              color: '#A5B4FC', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}>
            {s}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// LEFT PANEL — video player (top) + slideshow strip (bottom)
// ════════════════════════════════════════════════════════════════════════════
function LeftPanel({
  videoId, videoBusy,
  slides, imagesBusy, topic, questionType, imagesErr,
}: {
  videoId:    string | null
  videoBusy:  boolean
  slides:     ImageSlide[]
  imagesBusy: boolean
  topic:      string
  questionType?: string
  imagesErr?: string
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateRows: 'minmax(0, 2.2fr) minmax(0, 1fr)',
      gap: 12, minHeight: 0,
    }}>
      <VideoPlayer videoId={videoId} busy={videoBusy} topic={topic} />
      <Slideshow
        slides={slides} busy={imagesBusy} topic={topic}
        questionType={questionType} err={imagesErr}
        compact
      />
    </div>
  )
}

function VideoPlayer({ videoId, busy, topic }: {
  videoId: string | null; busy: boolean; topic: string
}) {
  return (
    <div style={{
      background: '#000', border: '1px solid #1f2532',
      borderRadius: 18, overflow: 'hidden', position: 'relative',
      minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Topic chip — "Kairo Lesson" framing, doesn't name the source */}
      <div style={{
        position: 'absolute', top: 12, left: 14, zIndex: 4,
        padding: '6px 12px', borderRadius: 7,
        background: 'rgba(13,13,13,0.85)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(79, 124, 255, 0.3)',
        fontSize: 10.5, color: '#A5B4FC', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: 1.5,
        maxWidth: '70%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Sparkles size={11} /> Kairo lesson · {topic}
      </div>

      {busy && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: '#B1B5BA' }}>
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: 52, height: 52, borderRadius: 13,
              background: 'linear-gradient(135deg, #4F7CFF, #66D9FF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <Loader2 size={22} color="#fff" style={{ animation: 'spin 0.8s linear infinite' }} />
          </motion.div>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>Loading lesson video…</div>
        </div>
      )}

      {!busy && !videoId && (
        <div style={{ color: '#6B7280', fontSize: 12.5, padding: 16, textAlign: 'center' }}>
          No video available for this topic — the slideshow below has visuals.
        </div>
      )}

      {videoId && (
        <>
          <iframe
            // youtube-nocookie + modestbranding + rel=0 keeps branding minimal.
            // autoplay=1 with mute=1 is allowed by all browsers' autoplay policies.
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&modestbranding=1&rel=0&controls=1&playsinline=1&iv_load_policy=3`}
            title="Lesson video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{
              width: '100%', height: '100%',
              border: 'none', borderRadius: 0,
            }}
          />
          {/* Subtle top-right Kairo overlay — visually reframes the player.
              Does NOT cover playback controls or the video itself. */}
          <div style={{
            position: 'absolute', bottom: 8, right: 12, zIndex: 4,
            padding: '3px 8px', borderRadius: 5,
            background: 'rgba(13,13,13,0.6)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(79, 124, 255, 0.25)',
            fontSize: 9, color: '#A5B4FC', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 1,
            pointerEvents: 'none',
          }}>
            Kairo
          </div>
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDESHOW — bottom strip
// ════════════════════════════════════════════════════════════════════════════
function Slideshow({ slides, busy, topic, questionType, err, compact = false }: {
  slides: ImageSlide[]; busy: boolean; topic: string; questionType?: string; err?: string; compact?: boolean
}) {
  const [idx, setIdx] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-cycle every 3.5s
  useEffect(() => {
    if (slides.length < 2) return
    const t = setInterval(() => setIdx(i => (i + 1) % slides.length), 3500)
    return () => clearInterval(t)
  }, [slides.length])

  // Reset to first slide when slides change
  useEffect(() => { setIdx(0) }, [slides])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (slides.length < 2) return
      // Don't hijack typing
      const target = e.target as HTMLElement
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowLeft')  setIdx(i => (i - 1 + slides.length) % slides.length)
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % slides.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slides.length])

  const current = slides[idx]

  return (
    <div ref={containerRef}
      style={{
        background: '#050505', border: '1px solid #1f2532',
        borderRadius: 18, overflow: 'hidden', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 0,
        boxShadow: '0 0 60px rgba(79, 124, 255, 0.01) inset',
      }}>
      {/* Topic label */}
      <div style={{
        position: 'absolute', top: 14, left: 14, zIndex: 4,
        padding: '6px 12px', borderRadius: 7,
        background: 'rgba(13,13,13,0.85)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(79, 124, 255, 0.3)',
        fontSize: 10.5, color: '#A5B4FC', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: 1.5,
        maxWidth: '70%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {iconForType(questionType)}
        {topic}
      </div>

      {/* Slide counter */}
      {slides.length > 0 && (
        <div style={{
          position: 'absolute', top: 14, right: 14, zIndex: 4,
          padding: '5px 11px', borderRadius: 6,
          background: 'rgba(13,13,13,0.85)', backdropFilter: 'blur(12px)',
          border: '1px solid #1f2532',
          fontSize: 10, color: '#B1B5BA', fontWeight: 700,
          fontFamily: 'monospace', letterSpacing: 0.5,
        }}>
          {idx + 1} / {slides.length}
        </div>
      )}

      {/* Loading / error states */}
      {busy && slides.length === 0 && <SlideshowSkeleton />}

      {!busy && slides.length === 0 && !err && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: '#6B7280' }}>
          <ImageIcon size={36} />
          <div style={{ fontSize: 13, fontWeight: 600 }}>No images found</div>
          <div style={{ fontSize: 11, color: '#4B5563', maxWidth: 260, textAlign: 'center' }}>
            We couldn't find good visuals for this topic. The text answer is still on the right.
          </div>
        </div>
      )}

      {!busy && err && slides.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 24, textAlign: 'center', color: '#66D9FF', maxWidth: 360 }}>
          <ImageIcon size={28} />
          <div style={{ fontSize: 13, fontWeight: 600 }}>Couldn't load images</div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>{err}</div>
        </div>
      )}

      {/* The image */}
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={`slide-${idx}-${current.url}`}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <img
              src={current.url}
              alt={current.caption}
              loading="eager"
              style={{
                maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
                borderRadius: 8,
              }}
            />
            {/* Caption overlay */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '32px 18px 18px',
              background: 'linear-gradient(180deg, transparent 0%, rgba(10,10,10,0.92) 70%)',
              pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 12.5, color: '#fafafa', fontWeight: 600, lineHeight: 1.5, marginBottom: 4 }}>
                {current.caption}
              </div>
              <div style={{ fontSize: 10, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  padding: '1px 6px', borderRadius: 3,
                  background: 'rgba(79, 124, 255, 0.15)', color: '#A5B4FC',
                  textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700,
                }}>{current.source}</span>
                {current.attribution && <span style={{ pointerEvents: 'auto' }}>{current.attribution}</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination dots */}
      {slides.length > 1 && (
        <div style={{
          position: 'absolute', bottom: 14, left: 0, right: 0, zIndex: 4,
          display: 'flex', justifyContent: 'center', gap: 6,
        }}>
          {slides.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              aria-label={`Slide ${i + 1}`}
              style={{
                width: i === idx ? 24 : 8, height: 8, borderRadius: 4,
                border: 'none', cursor: 'pointer',
                background: i === idx ? '#A5B4FC' : '#4B5563',
                transition: 'all 0.3s',
              }}
            />
          ))}
        </div>
      )}

      {/* Prev / next arrows */}
      {slides.length > 1 && (
        <>
          <button onClick={() => setIdx(i => (i - 1 + slides.length) % slides.length)}
            aria-label="Previous slide"
            style={{ ...arrowBtn, left: 12 }}>
            <ChevronLeft size={18} color="#fafafa" />
          </button>
          <button onClick={() => setIdx(i => (i + 1) % slides.length)}
            aria-label="Next slide"
            style={{ ...arrowBtn, right: 12 }}>
            <ChevronRight size={18} color="#fafafa" />
          </button>
        </>
      )}
    </div>
  )
}

function SlideshowSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, color: '#B1B5BA' }}>
      <motion.div
        animate={{ scale: [1, 1.08, 1], rotate: [0, 6, -6, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'linear-gradient(135deg, #4F7CFF, #66D9FF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 32px rgba(79, 124, 255, 0.04)',
          padding: 8,
        }}>
        <img
          src="/kairo_logo.png"
          alt="Kairo"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </motion.div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>Building your visual lesson…</div>
      <div style={{ fontSize: 11, color: '#9CA3AF', maxWidth: 320, textAlign: 'center', lineHeight: 1.5 }}>
        Searching Wikimedia + educational image libraries · Generating storyboard · Writing explanation
      </div>
      {/* Animated bar */}
      <div style={{ width: 200, height: 3, background: '#1f2532', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
        <motion.div
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: '40%', height: '100%', background: 'linear-gradient(90deg, transparent, #4F7CFF, transparent)' }}
        />
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// EXPLANATION PANEL — right
// ════════════════════════════════════════════════════════════════════════════
function ExplanationPanel({ resp, busy, error, retryHint, onOpenLab, onAskRelated }: {
  resp: SolverResponse | null
  busy: boolean
  error: string
  retryHint?: string
  onOpenLab: (route: string) => void
  onAskRelated: (concept: string) => void
}) {
  return (
    <div style={{
      background: '#0E1117', border: '1px solid #1f2532',
      borderRadius: 18, padding: 20, overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{
        fontSize: 10, color: '#A5B4FC', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: 1.5,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Sparkles size={12} /> Kairo says
        {resp?.modelUsed === 'wikipedia-fallback' && (
          <span style={{
            marginLeft: 'auto',
            padding: '2px 7px', borderRadius: 4,
            background: 'rgba(165, 180, 252, 0.10)', color: '#A5B4FC',
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8,
          }}>Wikipedia mode</span>
        )}
        {resp?.cached && resp?.modelUsed !== 'wikipedia-fallback' && (
          <span style={{
            marginLeft: 'auto',
            padding: '2px 7px', borderRadius: 4,
            background: 'rgba(165, 180, 252, 0.10)', color: '#A5B4FC',
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8,
          }}>Cached</span>
        )}
      </div>

      {/* Body */}
      {busy && <ExplanationSkeleton retryHint={retryHint} />}

      {error && (
        <div style={{
          padding: '14px 16px', borderRadius: 12,
          background: 'rgba(102, 217, 255, 0.08)', border: '1px solid rgba(102, 217, 255, 0.28)',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#66D9FF', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 4 }}>
              ⚠ Couldn't fetch an answer
            </div>
            <div style={{ fontSize: 13, color: '#e4e4e7', lineHeight: 1.55 }}>
              {error}
            </div>
          </div>
          {topic && !busy && (
            <button
              onClick={() => ask(topic)}
              style={{
                padding: '8px 14px', borderRadius: 9,
                background: 'linear-gradient(135deg, #4F7CFF 0%, #2046C2 50%, #4F7CFF 100%)',
                color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 12,
                border: 'none', cursor: 'pointer', flexShrink: 0,
                boxShadow: '0 6px 18px rgba(79, 124, 255, 0.04)',
              }}>
              Try again
            </button>
          )}
        </div>
      )}

      {resp && (
        <>
          {/* Markdown explanation */}
          <div style={{ fontSize: 13.5, color: '#e4e4e7', lineHeight: 1.75 }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={MD_COMPONENTS}
            >
              {resp.textExplanation}
            </ReactMarkdown>
          </div>

          {/* Formulas (highlighted) */}
          {resp.formulas.length > 0 && (
            <div style={{
              padding: '12px 14px', borderRadius: 11,
              background: 'rgba(79, 124, 255, 0.05)', border: '1px solid rgba(79, 124, 255, 0.2)',
            }}>
              <div style={{
                fontSize: 10, color: '#A5B4FC', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <BookOpen size={11} /> Key formulas
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {resp.formulas.map((f, i) => (
                  <div key={i} style={{ fontSize: 13.5, color: '#fafafa' }}>
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {`$$${f}$$`}
                    </ReactMarkdown>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lab CTA */}
          {resp.labRoute && (
            <motion.button
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
              onClick={() => onOpenLab(resp.labRoute!)}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(102, 217, 255, 0.18), rgba(79, 124, 255, 0.18))',
                border: '1px solid rgba(102, 217, 255, 0.14)',
                color: '#fafafa', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: '0 0 24px rgba(102, 217, 255, 0.01)',
              }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: 'linear-gradient(135deg, #66D9FF, #4F7CFF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Beaker size={16} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Open in Kairo Labs</div>
                <div style={{ fontSize: 11, color: '#B1B5BA', marginTop: 1 }}>
                  Tweak parameters, watch it live in 3D
                </div>
              </div>
              <ExternalLink size={14} color="#A5B4FC" />
            </motion.button>
          )}

          {/* Related concepts */}
          {resp.relatedConcepts.length > 0 && (
            <div>
              <div style={{
                fontSize: 10, color: '#9CA3AF', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8,
              }}>
                Explore further
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {resp.relatedConcepts.map((c, i) => (
                  <motion.button key={i}
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    onClick={() => onAskRelated(c)}
                    style={{
                      padding: '6px 11px', borderRadius: 100,
                      background: '#151922', border: '1px solid #1f2532',
                      color: '#A5B4FC', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600,
                      cursor: 'pointer',
                    }}>
                    {c}
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ExplanationSkeleton({ retryHint }: { retryHint?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
      {[100, 92, 78, 96, 88].map((w, i) => (
        <motion.div key={i}
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          style={{ height: 10, width: `${w}%`, background: '#1f2532', borderRadius: 5 }}
        />
      ))}
      <div style={{ height: 10 }} />
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        color: retryHint ? '#A5B4FC' : '#6B7280',
        fontSize: 11,
      }}>
        <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
        {retryHint || 'Writing explanation…'}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════
function iconForType(t?: string) {
  if (!t) return <Sparkles size={11} />
  if (t === 'physics' || t === 'math') return <Atom size={11} />
  if (t === 'chemistry') return <Beaker size={11} />
  return <BookOpen size={11} />
}

const MD_COMPONENTS = {
  p:  ({ children }: any) => <p style={{ margin: '0 0 10px', lineHeight: 1.75 }}>{children}</p>,
  h1: ({ children }: any) => <h1 style={{ fontSize: 17, fontWeight: 800, color: '#fafafa', margin: '12px 0 8px' }}>{children}</h1>,
  h2: ({ children }: any) => <h2 style={{ fontSize: 14, fontWeight: 700, color: '#A5B4FC', margin: '14px 0 6px', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>{children}</h2>,
  h3: ({ children }: any) => <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fafafa', margin: '10px 0 4px' }}>{children}</h3>,
  strong: ({ children }: any) => <strong style={{ color: '#fafafa', fontWeight: 700 }}>{children}</strong>,
  em:     ({ children }: any) => <em style={{ color: '#A5B4FC' }}>{children}</em>,
  ul: ({ children }: any) => <ul style={{ paddingLeft: 18, margin: '6px 0 10px' }}>{children}</ul>,
  ol: ({ children }: any) => <ol style={{ paddingLeft: 18, margin: '6px 0 10px' }}>{children}</ol>,
  li: ({ children }: any) => <li style={{ marginBottom: 3, color: '#d4d4d8' }}>{children}</li>,
  code: ({ children, className }: any) => {
    const isBlock = !!className
    return isBlock
      ? <pre style={{ background: '#050505', border: '1px solid #1f2532', borderRadius: 8, padding: '10px 12px', overflowX: 'auto', margin: '8px 0' }}>
          <code style={{ fontSize: 12.5, color: '#A5B4FC', fontFamily: 'monospace' }}>{children}</code>
        </pre>
      : <code style={{ background: '#1a1a2e', padding: '2px 6px', borderRadius: 4, fontSize: 12.5, color: '#A5B4FC', fontFamily: 'monospace' }}>{children}</code>
  },
  blockquote: ({ children }: any) => <blockquote style={{ borderLeft: '3px solid #4F7CFF', paddingLeft: 12, margin: '8px 0', color: '#B1B5BA', fontStyle: 'italic' }}>{children}</blockquote>,
}

// ─── Styles ───────────────────────────────────────────────────────────────
const btnSend: React.CSSProperties = {
  padding: '9px 14px', borderRadius: 10,
  background: 'linear-gradient(135deg, #4F7CFF, #4F7CFF)',
  color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
  display: 'flex', alignItems: 'center', gap: 6,
  boxShadow: '0 0 16px rgba(79, 124, 255, 0.03)',
}

const btnStop: React.CSSProperties = {
  padding: '9px 14px', borderRadius: 10,
  background: '#0B1530', color: '#fff', border: 'none',
  fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 6,
}

const arrowBtn: React.CSSProperties = {
  position: 'absolute', top: '50%', transform: 'translateY(-50%)',
  width: 34, height: 34, borderRadius: 9, zIndex: 4,
  background: 'rgba(13,13,13,0.85)', backdropFilter: 'blur(10px)',
  border: '1px solid rgba(79, 124, 255, 0.3)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
