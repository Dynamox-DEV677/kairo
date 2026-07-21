import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, MicOff, Volume2, VolumeX, Square, Send, Sparkles,
  AlertCircle, Settings, RefreshCw,
} from 'lucide-react'
import { chat } from '../lib/openrouter'
import { saveToNotebook } from '../lib/notebook'

interface Turn {
  role: 'user' | 'assistant'
  text: string
  id:   string
}

const SYSTEM = `You are Kyno, a warm AI voice tutor for Indian school students (CBSE/ICSE/state boards).
You're speaking out loud — keep replies short (under 80 words), conversational, and clear.
Avoid markdown, lists, or headings — use natural spoken language.
For math, say expressions in words (e.g. "x squared plus three x").
End with one quick question to keep the dialog flowing.`

const card: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(14px) saturate(140%)', WebkitBackdropFilter: 'blur(14px) saturate(140%)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }

const SpeechRecognitionCtor: any =
  (typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null
const speechSynthAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window

export default function VoiceTutor() {
  const [turns, setTurns]       = useState<Turn[]>([])
  const [interim, setInterim]   = useState('')
  const [listening, setListening] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [muted, setMuted]       = useState(false)
  const [err, setErr]           = useState('')
  const [textInput, setTextInput] = useState('')
  const [voices, setVoices]     = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<string>('')
  const [showSettings, setShowSettings] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)

  const recogRef    = useRef<any>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const animRef     = useRef<number | null>(null)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const utterRef    = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    if (!speechSynthAvailable) return
    const loadVoices = () => {
      const list = speechSynthesis.getVoices()
      setVoices(list)
      if (!selectedVoice && list.length > 0) {
        const enVoice = list.find(v => v.lang.startsWith('en'))
        setSelectedVoice(enVoice?.name || list[0].name)
      }
    }
    loadVoices()
    speechSynthesis.onvoiceschanged = loadVoices
    return () => { speechSynthesis.onvoiceschanged = null as any }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns, interim, thinking])

  useEffect(() => () => {
    stopAll()
    if (utterRef.current) speechSynthesis.cancel()
  }, [])

  function stopAll() {
    if (recogRef.current) {
      try { recogRef.current.stop() } catch {}
      recogRef.current = null
    }
    if (animRef.current) cancelAnimationFrame(animRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    setListening(false)
    setAudioLevel(0)
  }

  async function startListening() {
    setErr('')
    if (!SpeechRecognitionCtor) {
      setErr('Voice input not supported in this browser. Use the text box below.')
      return
    }

    if (speaking) speechSynthesis.cancel()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      const dataArr = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(dataArr)
        let sum = 0
        for (const v of dataArr) sum += v
        setAudioLevel(sum / dataArr.length / 255)
        animRef.current = requestAnimationFrame(tick)
      }
      tick()

      const recog = new SpeechRecognitionCtor()
      recog.lang             = 'en-IN'
      recog.continuous       = false
      recog.interimResults   = true
      recog.maxAlternatives  = 1

      let finalTranscript = ''

      recog.onresult = (ev: any) => {
        let interimText = ''
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i]
          if (r.isFinal) finalTranscript += r[0].transcript
          else interimText += r[0].transcript
        }
        setInterim(interimText)
      }

      recog.onerror = (ev: any) => {
        if (ev.error === 'no-speech') return
        setErr(`Voice error: ${ev.error}`)
        stopAll()
      }

      recog.onend = () => {
        setInterim('')
        setListening(false)
        if (animRef.current) cancelAnimationFrame(animRef.current)
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
        if (finalTranscript.trim()) ask(finalTranscript.trim())
      }

      recog.start()
      recogRef.current = recog
      setListening(true)
    } catch (e: any) {
      setErr('Microphone access denied: ' + (e.message || 'unknown'))
      stopAll()
    }
  }

  function stopListening() {
    if (recogRef.current) try { recogRef.current.stop() } catch {}
  }

  async function ask(question: string) {
    const userTurn: Turn = { role: 'user', text: question, id: Date.now().toString() }
    setTurns(prev => [...prev, userTurn])
    setThinking(true); setErr('')

    let memoryContext = ''
    try {
      const r = await fetch('/api/memory/context', {
        headers: { Authorization: `Bearer ${localStorage.getItem('kairo_token') || ''}` },
      })
      if (r.ok) memoryContext = (await r.json()).context || ''
    } catch {  }

    try {
      const reply = await chat({
        messages: [
          { role: 'system', content: SYSTEM + memoryContext },
          ...turns.map(t => ({ role: t.role as 'user' | 'assistant', content: t.text })),
          { role: 'user', content: question },
        ],
      })

      const aiTurn: Turn = { role: 'assistant', text: reply.trim(), id: (Date.now() + 1).toString() }
      setTurns(prev => [...prev, aiTurn])

      if (!muted) speak(aiTurn.text)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setThinking(false)
    }
  }

  function speak(text: string) {
    if (!speechSynthAvailable) return
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const voice = voices.find(v => v.name === selectedVoice)
    if (voice) u.voice = voice
    u.rate  = 1.0
    u.pitch = 1.0
    u.volume = 1.0
    u.onstart = () => setSpeaking(true)
    u.onend   = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    utterRef.current = u
    speechSynthesis.speak(u)
  }

  function stopSpeaking() {
    speechSynthesis.cancel()
    setSpeaking(false)
  }

  function submitText() {
    if (!textInput.trim()) return
    const q = textInput.trim()
    setTextInput('')
    ask(q)
  }

  function clearAll() {
    if (!confirm('Clear this conversation?')) return
    setTurns([])
    setInterim('')
    stopSpeaking()
  }

  async function saveSession() {
    if (turns.length === 0) return
    const md = turns.map(t => `**${t.role === 'user' ? 'You' : 'Kyno'}:** ${t.text}`).join('\n\n')
    const r = await saveToNotebook({
      kind: 'doubt',
      title: `Voice session · ${turns[0]?.text?.slice(0, 60) || 'Untitled'}`,
      content: md,
      tags: ['voice'],
      source: 'voice-tutor',
    })
    if (r) alert('Saved to notebook.')
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 880, margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18, flexShrink: 0 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: 'linear-gradient(135deg, #A5B4FC, #8FA0FA)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 18px rgba(165, 180, 252, 0.03)', flexShrink: 0,
        }}>
          <Mic size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Voice Tutor</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            Talk to Kyno naturally · personalized with your AI Memory
          </p>
        </div>
        <button onClick={() => setMuted(m => !m)}
          title={muted ? 'Unmute Kyno' : 'Mute Kyno'}
          style={{
            width: 36, height: 36, borderRadius: 9,
            background: muted ? 'rgba(165, 180, 252, 0.1)' : '#1C2233',
            border: `1px solid ${muted ? 'rgba(165, 180, 252, 0.14)' : '#1f2532'}`,
            color: muted ? '#A5B4FC' : '#9CA3AF', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        <button onClick={() => setShowSettings(s => !s)} title="Voice settings"
          style={{
            width: 36, height: 36, borderRadius: 9,
            background: '#1C2233', border: '1px solid #1f2532',
            color: '#9CA3AF', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Settings size={14} />
        </button>
      </div>

      {(!SpeechRecognitionCtor || !speechSynthAvailable) && (
        <div style={{
          marginBottom: 14, padding: '10px 14px', borderRadius: 8, flexShrink: 0,
          background: 'rgba(165, 180, 252, 0.06)', border: '1px solid rgba(165, 180, 252, 0.25)',
          fontSize: 12, color: '#A5B4FC', display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            {!SpeechRecognitionCtor && 'Voice input not supported in this browser. '}
            {!speechSynthAvailable && 'Voice output not supported in this browser. '}
            Use Chrome / Edge for the full experience. Text input still works below.
          </span>
        </div>
      )}

      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ ...card, padding: 14, marginBottom: 12, overflow: 'hidden', flexShrink: 0 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1.2, display: 'block', marginBottom: 6 }}>
              Voice
            </label>
            <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}
              style={{
                width: '100%', background: '#141A2A', border: '1px solid #1f2532',
                borderRadius: 7, padding: '7px 10px', color: '#fafafa', fontSize: 12,
                fontFamily: 'inherit', outline: 'none', appearance: 'none' as any,
              }}>
              {voices.length === 0 && <option>(no voices available)</option>}
              {voices.map(v => (
                <option key={v.name} value={v.name}>{v.name} — {v.lang}</option>
              ))}
            </select>
          </motion.div>
        )}
      </AnimatePresence>

      {err && (
        <div style={{
          marginBottom: 12, padding: '10px 14px', borderRadius: 8, flexShrink: 0,
          background: 'rgba(165, 180, 252, 0.08)', border: '1px solid rgba(165, 180, 252, 0.25)',
          fontSize: 12, color: '#A5B4FC',
        }}>
          {err}
        </div>
      )}

      <div style={{ ...card, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {turns.length === 0 && !interim && !thinking && (
            <div style={{
              height: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 14, color: '#4B5563',
              textAlign: 'center', padding: 24,
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18,
                background: 'rgba(165, 180, 252, 0.08)', border: '1px solid rgba(165, 180, 252, 0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={28} color="#A5B4FC" />
              </div>
              <div>
                <p style={{ fontSize: 14, color: '#B1B5BA', margin: 0, marginBottom: 6, fontWeight: 600 }}>
                  Tap the mic and ask anything
                </p>
                <p style={{ fontSize: 12, color: '#6B7280', margin: 0, maxWidth: 380, lineHeight: 1.6 }}>
                  Try: "Explain quadratic equations like I'm 12" or "Why does mitosis matter?"
                </p>
              </div>
            </div>
          )}

          {turns.map(t => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'flex', flexDirection: t.role === 'user' ? 'row-reverse' : 'row',
                gap: 10, alignItems: 'flex-start', marginBottom: 14,
              }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                background: t.role === 'user' ? '#7C5CFF' : 'linear-gradient(135deg,#A5B4FC,#8FA0FA)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {t.role === 'user' ? <Mic size={13} color="#fff" /> : <Sparkles size={13} color="#fff" />}
              </div>
              <div style={{
                maxWidth: '78%',
                padding: '10px 14px',
                borderRadius: t.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                background: t.role === 'user' ? 'linear-gradient(135deg,#7C5CFF,#7C5CFF)' : '#1a1a2e',
                fontSize: 13.5, color: '#fafafa', lineHeight: 1.55,
              }}>
                {t.text}
              </div>
            </motion.div>
          ))}

          {interim && (
            <div style={{
              display: 'flex', flexDirection: 'row-reverse', gap: 10, alignItems: 'flex-start', marginBottom: 14,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                background: '#7C5CFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Mic size={13} color="#fff" />
              </div>
              <div style={{
                maxWidth: '78%', padding: '10px 14px',
                borderRadius: '12px 4px 12px 12px',
                background: 'rgba(124, 92, 255, 0.15)', border: '1px solid rgba(124, 92, 255, 0.3)',
                fontSize: 13.5, color: '#A5B4FC', lineHeight: 1.55, fontStyle: 'italic',
              }}>
                {interim}…
              </div>
            </div>
          )}

          {thinking && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: 'linear-gradient(135deg,#A5B4FC,#8FA0FA)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={13} color="#fff" />
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#A5B4FC',
                    animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 12, color: '#6B7280' }}>Thinking…</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div style={{
          padding: '16px 18px', borderTop: '1px solid #171D2D',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={listening ? stopListening : startListening}
            disabled={thinking || !SpeechRecognitionCtor}
            style={{
              width: 56, height: 56, borderRadius: '50%',
              border: 'none', flexShrink: 0,
              background: !SpeechRecognitionCtor || thinking ? '#171D2D'
                : listening ? 'linear-gradient(135deg,#A5B4FC,#A5B4FC)'
                : 'linear-gradient(135deg,#A5B4FC,#8FA0FA)',
              color: '#fff', cursor: !SpeechRecognitionCtor || thinking ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: listening
                ? `0 0 ${20 + audioLevel * 30}px rgba(165, 180, 252, ${0.4 + audioLevel * 0.4})`
                : '0 0 18px rgba(165, 180, 252, 0.35)',
              transition: 'box-shadow 0.1s',
              position: 'relative',
            }}>
            {listening
              ? <Square size={20} color="#fff" />
              : !SpeechRecognitionCtor
                ? <MicOff size={22} />
                : <Mic size={22} />}

            {listening && (
              <>
                <motion.div animate={{ scale: [1, 1.7, 1.7], opacity: [0.4, 0, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                  style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    border: '2px solid #A5B4FC', pointerEvents: 'none',
                  }} />
                <motion.div animate={{ scale: [1, 1.7, 1.7], opacity: [0.4, 0, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
                  style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    border: '2px solid #A5B4FC', pointerEvents: 'none',
                  }} />
              </>
            )}
          </motion.button>

          <div style={{ flex: 1 }}>
            <input
              type="text"
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitText()}
              placeholder={listening ? 'Listening…' : 'Or type a question…'}
              disabled={listening || thinking}
              style={{
                width: '100%', background: '#141A2A', border: '1px solid #1f2532',
                borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#fafafa',
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                opacity: listening || thinking ? 0.5 : 1,
              }}
            />
          </div>

          <button onClick={submitText} disabled={!textInput.trim() || listening || thinking}
            style={{
              width: 38, height: 38, borderRadius: 9, flexShrink: 0,
              background: textInput.trim() ? 'linear-gradient(135deg,#7C5CFF,#7C5CFF)' : '#171D2D',
              border: 'none', color: textInput.trim() ? '#fff' : '#6B7280',
              cursor: textInput.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <Send size={14} />
          </button>

          {speaking && (
            <button onClick={stopSpeaking} title="Stop AI voice"
              style={{
                width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                background: 'rgba(165, 180, 252, 0.1)', border: '1px solid rgba(165, 180, 252, 0.14)',
                color: '#A5B4FC', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <Square size={13} />
            </button>
          )}
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end', flexShrink: 0,
      }}>
        {turns.length > 0 && (
          <>
            <button onClick={saveSession}
              style={{
                padding: '7px 13px', borderRadius: 7,
                border: '1px solid rgba(165, 180, 252, 0.3)',
                background: 'rgba(165, 180, 252, 0.08)', color: '#A5B4FC',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
              Save to Notebook
            </button>
            <button onClick={clearAll}
              style={{
                padding: '7px 13px', borderRadius: 7, border: '1px solid #1f2532',
                background: '#1C2233', color: '#9CA3AF', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5,
              }}>
              <RefreshCw size={11} /> New conversation
            </button>
          </>
        )}
      </div>
    </div>
  )
}
