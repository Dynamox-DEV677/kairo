/**
 * The student's library, on their device.
 *
 * IndexedDB rather than localStorage, for one hard reason: localStorage caps
 * at ~5MB and holds strings, and a single indexed NCERT chapter is already
 * around 200KB of text plus postings. A shelf of twenty books would blow the
 * quota and take the rest of Kyno's storage down with it.
 *
 * Nothing here talks to a server. A book a student uploads stays on the phone,
 * which is both the privacy answer and the reason the reader works with no
 * signal. Nothing here is synced -- that is a deliberate gap, noted in the
 * roadmap, not an oversight.
 */
import type { SearchIndex } from './search.core'

const DB_NAME = 'kyno-library'
/*
 * v2 stores the PDF's own bytes alongside the index.
 *
 * v1 kept only extracted text, and a real chemistry chapter showed why that
 * was never going to be a textbook reader: the formula for volume percentage
 * came out as a meaningless word order and every figure was simply gone. The
 * bytes are the book; the text is a search index over it.
 */
const DB_VERSION = 2

export const BOOKS = 'books'
export const HIGHLIGHTS = 'highlights'

export interface Book {
  id: string
  title: string
  fileName: string
  addedAt: number
  pageCount: number
  passageCount: number
  /** The whole searchable index, including passage text. */
  index: SearchIndex
  /**
   * The original PDF, so the reader can draw the real pages.
   *
   * A Blob, not an ArrayBuffer: Safari has historically mangled large
   * ArrayBuffers through structured clone, and a Blob is also what lets the
   * browser keep an 11MB book on disk instead of in memory.
   *
   * Optional because books shelved by v1 do not have it; the reader offers to
   * re-add those rather than pretending it can render them.
   */
  file?: Blob
  /** Where the student had got to, so the reader reopens where they left. */
  lastPassage?: number
  /** Which page they were on. Pages are what the reader shows now. */
  lastPage?: number
  lastOpenedAt?: number
}

/** A saved selection, and whatever the student asked to be done with it. */
export interface Highlight {
  id: string
  bookId: string
  bookTitle: string
  /**
   * The page it was highlighted on, so "go back to it" can actually go.
   *
   * `passage` is what v1 recorded, when the reader paged through extracted
   * passages instead of the book. Kept so old highlights still render.
   */
  page?: number
  passage?: number
  text: string
  createdAt: number
  /**
   * `pending` is the point of the queue: a highlight made while reading is a
   * promise to come back, not an interruption. Reading should never stop to
   * wait for a model.
   */
  status: 'pending' | 'done'
  action: 'flashcard' | 'explain' | 'summarise'
  /** Filled in when the action completes. */
  result?: string
  /** For flashcards: the cloze cards generated from the selection. */
  cards?: { front: string; back: string }[]
  error?: string
}

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser has no IndexedDB, so the library cannot be saved.'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(BOOKS)) {
        db.createObjectStore(BOOKS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(HIGHLIGHTS)) {
        const s = db.createObjectStore(HIGHLIGHTS, { keyPath: 'id' })
        s.createIndex('byBook', 'bookId', { unique: false })
        s.createIndex('byStatus', 'status', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('Could not open the library'))
  })
  return dbPromise
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode)
    const req = run(t.objectStore(store))
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error || new Error(`${store} ${mode} failed`))
  }))
}

/* ── books ────────────────────────────────────────────────────────────────── */

export async function putBook(book: Book): Promise<void> {
  await tx(BOOKS, 'readwrite', s => s.put(book))
}

export async function getBook(id: string): Promise<Book | undefined> {
  return tx<Book | undefined>(BOOKS, 'readonly', s => s.get(id))
}

/**
 * Every book, newest first, WITHOUT their indexes or their bytes.
 *
 * The shelf only needs titles. Loading twenty full indexes to draw a list is
 * how a library screen takes two seconds to open on a cheap phone -- and now
 * that the PDFs are stored too, it would also pull a couple of hundred
 * megabytes through memory to render a list of names.
 */
export type BookSummary = Omit<Book, 'index' | 'file'> & { hasFile: boolean }

export async function listBooks(): Promise<BookSummary[]> {
  const all = await tx<Book[]>(BOOKS, 'readonly', s => s.getAll())
  return all
    .map(({ index, file, ...rest }) => ({ ...rest, hasFile: !!file }))
    .sort((a, b) => (b.lastOpenedAt || b.addedAt) - (a.lastOpenedAt || a.addedAt))
}

export async function deleteBook(id: string): Promise<void> {
  await tx(BOOKS, 'readwrite', s => s.delete(id))
  const hs = await highlightsForBook(id)
  for (const h of hs) await deleteHighlight(h.id)
}

/** Remember where they stopped reading. */
export async function noteProgress(id: string, page: number): Promise<void> {
  const b = await getBook(id)
  if (!b) return
  await putBook({ ...b, lastPage: page, lastOpenedAt: Date.now() })
}

/* ── highlights ───────────────────────────────────────────────────────────── */

export async function putHighlight(h: Highlight): Promise<void> {
  await tx(HIGHLIGHTS, 'readwrite', s => s.put(h))
}

export async function deleteHighlight(id: string): Promise<void> {
  await tx(HIGHLIGHTS, 'readwrite', s => s.delete(id))
}

export async function allHighlights(): Promise<Highlight[]> {
  const all = await tx<Highlight[]>(HIGHLIGHTS, 'readonly', s => s.getAll())
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function pendingHighlights(): Promise<Highlight[]> {
  return (await allHighlights()).filter(h => h.status === 'pending')
}

export async function highlightsForBook(bookId: string): Promise<Highlight[]> {
  const all = await allHighlights()
  return all.filter(h => h.bookId === bookId)
}

/* ── housekeeping ─────────────────────────────────────────────────────────── */

/**
 * Roughly how much room the library is using, and how much the browser will
 * allow. Worth showing: a student with a 32GB phone and twelve textbooks is a
 * real case, and "storage full" arriving as a silent write failure is not.
 */
export async function usage(): Promise<{ usedMb: number; quotaMb: number } | null> {
  try {
    const est = await navigator.storage?.estimate?.()
    if (!est) return null
    return {
      usedMb: Math.round((est.usage || 0) / 1e5) / 10,
      quotaMb: Math.round((est.quota || 0) / 1e5) / 10,
    }
  } catch { return null }
}

export function bookId(fileName: string, size: number): string {
  // Name plus size: re-uploading the same file should reopen the same book
  // rather than silently shelving a duplicate.
  return `${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}:${size}`
}
