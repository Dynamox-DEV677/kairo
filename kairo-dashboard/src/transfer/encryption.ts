// AES-256-GCM encryption + gzip compression for the device-transfer snapshot.
// Everything runs in-browser via WebCrypto. Keys are one-time and never persisted.
import { makeLog } from './log'

const log = makeLog('crypto')

// ── byte / base64 / text helpers ────────────────────────────────────────────
const enc = new TextEncoder()
const dec = new TextDecoder()

export function strToBytes(s: string): Uint8Array { return enc.encode(s) }
export function bytesToStr(b: Uint8Array): string { return dec.decode(b) }

// Chunked base64 so we never blow the call stack on multi-MB snapshots.
export function bytesToB64(bytes: Uint8Array): string {
  let bin = ''
  const CH = 0x8000
  for (let i = 0; i < bytes.length; i += CH) {
    const sub = bytes.subarray(i, i + CH)
    bin += String.fromCharCode.apply(null, sub as unknown as number[])
  }
  return btoa(bin)
}

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// URL-safe base64 for compact QR payloads.
export function b64url(bytes: Uint8Array): string {
  return bytesToB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return b64ToBytes(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
}

// ── one-time session key ────────────────────────────────────────────────────
export async function generateSessionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function exportKeyB64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return bytesToB64(new Uint8Array(raw))
}

export async function importKeyB64(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', b64ToBytes(b64), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
}

// ── gzip (optional; degrades gracefully where the API is missing) ────────────
function hasCompression(): boolean {
  return typeof (globalThis as any).CompressionStream !== 'undefined'
    && typeof (globalThis as any).DecompressionStream !== 'undefined'
}

export async function gzip(bytes: Uint8Array): Promise<{ data: Uint8Array; compressed: boolean }> {
  if (!hasCompression()) { log.warn('CompressionStream unavailable — storing uncompressed'); return { data: bytes, compressed: false } }
  try {
    const CS = (globalThis as any).CompressionStream
    const stream = new Blob([bytes]).stream().pipeThrough(new CS('gzip'))
    const buf = await new Response(stream).arrayBuffer()
    return { data: new Uint8Array(buf), compressed: true }
  } catch (e) {
    log.warn('gzip failed — storing uncompressed', e)
    return { data: bytes, compressed: false }
  }
}

export async function gunzip(bytes: Uint8Array, compressed: boolean): Promise<Uint8Array> {
  if (!compressed) return bytes
  const DS = (globalThis as any).DecompressionStream
  if (!DS) throw new Error('DecompressionStream unavailable — cannot restore a compressed snapshot on this device')
  const stream = new Blob([bytes]).stream().pipeThrough(new DS('gzip'))
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

// ── AES-256-GCM ──────────────────────────────────────────────────────────────
export interface Encrypted { iv: Uint8Array; cipher: Uint8Array }

export async function encryptBytes(plain: Uint8Array, key: CryptoKey): Promise<Encrypted> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain)
  return { iv, cipher: new Uint8Array(buf) }
}

export async function decryptBytes(iv: Uint8Array, cipher: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  return new Uint8Array(buf)
}

// ── ECDH (ephemeral handshake key exchange for the WebRTC path) ──────────────
export async function generateHandshakeKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])
}

export async function exportPublicKeyB64(pair: CryptoKeyPair): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', pair.publicKey)
  return bytesToB64(new Uint8Array(raw))
}

export async function deriveSharedKey(myPrivate: CryptoKey, theirPublicB64: string): Promise<CryptoKey> {
  const theirPublic = await crypto.subtle.importKey(
    'raw', b64ToBytes(theirPublicB64), { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  )
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublic }, myPrivate,
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'],
  )
}
