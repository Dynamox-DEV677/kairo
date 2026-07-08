/**
 * Kyno — Academic Twin engine, fully client-side.
 *
 * DESIGN
 *   Every student's learning model lives in their own browser, not in our
 *   database. This is the Netflix-downloads model: the catalog (schools /
 *   users / school data) is on the server, the personal behavioural data
 *   (events, mastery, observations) lives on the device.
 *
 *   Benefits:
 *     - Zero per-user storage cost.
 *     - Privacy: nothing about how the student studies ever leaves the device.
 *     - Speed: every compute runs in <5 ms — no network round-trip.
 *     - Infinite scale: each device owns its own state.
 *
 *   Trade-offs we accept:
 *     - Data is per-device. Login on phone + laptop = two separate twins.
 *       (Optional sync can be bolted on later as an opt-in.)
 *     - Clearing browser data wipes the twin. Expected and acceptable.
 *     - Limited to ~5 MB localStorage — we cap events at 800 and prune > 90 d.
 *
 * STORAGE LAYOUT
 *   localStorage key: `kairo:twin:<userKey>`
 *   userKey defaults to '_local' if no user is signed in. When a user logs in
 *   we derive the key from their Supabase id (no need to expose the actual id
 *   on disk — but no real harm if we do).
 *
 *   Schema version is recorded in state.version so we can migrate later.
 */

// ════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════

export type EventType =
  | 'quiz_answered' | 'quiz_completed'
  | 'lab_opened'    | 'lab_explored'
  | 'flashcard_review'
  | 'essay_graded'
  | 'note_created'
  | 'concept_viewed'
  | 'session_start' | 'session_end'
  | 'mistake'
  | 'mastery_up'   | 'mastery_down'

export type Modality = 'visual' | 'text' | 'interactive' | 'repetition'

export interface TwinEvent {
  ts:         number               // Date.now()
  type:       EventType
  subject?:   string
  topic?:     string               // already-normalised lowercase
  score?:     number               // 0..100
  correct?:   boolean
  durationMs?: number
  modality?:  Modality
  payload?:   Record<string, any>
}

export interface MasteryRow {
  subject:         string
  topic:           string
  mastery:         number          // 0..1
  attempts:        number
  correct:         number
  lastStudiedAt:   number
  lastCorrectAt:   number | null
  forgetAt:        number          // ms ts when retention drops below threshold
  strength:        number          // Ebbinghaus "S"
  difficultyPref:  number
}

export interface WeakTopic   { subject: string; topic: string; mastery: number; severity: number; attempts: number; lastStudiedAt: number | null }
export interface ForgetTopic { subject: string; topic: string; hoursUntilForget: number; mastery: number }

export interface Twin {
  computedAt:          number
  styleVisual:         number
  styleText:           number
  styleInteractive:    number
  styleRepetition:     number
  pace:                'fast' | 'steady' | 'slow' | 'inconsistent'
  focusBestHour:       number | null
  focusAvgMinutes:     number | null
  focusDropoffAfter:   number | null
  retentionScore:      number
  consistencyScore:    number
  burnoutRisk:         number
  confidence:          number
  performanceTrend:    number
  predictedExamScore:  number | null
  predictedBand:       string | null
  streakDays:          number
  lastActiveAt:        number | null
  weakTopics:          WeakTopic[]
  strongTopics:        WeakTopic[]
  forgettingSoon:      ForgetTopic[]
}

export interface Observation {
  id:          string
  kind:        'insight' | 'pattern' | 'milestone' | 'concern' | 'celebration'
  tone:        'supportive' | 'neutral' | 'caution'
  title:       string
  body:        string
  topic?:      string
  importance:  number              // 0..1
  createdAt:   number
  expiresAt:   number
}

export interface Recommendation {
  id:         string
  kind:       'revise' | 'lab' | 'flashcard' | 'quiz' | 'break' | 'plan'
  target?:    string
  subject?:   string
  reason:     string
  priority:   number               // 0..1
  metadata?:  Record<string, any>
  createdAt:  number
}

// ─── Domain records — every other Kyno system reads/writes here ──────────────
export interface Doubt {
  id:        string
  ts:        number
  question:  string
  answer?:   string       // full markdown answer if available
  topic?:    string       // normalised
  subject?:  string
  source:    'solver' | 'manual' | 'voice'
}

export interface Concept {
  id:        string
  name:      string                // normalised, lowercase
  subject?:  string
  related:   string[]              // ids of related concepts
  encounteredAt: number            // first seen
  reinforcedAt:  number            // last revisit
  visits:    number
  mastery:   number                // 0..1 — derived from related quiz/lab events
}

export interface Formula {
  id:        string
  ts:        number
  name:      string                // "Newton's 2nd Law"
  expr:      string                // "F = m·a"
  subject?:  string
  topic?:    string
  source:    'solver' | 'manual' | 'lab'
}

export interface Flashcard {
  id:        string
  ts:        number
  front:     string
  back:      string
  subject?:  string
  topic?:    string
  reviews:   number
  ease:      number                // SRS ease factor (default 2.5)
  dueAt:     number                // next review time
  source:    'manual' | 'auto-from-doubt' | 'auto-from-mistake'
}

export interface TwinState {
  version:        3                 // bumped from 2 — added domain arrays
  userKey:        string
  events:         TwinEvent[]
  mastery:        MasteryRow[]
  twin:           Twin | null
  observations:   Observation[]
  recommendations: Recommendation[]
  // ─── Unified domain memory ─────────────────────────────────────────────
  doubts:         Doubt[]           // every question asked to Solver
  concepts:       Concept[]         // concept graph nodes
  formulas:       Formula[]         // collected formulas
  flashcards:     Flashcard[]       // SRS deck
}

// ════════════════════════════════════════════════════════════════════════════
// STORAGE ADAPTER
// ════════════════════════════════════════════════════════════════════════════
//
// All persistent reads/writes go through the storage adapter so SQLite
// (Electron) or OPFS (browser) can drop in without touching this file.
// See src/lib/storage.ts for the backend-detection logic.
//
// Note: auth-token reads (`kairo_token`) intentionally still hit localStorage
// directly. That key is shared with api.ts, ChatWindow, MobileShell etc. —
// migrating it requires a separate sweep across those files.
import * as storage from './storage'

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

const STORAGE_PREFIX = 'kairo:twin:'
const MAX_EVENTS     = 800           // hard cap; oldest get pruned
const EVENT_TTL_MS   = 90 * 86_400_000
const ALPHA          = 0.28          // mastery EMA smoothing
const FORGET_LO      = 0.6           // retention threshold for forget_at
const OBS_TTL_HOURS  = 72

const MODALITY_BY_DEFAULT: Partial<Record<EventType, Modality>> = {
  quiz_answered:    'interactive',
  quiz_completed:   'interactive',
  lab_opened:       'visual',
  lab_explored:     'visual',
  flashcard_review: 'repetition',
  essay_graded:     'text',
  note_created:     'text',
  concept_viewed:   'visual',
}

// ════════════════════════════════════════════════════════════════════════════
// STORAGE
// ════════════════════════════════════════════════════════════════════════════

function getUserKey(): string {
  // Derive a stable per-user key without leaking the raw Supabase id.
  // Falls back to a shared '_local' key for unauthenticated dev sessions.
  try {
    const tok = localStorage.getItem('kairo_token')
    if (tok) {
      const payload = JSON.parse(atob(tok.split('.')[1]))
      if (payload?.sub) return shortHash(String(payload.sub))
    }
  } catch { /* ignore */ }
  return '_local'
}

function storageKey(): string {
  return STORAGE_PREFIX + getUserKey()
}

function emptyState(): TwinState {
  return {
    version:         3,
    userKey:         getUserKey(),
    events:          [],
    mastery:         [],
    twin:            null,
    observations:    [],
    recommendations: [],
    doubts:          [],
    concepts:        [],
    formulas:        [],
    flashcards:      [],
  }
}

export function loadState(): TwinState {
  if (typeof window === 'undefined') return emptyState()
  try {
    const raw = storage.getRaw(storageKey())
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as any
    // Migration: bump v2 (twin-only) → v3 (twin + domain arrays).
    // We KEEP v2 events/mastery/twin so users don't lose their model.
    if (parsed.version === 2) {
      return {
        ...emptyState(),
        events:          parsed.events          ?? [],
        mastery:         parsed.mastery         ?? [],
        twin:            parsed.twin            ?? null,
        observations:    parsed.observations    ?? [],
        recommendations: parsed.recommendations ?? [],
      }
    }
    if (parsed.version !== 3) return emptyState()
    // Defensive: ensure all domain arrays exist on every load
    return {
      ...emptyState(),
      ...parsed,
      doubts:     parsed.doubts     ?? [],
      concepts:   parsed.concepts   ?? [],
      formulas:   parsed.formulas   ?? [],
      flashcards: parsed.flashcards ?? [],
    }
  } catch {
    return emptyState()
  }
}

function saveState(state: TwinState) {
  if (typeof window === 'undefined') return
  try {
    // Soft-prune events: keep last MAX_EVENTS, drop anything older than EVENT_TTL_MS
    const now = Date.now()
    state.events = state.events
      .filter(e => now - e.ts < EVENT_TTL_MS)
      .slice(-MAX_EVENTS)
    storage.setRaw(storageKey(), JSON.stringify(state))
    // Fire-and-forget debounced cloud sync. Defined later in this file; safe
    // because hoisting means the function exists by the time saveState runs.
    try { scheduleSyncToCloud?.() } catch { /* ignore */ }
  } catch (e) {
    // Quota exceeded — last-ditch attempt: keep only the most recent 200 events
    try {
      state.events = state.events.slice(-200)
      storage.setRaw(storageKey(), JSON.stringify(state))
      try { scheduleSyncToCloud?.() } catch { /* ignore */ }
    } catch { /* give up silently — user is offline-only and storage-full */ }
  }
}

/** Erase everything for the current user. UI's "Wipe my Twin" button. */
export function clearTwin() {
  if (typeof window === 'undefined') return
  storage.removeRaw(storageKey())
}

/**
 * Reset to fresh state — wipes EVERY Kyno-owned localStorage key, not
 * just the current twin bucket. Used by the Settings "Reset to fresh
 * state" button so a demo run can return to a clean slate without
 * logging out and back in.
 *
 * Preserves auth (`kairo_token`) and user-visible terms acceptance so
 * the user doesn't get bounced back to the login screen.
 */
export function resetAllData() {
  if (typeof window === 'undefined') return
  const PRESERVE = new Set([
    'kairo_token',
    'kairo:terms-accepted',
    'kairo:onboarded',
  ])
  const toRemove: string[] = []
  for (const k of storage.listKeys()) {
    if (!k) continue
    // Anything in our namespace OR the per-feature legacy keys
    if (
      (k.startsWith('kairo:') || k.startsWith('kairo_')) &&
      !PRESERVE.has(k)
    ) toRemove.push(k)
  }
  for (const k of toRemove) storage.removeRaw(k)
  // Notify any listeners (Kyno subscribes to `storage` events)
  try {
    window.dispatchEvent(new StorageEvent('storage', { key: storageKey() }))
  } catch { /* ignore */ }
}

// ════════════════════════════════════════════════════════════════════════════
// BACKUP & RESTORE — export to a JSON blob so the student can move their
// Twin between devices without any server involvement.
// ════════════════════════════════════════════════════════════════════════════

/** Wrapper shape that lets us version the export format independently of TwinState. */
export interface TwinBackup {
  schema:     'kairo-twin-backup-v1'
  exportedAt: string                 // ISO timestamp
  userKey:    string
  stats:      {
    events:     number
    doubts:     number
    concepts:   number
    formulas:   number
    flashcards: number
    mastery:    number
  }
  data:       TwinState
}

/** Snapshot the current twin to a pretty-printed JSON string. */
export function exportTwin(): string {
  const state = loadState()
  const payload: TwinBackup = {
    schema:     'kairo-twin-backup-v1',
    exportedAt: new Date().toISOString(),
    userKey:    state.userKey,
    stats: {
      events:     state.events.length,
      doubts:     state.doubts.length,
      concepts:   state.concepts.length,
      formulas:   state.formulas.length,
      flashcards: state.flashcards.length,
      mastery:    state.mastery.length,
    },
    data: state,
  }
  return JSON.stringify(payload, null, 2)
}

/** Suggested filename for the export. */
export function exportFilename(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `kairo-twin-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}

export type ImportMode = 'replace' | 'merge'

export interface ImportResult {
  ok:     boolean
  reason?: 'invalid-json' | 'wrong-schema' | 'no-data'
  stats?: TwinBackup['stats']
  mode?:  ImportMode
}

/**
 * Load a previously-exported JSON blob into the current device's localStorage.
 *
 * - replace: wipe whatever is here and use the imported state verbatim.
 *            The imported userKey is replaced with the current device's
 *            userKey so the data binds to the logged-in account here.
 * - merge:   keep existing data and add the imported events / doubts /
 *            concepts / formulas / flashcards on top, de-duped.
 *            Mastery rows are kept from the LOCAL device (mastery is a
 *            derived signal — re-computed on next refresh).
 */
export function importTwin(jsonText: string, mode: ImportMode = 'replace'): ImportResult {
  let parsed: any
  try { parsed = JSON.parse(jsonText) } catch { return { ok: false, reason: 'invalid-json' } }

  if (!parsed || parsed.schema !== 'kairo-twin-backup-v1' || !parsed.data) {
    return { ok: false, reason: 'wrong-schema' }
  }
  const incoming = parsed.data as TwinState
  if (!Array.isArray(incoming.events)) return { ok: false, reason: 'no-data' }

  const localKey = getUserKey()

  if (mode === 'replace') {
    const next: TwinState = {
      ...emptyState(),
      ...incoming,
      userKey:    localKey,                          // bind to local account
      doubts:     incoming.doubts     ?? [],
      concepts:   incoming.concepts   ?? [],
      formulas:   incoming.formulas   ?? [],
      flashcards: incoming.flashcards ?? [],
    }
    saveState(next)
  } else {
    // Merge — combine arrays, de-dupe by id (or ts+type for events)
    const current = loadState()
    const next: TwinState = {
      ...current,
      events:     dedupeBy([...current.events,     ...(incoming.events     ?? [])], e => `${e.ts}|${e.type}|${e.topic ?? ''}`),
      doubts:     dedupeBy([...current.doubts,     ...(incoming.doubts     ?? [])], d => d.id),
      concepts:   dedupeBy([...current.concepts,   ...(incoming.concepts   ?? [])], c => c.id),
      formulas:   dedupeBy([...current.formulas,   ...(incoming.formulas   ?? [])], f => f.id),
      flashcards: dedupeBy([...current.flashcards, ...(incoming.flashcards ?? [])], f => f.id),
      userKey:    localKey,
    }
    saveState(next)
  }

  return {
    ok:    true,
    mode,
    stats: parsed.stats ?? {
      events:     incoming.events.length,
      doubts:     (incoming.doubts ?? []).length,
      concepts:   (incoming.concepts ?? []).length,
      formulas:   (incoming.formulas ?? []).length,
      flashcards: (incoming.flashcards ?? []).length,
      mastery:    (incoming.mastery ?? []).length,
    },
  }
}

function dedupeBy<T>(arr: T[], keyFn: (x: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const x of arr) {
    const k = keyFn(x)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(x)
  }
  return out
}

// ════════════════════════════════════════════════════════════════════════════
// CLOUD SYNC — auto-mirror the twin to /api/twin/snapshot so it follows the
// student across devices.
//
//   - The cloud is a MIRROR, not the source of truth. Local storage stays
//     authoritative on each device. We just push/pull the rolling snapshot.
//   - Upload is debounced (5s after last change) so we batch chatty events.
//   - Pull happens once on app boot if local is empty and a cloud snapshot
//     exists. Subsequent edits then push back up.
// ════════════════════════════════════════════════════════════════════════════

const SYNC_DEBOUNCE_MS = 5_000
let   syncTimer: number | null = null
let   syncEnabled: boolean      = true
let   syncPausedUntil: number   = 0     // epoch ms; scheduled pushes before this are no-ops
let   onSyncEvent: ((kind: 'pulling' | 'pulled' | 'pushed' | 'idle' | 'error', detail?: any) => void) | null = null

/** Skip the next debounced push until `untilEpochMs`. Used right after a pull
 *  so the device that just received data doesn't immediately re-upload the
 *  exact same payload (or worse, an empty state if hydration is mid-flight). */
export function pauseSyncUntil(untilEpochMs: number) {
  syncPausedUntil = Math.max(syncPausedUntil, untilEpochMs)
}

/** Subscribe to sync lifecycle events (one observer at a time — the App shell). */
export function onSync(handler: typeof onSyncEvent) {
  onSyncEvent = handler
}

function emitSync(kind: 'pulling' | 'pulled' | 'pushed' | 'idle' | 'error', detail?: any) {
  try { onSyncEvent?.(kind, detail) } catch { /* ignore observer errors */ }
}

/** Manually pause / resume sync. The UI keeps a toggle in Settings. */
export function setSyncEnabled(on: boolean) {
  syncEnabled = on
  try { storage.setRaw('kairo:sync:enabled', on ? '1' : '0') } catch { /* ignore */ }
  if (on) scheduleSyncToCloud()
}
export function getSyncEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = storage.getRaw('kairo:sync:enabled')
    // Default ON — cross-device sync works out of the box. The cloud
    // snapshot is ephemeral (wiped right after a pull) so privacy impact
    // is minimal. Users can still opt out from Settings.
    if (raw === null) return true
    return raw === '1'
  } catch { return false }
}

function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  const m  =
    /iPhone|iPad/.test(ua)  ? 'iOS'      :
    /Android/.test(ua)       ? 'Android'  :
    /Macintosh/.test(ua)     ? 'Mac'      :
    /Windows/.test(ua)       ? 'Windows'  :
    /Linux/.test(ua)         ? 'Linux'    : 'web'
  return `${m} · ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
}

/** Schedule a debounced upload to the cloud. Safe to call on every save. */
export function scheduleSyncToCloud() {
  if (typeof window === 'undefined') return
  if (!syncEnabled) return
  if (syncTimer) window.clearTimeout(syncTimer)
  syncTimer = window.setTimeout(() => {
    if (Date.now() < syncPausedUntil) return    // honor the post-pull pause
    syncToCloudNow().catch(() => {})
  }, SYNC_DEBOUNCE_MS)
}

/** Force an immediate upload. Used on logout / manual "sync now". */
export async function syncToCloudNow(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof window === 'undefined') return { ok: false, reason: 'no-window' }
  // We only sync when the user is signed in (api.ts attaches the bearer).
  const token = localStorage.getItem('kairo_token')
  if (!token) return { ok: false, reason: 'not-signed-in' }
  try {
    const { post } = await import('./api')
    const state    = loadState()
    await post('/twin/snapshot', {
      blob:         state,
      deviceLabel:  deviceLabel(),
      eventsCount:  state.events.length,
    })
    emitSync('pushed', { events: state.events.length, at: Date.now() })
    return { ok: true }
  } catch (e: any) {
    const reason = String(e?.message || e || 'unknown')
    emitSync('error', { phase: 'push', reason })
    return { ok: false, reason }
  }
}

/**
 * Wipe the cloud copy of the snapshot.
 *
 * Called right after a successful pull on a new device — once the data has
 * landed in this device's localStorage, the cloud copy serves no purpose
 * and is deleted so it doesn't linger on the server. The next debounced
 * push (5 s after activity here) re-creates a fresh row.
 */
export async function deleteCloudSnapshot(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof window === 'undefined') return { ok: false, reason: 'no-window' }
  const token = localStorage.getItem('kairo_token')
  if (!token) return { ok: false, reason: 'not-signed-in' }
  try {
    const { del } = await import('./api')
    await del('/twin/snapshot')
    return { ok: true }
  } catch (e: any) {
    const reason = String(e?.message || e || 'unknown')
    // Soft-fail — cloud might not have a row yet, that's fine
    return { ok: false, reason }
  }
}

/**
 * Pull the latest snapshot from the cloud and hydrate localStorage.
 * Used on app boot when local is empty (first time on this device).
 *
 * Returns { ok, restored: boolean, stats? }. `restored: false` means
 * either no snapshot exists yet OR the local state was already populated
 * and we deliberately didn't clobber it.
 */
export async function pullFromCloud(opts: { force?: boolean } = {}): Promise<{
  ok:        boolean
  restored:  boolean
  reason?:   string
  stats?:    { events: number; doubts: number; concepts: number; formulas: number; flashcards: number; mastery: number }
}> {
  if (typeof window === 'undefined') return { ok: false, restored: false, reason: 'no-window' }
  const token = localStorage.getItem('kairo_token')
  if (!token) return { ok: false, restored: false, reason: 'not-signed-in' }

  // Don't pull if local already has data, unless force is set.
  if (!opts.force) {
    const current = loadState()
    if (current.events.length > 0 || current.flashcards.length > 0 || current.doubts.length > 0) {
      return { ok: true, restored: false, reason: 'local-not-empty' }
    }
  }

  emitSync('pulling')
  try {
    const { get } = await import('./api')
    const r = await get('/twin/snapshot') as { snapshot: any | null }
    const snap = r?.snapshot
    if (!snap || !snap.blob) {
      emitSync('idle')
      return { ok: true, restored: false, reason: 'no-cloud-snapshot' }
    }

    const incoming = snap.blob as TwinState
    const localKey = getUserKey()
    const next: TwinState = {
      ...emptyState(),
      ...incoming,
      userKey:    localKey,
      doubts:     incoming.doubts     ?? [],
      concepts:   incoming.concepts   ?? [],
      formulas:   incoming.formulas   ?? [],
      flashcards: incoming.flashcards ?? [],
    }
    saveState(next)
    const stats = {
      events:     next.events.length,
      doubts:     next.doubts.length,
      concepts:   next.concepts.length,
      formulas:   next.formulas.length,
      flashcards: next.flashcards.length,
      mastery:    next.mastery.length,
    }
    emitSync('pulled', stats)
    return { ok: true, restored: true, stats }
  } catch (e: any) {
    const reason = String(e?.message || e || 'unknown')
    emitSync('error', { phase: 'pull', reason })
    return { ok: false, restored: false, reason }
  }
}

// Initialise enabled flag from localStorage at module load.
if (typeof window !== 'undefined') {
  syncEnabled = getSyncEnabled()
}

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

export function normalizeTopic(s: string | undefined | null): string | undefined {
  if (!s) return undefined
  return s.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').slice(0, 80)
}

function clamp01(x: number)    { return Math.max(0, Math.min(1, x)) }
function avg(arr: number[])    { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0 }
function shortHash(s: string): string {
  // 32-bit FNV-1a, base36 — short, stable, no crypto needed.
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return ((h >>> 0).toString(36)).padStart(7, '0')
}
function uid()                  { return Math.random().toString(36).slice(2, 10) }

/** Hours until retention drops below FORGET_LO given strength S. */
function forgetHours(strength: number): number {
  return Math.max(1, strength * 24 * 0.511)         // -S * ln(0.6) ≈ S * 0.511
}

/** Current retention 0..1 for a mastery row. */
export function retentionFor(row: MasteryRow, atMs = Date.now()): number {
  if (!row.lastStudiedAt || !row.strength) return 0
  const hours = (atMs - row.lastStudiedAt) / 3600_000
  return Math.max(0, Math.exp(-hours / Math.max(0.5, row.strength)))
}

// ════════════════════════════════════════════════════════════════════════════
// EVENT INGESTION
// ════════════════════════════════════════════════════════════════════════════

interface TrackArgs {
  type:       EventType
  subject?:   string
  topic?:     string
  score?:     number
  correct?:   boolean
  durationMs?: number
  modality?:  Modality
  payload?:   Record<string, any>
  difficulty?: number              // 0..1 (used for mastery update)
}

/**
 * The single public entry point. Drop this into any code path where the
 * student does something Kyno should "see".
 *
 *   track({ type: 'lab_opened',  subject: 'Biology', topic: 'cell' })
 *   track({ type: 'quiz_answered', subject: 'Math', topic: 'vectors', correct: true, score: 90, difficulty: 0.7 })
 *
 * Returns the updated TwinState. UI components can use the returned snapshot
 * to refresh in-memory state without a re-load from disk.
 */
export function track(args: TrackArgs): TwinState {
  const state = loadState()

  const event: TwinEvent = {
    ts:         Date.now(),
    type:       args.type,
    subject:    args.subject,
    topic:      normalizeTopic(args.topic),
    score:      typeof args.score   === 'number' ? args.score   : undefined,
    correct:    typeof args.correct === 'boolean' ? args.correct : undefined,
    durationMs: args.durationMs,
    modality:   args.modality || MODALITY_BY_DEFAULT[args.type],
    payload:    args.payload,
  }

  state.events.push(event)

  // If the event carries a learning signal, update topic mastery.
  if (event.topic && (typeof event.correct === 'boolean' || typeof event.score === 'number')) {
    applyToMastery(state, {
      subject:    event.subject || 'General',
      topic:      event.topic,
      correct:    event.correct,
      score:      event.score,
      difficulty: args.difficulty ?? 0.5,
    })
  }

  // SQLITE PROTOCOL — PHASE III · mirror this event into the relational
  // `events` table so new SQL-backed pages can query indexed history. Fire
  // and forget — the kv blob is still authoritative if SQLite isn't around.
  storage.mirrorEvent(getUserKey(), event)

  // Recompute eagerly — it's cheap.
  recompute(state)
  saveState(state)
  return state
}

/**
 * Seed a small set of realistic backdated events so a fresh account
 * has something to look at on Kyno. Used by both the desktop and
 * mobile empty-state "Try with demo data" buttons.
 *
 * Why here instead of in each page component?
 *   - twin.ts owns the storage key derivation; reading/writing localStorage
 *     directly from page code is brittle (the desktop version had a parallel
 *     copy of the FNV-1a hash inline — easy to drift out of sync).
 *   - mobile EmptyState had no button at all, so users on phones were
 *     stuck on a blank dashboard after signing in to a fresh account.
 *
 * Idempotent: safe to call multiple times — each call appends another
 * batch of events, which still reads as "lots of activity".
 */
export function seedDemo(): TwinState {
  const demo: Array<TrackArgs & { _daysAgo?: number }> = [
    { type: 'lab_opened',       subject: 'Biology',   topic: 'cell',                                                _daysAgo: 9 },
    { type: 'quiz_answered',    subject: 'Math',      topic: 'quadratic equations', correct: false, score: 40, difficulty: 0.6, _daysAgo: 8 },
    { type: 'quiz_answered',    subject: 'Math',      topic: 'quadratic equations', correct: true,  score: 70, difficulty: 0.6, _daysAgo: 8 },
    { type: 'flashcard_review', subject: 'Chemistry', topic: 'periodic table',      correct: true,                _daysAgo: 7 },
    { type: 'lab_opened',       subject: 'Space',     topic: 'solar system',                                       _daysAgo: 6 },
    { type: 'quiz_answered',    subject: 'Physics',   topic: 'newton laws',         correct: true,  score: 80, difficulty: 0.5, _daysAgo: 5 },
    { type: 'quiz_answered',    subject: 'Physics',   topic: 'newton laws',         correct: true,  score: 90, difficulty: 0.5, _daysAgo: 5 },
    { type: 'essay_graded',     subject: 'English',   topic: 'persuasive essay',                                   _daysAgo: 4 },
    { type: 'lab_opened',       subject: 'Biology',   topic: 'dna',                                                _daysAgo: 3 },
    { type: 'quiz_answered',    subject: 'Math',      topic: 'vectors',             correct: false, score: 30, difficulty: 0.7, _daysAgo: 2 },
    { type: 'quiz_answered',    subject: 'Math',      topic: 'vectors',             correct: false, score: 50, difficulty: 0.7, _daysAgo: 2 },
    { type: 'flashcard_review', subject: 'Chemistry', topic: 'periodic table',      correct: true,                _daysAgo: 1 },
    { type: 'lab_opened',       subject: 'Biology',   topic: 'heart',                                              _daysAgo: 1 },
    { type: 'quiz_completed',   subject: 'Math',      topic: 'quadratic equations', score: 75,                    _daysAgo: 0 },
  ]

  let state: TwinState | null = null
  for (const d of demo) {
    const { _daysAgo, ...args } = d
    state = track(args as TrackArgs)
    // Backdate the just-pushed event. We use storageKey() (the same
    // function track() uses) so the read + write here can't drift to
    // a different bucket. Previous page-level copies inlined the hash
    // and silently lost the backdate when the hash drifted.
    if (_daysAgo && state) {
      const lastEv = state.events[state.events.length - 1]
      if (lastEv) {
        lastEv.ts = Date.now() - _daysAgo * 86_400_000
        try {
          storage.setRaw(storageKey(), JSON.stringify(state))
        } catch { /* quota / private mode — ignore */ }
      }
    }
  }
  // ── Flashcards (~30 across subjects, CBSE Class 10 flavour) ─────────
  // recordFlashcard saves into state.flashcards. Mix of subjects + topics
  // so the Flashcards page reads as a real student's deck.
  const flashcards: Array<{ front: string; back: string; subject: string; topic: string }> = [
    // Math
    { front: 'Quadratic formula',                      back: 'x = (-b ± √(b² - 4ac)) / 2a',                                 subject: 'Math', topic: 'quadratic equations' },
    { front: 'Discriminant condition for real roots',  back: 'b² - 4ac ≥ 0',                                                 subject: 'Math', topic: 'quadratic equations' },
    { front: 'sin²θ + cos²θ',                          back: '= 1',                                                          subject: 'Math', topic: 'trigonometry' },
    { front: 'tan θ in terms of sin and cos',          back: 'sin θ / cos θ',                                                subject: 'Math', topic: 'trigonometry' },
    { front: 'Area of triangle (Heron’s formula)',     back: '√(s(s-a)(s-b)(s-c)), where s = (a+b+c)/2',                     subject: 'Math', topic: 'mensuration' },
    { front: 'Sum of first n natural numbers',         back: 'n(n+1)/2',                                                     subject: 'Math', topic: 'arithmetic progressions' },
    { front: 'nth term of an AP',                      back: 'a + (n-1)d',                                                   subject: 'Math', topic: 'arithmetic progressions' },
    { front: 'Probability of an event',                back: 'No. of favourable outcomes / Total outcomes',                  subject: 'Math', topic: 'probability' },
    // Physics
    { front: 'Newton’s second law',                    back: 'F = ma',                                                       subject: 'Physics', topic: 'newton laws' },
    { front: 'Ohm’s law',                              back: 'V = IR',                                                       subject: 'Physics', topic: 'electricity' },
    { front: 'Power formula (electricity)',            back: 'P = VI = I²R = V²/R',                                          subject: 'Physics', topic: 'electricity' },
    { front: 'Speed of light in vacuum',               back: '3 × 10⁸ m/s',                                                  subject: 'Physics', topic: 'light' },
    { front: 'Refractive index',                       back: 'n = c / v   (speed of light in vacuum / in medium)',           subject: 'Physics', topic: 'light' },
    { front: 'Lens formula',                           back: '1/v - 1/u = 1/f',                                              subject: 'Physics', topic: 'light' },
    { front: 'Kinetic energy',                         back: 'KE = ½ m v²',                                                  subject: 'Physics', topic: 'energy' },
    { front: 'Work-energy theorem',                    back: 'W_net = ΔKE',                                                  subject: 'Physics', topic: 'energy' },
    // Chemistry
    { front: 'Atomic number',                          back: 'Number of protons in the nucleus',                             subject: 'Chemistry', topic: 'periodic table' },
    { front: 'Group → property trend',                 back: 'Metallic character increases down a group',                    subject: 'Chemistry', topic: 'periodic table' },
    { front: 'pH of pure water at 25°C',               back: '7 (neutral)',                                                  subject: 'Chemistry', topic: 'acids and bases' },
    { front: 'Allotropes of carbon',                   back: 'Diamond, graphite, fullerene, graphene',                       subject: 'Chemistry', topic: 'carbon and its compounds' },
    { front: 'Functional group: –COOH',                back: 'Carboxylic acid',                                              subject: 'Chemistry', topic: 'carbon and its compounds' },
    { front: 'Saponification',                         back: 'Ester + NaOH → soap + alcohol',                                subject: 'Chemistry', topic: 'carbon and its compounds' },
    // Biology
    { front: 'Powerhouse of the cell',                 back: 'Mitochondria',                                                 subject: 'Biology', topic: 'cell' },
    { front: 'Photosynthesis equation',                back: '6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂  (in light, chlorophyll)',         subject: 'Biology', topic: 'life processes' },
    { front: 'Respiration in muscles during exercise', back: 'Anaerobic — glucose → lactic acid + 2 ATP',                    subject: 'Biology', topic: 'life processes' },
    { front: 'DNA full form',                          back: 'Deoxyribonucleic acid',                                        subject: 'Biology', topic: 'dna' },
    { front: 'Chambers of the human heart',            back: '4 — 2 atria + 2 ventricles',                                   subject: 'Biology', topic: 'heart' },
    // English / Social
    { front: 'Simile vs metaphor',                     back: 'Simile uses "like/as"; metaphor states A is B directly.',      subject: 'English', topic: 'figures of speech' },
    { front: 'Year of Indian independence',            back: '1947',                                                         subject: 'History', topic: 'nationalism in india' },
    { front: 'Author of the Indian Constitution',      back: 'Dr. B. R. Ambedkar (chairman, drafting committee)',            subject: 'Civics', topic: 'indian constitution' },
  ]
  for (const f of flashcards) {
    try { recordFlashcard({ ...f, source: 'manual' }) } catch { /* ignore */ }
  }

  // ── Mistakes (2-3 logged — feeds Mistake Analysis) ──────────────────
  try {
    recordMistake({ subject: 'Math',    topic: 'vectors',            detail: 'Mixed up dot product and cross product directions.',                difficulty: 0.7 })
    recordMistake({ subject: 'Physics', topic: 'light',              detail: 'Used 1/u + 1/v = 1/f instead of the lens formula 1/v - 1/u = 1/f.', difficulty: 0.6 })
    recordMistake({ subject: 'Chemistry', topic: 'periodic table',   detail: 'Confused groups and periods on a question about reactivity trends.', difficulty: 0.5 })
  } catch { /* ignore */ }

  // ── Concepts (~12 nodes with cross-subject links — feeds Concept
  //    Map + Knowledge Graph) ──────────────────────────────────────────
  try {
    recordConcept({ name: 'newton laws',          subject: 'Physics',   related: ['energy', 'kinematics'] })
    recordConcept({ name: 'energy',               subject: 'Physics',   related: ['newton laws', 'work'] })
    recordConcept({ name: 'light',                subject: 'Physics',   related: ['refraction', 'lens formula'] })
    recordConcept({ name: 'lens formula',         subject: 'Physics',   related: ['light'] })
    recordConcept({ name: 'electricity',          subject: 'Physics',   related: ['ohm law'] })
    recordConcept({ name: 'quadratic equations',  subject: 'Math',      related: ['discriminant', 'roots'] })
    recordConcept({ name: 'trigonometry',         subject: 'Math',      related: ['pythagoras', 'identities'] })
    recordConcept({ name: 'arithmetic progressions', subject: 'Math',   related: ['sequences', 'sum formula'] })
    recordConcept({ name: 'periodic table',       subject: 'Chemistry', related: ['atomic number', 'groups'] })
    recordConcept({ name: 'carbon and its compounds', subject: 'Chemistry', related: ['functional groups', 'allotropes'] })
    recordConcept({ name: 'life processes',       subject: 'Biology',   related: ['photosynthesis', 'respiration'] })
    recordConcept({ name: 'dna',                  subject: 'Biology',   related: ['cell', 'heredity'] })
  } catch { /* ignore */ }

  // ── A few formulas pinned (feeds Formula Sheet's "collected" tab) ──
  try {
    recordFormula({ name: 'Newton’s 2nd law', expr: '$F = ma$',                                 subject: 'Physics',   topic: 'newton laws',           source: 'manual' })
    recordFormula({ name: 'Ohm’s law',        expr: '$V = IR$',                                 subject: 'Physics',   topic: 'electricity',           source: 'manual' })
    recordFormula({ name: 'Lens formula',     expr: '$\\frac{1}{v} - \\frac{1}{u} = \\frac{1}{f}$', subject: 'Physics', topic: 'light',                source: 'manual' })
    recordFormula({ name: 'Quadratic roots',  expr: '$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$',  subject: 'Math',    topic: 'quadratic equations',  source: 'manual' })
    recordFormula({ name: 'Photosynthesis',   expr: '$6CO_2 + 6H_2O \\rightarrow C_6H_{12}O_6 + 6O_2$', subject: 'Biology', topic: 'photosynthesis',   source: 'manual' })
  } catch { /* ignore */ }

  // Final recompute against the backdated timeline so the dashboard
  // reads as days of activity rather than a 14-event spike at t=now.
  state = loadState()
  recompute(state)
  saveState(state)
  return state
}

// ════════════════════════════════════════════════════════════════════════════
// MASTERY UPDATE (Ebbinghaus + EMA)
// ════════════════════════════════════════════════════════════════════════════

function applyToMastery(state: TwinState, args: {
  subject: string; topic: string; correct?: boolean; score?: number; difficulty: number
}) {
  const now = Date.now()
  const idx = state.mastery.findIndex(m => m.subject === args.subject && m.topic === args.topic)
  const existing = idx >= 0 ? state.mastery[idx] : null

  // Correctness signal 0..1
  let signal: number | null
  if (typeof args.correct === 'boolean') signal = args.correct ? 1 : 0
  else if (typeof args.score === 'number') signal = clamp01(args.score / 100)
  else signal = null

  let mastery   = existing?.mastery   ?? 0.4
  let strength  = existing?.strength  ?? 1.0
  let attempts  = (existing?.attempts ?? 0) + (signal != null ? 1 : 0)
  let correct   = (existing?.correct  ?? 0) + (signal != null && signal >= 0.5 ? 1 : 0)

  if (signal != null) {
    const weighted = signal * (0.6 + 0.4 * args.difficulty)
    mastery = (1 - ALPHA) * mastery + ALPHA * weighted
    if (signal >= 0.5) strength = Math.min(strength * (1.6 + 1.2 * args.difficulty), 90)
    else               strength = Math.max(strength * 0.5, 0.25)
  }

  const row: MasteryRow = {
    subject:        args.subject,
    topic:          args.topic,
    mastery:        +mastery.toFixed(4),
    attempts,
    correct,
    lastStudiedAt:  now,
    lastCorrectAt:  signal != null && signal >= 0.5 ? now : (existing?.lastCorrectAt ?? null),
    forgetAt:       now + forgetHours(strength) * 3600_000,
    strength:       +strength.toFixed(4),
    difficultyPref: existing?.difficultyPref ?? 0.5,
  }
  if (idx >= 0) state.mastery[idx] = row
  else          state.mastery.push(row)
}

// ════════════════════════════════════════════════════════════════════════════
// COMPUTE — derive the twin from raw events + mastery
// ════════════════════════════════════════════════════════════════════════════

function slope(ys: number[]): number {
  if (ys.length < 2) return 0
  const n  = ys.length
  const sx = (n - 1) * n / 2
  const sy = ys.reduce((a, b) => a + b, 0)
  const sxy = ys.reduce((acc, y, i) => acc + i * y, 0)
  const sxx = ys.reduce((acc, _, i) => acc + i * i, 0)
  const denom = n * sxx - sx * sx
  return denom === 0 ? 0 : (n * sxy - sx * sy) / denom
}

function computeLearningStyle(events: TwinEvent[]) {
  const buckets: Record<Modality, number> = { visual: 0, text: 0, interactive: 0, repetition: 0 }
  for (const e of events) {
    if (!e.modality) continue
    const w = 1 + Math.log1p((e.durationMs || 5000) / 60_000)
    buckets[e.modality] += w
  }
  const total = Object.values(buckets).reduce((a, b) => a + b, 0) || 1
  return {
    styleVisual:      +(buckets.visual      / total).toFixed(3),
    styleText:        +(buckets.text        / total).toFixed(3),
    styleInteractive: +(buckets.interactive / total).toFixed(3),
    styleRepetition:  +(buckets.repetition  / total).toFixed(3),
  }
}

function computePace(events: TwinEvent[]): Twin['pace'] {
  if (events.length < 5) return 'steady'
  const now = Date.now()
  const counts = new Array(14).fill(0)
  for (const e of events) {
    const day = Math.floor((now - e.ts) / 86_400_000)
    if (day >= 0 && day < 14) counts[day] += 1
  }
  const m   = avg(counts)
  const sd  = Math.sqrt(avg(counts.map(c => (c - m) ** 2)))
  if (m > 8 && sd < m * 0.6) return 'fast'
  if (sd > m * 1.2)          return 'inconsistent'
  if (m < 2)                  return 'slow'
  return 'steady'
}

function computeFocus(events: TwinEvent[]) {
  const byHour: Record<number, number[]> = {}
  for (const e of events) {
    if (typeof e.score !== 'number') continue
    const h = new Date(e.ts).getHours()
    if (!byHour[h]) byHour[h] = []
    byHour[h].push(e.score)
  }
  let bestHour: number | null = null, bestAvg = -1
  for (const [h, scores] of Object.entries(byHour)) {
    if (scores.length < 3) continue
    const a = avg(scores)
    if (a > bestAvg) { bestAvg = a; bestHour = Number(h) }
  }

  // Crude session inference: contiguous events with gaps < 10 min
  const sorted = [...events].sort((a, b) => a.ts - b.ts)
  const sessionLengths: number[] = []
  let sessionStart = sorted[0]?.ts ?? 0
  let lastTs       = sessionStart
  for (const e of sorted) {
    if (e.ts - lastTs > 10 * 60_000) {
      sessionLengths.push((lastTs - sessionStart) / 60_000)
      sessionStart = e.ts
    }
    lastTs = e.ts
  }
  if (sorted.length) sessionLengths.push((lastTs - sessionStart) / 60_000)
  const validLengths = sessionLengths.filter(l => l > 0.5)

  return {
    focusBestHour:     bestHour,
    focusAvgMinutes:   validLengths.length ? +avg(validLengths).toFixed(1) : null,
    focusDropoffAfter: null as number | null,
  }
}

function computeRetention(mastery: MasteryRow[]) {
  if (!mastery.length) return 0.5
  let num = 0, den = 0
  for (const m of mastery) {
    const r = retentionFor(m)
    const w = 0.2 + 0.8 * m.mastery
    num += r * w
    den += w
  }
  return clamp01(num / Math.max(0.001, den))
}

function computeConsistency(events: TwinEvent[]) {
  if (!events.length) return 0
  const now = Date.now()
  const days = new Set<number>()
  for (const e of events) {
    const d = Math.floor((now - e.ts) / 86_400_000)
    if (d >= 0 && d < 14) days.add(d)
  }
  return days.size / 14
}

function computeBurnout(events: TwinEvent[], perfTrend: number) {
  const now = Date.now()
  const recent = events.filter(e => now - e.ts < 7 * 86_400_000)
  const base   = events.filter(e => now - e.ts < 30 * 86_400_000)
  if (base.length < 12) return 0
  const recentMin = recent.reduce((a, e) => a + (e.durationMs || 0), 0) / 7 / 60_000
  const baseMin   = base.reduce  ((a, e) => a + (e.durationMs || 0), 0) / 30 / 60_000
  const overload  = baseMin > 0 && recentMin > baseMin * 1.4 ? (recentMin / baseMin - 1) : 0
  const stagn     = perfTrend < 0 ? -perfTrend : 0
  return clamp01(0.6 * overload + 0.4 * stagn)
}

function computePerformanceTrend(events: TwinEvent[]) {
  const scored = events
    .filter(e => typeof e.score === 'number')
    .sort((a, b) => a.ts - b.ts)
    .map(e => e.score!)
  if (scored.length < 4) return 0
  const s = slope(scored)
  return clamp01(Math.abs(s) / 3) * (s >= 0 ? 1 : -1)
}

function computeConfidence(mastery: MasteryRow[], events: TwinEvent[]) {
  if (!mastery.length && !events.length) return 0.5
  const masteredCount = mastery.filter(m => m.mastery >= 0.7).length
  const masteryFactor = clamp01(masteredCount / 10)
  const correctSig    = events.filter(e => typeof e.correct === 'boolean')
  const accFactor     = correctSig.length
    ? correctSig.filter(e => e.correct).length / correctSig.length
    : 0.5
  return clamp01(0.45 * masteryFactor + 0.55 * accFactor)
}

function computeStreak(events: TwinEvent[]) {
  if (!events.length) return 0
  const today = new Date(); today.setHours(0,0,0,0)
  const dayKey = (ms: number) => { const x = new Date(ms); x.setHours(0,0,0,0); return x.getTime() }
  const days = new Set(events.map(e => dayKey(e.ts)))
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const target = today.getTime() - i * 86_400_000
    if (days.has(target)) streak++
    else if (i > 0) break
  }
  return streak
}

function topTopics(mastery: MasteryRow[], { weak, max }: { weak: boolean; max: number }): WeakTopic[] {
  const sorted = [...mastery].sort((a, b) => weak ? a.mastery - b.mastery : b.mastery - a.mastery)
  return sorted.slice(0, max).map(m => ({
    subject:        m.subject,
    topic:          m.topic,
    mastery:        m.mastery,
    attempts:       m.attempts,
    severity:       weak ? +(1 - m.mastery).toFixed(2) : 0,
    lastStudiedAt:  m.lastStudiedAt,
  }))
}

function forgettingSoon(mastery: MasteryRow[], max = 8): ForgetTopic[] {
  const now = Date.now()
  return [...mastery]
    .filter(m => m.forgetAt && m.forgetAt < now + 7 * 86_400_000)
    .sort((a, b) => a.forgetAt - b.forgetAt)
    .slice(0, max)
    .map(m => ({
      subject:           m.subject,
      topic:             m.topic,
      hoursUntilForget:  Math.max(0, +((m.forgetAt - now) / 3600_000).toFixed(1)),
      mastery:           m.mastery,
    }))
}

// ════════════════════════════════════════════════════════════════════════════
// OBSERVATIONS — rule-based supportive insights
// ════════════════════════════════════════════════════════════════════════════

// Pick "a" or "an" based on the first sound of the next word.
// Naive but covers every word we actually use ('interactive' → 'an',
// 'visual' / 'text' / 'repetition' → 'a').
function aOrAn(word: string) {
  return /^[aeiouAEIOU]/.test(word) ? 'an' : 'a'
}

function buildObservations(twin: Twin, mastery: MasteryRow[], events: TwinEvent[]): Omit<Observation, 'id' | 'createdAt' | 'expiresAt'>[] {
  const out: Omit<Observation, 'id' | 'createdAt' | 'expiresAt'>[] = []

  const styleEntries: Array<['visual' | 'interactive' | 'text' | 'repetition', number, string]> = [
    ['visual',      twin.styleVisual,      'You learn better when you can SEE the concept.'],
    ['interactive', twin.styleInteractive, 'You retain more when you DO something with the concept.'],
    ['text',        twin.styleText,        'You absorb concepts better from reading + reflection.'],
    ['repetition',  twin.styleRepetition,  'You lock concepts in via spaced flashcard review.'],
  ]
  styleEntries.sort((a, b) => b[1] - a[1])
  const [topId, topScore, topHint] = styleEntries[0]
  if (topScore > 0.42) {
    out.push({ kind: 'insight', tone: 'supportive', title: `You're ${aOrAn(topId)} ${topId} learner`, body: topHint, importance: 0.6 })
  }

  if (twin.focusBestHour != null) {
    const h = twin.focusBestHour
    const window = h < 6 ? 'late night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night'
    out.push({
      kind: 'pattern', tone: 'neutral',
      title: `You score highest around ${h}:00`,
      body:  `Your ${window} sessions consistently outperform other times. Block ${h}:00–${(h + 1) % 24}:00 for hard topics.`,
      importance: 0.5,
    })
  }

  if (twin.performanceTrend > 0.18) {
    out.push({
      kind: 'celebration', tone: 'supportive',
      title: 'Your scores are trending up',
      body:  "Recent results show consistent improvement. Keep the cadence — don't change what's working.",
      importance: 0.7,
    })
  } else if (twin.performanceTrend < -0.18) {
    out.push({
      kind: 'concern', tone: 'caution',
      title: 'Scores are dipping',
      body:  "One bad week isn't the pattern — but pick the weakest topic below and put 25 minutes into it tonight.",
      importance: 0.75,
    })
  }

  if (twin.burnoutRisk > 0.55) {
    out.push({
      kind: 'concern', tone: 'caution',
      title: 'Sustainable pace > maximum pace',
      body:  "Your study minutes spiked recently but scores aren't following. Sleep and 20-min walks are part of learning.",
      importance: 0.85,
    })
  }

  if ([3, 7, 14, 30, 60, 100].includes(twin.streakDays)) {
    out.push({
      kind: 'milestone', tone: 'supportive',
      title: `${twin.streakDays}-day streak 🔥`,
      body:  `Showing up every day is the hardest part. You've nailed it for ${twin.streakDays} days running.`,
      importance: 0.8,
    })
  }

  const newlyStrong = mastery.find(m => m.mastery >= 0.75 && m.attempts >= 5)
  if (newlyStrong) {
    out.push({
      kind: 'celebration', tone: 'supportive',
      title: `You've got ${newlyStrong.topic}`,
      body:  `Mastery is ${(newlyStrong.mastery * 100).toFixed(0)}% across ${newlyStrong.attempts} attempts. Consider it locked in.`,
      topic: newlyStrong.topic,
      importance: 0.65,
    })
  }

  for (const w of twin.weakTopics.filter(w => w.severity > 0.55).slice(0, 2)) {
    out.push({
      kind: 'pattern', tone: 'neutral',
      title: `"${w.topic}" needs attention`,
      body:  `Mastery is ${Math.round((1 - w.severity) * 100)}%. A different angle (lab / video / flashcards) often unblocks this.`,
      topic: w.topic,
      importance: 0.55,
    })
  }

  if (twin.consistencyScore >= 0.65) {
    out.push({
      kind: 'pattern', tone: 'supportive',
      title: 'Highly consistent',
      body:  `You've shown up ${Math.round(twin.consistencyScore * 14)} of the last 14 days. Consistency beats intensity.`,
      importance: 0.5,
    })
  } else if (twin.consistencyScore < 0.25 && events.length > 0) {
    out.push({
      kind: 'pattern', tone: 'neutral',
      title: 'Sporadic schedule',
      body:  "Your study days are scattered. Pick three fixed half-hour slots this week — cheapest performance gain you can make.",
      importance: 0.55,
    })
  }

  return out
}

// ════════════════════════════════════════════════════════════════════════════
// RECOMMENDATIONS
// ════════════════════════════════════════════════════════════════════════════

const LAB_CATALOG: Array<{ id: string; title: string; subject: string; modality: Modality; topics: string[] }> = [
  { id: 'gravity',    title: 'Gravity & Free Fall',  subject: 'Physics',   modality: 'visual',      topics: ['gravity', 'free fall', 'newton', 'motion'] },
  { id: 'pendulum',   title: 'Pendulum Motion',      subject: 'Physics',   modality: 'visual',      topics: ['pendulum', 'oscillation', 'shm', 'period'] },
  { id: 'projectile', title: 'Projectile Motion',    subject: 'Physics',   modality: 'visual',      topics: ['projectile', 'parabola', 'kinematics', 'motion'] },
  { id: 'circuits',   title: 'Electric Circuits',    subject: 'Physics',   modality: 'interactive', topics: ['ohm', 'circuit', 'current', 'voltage', 'resistance'] },
  { id: 'atom',       title: 'Atomic Structure',     subject: 'Chemistry', modality: 'visual',      topics: ['atom', 'electron', 'bohr', 'orbital', 'shell'] },
  { id: 'molecule',   title: 'Molecule Builder',     subject: 'Chemistry', modality: 'interactive', topics: ['molecule', 'bond', 'geometry', 'covalent', 'water'] },
  { id: 'reaction',   title: 'Chemical Reactions',   subject: 'Chemistry', modality: 'visual',      topics: ['reaction', 'combustion', 'methane', 'balance'] },
  { id: 'heart',      title: 'Human Heart',          subject: 'Biology',   modality: 'visual',      topics: ['heart', 'circulation', 'blood', 'chamber'] },
  { id: 'cell',       title: 'Cell Structure',       subject: 'Biology',   modality: 'visual',      topics: ['cell', 'organelle', 'nucleus', 'mitochondria'] },
  { id: 'dna',        title: 'DNA Double Helix',     subject: 'Biology',   modality: 'visual',      topics: ['dna', 'genetics', 'base pair', 'helix'] },
  { id: 'brain',      title: 'Human Brain',          subject: 'Biology',   modality: 'visual',      topics: ['brain', 'cerebrum', 'cerebellum', 'lobe', 'nervous'] },
  { id: 'vectors',    title: 'Vectors in 3D',        subject: 'Math',      modality: 'interactive', topics: ['vector', 'dot product', 'cross product', '3d'] },
  { id: 'graphs',     title: 'Function Plotter',     subject: 'Math',      modality: 'visual',      topics: ['function', 'graph', 'calculus', 'derivative'] },
  { id: 'solar',      title: 'Solar System',         subject: 'Space',     modality: 'visual',      topics: ['planet', 'sun', 'orbit', 'astronomy', 'moon', 'iss'] },
  { id: 'saturnv',    title: 'Saturn V Rocket',      subject: 'Space',     modality: 'visual',      topics: ['rocket', 'apollo', 'saturn v', 'launch', 'stage'] },
]

function dominantStyle(t: Twin): Modality {
  const entries: Array<[Modality, number]> = [
    ['visual',      t.styleVisual],
    ['interactive', t.styleInteractive],
    ['text',        t.styleText],
    ['repetition',  t.styleRepetition],
  ]
  entries.sort((a, b) => b[1] - a[1])
  return entries[0][0]
}

function matchLab(topic: string, subject: string | undefined, style: Modality) {
  const t = topic.toLowerCase()
  const candidates = LAB_CATALOG.filter(l => {
    if (subject && l.subject.toLowerCase() !== subject.toLowerCase()) return false
    return l.topics.some(k => t.includes(k) || k.includes(t))
  })
  if (!candidates.length) return null
  candidates.sort((a, b) => (a.modality === style ? 0 : 1) - (b.modality === style ? 0 : 1))
  return candidates[0]
}

function buildRecommendations(twin: Twin): Omit<Recommendation, 'id' | 'createdAt'>[] {
  const out: Omit<Recommendation, 'id' | 'createdAt'>[] = []
  const style = dominantStyle(twin)

  for (const f of twin.forgettingSoon.slice(0, 4)) {
    const urgency = clamp01(1 - f.hoursUntilForget / 168)
    const lab = matchLab(f.topic, f.subject, style)
    out.push({
      kind:     'revise',
      subject:  f.subject,
      target:   f.topic,
      reason:   `You haven't touched ${f.topic} recently — likely fading from memory.`,
      priority: 0.65 + 0.3 * urgency,
      metadata: { hoursUntilForget: f.hoursUntilForget, suggestedLab: lab?.id || null },
    })
  }

  for (const w of twin.weakTopics.slice(0, 3)) {
    const lab = matchLab(w.topic, w.subject, style)
    if (lab) {
      out.push({
        kind:     'lab',
        subject:  w.subject,
        target:   lab.id,
        reason:   `${lab.title} matches how you learn best — try it on "${w.topic}".`,
        priority: 0.55 + 0.4 * (w.severity || 0.5),
        metadata: { topic: w.topic, labId: lab.id, modality: lab.modality, style },
      })
    } else {
      out.push({
        kind:     'flashcard',
        subject:  w.subject,
        target:   w.topic,
        reason:   `Build up "${w.topic}" with a 5-minute flashcard run.`,
        priority: 0.45 + 0.4 * (w.severity || 0.5),
        metadata: { topic: w.topic, severity: w.severity },
      })
    }
  }

  if (twin.performanceTrend > 0.15 && twin.strongTopics.length) {
    const t = twin.strongTopics[0]
    out.push({
      kind:     'quiz',
      subject:  t.subject,
      target:   t.topic,
      reason:   `You've been doing well in ${t.topic} — lock it in with a quick 5-question quiz.`,
      priority: 0.55,
      metadata: { topic: t.topic },
    })
  }

  if (twin.burnoutRisk > 0.55) {
    out.push({
      kind:     'break',
      reason:   "Your study volume jumped 40%+ this week without a matching score lift. Take a 20-min walk.",
      priority: 0.7,
      metadata: { burnoutRisk: twin.burnoutRisk },
    })
  }

  if (twin.lastActiveAt) {
    const hoursAgo = (Date.now() - twin.lastActiveAt) / 3600_000
    if (hoursAgo > 14 && hoursAgo < 60) {
      out.push({
        kind:     'plan',
        reason:   `You haven't logged a session in ~${Math.round(hoursAgo)}h. Pick one topic for today and start small.`,
        priority: 0.5,
        metadata: { hoursIdle: hoursAgo },
      })
    }
  }

  out.sort((a, b) => b.priority - a.priority)
  return out.slice(0, 10)
}

// ════════════════════════════════════════════════════════════════════════════
// MASTER COMPUTE
// ════════════════════════════════════════════════════════════════════════════

/**
 * Recompute the twin in place. Mutates state.twin / observations / recommendations.
 * Called after every event AND when the dashboard opens.
 */
export function recompute(state: TwinState) {
  const now    = Date.now()
  const since  = now - 60 * 86_400_000
  const events = state.events.filter(e => e.ts > since)

  const style       = computeLearningStyle(events)
  const pace        = computePace(events)
  const focus       = computeFocus(events)
  const retention   = computeRetention(state.mastery)
  const consistency = computeConsistency(events)
  const perfTrend   = computePerformanceTrend(events)
  const burnout     = computeBurnout(events, perfTrend)
  const confidence  = computeConfidence(state.mastery, events)
  const weak        = topTopics(state.mastery, { weak: true,  max: 6 })
  const strong      = topTopics(state.mastery, { weak: false, max: 5 })
  const forgetSoon  = forgettingSoon(state.mastery, 8)
  const streak      = computeStreak(events)

  const recentScored = events
    .filter(e => typeof e.score === 'number')
    .slice(0, 20)
    .map(e => e.score!)
  const avgRecent = recentScored.length ? avg(recentScored) : null
  const predExam  = avgRecent != null
    ? Math.round(clamp01((avgRecent / 100) + perfTrend * 0.15) * 100)
    : null
  const predBand = predExam == null ? null
    : predExam >= 90 ? 'A+' : predExam >= 80 ? 'A' : predExam >= 70 ? 'B+'
    : predExam >= 60 ? 'B'  : predExam >= 50 ? 'C' : predExam >= 40 ? 'D' : 'F'

  state.twin = {
    computedAt:         now,
    ...style,
    pace,
    ...focus,
    retentionScore:     +retention.toFixed(3),
    consistencyScore:   +consistency.toFixed(3),
    burnoutRisk:        +burnout.toFixed(3),
    confidence:         +confidence.toFixed(3),
    performanceTrend:   +perfTrend.toFixed(3),
    predictedExamScore: predExam,
    predictedBand:      predBand,
    streakDays:         streak,
    lastActiveAt:       events[events.length - 1]?.ts ?? null,
    weakTopics:         weak,
    strongTopics:       strong,
    forgettingSoon:     forgetSoon,
  }

  // Observations — REPLACE every recompute.
  //
  // We used to merge stillFresh (within 72h TTL) with newly-computed obs and
  // dedup by title — but mutually exclusive obs (e.g. "Scores are dipping"
  // vs "Your scores are trending up") have DIFFERENT titles, so the cache
  // would surface both simultaneously after a trend flip. Always rebuilding
  // from current state guarantees the dashboard reflects what's true NOW.
  //
  // Milestone obs (e.g. "7-day streak") still get regenerated next time the
  // condition holds — and they're tone-supportive so re-seeing them is fine.
  const ttlMs = OBS_TTL_HOURS * 3600_000
  state.observations = buildObservations(state.twin, state.mastery, events).map(o => ({
    ...o,
    id:        uid(),
    createdAt: now,
    expiresAt: now + ttlMs,
  })).slice(0, 16)

  // Recommendations — replace each time (recompute is cheap and they expire fast)
  state.recommendations = buildRecommendations(state.twin).map(r => ({
    ...r,
    id:        uid(),
    createdAt: now,
  }))
}

// ════════════════════════════════════════════════════════════════════════════
// PUBLIC READ API — used by the dashboard
// ════════════════════════════════════════════════════════════════════════════

export interface DashboardSnapshot {
  twin:            Twin | null
  mastery:         (MasteryRow & { retentionNow: number })[]
  observations:    Observation[]
  recommendations: Recommendation[]
  recentEvents:    TwinEvent[]
  hasData:         boolean
}

export function getDashboard(): DashboardSnapshot {
  const state = loadState()
  // Always recompute on read to catch any stale rows + auto-expire observations.
  recompute(state)
  saveState(state)

  return {
    twin:            state.twin,
    mastery:         state.mastery.map(m => ({ ...m, retentionNow: +retentionFor(m).toFixed(3) })),
    observations:    state.observations,
    recommendations: state.recommendations,
    recentEvents:    state.events.slice(-30).reverse(),
    hasData:         state.events.length > 0,
  }
}

/** Force a fresh compute (e.g. "Recompute Twin" button). */
export function refresh(): DashboardSnapshot {
  return getDashboard()
}

/** Dismiss a recommendation (just removes it from local state). */
export function dismissRecommendation(id: string) {
  const state = loadState()
  state.recommendations = state.recommendations.filter(r => r.id !== id)
  saveState(state)
}

/** "Mark done" — same as dismiss, but we record an act-on-recommendation event. */
export function actOnRecommendation(id: string) {
  const state = loadState()
  const rec   = state.recommendations.find(r => r.id === id)
  state.recommendations = state.recommendations.filter(r => r.id !== id)
  if (rec) {
    state.events.push({
      ts:   Date.now(),
      type: 'mastery_up',
      subject: rec.subject,
      topic:   rec.target,
      payload: { from: 'recommendation', kind: rec.kind },
    })
  }
  saveState(state)
}

/** Quick global track function — call from any page on any interaction. */
export const kairoTrack = track

// For dev / inspector tools — expose the raw state so the user can see exactly
// what's in their device. Privacy by visibility.
export function dumpState(): TwinState {
  return loadState()
}

// ════════════════════════════════════════════════════════════════════════════
// UNIFIED MEMORY API — every other Kyno system reads/writes through here
// ════════════════════════════════════════════════════════════════════════════
//
// The Twin's `events` array captures behavioural signal (correctness, timing,
// modality). These domain APIs sit on top for the human-readable surface:
//   - recordDoubt:     question + answer text from Solver
//   - recordMistake:   typed mistake with context (auto-feeds Mistake Analysis)
//   - recordConcept:   conceptual node + edges (auto-feeds Concept Map)
//   - recordFormula:   collected equation (auto-feeds Formula Sheet)
//   - recordFlashcard: SRS card (auto-feeds Flashcards page)
//
// Each `record*` ALSO calls track() internally so the Twin's existing model
// (mastery, retention, style) keeps evolving without duplicate code.

// ── DOUBTS (Solver history) ─────────────────────────────────────────────────
export function recordDoubt(args: {
  question:  string
  answer?:   string
  topic?:    string
  subject?:  string
  source?:   Doubt['source']
}): Doubt {
  const state = loadState()
  const doubt: Doubt = {
    id:        uid(),
    ts:        Date.now(),
    question:  args.question,
    answer:    args.answer,
    topic:     normalizeTopic(args.topic),
    subject:   args.subject,
    source:    args.source || 'solver',
  }
  state.doubts.unshift(doubt)
  state.doubts = state.doubts.slice(0, 200)     // cap at 200 most-recent
  saveState(state)

  // Also feed the twin
  track({
    type: 'concept_viewed',
    subject: args.subject,
    topic:   args.topic,
    modality: args.source === 'voice' ? 'repetition' : 'text',   // 'repetition' = audio-like in Twin model
    payload: { doubtId: doubt.id, question: args.question.slice(0, 120) },
  })
  return doubt
}

export function listDoubts(limit = 50): Doubt[] {
  return loadState().doubts.slice(0, limit)
}

// ── MISTAKES (subset of events where correct=false) ─────────────────────────
export interface MistakeRow {
  topic:      string
  subject:    string
  count:      number             // total wrong attempts on this topic
  lastAt:     number
  recentScores: number[]         // for context
  severity:   number             // 0..1 — higher = more attention needed
  events:     TwinEvent[]        // full underlying wrong-answer events
}

export function getMistakes(): MistakeRow[] {
  const state = loadState()
  // Group wrong events by topic.
  const byTopic = new Map<string, TwinEvent[]>()
  for (const e of state.events) {
    const isWrong = e.correct === false || (typeof e.score === 'number' && e.score < 40)
    if (!isWrong || !e.topic) continue
    const k = `${e.subject || 'General'}:${e.topic}`
    if (!byTopic.has(k)) byTopic.set(k, [])
    byTopic.get(k)!.push(e)
  }
  const rows: MistakeRow[] = []
  for (const [k, evs] of byTopic.entries()) {
    const [subject, topic] = k.split(':')
    const lastAt = Math.max(...evs.map(e => e.ts))
    const recentScores = evs
      .filter(e => typeof e.score === 'number')
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 5)
      .map(e => e.score!)
    // Severity grows with count + recency; decays with recent right answers
    const mastery = state.mastery.find(m => m.subject === subject && m.topic === topic)
    const baseMastery = mastery?.mastery ?? 0.3
    const severity = Math.max(0, Math.min(1, (evs.length / 8) * (1 - baseMastery)))
    rows.push({ topic, subject, count: evs.length, lastAt, recentScores, severity, events: evs })
  }
  return rows.sort((a, b) => b.severity - a.severity)
}

/** Record an explicit mistake. Used by Mistake Analysis "Add manually". */
export function recordMistake(args: {
  topic:    string
  subject?: string
  detail?:  string
  difficulty?: number
}) {
  track({
    type: 'mistake',
    subject: args.subject || 'General',
    topic: args.topic,
    correct: false,
    score: 0,
    difficulty: args.difficulty ?? 0.5,
    payload: { detail: args.detail || null, manual: true },
  })
}

// ── CONCEPTS (graph nodes auto-built from history) ──────────────────────────
export function recordConcept(args: {
  name:      string
  subject?:  string
  related?:  string[]
}): Concept {
  const state = loadState()
  const id = 'c-' + normalizeTopic(args.name)?.replace(/\s+/g, '-')
  const existing = state.concepts.find(c => c.id === id)
  if (existing) {
    existing.visits++
    existing.reinforcedAt = Date.now()
    if (args.related) {
      const merged = new Set([...existing.related, ...args.related.map(r => 'c-' + normalizeTopic(r)?.replace(/\s+/g, '-'))])
      existing.related = [...merged].filter(Boolean) as string[]
    }
    saveState(state)
    return existing
  }
  const concept: Concept = {
    id:           id!,
    name:         normalizeTopic(args.name)!,
    subject:      args.subject,
    related:      (args.related || []).map(r => 'c-' + normalizeTopic(r)?.replace(/\s+/g, '-')).filter(Boolean) as string[],
    encounteredAt: Date.now(),
    reinforcedAt:  Date.now(),
    visits:       1,
    mastery:      0.3,
  }
  state.concepts.push(concept)
  saveState(state)
  return concept
}

/** Build a concept graph from BOTH explicit concepts AND twin events.
 *  Every topic that appears in events becomes a node; topics in the same
 *  subject+session are linked. Returns nodes + edges ready for visualization. */
export function getConceptGraph(): { nodes: ConceptNode[]; edges: ConceptEdge[] } {
  const state = loadState()
  const nodes = new Map<string, ConceptNode>()

  // Seed nodes from explicit concepts
  for (const c of state.concepts) {
    nodes.set(c.id, {
      id:       c.id,
      name:     c.name,
      subject:  c.subject || 'General',
      visits:   c.visits,
      mastery:  c.mastery,
      lastSeen: c.reinforcedAt,
    })
  }
  // Add nodes from events (auto-discovery)
  for (const e of state.events) {
    if (!e.topic) continue
    const id = 'c-' + e.topic.replace(/\s+/g, '-')
    if (!nodes.has(id)) {
      const mastery = state.mastery.find(m => m.subject === e.subject && m.topic === e.topic)
      nodes.set(id, {
        id, name: e.topic,
        subject: e.subject || 'General',
        visits: 1, mastery: mastery?.mastery ?? 0.3,
        lastSeen: e.ts,
      })
    } else {
      const n = nodes.get(id)!
      n.visits++
      if (e.ts > n.lastSeen) n.lastSeen = e.ts
    }
  }

  // Edges: topics that co-occur within the same 30-min window get linked
  const edges = new Set<string>()
  const eventsByTime = [...state.events].filter(e => e.topic).sort((a, b) => a.ts - b.ts)
  for (let i = 0; i < eventsByTime.length; i++) {
    for (let j = i + 1; j < eventsByTime.length; j++) {
      const a = eventsByTime[i], b = eventsByTime[j]
      if (b.ts - a.ts > 30 * 60_000) break
      if (a.topic === b.topic) continue
      const ka = 'c-' + a.topic!.replace(/\s+/g, '-')
      const kb = 'c-' + b.topic!.replace(/\s+/g, '-')
      const edge = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
      edges.add(edge)
    }
  }
  // Add explicit related edges
  for (const c of state.concepts) {
    for (const r of c.related) {
      const edge = c.id < r ? `${c.id}|${r}` : `${r}|${c.id}`
      edges.add(edge)
    }
  }

  return {
    nodes: [...nodes.values()],
    edges: [...edges].map(e => {
      const [from, to] = e.split('|')
      return { from, to }
    }),
  }
}

export interface ConceptNode {
  id:        string
  name:      string
  subject:   string
  visits:    number
  mastery:   number
  lastSeen:  number
}
export interface ConceptEdge { from: string; to: string }

// ── FORMULAS ────────────────────────────────────────────────────────────────
export function recordFormula(args: { name: string; expr: string; subject?: string; topic?: string; source?: Formula['source'] }): Formula {
  const state = loadState()
  const f: Formula = {
    id: uid(), ts: Date.now(),
    name: args.name, expr: args.expr,
    subject: args.subject, topic: normalizeTopic(args.topic),
    source: args.source || 'solver',
  }
  state.formulas.unshift(f)
  state.formulas = state.formulas.slice(0, 200)
  saveState(state)
  return f
}

export function listFormulas(subject?: string): Formula[] {
  const all = loadState().formulas
  return subject ? all.filter(f => f.subject === subject) : all
}

// ── FLASHCARDS ──────────────────────────────────────────────────────────────
export function recordFlashcard(args: { front: string; back: string; subject?: string; topic?: string; source?: Flashcard['source'] }): Flashcard {
  const state = loadState()
  const c: Flashcard = {
    id: uid(), ts: Date.now(),
    front: args.front, back: args.back,
    subject: args.subject, topic: normalizeTopic(args.topic),
    reviews: 0, ease: 2.5,
    dueAt: Date.now(),
    source: args.source || 'manual',
  }
  state.flashcards.unshift(c)
  saveState(state)
  return c
}

export function listFlashcards(): Flashcard[]   { return loadState().flashcards }
export function listConcepts():  Concept[]      { return loadState().concepts  }

// ── STUDY HISTORY (unified timeline for Knowledge Graph etc.) ──────────────
export interface HistoryEntry {
  ts:       number
  kind:     'event' | 'doubt' | 'concept' | 'formula' | 'flashcard'
  title:    string
  subject?: string
  topic?:   string
  meta?:    Record<string, any>
}

export function getStudyHistory(limit = 100): HistoryEntry[] {
  const s = loadState()
  const items: HistoryEntry[] = []
  for (const e of s.events) {
    items.push({
      ts: e.ts, kind: 'event',
      title: labelEvent(e),
      subject: e.subject, topic: e.topic,
      meta: { score: e.score, correct: e.correct },
    })
  }
  for (const d of s.doubts)     items.push({ ts: d.ts, kind: 'doubt',     title: d.question, subject: d.subject, topic: d.topic })
  for (const c of s.concepts)   items.push({ ts: c.reinforcedAt, kind: 'concept', title: c.name, subject: c.subject })
  for (const f of s.formulas)   items.push({ ts: f.ts, kind: 'formula',   title: f.name,     subject: f.subject, topic: f.topic })
  for (const fc of s.flashcards) items.push({ ts: fc.ts, kind: 'flashcard', title: fc.front, subject: fc.subject, topic: fc.topic })
  items.sort((a, b) => b.ts - a.ts)
  return items.slice(0, limit)
}

function labelEvent(e: TwinEvent): string {
  const verb = e.type.replace(/_/g, ' ')
  if (e.topic) return `${verb}: ${e.topic}`
  return verb
}
