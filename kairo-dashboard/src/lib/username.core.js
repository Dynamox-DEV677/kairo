/**
 * Usernames -- the ONLY identity another student ever sees.
 *
 * Kyno shows one minor's identity to another minor in leagues, battles and
 * study rooms. Real names, emails, schools and class sections never cross
 * that line; a username does, and nothing else. These rules are shared by the
 * client (instant feedback while typing) and the server (the one that decides).
 *
 *   - lowercase letters, digits and single underscores; 3-20 characters;
 *     starts with a letter
 *   - no long digit runs (a phone number is not a username)
 *   - reserved words and a short list of slurs are refused outright; the
 *     report flow, not this list, is the real safety net
 *   - `student_xxxxxx` is the placeholder shape the server hands out when a
 *     handle cannot be stored yet, so nobody can choose it
 *
 * Generated handles are adjective + noun + two digits ("quietstorm42"). The
 * same two word lists live in server/db/2026-09-04_social.sql for the
 * backfill; a test keeps the copies identical.
 */

export const USERNAME_RE = /^[a-z][a-z0-9_]{2,19}$/

export const ADJECTIVES = [
  'quiet', 'swift', 'bright', 'calm', 'bold', 'clever', 'steady', 'lucky', 'brave', 'gentle',
  'keen', 'merry', 'nimble', 'plucky', 'sunny', 'witty', 'zesty', 'cosmic', 'lunar', 'solar',
  'amber', 'coral', 'ivory', 'jade', 'onyx', 'pearl', 'ruby', 'silver', 'violet', 'golden',
]

export const NOUNS = [
  'storm', 'river', 'falcon', 'comet', 'maple', 'tiger', 'otter', 'panda', 'koala', 'robin',
  'lotus', 'cedar', 'harbor', 'meadow', 'summit', 'canyon', 'glacier', 'breeze', 'ember', 'pebble',
  'willow', 'sparrow', 'dolphin', 'lantern', 'compass', 'anchor', 'rocket', 'planet', 'nebula', 'quartz',
]

const RESERVED = new Set([
  'kyno', 'kairo', 'admin', 'administrator', 'teacher', 'parent', 'support', 'system', 'moderator',
  'mod', 'staff', 'official', 'root', 'help', 'null', 'undefined', 'anonymous', 'student', 'you', 'me',
])

// Deliberately short. A denylist never catches everything; the long-press
// report on every username is what actually protects people.
const BLOCKED = [
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'porn', 'sex', 'nude', 'rape', 'nazi', 'hitler',
  'kill', 'suicide', 'whore', 'slut', 'nigg', 'fag', 'chut', 'madarch', 'behench', 'lund', 'gaand', 'randi',
]

export function normaliseUsername(raw) {
  return String(raw || '').trim().toLowerCase()
}

/** @returns {{ ok: true, username: string } | { ok: false, reason: string }} */
export function validateUsername(raw) {
  const u = normaliseUsername(raw)
  if (u.length < 3) return { ok: false, reason: 'At least 3 characters.' }
  if (u.length > 20) return { ok: false, reason: 'At most 20 characters.' }
  if (!/^[a-z]/.test(u)) return { ok: false, reason: 'Start with a letter.' }
  if (!USERNAME_RE.test(u)) return { ok: false, reason: 'Lowercase letters, digits and _ only. No spaces.' }
  if (u.includes('__')) return { ok: false, reason: 'One underscore at a time.' }
  if (u.startsWith('student_')) return { ok: false, reason: 'That prefix is kept for placeholder names.' }
  if (RESERVED.has(u)) return { ok: false, reason: 'That one is taken.' }
  if (/\d{6,}/.test(u)) return { ok: false, reason: 'No long numbers — it could be a phone number.' }
  const flat = u.replace(/[_0-9]/g, '')
  for (const w of BLOCKED) if (flat.includes(w)) return { ok: false, reason: 'Pick something else.' }
  return { ok: true, username: u }
}

/** adjective + noun + two digits, always valid under the rules above. */
export function generateUsername(rand = Math.random) {
  const pick = list => list[Math.floor(rand() * list.length) % list.length]
  const digits = String(Math.floor(rand() * 100) % 100).padStart(2, '0')
  return `${pick(ADJECTIVES)}${pick(NOUNS)}${digits}`
}

/**
 * The placeholder the server shows when it cannot read or store a handle
 * (migration not run yet, table missing). Deterministic per account, never a
 * real name, and refused by validateUsername so nobody can claim it.
 */
export function fallbackHandle(userId, salt = 0) {
  let h = (2166136261 ^ (salt >>> 0)) >>> 0
  const s = String(userId || '')
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
  return 'student_' + h.toString(16).padStart(8, '0').slice(0, 6)
}

/* ── letter tiles: the avatar is generated from the username, never uploaded ── */

export const TILE_HUES = ['#2A1F52', '#1F2A52', '#1F4A3A', '#4A2E1A', '#4A1F3A', '#2E2E42']

export function tileHue(username) {
  let h = 0
  for (const c of normaliseUsername(username)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TILE_HUES[h % TILE_HUES.length]
}

export function tileLetter(username) {
  const u = normaliseUsername(username)
  return (u[0] || '?').toUpperCase()
}
