
import { authToken } from '../lib/storage'
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

const KEY = 'kyno:notebook:entries'
const MAX_ENTRIES = 500

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
  } catch {  }
}

function uid(): string {
  return 'nb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

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

export async function saveToNotebook(payload: {
  kind:    NoteKind
  title:   string
  content: string
  subject?: string | null
  tags?:    string[]
  source?:  string
}): Promise<{ id: string }> {
  const arr = readAll()
  // De-dupe: if a note with the same kind + normalized title already exists,
  // update it in place instead of piling on identical copies.
  const norm = (s: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ')
  const dupe = arr.find(e => e.kind === payload.kind && norm(e.title) === norm(payload.title))
  if (dupe) {
    dupe.content   = payload.content
    dupe.subject   = payload.subject ?? dupe.subject
    dupe.tags      = payload.tags    ?? dupe.tags
    dupe.updatedAt = Date.now()
    writeAll(arr)
    return { id: dupe.id }
  }

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
  arr.unshift(entry)
  writeAll(arr)

  if (typeof window !== 'undefined' && authToken()) {
    try {
      void fetch('/api/notebook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken() || ''}`,
        },
        body: JSON.stringify(payload),
      }).catch(() => {})
    } catch {  }
  }
  return { id: entry.id }
}

export function notebookCount(): number {
  return readAll().length
}
