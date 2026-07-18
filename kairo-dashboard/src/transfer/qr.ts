// QR PAYLOAD codec. The QR only ever carries SessionInfo — connection metadata,
// never user data and (for the WebRTC path) never the raw AES key.
import { b64url, b64urlToBytes, strToBytes, bytesToStr } from './encryption'
import { QR_TTL_MS, type SessionInfo, type TransferKind } from './types'

const SCHEME = 'kyno1:'   // lets a scanner instantly recognise a Kyno pairing QR

export function newSessionId(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(9)))   // 12-char id
}

// Short, human, unambiguous pairing code (no 0/O/1/I) — the type-it fallback
// when a camera scan won't cooperate.
export function newPairingCode(len = 6): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const rnd = crypto.getRandomValues(new Uint8Array(len))
  let s = ''
  for (let i = 0; i < len; i++) s += alphabet[rnd[i] % alphabet.length]
  return s
}

export function createSession(kind: TransferKind, pubKey?: string, signal?: string): SessionInfo {
  return {
    v: 1,
    kind,
    sessionId: newSessionId(),
    code: newPairingCode(),
    pubKey,
    signal,
    expiresAt: Date.now() + QR_TTL_MS,
  }
}

export function encodeSession(info: SessionInfo): string {
  return SCHEME + b64url(strToBytes(JSON.stringify(info)))
}

export function decodeSession(text: string): SessionInfo | null {
  try {
    const raw = text.trim()
    if (!raw.startsWith(SCHEME)) return null
    const info = JSON.parse(bytesToStr(b64urlToBytes(raw.slice(SCHEME.length)))) as SessionInfo
    if (info?.v !== 1 || !info.sessionId || !info.code) return null
    return info
  } catch {
    return null
  }
}

export function isExpired(info: SessionInfo, now = Date.now()): boolean {
  return now >= info.expiresAt
}

export function secondsLeft(info: SessionInfo, now = Date.now()): number {
  return Math.max(0, Math.ceil((info.expiresAt - now) / 1000))
}
