/**
 * Study rooms -- silent co-presence over Supabase Realtime presence.
 *
 * Exactly the shape that is safe: you can see that other people are working
 * and what SUBJECT they are on. Nothing else crosses the wire -- no messages,
 * no reactions, no names (the username only), no topic text (the topic is a
 * chapter from the student's own syllabus, and only its subject is shared).
 *
 * Rooms hold ROOM_MAX, are auto-created (room 1, then 2, …), have no names, no
 * codes, no invites, and nothing persists: when the last person leaves, the
 * room stops existing. Nothing to organise means nothing to police.
 */
import { supabase, supabaseReady } from './supabase'

export const ROOM_MAX = 12
const MAX_ROOMS = 12
const LOBBY = 'kyno-rooms-lobby'

export interface RoomMember { key: string; username: string; subject: string; joinedAt: number }
export interface RoomHandle { room: number; leave(): void; setSubject(subject: string): void }

type Payload = { username: string; subject: string; joinedAt: number }

export function roomsAvailable(): boolean {
  if (typeof window !== 'undefined' && (window as any).__kynoFakeRooms) return true
  return supabaseReady && (typeof navigator === 'undefined' || navigator.onLine !== false)
}

/**
 * Dev previews only: a pretend room so the screen can be checked without a
 * Supabase project and without putting a preview user into a real room. Never
 * reachable in the app -- the flag is set by the preview harness alone.
 */
function fakeRoom(me: { username: string; subject: string }, onMembers: (m: RoomMember[]) => void, onStatus: (c: boolean) => void): RoomHandle {
  const now = Date.now()
  let mine: RoomMember = { key: 'me', username: me.username, subject: me.subject, joinedAt: now }
  const others: RoomMember[] = [
    { key: 'a', username: 'lunarpebble08', subject: 'Maths', joinedAt: now - 17 * 60_000 },
    { key: 'b', username: 'steadyfalcon3', subject: 'Physics', joinedAt: now - 42 * 60_000 },
  ]
  const emit = () => onMembers([...others, mine].sort((a, b) => a.joinedAt - b.joinedAt))
  onStatus(true); emit()
  const t = setTimeout(() => { others.push({ key: 'c', username: 'coralrobin51', subject: 'Chemistry', joinedAt: Date.now() }); emit() }, 2500)
  return { room: 1, leave() { clearTimeout(t); onStatus(false) }, setSubject(s) { mine = { ...mine, subject: s }; emit() } }
}

function members(ch: ReturnType<typeof supabase.channel>): RoomMember[] {
  const state = ch.presenceState() as Record<string, Payload[]>
  return Object.entries(state).map(([key, arr]) => ({ key, username: arr[0]?.username || 'student', subject: arr[0]?.subject || '', joinedAt: arr[0]?.joinedAt || Date.now() }))
    .sort((a, b) => a.joinedAt - b.joinedAt)
}

function subscribe(ch: ReturnType<typeof supabase.channel>): Promise<boolean> {
  return new Promise(resolve => {
    let settled = false
    const t = setTimeout(() => { if (!settled) { settled = true; resolve(false) } }, 8000)
    ch.subscribe(status => {
      if (settled) return
      if (status === 'SUBSCRIBED') { settled = true; clearTimeout(t); resolve(true) }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { settled = true; clearTimeout(t); resolve(false) }
    })
  })
}

/** Join the first room with space. Resolves with a handle, or throws when the network is not there. */
export async function joinRoom(me: { username: string; subject: string }, onMembers: (m: RoomMember[]) => void, onStatus: (connected: boolean) => void): Promise<RoomHandle> {
  if (typeof window !== 'undefined' && (window as any).__kynoFakeRooms) return fakeRoom(me, onMembers, onStatus)
  if (!roomsAvailable()) throw new Error('needs a connection')
  const key = `m-${Math.random().toString(36).slice(2, 10)}`   // random: no identity in the key
  let payload: Payload = { username: me.username, subject: me.subject, joinedAt: Date.now() }
  for (let n = 1; n <= MAX_ROOMS; n++) {
    const ch = supabase.channel(`kyno-room2-${n}`, { config: { presence: { key } } })
    ch.on('presence', { event: 'sync' }, () => onMembers(members(ch)))
    const ok = await subscribe(ch)
    if (!ok) { supabase.removeChannel(ch); throw new Error('needs a connection') }
    // presence state arrives with the first sync; give it a beat before counting
    await new Promise(r => setTimeout(r, 250))
    if (Object.keys(ch.presenceState()).length >= ROOM_MAX) { supabase.removeChannel(ch); continue }
    await ch.track(payload)
    onStatus(true)
    const lobby = supabase.channel(LOBBY, { config: { presence: { key } } })
    subscribe(lobby).then(ok2 => { if (ok2) lobby.track({ room: n }) })
    return {
      room: n,
      leave() { onStatus(false); supabase.removeChannel(ch); supabase.removeChannel(lobby) },
      setSubject(subject: string) { payload = { ...payload, subject }; ch.track(payload) },
    }
  }
  throw new Error('every room is full right now')
}

/** How many people are in rooms right now. Returns the stop function. */
export function watchLobby(onCount: (n: number) => void): () => void {
  if (typeof window !== 'undefined' && (window as any).__kynoFakeRooms) { onCount(4); return () => {} }
  if (!roomsAvailable()) { onCount(0); return () => {} }
  const ch = supabase.channel(LOBBY)
  ch.on('presence', { event: 'sync' }, () => onCount(Object.keys(ch.presenceState()).length))
  ch.subscribe()
  return () => { supabase.removeChannel(ch) }
}
