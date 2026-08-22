

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
  ts:         number
  type:       EventType
  subject?:   string
  topic?:     string
  score?:     number
  correct?:   boolean
  durationMs?: number
  modality?:  Modality
  payload?:   Record<string, any>
}

export interface MasteryRow {
  subject:         string
  topic:           string
  mastery:         number
  attempts:        number
  correct:         number
  lastStudiedAt:   number
  lastCorrectAt:   number | null
  forgetAt:        number
  strength:        number
  difficultyPref:  number
}

export interface WeakTopic   { subject: string; topic: string; mastery: number; severity: number; attempts: number; lastStudiedAt: number | null }
export interface ForgetTopic { subject: string; topic: string; hoursUntilForget: number; mastery: number; overdue?: boolean; label?: string }

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
  importance:  number
  createdAt:   number
  expiresAt:   number
}

export interface Recommendation {
  id:         string
  kind:       'revise' | 'lab' | 'flashcard' | 'quiz' | 'break' | 'plan'
  target?:    string
  subject?:   string
  reason:     string
  priority:   number
  metadata?:  Record<string, any>
  createdAt:  number
}

export interface Doubt {
  id:        string
  ts:        number
  question:  string
  answer?:   string
  topic?:    string
  subject?:  string
  source:    'solver' | 'manual' | 'voice'
}

export interface Concept {
  id:        string
  name:      string
  subject?:  string
  related:   string[]
  encounteredAt: number
  reinforcedAt:  number
  visits:    number
  mastery:   number
}

export interface Formula {
  id:        string
  ts:        number
  name:      string
  expr:      string
  subject?:  string
  topic?:    string
  source:    'solver' | 'manual' | 'lab'
  /** Rearrangements of the same relation — R=V/I under V=IR — kept nested
   *  rather than saved as separate cards. */
  variants?: string[]
}

export interface Flashcard {
  id:        string
  ts:        number
  front:     string
  back:      string
  subject?:  string
  topic?:    string
  reviews:   number
  ease:      number
  dueAt:     number
  source:    'manual' | 'auto-from-doubt' | 'auto-from-mistake' | 'starter'
}

export interface KynoProfile {
  name?:        string
  nickname?:    string
  mode?:        'personal' | 'school'
  school?:      string
  cls?:         string
  section?:     string
  board?:       string
  studyStyles?: string[]
  bestTime?:    string
  goal?:        string
  strong?:      string[]
  weak?:        string[]
  hobbies?:     string[]
  dailyHours?:  string
  onboardedAt?: number
}

export interface TwinState {
  version:        3
  userKey:        string
  profile:        KynoProfile | null
  events:         TwinEvent[]
  mastery:        MasteryRow[]
  twin:           Twin | null
  observations:   Observation[]
  recommendations: Recommendation[]
  doubts:         Doubt[]
  concepts:       Concept[]
  formulas:       Formula[]
  flashcards:     Flashcard[]
}

import * as storage from './storage'
import { exportGameState, importGameState } from './game'
// Shared arithmetic — see selectors.core.js. Imported here so the twin cannot
// disagree with Home about a number they both display.
import { selectStreak, selectPrediction, selectWeakTopics, selectStrongTopics } from './selectors.core.js'
// Phase 2: nothing reaches the graph without passing through these.
import { canonicalTopic, classifyChatTurn, isSameFormula, findRecentDuplicate } from './knowledgeHygiene.js'
import { revisionQueue } from './srs.js'
import { cleanupLocalData, summarise } from './cleanupLocalData.js'

const STORAGE_PREFIX = 'kairo:twin:'
const MAX_EVENTS     = 800
const EVENT_TTL_MS   = 90 * 86_400_000
const ALPHA          = 0.28
const FORGET_LO      = 0.6
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

function getUserKey(): string {
  try {
    const tok = localStorage.getItem('kairo_token')
    if (tok) {
      const payload = JSON.parse(atob(tok.split('.')[1]))
      if (payload?.sub) return shortHash(String(payload.sub))
    }
  } catch {  }
  return '_local'
}

function storageKey(): string {
  return STORAGE_PREFIX + getUserKey()
}

function emptyState(): TwinState {
  return {
    version:         3,
    userKey:         getUserKey(),
    profile:         null,
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
    const now = Date.now()
    state.events = state.events
      .filter(e => now - e.ts < EVENT_TTL_MS)
      .slice(-MAX_EVENTS)
    storage.setRaw(storageKey(), JSON.stringify(state))
    try { scheduleSyncToCloud?.() } catch {  }
  } catch (e) {
    try {
      state.events = state.events.slice(-200)
      storage.setRaw(storageKey(), JSON.stringify(state))
      try { scheduleSyncToCloud?.() } catch {  }
    } catch {  }
  }
}

export function getProfile(): KynoProfile | null {
  return loadState().profile ?? null
}

export function isOnboarded(): boolean {
  return !!getProfile()?.onboardedAt
}

export function saveProfile(p: KynoProfile): void {
  const st = loadState()
  st.profile = { ...(st.profile || {}), ...p, onboardedAt: p.onboardedAt ?? Date.now() }
  saveState(st)
}

/**
 * Everything Kyno should "remember" about the student, in one object:
 * their onboarding profile + a live summary drawn from the twin
 * (topics they've studied recently, topics their mastery is weakest in).
 * Sent with every chat/solver request so the AI stays personal across sessions.
 */
export function getStudentMemory(): Record<string, unknown> {
  const st = loadState()
  const p = st.profile || {}
  let name: string | undefined = p.nickname || p.name
  if (!name && typeof localStorage !== 'undefined') {
    try {
      const kp = JSON.parse(localStorage.getItem('kairo_profile') || '{}')
      name = kp.nickname || kp.name || kp.full_name
    } catch {  }
  }
  const recentTopics = Array.from(new Set(
    (st.events || [])
      .filter(e => e && e.topic)
      .slice(-40)
      .map(e => e.topic as string),
  )).slice(-12)
  const weakTopics = (st.mastery || [])
    .filter(m => m && typeof m.mastery === 'number' && m.mastery < 0.5)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 8)
    .map(m => m.topic)
    .filter(Boolean)
  return {
    name,
    nickname:    p.nickname,
    cls:         p.cls,
    section:     p.section,
    board:       p.board,
    mode:        p.mode,
    school:      p.school,
    studyStyles: p.studyStyles,
    bestTime:    p.bestTime,
    goal:        p.goal,
    strong:      p.strong,
    weak:        p.weak,
    hobbies:     p.hobbies,
    dailyHours:  p.dailyHours,
    recentTopics,
    weakTopics,
  }
}

export function clearTwin() {
  if (typeof window === 'undefined') return
  storage.removeRaw(storageKey())
}

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
    if (
      (k.startsWith('kairo:') || k.startsWith('kairo_')) &&
      !PRESERVE.has(k)
    ) toRemove.push(k)
  }
  for (const k of toRemove) storage.removeRaw(k)
  try {
    window.dispatchEvent(new StorageEvent('storage', { key: storageKey() }))
  } catch {  }
}

export interface TwinBackup {
  schema:     'kairo-twin-backup-v1'
  exportedAt: string
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
  game?:      any   // XP / streak / lifetime snapshot (kairo:game:v1)
}

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
    game: exportGameState(),
  }
  return JSON.stringify(payload, null, 2)
}

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
      userKey:    localKey,
      doubts:     incoming.doubts     ?? [],
      concepts:   incoming.concepts   ?? [],
      formulas:   incoming.formulas   ?? [],
      flashcards: incoming.flashcards ?? [],
    }
    saveState(next)
  } else {
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

  // Carry XP / streak across devices too (older backups won't have this).
  if (parsed.game) { try { importGameState(parsed.game, mode) } catch {  } }

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

const SYNC_DEBOUNCE_MS = 45_000
let   syncTimer: number | null = null
let   syncEnabled: boolean      = true
let   syncPausedUntil: number   = 0
let   onSyncEvent: ((kind: 'pulling' | 'pulled' | 'pushed' | 'idle' | 'error', detail?: any) => void) | null = null

export function pauseSyncUntil(untilEpochMs: number) {
  syncPausedUntil = Math.max(syncPausedUntil, untilEpochMs)
}

export function onSync(handler: typeof onSyncEvent) {
  onSyncEvent = handler
}

function emitSync(kind: 'pulling' | 'pulled' | 'pushed' | 'idle' | 'error', detail?: any) {
  try { onSyncEvent?.(kind, detail) } catch {  }
}

export function setSyncEnabled(on: boolean) {
  syncEnabled = on
  try { storage.setRaw('kairo:sync:enabled', on ? '1' : '0') } catch {  }
  if (on) scheduleSyncToCloud()
}
export function getSyncEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = storage.getRaw('kairo:sync:enabled')
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

let flushBound = false
function bindSyncFlush() {
  if (flushBound || typeof window === 'undefined') return
  flushBound = true
  const flush = () => {
    if (!syncEnabled || syncTimer == null) return
    window.clearTimeout(syncTimer); syncTimer = null
    if (Date.now() >= syncPausedUntil) syncToCloudNow().catch(() => {})
  }
  window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
  window.addEventListener('pagehide', flush)
}

export function scheduleSyncToCloud() {
  if (typeof window === 'undefined') return
  bindSyncFlush()
  if (!syncEnabled) return
  if (syncTimer) window.clearTimeout(syncTimer)
  syncTimer = window.setTimeout(() => {
    if (Date.now() < syncPausedUntil) return
    syncToCloudNow().catch(() => {})
  }, SYNC_DEBOUNCE_MS)
}

export async function syncToCloudNow(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof window === 'undefined') return { ok: false, reason: 'no-window' }
  const token = localStorage.getItem('kairo_token')
  if (!token) return { ok: false, reason: 'not-signed-in' }
  try {
    const { post } = await import('./api')
    const state    = loadState()
    await post('/twin/snapshot', {
      // __game rides inside the blob so XP/streak sync without any server change.
      blob:         { ...state, __game: exportGameState() },
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
    return { ok: false, reason }
  }
}

export async function pullFromCloud(opts: { force?: boolean } = {}): Promise<{
  ok:        boolean
  restored:  boolean
  reason?:   string
  stats?:    { events: number; doubts: number; concepts: number; formulas: number; flashcards: number; mastery: number }
}> {
  if (typeof window === 'undefined') return { ok: false, restored: false, reason: 'no-window' }
  const token = localStorage.getItem('kairo_token')
  if (!token) return { ok: false, restored: false, reason: 'not-signed-in' }

  if (!opts.force) {
    const current = loadState()
    if (current.events.length > 0 || current.flashcards.length > 0 || current.doubts.length > 0 || current.profile) {
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

    const rawBlob  = snap.blob as TwinState & { __game?: any }
    const { __game, ...incoming } = rawBlob
    const localKey = getUserKey()
    const localProfile = loadState().profile
    const next: TwinState = {
      ...emptyState(),
      ...incoming,
      userKey:    localKey,
      profile:    incoming.profile ?? localProfile ?? null,
      doubts:     incoming.doubts     ?? [],
      concepts:   incoming.concepts   ?? [],
      formulas:   incoming.formulas   ?? [],
      flashcards: incoming.flashcards ?? [],
    }
    saveState(next)
    // Restore XP / streak that rode along inside the snapshot blob.
    if (__game) { try { importGameState(__game, 'replace') } catch {  } }
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

// Manual "Sync now": reconcile this device with the cloud in one shot.
// - Fresh/empty device  -> REPLACE (pull the full account, incl. mastery/profile).
// - Device with data     -> MERGE (union events/doubts/… + max XP; never loses local).
// Then push the result back up so the cloud always holds the latest union.
// The other devices do NOT need to be online — this reads the persisted cloud copy.
export async function reconcileWithCloud(): Promise<{ ok: boolean; restored: boolean; reason?: string }> {
  if (typeof window === 'undefined') return { ok: false, restored: false, reason: 'no-window' }
  const token = localStorage.getItem('kairo_token')
  if (!token) return { ok: false, restored: false, reason: 'not-signed-in' }

  emitSync('pulling')
  try {
    const { get } = await import('./api')
    const r    = await get('/twin/snapshot') as { snapshot: any | null; setup_required?: boolean }
    if (r?.setup_required) return { ok: false, restored: false, reason: 'cloud backup not set up on the server (twin_snapshots table missing)' }
    const snap = r?.snapshot

    let restored = false
    if (snap && snap.blob) {
      const current = loadState()
      const localEmpty =
        current.events.length === 0 &&
        current.flashcards.length === 0 &&
        current.doubts.length === 0 &&
        !current.profile
      const mode: ImportMode = localEmpty ? 'replace' : 'merge'

      const raw = snap.blob as TwinState & { __game?: any }
      const { __game, ...twin } = raw
      const wrapped = JSON.stringify({
        schema:     'kairo-twin-backup-v1',
        exportedAt: new Date().toISOString(),
        userKey:    getUserKey(),
        data:       { ...twin, userKey: getUserKey() },
        game:       __game,
      })
      const res = importTwin(wrapped, mode)
      restored = res.ok
      // Nudge every open page (Concept Map, Kyno OS, Home, …) to recompute.
      try { window.dispatchEvent(new StorageEvent('storage', { key: storageKey() })) } catch {  }
    }

    // Push the merged/local state up so the cloud stays fresh and available.
    // If the upload fails (missing table, auth, network), surface it — otherwise
    // devices silently never converge and nobody knows why.
    const push = await syncToCloudNow()
    if (!push.ok) {
      emitSync('error', { phase: 'push', reason: push.reason })
      return { ok: false, restored, reason: 'upload failed — ' + (push.reason || 'unknown') }
    }
    emitSync('pulled')
    return { ok: true, restored }
  } catch (e: any) {
    const reason = String(e?.message || e || 'unknown')
    emitSync('error', { phase: 'reconcile', reason })
    return { ok: false, restored: false, reason }
  }
}

export function hasLocalTwinData(): boolean {
  const s = loadState()
  return s.events.length > 0 || s.flashcards.length > 0 || s.doubts.length > 0 || !!s.profile
}

export interface CloudPeek {
  ok:      boolean
  found:   boolean
  reason?: string
  stats?:  { events: number; flashcards: number; doubts: number; formulas: number; concepts: number; mastery: number; xp: number }
  blob?:   any
}

// Read the cloud snapshot WITHOUT saving anything — so we can show the user a
// summary and let them approve the restore first (confirm-on-this-device).
export async function peekCloudSnapshot(): Promise<CloudPeek> {
  if (typeof window === 'undefined') return { ok: false, found: false, reason: 'no-window' }
  const token = localStorage.getItem('kairo_token')
  if (!token) return { ok: false, found: false, reason: 'not-signed-in' }
  try {
    const { get } = await import('./api')
    const r    = await get('/twin/snapshot') as { snapshot: any | null }
    const snap = r?.snapshot
    if (!snap || !snap.blob) return { ok: true, found: false }
    const blob = snap.blob as TwinState & { __game?: any }
    const g    = (blob.__game || {}) as { totalXP?: number }
    const len  = (a: any) => (Array.isArray(a) ? a.length : 0)
    return {
      ok: true, found: true, blob,
      stats: {
        events:     len(blob.events),
        flashcards: len(blob.flashcards),
        doubts:     len(blob.doubts),
        formulas:   len(blob.formulas),
        concepts:   len(blob.concepts),
        mastery:    len(blob.mastery),
        xp:         Number(g.totalXP || 0),
      },
    }
  } catch (e: any) {
    return { ok: false, found: false, reason: String(e?.message || e || 'unknown') }
  }
}

// Save a peeked snapshot onto this device — call this only AFTER the user approves.
// Reuses importTwin so XP (parsed.game) rides along and merge/replace stay correct.
export function applyCloudSnapshot(blob: any, mode: ImportMode = 'replace'): boolean {
  if (!blob || typeof blob !== 'object') return false
  try {
    const raw = blob as TwinState & { __game?: any }
    const { __game, ...twin } = raw
    const wrapped = JSON.stringify({
      schema:     'kairo-twin-backup-v1',
      exportedAt: new Date().toISOString(),
      userKey:    getUserKey(),
      data:       { ...twin, userKey: getUserKey() },
      game:       __game,
    })
    const res = importTwin(wrapped, mode)
    try { window.dispatchEvent(new StorageEvent('storage', { key: storageKey() })) } catch {  }
    return res.ok
  } catch { return false }
}

if (typeof window !== 'undefined') {
  syncEnabled = getSyncEnabled()
}

export function normalizeTopic(s: string | undefined | null): string | undefined {
  if (!s) return undefined
  return s.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').slice(0, 80)
}

function clamp01(x: number)    { return Math.max(0, Math.min(1, x)) }
function avg(arr: number[])    { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0 }
function shortHash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return ((h >>> 0).toString(36)).padStart(7, '0')
}
function uid()                  { return Math.random().toString(36).slice(2, 10) }

function forgetHours(strength: number): number {
  return Math.max(1, strength * 24 * 0.511)
}

export function retentionFor(row: MasteryRow, atMs = Date.now()): number {
  if (!row.lastStudiedAt || !row.strength) return 0
  const hours = (atMs - row.lastStudiedAt) / 3600_000
  return Math.max(0, Math.exp(-hours / Math.max(0.5, row.strength)))
}

interface TrackArgs {
  type:       EventType
  subject?:   string
  topic?:     string
  score?:     number
  correct?:   boolean
  durationMs?: number
  modality?:  Modality
  payload?:   Record<string, any>
  difficulty?: number
}

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

  if (event.topic && (typeof event.correct === 'boolean' || typeof event.score === 'number')) {
    applyToMastery(state, {
      subject:    event.subject || 'General',
      topic:      event.topic,
      correct:    event.correct,
      score:      event.score,
      difficulty: args.difficulty ?? 0.5,
    })
  }

  storage.mirrorEvent(getUserKey(), event)

  recompute(state)
  saveState(state)
  return state
}

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
    if (_daysAgo && state) {
      const lastEv = state.events[state.events.length - 1]
      if (lastEv) {
        lastEv.ts = Date.now() - _daysAgo * 86_400_000
        try {
          storage.setRaw(storageKey(), JSON.stringify(state))
        } catch {  }
      }
    }
  }
  const flashcards: Array<{ front: string; back: string; subject: string; topic: string }> = [
    { front: 'Quadratic formula',                      back: 'x = (-b ± √(b² - 4ac)) / 2a',                                 subject: 'Math', topic: 'quadratic equations' },
    { front: 'Discriminant condition for real roots',  back: 'b² - 4ac ≥ 0',                                                 subject: 'Math', topic: 'quadratic equations' },
    { front: 'sin²θ + cos²θ',                          back: '= 1',                                                          subject: 'Math', topic: 'trigonometry' },
    { front: 'tan θ in terms of sin and cos',          back: 'sin θ / cos θ',                                                subject: 'Math', topic: 'trigonometry' },
    { front: 'Area of triangle (Heron’s formula)',     back: '√(s(s-a)(s-b)(s-c)), where s = (a+b+c)/2',                     subject: 'Math', topic: 'mensuration' },
    { front: 'Sum of first n natural numbers',         back: 'n(n+1)/2',                                                     subject: 'Math', topic: 'arithmetic progressions' },
    { front: 'nth term of an AP',                      back: 'a + (n-1)d',                                                   subject: 'Math', topic: 'arithmetic progressions' },
    { front: 'Probability of an event',                back: 'No. of favourable outcomes / Total outcomes',                  subject: 'Math', topic: 'probability' },
    { front: 'Newton’s second law',                    back: 'F = ma',                                                       subject: 'Physics', topic: 'newton laws' },
    { front: 'Ohm’s law',                              back: 'V = IR',                                                       subject: 'Physics', topic: 'electricity' },
    { front: 'Power formula (electricity)',            back: 'P = VI = I²R = V²/R',                                          subject: 'Physics', topic: 'electricity' },
    { front: 'Speed of light in vacuum',               back: '3 × 10⁸ m/s',                                                  subject: 'Physics', topic: 'light' },
    { front: 'Refractive index',                       back: 'n = c / v   (speed of light in vacuum / in medium)',           subject: 'Physics', topic: 'light' },
    { front: 'Lens formula',                           back: '1/v - 1/u = 1/f',                                              subject: 'Physics', topic: 'light' },
    { front: 'Kinetic energy',                         back: 'KE = ½ m v²',                                                  subject: 'Physics', topic: 'energy' },
    { front: 'Work-energy theorem',                    back: 'W_net = ΔKE',                                                  subject: 'Physics', topic: 'energy' },
    { front: 'Atomic number',                          back: 'Number of protons in the nucleus',                             subject: 'Chemistry', topic: 'periodic table' },
    { front: 'Group → property trend',                 back: 'Metallic character increases down a group',                    subject: 'Chemistry', topic: 'periodic table' },
    { front: 'pH of pure water at 25°C',               back: '7 (neutral)',                                                  subject: 'Chemistry', topic: 'acids and bases' },
    { front: 'Allotropes of carbon',                   back: 'Diamond, graphite, fullerene, graphene',                       subject: 'Chemistry', topic: 'carbon and its compounds' },
    { front: 'Functional group: –COOH',                back: 'Carboxylic acid',                                              subject: 'Chemistry', topic: 'carbon and its compounds' },
    { front: 'Saponification',                         back: 'Ester + NaOH → soap + alcohol',                                subject: 'Chemistry', topic: 'carbon and its compounds' },
    { front: 'Powerhouse of the cell',                 back: 'Mitochondria',                                                 subject: 'Biology', topic: 'cell' },
    { front: 'Photosynthesis equation',                back: '6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂  (in light, chlorophyll)',         subject: 'Biology', topic: 'life processes' },
    { front: 'Respiration in muscles during exercise', back: 'Anaerobic — glucose → lactic acid + 2 ATP',                    subject: 'Biology', topic: 'life processes' },
    { front: 'DNA full form',                          back: 'Deoxyribonucleic acid',                                        subject: 'Biology', topic: 'dna' },
    { front: 'Chambers of the human heart',            back: '4 — 2 atria + 2 ventricles',                                   subject: 'Biology', topic: 'heart' },
    { front: 'Simile vs metaphor',                     back: 'Simile uses "like/as"; metaphor states A is B directly.',      subject: 'English', topic: 'figures of speech' },
    { front: 'Year of Indian independence',            back: '1947',                                                         subject: 'History', topic: 'nationalism in india' },
    { front: 'Author of the Indian Constitution',      back: 'Dr. B. R. Ambedkar (chairman, drafting committee)',            subject: 'Civics', topic: 'indian constitution' },
  ]
  for (const f of flashcards) {
    try { recordFlashcard({ ...f, source: 'manual' }) } catch {  }
  }

  try {
    recordMistake({ subject: 'Math',    topic: 'vectors',            detail: 'Mixed up dot product and cross product directions.',                difficulty: 0.7 })
    recordMistake({ subject: 'Physics', topic: 'light',              detail: 'Used 1/u + 1/v = 1/f instead of the lens formula 1/v - 1/u = 1/f.', difficulty: 0.6 })
    recordMistake({ subject: 'Chemistry', topic: 'periodic table',   detail: 'Confused groups and periods on a question about reactivity trends.', difficulty: 0.5 })
  } catch {  }

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
  } catch {  }

  try {
    recordFormula({ name: 'Newton’s 2nd law', expr: '$F = ma$',                                 subject: 'Physics',   topic: 'newton laws',           source: 'manual' })
    recordFormula({ name: 'Ohm’s law',        expr: '$V = IR$',                                 subject: 'Physics',   topic: 'electricity',           source: 'manual' })
    recordFormula({ name: 'Lens formula',     expr: '$\\frac{1}{v} - \\frac{1}{u} = \\frac{1}{f}$', subject: 'Physics', topic: 'light',                source: 'manual' })
    recordFormula({ name: 'Quadratic roots',  expr: '$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$',  subject: 'Math',    topic: 'quadratic equations',  source: 'manual' })
    recordFormula({ name: 'Photosynthesis',   expr: '$6CO_2 + 6H_2O \\rightarrow C_6H_{12}O_6 + 6O_2$', subject: 'Biology', topic: 'photosynthesis',   source: 'manual' })
  } catch {  }

  state = loadState()
  recompute(state)
  saveState(state)
  return state
}

function applyToMastery(state: TwinState, args: {
  subject: string; topic: string; correct?: boolean; score?: number; difficulty: number
}) {
  const now = Date.now()
  const idx = state.mastery.findIndex(m => m.subject === args.subject && m.topic === args.topic)
  const existing = idx >= 0 ? state.mastery[idx] : null

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

/**
 * Revise Soon.
 *
 * Two things were wrong. The window was 7 days against a ~12 hour horizon, so
 * every topic qualified and the panel told the student their whole syllabus was
 * slipping at once. And `Math.max(0, …)` clamped anything already past due to
 * zero, which is why every row read "forgetting in 0h" — including topics
 * answered correctly minutes earlier.
 *
 * Now: only what is genuinely due inside 48h, and overdue says overdue.
 */
function forgettingSoon(mastery: MasteryRow[], max = 5): ForgetTopic[] {
  const now = Date.now()
  return revisionQueue(mastery as unknown[], { now, withinHours: 48, max })
    .map((r: any) => ({
      subject:           r.subject,
      topic:             r.topic,
      hoursUntilForget:  +Math.max(0, r.hours ?? 0).toFixed(1),
      mastery:           r.mastery,
      overdue:           r.state === 'overdue',
      label:             r.label,
    }))
}

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
  // Same selectors Home uses, so the weak list cannot differ between screens.
  // Also gains a minimum-attempts guard: topTopics() just sorted by mastery, so
  // one unlucky answer was enough to brand a topic weak.
  const weak        = selectWeakTopics(state.mastery, { max: 6 })
  const strong      = selectStrongTopics(state.mastery, { max: 5 })
  const forgetSoon  = forgettingSoon(state.mastery, 8)
  // Streak and prediction come from the shared selectors, so the Kyno tab
  // cannot disagree with Home about the same number. Both read the FULL event
  // log, not the 60-day `events` window used for the trend metrics above --
  // that window is why a 90-day streak displayed as 60.
  const streak = selectStreak(state.events)

  // The old prediction sliced an unsorted array to take "the last 20 scores",
  // so a plain reload could pick a different 20 and move the number with no new
  // activity. selectPrediction sorts by timestamp and refuses to answer below
  // 20 scored attempts rather than guessing from three.
  const pred     = selectPrediction(state.events, 100)
  const predExam = pred.ready ? pred.mid! : null
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

  const ttlMs = OBS_TTL_HOURS * 3600_000
  state.observations = buildObservations(state.twin, state.mastery, events).map(o => ({
    ...o,
    id:        uid(),
    createdAt: now,
    expiresAt: now + ttlMs,
  })).slice(0, 16)

  state.recommendations = buildRecommendations(state.twin).map(r => ({
    ...r,
    id:        uid(),
    createdAt: now,
  }))
}

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

export function refresh(): DashboardSnapshot {
  return getDashboard()
}

export function dismissRecommendation(id: string) {
  const state = loadState()
  state.recommendations = state.recommendations.filter(r => r.id !== id)
  saveState(state)
}

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

export const kairoTrack = track

export function dumpState(): TwinState {
  return loadState()
}

export function recordDoubt(args: {
  question:  string
  answer?:   string
  topic?:    string
  subject?:  string
  source?:   Doubt['source']
}): Doubt | null {
  // Not every chat turn is a doubt. The live log holds "Make Flashcard Abt
  // This" and "No Create It In Flashcards" as doubts, so the app believed the
  // student was confused about flashcards; and "R = V X I = 12 X 3 = 36 Ohms"
  // -- the student's own wrong answer -- as a doubt, so it believed they had
  // ASKED that. Both then fed the AI as context and became weaknesses.
  //
  // A false doubt is worse than a missing one: it is permanent, and it makes
  // the app confidently wrong about what the student struggles with.
  const kind = classifyChatTurn(args.question)
  if (kind !== 'question') return null

  const state = loadState()
  const canon = canonicalTopic(args.topic)
  const doubt: Doubt = {
    id:        uid(),
    ts:        Date.now(),
    question:  args.question,
    answer:    args.answer,
    topic:     canon?.display ?? normalizeTopic(args.topic),
    subject:   args.subject,
    source:    args.source || 'solver',
  }
  state.doubts.unshift(doubt)
  state.doubts = state.doubts.slice(0, 200)
  saveState(state)

  track({
    type: 'concept_viewed',
    subject: args.subject,
    topic:   args.topic,
    modality: args.source === 'voice' ? 'repetition' : 'text',
    payload: { doubtId: doubt.id, question: args.question.slice(0, 120) },
  })
  return doubt
}

export function listDoubts(limit = 50): Doubt[] {
  return loadState().doubts.slice(0, limit)
}

export interface MistakeRow {
  topic:      string
  subject:    string
  count:      number
  lastAt:     number
  recentScores: number[]
  severity:   number
  events:     TwinEvent[]
}

export function getMistakes(): MistakeRow[] {
  const state = loadState()
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
    const mastery = state.mastery.find(m => m.subject === subject && m.topic === topic)
    const baseMastery = mastery?.mastery ?? 0.3
    const severity = Math.max(0, Math.min(1, (evs.length / 8) * (1 - baseMastery)))
    rows.push({ topic, subject, count: evs.length, lastAt, recentScores, severity, events: evs })
  }
  return rows.sort((a, b) => b.severity - a.severity)
}

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

export function getConceptGraph(): { nodes: ConceptNode[]; edges: ConceptEdge[] } {
  const state = loadState()
  const nodes = new Map<string, ConceptNode>()

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

export function recordFormula(args: { name: string; expr: string; subject?: string; topic?: string; source?: Formula['source'] }): Formula {
  const state = loadState()
  const canon = canonicalTopic(args.topic)

  // V=IR, V=I×R, R=V/I and I=V/R are one law written four ways. Comparing the
  // expression text treated them as four formulas, which is how the Formula
  // Sheet ended up with six Ohm's Law cards saved inside two minutes.
  const dup = findRecentDuplicate(
    state.formulas,
    { expr: args.expr, topic: args.topic },
    isSameFormula,
  ) as Formula | null

  if (dup) {
    // Keep the variant rather than dropping it, nested under the entry that
    // already exists — a student who wrote R=V/I should still see that form.
    const variants = new Set([...(dup.variants || []), args.expr])
    dup.variants = [...variants].filter(v => v !== dup.expr).slice(0, 6)
    saveState(state)
    return dup
  }

  const f: Formula = {
    id: uid(), ts: Date.now(),
    name: args.name, expr: args.expr,
    subject: args.subject, topic: canon?.display ?? normalizeTopic(args.topic),
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

/**
 * Phase 2.4 — one-time repair of data already on this device.
 *
 * knowledgeHygiene stops new junk; this fixes the existing "Ai" node, the
 * "General" tags, the split Trigonometry rows and the six Ohm's Law formulas.
 *
 * Guarded so it runs once per device. The report is logged rather than
 * swallowed: this deletes real records, and a student who loses history
 * deserves to be able to see what went and why.
 */
const CLEANUP_KEY = 'kyno:cleanup:v1'

export function runKnowledgeCleanup(force = false): string {
  try {
    if (!force && storage.getRaw(CLEANUP_KEY)) return 'already run'
    const current = loadState()
    const { state: cleaned, report } = cleanupLocalData(current)
    const summary = summarise(report)
    if (summary !== 'nothing to clean') {
      saveState(cleaned as TwinState)
      console.info('[kyno:cleanup]', summary)
      for (const d of report.details.slice(0, 20)) console.info('  ·', d)
    }
    storage.setRaw(CLEANUP_KEY, String(Date.now()))
    return summary
  } catch (e) {
    // Never block boot. A failed cleanup leaves the messy data in place, which
    // is strictly better than an app that will not start.
    console.error('[kyno:cleanup] failed, leaving data untouched:', e)
    return 'failed'
  }
}
