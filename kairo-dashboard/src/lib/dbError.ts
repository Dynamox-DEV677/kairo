/**
 * The never-silent rule.
 *
 * Every write this app makes to Supabase went through one `catch {}`. When an
 * RLS policy started recursing and the API began answering 500 to every single
 * request, nothing anywhere said so -- not the console, not the UI. Persistence
 * was dead for weeks and the app looked fine, because a swallowed promise looks
 * exactly like success.
 *
 * So: no Supabase error is ever discarded. Every one is logged with the table,
 * the operation and the message Postgres actually returned, and the UI carries
 * an honest indicator. "saved" only ever means the server said so.
 */
import { getJSON, setJSON } from './storage'

export type SyncState = 'idle' | 'saving' | 'saved' | 'error'

export interface DbFailure {
  table: string
  op: string
  code?: string
  message: string
  hint?: string
  at: number
}

const LOG_KEY = 'kyno:db:failures'
const MAX_LOG = 40
export const SYNC_EVENT = 'kyno:sync-state'

let state: SyncState = 'idle'
let lastFailure: DbFailure | null = null
let pending = 0

export function syncState(): { state: SyncState; lastFailure: DbFailure | null; pending: number } {
  return { state, lastFailure, pending }
}

function emit() {
  try { window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: syncState() })) } catch { /* ssr */ }
}

function setState(next: SyncState) {
  state = next
  emit()
}

/** Everything that has failed on this device, newest last. Shown in Settings. */
export function failureLog(): DbFailure[] {
  try { return getJSON<DbFailure[]>(LOG_KEY) || [] } catch { return [] }
}

export function clearFailureLog() {
  try { localStorage.removeItem(LOG_KEY) } catch { /* ignore */ }
  lastFailure = null
  if (state === 'error') setState('idle')
}

/**
 * Record a failed Supabase call. Loud in the console, kept on the device, and
 * reflected in the indicator. Never throws -- reporting a problem must not
 * become a second problem.
 */
export function reportDbError(table: string, op: string, error: unknown): DbFailure {
  const e = (error || {}) as { code?: string; message?: string; hint?: string; details?: string }
  const failure: DbFailure = {
    table,
    op,
    code: e.code,
    message: e.message || String(error) || 'unknown error',
    hint: e.hint || e.details || undefined,
    at: Date.now(),
  }
  // The one line that would have caught this in week one.
  console.error(`[db] ${op} ${table} failed${failure.code ? ` (${failure.code})` : ''}: ${failure.message}`, failure.hint || '')
  try { setJSON(LOG_KEY, [...failureLog(), failure].slice(-MAX_LOG)) } catch { /* storage blocked */ }
  lastFailure = failure
  setState('error')
  return failure
}

/**
 * Wrap a Supabase call so its outcome is always visible.
 *
 *   const { data, error } = await tracked('users', 'upsert', () =>
 *     supabase.from('users').upsert(row, { onConflict: 'id' }).select().maybeSingle())
 *
 * Returns the same shape the caller expected, so it is a drop-in. The result
 * is NOT thrown on error: the caller decides whether it can continue, but it
 * can no longer pretend the call succeeded.
 */
export async function tracked<T>(
  table: string,
  op: string,
  run: () => PromiseLike<{ data: T | null; error: unknown }>,
): Promise<{ data: T | null; error: unknown; failure: DbFailure | null }> {
  pending++
  if (state !== 'error') setState('saving')
  try {
    const res = await run()
    if (res?.error) {
      const failure = reportDbError(table, op, res.error)
      return { data: res.data ?? null, error: res.error, failure }
    }
    if (state !== 'error') setState('saved')
    return { data: res?.data ?? null, error: null, failure: null }
  } catch (thrown) {
    // A network failure is not a database fault; it is the expected state on
    // Indian mobile data. Log it, but do not cry wolf with a red indicator.
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    if (offline) {
      console.warn(`[db] ${op} ${table} skipped: offline`)
      setState('idle')
      return { data: null, error: thrown, failure: null }
    }
    const failure = reportDbError(table, op, thrown)
    return { data: null, error: thrown, failure }
  } finally {
    pending = Math.max(0, pending - 1)
    emit()
  }
}
