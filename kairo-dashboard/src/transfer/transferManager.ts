// Orchestrates a device transfer. Phase 2 implements the encrypted-FILE path
// end-to-end (build → download/share + one-time key → pick file + key → restore).
// The WebRTC live path (Phase 3) plugs into the same export/import core.
import { makeLog } from './log'
import { generateSessionKey, exportKeyB64, importKeyB64 } from './encryption'
import {
  collectSnapshot, encryptSnapshot, serializeSnapshotFile, transferFileName,
} from './exporter'
import {
  parseSnapshotFile, importFromCipher, type RestoreResult,
} from './importer'
import type { TransferManifest } from './types'

const log = makeLog('manager')

export function currentDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'This device'
  const ua = navigator.userAgent
  const os =
    /iPhone|iPad|iPod/.test(ua) ? 'iPhone/iPad' :
    /Android/.test(ua)          ? 'Android'     :
    /Macintosh/.test(ua)        ? 'Mac'         :
    /Windows/.test(ua)          ? 'Windows'     :
    /Linux/.test(ua)            ? 'Linux'       : 'this device'
  const browser =
    /Edg\//.test(ua)     ? 'Edge'    :
    /Chrome\//.test(ua)  ? 'Chrome'  :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua)  ? 'Safari'  : 'browser'
  return `${os} · ${browser}`
}

export interface FileExportResult {
  fileText:  string        // the .kyno file contents
  fileName:  string
  keyB64:    string        // one-time AES key — shown as QR + copyable text, never persisted
  manifest:  TransferManifest
  sizeBytes: number
}

// Build the encrypted snapshot as a downloadable .kyno file + its one-time key.
export async function exportToFile(opts?: { appVersion?: string }): Promise<FileExportResult> {
  const key     = await generateSessionKey()
  const payload = collectSnapshot({ deviceLabel: currentDeviceLabel(), appVersion: opts?.appVersion })
  const enc     = await encryptSnapshot(payload, key)
  const fileText = serializeSnapshotFile(enc)
  const keyB64   = await exportKeyB64(key)
  log.info(`file ready: ${fileText.length}B, ${enc.bundle.chunkCount} chunk(s)`)
  return {
    fileText,
    fileName:  transferFileName(),
    keyB64,
    manifest:  enc.bundle.manifest,
    sizeBytes: fileText.length,
  }
}

// Read the manifest (counts only) from a picked file WITHOUT the key — lets the
// receiving device preview "you're about to restore X flashcards, Y XP…".
export function peekFileManifest(fileText: string): TransferManifest | null {
  try { return parseSnapshotFile(fileText).bundle.manifest } catch { return null }
}

// Decrypt + restore a picked .kyno file using the one-time key from the sender.
export async function importFromFile(fileText: string, keyB64: string): Promise<RestoreResult> {
  const trimmed = keyB64.trim()
  if (!trimmed) return { ok: false, restoredKeys: 0, error: 'Enter or scan the key from your other device.' }
  let bundle, cipher
  try { ({ bundle, cipher } = parseSnapshotFile(fileText)) }
  catch (e: any) { return { ok: false, restoredKeys: 0, error: String(e?.message || e) } }
  let key: CryptoKey
  try { key = await importKeyB64(trimmed) }
  catch { return { ok: false, restoredKeys: 0, error: 'That key looks malformed — copy it again from the other device.' } }
  return importFromCipher(bundle, cipher, key)
}

// Trigger a browser download of the .kyno file.
export function downloadTransferFile(fileText: string, fileName: string): void {
  const blob = new Blob([fileText], { type: 'application/octet-stream' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = fileName
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// Share sheet (AirDrop / Nearby Share / etc.) when the browser supports sharing files.
export async function shareTransferFile(fileText: string, fileName: string): Promise<boolean> {
  try {
    const file = new File([fileText], fileName, { type: 'application/octet-stream' })
    const nav = navigator as any
    if (nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], title: 'Kyno transfer', text: 'My encrypted Kyno backup' })
      return true
    }
  } catch (e) { log.warn('share cancelled/failed', e) }
  return false
}
