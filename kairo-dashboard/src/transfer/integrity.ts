// SHA-256 checksums + chunk splitting. Every chunk is verified on arrival and
// the full ciphertext is verified before we ever attempt to decrypt.
import { bytesToB64 } from './encryption'
import { CHUNK_SIZE, type TransferChunk } from './types'

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function verifySha256(bytes: Uint8Array, expectedHex: string): Promise<boolean> {
  const actual = await sha256Hex(bytes)
  // constant-length compare (hex strings) — not timing-sensitive here, but tidy.
  return actual.length === expectedHex.length && actual === expectedHex
}

export function splitIntoChunks(bytes: Uint8Array, size = CHUNK_SIZE): Uint8Array[] {
  const out: Uint8Array[] = []
  for (let i = 0; i < bytes.length; i += size) out.push(bytes.subarray(i, i + size))
  // A zero-byte payload still produces one (empty) chunk so counts stay sane.
  if (out.length === 0) out.push(new Uint8Array(0))
  return out
}

export async function buildChunks(cipher: Uint8Array, size = CHUNK_SIZE): Promise<TransferChunk[]> {
  const parts = splitIntoChunks(cipher, size)
  const chunks: TransferChunk[] = []
  for (let i = 0; i < parts.length; i++) {
    chunks.push({
      index:  i,
      total:  parts.length,
      sha256: await sha256Hex(parts[i]),
      data:   bytesToB64(parts[i]),
    })
  }
  return chunks
}
