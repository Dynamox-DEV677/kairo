// Builds the complete, encrypted, chunk-able snapshot of the user's local Kyno
// database. Captures every `kairo:`/`kairo_` storage key (notes, flashcards,
// scores, study history, AI profile, revision schedules, achievements,
// preferences, offline resources, settings, attachments) — everything the app
// keeps on-device — then compresses and AES-256-GCM encrypts it.
import * as storage from '../lib/storage'
import { loadGame, badges } from '../lib/game'
import { makeLog } from './log'
import { strToBytes, gzip, encryptBytes, bytesToB64 } from './encryption'
import { sha256Hex, buildChunks } from './integrity'
import {
  TRANSFER_SCHEMA, CHUNK_SIZE,
  type SnapshotPayload, type SnapshotStats, type TransferManifest,
  type EncryptedBundle, type TransferChunk,
} from './types'

const log = makeLog('export')

// Auth + purely session-scoped keys stay on their own device — the new device
// keeps its own login and the transfer carries only the user's DATA.
const EXCLUDE = new Set(['kairo_token', 'kairo:sync:pulled', 'kairo:splash:shown'])

function isTransferable(key: string): boolean {
  if (EXCLUDE.has(key)) return false
  return key.startsWith('kairo:') || key.startsWith('kairo_')
}

function computeStats(data: Record<string, string>): SnapshotStats {
  let twin: any = {}
  const twinKey = Object.keys(data).find(k => k.startsWith('kairo:twin:'))
  if (twinKey) { try { twin = JSON.parse(data[twinKey]) || {} } catch { twin = {} } }

  const events = Array.isArray(twin.events) ? twin.events : []
  let xp = 0, achievements = 0
  try { const g = loadGame(); xp = g.totalXP || 0; achievements = badges(g).filter(b => b.earned).length } catch {  }

  return {
    notes:        Array.isArray(twin.notes)      ? twin.notes.length      : 0,
    flashcards:   Array.isArray(twin.flashcards) ? twin.flashcards.length : 0,
    scores:       events.filter((e: any) => typeof e?.score === 'number').length,
    events:       events.length,
    concepts:     Array.isArray(twin.concepts)   ? twin.concepts.length   : 0,
    formulas:     Array.isArray(twin.formulas)   ? twin.formulas.length   : 0,
    achievements,
    xp,
    keys:         Object.keys(data).length,
  }
}

export function collectSnapshot(opts: { deviceLabel: string; appVersion?: string }): SnapshotPayload {
  const data: Record<string, string> = {}
  for (const key of storage.listKeys()) {
    if (!isTransferable(key)) continue
    const v = storage.getRaw(key)
    if (v !== null) data[key] = v
  }
  const stats = computeStats(data)
  log.info(`collected ${stats.keys} keys · ${stats.flashcards} flashcards · ${stats.events} events · ${stats.xp} XP`)
  const manifest: TransferManifest = {
    schema:      TRANSFER_SCHEMA,
    createdAt:   Date.now(),
    app:         'kyno',
    appVersion:  opts.appVersion || '1.0',
    deviceLabel: opts.deviceLabel,
    stats,
  }
  return { manifest, data }
}

export interface EncryptedSnapshot {
  bundle: EncryptedBundle
  cipher: Uint8Array       // full ciphertext (used by the file-fallback path)
  chunks: TransferChunk[]  // 64 KB verified chunks (used by the streaming path)
}

export async function encryptSnapshot(payload: SnapshotPayload, key: CryptoKey): Promise<EncryptedSnapshot> {
  const json  = JSON.stringify(payload)
  const raw   = strToBytes(json)
  const { data: compressed, compressed: didCompress } = await gzip(raw)
  const plainSha256 = await sha256Hex(compressed)

  const { iv, cipher } = await encryptBytes(compressed, key)
  const cipherSha256 = await sha256Hex(cipher)
  const chunks = await buildChunks(cipher, CHUNK_SIZE)

  const bundle: EncryptedBundle = {
    schema:       TRANSFER_SCHEMA,
    alg:          'AES-256-GCM',
    iv:           bytesToB64(iv),
    compressed:   didCompress,
    plainSha256,
    cipherSha256,
    totalBytes:   cipher.length,
    chunkSize:    CHUNK_SIZE,
    chunkCount:   chunks.length,
    manifest:     payload.manifest,
  }
  log.info(`encrypted ${raw.length}B → ${compressed.length}B (gzip:${didCompress}) → ${cipher.length}B cipher in ${chunks.length} chunks`)
  return { bundle, cipher, chunks }
}

// Convenience: collect + encrypt in one call.
export async function exportEncrypted(key: CryptoKey, opts: { deviceLabel: string; appVersion?: string }): Promise<EncryptedSnapshot & { payload: SnapshotPayload }> {
  const payload = collectSnapshot(opts)
  const enc = await encryptSnapshot(payload, key)
  return { ...enc, payload }
}
