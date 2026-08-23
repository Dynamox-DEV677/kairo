import { useState, useRef, useEffect, useMemo } from 'react'
import GeoVisualMode from '../components/GeoVisualMode'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, StopCircle, Sparkles, Image as ImageIcon, Loader2,
  ChevronLeft, ChevronRight, Beaker, ExternalLink, BookOpen, Atom, RefreshCw, Layers, Headphones,
  Mic, MicOff, Calendar, X, Paperclip,
  FileText as TextIcon, MapPin as MapPinIcon,
  Box as Box3DIcon, LayoutPanelTop as BothIcon, Wand2, Camera,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { recordDoubt, recordFormula, recordConcept, recordFlashcard, getStudentMemory, getMistakes } from '../lib/twin'
import { startTopicClock } from '../lib/timeTracker'
import { buildClozeCards } from '../lib/cloze.core'
import { speakableText } from '../lib/listen.core'
import { speak, stopSpeaking, ttsAvailable } from '../lib/tts'
import { lookupNcert } from '../lib/ncertCacheLookup'
import { aiHeaders } from '../lib/devKey'

interface ImageSlide {
  url:         string
  thumb?:      string
  caption:     string
  source:      'wikimedia' | 'pexels' | 'unsplash' | 'kairo-ai'
  attribution?: string
  pageUrl?:    string
}

interface GeographySection {
  heading: string
  body:    string
}

export interface GeographyData {
  name:     string
  kind:     'region' | 'country' | 'city' | 'river' | 'mountain' | 'desert' | 'forest' | 'ocean' | 'continent' | 'other'
  zoom:     number
  lat:      number | null
  lng:      number | null
  sections: GeographySection[]
  pageUrl:  string | null
}

interface TextPlan {
  questionType:    string
  topicKeyword:    string | null
  supports3D:      boolean
  labRoute:        string | null
  textExplanation: string
  formulas:        string[]
  relatedConcepts: string[]
  cached?:         boolean
  imageQueries:    string[]
  videoQuery?:     string
  modelUsed?:      string
  geography?:      GeographyData | null
}

interface SolverResponse extends TextPlan {
  imageSlides:     ImageSlide[]
  imagesBusy:      boolean
  imagesCached:    boolean
  imagesError?:    string
  videoId:         string | null
  videoBusy:       boolean
}

export type SolverViewMode = 'auto' | 'text' | 'visual' | 'map' | '3d' | 'both'

interface KairoSolverProps {
  model?: string
  onNavigate?: (page: string) => void
  onActiveChange?: (active: boolean) => void
}

const SUGGESTIONS = [
  'Explain Newton\'s laws of motion',
  'How does the human heart work?',
  'What caused the French Revolution?',
  'Photosynthesis step by step',
  'Solve x² - 5x + 6 = 0',
]

// --- Last-solve persistence (survives reload + Chat<->Visual toggle remount) ---
const SOLVE_KEY = 'kairo:solve:last'

function loadLastSolve(): { topic: string; resp: SolverResponse | null } {
  try {
    const raw = localStorage.getItem(SOLVE_KEY)
    if (!raw) return { topic: '', resp: null }
    const v = JSON.parse(raw)
    if (v && typeof v.topic === 'string') {
      // Force any in-flight flags off so a restored solve never shows a stuck spinner.
      const resp = v.resp ? { ...v.resp, imagesBusy: false, videoBusy: false } : null
      return { topic: v.topic, resp }
    }
  } catch {  }
  return { topic: '', resp: null }
}

export default function KairoSolver({ onNavigate, onActiveChange }: KairoSolverProps) {
  const [boot]                          = useState(loadLastSolve)
  const [input, setInput]               = useState('')
  const [busy, setBusy]                 = useState(false)
  const [topic, setTopic]               = useState(boot.topic)
  const [resp, setResp]                 = useState<SolverResponse | null>(boot.resp)

  // C24 — reading time on an answer counts toward its topic. The clock follows
  // whichever answer is on screen and pauses while the tab is hidden.
  const timeClockRef = useRef<ReturnType<typeof startTopicClock> | null>(null)
  useEffect(() => {
    if (!resp?.topicKeyword) return
    if (!timeClockRef.current) timeClockRef.current = startTopicClock()
    timeClockRef.current.switch('General', resp.topicKeyword)
  }, [resp?.topicKeyword])
  useEffect(() => () => { timeClockRef.current?.stop(); timeClockRef.current = null }, [])
  const [error, setError]               = useState('')
  const [retryHint, setRetryHint]       = useState('')
  const [voiceOn, setVoiceOn]           = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [examModal, setExamModal]       = useState(false)
  const [viewMode, setViewMode]         = useState<SolverViewMode>('auto')
  const [autoSwitched, setAutoSwitched] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  /* ── attached document: read once, then answer questions from it ── */
  const docInputRef = useRef<HTMLInputElement>(null)
  const [docBusy, setDocBusy] = useState(false)
  const [docName, setDocName] = useState('')
  const [docText, setDocText] = useState('')   // Kyno's reading of the document

  // Snap-and-Solve. `snapNote` carries the honesty message — how sure the
  // transcription is — because the student is about to send it as their own
  // question and deserves to know whether to read it twice.
  const [snapBusy, setSnapBusy] = useState(false)
  const [snapNote, setSnapNote] = useState('')
  const snapInputRef = useRef<HTMLInputElement>(null)

  /**
   * Photograph a problem, get an EDITABLE transcription in the composer.
   *
   * Deliberately does not answer the question. The transcription lands in the
   * normal input box, so the student reads it, fixes whatever the model
   * misread, and presses send — after which it is an ordinary question going
   * through the ordinary pipeline. Auto-solving from the photo would mean
   * answering a question they never confirmed, and a single misread digit
   * produces a confident answer to the wrong problem.
   */
  async function snapSolve(file: File) {
    setSnapBusy(true)
    setSnapNote('')
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader()
        fr.onerror = () => reject(new Error('read failed'))
        fr.onloadend = () => resolve(String(fr.result))
        fr.readAsDataURL(file)
      })

      const r = await fetch('/api/camera/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...aiHeaders() },
        body: JSON.stringify({ image: dataUrl, mode: 'transcribe' }),
      })
      const j = await r.json().catch(() => null)

      if (!r.ok || !j || j.readable === false || !j.text) {
        // Never a dead end — the student still has a keyboard.
        setSnapNote("Couldn't read that photo. Try better light, or just type the question.")
        taRef.current?.focus()
        return
      }

      setInput(j.text)
      const conf = Number(j.confidence)
      setSnapNote(
        Number.isFinite(conf) && conf < 70
          ? 'Read it, and fix anything wrong before you send — the photo was hard to make out.'
          : 'Check it looks right, then send.',
      )
      // Focus the box so correcting is the obvious next move, not sending.
      setTimeout(() => taRef.current?.focus(), 50)
    } catch (e: any) {
      setSnapNote(`Couldn't read that photo. ${String(e?.message || '').slice(0, 60)} — try typing it instead.`)
    } finally {
      setSnapBusy(false)
    }
  }

  async function readDocument(file: File) {
    setDocBusy(true)
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader()
        fr.onerror = () => reject(new Error('read failed'))
        fr.onloadend = () => resolve(String(fr.result).split(',')[1] || '')
        fr.readAsDataURL(file)
      })
      const r = await fetch('/api/document/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...aiHeaders() },
        body: JSON.stringify({ file: b64, mime: file.type, name: file.name, mode: 'notes' }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok || !j?.markdown) {
        setDocName('')
        setDocText('')
        alert(j?.error || `Could not read that document (${r.status}).`)
        return
      }
      setDocName(file.name)
      setDocText(j.markdown)
      setInput(prev => prev || `Explain the key ideas in ${file.name}`)
    } catch (e: any) {
      alert(`Could not read that document. ${String(e?.message || '').slice(0, 80)}`)
    } finally {
      setDocBusy(false)
    }
  }
  const recogRef = useRef<any>(null)

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

  async function ask(qRaw: string) {
    const asked = qRaw.trim()
    if (!asked || busy) return
    // When a document is attached, ground the answer in it rather than in
    // whatever the model happens to remember about the topic.
    const question = docText
      ? `${asked}\n\n--- Use this document the student attached ("${docName}") as the source of truth. If the answer is not in it, say so. ---\n${docText.slice(0, 12_000)}`
      : asked

    setError('')
    setRetryHint('')
    setResp(null)
    setTopic(asked)
    setInput('')
    setBusy(true)
    if (taRef.current) taRef.current.style.height = 'auto'

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    const headers = { 'Content-Type': 'application/json', ...aiHeaders() }

    async function fetchTextWithRetry(attempt = 0): Promise<TextPlan> {
      const MAX_ATTEMPTS = 4
      let student: any = null
      try { student = getStudentMemory() } catch {  }
      let mistakes: any[] = []
      try { mistakes = getMistakes().slice(0, 10).map(m => ({ topic: m.topic, count: m.count, severity: m.severity })) } catch {  }
      const r = await fetch('/api/ai/solver/text', {
        method: 'POST', headers,
        body: JSON.stringify({ question, student, mistakes }),
        signal: ctrl.signal,
      })
      if (r.ok) return r.json()
      const errBody = await r.json().catch(() => ({}))
      const isRateLimit = r.status === 429 || errBody.rateLimited
      if (isRateLimit && attempt < MAX_ATTEMPTS) {
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
      const cacheHit = lookupNcert(question)
      const text: TextPlan = cacheHit
        ? cacheHit
        : await fetchTextWithRetry()
      setRetryHint('')
      if (!Array.isArray(text.imageQueries)) text.imageQueries = []

      const isCasual = text.questionType === 'casual' || (!text.videoQuery && text.imageQueries.length === 0)

      const videoPromise = isCasual
        ? Promise.resolve({ videoId: null })
        : fetch('/api/ai/solver/video', {
            method: 'POST', headers,
            body: JSON.stringify({
              query:        text.videoQuery || text.topicKeyword || question,
              topicKeyword: text.topicKeyword,
            }),
            signal: ctrl.signal,
          })
            .then(r => r.ok ? r.json() : { videoId: null })
            .catch(() => ({ videoId: null }))

      setResp({
        ...text,
        imageSlides: [],
        imagesBusy:  !isCasual && text.imageQueries.length > 0,
        imagesCached: false,
        videoId:     null,
        videoBusy:   !isCasual,
      })
      setBusy(false)

      try {
        if (isCasual) throw new Error('skip-memory')
        recordDoubt({
          question,
          answer:  text.textExplanation,
          topic:   text.topicKeyword || undefined,
          source:  voiceOn ? 'voice' : 'solver',
        })
        if (text.topicKeyword) {
          recordConcept({
            name:    text.topicKeyword,
            related: text.relatedConcepts || [],
          })
        }
        for (const raw of (text.formulas || [])) {
          if (!raw || typeof raw !== 'string') continue
          const parts = raw.split(/[:—–]\s+/, 2)
          const name = parts.length === 2 ? parts[0].trim() : (text.topicKeyword || 'Formula')
          const expr = (parts.length === 2 ? parts[1] : raw).trim()
          if (expr.length < 2 || expr.length > 200) continue
          recordFormula({ name, expr, topic: text.topicKeyword || undefined, source: 'solver' })
        }
      } catch {  }

      videoPromise.then((v: any) => {
        if (ctrl.signal.aborted) return
        setResp(prev => prev ? { ...prev, videoId: v?.videoId || null, videoBusy: false } : prev)
      })

      if (text.imageQueries.length === 0) return

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
        if (ctrl.signal.aborted) return
        const e = await imgRes.json().catch(() => ({}))
        setResp(prev => prev ? { ...prev, imagesBusy: false, imagesError: e.error || `Image search failed (${imgRes.status})` } : prev)
        return
      }
      const img = await imgRes.json() as { imageSlides: ImageSlide[]; cached: boolean }
      if (ctrl.signal.aborted) return
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

  // Persist the last completed solve so it survives a reload or a Chat<->Visual
  // toggle (which remounts this component). Only write finished solves — never
  // mid-flight (busy) or failed (resp null) states, so a stale-but-real solve
  // stays recoverable rather than being wiped by a failed attempt.
  useEffect(() => {
    if (busy) return
    if (!topic || !resp) return
    try {
      localStorage.setItem(SOLVE_KEY, JSON.stringify({
        topic,
        resp: { ...resp, imagesBusy: false, videoBusy: false },
      }))
    } catch {  }
  }, [topic, resp, busy])

  useEffect(() => {
    if (resp?.questionType === 'geography' && viewMode === 'auto' && resp.geography) {
      setAutoSwitched(true)
      const id = window.setTimeout(() => setAutoSwitched(false), 3600)
      return () => window.clearTimeout(id)
    }
  }, [resp?.questionType, resp?.geography, viewMode])

  useEffect(() => {
    if (resp) return
    if (busy) setViewMode('auto')
  }, [busy, resp])

  useEffect(() => {
    onActiveChange?.(busy)
    return () => { onActiveChange?.(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy])

  const effectiveMode: SolverViewMode = useMemo(() => {
    if (resp?.questionType === 'casual') return 'text'
    if (viewMode !== 'auto') return viewMode
    if (resp?.questionType === 'geography' && resp.geography) return 'map'
    return 'visual'
  }, [viewMode, resp?.questionType, resp?.geography])

  const isGeographyMap = effectiveMode === 'map' && resp?.questionType === 'geography' && resp.geography

  return (
    <div style={{
      flex: 1, height: '100%', display: 'flex', flexDirection: 'column',
      padding: '20px 24px 0', overflow: 'hidden', position: 'relative',
    }}>
      <div className="kr-ambient-field" aria-hidden />
      <div className="kr-particles"      aria-hidden />

      {showResult && (
        <div style={{
          position: 'absolute', top: '20%', left: '10%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(38, 58, 140, 0.18) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: 0,
        }} />
      )}

      {!showResult && (
        <div style={{
          flex: 1, minHeight: 0, position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          overflowY: 'auto',
        }}>
          <Hero onPick={ask} />
        </div>
      )}

      {showResult && (
        <div className="ks-result-wrap" style={{
          flex: 1, minHeight: 0, position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 14,
          overflow: 'auto',
        }}>
          <ModeChipBar
            mode={viewMode}
            setMode={setViewMode}
            hasGeography={!!resp?.geography}
            supports3D={false}
            autoSwitched={autoSwitched}
          />

          {isGeographyMap && resp && resp.geography ? (
            <GeoVisualMode
              topic={topic}
              textExplanation={resp.textExplanation || ''}
              geography={resp.geography}
              imageSlides={resp.imageSlides || []}
              imagesBusy={(busy && !resp) || resp.imagesBusy === true}
              relatedConcepts={resp.relatedConcepts || []}
              onAskRelated={(c) => ask(c)}
            />
          ) : (
            <div className="ks-result" style={{
              flex: 1, minHeight: 0, position: 'relative',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
              gap: 14,
            }}>
              <LeftPanel
                videoId={resp?.videoId ?? null}
                videoBusy={resp?.videoBusy === true}
                slides={resp?.imageSlides || []}
                imagesBusy={(busy && !resp) || resp?.imagesBusy === true}
                topic={topic}
                questionType={resp?.questionType}
                imagesErr={resp?.imagesError}
              />

              <ExplanationPanel
                resp={resp}
                busy={busy && !resp}
                error={error}
                retryHint={retryHint}
                question={topic}
                onOpenLab={(route) => onNavigate?.('labs:' + route)}
                onAskRelated={(c) => ask(c)}
              />
            </div>
          )}
        </div>
      )}

      <div className="ks-composer" style={{
        background: 'linear-gradient(180deg, rgba(20, 24, 35, 1) 0%, rgba(11, 11, 15, 1) 100%)',
        border: `1px solid ${voiceOn ? 'rgba(165, 180, 252, 0.55)' : 'rgba(255, 255, 255, 0.06)'}`,
        borderRadius: 28, padding: '10px 12px',
        display: 'flex', alignItems: 'flex-end', gap: 10,
        marginBottom: 18, marginTop: showResult ? 0 : 14,
        position: 'relative', zIndex: 2,
        transition: 'border-color .24s ease, box-shadow .24s ease, background .24s ease',
        boxShadow: voiceOn
          ? '0 16px 44px rgba(38, 58, 140, 0.45), 0 0 0 3px rgba(38, 58, 140, 0.25), 0 0 0 1px rgba(165, 180, 252, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          : '0 16px 40px rgba(0, 0, 0, 0.40), 0 0 32px rgba(38, 58, 140, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.04)',


      }}>
        {docName && (
          <span
            title="Answers will be grounded in this document"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', borderRadius: 999, flexShrink: 0,
              background: 'rgba(124,92,255,0.14)',
              border: '1px solid rgba(165,180,252,0.32)',
              color: '#c7d2fe', fontSize: 11.5, fontWeight: 600,
              maxWidth: 170, overflow: 'hidden',
            }}>
            <Paperclip size={12} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{docName}</span>
            <X
              size={12}
              style={{ cursor: 'pointer', flexShrink: 0 }}
              onClick={() => { setDocName(''); setDocText('') }}
            />
          </span>
        )}
        {snapNote && (
          <span style={{
            width: '100%', fontSize: 11.5, color: '#9CA3AF',
            padding: '0 4px 6px', lineHeight: 1.45,
          }}>
            {snapNote}
          </span>
        )}
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
            flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
            color: '#fafafa', fontFamily: 'inherit', fontSize: 14, resize: 'none',
            padding: '8px 6px', lineHeight: 1.5, maxHeight: 140,
          }}
        />
        {!busy && (
          <>
            {/* Snap-and-Solve. capture="environment" opens the rear camera
                directly on a phone; on desktop it is an ordinary file picker,
                so the same control works everywhere. */}
            <input
              ref={snapInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) snapSolve(f)
                e.target.value = ''   // same photo twice in a row must re-fire
              }}
            />
            <button
              onClick={() => snapInputRef.current?.click()}
              title="Photograph a question — Kyno types it out for you to check"
              className="kr-tactile"
              disabled={snapBusy}
              aria-label="Photograph a question"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 999,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#9CA3AF', fontSize: 12.5, fontFamily: 'inherit',
                cursor: snapBusy ? 'default' : 'pointer', flexShrink: 0,
                opacity: snapBusy ? 0.6 : 1,
              }}
            >
              <Camera size={14} />
              {snapBusy ? 'Reading…' : 'Snap'}
            </button>

            <button
              onClick={() => docInputRef.current?.click()}
              title="Attach a PDF or notes — Kyno will read it and answer from it"
              className="kr-tactile"
              disabled={docBusy}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 999,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: docBusy ? '#6B7280' : '#B1B5BA',
                fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                cursor: docBusy ? 'default' : 'pointer',
              }}>
              <Paperclip size={14} />
              {docBusy ? 'Reading…' : (docName ? 'Change' : 'Document')}
            </button>
            <input
              ref={docInputRef}
              type="file"
              accept="application/pdf,.pdf,.txt,.md,image/*"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) readDocument(f); e.currentTarget.value = '' }}
            />
          </>
        )}
        {voiceSupported && !busy && (
          <button
            onClick={toggleVoice}
            title={voiceOn ? 'Stop listening' : 'Speak your doubt'}
            className="kr-tactile"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 999,
              background: voiceOn ? 'rgba(165, 180, 252, 0.18)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${voiceOn ? 'rgba(165, 180, 252, 0.55)' : 'rgba(255,255,255,0.08)'}`,
              color: voiceOn ? '#A5B4FC' : '#B1B5BA',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
              boxShadow: voiceOn ? '0 0 14px rgba(124, 92, 255, 0.32)' : 'none',
            }}>
            {voiceOn ? <Mic size={14} className="kr-voice-pulse" /> : <MicOff size={14} />}
            {voiceOn ? 'Listening' : 'Voice'}
          </button>
        )}
        {!busy && (
          <button onClick={() => setExamModal(true)} title="Plan your exam"
            className="kr-tactile"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 999,
              background: '#141A2A',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#B1B5BA', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}>
            <Calendar size={14} />
            Exam
          </button>
        )}
        {busy ? (
          <button className="kyno-ghost" onClick={stop} style={btnStop}>
            <StopCircle size={14} /> Stop
          </button>
        ) : (
          <button className="kyno-ghost" onClick={() => ask(input)} disabled={!input.trim()} style={{
            ...btnSend, opacity: input.trim() ? 1 : 0.45,
            cursor: input.trim() ? 'pointer' : 'not-allowed',
          }}>
            <Send size={14} /> Solve
          </button>
        )}
        <style>{`
          @keyframes kr-voice-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.45 } }
          .kr-voice-pulse { animation: kr-voice-pulse 1.2s ease-in-out infinite }
          /* Mobile: stack the answer + visual full-width (the 2-col grid crushed the
             visual to nothing on phones), and make the ask box prominent. */
          @media (max-width: 760px){
            .ks-result { grid-template-columns: 1fr !important; gap: 12px !important; }
            .ks-result > * { min-height: 320px; }
            .ks-composer { flex-wrap: wrap; border-radius: 20px; padding: 12px !important; }
            .ks-composer textarea { min-width: 100% !important; order: -1; font-size: 16px !important; padding: 6px 4px 10px !important; }
          }
        `}</style>
      </div>

      <AnimatePresence>
        {examModal && <ExamPlanModal onClose={() => setExamModal(false)} />}
      </AnimatePresence>
    </div>
  )
}

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
        background: 'rgba(0,0,0,0.78)',
        display: 'grid', placeItems: 'center', padding: 16,
      }}>
      <motion.div
        initial={{ y: 12, scale: 0.96 }} animate={{ y: 0, scale: 1 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 460,
          background: '#141A2A',
          border: '1px solid rgba(165, 180, 252, 0.35)',
          borderRadius: 18, padding: 24,
          color: '#fafafa', fontFamily: 'inherit',
          boxShadow: '0 24px 60px rgba(124, 92, 255, 0.03)',
          position: 'relative',
        }}>
        <button className="kyno-ghost" onClick={onClose} aria-label="Close" style={{
          position: 'absolute', top: 14, right: 14,
          width: 30, height: 30, borderRadius: 8,
          background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
          color: '#9CA3AF', cursor: 'pointer', display: 'grid', placeItems: 'center',
        }}>
          <X size={14} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Calendar size={16} color="#A5B4FC" />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 2 }}>
            Plan an exam
          </span>
        </div>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Add an exam to your countdown</h3>
        <p style={{ margin: '4px 0 14px', fontSize: 12.5, color: '#9CA3AF' }}>
          Saved on this device. Kyno will show the countdown + adjust your weak-topic revisions toward the exam date.
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
          <button className="kyno-ghost" onClick={onClose} style={{
            padding: '9px 16px', borderRadius: 9,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
            color: '#B1B5BA', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
          }}>Cancel</button>
          <button className="kyno-chunky" onClick={save} disabled={!subject.trim() || !date} style={{
            padding: '9px 20px', borderRadius: 9,
            background: 'linear-gradient(135deg, #7C5CFF, #4A2FA8)',
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
        background: '#1C2233', border: '1px solid rgba(255,255,255,0.06)',
        color: '#fafafa', fontFamily: 'inherit', fontSize: 13, outline: 'none',
      }} />
  )
}

function Hero({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 24,
      position: 'relative',
    }}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{ position: 'relative', width: 124, height: 124 }}
      >
        <div className="animate-pulse-orb" style={{
          position: 'absolute', inset: -22,
          borderRadius: 40,
          background: 'radial-gradient(ellipse at center, rgba(38, 58, 140, 0.42) 0%, rgba(38, 58, 140, 0.22) 38%, rgba(165, 180, 252, 0.12) 62%, transparent 80%)',
          filter: 'blur(12px)',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: 30,
          background: 'linear-gradient(180deg, rgba(38, 58, 140, 0.22) 0%, rgba(11, 11, 15, 0.55) 100%)',
          border: '1px solid rgba(165, 180, 252, 0.32)',


          boxShadow: '0 14px 48px rgba(38, 58, 140, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        }} />
        <div style={{
          position: 'absolute', inset: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <img
            src="/kairo_logo.png"
            alt="Kyno"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      </motion.div>

      <div style={{ textAlign: 'center', maxWidth: 520 }}>
        <h1 style={{
          fontSize: 30, fontWeight: 800, color: '#fafafa', margin: 0,
          letterSpacing: '-0.6px',
          background: 'linear-gradient(180deg, #FFFFFF 0%, #A5B4FC 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Kyno's Solver
        </h1>
        <p style={{ fontSize: 13.5, color: '#B1B5BA', margin: '10px 0 0', lineHeight: 1.65 }}>
          Ask anything. Kyno writes a clear explanation on the right and builds a
          live picture-book on the left — sourced from Wikimedia and educational image libraries.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 660, marginTop: 8 }}>
        {SUGGESTIONS.map(s => (
          <motion.button key={s} onClick={() => onPick(s)}
            whileHover={{ scale: 1.04, y: -3 }} whileTap={{ scale: 0.97 }}
            className="kr-tactile"
            style={{
              padding: '12px 22px',
              background: 'linear-gradient(180deg, rgba(38, 58, 140, 0.22) 0%, rgba(11, 11, 15, 0.55) 100%)',
              border: '1px solid rgba(165, 180, 252, 0.20)',
              color: '#A5B4FC',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              letterSpacing: '-0.005em',
              cursor: 'pointer',


              boxShadow: '0 6px 18px rgba(38, 58, 140, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              transition: 'box-shadow 0.24s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            onMouseEnter={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.borderColor = 'rgba(165, 180, 252, 0.55)'
              b.style.boxShadow   = '0 10px 28px rgba(38, 58, 140, 0.45), 0 0 24px rgba(165, 180, 252, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
            }}
            onMouseLeave={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.borderColor = 'rgba(165, 180, 252, 0.20)'
              b.style.boxShadow   = '0 6px 18px rgba(38, 58, 140, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
            }}
          >
            {s}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

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
      minHeight: 0, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        flexShrink: 0,
        padding: '8px 14px',
        background: 'rgba(13,13,13,0.92)',
        borderBottom: '1px solid rgba(124, 92, 255, 0.2)',
        fontSize: 10.5, color: '#A5B4FC', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: 1.5,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Sparkles size={11} /> Kyno lesson · {topic}
      </div>

      <div style={{
        flex: 1, minHeight: 0, position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>

      {busy && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: '#B1B5BA' }}>
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: 52, height: 52, borderRadius: 13,
              background: 'linear-gradient(135deg, #7C5CFF, #A5B4FC)',
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
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&modestbranding=1&rel=0&controls=1&playsinline=1&iv_load_policy=3`}
            title="Lesson video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{
              width: '100%', height: '100%',
              border: 'none', borderRadius: 0,
            }}
          />
          <div style={{
            position: 'absolute', bottom: 8, right: 12, zIndex: 4,
            padding: '3px 8px', borderRadius: 5,
            background: 'rgba(13,13,13,0.6)',
            border: '1px solid rgba(124, 92, 255, 0.25)',
            fontSize: 9, color: '#A5B4FC', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 1,
            pointerEvents: 'none',
          }}>
            Kyno
          </div>
        </>
      )}
      </div>
    </div>
  )
}

function Slideshow({ slides, busy, topic, questionType, err, compact = false }: {
  slides: ImageSlide[]; busy: boolean; topic: string; questionType?: string; err?: string; compact?: boolean
}) {
  const [idx, setIdx] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (slides.length < 2) return
    const t = setInterval(() => setIdx(i => (i + 1) % slides.length), 3500)
    return () => clearInterval(t)
  }, [slides.length])

  useEffect(() => { setIdx(0) }, [slides])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (slides.length < 2) return
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
        background: '#0A0D16', border: '1px solid #1f2532',
        borderRadius: 18, overflow: 'hidden', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 0,
        boxShadow: '0 0 60px rgba(124, 92, 255, 0.01) inset',
      }}>
      <div style={{
        position: 'absolute', top: 14, left: 14, zIndex: 4,
        padding: '6px 12px', borderRadius: 7,
        background: 'rgba(13,13,13,0.85)',
        border: '1px solid rgba(124, 92, 255, 0.3)',
        fontSize: 10.5, color: '#A5B4FC', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: 1.5,
        maxWidth: '70%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {iconForType(questionType)}
        {topic}
      </div>

      {slides.length > 0 && (
        <div style={{
          position: 'absolute', top: 14, right: 14, zIndex: 4,
          padding: '5px 11px', borderRadius: 6,
          background: 'rgba(13,13,13,0.85)',
          border: '1px solid #1f2532',
          fontSize: 10, color: '#B1B5BA', fontWeight: 700,
          fontFamily: 'monospace', letterSpacing: 0.5,
        }}>
          {idx + 1} / {slides.length}
        </div>
      )}

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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 24, textAlign: 'center', color: '#A5B4FC', maxWidth: 360 }}>
          <ImageIcon size={28} />
          <div style={{ fontSize: 13, fontWeight: 600 }}>Couldn't load images</div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>{err}</div>
        </div>
      )}

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
                background: 'rgba(255,255,255,0.02)',
              }}
              onError={(e) => {
                const img = e.currentTarget
                if (img.dataset.placeheld === '1') return
                const tries = Number(img.dataset.retries || '0')
                if (tries < 2) {
                  img.dataset.retries = String(tries + 1)
                  const src = img.src
                  img.style.opacity = '0.25'
                  setTimeout(() => { img.src = ''; img.src = src; img.style.opacity = '1' }, 8000)
                } else {
                  // Graceful themed placeholder instead of a black/broken slide.
                  img.dataset.placeheld = '1'
                  img.style.opacity = '1'
                  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='440' height='320'><rect width='440' height='320' rx='14' fill='#141A2A'/><g fill='none' stroke='#3a4258' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' transform='translate(190,120)'><rect x='0' y='0' width='60' height='48' rx='6'/><circle cx='16' cy='15' r='6'/><path d='M2 46 L22 26 L34 38 L46 26 L58 38'/></g><text x='220' y='218' fill='#5b647a' font-family='sans-serif' font-size='13' font-weight='600' text-anchor='middle'>Visual unavailable</text></svg>`
                  img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
                }
              }}
            />
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
                  background: 'rgba(124, 92, 255, 0.15)', color: '#A5B4FC',
                  textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700,
                }}>{current.source === 'kairo-ai' ? '✦ Kyno AI' : current.source}</span>
                {current.attribution && <span style={{ pointerEvents: 'auto' }}>{current.attribution}</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

/**
 * C30 + C16, on every solved answer.
 *
 * Save to Reels writes a flashcard into the twin store — the SAME store
 * Revision Reels reads — so the card appears there with no extra plumbing.
 *
 * "Explain differently" re-asks with the previous explanation attached and an
 * explicit instruction to change the APPROACH, because without seeing what was
 * already said the model reliably produces the same explanation reworded.
 */
function AnswerActions({ resp, question, onAskRelated }: {
  resp: SolverResponse
  question?: string
  onAskRelated: (q: string) => void
}) {
  const [saved, setSaved] = useState(false)
  const [cloze, setCloze] = useState<'idle' | number>('idle')
  const [speaking, setSpeaking] = useState(false)

  // Nothing keeps talking after the answer unmounts.
  useEffect(() => () => { if (speaking) stopSpeaking() }, [speaking])

  function listen() {
    if (speaking) { stopSpeaking(); setSpeaking(false); return }
    const ok = speak(speakableText(resp.textExplanation), { onend: () => setSpeaking(false) })
    setSpeaking(ok)
  }

  function saveToReels() {
    if (saved) return
    recordFlashcard({
      front: (question || resp.topicKeyword || 'Doubt').slice(0, 200),
      back:  resp.textExplanation.slice(0, 700),
      topic: resp.topicKeyword || undefined,
      source: 'auto-from-doubt',
    })
    setSaved(true)
  }

  // Fill-in-the-blank cards from the answer's own sentences (cloze.core —
  // deterministic, skips sentences with no confident term). They join Reels.
  function makeCloze() {
    if (cloze !== 'idle') return
    const cards = buildClozeCards(resp.textExplanation, { max: 6 })
    for (const c of cards) {
      try { recordFlashcard({ front: c.front, back: c.back, topic: resp.topicKeyword || undefined, source: 'auto-from-doubt' }) } catch {  }
    }
    setCloze(cards.length)
  }

  function explainDifferently() {
    const prev = resp.textExplanation.slice(0, 900)
    onAskRelated(
      `Explain "${question || resp.topicKeyword || 'this'}" again, but take a genuinely different approach — a different analogy, a different starting point, or a different representation (visual/numerical/story). Do NOT reword the previous explanation. For reference, the previous explanation was:

${prev}`,
    )
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button onClick={saveToReels} className="kyno-ghost"
        style={{ padding: '7px 13px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <BookOpen size={12} /> {saved ? 'Saved to Reels ✓' : 'Save to Reels'}
      </button>
      <button onClick={explainDifferently} className="kyno-ghost"
        style={{ padding: '7px 13px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <RefreshCw size={12} /> Explain it differently
      </button>
      <button onClick={makeCloze} disabled={cloze !== 'idle'} className="kyno-ghost"
        style={{ padding: '7px 13px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Layers size={12} /> {cloze === 'idle' ? 'Fill-in cards' : cloze > 0 ? `${cloze} card${cloze === 1 ? '' : 's'} made ✓` : 'No blanks found'}
      </button>
      {ttsAvailable() && (
        <button onClick={listen} className="kyno-ghost"
          style={{ padding: '7px 13px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Headphones size={12} /> {speaking ? 'Stop' : 'Listen'}
        </button>
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
          background: 'linear-gradient(135deg, #7C5CFF, #A5B4FC)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 32px rgba(124, 92, 255, 0.04)',
          padding: 8,
        }}>
        <img
          src="/kairo_logo.png"
          alt="Kyno"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </motion.div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>Building your visual lesson…</div>
      <div style={{ fontSize: 11, color: '#9CA3AF', maxWidth: 320, textAlign: 'center', lineHeight: 1.5 }}>
        Searching Wikimedia + educational image libraries · Generating storyboard · Writing explanation
      </div>
      <div style={{ width: 200, height: 3, background: '#1f2532', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
        <motion.div
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: '40%', height: '100%', background: 'linear-gradient(90deg, transparent, #7C5CFF, transparent)' }}
        />
      </div>
    </div>
  )
}

function ExplanationPanel({ resp, busy, error, retryHint, question, onOpenLab, onAskRelated }: {
  resp: SolverResponse | null
  busy: boolean
  error: string
  retryHint?: string
  question?: string
  onOpenLab: (route: string) => void
  onAskRelated: (concept: string) => void
}) {
  return (
    <div style={{
      background: '#141A2A', border: '1px solid #1f2532',
      borderRadius: 18, padding: 20, overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{
        fontSize: 10, color: '#A5B4FC', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: 1.5,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Sparkles size={12} /> Kyno says
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

      {busy && <ExplanationSkeleton retryHint={retryHint} />}

      {error && (
        <div style={{
          padding: '14px 16px', borderRadius: 12,
          background: 'rgba(165, 180, 252, 0.08)', border: '1px solid rgba(165, 180, 252, 0.28)',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 4 }}>
              ⚠ Couldn't fetch an answer
            </div>
            <div style={{ fontSize: 13, color: '#e4e4e7', lineHeight: 1.55 }}>
              {error}
            </div>
          </div>
          {topic && !busy && (
            <button className="kyno-chunky"
              onClick={() => ask(topic)}
              style={{
                padding: '8px 14px', borderRadius: 9,
                background: 'linear-gradient(135deg, #7C5CFF 0%, #4A2FA8 50%, #7C5CFF 100%)',
                color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 12,
                border: 'none', cursor: 'pointer', flexShrink: 0,
                boxShadow: '0 6px 18px rgba(124, 92, 255, 0.04)',
              }}>
              Try again
            </button>
          )}
        </div>
      )}

      {resp && (
        <>
          <div style={{ fontSize: 13.5, color: '#e4e4e7', lineHeight: 1.75 }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={MD_COMPONENTS}
            >
              {resp.textExplanation}
            </ReactMarkdown>
          </div>

          <AnswerActions resp={resp} question={question} onAskRelated={onAskRelated} />

          {resp.formulas.length > 0 && (
            <div style={{
              padding: '12px 14px', borderRadius: 11,
              background: 'rgba(124, 92, 255, 0.05)', border: '1px solid rgba(124, 92, 255, 0.2)',
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

          {false && resp.labRoute && (
            <motion.button
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
              onClick={() => onOpenLab(resp.labRoute!)}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(165, 180, 252, 0.18), rgba(124, 92, 255, 0.18))',
                border: '1px solid rgba(165, 180, 252, 0.14)',
                color: '#fafafa', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: '0 0 24px rgba(165, 180, 252, 0.01)',
              }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: 'linear-gradient(135deg, #A5B4FC, #7C5CFF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Beaker size={16} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Open in Kyno Labs</div>
                <div style={{ fontSize: 11, color: '#B1B5BA', marginTop: 1 }}>
                  Tweak parameters, watch it live in 3D
                </div>
              </div>
              <ExternalLink size={14} color="#A5B4FC" />
            </motion.button>
          )}

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
                      background: '#1C2233', border: '1px solid #1f2532',
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
      ? <pre style={{ background: '#0A0D16', border: '1px solid #1f2532', borderRadius: 8, padding: '10px 12px', overflowX: 'auto', margin: '8px 0' }}>
          <code style={{ fontSize: 12.5, color: '#A5B4FC', fontFamily: 'monospace' }}>{children}</code>
        </pre>
      : <code style={{ background: '#1a1a2e', padding: '2px 6px', borderRadius: 4, fontSize: 12.5, color: '#A5B4FC', fontFamily: 'monospace' }}>{children}</code>
  },
  blockquote: ({ children }: any) => <blockquote style={{ borderLeft: '3px solid #7C5CFF', paddingLeft: 12, margin: '8px 0', color: '#B1B5BA', fontStyle: 'italic' }}>{children}</blockquote>,
}

const btnSend: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 999,
  background: 'linear-gradient(135deg, #A5B4FC 0%, #7C5CFF 60%, #4A2FA8 100%)',
  color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
  letterSpacing: '-0.005em',
  display: 'flex', alignItems: 'center', gap: 6,
  boxShadow: '0 8px 24px rgba(124, 92, 255, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
  transition: 'transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.18s ease',
}

const btnStop: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 999,
  background: 'rgba(255, 255, 255, 0.04)', color: '#fff',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 6,
  transition: 'all 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
}

const arrowBtn: React.CSSProperties = {
  position: 'absolute', top: '50%', transform: 'translateY(-50%)',
  width: 34, height: 34, borderRadius: 9, zIndex: 4,
  background: 'rgba(13,13,13,0.85)',
  border: '1px solid rgba(124, 92, 255, 0.3)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

function ModeChipBar({
  mode, setMode, hasGeography, supports3D, autoSwitched,
}: {
  mode: SolverViewMode
  setMode: (m: SolverViewMode) => void
  hasGeography: boolean
  supports3D:   boolean
  autoSwitched: boolean
}) {
  const chips: { id: SolverViewMode; label: string; icon: React.ElementType; available: boolean; hint?: string }[] = [
    { id: 'text',   label: 'Text',    icon: TextIcon,    available: true },
    { id: 'visual', label: 'Visual',  icon: ImageIcon,   available: true },
    { id: 'map',    label: 'Map',     icon: MapPinIcon,  available: hasGeography, hint: hasGeography ? 'Geography detected' : 'Not a geography question' },
    { id: '3d',     label: '3D',      icon: Box3DIcon,   available: supports3D,   hint: supports3D   ? 'Opens in Kyno Labs' : 'No 3D lab for this topic' },
    { id: 'both',   label: 'Both',    icon: BothIcon,    available: true },
  ]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '6px 10px',
      background: 'rgba(20, 24, 35, 0.55)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: 12,


    }}>
      <div style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 9.5, fontWeight: 700, color: '#A5B4FC',
        textTransform: 'uppercase', letterSpacing: 1.8, paddingLeft: 4,
      }}>
        View
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {chips.map(c => {
          const active = mode === c.id || (mode === 'auto' && c.id === (hasGeography ? 'map' : 'visual'))
          return (
            <button className="kyno-chip"
              key={c.id}
              onClick={() => c.available && setMode(c.id)}
              disabled={!c.available}
              title={c.hint || c.label}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 8,
                border: 'none', cursor: c.available ? 'pointer' : 'not-allowed',
                background: active ? 'rgba(124, 92, 255, 0.18)' : 'transparent',
                color: active ? '#A5B4FC' : c.available ? '#CBD5E1' : '#4B5563',
                fontFamily: 'inherit', fontWeight: 700, fontSize: 11.5,
                opacity: c.available ? 1 : 0.45,
                transition: 'all 0.18s',
              }}
            >
              <c.icon size={12} />
              {c.label}
            </button>
          )
        })}
      </div>

      <AnimatePresence>
        {autoSwitched && (
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.25 }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 999,
              background: 'rgba(165, 180, 252, 0.10)',
              border: '1px solid rgba(165, 180, 252, 0.35)',
              color: '#A5B4FC',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 1.2,
              marginLeft: 'auto',
            }}
          >
            <Wand2 size={10} />
            Auto-selected · Map mode
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
