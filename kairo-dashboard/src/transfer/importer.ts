// Reassembles, verifies, decrypts, decompresses and restores a snapshot onto
// the new device. Integrity is checked at every step; nothing is written until
// the whole ciphertext checksum matches and decryption succeeds.
import * as storage from '../lib/storage'
import { makeLog } from './log'
import { b64ToBytes, decryptBytes, gunzip, bytesToStr } from './encryption'
import { sha256Hex } from './integrity'
import type { EncryptedBundle, TransferChunk, SnapshotPayload, SnapshotStats } from './types'

const log = makeLog('import')

// Never overwrite the receiving device's own auth session.
const PROTECT = new Set(['kairo_token'])

export async function verifyAndReassemble(bundle: EncryptedBundle, chunks: TransferChunk[]): Promise<Uint8Array> {
  if (chunks.length !== bundle.chunkCount) {
    throw new Error(`chunk count mismatch: got ${chunks.length}, expected ${bundle.chunkCount}`)
  }
  const ordered = [...chunks].sort((a, b) => a.index - b.index)
  const parts: Uint8Array[] = []
  for (const c of ordered) {
    const bytes = b64ToBytes(c.data)
    const hash = await sha256Hex(bytes)
    if (hash !== c.sha256) throw new Error(`chunk ${c.index} failed integrity check`)
    parts.push(bytes)
  }
  const total = parts.reduce((n, p) => n + p.length, 0)
  const cipher = new Uint8Array(total)
  let off = 0
  for (const p of parts) { cipher.set(p, off); off += p.length }

  const cipherSha = await sha256Hex(cipher)
  if (cipherSha !== bundle.cipherSha256) throw new Error('full-ciphertext checksum mismatch — transfer corrupted')
  return cipher
}

export async function decryptSnapshot(bundle: EncryptedBundle, cipher: Uint8Array, key: CryptoKey): Promise<SnapshotPayload> {
  const iv = b64ToBytes(bundle.iv)
  const compressed = await decryptBytes(iv, cipher, key)   // throws if key/tag wrong
  const plainSha = await sha256Hex(compressed)
  if (plainSha !== bundle.plainSha256) throw new Error('decrypted-payload checksum mismatch')

  const raw = await gunzip(compressed, bundle.compressed)
  const payload = JSON.parse(bytesToStr(raw)) as SnapshotPayload
  if (!payload?.manifest || !payload.data) throw new Error('snapshot is missing its manifest/data')
  return payload
}

export interface RestoreResult {
  ok:           boolean
  restoredKeys: number
  stats?:       SnapshotStats
  error?:       string
}

// Writes every restored key, protecting this device's auth session, then nudges
// the app to recompute. The caller reloads the page for a clean full restore.
export function applySnapshot(payload: SnapshotPayload): RestoreResult {
  try {
    let restored = 0
    let twinKey: string | null = null
    for (const [k, v] of Object.entries(payload.data)) {
      if (PROTECT.has(k)) continue
      storage.setRaw(k, v)
      if (k.startsWith('kairo:twin:')) twinKey = k
      restored++
    }
    try {
      if (twinKey) window.dispatchEvent(new StorageEvent('storage', { key: twinKey }))
      window.dispatchEvent(new CustomEvent('kairo:xp'))
      window.dispatchEvent(new CustomEvent('kyno:transfer-restored'))
    } catch {  }
    log.info(`restored ${restored} keys`)
    return { ok: true, restoredKeys: restored, stats: payload.manifest.stats }
  } catch (e: any) {
    return { ok: false, restoredKeys: 0, error: String(e?.message || e) }
  }
}

export async function importEncrypted(
  bundle: EncryptedBundle,
  chunks: TransferChunk[],
  key: CryptoKey,
): Promise<RestoreResult> {
  try {
    const cipher  = await verifyAndReassemble(bundle, chunks)
    const payload = await decryptSnapshot(bundle, cipher, key)
    return applySnapshot(payload)
  } catch (e: any) {
    log.error('import failed', e)
    return { ok: false, restoredKeys: 0, error: String(e?.message || e) }
  }
}

// ── .kyno file container path ────────────────────────────────────────────────
export function parseSnapshotFile(text: string): { bundle: EncryptedBundle; cipher: Uint8Array } {
  let obj: any
  try { obj = JSON.parse(text) } catch { throw new Error('not a valid .kyno file (bad JSON)') }
  if (obj?.format !== 'kyno-transfer-file-v1' || !obj.bundle || typeof obj.cipher !== 'string') {
    throw new Error('this is not a Kyno transfer file')
  }
  return { bundle: obj.bundle as EncryptedBundle, cipher: b64ToBytes(obj.cipher) }
}

export async function verifyCipher(bundle: EncryptedBundle, cipher: Uint8Array): Promise<void> {
  const sha = await sha256Hex(cipher)
  if (sha !== bundle.cipherSha256) throw new Error('file checksum mismatch — the .kyno file is corrupted or incomplete')
}

// Whole-ciphertext import (file path). Verifies checksum, then decrypts (which
// fails cleanly on a wrong key), then restores.
export async function importFromCipher(bundle: EncryptedBundle, cipher: Uint8Array, key: CryptoKey): Promise<RestoreResult> {
  try {
    await verifyCipher(bundle, cipher)
    const payload = await decryptSnapshot(bundle, cipher, key)
    return applySnapshot(payload)
  } catch (e: any) {
    log.error('file import failed', e)
    const msg = /operation-specific reason|decrypt|tag/i.test(String(e?.message))
      ? 'Wrong key — double-check the code from the other device.'
      : String(e?.message || e)
    return { ok: false, restoredKeys: 0, error: msg }
  }
}
