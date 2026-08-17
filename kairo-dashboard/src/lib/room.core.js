/**
 * C3 — Study Rooms: the shared-timer state machine, pure and testable.
 *
 * Transport is Supabase Realtime channels (presence + broadcast) — ephemeral,
 * no tables, no migrations. Every client holds the same timer state and any
 * member may change it; convergence is last-writer-wins on a sequence number,
 * so two phones pressing buttons at once settle on one state instead of
 * flickering. This file owns the rules; the page owns the wires.
 */

/** No 0/O/1/I/5/S — codes get read aloud across a room. */
const ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789'
export const CODE_LEN = 6

export function newRoomCode(rand = Math.random) {
  let out = ''
  for (let i = 0; i < CODE_LEN; i++) out += ALPHABET[Math.floor(rand() * ALPHABET.length)]
  return out
}

/**
 * Uppercase and strip spaces/dashes — formatting only. Deliberately NO
 * confusable auto-correction (0->O etc.): silently turning a mistyped code
 * into a different VALID code joins the wrong room. Validate strictly and let
 * the student re-read the code instead.
 */
export function cleanCode(input) {
  return String(input || '').toUpperCase().replace(/[\s-]/g, '')
}

export function isValidCode(input) {
  const c = cleanCode(input)
  return c.length === CODE_LEN && [...c].every(ch => ALPHABET.includes(ch))
}

/* ── Timer state ──────────────────────────────────────────────────────────── */

export const FOCUS_MIN = 25
export const BREAK_MIN = 5

export function idleState() {
  return { seq: 0, phase: 'idle', endsAt: null, focusMin: FOCUS_MIN, breakMin: BREAK_MIN, by: null }
}

export function startFocus(cur, { now, by }) {
  return { ...cur, seq: cur.seq + 1, phase: 'focus', endsAt: now + cur.focusMin * 60_000, by: by || null }
}

export function startBreak(cur, { now, by }) {
  return { ...cur, seq: cur.seq + 1, phase: 'break', endsAt: now + cur.breakMin * 60_000, by: by || null }
}

export function stopTimer(cur, { by }) {
  return { ...cur, seq: cur.seq + 1, phase: 'idle', endsAt: null, by: by || null }
}

/** focus -> break -> focus, each with a fresh clock. */
export function nextPhase(cur, { now, by }) {
  return cur.phase === 'focus' ? startBreak(cur, { now, by }) : startFocus(cur, { now, by })
}

export function remainingMs(state, now) {
  if (!state || state.phase === 'idle' || !Number.isFinite(state.endsAt)) return 0
  return Math.max(0, state.endsAt - now)
}

export function phaseDone(state, now) {
  return !!state && state.phase !== 'idle' && Number.isFinite(state.endsAt) && now >= state.endsAt
}

/**
 * Converge two copies of the room's timer. Higher seq wins; on a seq tie
 * (two members acted in the same beat) the later end time wins, and on a full
 * tie the incumbent stays — every client applies the same rules, so every
 * client lands on the same state without a coordinator.
 */
export function applyTimerEvent(current, incoming) {
  if (!incoming || !Number.isFinite(incoming.seq)) return current
  const cur = current || idleState()
  if (incoming.seq > cur.seq) return incoming
  if (incoming.seq < cur.seq) return cur
  const a = Number.isFinite(cur.endsAt) ? cur.endsAt : -1
  const b = Number.isFinite(incoming.endsAt) ? incoming.endsAt : -1
  return b > a ? incoming : cur
}

/** "24:59" — what the big clock shows. */
export function clockLabel(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
