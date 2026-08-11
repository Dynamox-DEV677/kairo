

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
  } catch (e) {
    console.warn('[kyno:storage] backend detection failed, using memory:', e)
  }
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
    // Quota is the realistic failure here, and on a phone it is not rare.
    // Rethrowing bare left callers to swallow it; name it so the write is
    // visibly lost rather than silently lost.
    const quota = e instanceof DOMException &&
      (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    if (quota) {
      console.error(
        `[kyno:storage] out of quota writing "${key}" (${value.length} bytes). ` +
        `Value not saved.`,
      )
      throw new Error(`Storage full — "${key}" was not saved.`)
    }
    throw e
  }
}

export function removeRaw(key: string): void {
  const b = detectBackend()
  try {
    if (b === 'sqlite')       { window.kairoDesktop!.db!.removeSync(key); return }
    if (b === 'localStorage') { localStorage.removeItem(key); return }
    _memory.delete(key)
  } catch (e) {
    console.warn(`[kyno:storage] could not remove "${key}":`, e)
  }
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
  catch (e) { console.warn('[kyno:storage] mirrorEvent failed (non-fatal):', e) }
}

/* ────────────────────────────────────────────────────────────────────────
   TYPED KEY REGISTRY AND THE kairo: → kyno: MIGRATION

   Everything above is the backend abstraction (SQLite on desktop,
   localStorage in the browser). Everything below is the app-facing layer:
   one place that knows what keys exist, what shape each holds, and how to
   move a device off the legacy naming.

   Nothing outside this module should call localStorage directly.
   ──────────────────────────────────────────────────────────────────────── */

const SCHEMA_KEY = 'kyno:schema'
const SCHEMA_VERSION = 1

/** Every key the app owns. Logical name → storage key. */
export const KEYS = {
  profile:        'kyno:profile',
  lastUid:        'kyno:last_uid',
  theme:          'kyno:theme',
  devMode:        'kyno:dev_mode',
  decor:          'kyno:decor',

  writingDraft:   'kyno:writing:draft',
  solverUi:       'kyno:solver-ui',
  solveLast:      'kyno:solve:last',
  conceptmapView: 'kyno:conceptmap:view',

  chatLastId:     'kyno:chat:lastid',
  notebook:       'kyno:notebook:entries',
  homeBrief:      'kyno:home_brief_v1',
  game:           'kyno:game:v1',

  demoPrompt:     'kyno:demo-prompt-shown',
  onboardSkip:    'kyno:onboard:skip',
  sidebarShowAll: 'kyno:sidebar:showAll',
  sidebarExpanded:'kyno:sidebar:expanded',
} as const

export type KeyName = keyof typeof KEYS

/**
 * Profile, after migration. Tokens are deliberately absent — Supabase's own
 * SDK storage is the single source of truth for those. Duplicating them here
 * widened the blast radius of any XSS for no benefit.
 */
export interface StoredProfile {
  id?:         string
  name?:       string
  role?:       string
  avatar_url?: string
  school_id?:  string | null
}

export function get<T = unknown>(name: KeyName): T | null {
  return getJSON<T>(KEYS[name])
}

export function set(name: KeyName, value: unknown): void {
  setJSON(KEYS[name], value)
}

export function remove(name: KeyName): void {
  removeRaw(KEYS[name])
}

/** Per-user keys can't live in the static registry. */
export const userKey = {
  notifs:    (uid: string) => `kyno:notifs:${uid}`,
  onboarded: (uid: string) => `kyno:onboarded:${uid}`,
  onboardHide: (uid: string) => `kyno:onboard:hide:${uid}`,
  twin:      (uid: string) => `kyno:twin:${uid}`,
}

/**
 * These two grew to 43KB and 11KB on a real device. localStorage is
 * synchronous, so every read of them blocks the main thread — on a mid-range
 * Android that is measurable jank on boot. They belong in IndexedDB with a
 * rolling cap; until that lands, the migration drops them rather than
 * carrying them across, because a stale chat cache is worth less than the
 * boot time it costs.
 */
const OVERSIZED_LEGACY = ['kairo:chat:last', 'kairo:recent_chats']

/** Dead Supabase project. Nothing in the source references it — verified by
 *  grep across src/, server/, api/ and index.html. It is a leftover from an
 *  old deploy still sitting in users' browsers. */
const DEAD_SUPABASE_KEY = 'sb-lbnrexqbxrokxlhoepcb-auth-token'

/** Legacy token duplicates. Supabase's SDK storage replaces all of these. */
const LEGACY_TOKEN_KEYS = ['kairo_token', 'kairo_refresh']

export interface MigrationReport {
  ran:       boolean
  renamed:   number
  dropped:   string[]
  strippedProfileTokens: boolean
  bytesFreed: number
}

/**
 * Idempotent. Safe to call on every boot; does real work only once per device
 * per schema version.
 */
export function migrateStorage(): MigrationReport {
  const report: MigrationReport = {
    ran: false, renamed: 0, dropped: [], strippedProfileTokens: false, bytesFreed: 0,
  }

  try {
    const current = Number(getRaw(SCHEMA_KEY) || 0)
    if (current >= SCHEMA_VERSION) return report
    report.ran = true

    const sizeOf = (k: string) => (getRaw(k)?.length ?? 0)

    // 1. Drop what should never have been persisted, or is too big to keep.
    for (const k of [...OVERSIZED_LEGACY, ...LEGACY_TOKEN_KEYS, DEAD_SUPABASE_KEY]) {
      const bytes = sizeOf(k)
      if (bytes === 0) continue
      report.bytesFreed += bytes
      report.dropped.push(k)
      removeRaw(k)
    }

    // 2. Strip the access_token / refresh_token that were being kept inside
    //    the profile blob alongside ordinary display fields.
    const legacyProfile = getJSON<Record<string, unknown>>('kairo_profile')
    if (legacyProfile) {
      const clean: StoredProfile = {
        id:         legacyProfile.id as string | undefined,
        name:       legacyProfile.name as string | undefined,
        role:       legacyProfile.role as string | undefined,
        avatar_url: legacyProfile.avatar_url as string | undefined,
        school_id:  (legacyProfile.school_id as string | null) ?? null,
      }
      report.strippedProfileTokens =
        'access_token' in legacyProfile || 'refresh_token' in legacyProfile
      setJSON(KEYS.profile, clean)
      removeRaw('kairo_profile')
      report.renamed++
    }

    // 3. Rename everything else. kairo:foo:bar and kairo_foo both become
    //    kyno:foo:bar / kyno:foo — one namespace, one prefix.
    for (const k of listKeys()) {
      if (!(k.startsWith('kairo:') || k.startsWith('kairo_'))) continue
      if (k === 'kairo:storage:migrated:v1') continue

      // 'kairo:' and 'kairo_' are both 6 characters, so one slice covers both.
      const next = `kyno:${k.slice(6)}`
      if (getRaw(next) !== null) { removeRaw(k); continue }  // already migrated

      const v = getRaw(k)
      if (v === null) continue
      setRaw(next, v)
      removeRaw(k)
      report.renamed++
    }

    setRaw(SCHEMA_KEY, String(SCHEMA_VERSION))
    console.info(
      `[kyno:storage] migrated — ${report.renamed} keys renamed, ` +
      `${report.dropped.length} dropped, ${(report.bytesFreed / 1024).toFixed(1)}KB freed`,
    )
  } catch (e) {
    // A failed migration must not brick the app. Log loudly and carry on with
    // whatever state the device already had.
    console.error('[kyno:storage] migration failed — continuing on legacy keys:', e)
  }

  return report
}
