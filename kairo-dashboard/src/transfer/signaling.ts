// SIGNALING for the live WebRTC transfer path.
//
// Vercel Hobby can't hold a WebSocket (our 10s function ceiling), so signaling
// can't live on our own server. We relay through Supabase Realtime — already in
// the stack, free tier, hosted by Supabase (not Vercel), built for exactly this.
//
// This channel ONLY ever carries connection metadata: WebRTC SDP offers/answers,
// ICE candidates, and the two devices' EPHEMERAL ECDH public keys. It never sees
// user data and never sees the AES key (each device derives that itself via ECDH,
// so the key is never transmitted anywhere).
import { supabase, supabaseReady } from '../lib/supabase'
import { makeLog } from './log'

const log = makeLog('signal')

export type SignalRole = 'sender' | 'receiver'

export type SignalKind = 'hello' | 'pubkey' | 'offer' | 'answer' | 'ice' | 'bye'

export interface SignalMessage {
  from: SignalRole
  kind: SignalKind
  data?: any
}

export interface SignalChannel {
  send(msg: Omit<SignalMessage, 'from'>): Promise<void>
  close(): void
}

// Live transfer needs Supabase configured; without it, callers fall back to file.
export function signalingAvailable(): boolean {
  return supabaseReady
}

const SUBSCRIBE_TIMEOUT_MS = 8000

// Join the one-time signaling channel for a session. `onMessage` fires for every
// message from the OTHER peer (our own broadcasts are filtered out).
export async function openSignaling(
  sessionId: string,
  role: SignalRole,
  onMessage: (msg: SignalMessage) => void,
): Promise<SignalChannel> {
  if (!supabaseReady) {
    throw new Error('Live transfer needs a network connection to pair the devices. Use the file option instead.')
  }

  const topic = `transfer:${sessionId}`
  const channel = supabase.channel(topic, { config: { broadcast: { self: false, ack: true } } })

  channel.on('broadcast', { event: 'signal' }, (payload: any) => {
    const msg = payload?.payload as SignalMessage | undefined
    if (!msg || !msg.kind) return
    if (msg.from === role) return // ignore our own echoes (belt & suspenders)
    onMessage(msg)
  })

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Could not reach the pairing channel — check your connection and try again.')),
      SUBSCRIBE_TIMEOUT_MS,
    )
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer)
        resolve()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        clearTimeout(timer)
        reject(new Error(`Pairing channel error (${status}).`))
      }
    })
  })
  log.info(`signaling open on ${topic} as ${role}`)

  return {
    async send(msg) {
      await channel.send({ type: 'broadcast', event: 'signal', payload: { ...msg, from: role } })
    },
    close() {
      try {
        supabase.removeChannel(channel)
      } catch (e) {
        log.warn('removeChannel failed', e)
      }
    },
  }
}
