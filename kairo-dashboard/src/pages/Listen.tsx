import { useMemo, useState, useRef, useEffect } from 'react'
import { Headphones, Play, Pause, SkipForward, Square, ArrowRight } from 'lucide-react'
import { PrimaryButton } from '../components/PrimaryButton'
import { listFormulas, listFlashcards } from '../lib/twin'
import { buildDeck } from '../lib/reels.core'
import { buildPlaylist, type ListenItem } from '../lib/listen.core'
import {
  speak, stopSpeaking, pauseSpeaking, resumeSpeaking, ttsAvailable,
  listVoices, setPreferredVoice, getPreferredVoice,
} from '../lib/tts'
import {
  speakOnline, stopOnline, pauseOnline, resumeOnline, isOnlineActive, HD_VOICES,
} from '../lib/ttsOnline'
import {
  speakNeural, stopNeural, pauseNeural, resumeNeural, isNeuralActive,
  loadNeural, neuralStatus, NEURAL_VOICES, NEURAL_VOICE_LABELS,
} from '../lib/ttsNeural'

/**
 * Revise with your ears — the student's own reel cards as a spoken playlist.
 * Due cards lead (same order Reels shows), each card reads question → answer
 * via the device's built-in voice: free, offline, screen-off friendly.
 */

const C = {
  bg: '#0A0D16', panel: '#141A2A', border: 'rgba(255,255,255,0.08)',
  text: '#fafafa', dim: '#B1B5BA', faint: '#9CA3AF', purple: '#A5B4FC', green: '#34D399',
}
const card: React.CSSProperties = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }

const RATES = [1, 1.25, 1.5, 0.85]

export default function Listen() {
  const [tick] = useState(0)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const [rate, setRate] = useState(1)
  const queueRef = useRef<ListenItem[]>([])
  const rateRef = useRef(rate)
  rateRef.current = rate

  // Voice source: the device's own voices, Kyno's online HD voice, or the
  // on-device Neural voice (Kokoro — one ~90MB download, then offline forever).
  type Source = 'device' | 'hd' | 'neural'
  const [source, setSource] = useState<Source>(() => {
    try {
      const saved = localStorage.getItem('kyno:listen:source') as Source | null
      if (saved === 'device' || saved === 'hd' || saved === 'neural') return saved
      return localStorage.getItem('kyno:listen:hd') === '1' ? 'hd' : 'device' // migrate the old toggle
    } catch { return 'device' }
  })
  const sourceRef = useRef(source); sourceRef.current = source
  function pickSource(s: Source) {
    setSource(s); setHdNote('')
    try { localStorage.setItem('kyno:listen:source', s) } catch {}
    if (s === 'neural') loadNeural().catch(() => {}) // start the one-time download immediately
  }

  const [hdVoice, setHdVoice] = useState(() => { try { return localStorage.getItem('kyno:listen:hdvoice') || HD_VOICES[0] } catch { return HD_VOICES[0] } })
  const [hdNote, setHdNote] = useState('')
  const hdVoiceRef = useRef(hdVoice); hdVoiceRef.current = hdVoice
  function pickHdVoice(v: string) {
    setHdVoice(v)
    try { localStorage.setItem('kyno:listen:hdvoice', v) } catch {}
  }

  const [neuralVoice, setNeuralVoice] = useState<string>(() => { try { return localStorage.getItem('kyno:listen:nvoice') || NEURAL_VOICES[0] } catch { return NEURAL_VOICES[0] } })
  const neuralVoiceRef = useRef(neuralVoice); neuralVoiceRef.current = neuralVoice
  function pickNeuralVoice(v: string) {
    setNeuralVoice(v)
    try { localStorage.setItem('kyno:listen:nvoice', v) } catch {}
  }

  // Poll the model download so the progress line moves.
  const [nStat, setNStat] = useState(neuralStatus)
  useEffect(() => {
    if (source !== 'neural') return
    const id = window.setInterval(() => setNStat(neuralStatus()), 500)
    return () => window.clearInterval(id)
  }, [source])

  // Device voices load async on some browsers — refresh when they arrive.
  const [deviceVoices, setDeviceVoices] = useState(listVoices)
  const [devVoice, setDevVoice] = useState(() => getPreferredVoice() || '')
  useEffect(() => {
    const refresh = () => setDeviceVoices(listVoices())
    try { window.speechSynthesis?.addEventListener?.('voiceschanged', refresh) } catch {}
    return () => { try { window.speechSynthesis?.removeEventListener?.('voiceschanged', refresh) } catch {} }
  }, [])

  const items = useMemo(() => {
    try {
      return buildPlaylist(buildDeck({ formulas: listFormulas(), flashcards: listFlashcards() }, { now: Date.now() }))
    } catch { return [] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  // Leaving the page stops the voice — nothing should keep talking unseen.
  useEffect(() => () => { stopSpeaking(); stopOnline(); stopNeural() }, [])

  const supported = ttsAvailable()

  async function playFrom(index: number, list: ListenItem[]) {
    const item = list[index]
    if (!item) { setPlayingId(null); return }
    setPlayingId(item.id)
    setPaused(false)
    const next = () => playFrom(index + 1, list)

    // The chain: chosen source first, then graceful steps down — the playlist
    // never stalls on a download, the network, or a rate limit.
    if (sourceRef.current === 'neural') {
      try {
        await speakNeural(item.script, { voice: neuralVoiceRef.current, rate: rateRef.current, onend: next })
        setHdNote('')
        return
      } catch {
        setHdNote('Neural voice not ready — using a fallback for this card.')
      }
    }
    if ((sourceRef.current === 'hd' || sourceRef.current === 'neural') && navigator.onLine) {
      try {
        await speakOnline(item.script, { voice: hdVoiceRef.current, rate: rateRef.current, onend: next })
        if (sourceRef.current === 'hd') setHdNote('')
        return
      } catch {
        if (sourceRef.current === 'hd') setHdNote('HD voice unavailable right now — using the device voice.')
      }
    }
    speak(item.script, { rate: rateRef.current, onend: next })
  }

  function playAll() { queueRef.current = items; playFrom(0, items) }
  function playOne(item: ListenItem) { queueRef.current = [item]; playFrom(0, [item]) }
  function skip() {
    const list = queueRef.current
    const i = list.findIndex(x => x.id === playingId)
    stopSpeaking(); stopOnline(); stopNeural()
    playFrom(i + 1, list)
  }
  function stopAll() { stopSpeaking(); stopOnline(); stopNeural(); setPlayingId(null); setPaused(false) }
  function togglePause() {
    if (paused) {
      if (isNeuralActive()) resumeNeural(); else if (isOnlineActive()) resumeOnline(); else resumeSpeaking()
      setPaused(false)
    } else {
      if (isNeuralActive()) pauseNeural(); else if (isOnlineActive()) pauseOnline(); else pauseSpeaking()
      setPaused(true)
    }
  }
  function cycleRate() {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length]
    setRate(next)
  }

  const go = (view: string) => { try { (window as any).__kairoSetActive?.(view) } catch {} }

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: C.bg, padding: '24px 20px 80px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: 'linear-gradient(135deg, #A5B4FC 0%, #7C5CFF 60%, #0B1530 100%)', display: 'grid', placeItems: 'center' }}>
            <Headphones size={22} color="#000" strokeWidth={2.4} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: -0.4 }}>Listen</h1>
            <div style={{ fontSize: 12, color: C.faint }}>Your own revision cards, read aloud — due ones first. Walk around; the screen can rest.</div>
          </div>
        </div>

        {!supported && (
          <div style={{ ...card, marginBottom: 14, fontSize: 12.5, color: C.dim }}>
            This device's browser has no built-in voice. On phones, Chrome and Samsung Internet both do.
          </div>
        )}

        {items.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 14, color: C.dim, marginBottom: 6 }}>Nothing to listen to yet.</div>
            <div style={{ fontSize: 12, color: C.faint, marginBottom: 16 }}>
              Your playlist is built from your Revision Reels cards — save a doubt to Reels or add a starter deck and it appears here.
            </div>
            <PrimaryButton variant="secondary" onClick={() => go('reels')}>Open Revision Reels <ArrowRight size={13} /></PrimaryButton>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              {playingId == null ? (
                <PrimaryButton onClick={playAll} disabled={!supported}><Play size={13} /> Play all ({items.length})</PrimaryButton>
              ) : (
                <>
                  <PrimaryButton onClick={togglePause}>{paused ? <><Play size={13} /> Resume</> : <><Pause size={13} /> Pause</>}</PrimaryButton>
                  <PrimaryButton variant="secondary" onClick={skip}><SkipForward size={13} /> Skip</PrimaryButton>
                  <PrimaryButton variant="secondary" onClick={stopAll}><Square size={12} /> Stop</PrimaryButton>
                </>
              )}
              <button className="kyno-chip" onClick={cycleRate} style={{ padding: '8px 14px', fontSize: 12, marginLeft: 'auto' }}>
                {rate}× speed
              </button>
            </div>

            {/* voice source: device / HD online / neural on-device */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className={`kyno-chip${source === 'device' ? ' on' : ''}`} onClick={() => pickSource('device')} style={{ padding: '8px 13px', fontSize: 12 }}>
                Device
              </button>
              <button className={`kyno-chip${source === 'hd' ? ' on' : ''}`} onClick={() => pickSource('hd')} style={{ padding: '8px 13px', fontSize: 12 }}>
                ✨ HD · online
              </button>
              <button className={`kyno-chip${source === 'neural' ? ' on' : ''}`} onClick={() => pickSource('neural')} style={{ padding: '8px 13px', fontSize: 12 }}>
                🧠 Neural · on-device
              </button>
              {source === 'hd' && (
                <select value={hdVoice} onChange={e => pickHdVoice(e.target.value)}
                  style={{ background: C.panel, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}>
                  {HD_VOICES.map(v => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}
                </select>
              )}
              {source === 'neural' && (
                <select value={neuralVoice} onChange={e => pickNeuralVoice(e.target.value)}
                  style={{ background: C.panel, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}>
                  {NEURAL_VOICES.map(v => <option key={v} value={v}>{NEURAL_VOICE_LABELS[v] || v}</option>)}
                </select>
              )}
              {source === 'device' && deviceVoices.length > 1 && (
                <select value={devVoice} onChange={e => { setDevVoice(e.target.value); setPreferredVoice(e.target.value || null) }}
                  style={{ background: C.panel, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', outline: 'none', maxWidth: 230 }}>
                  <option value="">Best device voice (auto)</option>
                  {deviceVoices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
              )}
            </div>
            {source !== 'device' && (
              <div style={{ fontSize: 10.5, color: hdNote ? C.dim : C.faint, marginBottom: 10, lineHeight: 1.5 }}>
                {hdNote || (source === 'neural'
                  ? (nStat.status === 'ready'
                      ? `Neural voice ready — runs on this device (${nStat.device}), works offline.`
                      : nStat.status === 'downloading'
                        ? `Downloading the neural voice — one time, ~90 MB… ${nStat.progress > 0 ? nStat.progress + '%' : ''} It'll be cached after this.`
                        : nStat.status === 'error'
                          ? 'Neural voice failed to load on this device — cards fall back to HD/device voice.'
                          : 'Neural: the best quality — a one-time ~90 MB download, then it works offline forever.')
                  : 'HD uses Kyno\'s AI voice online; if it\'s busy or you\'re offline, the device voice takes over automatically.')}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(item => {
                const active = item.id === playingId
                return (
                  <div key={item.id} style={{
                    ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    border: `1px solid ${active ? 'rgba(124,92,255,0.55)' : C.border}`,
                    background: active ? 'rgba(124,92,255,0.08)' : C.panel,
                  }}>
                    <button className="kyno-text"
                      onClick={() => active ? stopAll() : playOne(item)}
                      disabled={!supported}
                      aria-label={active ? 'Stop' : 'Listen'}
                      style={{
                        width: 38, height: 38, borderRadius: '50%', border: 'none', flexShrink: 0,
                        background: active ? '#FF7A90' : '#7C5CFF', color: '#fff', cursor: 'pointer',
                        display: 'grid', placeItems: 'center',
                      }}>
                      {active ? <Square size={13} /> : <Play size={14} style={{ marginLeft: 2 }} />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: item.due ? C.green : C.faint }}>{item.sub}</div>
                    </div>
                    {active && <span style={{ fontSize: 10.5, color: C.purple, flexShrink: 0, fontWeight: 700 }}>{paused ? 'paused' : 'speaking…'}</span>}
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: 10.5, color: C.faint, marginTop: 14, lineHeight: 1.5 }}>
              Uses your device's built-in voice — free and offline. Voice quality varies by device.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
