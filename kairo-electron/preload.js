/**
 * Preload — runs in an isolated context BEFORE the Kairo web app loads.
 * Bridges a tiny, safe API into the renderer via window.kairoDesktop.
 *
 * We only expose what's strictly needed: app version + platform string.
 * Everything else flows through normal web APIs (Supabase auth, etc.)
 * so the web build and the desktop build stay identical in behaviour.
 */
const { contextBridge, ipcRenderer } = require('electron')

// ─── SQLite Protocol — Phase II ────────────────────────────────────────────
// Probe the SQLite backend at preload-time. If better-sqlite3 failed to load
// (e.g. native module issue), `db.ready` returns false and we leave the `db`
// field undefined so storage.ts falls back to localStorage. This is invisible
// to the user — they never see a broken app, just a slightly different store.
let _dbReady = false
try { _dbReady = ipcRenderer.sendSync('kairo:db:ready') === true } catch { /* ignore */ }

const dbBridge = _dbReady ? {
  /** Synchronous KV get — returns null when absent, just like localStorage. */
  getSync:      (key)         => {
    try { return ipcRenderer.sendSync('kairo:db:get', String(key)) ?? null }
    catch { return null }
  },
  /** Synchronous KV set. Throws nothing — failures are silent (matches localStorage quota behaviour). */
  setSync:      (key, value)  => {
    try { ipcRenderer.sendSync('kairo:db:set', String(key), String(value)) }
    catch { /* ignore */ }
  },
  /** Synchronous KV delete. */
  removeSync:   (key)         => {
    try { ipcRenderer.sendSync('kairo:db:remove', String(key)) }
    catch { /* ignore */ }
  },
  /** List every key currently in the kv table. */
  listKeysSync: ()            => {
    try { return ipcRenderer.sendSync('kairo:db:list-keys') || [] }
    catch { return [] }
  },
  /** Diagnostic — row count. */
  size:         ()            => {
    try { return ipcRenderer.sendSync('kairo:db:size') || 0 }
    catch { return 0 }
  },

  // SQLITE PROTOCOL — PHASE III · relational queries.
  // These are async because real SQL can be slower than a KV read. The
  // renderer-side helpers in storage.ts await them.
  /** Run a read-only SELECT. Returns { ok, rows, error? }. */
  query:        async (sql, params) => {
    try { return await ipcRenderer.invoke('kairo:db:query', String(sql), params ?? []) }
    catch (e) { return { ok: false, error: String(e?.message || e), rows: [] } }
  },
  /** Insert one event into the relational `events` mirror. Fire-and-forget. */
  insertEvent:  async (userKey, ev) => {
    try { return await ipcRenderer.invoke('kairo:db:insert-event', String(userKey), ev) }
    catch { return false }
  },
} : undefined

contextBridge.exposeInMainWorld('kairoDesktop', {
  isDesktop: true,
  getVersion:  () => ipcRenderer.invoke('kairo:get-version'),
  getPlatform: () => ipcRenderer.invoke('kairo:get-platform'),
  db:          dbBridge,

  // ── Auto-update flow ────────────────────────────────────────────────
  // Three IPC channels surface the full update lifecycle in the React UI
  // so we never fall back to a plain OS notification or dialog:
  //   kairo:update-downloading  → version + progress %
  //   kairo:update-ready        → download finished, restart available
  onUpdateDownloading: (handler) => {
    const fn = (_event, info) => handler(info)
    ipcRenderer.on('kairo:update-downloading', fn)
    return () => ipcRenderer.removeListener('kairo:update-downloading', fn)
  },
  onUpdateReady: (handler) => {
    const fn = (_event, info) => handler(info)
    ipcRenderer.on('kairo:update-ready', fn)
    return () => ipcRenderer.removeListener('kairo:update-ready', fn)
  },
  restartToUpdate: () => ipcRenderer.invoke('kairo:restart-to-update'),
})
