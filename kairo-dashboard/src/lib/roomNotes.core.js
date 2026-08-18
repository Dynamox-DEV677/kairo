/**
 * Study Room shared notes — the collaborative scratchpad, pure and testable.
 *
 * A running list of short notes anyone in the room can add; everyone sees it
 * live over the same Realtime channel as the timer. Ephemeral by design (no
 * tables) — but any note can be "linked" into the student's OWN AI Notebook,
 * which IS persisted. That link is the point: the group thinks out loud, and
 * each person keeps the bits that mattered to them.
 *
 * Merge is union-by-id, so a joiner's "here's the pad so far" reply and live
 * adds converge without a coordinator, exactly like the timer's LWW.
 */

export const MAX_NOTES = 50
export const MAX_LEN = 280

let counter = 0
/** id must be unique across clients AND monotonic-ish for stable ordering.
 *  by-key + a local counter + the caller's ts does that without a clock here. */
export function makeNoteId(byKey, ts) {
  counter = (counter + 1) % 100000
  return `${byKey}:${ts}:${counter}`
}

export function makeNote({ byKey, byName, text, ts }) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN)
  if (!clean) return null
  return { id: makeNoteId(byKey, ts), byKey, byName: String(byName || 'Someone').slice(0, 24), text: clean, ts }
}

/**
 * Fold an incoming note (or a whole set, on sync) into the current list.
 * Union by id, newest last, capped. Returns a NEW array.
 */
export function mergeNotes(current, incoming) {
  const cur = Array.isArray(current) ? current : []
  const add = Array.isArray(incoming) ? incoming : incoming ? [incoming] : []
  const byId = new Map()
  for (const n of cur) if (n && n.id) byId.set(n.id, n)
  for (const n of add) {
    if (!n || !n.id || typeof n.ts !== 'number') continue
    if (!byId.has(n.id)) byId.set(n.id, n)
  }
  return [...byId.values()]
    .sort((a, b) => a.ts - b.ts)
    .slice(-MAX_NOTES)
}

/** Remove one note (its author can retract it). Returns a NEW array. */
export function removeNote(current, id) {
  return (Array.isArray(current) ? current : []).filter(n => n.id !== id)
}

/** The payload written to the personal Notebook when a shared note is linked. */
export function noteToNotebook(note, roomCode) {
  const title = note.text.length > 60 ? note.text.slice(0, 57) + '…' : note.text
  return {
    kind: 'note',
    title,
    content: note.text,
    subject: null,
    tags: ['study-room'],
    source: `Study Room ${roomCode || ''}`.trim(),
  }
}
