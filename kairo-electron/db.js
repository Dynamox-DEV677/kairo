/**
 * Kairo · SQLite driver (Electron main process).
 *
 * SQLITE PROTOCOL — PHASE II
 *
 * This is the only place better-sqlite3 is loaded. main.js exposes the driver
 * over IPC; preload.js wraps the IPC channels into a synchronous KV API that
 * the renderer accesses as `window.kairoDesktop.db`.
 *
 * SCHEMA
 *   At Phase II, we keep things deliberately boring: a single `kv` table
 *   that mirrors the localStorage contract (key → value, both strings).
 *
 *     CREATE TABLE kv (
 *       key   TEXT PRIMARY KEY,
 *       value TEXT NOT NULL,
 *       updated_at INTEGER NOT NULL  -- ms epoch, for future sync conflict resolution
 *     )
 *
 *   Phase III adds proper relational tables (events, mastery, doubts, …)
 *   alongside this kv table — never replacing it. Anything stored as a
 *   JSON blob through storage.setRaw() lives here forever.
 *
 * LOCATION
 *   The db file lives under Electron's app.getPath('userData'), which on
 *   Windows resolves to %APPDATA%\Kairo\kairo.db — survives app updates,
 *   is excluded from auto-update overwrites, lives across reinstalls.
 *
 * PERFORMANCE
 *   WAL mode + synchronous=NORMAL gives us crash-safety with sub-millisecond
 *   writes. We don't need full sync because Kairo's data is recoverable from
 *   cloud snapshots in the worst case.
 */
const path     = require('path')
const fs       = require('fs')
const { app }  = require('electron')
const log      = require('electron-log')

let _db = null

/** Open the SQLite database on first call; reuse the connection thereafter. */
function getDb() {
  if (_db) return _db
  try {
    // Lazy-load so the app still boots even if the native module is missing
    // (e.g. a botched install). The renderer will fall back to localStorage.
    const Database = require('better-sqlite3')
    const dir  = app.getPath('userData')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, 'kairo.db')

    _db = new Database(file)
    _db.pragma('journal_mode = WAL')
    _db.pragma('synchronous = NORMAL')
    _db.exec(`
      CREATE TABLE IF NOT EXISTS kv (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_kv_updated ON kv(updated_at);

      -- ──────────────────────────────────────────────────────────────────
      -- SQLITE PROTOCOL — PHASE III · relational mirror
      -- ──────────────────────────────────────────────────────────────────
      -- The kv table still holds the canonical blob (for compat with the
      -- adapter layer). These tables are populated lazily by query()
      -- helpers so that new code can run real SQL — ORDER BY, WHERE, etc.
      -- The 17 existing importers of twin.ts keep working unchanged.
      CREATE TABLE IF NOT EXISTS events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_key    TEXT NOT NULL,
        ts          INTEGER NOT NULL,
        type        TEXT NOT NULL,
        subject     TEXT,
        topic       TEXT,
        score       REAL,
        correct     INTEGER,                  -- 0 / 1 (SQLite has no BOOL)
        duration_ms INTEGER,
        modality    TEXT,
        payload     TEXT                       -- JSON blob for the long tail
      );
      CREATE INDEX IF NOT EXISTS idx_events_user_ts  ON events(user_key, ts DESC);
      CREATE INDEX IF NOT EXISTS idx_events_user_type ON events(user_key, type);
      CREATE INDEX IF NOT EXISTS idx_events_topic    ON events(user_key, topic);
    `)
    log.info(`[db] sqlite ready at ${file}`)
    return _db
  } catch (e) {
    log.warn('[db] failed to open sqlite, falling back to no-db mode:', e.message)
    _db = null
    return null
  }
}

/** Prepared statements — cached for the lifetime of the process. */
function stmts() {
  const db = getDb()
  if (!db) return null
  if (!stmts._cache) {
    stmts._cache = {
      get:    db.prepare('SELECT value FROM kv WHERE key = ?'),
      set:    db.prepare('INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)'),
      del:    db.prepare('DELETE FROM kv WHERE key = ?'),
      keys:   db.prepare('SELECT key FROM kv'),
    }
  }
  return stmts._cache
}

// ════════════════════════════════════════════════════════════════════════════
// Public API — these match the storage.ts adapter contract.
// ════════════════════════════════════════════════════════════════════════════

function get(key) {
  try {
    const s = stmts()
    if (!s) return null
    const row = s.get.get(key)
    return row ? row.value : null
  } catch (e) {
    log.warn('[db] get failed:', e.message)
    return null
  }
}

function set(key, value) {
  try {
    const s = stmts()
    if (!s) return
    s.set.run(key, value, Date.now())
  } catch (e) {
    log.warn('[db] set failed:', e.message)
  }
}

function remove(key) {
  try {
    const s = stmts()
    if (!s) return
    s.del.run(key)
  } catch (e) {
    log.warn('[db] remove failed:', e.message)
  }
}

function listKeys() {
  try {
    const s = stmts()
    if (!s) return []
    return s.keys.all().map(r => r.key)
  } catch (e) {
    log.warn('[db] listKeys failed:', e.message)
    return []
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SQLITE PROTOCOL — PHASE III · read-only query API
// ════════════════════════════════════════════════════════════════════════════
//
// The renderer can run real SQL against the mirrored `events` table for new
// pages that want indexed queries (Mistake Analysis at scale, Knowledge Graph
// filtering, etc.). All other tables come later.
//
// Safety: only one statement per call, no write keywords. The renderer is
// remote content (kairo-daily-edu.vercel.app), so we treat its queries as
// untrusted — even though the user owns the data, we never execute statements
// that could nuke the schema.

const FORBIDDEN_RE = /\b(insert|update|delete|drop|alter|attach|detach|create|replace|pragma|vacuum)\b/i

function query(sql, params) {
  try {
    const db = getDb()
    if (!db) return { ok: false, error: 'sqlite-unavailable', rows: [] }
    if (typeof sql !== 'string')      return { ok: false, error: 'sql-not-a-string', rows: [] }
    if (sql.length > 4000)            return { ok: false, error: 'sql-too-long',     rows: [] }
    if (FORBIDDEN_RE.test(sql))       return { ok: false, error: 'sql-write-not-allowed', rows: [] }
    if (sql.includes(';'))            return { ok: false, error: 'sql-multi-statement-not-allowed', rows: [] }

    const stmt = db.prepare(sql)
    const args = Array.isArray(params) ? params : (params ?? [])
    const rows = stmt.all(...args)
    return { ok: true, rows }
  } catch (e) {
    return { ok: false, error: String(e?.message || e), rows: [] }
  }
}

/**
 * Write an event row into the relational mirror. Called by the renderer's
 * twin.ts whenever an event is tracked, so the mirror stays in sync with the
 * canonical kv blob. Failures are silent — the kv blob is still authoritative.
 */
function insertEvent(userKey, ev) {
  try {
    const db = getDb()
    if (!db) return
    if (!insertEvent._stmt) {
      insertEvent._stmt = db.prepare(`
        INSERT INTO events (user_key, ts, type, subject, topic, score, correct, duration_ms, modality, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
    }
    insertEvent._stmt.run(
      userKey,
      Number(ev.ts) || Date.now(),
      String(ev.type || ''),
      ev.subject ?? null,
      ev.topic   ?? null,
      ev.score == null ? null : Number(ev.score),
      ev.correct == null ? null : (ev.correct ? 1 : 0),
      ev.durationMs == null ? null : Number(ev.durationMs),
      ev.modality ?? null,
      ev.payload ? JSON.stringify(ev.payload) : null,
    )
  } catch (e) {
    log.warn('[db] insertEvent failed:', e.message)
  }
}

/** Diagnostic — number of rows in kv, useful for the /status page. */
function size() {
  try {
    const db = getDb()
    if (!db) return 0
    const r = db.prepare('SELECT COUNT(*) AS n FROM kv').get()
    return r?.n ?? 0
  } catch { return 0 }
}

/**
 * Returns true when the SQLite backend is actually usable. The renderer's
 * storage adapter calls this via IPC before deciding to use SQLite vs.
 * localStorage. (We can't just rely on `window.kairoDesktop.db` existing —
 * the native module might fail to load.)
 */
function ready() {
  return getDb() !== null
}

module.exports = { get, set, remove, listKeys, size, ready, query, insertEvent }
