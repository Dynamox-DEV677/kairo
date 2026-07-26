import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Zap, ZapOff, Camera, Lightbulb, BookmarkPlus, Menu,
  Sparkles, StopCircle, Loader2, Mic, Square, Volume2, X, Check, AlertTriangle,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { aiHeaders } from '../lib/devKey'
import { recordMistake, recordFlashcard } from '../lib/twin'
import { awardXP } from '../lib/game'

/* ── tuning: keeps the "always watching" feel without burning the free tier ── */
const SAMPLE_MS     = 1200   // how often we look at the frame locally (free)
const MIN_GAP_MS    = 5500   // minimum gap between real AI calls
const CHANGE_THRESH = 7      // mean per-cell brightness delta that counts as "they wrote something"
const SESSION_CAP   = 45     // hard ceiling on AI calls per session

type Phase = 'scanning' | 'question' | 'working' | 'done'

interface Detected {
  question?: string | null; subject?: string | null; chapter?: string | null
  topic?: string | null; difficulty?: string | null; questionType?: string | null
  formulas?: string[]; estMinutes?: number | null; confidence?: number
}
interface Grade {
  status?: string; progress?: number; accuracy?: number; mistakes?: number
  confidence?: string; feedback?: string; firstWrongStep?: number | null
  done?: boolean; hasWork?: boolean
}
interface Report {
  overallAccuracy?: number; conceptUnderstanding?: number; calculationAccuracy?: number
  presentation?: number; neatness?: number; confidenceScore?: number
  weakConcept?: string | null; strongConcept?: string | null
  finalAnswerCorrect?: boolean; summary?: string
  flashcards?: { front: string; back: string }[]
}

/* floating glass surface — light blur only (heavy blur over live video tanks mobile GPUs) */
const glass = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  background: 'rgba(14,16,26,0.62)',
  backdropFilter: 'blur(14px) saturate(150%)',
  WebkitBackdropFilter: 'blur(14px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 18,
  boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
  ...extra,
})
const orb: React.CSSProperties = {
  width: 42, height: 42, borderRadius: '50%', display: 'flex',
  alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  color: '#fff', flexShrink: 0, border: '1px solid rgba(255,255,255,0.16)',
  background: 'rgba(14,16,26,0.6)',
  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
}

export default function CameraLive({ onExit }: { onExit?: () => void }) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const sampleRef  = useRef<HTMLCanvasElement>(null)
  const grabRef    = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const sigRef     = useRef<number[] | null>(null)
  const lastCallRef= useRef(0)
  const busyRef    = useRef(false)
  const startedRef = useRef(Date.now())
  const recRef     = useRef<MediaRecorder | null>(null)
  const audioRef   = useRef<HTMLAudioElement | null>(null)

  const [ready, setReady]     = useState(false)
  const [camErr, setCamErr]   = useState('')
  const [torch, setTorch]     = useState(false)
  const [phase, setPhase]     = useState<Phase>('scanning')
  const [detected, setDet]    = useState<Detected | null>(null)
  const [grade, setGrade]     = useState<Grade | null>(null)
  const [calls, setCalls]     = useState(0)
  const [thinking, setThink]  = useState(false)
  const [toast, setToast]     = useState('')

  const [hintLevel, setHintLevel] = useState(0)
  const [hint, setHint]           = useState('')
  const [sheet, setSheet]         = useState<'' | 'explain' | 'hint' | 'report'>('')
  const [explainMd, setExplain]   = useState('')
  const [report, setReport]       = useState<Report | null>(null)
  const [listening, setListening] = useState(false)
  const [voiceReply, setVoice]    = useState('')

  /* ── camera ── */
  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        })
        if (dead) { s.getTracks().forEach(t => t.stop()); return }
        streamRef.current = s
        if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play().catch(() => {}) }
        setReady(true)
      } catch (e: any) {
        setCamErr(e?.name === 'NotAllowedError'
          ? 'Camera permission denied. Allow camera access to use Study Mode.'
          : 'Could not open the camera on this device.')
      }
    })()
    return () => {
      dead = true
      streamRef.current?.getTracks().forEach(t => t.stop())
      try { audioRef.current?.pause(); audioRef.current = null } catch {  }
      try { window.speechSynthesis?.cancel() } catch {  }
    }
  }, [])

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as any] })
      setTorch(t => !t)
    } catch { setToast('No flashlight on this camera'); setTimeout(() => setToast(''), 1800) }
  }, [torch])

  /* ── frame helpers ── */
  const grabFrame = useCallback((maxW = 900, q = 0.7) => {
    const v = videoRef.current, c = grabRef.current
    if (!v || !c || !v.videoWidth) return null
    const s = Math.min(1, maxW / v.videoWidth)
    c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s)
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', q)
  }, [])

  // cheap local "did the page change?" check — runs free, no API
  const signature = useCallback(() => {
    const v = videoRef.current, c = sampleRef.current
    if (!v || !c || !v.videoWidth) return null
    const W = 64, H = 64
    c.width = W; c.height = H
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(v, 0, 0, W, H)
    const d = ctx.getImageData(0, 0, W, H).data
    const cells = 8, step = W / cells, out: number[] = []
    for (let cy = 0; cy < cells; cy++) for (let cx = 0; cx < cells; cx++) {
      let sum = 0, n = 0
      for (let y = cy * step; y < (cy + 1) * step; y++) for (let x = cx * step; x < (cx + 1) * step; x++) {
        const i = ((y * W) + x) * 4; sum += (d[i] + d[i + 1] + d[i + 2]) / 3; n++
      }
      out.push(n ? sum / n : 0)
    }
    return out
  }, [])

  const analyze = useCallback(async (mode: string, context: any = {}, image?: string) => {
    const img = image ?? grabFrame()
    if (!img) return null
    busyRef.current = true; setThink(true)
    try {
      const r = await fetch('/api/camera/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...aiHeaders() },
        body: JSON.stringify({ image: img, mode, context }),
      })
      setCalls(c => c + 1)
      const j = await r.json().catch(() => null)
      if (!r.ok) { if (j?.rateLimited) { setToast('Easy — too many frames. Pausing a moment.'); setTimeout(() => setToast(''), 2200) } return null }
      return j
    } catch { return null }
    finally { busyRef.current = false; setThink(false) }
  }, [grabFrame])

  /* ── the live loop ── */
  useEffect(() => {
    if (!ready || phase === 'done') return
    const id = setInterval(() => {
      if (busyRef.current || calls >= SESSION_CAP) return
      const sig = signature()
      if (!sig) return
      const prev = sigRef.current
      const delta = prev ? sig.reduce((a, v, i) => a + Math.abs(v - prev[i]), 0) / sig.length : 999
      const gapOk = Date.now() - lastCallRef.current > MIN_GAP_MS
      const changed = delta > CHANGE_THRESH
      // scan aggressively until we find a question; after that only react to new writing
      const should = phase === 'scanning' ? (gapOk && (changed || !prev)) : (gapOk && changed)
      if (!should) return
      sigRef.current = sig
      lastCallRef.current = Date.now()

      if (phase === 'scanning') {
        analyze('detect').then(d => {
          if (d?.hasContent && d?.question) {
            setDet(d); setPhase('question')
            try { navigator.vibrate?.(30) } catch {  }
          }
        })
      } else {
        analyze('grade', { question: detected?.question }).then(g => {
          if (!g) return
          setGrade(g)
          if (g.hasWork && phase === 'question') setPhase('working')
        })
      }
    }, SAMPLE_MS)
    return () => clearInterval(id)
  }, [ready, phase, calls, detected, signature, analyze])

  /* ── actions ── */
  async function nextHint() {
    const lvl = Math.min(4, hintLevel + 1)
    setHintLevel(lvl); setSheet('hint'); setHint('')
    const j = await analyze('hint', { question: detected?.question, level: lvl })
    setHint(j?.hint || 'Could not read your working clearly — try steadying the camera.')
  }

  async function doExplain() {
    setSheet('explain'); setExplain('')
    const j = await analyze('explain', { question: detected?.question })
    setExplain(j?.markdown || '_Could not read that clearly — try again with better light._')
  }

  async function makeFlashcards() {
    setToast('Building flashcards…')
    const j = await analyze('report', { question: detected?.question, seconds: (Date.now() - startedRef.current) / 1000 })
    const cards = j?.flashcards || []
    let n = 0
    for (const c of cards) {
      if (!c?.front || !c?.back) continue
      try { recordFlashcard({ front: c.front, back: c.back, subject: detected?.subject || undefined, topic: detected?.topic || undefined, source: 'camera' as any }); n++ } catch {  }
    }
    setToast(n ? `${n} flashcards added` : 'No cards could be made from this frame')
    setTimeout(() => setToast(''), 2200)
  }

  async function endSession() {
    setPhase('done'); setSheet('report'); setReport(null)
    const j = await analyze('report', { question: detected?.question, seconds: (Date.now() - startedRef.current) / 1000 })
    if (j) {
      setReport(j)
      try {
        if (j.weakConcept) recordMistake({ topic: String(j.weakConcept).slice(0, 60), detail: `Camera Study · ${String(j.summary || '').slice(0, 200)}` })
        else awardXP('chat_answer')
      } catch {  }
      for (const c of (j.flashcards || []).slice(0, 5)) {
        if (c?.front && c?.back) { try { recordFlashcard({ front: c.front, back: c.back, subject: detected?.subject || undefined, topic: detected?.topic || undefined, source: 'camera' as any }) } catch {  } }
      }
    }
  }

  /* ── voice out ── */
  // Real TTS (Orpheus) first — the phone's built-in voice is robotic. Falls back
  // to the best-sounding system voice only if the API call fails.
  function systemSpeak(text: string) {
    try {
      const synth = window.speechSynthesis
      if (!synth) return
      const vs = synth.getVoices() || []
      const pick =
        vs.find(v => /natural|neural/i.test(v.name) && /^en/i.test(v.lang)) ||
        vs.find(v => /google/i.test(v.name) && /^en-(GB|IN|US)/i.test(v.lang)) ||
        vs.find(v => /^en-IN/i.test(v.lang)) ||
        vs.find(v => /^en-GB/i.test(v.lang)) ||
        vs.find(v => /^en/i.test(v.lang)) || null
      const u = new SpeechSynthesisUtterance(text)
      if (pick) u.voice = pick
      u.rate = 1.0; u.pitch = 1.02
      synth.cancel(); synth.speak(u)
    } catch {  }
  }

  async function speak(text: string) {
    stopAudio()
    const voice = (() => { try { return localStorage.getItem('kyno_tts_voice') || 'hannah' } catch { return 'hannah' } })()
    try {
      const r = await fetch('/api/camera/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...aiHeaders() },
        body: JSON.stringify({ text, voice }),
      })
      if (r.ok) {
        const j = await r.json()
        if (j?.audio) {
          const a = new Audio(j.audio)
          audioRef.current = a
          await a.play()
          return
        }
      }
    } catch {  }
    systemSpeak(text)
  }

  function stopAudio() {
    try { audioRef.current?.pause(); audioRef.current = null } catch {  }
    try { window.speechSynthesis?.cancel() } catch {  }
  }

  async function toggleMic() {
    if (listening) { recRef.current?.stop(); return }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(s)
      const chunks: Blob[] = []
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
      rec.onstop = async () => {
        s.getTracks().forEach(t => t.stop()); setListening(false)
        const blob = new Blob(chunks, { type: 'audio/webm' })
        if (blob.size < 800) return
        const b64 = await new Promise<string>(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(blob) })
        setThink(true)
        try {
          const tr = await fetch('/api/camera/transcribe', {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...aiHeaders() },
            body: JSON.stringify({ audio: b64, mime: 'audio/webm' }),
          })
          const tj = await tr.json().catch(() => null)
          const query = (tj?.text || '').trim()
          if (!query) { setToast("Didn't catch that"); setTimeout(() => setToast(''), 1800); return }
          setVoice(`“${query}”`)
          const a = await analyze('ask', { query })
          const answer = a?.answer || "I couldn't work that out from this frame."
          setVoice(`“${query}”\n\n${answer}`)
          speak(answer)
        } finally { setThink(false) }
      }
      recRef.current = rec; rec.start(); setListening(true)
      setTimeout(() => { if (rec.state === 'recording') rec.stop() }, 12000)
    } catch {
      setToast('Microphone permission needed'); setTimeout(() => setToast(''), 2200)
    }
  }

  const statusTone = grade?.status === 'correct' ? '#34d399'
    : grade?.status === 'mistake' ? 'var(--c-error)' : 'var(--c-cyan)'

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden', zIndex: 60 }}>
      <video ref={videoRef} playsInline muted autoPlay
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <canvas ref={sampleRef} style={{ display: 'none' }} />
      <canvas ref={grabRef} style={{ display: 'none' }} />

      {/* vignette so floating chrome stays readable over any scene */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.75) 100%)' }} />

      {camErr && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 28 }}>
          <div style={glass({ padding: 24, maxWidth: 340, textAlign: 'center' })}>
            <AlertTriangle size={26} color="var(--c-error)" style={{ marginBottom: 10 }} />
            <p style={{ color: '#fff', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{camErr}</p>
            <button onClick={onExit} className="kyno-chunky" style={{ marginTop: 16, padding: '10px 18px', fontSize: 13 }}>Go back</button>
          </div>
        </div>
      )}

      {/* ── TOP FLOATING ROW ── */}
      <div style={{ position: 'absolute', top: 'calc(14px + env(safe-area-inset-top))', left: 14, right: 14,
        display: 'flex', alignItems: 'center', gap: 10, zIndex: 3 }}>
        <button onClick={onExit} style={orb} aria-label="Back"><ArrowLeft size={19} /></button>

        <motion.div layout style={glass({ flex: 1, padding: '9px 14px', borderRadius: 999, textAlign: 'center', minWidth: 0 })}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {detected?.subject || (ready ? 'Looking for a question…' : 'Starting camera…')}
          </div>
          {detected?.topic && (
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {detected.topic}
            </div>
          )}
        </motion.div>

        <button onClick={toggleTorch} style={{ ...orb, color: torch ? '#ffb020' : '#fff' }} aria-label="Flashlight">
          {torch ? <Zap size={18} /> : <ZapOff size={18} />}
        </button>
      </div>

      {/* ── DYNAMIC ISLAND · live grading ── */}
      <AnimatePresence>
        {(grade || thinking) && phase !== 'done' && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            style={{ position: 'absolute', top: 'calc(74px + env(safe-area-inset-top))', right: 14, zIndex: 3,
              ...glass({ padding: '10px 13px', borderRadius: 22, minWidth: 132 }) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: grade ? 8 : 0 }}>
              {thinking
                ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-flex' }}><Loader2 size={13} color="var(--c-cyan)" /></motion.span>
                : <span style={{ width: 8, height: 8, borderRadius: 4, background: statusTone, boxShadow: `0 0 10px ${statusTone}` }} />}
              <span style={{ fontSize: 11.5, fontWeight: 800, color: '#fff', letterSpacing: 0.2 }}>
                {thinking ? 'Reading…' : grade?.status === 'correct' ? 'On track' : grade?.status === 'mistake' ? 'Check that' : 'Watching'}
              </span>
            </div>
            {grade && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 12px' }}>
                <Metric label="Progress" value={`${grade.progress ?? 0}%`} />
                <Metric label="Accuracy" value={`${grade.accuracy ?? 0}%`} tone={(grade.accuracy ?? 100) < 70 ? 'var(--c-error)' : '#34d399'} />
                <Metric label="Mistakes" value={String(grade.mistakes ?? 0)} tone={(grade.mistakes ?? 0) > 0 ? '#ffb020' : undefined} />
                <Metric label="Confidence" value={grade.confidence || '—'} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── question card ── */}
      <AnimatePresence>
        {detected?.question && phase !== 'done' && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }}
            style={{ position: 'absolute', left: 14, right: 14, bottom: 'calc(150px + env(safe-area-inset-bottom))', zIndex: 2,
              ...glass({ padding: 14 }) }}>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 8 }}>
              {[detected.difficulty, detected.questionType, detected.estMinutes ? `~${detected.estMinutes} min` : null]
                .filter(Boolean).map((t, i) => (
                <span key={i} style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999,
                  background: 'rgba(124,92,255,0.24)', border: '1px solid rgba(124,92,255,0.45)', color: '#cfc4ff' }}>{t}</span>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#fff', lineHeight: 1.55,
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {detected.question}
            </p>
            {grade?.feedback && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.12)',
                fontSize: 12.5, color: statusTone, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                {grade.status === 'correct' ? <Check size={13} /> : <AlertTriangle size={13} />}
                {grade.feedback}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── voice bubble ── */}
      <AnimatePresence>
        {voiceReply && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            onClick={() => setVoice('')}
            style={{ position: 'absolute', left: 14, right: 14, top: 'calc(150px + env(safe-area-inset-top))', zIndex: 4,
              ...glass({ padding: 14, cursor: 'pointer' }) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Volume2 size={12} color="var(--c-cyan)" />
              <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--c-cyan)', letterSpacing: 1, textTransform: 'uppercase' }}>Kyno</span>
              <X size={12} color="rgba(255,255,255,0.5)" style={{ marginLeft: 'auto' }} />
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#fff', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{voiceReply}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', bottom: 'calc(120px + env(safe-area-inset-bottom))', left: 0, right: 0, zIndex: 5,
              display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ ...glass({ padding: '9px 16px', borderRadius: 999 }), fontSize: 12.5, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BOTTOM FLOATING DOCK ── */}
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 'calc(14px + env(safe-area-inset-bottom))', zIndex: 3,
        ...glass({ padding: '10px 8px', borderRadius: 26 }) }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Dock icon={Menu}         label="Menu"     onClick={() => window.dispatchEvent(new CustomEvent('kyno:open-drawer'))} />
          <Dock icon={Camera}       label="Capture"  onClick={() => { const f = grabFrame(1200, 0.85); if (f) { setToast('Frame captured'); setTimeout(() => setToast(''), 1600) } }} />
          <Dock icon={BookmarkPlus} label="Cards"    onClick={makeFlashcards} />
          <Dock icon={listening ? Square : Mic} label={listening ? 'Stop' : 'Ask'} onClick={toggleMic} tone={listening ? 'var(--c-error)' : undefined} pulse={listening} />
          <Dock icon={Lightbulb}    label={hintLevel ? `Hint ${hintLevel}/4` : 'Hint'} onClick={nextHint} tone="#ffb020" />
          <Dock icon={Sparkles}     label="Explain"  onClick={doExplain} />
          <Dock icon={StopCircle}   label="End"      onClick={endSession} tone="var(--c-error)" />
        </div>
        <div style={{ textAlign: 'center', fontSize: 9.5, color: 'rgba(255,255,255,0.42)', marginTop: 6 }}>
          {calls >= SESSION_CAP ? 'Session limit reached — end and start a new one' : `${SESSION_CAP - calls} AI reads left this session`}
        </div>
      </div>

      {/* ── SHEETS ── */}
      <AnimatePresence>
        {sheet && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            style={{ position: 'absolute', inset: '8% 0 0', zIndex: 10,
              ...glass({ borderRadius: '26px 26px 0 0', background: 'rgba(10,12,20,0.94)', display: 'flex', flexDirection: 'column' }) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>
                {sheet === 'explain' ? 'Full explanation' : sheet === 'hint' ? `Hint · level ${hintLevel} of 4` : 'Session report'}
              </span>
              <button onClick={() => setSheet('')} style={{ ...orb, width: 32, height: 32, marginLeft: 'auto' }}><X size={16} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 18, WebkitOverflowScrolling: 'touch' }}>
              {sheet === 'report' ? (
                report ? <ReportView r={report} /> : <Waiting text="Marking your work…" />
              ) : (sheet === 'explain' ? explainMd : hint) ? (
                <div className="prose-ai" style={{ fontSize: 13.5, color: '#e4e4e7', lineHeight: 1.75 }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {sheet === 'explain' ? explainMd : hint}
                  </ReactMarkdown>
                </div>
              ) : <Waiting text={sheet === 'explain' ? 'Reading the page…' : 'Thinking of a nudge…'} />}
            </div>

            {sheet === 'hint' && hintLevel < 4 && hint && (
              <div style={{ padding: 14, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <button onClick={nextHint} className="kyno-chunky" style={{ width: '100%', padding: 12, fontSize: 13.5 }}>
                  Still stuck — bigger hint ({hintLevel + 1}/4)
                </button>
              </div>
            )}
            {sheet === 'report' && report && (
              <div style={{ padding: 14, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <button onClick={onExit} className="kyno-chunky" style={{ width: '100%', padding: 12, fontSize: 13.5 }}>Done</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── small pieces ── */
function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: tone || '#fff', lineHeight: 1.25 }}>{value}</div>
    </div>
  )
}

function Dock({ icon: Icon, label, onClick, tone, pulse }: { icon: any; label: string; onClick: () => void; tone?: string; pulse?: boolean }) {
  return (
    <motion.button whileTap={{ scale: 0.9 }} onClick={onClick}
      style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '3px 0',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontFamily: 'inherit', minWidth: 0 }}>
      <motion.span
        animate={pulse ? { scale: [1, 1.16, 1] } : {}}
        transition={pulse ? { duration: 1.1, repeat: Infinity } : {}}
        style={{ width: 32, height: 32, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          background: tone ? `${tone}22` : 'rgba(255,255,255,0.10)', border: `1px solid ${tone ? tone + '66' : 'rgba(255,255,255,0.14)'}` }}>
        <Icon size={15} color={tone || '#fff'} />
      </motion.span>
      <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.82)', fontWeight: 700, whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', letterSpacing: -0.1 }}>{label}</span>
    </motion.button>
  )
}

function Waiting({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 0' }}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{ width: 26, height: 26, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.14)', borderTopColor: 'var(--c-cyan)' }} />
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{text}</span>
    </div>
  )
}

function Bar({ label, v }: { label: string; v?: number }) {
  const n = Math.max(0, Math.min(100, v ?? 0))
  const tone = n >= 80 ? '#34d399' : n >= 55 ? '#ffb020' : 'var(--c-error)'
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 5 }}>
        <span style={{ color: 'rgba(255,255,255,0.72)', fontWeight: 600 }}>{label}</span>
        <span style={{ color: tone, fontWeight: 800 }}>{n}%</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.09)', borderRadius: 3, overflow: 'hidden' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${n}%` }} transition={{ duration: 0.6 }}
          style={{ height: '100%', background: tone, borderRadius: 3 }} />
      </div>
    </div>
  )
}

function ReportView({ r }: { r: Report }) {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 46, fontWeight: 900, color: (r.overallAccuracy ?? 0) >= 70 ? '#34d399' : 'var(--c-error)', lineHeight: 1 }}>
          {r.overallAccuracy ?? 0}<span style={{ fontSize: 18, color: 'rgba(255,255,255,0.45)' }}>%</span>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
          {r.finalAnswerCorrect ? 'Final answer correct' : 'Final answer needs work'}
        </div>
      </div>
      {r.summary && <p style={{ fontSize: 13.5, color: '#e4e4e7', lineHeight: 1.7, marginBottom: 18 }}>{r.summary}</p>}
      <Bar label="Concept understanding" v={r.conceptUnderstanding} />
      <Bar label="Calculation accuracy"  v={r.calculationAccuracy} />
      <Bar label="Presentation"          v={r.presentation} />
      <Bar label="Neatness"              v={r.neatness} />
      <Bar label="Confidence"            v={r.confidenceScore} />
      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        {r.strongConcept && <Pill tone="#34d399" label="Strong" text={r.strongConcept} />}
        {r.weakConcept   && <Pill tone="var(--c-error)" label="Fix next" text={r.weakConcept} />}
      </div>
      {!!r.flashcards?.length && (
        <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', marginTop: 16 }}>
          {r.flashcards.length} flashcards saved to your deck · weak spot tracked in Mistake Analysis
        </p>
      )}
    </div>
  )
}

function Pill({ tone, label, text }: { tone: string; label: string; text: string }) {
  return (
    <div style={{ padding: '10px 13px', borderRadius: 12, background: `${tone}14`, border: `1px solid ${tone}44` }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: tone, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#fff', marginTop: 3 }}>{text}</div>
    </div>
  )
}
