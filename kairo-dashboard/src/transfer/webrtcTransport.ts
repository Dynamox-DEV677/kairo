// LIVE PEER-TO-PEER TRANSPORT (WebRTC).
//
// The encrypted snapshot streams DIRECTLY between the two devices over a WebRTC
// data channel. Supabase Realtime (see signaling.ts) is used only to exchange
// SDP/ICE and the two ephemeral ECDH public keys; once the data channel is open,
// nothing else touches a server.
//
// KEY EXCHANGE: the sender's ECDH public key travels in the QR. The receiver
// generates its own pair, derives the shared AES-256 key, and sends its public
// key back over signaling so the sender derives the identical key. The AES key
// itself is never transmitted — not in the QR, not over signaling, nowhere.
//
// $0 constraint: STUN only (Google public STUN). No TURN relay (that costs
// money). Same-Wi-Fi / hotspot / most home networks connect fine on STUN; if a
// symmetric-NAT network blocks direct P2P, the caller falls back to the
// encrypted-file path (which always works).
import { makeLog } from './log'
import { openSignaling, signalingAvailable, type SignalChannel } from './signaling'
import { generateHandshakeKeyPair, exportPublicKeyB64, deriveSharedKey } from './encryption'
import type { EncryptedBundle, TransferChunk } from './types'

const log = makeLog('webrtc')

export { signalingAvailable }

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

const CONNECT_TIMEOUT_MS = 25_000
// Pause sending when the data channel's outbound buffer climbs past this, so we
// never balloon memory on a slow link; resume when it drains.
const BUFFER_HIGH = 4 * 1024 * 1024
const BUFFER_LOW = 1 * 1024 * 1024

export interface WebRTCSession {
  pc: RTCPeerConnection
  dc: RTCDataChannel
  sharedKey: CryptoKey
  signal: SignalChannel
  close(): void
}

export function webrtcSupported(): boolean {
  return typeof RTCPeerConnection !== 'undefined'
}

// ── connection helpers ───────────────────────────────────────────────────────
function waitForOpen(dc: RTCDataChannel): Promise<void> {
  return new Promise((resolve, reject) => {
    if (dc.readyState === 'open') return resolve()
    dc.onopen = () => resolve()
    dc.onerror = () => reject(new Error('Data channel error while connecting.'))
  })
}

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(msg)), ms)
  })
  return Promise.race([p.finally(() => clearTimeout(timer)), timeout])
}

function cleanup(pc: RTCPeerConnection, dc: RTCDataChannel | null, signal: SignalChannel): void {
  try { if (dc) dc.close() } catch { /* noop */ }
  try { pc.close() } catch { /* noop */ }
  try { signal.close() } catch { /* noop */ }
}

// ── SENDER (the device showing the QR = WebRTC offerer) ──────────────────────
export async function connectSender(opts: {
  sessionId: string
  myKeyPair: CryptoKeyPair // ECDH pair whose public key is already in the QR
  onState?: (s: RTCPeerConnectionState) => void
}): Promise<WebRTCSession> {
  const pc = new RTCPeerConnection(ICE_SERVERS)
  const dc = pc.createDataChannel('kyno', { ordered: true })
  const pendingIce: RTCIceCandidateInit[] = []
  let sharedKey: CryptoKey | null = null
  let offerSent = false
  let signal: SignalChannel

  pc.onicecandidate = (e) => {
    if (e.candidate) void signal?.send({ kind: 'ice', data: e.candidate.toJSON() })
  }
  pc.onconnectionstatechange = () => opts.onState?.(pc.connectionState)

  signal = await openSignaling(opts.sessionId, 'sender', async (msg) => {
    try {
      if (msg.kind === 'pubkey' && !offerSent) {
        offerSent = true
        sharedKey = await deriveSharedKey(opts.myKeyPair.privateKey, msg.data as string)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await signal.send({ kind: 'offer', data: offer })
      } else if (msg.kind === 'answer') {
        await pc.setRemoteDescription(msg.data as RTCSessionDescriptionInit)
        for (const c of pendingIce.splice(0)) await pc.addIceCandidate(c)
      } else if (msg.kind === 'ice') {
        if (pc.remoteDescription) await pc.addIceCandidate(msg.data as RTCIceCandidateInit)
        else pendingIce.push(msg.data as RTCIceCandidateInit)
      }
    } catch (e) {
      log.warn('sender signal handler error', e)
    }
  })

  // Announce presence so a receiver that subscribed first replies with its pubkey.
  await signal.send({ kind: 'hello' })

  try {
    await withTimeout(waitForOpen(dc), CONNECT_TIMEOUT_MS, 'Could not open a direct connection to the other device.')
  } catch (e) {
    cleanup(pc, dc, signal)
    throw e
  }
  if (!sharedKey) {
    cleanup(pc, dc, signal)
    throw new Error('Secure key exchange did not complete.')
  }
  log.info('sender connected — data channel open')
  return { pc, dc, sharedKey, signal, close: () => cleanup(pc, dc, signal) }
}

// ── RECEIVER (the device scanning the QR = WebRTC answerer) ───────────────────
export async function connectReceiver(opts: {
  sessionId: string
  senderPubKeyB64: string
  onState?: (s: RTCPeerConnectionState) => void
}): Promise<WebRTCSession> {
  const pc = new RTCPeerConnection(ICE_SERVERS)
  const pendingIce: RTCIceCandidateInit[] = []

  const myKeyPair = await generateHandshakeKeyPair()
  const myPubB64 = await exportPublicKeyB64(myKeyPair)
  const sharedKey = await deriveSharedKey(myKeyPair.privateKey, opts.senderPubKeyB64)

  let resolveDc: (dc: RTCDataChannel) => void
  const dcReady = new Promise<RTCDataChannel>((r) => { resolveDc = r })
  let signal: SignalChannel

  pc.ondatachannel = (e) => resolveDc(e.channel)
  pc.onicecandidate = (e) => {
    if (e.candidate) void signal?.send({ kind: 'ice', data: e.candidate.toJSON() })
  }
  pc.onconnectionstatechange = () => opts.onState?.(pc.connectionState)

  signal = await openSignaling(opts.sessionId, 'receiver', async (msg) => {
    try {
      if (msg.kind === 'hello') {
        await signal.send({ kind: 'pubkey', data: myPubB64 })
      } else if (msg.kind === 'offer') {
        await pc.setRemoteDescription(msg.data as RTCSessionDescriptionInit)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await signal.send({ kind: 'answer', data: answer })
        for (const c of pendingIce.splice(0)) await pc.addIceCandidate(c)
      } else if (msg.kind === 'ice') {
        if (pc.remoteDescription) await pc.addIceCandidate(msg.data as RTCIceCandidateInit)
        else pendingIce.push(msg.data as RTCIceCandidateInit)
      }
    } catch (e) {
      log.warn('receiver signal handler error', e)
    }
  })

  // Announce + offer our pubkey up front (covers the sender-subscribed-first case).
  await signal.send({ kind: 'hello' })
  await signal.send({ kind: 'pubkey', data: myPubB64 })

  let dc: RTCDataChannel
  try {
    dc = await withTimeout(dcReady, CONNECT_TIMEOUT_MS, 'Could not open a direct connection to the other device.')
    await withTimeout(waitForOpen(dc), CONNECT_TIMEOUT_MS, 'The direct connection stalled before it opened.')
  } catch (e) {
    cleanup(pc, null, signal)
    throw e
  }
  log.info('receiver connected — data channel open')
  return { pc, dc, sharedKey, signal, close: () => cleanup(pc, dc, signal) }
}

// ── wire protocol over the open data channel ─────────────────────────────────
// { t:'meta', bundle }   sender → receiver : the EncryptedBundle (metadata only)
// { t:'chunk', chunk }   sender → receiver : one 64 KB TransferChunk
// { t:'done' }           sender → receiver : all chunks sent
// { t:'complete' }       receiver → sender : reassembled + verified OK
type WireMsg =
  | { t: 'meta'; bundle: EncryptedBundle }
  | { t: 'chunk'; chunk: TransferChunk }
  | { t: 'done' }
  | { t: 'complete' }

function drained(dc: RTCDataChannel): Promise<void> {
  if (dc.bufferedAmount <= BUFFER_HIGH) return Promise.resolve()
  dc.bufferedAmountLowThreshold = BUFFER_LOW
  return new Promise((resolve) => {
    const handler = () => { dc.removeEventListener('bufferedamountlow', handler); resolve() }
    dc.addEventListener('bufferedamountlow', handler)
  })
}

// SENDER: stream the encrypted bundle + chunks. The data channel is ordered +
// reliable (SCTP), so delivery is guaranteed — we only manage backpressure and
// wait for the receiver's final 'complete'.
export async function sendChunks(
  session: WebRTCSession,
  bundle: EncryptedBundle,
  chunks: TransferChunk[],
  onProgress?: (sent: number, total: number) => void,
): Promise<void> {
  const { dc } = session
  if (dc.readyState !== 'open') throw new Error('Connection dropped before the transfer started.')

  const completed = new Promise<void>((resolve) => {
    const prev = dc.onmessage
    dc.onmessage = (ev) => {
      try {
        if ((JSON.parse(ev.data as string) as WireMsg)?.t === 'complete') resolve()
      } catch { /* ignore */ }
      if (prev) prev.call(dc, ev)
    }
  })

  dc.send(JSON.stringify({ t: 'meta', bundle } satisfies WireMsg))
  for (let i = 0; i < chunks.length; i++) {
    if (dc.readyState !== 'open') throw new Error('Connection dropped mid-transfer.')
    await drained(dc)
    dc.send(JSON.stringify({ t: 'chunk', chunk: chunks[i] } satisfies WireMsg))
    onProgress?.(i + 1, chunks.length)
  }
  dc.send(JSON.stringify({ t: 'done' } satisfies WireMsg))
  log.info(`sent ${chunks.length} chunks — awaiting receiver confirmation`)

  // Give the receiver a moment to confirm; don't hang forever if it's missed.
  await withTimeout(completed, 8000, '').catch(() => log.warn('no completion ack — assuming delivered'))
}

// RECEIVER: collect the bundle + all chunks, then hand them to the importer
// (which re-verifies every checksum and decrypts). Returns raw pieces so the
// caller reuses importEncrypted() — the exact same core the file path uses.
export function receiveChunks(
  session: WebRTCSession,
  onProgress?: (received: number, total: number) => void,
): Promise<{ bundle: EncryptedBundle; chunks: TransferChunk[] }> {
  return new Promise((resolve, reject) => {
    const { dc } = session
    let bundle: EncryptedBundle | null = null
    const chunks: TransferChunk[] = []
    const seen = new Set<number>()

    dc.onmessage = (ev) => {
      let msg: WireMsg
      try { msg = JSON.parse(ev.data as string) as WireMsg } catch { return }

      if (msg.t === 'meta') {
        bundle = msg.bundle
        log.info(`incoming: ${bundle.chunkCount} chunk(s), ${bundle.totalBytes}B`)
      } else if (msg.t === 'chunk') {
        if (!seen.has(msg.chunk.index)) { seen.add(msg.chunk.index); chunks.push(msg.chunk) }
        onProgress?.(chunks.length, bundle?.chunkCount ?? msg.chunk.total)
      } else if (msg.t === 'done') {
        if (!bundle) return reject(new Error('Transfer ended before metadata arrived.'))
        if (chunks.length !== bundle.chunkCount) {
          return reject(new Error(`Transfer incomplete — got ${chunks.length} of ${bundle.chunkCount} chunks.`))
        }
        try { dc.send(JSON.stringify({ t: 'complete' } satisfies WireMsg)) } catch { /* noop */ }
        resolve({ bundle, chunks })
      }
    }
    dc.onclose = () => reject(new Error('Connection closed before the transfer finished.'))
    dc.onerror = () => reject(new Error('The direct connection errored during transfer.'))
  })
}
