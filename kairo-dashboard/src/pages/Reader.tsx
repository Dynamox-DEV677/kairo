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
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { T, FONT, ICON } from '../lib/spaceTokens'
import { extractPdfText, stripPageFurniture, looksScanned } from '../lib/pdfText'
import { chunk, buildIndex, search, isConfident, snippet } from '../lib/search.core.js'
import type { SearchResult } from '../lib/search.core'
import {
  type Book, type Highlight, putBook, getBook, listBooks, deleteBook,
  noteProgress, putHighlight, deleteHighlight, pendingHighlights, bookId, usage,
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
  const [books, setBooks] = useState<Omit<Book, 'index'>[]>([])
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
  books: Omit<Book, 'index'>[]
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
      const passages = chunk(stripPageFurniture(doc.pages))
      const index = buildIndex(passages.map((text, i) => ({ id: `${id}:${i}`, text, n: i })))
      await putBook({
        id,
        title: doc.title || file.name.replace(/\.pdf$/i, ''),
        fileName: file.name,
        addedAt: Date.now(),
        pageCount: doc.pageCount,
        passageCount: passages.length,
        index,
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
                  {b.pageCount} pages · {b.passageCount} passages
                  {b.lastPassage != null ? ` · resumed at ${b.lastPassage + 1}` : ''}
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
  const [at, setAt] = useState(0)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchResult[] | null>(null)
  const [sel, setSel] = useState('')
  const [flash, setFlash] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getBook(id).then(b => {
      if (!b) return
      setBook(b)
      setAt(b.lastPassage || 0)
    })
  }, [id])

  // Persist the position, but not on every scroll -- a write per frame would
  // thrash IndexedDB for no benefit.
  useEffect(() => {
    if (!book) return
    const t = setTimeout(() => { noteProgress(book.id, at) }, 800)
    return () => clearTimeout(t)
  }, [book, at])

  useEffect(() => {
    if (!book || !q.trim()) { setHits(null); return }
    const r = search(book.index, q, { limit: 8 })
    setHits(isConfident(r) ? r : [])
  }, [book, q])

  /** What the student has selected, if anything worth acting on. */
  const readSelection = () => {
    const s = window.getSelection?.()
    const text = String(s?.toString() || '').trim()
    return text.length >= 12 ? text : ''
  }

  const onUp = () => {
    const t = readSelection()
    if (t) setSel(t)
  }

  async function act(action: Highlight['action']) {
    if (!book || !sel) return
    const h: Highlight = {
      id: uid(), bookId: book.id, bookTitle: book.title, passage: at,
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

  if (!book) {
    return <div style={shell}><div style={{ flex: 1, display: 'grid', placeItems: 'center', color: T.muted }}>Opening…</div></div>
  }

  const passages = book.index.meta
  const current = passages[at]

  return (
    <div style={shell}>
      {/* chrome */}
      <div style={{ padding: '12px 14px 10px', borderBottom: `1px solid ${T.divider}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onBack} aria-label="Back to your books"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <ChevronLeft size={22} color={T.text2} {...ICON} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {book.title}
            </div>
            <div style={{ fontSize: 11.5, color: T.dim }}>{at + 1} of {passages.length}</div>
          </div>
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

      {/* search results replace the page while searching */}
      {hits !== null ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 120px' }}>
          {hits.length === 0 ? (
            <div style={{ color: T.muted, fontSize: 14, lineHeight: 1.6, padding: '10px 2px' }}>
              Nothing in this book answers that. It only knows what is on these pages —
              try the Doubt space for anything outside it.
            </div>
          ) : hits.map((r, i) => {
            const sn = snippet(r.doc.text, r.terms, { width: 260 })
            return (
              <button key={i}
                onClick={() => { setAt(Number(r.doc.n) || 0); setQ('') }}
                style={{
                  width: '100%', textAlign: 'left', marginBottom: 10, padding: 14,
                  background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14,
                  color: T.text, fontFamily: FONT, cursor: 'pointer',
                }}>
                <div style={{ fontSize: 11.5, color: T.dim, marginBottom: 6 }}>
                  passage {Number(r.doc.n) + 1}
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
      ) : (
        <div
          ref={bodyRef}
          onMouseUp={onUp}
          onTouchEnd={onUp}
          style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 130px' }}
        >
          <MathText
            text={current?.text || ''}
            style={{ fontSize: 18.5, lineHeight: 1.72, color: T.text2 }}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
            <PageBtn label="Previous" disabled={at <= 0} onClick={() => { setAt(a => Math.max(0, a - 1)); bodyRef.current?.scrollTo({ top: 0 }) }} />
            <PageBtn label="Next" disabled={at >= passages.length - 1} onClick={() => { setAt(a => Math.min(passages.length - 1, a + 1)); bodyRef.current?.scrollTo({ top: 0 }) }} />
          </div>
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

const PageBtn: React.FC<{ label: string; disabled: boolean; onClick: () => void }> = ({ label, disabled, onClick }) => (
  <button onClick={onClick} disabled={disabled} style={{
    flex: 1, padding: '13px', borderRadius: 13, fontFamily: FONT, fontSize: 14, fontWeight: 600,
    background: T.raised, border: `1px solid ${T.borderCtl}`,
    color: disabled ? T.fainter : T.text2, cursor: disabled ? 'default' : 'pointer',
  }}>{label}</button>
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
              {h.bookTitle} · passage {h.passage + 1} · {h.action === 'explain' ? 'explain simply' : 'summarise'}
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
