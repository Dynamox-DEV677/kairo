/**
 * A message handed to the chat from another screen, held until it is taken.
 *
 * It used to be a CustomEvent fired 60ms after setActive. That is a race: the
 * chat is a heavy component and on a cold mount it had not registered its
 * listener yet, so "I'm stuck here" arrived at nobody. The student landed on
 * the generic welcome with the step they were stuck on nowhere in sight, and
 * it LOOKED like the anchor was never passed -- it was, into an empty room.
 *
 * A queue cannot be early or late. The sender leaves it; the chat takes it
 * when it is ready, whether that is before or after the event fires.
 */

export interface ChatAnchor {
  step: number
  total: number
  question: string
  title: string
  working: string
}

export interface ChatHandoff {
  /** The message to send. */
  seed: string
  /** The step it came from, pinned above the thread. */
  anchor: ChatAnchor | null
}

let pending: ChatHandoff | null = null

export const HANDOFF_EVENT = 'kyno:chat-handoff'

/** Leave a handoff for the chat, and nudge it in case it is already listening. */
export function setPendingHandoff(h: ChatHandoff): void {
  pending = h
  try { window.dispatchEvent(new CustomEvent(HANDOFF_EVENT)) } catch { /* ssr */ }
}

/**
 * Take the handoff, once. Returns null when there is nothing waiting.
 *
 * Taking CLEARS it, so a remount does not replay a message the student already
 * sent -- which would be worse than missing it.
 */
export function takePendingHandoff(): ChatHandoff | null {
  const h = pending
  pending = null
  return h
}
