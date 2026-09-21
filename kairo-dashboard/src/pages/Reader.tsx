/**
 * Reader — the student's own books, read and studied on the device.
 *
 * Four screens: the shelf, a book being read, search within a book, and the
 * pending queue.
 *
 * The rule that shapes all of it: READING IS NEVER INTERRUPTED. Selecting text
 * files an intent and returns you to the page. Making a flashcard is instant
 * because it is local; asking for an explanation is queued because it is not,
 * and a model taking four seconds must never be four seconds of a student
 * staring at a frozen page.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  BookOpen, Upload, Search as SearchIcon, X, Trash2, Layers,
  Sparkles, FileText, Loader2, Check, ChevronLeft, AlertTriangle,
  ChevronRight, ZoomIn, ZoomOut,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { T, FONT, ICON } from '../lib/spaceTokens'
import {
  extractPdfText, cleanPages, looksScanned, openPdf, renderPage, paintTextLayer,
  isRenderCancelled,
} from '../lib/pdfText'
import { chunkPages, buildIndex, search, isConfident, snippet } from '../lib/search.core.js'
import type { SearchResult } from '../lib/search.core'
import {
  type Book, type BookSummary, type Highlight, putBook, getBook, listBooks,
  deleteBook, noteProgress, putHighlight, deleteHighlight, pendingHighlights,
  bookId, usage,
} from '../lib/library'
import { buildClozeCards } from '../lib/cloze.core.js'
import { recordFlashcard } from '../lib/twin'
import { post } from '../lib/api'
import { studentMessage } from '../lib/aiError.core'
import MathText from '../components/MathText'

type View =
  | { name: 'shelf' }
  | { name: 'read'; bookId: string }
  | { name: 'pending' }

const uid = () => Math.random().toString(36).slice(2, 10)

export default function Reader() {
  const [view, setView] = useState<View>({ name: 'shelf' })
  const [books, setBooks] = useState<BookSummary[]>([])
  const [pending, setPending] = useState<Highlight[]>([])
  const [space, setSpace] = useState<{ usedMb: number; quotaMb: number } | null>(null)
  const [err, setErr] = useState('')

  const refresh = useCallback(async () => {
    try {
      setBooks(await listBooks())
      setPending(await pendingHighlights())
      setSpace(await usage())
    } catch (e: any) {
      setErr(studentMessage(e))
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const shell: React.CSSProperties = {
    position: 'absolute', inset: 0, background: T.bg, color: T.text,
    fontFamily: FONT, display: 'flex', flexDirection: 'column', overflow: 'hidden',
  }

  if (err) {
    return (
      <div style={shell}>
        <div style={{ padding: 24, display: 'grid', placeItems: 'center', flex: 1, textAlign: 'center' }}>
          <div>
            <AlertTriangle size={30} color={T.warning} {...ICON} />
            <div style={{ fontSize: 15, color: T.text2, marginTop: 14, maxWidth: 320 }}>{err}</div>
          </div>
        </div>
      </div>
    )
  }

  if (view.name === 'read') {
    return <BookView id={view.bookId} shell={shell} onBack={() => { setView({ name: 'shelf' }); refresh() }} onChanged={refresh} />
  }
  if (view.name === 'pending') {
    return <PendingView shell={shell} items={pending} onBack={() => { setView({ name: 'shelf' }); refresh() }} onChanged={refresh} />
  }
  return (
    <Shelf
      shell={shell} books={books} pending={pending.length} space={space}
      onOpen={id => setView({ name: 'read', bookId: id })}
      onPending={() => setView({ name: 'pending' })}
      onChanged={refresh}
    />
  )
}

/* ── shelf ────────────────────────────────────────────────────────────────── */

const Shelf: React.FC<{
  shell: React.CSSProperties
  books: BookSummary[]
  pending: number
  space: { usedMb: number; quotaMb: number } | null
  onOpen: (id: string) => void
  onPending: () => void
  onChanged: () => void
}> = ({ shell, books, pending, space, onOpen, onPending, onChanged }) => {
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function add(file: File) {
    setNote('')
    const id = bookId(file.name, file.size)
    if (await getBook(id)) { setNote('That book is already on your shelf.'); onChanged(); return }
    try {
      setBusy(`Reading ${file.name}…`)
      const doc = await extractPdfText(file, {
        onProgress: (d, t) => setBusy(`Reading page ${d} of ${t}…`),
      })
      if (looksScanned(doc)) {
        setBusy('')
        setNote(`"${file.name}" looks like a scan — there is no text in it to read yet.`)
        return
      }
      setBusy('Indexing…')
      /*
       * Chunk PAGE BY PAGE, so every passage remembers where it came from.
       *
       * The index used to be built over one flattened string. It could find
       * the right paragraph and then had nothing to do with it -- the reader
       * shows real pages, and "here is your answer, somewhere in this book"
       * is not an answer. Indexing per page costs nothing and makes a search
       * hit a place you can turn to.
       */
      const passages = chunkPages(cleanPages(doc.pages))
      const index = buildIndex(
        passages.map((p, i) => ({ id: `${id}:${i}`, text: p.text, n: i, page: p.page })),
      )
      await putBook({
        id,
        title: doc.title || file.name.replace(/\.pdf$/i, ''),
        fileName: file.name,
        addedAt: Date.now(),
        pageCount: doc.pageCount,
        passageCount: passages.length,
        index,
        // The book itself. Without this the reader has only the text, which
        // is what made a chemistry formula come out as a shuffled sentence.
        file,
      })
      setBusy('')
      onChanged()
    } catch (e: any) {
      setBusy('')
      setNote(`Could not read that file. ${String(e?.message || '').slice(0, 90)}`)
    }
  }

  return (
    <div style={shell}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 14px 120px' }}>
        <div style={{ fontSize: 11.5, letterSpacing: 1.4, color: T.accent, fontWeight: 700 }}>READER</div>
        <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6 }}>Your books</div>
        <div style={{ fontSize: 13.5, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>
          Add a textbook or your notes. Kyno reads it on your phone — it never leaves the device, and it works with no signal.
        </div>

        {pending > 0 && (
          <button onClick={onPending} style={{
            width: '100%', marginTop: 16, padding: '14px 16px', borderRadius: 14,
            background: T.accentSurface, border: `1px solid ${T.accent}`, color: T.text,
            fontFamily: FONT, fontSize: 14.5, textAlign: 'left', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <Layers size={18} color={T.accentPale} {...ICON} />
            <span style={{ flex: 1 }}>{pending} highlight{pending === 1 ? '' : 's'} waiting</span>
            <span style={{ color: T.accentPale, fontWeight: 700 }}>Review</span>
          </button>
        )}

        <input
          ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) add(f); e.currentTarget.value = '' }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!!busy}
          style={{
            width: '100%', marginTop: 14, padding: '16px', borderRadius: 14,
            background: busy ? T.raised : T.accent, border: 'none',
            color: busy ? T.muted : '#fff', fontFamily: FONT, fontSize: 15, fontWeight: 700,
            cursor: busy ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          {busy ? <Loader2 size={18} {...ICON} className="kyno-spin" /> : <Upload size={18} {...ICON} />}
          {busy || 'Add a PDF'}
        </button>

        {note && (
          <div style={{ marginTop: 12, fontSize: 13, color: T.warning, lineHeight: 1.5 }}>{note}</div>
        )}

        <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
          {books.map(b => (
            <div key={b.id} style={{
              background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16,
              padding: 14, display: 'flex', alignItems: 'center', gap: 13,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                background: T.accentSurface, display: 'grid', placeItems: 'center',
              }}>
                <BookOpen size={19} color={T.accentPale} {...ICON} />
              </div>
              <button
                onClick={() => onOpen(b.id)}
                style={{
                  flex: 1, minWidth: 0, background: 'none', border: 'none', textAlign: 'left',
                  color: T.text, fontFamily: FONT, cursor: 'pointer', padding: 0,
                }}
              >
                <div style={{ fontSize: 14.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.title}
                </div>
                <div style={{ fontSize: 12, color: T.dim, marginTop: 3 }}>
                  {b.hasFile
                    ? <>{b.pageCount} pages{b.lastPage ? ` · on page ${b.lastPage}` : ''}</>
                    /* Shelved before the reader kept the PDF itself. */
                    : <span style={{ color: T.warning }}>Re-add this one to see the pages</span>}
                </div>
              </button>
              <button
                onClick={async () => { await deleteBook(b.id); onChanged() }}
                aria-label={`Remove ${b.title}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}
              >
                <Trash2 size={17} color={T.faint} {...ICON} />
              </button>
            </div>
          ))}
        </div>

        {!books.length && !busy && (
          <div style={{
            marginTop: 20, padding: 20, borderRadius: 16, textAlign: 'center',
            border: `1px dashed ${T.dashed}`, color: T.dim, fontSize: 13.5, lineHeight: 1.6,
          }}>
            Nothing on the shelf yet.<br />Add a chapter and you can search it, highlight it, and turn it into flashcards.
          </div>
        )}

        {space && books.length > 0 && (
          <div style={{ marginTop: 16, fontSize: 11.5, color: T.faint, textAlign: 'center' }}>
            {space.usedMb} MB used of about {Math.round(space.quotaMb / 100) / 10} GB available on this device
          </div>
        )}
      </div>
    </div>
  )
}

/* ── reading ──────────────────────────────────────────────────────────────── */

// `icon: React.ElementType` makes TS collapse the union of every possible
// component's props to `never`, so passing size/color is an error. LucideIcon
// is the concrete type, and it is what spaces.ts already uses.
const ACTIONS: { id: Highlight['action']; label: string; icon: LucideIcon; instant: boolean }[] = [
  { id: 'flashcard', label: 'Make flashcards', icon: Layers, instant: true },
  { id: 'explain', label: 'Explain simply', icon: Sparkles, instant: false },
  { id: 'summarise', label: 'Summarise', icon: FileText, instant: false },
]

const BookView: React.FC<{
  id: string
  shell: React.CSSProperties
  onBack: () => void
  onChanged: () => void
}> = ({ id, shell, onBack, onChanged }) => {
  const [book, setBook] = useState<Book | null>(null)
  const [doc, setDoc] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [width, setWidth] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchResult[] | null>(null)
  const [sel, setSel] = useState('')
  const [flash, setFlash] = useState('')

  /*
   * A callback ref, not useRef.
   *
   * The page container does not exist while the book is still opening -- that
   * branch returns early -- so a mount effect reading a useRef found null,
   * never measured, left the width at 0 and drew nothing at all. State set by
   * the ref fires exactly when the node attaches, whenever that is.
   */
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<any>(null)
  const [drawing, setDrawing] = useState(true)

  /* open the book */
  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        const b = await getBook(id)
        if (dead) return
        if (!b) { setErr('That book is no longer on your shelf.'); setLoading(false); return }
        setBook(b)
        setPage(Math.min(Math.max(1, b.lastPage || 1), b.pageCount || 1))
        if (!b.file) { setLoading(false); return }   // shelved before v2
        const d = await openPdf(await b.file.arrayBuffer())
        if (dead) { d?.destroy?.(); return }
        docRef.current = d
        setDoc(d)
        setLoading(false)
      } catch (e: any) {
        if (!dead) { setErr(studentMessage(e)); setLoading(false) }
      }
    })()
    return () => {
      dead = true
      // The worker holds the whole decoded book. Leaving it open on every
      // back-press is how a reader ends up costing hundreds of megabytes.
      docRef.current?.destroy?.()
      docRef.current = null
    }
  }, [id])

  /* how wide the page may be drawn */
  useEffect(() => {
    const el = scrollEl
    if (!el) return
    const measure = () => setWidth(Math.max(0, el.clientWidth - 24))
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [scrollEl])

  /* draw it */
  useEffect(() => {
    const d = doc
    const cv = canvasRef.current
    const tl = textRef.current
    if (!d || !cv || !tl || !width) return

    let alive = true
    setDrawing(true)
    const job = renderPage(d, page, cv, width * zoom)

    job.done
      .then(async ({ page: pg, viewport }) => {
        if (!alive) return
        await paintTextLayer(pg, tl, viewport)
        if (!alive) return
        pg.cleanup()
        setDrawing(false)
      })
      .catch(e => {
        // A cancelled draw is the normal result of turning a page.
        if (alive && !isRenderCancelled(e)) { setErr(studentMessage(e)); setDrawing(false) }
      })

    // Cancelling here is what keeps the NEXT render alive: pdf.js will not run
    // two draws against one canvas, and it rejects the second, not the first.
    return () => { alive = false; job.cancel() }
  }, [doc, page, zoom, width])

  /* remember the page, but not on every tap */
  useEffect(() => {
    if (!book) return
    const t = setTimeout(() => { noteProgress(book.id, page) }, 800)
    return () => clearTimeout(t)
  }, [book, page])

  useEffect(() => {
    if (!book || !q.trim()) { setHits(null); return }
    const r = search(book.index, q, { limit: 8 })
    setHits(isConfident(r) ? r : [])
  }, [book, q])

  /**
   * What the student has selected.
   *
   * The text layer is a grid of absolutely positioned spans, so a selection
   * arrives carrying the line breaks and padding of the printed page.
   * Collapsing the whitespace is what makes it usable as a flashcard.
   */
  const readSelection = () => {
    const t = String(window.getSelection?.()?.toString() || '').replace(/\s+/g, ' ').trim()
    return t.length >= 12 ? t : ''
  }

  const onUp = () => { const t = readSelection(); if (t) setSel(t) }

  const goto = (n: number) => {
    if (!book) return
    setPage(Math.min(Math.max(1, n), book.pageCount || 1))
    scrollEl?.scrollTo({ top: 0 })
  }

  async function act(action: Highlight['action']) {
    if (!book || !sel) return
    const h: Highlight = {
      id: uid(), bookId: book.id, bookTitle: book.title, page,
      text: sel, createdAt: Date.now(), status: 'pending', action,
    }

    if (action === 'flashcard') {
      // Local, instant, offline. No reason to make this wait in a queue.
      const cards = buildClozeCards(sel, { max: 5 }) as { front: string; back: string }[]
      if (!cards.length) {
        setFlash('That selection was too short to make a card from.')
      } else {
        for (const c of cards) {
          try { recordFlashcard({ front: c.front, back: c.back, topic: book.title, source: 'manual' }) } catch { /* card still saved below */ }
        }
        await putHighlight({ ...h, status: 'done', cards })
        setFlash(`${cards.length} flashcard${cards.length === 1 ? '' : 's'} added.`)
      }
    } else {
      // Queued deliberately: reading does not stop for a model.
      await putHighlight(h)
      setFlash('Saved — it will be ready in your pending list.')
    }

    setSel('')
    window.getSelection?.()?.removeAllRanges()
    onChanged()
    setTimeout(() => setFlash(''), 2600)
  }

  if (loading) {
    return <div style={shell}><div style={{ flex: 1, display: 'grid', placeItems: 'center', color: T.muted }}>Opening…</div></div>
  }

  const header = (
    <div style={{ padding: '12px 14px 10px', borderBottom: `1px solid ${T.divider}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack} aria-label="Back to your books"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <ChevronLeft size={22} color={T.text2} {...ICON} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {book?.title}
          </div>
          <div style={{ fontSize: 11.5, color: T.dim }}>page {page} of {book?.pageCount}</div>
        </div>
        <button onClick={() => setZoom(z => Math.max(0.8, Math.round((z - 0.2) * 10) / 10))}
          disabled={zoom <= 0.8} aria-label="Zoom out"
          style={{ background: 'none', border: 'none', padding: 5, cursor: zoom <= 0.8 ? 'default' : 'pointer' }}>
          <ZoomOut size={18} color={zoom <= 0.8 ? T.fainter : T.text2} {...ICON} />
        </button>
        <button onClick={() => setZoom(z => Math.min(2.5, Math.round((z + 0.2) * 10) / 10))}
          disabled={zoom >= 2.5} aria-label="Zoom in"
          style={{ background: 'none', border: 'none', padding: 5, cursor: zoom >= 2.5 ? 'default' : 'pointer' }}>
          <ZoomIn size={18} color={zoom >= 2.5 ? T.fainter : T.text2} {...ICON} />
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <SearchIcon size={16} color={T.faint} {...ICON} />
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search this book"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: T.text, fontFamily: FONT, fontSize: 16, padding: '6px 0',
          }}
        />
        {q && (
          <button onClick={() => setQ('')} aria-label="Clear search"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={16} color={T.faint} {...ICON} />
          </button>
        )}
      </div>
    </div>
  )

  /*
   * A book shelved before the reader kept the PDF itself. Saying so is better
   * than rendering the old flattened text and calling it the book.
   */
  if (book && !book.file) {
    return (
      <div style={shell}>
        {header}
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
          <div style={{ maxWidth: 320 }}>
            <AlertTriangle size={26} color={T.warning} {...ICON} />
            <div style={{ fontSize: 14.5, color: T.text2, marginTop: 14, lineHeight: 1.6 }}>
              This book was added before Kyno kept the PDF itself, so there are no pages to show —
              only the text it pulled out. Remove it and add the file again to read the real pages.
            </div>
            <button
              onClick={async () => { await deleteBook(book.id); onChanged(); onBack() }}
              style={{
                marginTop: 18, padding: '12px 18px', borderRadius: 12, background: T.raised,
                border: `1px solid ${T.borderCtl}`, color: T.text, fontFamily: FONT,
                fontSize: 14, cursor: 'pointer',
              }}
            >
              Remove it
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={shell}>
      {header}

      {/* The page itself, always mounted. Unmounting it to show search results
          threw the rendered canvas away and made every search cost a redraw. */}
      <div
        ref={setScrollEl}
        onMouseUp={onUp}
        onTouchEnd={onUp}
        style={{ flex: 1, overflow: 'auto', padding: '12px 12px 150px', WebkitOverflowScrolling: 'touch' }}
      >
        <div style={{ position: 'relative', width: 'fit-content', margin: '0 auto' }}>
          <canvas
            ref={canvasRef}
            style={{ display: 'block', borderRadius: 10, background: '#fff', boxShadow: '0 6px 24px rgba(0,0,0,0.35)' }}
          />
          <div ref={textRef} className="kyno-textlayer" />
          {/* A textbook page takes a moment to draw. Saying so beats a blank
              white rectangle that looks like a book that failed to open. */}
          {drawing && (
            <div style={{
              position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
              background: 'rgba(255,255,255,0.65)', borderRadius: 10, zIndex: 2,
            }}>
              <Loader2 size={22} color={T.accent} {...ICON} className="kyno-spin" />
            </div>
          )}
        </div>
        {err && (
          <div style={{ marginTop: 14, fontSize: 13, color: T.warning, textAlign: 'center' }}>{err}</div>
        )}
      </div>

      {/* pager — hidden while the sheet or search is up, so it never sits under them */}
      {!sel && hits === null && (
        <div style={{
          position: 'absolute', left: 14, right: 14,
          bottom: 'calc(84px + env(safe-area-inset-bottom))', zIndex: 30,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <PageBtn label="Previous" disabled={page <= 1} onClick={() => goto(page - 1)} icon={ChevronLeft} />
          <PageBtn label="Next" disabled={page >= (book?.pageCount || 1)} onClick={() => goto(page + 1)} icon={ChevronRight} />
        </div>
      )}

      {/* search results sit OVER the page rather than replacing it */}
      {hits !== null && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 104, bottom: 0, zIndex: 35,
          background: T.bg, overflowY: 'auto', padding: '14px 14px 120px',
        }}>
          {hits.length === 0 ? (
            <div style={{ color: T.muted, fontSize: 14, lineHeight: 1.6, padding: '10px 2px' }}>
              Nothing in this book answers that. It only knows what is on these pages —
              try the Doubt space for anything outside it.
            </div>
          ) : hits.map((r, i) => {
            const sn = snippet(r.doc.text, r.terms, { width: 260 })
            return (
              <button key={i}
                onClick={() => { goto(Number(r.doc.page) || 1); setQ('') }}
                style={{
                  width: '100%', textAlign: 'left', marginBottom: 10, padding: 14,
                  background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14,
                  color: T.text, fontFamily: FONT, cursor: 'pointer',
                }}>
                <div style={{ fontSize: 11.5, color: T.accentPale, marginBottom: 6, fontWeight: 600 }}>
                  page {Number(r.doc.page) || 1}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: T.text2 }}>
                  {sn.truncatedStart && '… '}
                  {sn.parts.map((p, j) => (
                    <span key={j} style={p.hit ? { background: T.accentSurface, borderRadius: 3, color: T.text } : undefined}>{p.text}</span>
                  ))}
                  {sn.truncatedEnd && ' …'}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* selection sheet — the only thing that interrupts reading, and only briefly */}
      {sel && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 40,
          background: T.sheet, borderTop: `1px solid ${T.border}`,
          padding: '16px 14px calc(16px + env(safe-area-inset-bottom))',
          boxShadow: '0 -18px 50px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{
              flex: 1, fontSize: 13, color: T.muted, lineHeight: 1.5,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              “{sel}”
            </div>
            <button onClick={() => { setSel(''); window.getSelection?.()?.removeAllRanges() }}
              aria-label="Cancel" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
              <X size={18} color={T.faint} {...ICON} />
            </button>
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {ACTIONS.map(a => (
              <button key={a.id} onClick={() => act(a.id)} style={{
                display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px',
                borderRadius: 13, background: T.raised, border: `1px solid ${T.borderCtl}`,
                color: T.text, fontFamily: FONT, fontSize: 14.5, cursor: 'pointer', textAlign: 'left',
              }}>
                <a.icon size={17} color={T.accentPale} {...ICON} />
                <span style={{ flex: 1 }}>{a.label}</span>
                <span style={{ fontSize: 11.5, color: T.faint }}>{a.instant ? 'instant' : 'queued'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {flash && !sel && (
        <div style={{
          position: 'absolute', left: 14, right: 14, bottom: 'calc(20px + env(safe-area-inset-bottom))',
          zIndex: 41, padding: '13px 16px', borderRadius: 13,
          background: T.successBg, border: `1px solid ${T.successBorder}`,
          color: T.text, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Check size={16} color={T.success} {...ICON} />{flash}
        </div>
      )}
    </div>
  )
}

const PageBtn: React.FC<{
  label: string
  disabled: boolean
  onClick: () => void
  icon: LucideIcon
}> = ({ label, disabled, onClick, icon: Icon }) => (
  <button onClick={onClick} disabled={disabled} style={{
    flex: 1, padding: '12px', borderRadius: 13, fontFamily: FONT, fontSize: 14, fontWeight: 600,
    background: T.sheet, border: `1px solid ${T.borderCtl}`,
    color: disabled ? T.fainter : T.text2, cursor: disabled ? 'default' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  }}>
    {label === 'Previous' && <Icon size={16} {...ICON} />}
    {label}
    {label === 'Next' && <Icon size={16} {...ICON} />}
  </button>
)

/* ── pending ──────────────────────────────────────────────────────────────── */

/**
 * The queue. Highlights that asked for a model, run when the student chooses
 * to run them, in a place where waiting is the expected activity.
 */
const PendingView: React.FC<{
  shell: React.CSSProperties
  items: Highlight[]
  onBack: () => void
  onChanged: () => void
}> = ({ shell, items, onBack, onChanged }) => {
  const [busyId, setBusyId] = useState('')
  const [local, setLocal] = useState(items)
  useEffect(() => setLocal(items), [items])

  async function run(h: Highlight) {
    setBusyId(h.id)
    const ask = h.action === 'explain'
      ? `Explain this to a 14-year-old in three short sentences. Plain words, no preamble:\n\n${h.text}`
      : `Summarise this in at most three bullet points, each under 15 words:\n\n${h.text}`
    try {
      const r = await post('/ai/chat', { messages: [{ role: 'user', content: ask }], taskType: 'speed' })
      const out = String(r?.reply || r?.content || r?.text || '').trim()
      if (!out) throw new Error('empty reply')
      const done: Highlight = { ...h, status: 'done', result: out }
      await putHighlight(done)
      setLocal(l => l.map(x => x.id === h.id ? done : x))
    } catch (e: any) {
      const failed: Highlight = { ...h, error: studentMessage(e) }
      await putHighlight(failed)
      setLocal(l => l.map(x => x.id === h.id ? failed : x))
    } finally {
      setBusyId('')
      onChanged()
    }
  }

  return (
    <div style={shell}>
      <div style={{ padding: '12px 14px 10px', borderBottom: `1px solid ${T.divider}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <ChevronLeft size={22} color={T.text2} {...ICON} />
        </button>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Waiting on you</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 120px' }}>
        {!local.length && (
          <div style={{ color: T.muted, fontSize: 14, textAlign: 'center', padding: 30, lineHeight: 1.6 }}>
            Nothing pending. Highlight something while reading and it will land here.
          </div>
        )}
        {local.map(h => (
          <div key={h.id} style={{
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16,
            padding: 14, marginBottom: 10,
          }}>
            <div style={{ fontSize: 11.5, color: T.dim, marginBottom: 7 }}>
              {h.bookTitle}
              {h.page != null ? ` · page ${h.page}` : h.passage != null ? ` · passage ${h.passage + 1}` : ''}
              {' · '}{h.action === 'explain' ? 'explain simply' : 'summarise'}
            </div>
            <div style={{
              fontSize: 13.5, color: T.muted, lineHeight: 1.55, marginBottom: 12,
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              “{h.text}”
            </div>

            {h.result ? (
              <MathText text={h.result} style={{ fontSize: 14.5, color: T.text, lineHeight: 1.6 }} />
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => run(h)} disabled={!!busyId} style={{
                  flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                  background: busyId === h.id ? T.raised : T.accent,
                  color: busyId === h.id ? T.muted : '#fff',
                  fontFamily: FONT, fontSize: 14, fontWeight: 700, cursor: busyId ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  {busyId === h.id ? <><Loader2 size={15} {...ICON} className="kyno-spin" /> Thinking…</> : 'Run it'}
                </button>
                <button onClick={async () => { await deleteHighlight(h.id); onChanged() }} aria-label="Discard" style={{
                  padding: '12px 14px', borderRadius: 12, background: T.raised,
                  border: `1px solid ${T.borderCtl}`, cursor: 'pointer',
                }}>
                  <Trash2 size={16} color={T.faint} {...ICON} />
                </button>
              </div>
            )}

            {h.error && (
              <div style={{ fontSize: 12.5, color: T.warning, marginTop: 10, lineHeight: 1.5 }}>{h.error}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
