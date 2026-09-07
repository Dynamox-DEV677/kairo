/**
 * Room codes: a door, not a connection.
 *
 * Two students who already know each other need a way to land in the same
 * room ON PURPOSE. The obvious way -- look up your friend by username -- is
 * the one thing this app must never build, because a directory a friend can
 * search is a directory a stranger can search, and the users here are
 * children.
 *
 * So the link is made OUTSIDE the app. One student creates a room, reads the
 * code out or sends it however they already talk, and the other types it in.
 * Kyno never learns that those two know each other: there is no friend list,
 * no history of who shared a room, and no way to go from a person to a code
 * or from a code to a person.
 *
 * A code is short-lived on purpose. It dies when the room empties and again
 * after a few hours, so a code screenshotted in a group chat is not a
 * standing invitation into a child's study session next week.
 */

/**
 * No 0/O, no 1/I/L. A code gets read aloud across a room or squinted at in a
 * screenshot, and "was that a one or an ell" is how a student decides the
 * feature is broken.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export const CODE_LENGTH = 5

/** Three hours: long enough for an evening's study, short enough to be useless tomorrow. */
export const CODE_TTL_MS = 3 * 60 * 60 * 1000

/** A fresh code. Uses the crypto RNG when there is one -- Math.random is guessable. */
export function makeRoomCode(rng) {
  const pick = () => {
    if (rng) return Math.floor(rng() * ALPHABET.length)
    const c = typeof globalThis !== 'undefined' && globalThis.crypto
    if (c && c.getRandomValues) {
      const a = new Uint32Array(1)
      c.getRandomValues(a)
      return a[0] % ALPHABET.length
    }
    return Math.floor(Math.random() * ALPHABET.length)
  }
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[pick()]
  return out
}

/**
 * What a student typed, turned into what we look for.
 *
 * They will type lower case, put a space in the middle, and paste it with a
 * newline. None of that should be a failure. Characters the alphabet never
 * produces are LEFT IN rather than stripped, so isValidCodeShape can reject
 * them and the student gets told the code is wrong -- silently deleting them
 * would turn "OK2X9" into a four-character code and a confusing error.
 */
export function normalizeCode(input) {
  return String(input || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CODE_LENGTH)
}

/** Is this the right SHAPE? Says nothing about whether the room is live. */
export function isValidCodeShape(code) {
  const c = String(code || '')
  return c.length === CODE_LENGTH && [...c].every(ch => ALPHABET.includes(ch))
}

/** A room is dead once it has been open longer than the window. */
export function codeExpired(openedAt, now = Date.now()) {
  const t = Number(openedAt)
  if (!Number.isFinite(t) || t <= 0) return true
  return now - t > CODE_TTL_MS
}

/** The channel a code maps to. One-way: a channel name reveals no person. */
export function channelForCode(code) {
  return `kyno-priv-${String(code || '').toUpperCase()}`
}

/** How long this room has left, in whole minutes. */
export function minutesLeft(openedAt, now = Date.now()) {
  const left = CODE_TTL_MS - (now - Number(openedAt || 0))
  return left <= 0 ? 0 : Math.ceil(left / 60000)
}
