// Shared types for the Privacy-First Device Transfer system.
// Data never leaves the device unencrypted; only connection metadata (SessionInfo)
// ever appears in a QR code, and even the encryption key is one-time + ephemeral.

export const TRANSFER_SCHEMA = 'kyno-transfer-v1' as const
export const CHUNK_SIZE = 64 * 1024        // 64 KB encrypted chunks
export const QR_TTL_MS = 2 * 60 * 1000     // QR/session expires after 2 minutes

// Human-readable counts shown in the confirm/verify UI ("30 flashcards, 220 XP…").
export interface SnapshotStats {
  notes:       number
  flashcards:  number
  scores:      number   // recorded quiz/battle scores (events with a score)
  events:      number   // full study-history event count
  concepts:    number
  formulas:    number
  achievements: number
  xp:          number
  keys:        number   // total localStorage keys captured
}

// The plaintext snapshot: the manifest + every kairo* storage key/value.
export interface TransferManifest {
  schema:      typeof TRANSFER_SCHEMA
  createdAt:   number
  app:         'kyno'
  appVersion:  string
  deviceLabel: string
  stats:       SnapshotStats
}

export interface SnapshotPayload {
  manifest: TransferManifest
  data:     Record<string, string>   // raw kairo* key → value
}

// The encrypted, compressed, chunk-able bundle produced by the exporter.
export interface EncryptedBundle {
  schema:      typeof TRANSFER_SCHEMA
  alg:         'AES-256-GCM'
  iv:          string      // base64, 12 bytes
  compressed:  boolean     // gzip applied before encryption?
  plainSha256: string      // hex — checksum of the compressed plaintext
  cipherSha256: string     // hex — checksum of the ciphertext (verified before decrypt)
  totalBytes:  number      // ciphertext length
  chunkSize:   number
  chunkCount:  number
  manifest:    TransferManifest  // clear metadata (counts only — no user content)
}

export interface TransferChunk {
  index:  number
  total:  number
  sha256: string   // hex — verified on arrival; failed chunks are retried
  data:   string   // base64 of this ciphertext slice
}

export type TransferKind = 'webrtc' | 'file'

// The ONLY thing a QR code ever carries: connection metadata, never user data.
export interface SessionInfo {
  v:          1
  kind:       TransferKind
  sessionId:  string        // random id for this one-time session
  code:       string        // short human pairing code (fallback if scan fails)
  pubKey?:    string         // base64 ECDH public key of the sender (handshake)
  signal?:    string         // optional inline signaling hint (relay channel id)
  expiresAt:  number         // epoch ms — hard 2-minute expiry
}

export type TransferPhase =
  | 'idle' | 'exporting' | 'pairing' | 'awaiting-approval'
  | 'transferring' | 'verifying' | 'importing' | 'complete' | 'error' | 'cancelled'

export interface TransferProgress {
  phase:        TransferPhase
  bytesSent:    number
  bytesTotal:   number
  chunksSent:   number
  chunksTotal:  number
  pct:          number       // 0..100
  etaMs:        number | null
  retries:      number
  message?:     string
}
