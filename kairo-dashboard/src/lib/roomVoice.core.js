/**
 * Study Room voice — the WebRTC mesh's DECIDABLE rules, pure and testable.
 *
 * Actual RTCPeerConnection wiring lives in the component (browser API), but the
 * two things that make a mesh correct-or-broken are pure functions and live
 * here: who calls whom (glare avoidance), and whether a signalling message is
 * mine to act on. Getting these wrong is what makes voice "sometimes connects".
 */

/**
 * In a mesh, if BOTH peers send an offer at once ("glare"), the connection
 * wedges. The fix is a deterministic rule both sides compute the same way:
 * the peer with the smaller key is the caller, the other waits for the offer.
 */
export function isPolite(myKey, peerKey) {
  // "polite" peer = the one who does NOT initiate; it answers.
  return String(myKey) > String(peerKey)
}
export function shouldInitiate(myKey, peerKey) {
  return String(myKey) < String(peerKey)
}

/** A signalling message is mine only if addressed to me and from someone else. */
export function isForMe(msg, myKey) {
  return !!msg && msg.to === myKey && msg.from && msg.from !== myKey
}

/**
 * Given the voice roster (keys of everyone who has voice ON) and my key,
 * the set of peers I should hold a connection to = everyone else on voice.
 * Returns { add, drop } against the peers I currently have.
 */
export function reconcilePeers(rosterKeys, myKey, currentPeerKeys) {
  const want = new Set((rosterKeys || []).filter(k => k && k !== myKey))
  const have = new Set(currentPeerKeys || [])
  const add = [...want].filter(k => !have.has(k))
  const drop = [...have].filter(k => !want.has(k))
  return { add, drop }
}

export const STUN = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

/** RMS of an analyser byte buffer, 0..1 — the "is this person talking" signal. */
export function rmsLevel(bytes) {
  if (!bytes || !bytes.length) return 0
  let sum = 0
  for (let i = 0; i < bytes.length; i++) {
    const v = (bytes[i] - 128) / 128
    sum += v * v
  }
  return Math.sqrt(sum / bytes.length)
}

/** Above this RMS, show the speaking ring. Tuned to ignore room hum. */
export const TALK_THRESHOLD = 0.06
