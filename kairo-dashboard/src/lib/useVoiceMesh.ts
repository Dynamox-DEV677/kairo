import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { STUN, shouldInitiate, isForMe, reconcilePeers, rmsLevel, TALK_THRESHOLD } from './roomVoice.core'

/**
 * WebRTC voice mesh for a Study Room. Signalling rides the Supabase channel
 * the room already has; media is peer-to-peer over Google STUN — no media
 * server, no tables.
 *
 * Roles are FIXED by key comparison (roomVoice.core), so two peers can never
 * both offer at once — the class of bug that makes hand-rolled voice "connect
 * sometimes". Each pair has exactly one caller and one answerer, decided
 * identically on both sides.
 *
 * The pure decisions (who calls whom, is-this-signal-mine, roster reconcile,
 * talk detection) are tested in room-notes-voice.test.js. This file is the
 * imperative RTCPeerConnection plumbing those decisions drive.
 */

export interface VoiceSignal {
  from: string
  to: string
  kind: 'offer' | 'answer' | 'ice'
  data: any
}

export interface PeerVoice { key: string; speaking: boolean }

interface Args {
  /** Live channel getter (the channel is created in the page's effect). */
  getChannel: () => any | null
  /** My presence key. */
  meKey: string
  /** Keys of OTHER members currently on voice (from presence metadata). */
  voiceRosterKeys: string[]
  /** Called when I flip voice on/off so the page can re-track presence. */
  onVoiceStateChange: (on: boolean) => void
  /** The page hands incoming 'voice' broadcasts here. */
  registerSignalHandler: (fn: (s: VoiceSignal) => void) => void
}

export function useVoiceMesh({ getChannel, meKey, voiceRosterKeys, onVoiceStateChange, registerSignalHandler }: Args) {
  const [voiceOn, setVoiceOn] = useState(false)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState('')
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({})

  const localStream = useRef<MediaStream | null>(null)
  const peers = useRef<Map<string, RTCPeerConnection>>(new Map())
  const audioEls = useRef<Map<string, HTMLAudioElement>>(new Map())
  const analysers = useRef<Map<string, AnalyserNode>>(new Map())
  const audioCtx = useRef<AudioContext | null>(null)
  const voiceOnRef = useRef(false)
  voiceOnRef.current = voiceOn

  const send = useCallback((sig: VoiceSignal) => {
    getChannel()?.send({ type: 'broadcast', event: 'voice', payload: sig })
  }, [getChannel])

  /** Build (or reuse) a peer connection to `peerKey`. */
  const makePeer = useCallback((peerKey: string): RTCPeerConnection => {
    const existing = peers.current.get(peerKey)
    if (existing) return existing

    const pc = new RTCPeerConnection({ iceServers: STUN })
    peers.current.set(peerKey, pc)

    // My mic tracks go out to this peer.
    if (localStream.current) {
      for (const track of localStream.current.getTracks()) pc.addTrack(track, localStream.current)
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) send({ from: meKey, to: peerKey, kind: 'ice', data: e.candidate.toJSON() })
    }

    pc.ontrack = (e) => {
      let el = audioEls.current.get(peerKey)
      if (!el) {
        el = document.createElement('audio')
        el.autoplay = true
        el.style.display = 'none'
        document.body.appendChild(el)
        audioEls.current.set(peerKey, el)
      }
      el.srcObject = e.streams[0]

      // Talk detection on the remote stream.
      try {
        const ctx = audioCtx.current || (audioCtx.current = new AudioContext())
        const src = ctx.createMediaStreamSource(e.streams[0])
        const an = ctx.createAnalyser()
        an.fftSize = 512
        src.connect(an)
        analysers.current.set(peerKey, an)
      } catch { /* analyser is a nicety, never block audio on it */ }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') dropPeer(peerKey)
    }

    return pc
  }, [meKey, send])

  const dropPeer = useCallback((peerKey: string) => {
    peers.current.get(peerKey)?.close()
    peers.current.delete(peerKey)
    analysers.current.delete(peerKey)
    const el = audioEls.current.get(peerKey)
    if (el) { el.srcObject = null; el.remove(); audioEls.current.delete(peerKey) }
    setSpeaking(s => { const n = { ...s }; delete n[peerKey]; return n })
  }, [])

  /** I am the caller for this peer: create and send the offer. */
  const call = useCallback(async (peerKey: string) => {
    const pc = makePeer(peerKey)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    send({ from: meKey, to: peerKey, kind: 'offer', data: offer })
  }, [makePeer, meKey, send])

  // Incoming signalling from the page.
  useEffect(() => {
    registerSignalHandler(async (sig: VoiceSignal) => {
      if (!voiceOnRef.current || !isForMe(sig, meKey)) return
      try {
        if (sig.kind === 'offer') {
          const pc = makePeer(sig.from)
          await pc.setRemoteDescription(new RTCSessionDescription(sig.data))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          send({ from: meKey, to: sig.from, kind: 'answer', data: answer })
        } else if (sig.kind === 'answer') {
          await peers.current.get(sig.from)?.setRemoteDescription(new RTCSessionDescription(sig.data))
        } else if (sig.kind === 'ice') {
          await peers.current.get(sig.from)?.addIceCandidate(new RTCIceCandidate(sig.data))
        }
      } catch (e) { console.warn('[voice] signal error', e) }
    })
  }, [makePeer, meKey, send, registerSignalHandler])

  // React to the roster: connect to new voice members, drop leavers.
  // Only the smaller-key side calls; the larger-key side waits for the offer.
  useEffect(() => {
    if (!voiceOn) return
    const { add, drop } = reconcilePeers(voiceRosterKeys, meKey, [...peers.current.keys()])
    for (const k of drop) dropPeer(k)
    for (const k of add) if (shouldInitiate(meKey, k)) call(k)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn, voiceRosterKeys.join(','), meKey])

  // Talk-detection poll: whose analyser is above threshold right now.
  useEffect(() => {
    if (!voiceOn) return
    const iv = window.setInterval(() => {
      const next: Record<string, boolean> = {}
      for (const [key, an] of analysers.current) {
        const buf = new Uint8Array(an.fftSize)
        an.getByteTimeDomainData(buf)
        next[key] = rmsLevel(buf) > TALK_THRESHOLD
      }
      setSpeaking(next)
    }, 250)
    return () => window.clearInterval(iv)
  }, [voiceOn])

  const toggleVoice = useCallback(async () => {
    if (voiceOn) {
      // Leaving voice: tear everything down.
      for (const k of [...peers.current.keys()]) dropPeer(k)
      localStream.current?.getTracks().forEach(t => t.stop())
      localStream.current = null
      setVoiceOn(false)
      onVoiceStateChange(false)
      return
    }
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) { setError('This device has no microphone access.'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      localStream.current = stream
      setMuted(false)
      setVoiceOn(true)
      onVoiceStateChange(true)
    } catch {
      // Denied or dismissed — getUserMedia rejects on deny, not on dismiss.
      setError('Mic permission is needed to talk. You can still study on the timer without it.')
    }
  }, [voiceOn, dropPeer, onVoiceStateChange])

  const toggleMute = useCallback(() => {
    const s = localStream.current
    if (!s) return
    const nextMuted = !muted
    s.getAudioTracks().forEach(t => { t.enabled = !nextMuted })
    setMuted(nextMuted)
  }, [muted])

  // Full teardown on unmount / leaving the room.
  useEffect(() => () => {
    for (const pc of peers.current.values()) pc.close()
    peers.current.clear()
    audioEls.current.forEach(el => { el.srcObject = null; el.remove() })
    audioEls.current.clear()
    localStream.current?.getTracks().forEach(t => t.stop())
    audioCtx.current?.close().catch(() => {})
  }, [])

  const peerCount = peers.current.size
  return useMemo(() => ({
    voiceOn, muted, error, speaking, peerCount,
    toggleVoice, toggleMute,
  }), [voiceOn, muted, error, speaking, peerCount, toggleVoice, toggleMute])
}
