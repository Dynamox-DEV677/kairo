/**
 * Kyno storage adapter — the chokepoint for every persistent read/write.
 *
 * WHY
 *   twin.ts used to call `localStorage.getItem`/`setItem` directly. That made
 *   it impossible to swap in a better store (SQLite in Electron, OPFS in the
 *   browser) without touching the data layer.
 *
 *   This adapter is the seam. twin.ts only knows about `storage.get/set`.
 *   At boot we detect what backends are available and pick the best one:
 *
 *     Electron + better-sqlite3 → SQLite via IPC (window.kairoDesktop.db)
 *     Browser                  → localStorage (current behaviour)
 *     SSR / Node               → in-memory Map (test-only)
 *
 * GUARANTEES
 *   - API is SYNCHRONOUS for `getRaw`/`setRaw` so the existing call sites in
 *     twin.ts don't have to become async. Electron exposes a synchronous IPC
 *     channel via preload.js (ipcRenderer.sendSync) — small payloads, fine.
 *   - All keys are STRINGS. All values are STRINGS (callers JSON-stringify).
 *     Same contract as the localStorage API so the switch is invisible.
 *   - Backend choice is locked in at the first call, never changes mid-run.
 *
 * SQLITE PROTOCOL — PHASE I
 *   This file is the foundation. Currently every backend except localStorage
 *   is stubbed. Phase II adds the Electron SQLite path. Phase III adds
 *   schema-aware query helpers (separate API, this stays a key-value store).
 */

// ════════════════════════════════════════════════════════════════════════════
// Backend detection
// ════════════════════════════════════════════════════════════════════════════

type Backend = 'sqlite' | 'localStorage' | 'memory'

interface KairoDesktopDB {
  /** Synchronous KV get — returns null when the key isn't present. */
  getSync: (key: string) => string | null
  /** Synchronous KV set. */
  setSync: (key: string, value: string) => void
  /** Synchronous KV delete. */
  removeSync: (key: string) => void
  /** List every key currently in the SQLite kv table. */
  listKeysSync: () => string[]

  // Phase III — relational query API. Optional because preload from an older
  // Electron build won't expose them.
  query?:       (sql: string, params?: any[]) => Promise<{ ok: boolean; rows: any[]; error?: string }>
  insertEvent?: (userKey: string, ev: any)    => Promise<boolean>
}

declare global {
  interface Window {
    kairoDesktop?: {
      isDesktop: boolean
      db?: KairoDesktopDB    // exposed when better-sqlite3 is wired in (Phase II)
      [k: string]: any
    }
  }
}

let _backend: Backend | null = null
const _memory = new Map<string, string>()

/** Marker key — once SQLite holds the data, we never run the localStorage→SQLite
 *  copy again for this device. Keyed on the major version so future re-migrations
 *  (e.g. when Phase III lands and we need to rebuild indexes) can bump the suffix
 *  to force one more sweep. */
const MIGRATION_DONE_KEY = 'kairo:storage:migrated:v1'

/**
 * One-shot migration on the first run that detects SQLite is available.
 * Reads every `kairo:` / `kairo_` key from localStorage and copies it into
 * SQLite. The localStorage copy is left in place — if SQLite ever fails to
 * load on a future boot we silently fall back and the data is still there.
 *
 * Idempotent: a marker is written into SQLite the first time this finishes,
 * so subsequent boots skip the copy.
 */
function migrateLocalStorageToSqlite(db: NonNullable<NonNullable<Window['kairoDesktop']>['db']>) {
  try {
    if (db.getSync(MIGRATION_DONE_KEY)) return
    if (typeof localStorage === 'undefined') {
      db.setSync(MIGRATION_DONE_KEY, String(Date.now()))
      return
    }
    let copied = 0
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      if (!(k.startsWith('kairo:') || k.startsWith('kairo_'))) continue
      const v = localStorage.getItem(k)
      if (v === null) continue
      // Don't clobber anything the user has already touched in SQLite this run.
      if (db.getSync(k) !== null) continue
      db.setSync(k, v)
      copied++
    }
    db.setSync(MIGRATION_DONE_KEY, String(Date.now()))
    if (copied > 0) {
      // eslint-disable-next-line no-console
      console.info(`[kairo:storage] migrated ${copied} keys → SQLite`)
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[kairo:storage] migration failed (non-fatal):', e)
  }
}

function detectBackend(): Backend {
  if (_backend) return _backend
  try {
    const db = typeof window !== 'undefined' ? window.kairoDesktop?.db : undefined
    if (db?.getSync) {
      _backend = 'sqlite'
      migrateLocalStorageToSqlite(db)
      return _backend
    }
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      _backend = 'localStorage'
      return _backend
    }
  } catch { /* localStorage can throw under strict CSP / private mode */ }
  _backend = 'memory'
  return _backend
}

/** Which storage backend is currently active. Useful for diagnostics + tests. */
export function activeBackend(): Backend {
  return detectBackend()
}

// ════════════════════════════════════════════════════════════════════════════
// Raw KV API — STRING-IN / STRING-OUT, matching the localStorage contract.
// ════════════════════════════════════════════════════════════════════════════

/** Synchronous read. Returns null when the key is absent. */
export function getRaw(key: string): string | null {
  const b = detectBackend()
  try {
    if (b === 'sqlite')        return window.kairoDesktop!.db!.getSync(key)
    if (b === 'localStorage')  return localStorage.getItem(key)
    return _memory.get(key) ?? null
  } catch {
    return null
  }
}

/** Synchronous write. */
export function setRaw(key: string, value: string): void {
  const b = detectBackend()
  try {
    if (b === 'sqlite')       { window.kairoDesktop!.db!.setSync(key, value); return }
    if (b === 'localStorage') { localStorage.setItem(key, value); return }
    _memory.set(key, value)
  } catch (e) {
    // Re-throw so twin.ts's saveState catch can fall back to pruning + retry.
    // This matches the old localStorage QuotaExceeded behaviour.
    throw e
  }
}

/** Synchronous delete. Safe to call on absent keys. */
export function removeRaw(key: string): void {
  const b = detectBackend()
  try {
    if (b === 'sqlite')       { window.kairoDesktop!.db!.removeSync(key); return }
    if (b === 'localStorage') { localStorage.removeItem(key); return }
    _memory.delete(key)
  } catch { /* ignore */ }
}

/**
 * List every key the active backend currently knows about. Used by
 * `resetAllData()` so we can wipe every `kairo:` / `kairo_` key without
 * caring whether they live in localStorage or SQLite.
 */
export function listKeys(): string[] {
  const b = detectBackend()
  try {
    if (b === 'sqlite')       return window.kairoDesktop!.db!.listKeysSync()
    if (b === 'localStorage') {
      const out: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k) out.push(k)
      }
      return out
    }
    return Array.from(_memory.keys())
  } catch {
    return []
  }
}

// ════════════════════════════════════════════════════════════════════════════
// JSON convenience — most Kyno code stores JSON blobs.
// ════════════════════════════════════════════════════════════════════════════

export function getJSON<T = unknown>(key: string): T | null {
  const raw = getRaw(key)
  if (raw === null) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

export function setJSON(key: string, value: unknown): void {
  setRaw(key, JSON.stringify(value))
}

// ════════════════════════════════════════════════════════════════════════════
// SQLITE PROTOCOL — PHASE III · async relational query API
// ════════════════════════════════════════════════════════════════════════════
//
// These helpers expose real SQL to renderer code WITHOUT touching the
// existing localStorage-blob model. The 17 importers of twin.ts keep using
// loadState() / getMistakes() / etc. New code that needs proper indexes or
// ORDER-BY-at-scale calls hasSqlQuery() first and uses sqlQuery() when true.
//
// Outside Electron, hasSqlQuery() returns false and pages just keep using
// the blob path. Nothing breaks.

export interface SqlResult<Row = any> {
  ok:     boolean
  rows:   Row[]
  error?: string
}

/** Returns true when the active backend supports real SQL (Electron + better-sqlite3). */
export function hasSqlQuery(): boolean {
  detectBackend()
  return _backend === 'sqlite' && !!window.kairoDesktop?.db?.query
}

/** Run a read-only SQL query against the local SQLite database. */
export async function sqlQuery<Row = any>(sql: string, params: any[] = []): Promise<SqlResult<Row>> {
  if (!hasSqlQuery()) return { ok: false, rows: [], error: 'no-sqlite' }
  try {
    const r = await window.kairoDesktop!.db!.query!(sql, params)
    return { ok: !!r?.ok, rows: r?.rows ?? [], error: r?.error }
  } catch (e: any) {
    return { ok: false, rows: [], error: String(e?.message || e) }
  }
}

/**
 * Mirror an event into the relational `events` table. twin.ts calls this
 * from track() so the SQL queries above stay in sync with the blob. No-op
 * when SQLite isn't available — the kv blob is still authoritative.
 */
export async function mirrorEvent(userKey: string, ev: any): Promise<void> {
  if (!hasSqlQuery()) return
  try { await window.kairoDesktop!.db!.insertEvent!(userKey, ev) }
  catch { /* ignore — kv blob is the source of truth */ }
}
