/**
 * Notebook — pure localStorage store with optional server mirroring.
 *
 * The Kairo DB cleanup deleted the `notebooks` / `notes` tables. So this
 * file now treats localStorage as the single source of truth for every
 * note. Server POSTs are attempted as a fire-and-forget mirror, but their
 * failure never affects the local data.
 *
 * Storage key: `kairo:notebook:entries` — Entry[]   (most-recent first)
 */

export type NoteKind = 'flashcards' | 'summary' | 'doubt' | 'concept_map' | 'note' | 'plan' | 'grade'

export interface NoteEntry {
  id:        string
  kind:      NoteKind
  title:     string
  content:   string
  subject:   string | null
  tags:      string[]
  source:    string | null
  createdAt: number
  updatedAt: number
}

const KEY = 'kairo:notebook:entries'
const MAX_ENTRIES = 500

// ─── Pure storage helpers ───────────────────────────────────────────────────
function readAll(): NoteEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw) as NoteEntry[]
  } catch { return [] }
}

function writeAll(arr: NoteEntry[]) {
  if (typeof window === 'undefined') return
  try {
    const trimmed = arr.slice(0, MAX_ENTRIES)
    localStorage.setItem(KEY, JSON.stringify(trimmed))
  } catch { /* quota */ }
}

function uid(): string {
  return 'nb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

// ─── Public API ─────────────────────────────────────────────────────────────
export function listNotebook(opts: { limit?: number; kind?: NoteKind | 'all'; search?: string } = {}): NoteEntry[] {
  let rows = readAll()
  if (opts.kind && opts.kind !== 'all') rows = rows.filter(r => r.kind === opts.kind)
  if (opts.search) {
    const s = opts.search.toLowerCase()
    rows = rows.filter(r =>
      r.title.toLowerCase().includes(s) ||
      r.content.toLowerCase().includes(s) ||
      (r.subject || '').toLowerCase().includes(s) ||
      r.tags.some(t => t.toLowerCase().includes(s))
    )
  }
  return rows.slice(0, opts.limit ?? 200)
}

export function getNotebookEntry(id: string): NoteEntry | null {
  return readAll().find(r => r.id === id) || null
}

export function deleteNotebookEntry(id: string): boolean {
  const arr = readAll()
  const next = arr.filter(r => r.id !== id)
  if (next.length === arr.length) return false
  writeAll(next)
  return true
}

export function updateNotebookEntry(id: string, patch: Partial<Pick<NoteEntry, 'title' | 'content' | 'subject' | 'tags'>>): NoteEntry | null {
  const arr = readAll()
  const idx = arr.findIndex(r => r.id === id)
  if (idx === -1) return null
  arr[idx] = { ...arr[idx], ...patch, updatedAt: Date.now() }
  writeAll(arr)
  return arr[idx]
}

/**
 * Save a new entry to the notebook. ALWAYS succeeds locally. The optional
 * server-mirror request is fire-and-forget and never affects the return.
 *
 * Returns `{ id }` on success — same shape as before for backward compat.
 */
export async function saveToNotebook(payload: {
  kind:    NoteKind
  title:   string
  content: string
  subject?: string | null
  tags?:    string[]
  source?:  string
}): Promise<{ id: string }> {
  const entry: NoteEntry = {
    id:        uid(),
    kind:      payload.kind,
    title:     payload.title,
    content:   payload.content,
    subject:   payload.subject ?? null,
    tags:      payload.tags    ?? [],
    source:    payload.source  ?? null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  const arr = readAll()
  arr.unshift(entry)
  writeAll(arr)

  // Optional server mirror — fire-and-forget. We catch and swallow so a
  // missing-table 500 never breaks the user-facing save.
  if (typeof window !== 'undefined' && localStorage.getItem('kairo_token')) {
    try {
      void fetch('/api/notebook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('kairo_token') || ''}`,
        },
        body: JSON.stringify(payload),
      }).catch(() => {})
    } catch { /* never block */ }
  }
  return { id: entry.id }
}

/** Total count — useful for the Notebook page header. */
export function notebookCount(): number {
  return readAll().length
}
