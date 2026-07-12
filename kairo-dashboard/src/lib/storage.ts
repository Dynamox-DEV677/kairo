

type Backend = 'sqlite' | 'localStorage' | 'memory'

interface KairoDesktopDB {
  getSync: (key: string) => string | null
  setSync: (key: string, value: string) => void
  removeSync: (key: string) => void
  listKeysSync: () => string[]

  query?:       (sql: string, params?: any[]) => Promise<{ ok: boolean; rows: any[]; error?: string }>
  insertEvent?: (userKey: string, ev: any)    => Promise<boolean>
}

declare global {
  interface Window {
    kairoDesktop?: {
      isDesktop: boolean
      db?: KairoDesktopDB
      [k: string]: any
    }
  }
}

let _backend: Backend | null = null
const _memory = new Map<string, string>()

const MIGRATION_DONE_KEY = 'kairo:storage:migrated:v1'

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
  } catch {  }
  _backend = 'memory'
  return _backend
}

export function activeBackend(): Backend {
  return detectBackend()
}

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

export function setRaw(key: string, value: string): void {
  const b = detectBackend()
  try {
    if (b === 'sqlite')       { window.kairoDesktop!.db!.setSync(key, value); return }
    if (b === 'localStorage') { localStorage.setItem(key, value); return }
    _memory.set(key, value)
  } catch (e) {
    throw e
  }
}

export function removeRaw(key: string): void {
  const b = detectBackend()
  try {
    if (b === 'sqlite')       { window.kairoDesktop!.db!.removeSync(key); return }
    if (b === 'localStorage') { localStorage.removeItem(key); return }
    _memory.delete(key)
  } catch {  }
}

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

export function getJSON<T = unknown>(key: string): T | null {
  const raw = getRaw(key)
  if (raw === null) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

export function setJSON(key: string, value: unknown): void {
  setRaw(key, JSON.stringify(value))
}

export interface SqlResult<Row = any> {
  ok:     boolean
  rows:   Row[]
  error?: string
}

export function hasSqlQuery(): boolean {
  detectBackend()
  return _backend === 'sqlite' && !!window.kairoDesktop?.db?.query
}

export async function sqlQuery<Row = any>(sql: string, params: any[] = []): Promise<SqlResult<Row>> {
  if (!hasSqlQuery()) return { ok: false, rows: [], error: 'no-sqlite' }
  try {
    const r = await window.kairoDesktop!.db!.query!(sql, params)
    return { ok: !!r?.ok, rows: r?.rows ?? [], error: r?.error }
  } catch (e: any) {
    return { ok: false, rows: [], error: String(e?.message || e) }
  }
}

export async function mirrorEvent(userKey: string, ev: any): Promise<void> {
  if (!hasSqlQuery()) return
  try { await window.kairoDesktop!.db!.insertEvent!(userKey, ev) }
  catch {  }
}
