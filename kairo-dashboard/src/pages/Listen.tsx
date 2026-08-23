import { useMemo, useState, useRef, useEffect } from 'react'
import { Headphones, Play, Pause, SkipForward, Square, ArrowRight } from 'lucide-react'
import { PrimaryButton } from '../components/PrimaryButton'
import { listFormulas, listFlashcards } from '../lib/twin'
import { buildDeck } from '../lib/reels.core'
import { buildPlaylist, type ListenItem } from '../lib/listen.core'
import { speak, stopSpeaking, pauseSpeaking, resumeSpeaking, ttsAvailable } from '../lib/tts'

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

  const items = useMemo(() => {
    try {
      return buildPlaylist(buildDeck({ formulas: listFormulas(), flashcards: listFlashcards() }, { now: Date.now() }))
    } catch { return [] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  // Leaving the page stops the voice — nothing should keep talking unseen.
  useEffect(() => () => stopSpeaking(), [])

  const supported = ttsAvailable()

  function playFrom(index: number, list: ListenItem[]) {
    const item = list[index]
    if (!item) { setPlayingId(null); return }
    setPlayingId(item.id)
    setPaused(false)
    speak(item.script, {
      rate: rateRef.current,
      onend: () => playFrom(index + 1, list),
    })
  }

  function playAll() { queueRef.current = items; playFrom(0, items) }
  function playOne(item: ListenItem) { queueRef.current = [item]; playFrom(0, [item]) }
  function skip() {
    const list = queueRef.current
    const i = list.findIndex(x => x.id === playingId)
    stopSpeaking()
    playFrom(i + 1, list)
  }
  function stopAll() { stopSpeaking(); setPlayingId(null); setPaused(false) }
  function togglePause() {
    if (paused) { resumeSpeaking(); setPaused(false) }
    else { pauseSpeaking(); setPaused(true) }
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(item => {
                const active = item.id === playingId
                return (
                  <div key={item.id} style={{
                    ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    border: `1px solid ${active ? 'rgba(124,92,255,0.55)' : C.border}`,
                    background: active ? 'rgba(124,92,255,0.08)' : C.panel,
                  }}>
                    <button
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
