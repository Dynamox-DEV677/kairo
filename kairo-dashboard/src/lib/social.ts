/**
 * The student's own social identity on the client: username + the three
 * switches, cached so the old Study Room and the new spaces can read it
 * synchronously, refreshed from /api/social/me when signed in.
 *
 * Nothing here ever reads the real name. If no username is known yet the
 * fallback is the word "student" -- never a name from the profile.
 */
import { getJSON, setJSON } from './storage'
import { api, put, post } from './api'

export interface SocialProfile {
  username: string
  show_in_leagues: boolean
  allow_battles: boolean
  join_rooms: boolean
  username_changed_at: string | null
  offline?: boolean
  fetchedAt?: number
}

const KEY = 'kyno:social'
export const SOCIAL_EVENT = 'kyno:social-changed'

export function getSocialCached(): SocialProfile | null {
  try { return getJSON<SocialProfile>(KEY) } catch { return null }
}

/** Synchronous: the cached username, or "student" when none is known. Never a real name. */
export function getUsername(): string {
  return getSocialCached()?.username || 'student'
}

function remember(p: SocialProfile) {
  const next = { ...p, fetchedAt: Date.now() }
  try { setJSON(KEY, next) } catch { /* storage blocked */ }
  try { window.dispatchEvent(new CustomEvent(SOCIAL_EVENT, { detail: next })) } catch { /* ssr */ }
  return next
}

export async function refreshSocial(): Promise<SocialProfile | null> {
  try {
    const p = await api('/social/me')
    if (p && typeof p.username === 'string') return remember(p)
    return getSocialCached()
  } catch { return getSocialCached() }
}

export async function setUsername(username: string): Promise<SocialProfile> {
  return remember(await put('/social/username', { username }))
}

export async function setSocialSettings(patch: Partial<Pick<SocialProfile, 'show_in_leagues' | 'allow_battles' | 'join_rooms'>>): Promise<SocialProfile> {
  return remember(await put('/social/settings', patch))
}

/** Report + block another student by username. Silent; always resolves. */
export async function reportUser(username: string, context: 'league' | 'battle' | 'room'): Promise<void> {
  try { await post('/social/report', { username, context }) } catch { /* the block is also kept locally below */ }
  try {
    const local: string[] = getJSON<string[]>('kyno:social:blocked') || []
    if (!local.includes(username)) setJSON('kyno:social:blocked', [...local, username].slice(-500))
  } catch { /* storage blocked */ }
}

/** Usernames this student has reported, so a room can hide them even before the server answers. */
export function locallyBlocked(): Set<string> {
  try { return new Set(getJSON<string[]>('kyno:social:blocked') || []) } catch { return new Set() }
}

export function forgetSocial() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
