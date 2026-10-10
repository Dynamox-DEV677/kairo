/**
 * Study — the student's own book, turned into answers and study material.
 *
 *   Ask       questions answered from this book only, every answer citing pages
 *   Guide     key concepts, formulas and exam questions for a page range
 *   FAQ       the questions a student would ask, answered
 *   Timeline  dates, or the steps of a process, in order
 *   Mind map  the chapter as a tree; every node opens its page
 *
 * Grounding is the whole point. Search runs on the phone, so only the pages
 * that matter are sent; the server's stand-in replies (the "busy" message,
 * the Wikipedia extract) are refused, because an answer that did not come
 * from this book must never look like one that did. Page numbers the model
 * invents are dropped in bookStudio.core before anything is drawn.
 *
 * Reading is still never interrupted: the panel stays mounted when closed,
 * so a guide being written keeps going while the student goes back to the
 * page.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft, MessageCircle, GraduationCap, CircleQuestionMark, History, Network,
  Send, Loader2, AlertTriangle, Layers, Check, RefreshCw, ChevronRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { T, FONT, ICON } from '../lib/spaceTokens'
import { search } from '../lib/search.core.js'
import {
  MAX_RANGE, pagesFromIndex, pagesInRange, clampRange, planStudio, pickPassages,
  askMessages, parseAnswer, digestMessages, joinNotes, studioMessages, parseJson,
  normalizeStudio, studioKey, formulaTex,
} from '../lib/bookStudio.core.js'
import katex from 'katex'
import { KATEX_OPTS } from '../lib/katex'
import type {
  StudioKind, PageRange, StudyGuide, Faq, Timeline, MindMap, StudioResult,
} from '../lib/bookStudio.core'
import { type Book, type StudioItem, putStudio, getStudio } from '../lib/library'
import { chat } from '../lib/openrouter'
import { AiError, studentMessage } from '../lib/aiError.core'
import { recordFlashcard } from '../lib/twin'
import MathText from './MathText'

type Tab = 'ask' | StudioKind

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'ask', label: 'Ask', icon: MessageCircle },
  { id: 'guide', label: 'Guide', icon: GraduationCap },
  { id: 'faq', label: 'FAQ', icon: CircleQuestionMark },
  { id: 'timeline', label: 'Timeline', icon: History },
  { id: 'mindmap', label: 'Mind map', icon: Network },
]

const NAMES: Record<StudioKind, string> = {
  guide: 'study guide', faq: 'FAQ', timeline: 'timeline', mindmap: 'mind map',
}

interface Turn {
  id: string
  q: string
  status: 'thinking' | 'done' | 'none' | 'error'
  text?: string
  pages?: number[]
  err?: string
}

const uid = () => Math.random().toString(36).slice(2, 10)
const isAbort = (e: any) => e?.name === 'AbortError'

export default function BookStudio({ book, page, open, onClose, onGoto, onBusy }: {
  book: Book
  /** The page being read when Study was first opened; seeds the range of a long book. */
  page: number
  open: boolean
  onClose: () => void
  onGoto: (page: number) => void
  onBusy: (busy: boolean) => void
}) {
  const [tab, setTab] = useState<Tab>('ask')
  const pages = useMemo(() => pagesFromIndex(book.index), [book])
  const count = book.pageCount || 1

  /* ── ask ── */
  const [turns, setTurns] = useState<Turn[]>([])
  const [askQ, setAskQ] = useState('')
  const [asking, setAsking] = useState(false)
  const askEnd = useRef<HTMLDivElement>(null)

  /* ── study items ── */
  // A short book (one NCERT chapter is ~20 pages) is studied whole. A long one
  // starts at the page the student is on.
  const [range, setRange] = useState<PageRange>(() =>
    count <= MAX_RANGE ? { from: 1, to: count } : clampRange(page, page + 19, count))
  const [fromS, setFromS] = useState(String(range.from))
  const [toS, setToS] = useState(String(range.to))
  const [items, setItems] = useState<Partial<Record<StudioKind, StudioItem>>>({})
  const [job, setJob] = useState<{ kind: StudioKind; progress: string } | null>(null)
  const [errs, setErrs] = useState<Partial<Record<StudioKind, string>>>({})
  // Condensed notes per range: making the FAQ after the guide should not pay
  // for reading the same twenty pages twice.
  const notes = useRef(new Map<string, string>())
  const abort = useRef<AbortController | null>(null)

  const alive = useRef(true)

  useEffect(() => { onBusy(asking || !!job) }, [asking, job, onBusy])
  // Leaving the book cancels whatever is in flight. The controller is dropped
  // as well as aborted: an effect can be torn down and set up again on the
  // same component (StrictMode, hot reload), and reusing an aborted signal
  // made every later request fail silently, before it was even sent.
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; abort.current?.abort(); abort.current = null }
  }, [])

  // What has already been made for this range, straight from the device.
  useEffect(() => {
    let dead = false
    setItems({})
    ;(async () => {
      const found: Partial<Record<StudioKind, StudioItem>> = {}
      for (const k of ['guide', 'faq', 'timeline', 'mindmap'] as StudioKind[]) {
        try { const it = await getStudio(studioKey(book.id, k, range)); if (it) found[k] = it } catch { /* none cached */ }
      }
      if (!dead) setItems(found)
    })()
    return () => { dead = true }
  }, [book.id, range])

  useEffect(() => { askEnd.current?.scrollIntoView({ block: 'end' }) }, [turns])

  /** The signal for the next request. Refuses once the book is closed, so a
   *  chapter half-way through condensing does not carry on in the background. */
  const signal = () => {
    if (!alive.current) throw new DOMException('Aborted', 'AbortError')
    if (!abort.current) abort.current = new AbortController()
    return abort.current.signal
  }

  async function ask(text: string) {
    const q = text.replace(/\s+/g, ' ').trim()
    if (!q || asking) return
    const id = uid()
    const patch = (p: Partial<Turn>) => setTurns(ts => ts.map(t => (t.id === id ? { ...t, ...p } : t)))
    setTurns(ts => [...ts, { id, q, status: 'thinking' }])
    setAskQ('')
    setTab('ask')
    setAsking(true)
    try {
      // The book is searched here, on the phone. If nothing in it matches,
      // there is nothing to send, and no model gets the chance to make
      // something up.
      const passages = pickPassages(search(book.index, q, { limit: 12 }))
      if (!passages.length) { patch({ status: 'none' }); return }
      const reply = await chat({ messages: askMessages(q, passages), effort: 'low', strict: true, signal: signal() })
      const a = parseAnswer(reply, passages.map(p => p.page))
      patch(a.notInBook ? { status: 'none' } : { status: 'done', text: a.text, pages: a.pages })
    } catch (e: any) {
      if (!isAbort(e)) patch({ status: 'error', err: studentMessage(e) })
    } finally {
      setAsking(false)
    }
  }

  function commitRange() {
    const r = clampRange(Number(fromS), Number(toS), count)
    setFromS(String(r.from))
    setToS(String(r.to))
    if (r.from !== range.from || r.to !== range.to) setRange(r)
  }

  async function make(kind: StudioKind) {
    if (job) return
    const r = range
    setErrs(e => ({ ...e, [kind]: '' }))
    setJob({ kind, progress: 'Reading the pages…' })
    try {
      const sel = pagesInRange(pages, r.from, r.to)
      if (!sel.length) throw new Error('There is no text on those pages to study from. Try a different range.')
      const nk = `${r.from}-${r.to}`
      let material = notes.current.get(nk)
      if (!material) {
        const plan = planStudio(sel)
        if (plan.mode === 'direct') {
          material = plan.material
        } else {
          const parts: string[] = []
          for (let i = 0; i < plan.groups.length; i++) {
            const g = plan.groups[i]
            setJob({ kind, progress: `Reading pages ${g[0].page}–${g[g.length - 1].page} (${i + 1} of ${plan.groups.length})…` })
            parts.push(await chat({ messages: digestMessages(g), effort: 'low', strict: true, signal: signal() }))
          }
          material = joinNotes(parts)
        }
        notes.current.set(nk, material)
      }
      setJob({ kind, progress: `Writing your ${NAMES[kind]}…` })
      let data: StudioResult | null = null
      // One retry: a reply that is not the shape asked for is usually a
      // one-off, and a second try is cheaper than a student re-tapping.
      for (let attempt = 0; attempt < 2 && !data; attempt++) {
        const reply = await chat({ messages: studioMessages(kind, material, r), json: true, effort: 'low', strict: true, signal: signal() })
        data = normalizeStudio(kind, parseJson(reply), r)
      }
      if (!data) throw new AiError('BAD_RESPONSE')
      const item: StudioItem = {
        id: studioKey(book.id, kind, r), bookId: book.id, kind,
        from: r.from, to: r.to, createdAt: Date.now(), data,
      }
      await putStudio(item)
      // The range inputs are locked while a job runs, so this is still the
      // range on screen.
      setItems(cur => ({ ...cur, [kind]: item }))
    } catch (e: any) {
      if (!isAbort(e)) setErrs(x => ({ ...x, [kind]: studentMessage(e) }))
    } finally {
      setJob(null)
    }
  }

  const goto = (p: number) => { onGoto(p); onClose() }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 60, background: T.bg,
      display: open ? 'flex' : 'none', flexDirection: 'column', fontFamily: FONT, color: T.text,
    }}>
      {/* header */}
      <div style={{ padding: '12px 14px 0', borderBottom: `1px solid ${T.divider}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onClose} aria-label="Back to the page"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <ChevronLeft size={22} color={T.text2} {...ICON} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.3, color: T.accent, fontWeight: 700 }}>STUDY THIS BOOK</div>
            <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {book.title}
            </div>
          </div>
        </div>
        <div role="tablist" style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '12px 0 10px', scrollbarWidth: 'none' }}>
          {TABS.map(t => {
            const on = tab === t.id
            const working = t.id === 'ask' ? asking : job?.kind === t.id
            return (
              <button key={t.id} role="tab" aria-selected={on} onClick={() => setTab(t.id)} style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', borderRadius: 100, fontFamily: FONT, fontSize: 13, fontWeight: 600,
                background: on ? T.accentSurface : T.raised,
                border: `1px solid ${on ? T.accent : T.borderCtl}`,
                color: on ? T.text : T.muted, cursor: 'pointer',
              }}>
                {working
                  ? <Loader2 size={14} {...ICON} className="kyno-spin" />
                  : <t.icon size={14} color={on ? T.accentPale : T.faint} {...ICON} />}
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'ask' ? (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 190px' }}>
            {!turns.length && (
              <div style={{
                padding: 18, borderRadius: 16, border: `1px dashed ${T.dashed}`,
                color: T.muted, fontSize: 13.5, lineHeight: 1.6,
              }}>
                Ask anything about this book. Kyno answers from these pages only, and every
                answer shows the page it came from — tap it to go there.
              </div>
            )}
            {turns.map(t => (
              <div key={t.id} style={{ marginBottom: 16 }}>
                <div style={{
                  marginLeft: 'auto', maxWidth: '85%', width: 'fit-content', padding: '10px 14px',
                  borderRadius: '16px 16px 4px 16px', background: T.accentSurface, color: T.text,
                  fontSize: 14.5, lineHeight: 1.5,
                }}>
                  {t.q}
                </div>
                <div style={{
                  marginTop: 8, maxWidth: '92%', padding: '12px 14px', borderRadius: '16px 16px 16px 4px',
                  background: T.surface, border: `1px solid ${T.border}`,
                }}>
                  {t.status === 'thinking' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.muted, fontSize: 13.5 }}>
                      <Loader2 size={15} {...ICON} className="kyno-spin" /> Reading your book…
                    </div>
                  )}
                  {t.status === 'none' && (
                    <div style={{ color: T.text2, fontSize: 14, lineHeight: 1.6 }}>
                      That isn't in this book. Kyno only answers from these pages — ask in the
                      Doubt space for anything outside it.
                    </div>
                  )}
                  {t.status === 'error' && (
                    <div style={{ display: 'flex', gap: 8, color: T.warning, fontSize: 13.5, lineHeight: 1.5 }}>
                      <AlertTriangle size={16} {...ICON} style={{ flexShrink: 0, marginTop: 2 }} />{t.err}
                    </div>
                  )}
                  {t.status === 'done' && (
                    <>
                      <MathText text={t.text} style={{ fontSize: 14.5, lineHeight: 1.6, color: T.text }} />
                      {!!t.pages?.length && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                          {t.pages.map(p => <PageChip key={p} page={p} onGo={goto} />)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            {/* The margin is the ask box and the nav bar floating over the
                bottom: without it the newest answer scrolls in underneath them. */}
            <div ref={askEnd} style={{ scrollMarginBottom: 170 }} />
          </div>
          <form
            onSubmit={e => { e.preventDefault(); ask(askQ) }}
            style={{
              position: 'absolute', left: 14, right: 14, bottom: 'calc(84px + env(safe-area-inset-bottom))',
              zIndex: 2, display: 'flex', gap: 8, padding: 6, borderRadius: 16,
              background: T.sheet, border: `1px solid ${T.borderCtl}`, boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
            }}
          >
            <input
              value={askQ} onChange={e => setAskQ(e.target.value)} maxLength={500}
              placeholder="Ask about this book"
              aria-label="Ask about this book"
              style={{
                flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
                color: T.text, fontFamily: FONT, fontSize: 16, padding: '8px 10px',
              }}
            />
            <button type="submit" disabled={asking || !askQ.trim()} aria-label="Ask" style={{
              width: 42, height: 42, borderRadius: 12, border: 'none', flexShrink: 0,
              background: asking || !askQ.trim() ? T.raised : T.accent,
              cursor: asking || !askQ.trim() ? 'default' : 'pointer', display: 'grid', placeItems: 'center',
            }}>
              {asking
                ? <Loader2 size={17} color={T.muted} {...ICON} className="kyno-spin" />
                : <Send size={17} color={askQ.trim() ? '#fff' : T.faint} {...ICON} />}
            </button>
          </form>
        </>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 140px' }}>
          {/* which pages */}
          <div style={{
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8,
            fontSize: 13.5, color: T.muted, marginBottom: 14,
          }}>
            Pages
            <PageInput label="From page" value={fromS} onChange={setFromS} onCommit={commitRange} disabled={!!job} />
            to
            <PageInput label="To page" value={toS} onChange={setToS} onCommit={commitRange} disabled={!!job} />
            <span style={{ color: T.faint }}>of {count}</span>
          </div>
          {count > MAX_RANGE && (
            <div style={{ fontSize: 12, color: T.faint, marginTop: -8, marginBottom: 14 }}>
              Up to {MAX_RANGE} pages at a time — pick one chapter.
            </div>
          )}

          <StudioBody
            kind={tab}
            item={items[tab]}
            job={job?.kind === tab ? job.progress : ''}
            busyElsewhere={!!job && job.kind !== tab}
            err={errs[tab] || ''}
            range={range}
            bookTitle={book.title}
            onMake={() => make(tab)}
            onGo={goto}
            onAsk={q => ask(q)}
          />
        </div>
      )}
    </div>
  )
}

/* ── pieces ──────────────────────────────────────────────────────────────── */

function PageChip({ page, onGo }: { page: number | null; onGo: (p: number) => void }) {
  if (page == null) return null
  return (
    <button onClick={() => onGo(page)} aria-label={`Open page ${page}`} style={{
      flexShrink: 0, padding: '4px 9px', borderRadius: 100, border: `1px solid ${T.accent}`,
      background: T.accentSurface, color: T.accentPale, fontFamily: FONT, fontSize: 11.5,
      fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
    }}>
      p. {page}
    </button>
  )
}

function PageInput({ label, value, onChange, onCommit, disabled }: {
  label: string; value: string; onChange: (v: string) => void; onCommit: () => void; disabled: boolean
}) {
  return (
    <input
      aria-label={label} value={value} inputMode="numeric" disabled={disabled}
      onChange={e => onChange(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
      onBlur={onCommit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      style={{
        width: 58, padding: '8px 10px', borderRadius: 10, textAlign: 'center',
        background: T.raised, border: `1px solid ${T.borderCtl}`, color: T.text,
        fontFamily: FONT, fontSize: 16, outline: 'none',
      }}
    />
  )
}

const BLURB: Record<StudioKind, string> = {
  guide: 'The key ideas, formulas and likely exam questions from these pages.',
  faq: 'The questions students actually ask about these pages, answered from the book.',
  timeline: 'The dates — or the steps of a process — from these pages, in order.',
  mindmap: 'These pages as a map of ideas. Tap a branch to open it; tap a page to go there.',
}

function StudioBody({ kind, item, job, busyElsewhere, err, range, bookTitle, onMake, onGo, onAsk }: {
  kind: StudioKind
  item?: StudioItem
  job: string
  busyElsewhere: boolean
  err: string
  range: PageRange
  bookTitle: string
  onMake: () => void
  onGo: (p: number) => void
  onAsk: (q: string) => void
}) {
  const makeBtn = (label: string) => (
    <button onClick={onMake} disabled={!!job || busyElsewhere} style={{
      width: '100%', padding: '14px', borderRadius: 14, border: 'none',
      background: job || busyElsewhere ? T.raised : T.accent,
      color: job || busyElsewhere ? T.muted : '#fff',
      fontFamily: FONT, fontSize: 14.5, fontWeight: 700,
      cursor: job || busyElsewhere ? 'default' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
    }}>
      {job ? <><Loader2 size={16} {...ICON} className="kyno-spin" />{job}</> : label}
    </button>
  )

  if (!item) {
    return (
      <div>
        <div style={{ fontSize: 14, color: T.text2, lineHeight: 1.6, marginBottom: 14 }}>{BLURB[kind]}</div>
        {makeBtn(`Make the ${NAMES[kind]}`)}
        {busyElsewhere && !job && (
          <div style={{ fontSize: 12.5, color: T.faint, marginTop: 10, textAlign: 'center' }}>
            One thing at a time — this can start when the current one finishes.
          </div>
        )}
        {job && (
          <div style={{ fontSize: 12.5, color: T.faint, marginTop: 10, textAlign: 'center', lineHeight: 1.5 }}>
            You can go back to reading — it keeps going and will be here when you return.
          </div>
        )}
        {err && <ErrLine text={err} />}
      </div>
    )
  }

  return (
    <div>
      {kind === 'guide' && <GuideView guide={item.data as StudyGuide} stamp={item.createdAt} bookTitle={bookTitle} onGo={onGo} onAsk={onAsk} />}
      {kind === 'faq' && <FaqView faq={item.data as Faq} onGo={onGo} />}
      {kind === 'timeline' && <TimelineView tl={item.data as Timeline} onGo={onGo} />}
      {kind === 'mindmap' && <MindMapView map={item.data as MindMap} onGo={onGo} />}

      <div style={{
        marginTop: 22, paddingTop: 14, borderTop: `1px solid ${T.divider}`,
        display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: T.faint,
      }}>
        <span style={{ flex: 1 }}>
          Made from pages {range.from}–{range.to}. Check anything important against the page.
        </span>
        <button onClick={onMake} disabled={!!job || busyElsewhere} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10,
          background: T.raised, border: `1px solid ${T.borderCtl}`, color: job ? T.faint : T.text2,
          fontFamily: FONT, fontSize: 12.5, cursor: job || busyElsewhere ? 'default' : 'pointer', flexShrink: 0,
        }}>
          {job ? <Loader2 size={13} {...ICON} className="kyno-spin" /> : <RefreshCw size={13} {...ICON} />}
          {job ? 'Remaking…' : 'Remake'}
        </button>
      </div>
      {err && <ErrLine text={err} />}
    </div>
  )
}

/**
 * One formula, typeset the way the textbook prints it.
 *
 * Rendered with KaTeX directly rather than through MathText's markdown pass,
 * so nothing rewrites the LaTeX on the way. A formula KaTeX cannot read is
 * shown as the model wrote it -- plain text beats a line of red error.
 */
function Formula({ src }: { src: string }) {
  const html = useMemo(() => {
    try { return katex.renderToString(formulaTex(src), { ...KATEX_OPTS, throwOnError: true }) } catch { return null }
  }, [src])
  if (html == null) return <span style={{ fontSize: 14.5, fontWeight: 600 }}>{src}</span>
  return <span style={{ fontSize: 16 }} dangerouslySetInnerHTML={{ __html: html }} />
}

function ErrLine({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12, color: T.warning, fontSize: 13, lineHeight: 1.5 }}>
      <AlertTriangle size={16} {...ICON} style={{ flexShrink: 0, marginTop: 1 }} />{text}
    </div>
  )
}

const H: React.CSSProperties = { fontSize: 11.5, letterSpacing: 1.2, color: T.accentLite, fontWeight: 700, margin: '20px 0 10px' }
const CARD: React.CSSProperties = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: '12px 14px' }

function GuideView({ guide, stamp, bookTitle, onGo, onAsk }: {
  guide: StudyGuide; stamp: number; bookTitle: string; onGo: (p: number) => void; onAsk: (q: string) => void
}) {
  const [added, setAdded] = useState(0)
  useEffect(() => setAdded(0), [stamp])

  function addCards() {
    let n = 0
    for (const k of guide.keyConcepts) {
      try { recordFlashcard({ front: k.term, back: k.explanation, topic: bookTitle, source: 'manual' }); n++ } catch { /* skip that one */ }
    }
    setAdded(n || -1)
  }

  return (
    <div>
      {guide.title && <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.25 }}>{guide.title}</div>}
      {guide.overview && <MathText text={guide.overview} style={{ fontSize: 14.5, color: T.text2, lineHeight: 1.6, marginTop: 8 }} />}

      {!!guide.keyConcepts.length && (
        <>
          <div style={H}>KEY CONCEPTS</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {guide.keyConcepts.map((k, i) => (
              <div key={i} style={CARD}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <MathText text={k.term} style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700 }} />
                  <PageChip page={k.page} onGo={onGo} />
                </div>
                <MathText text={k.explanation} style={{ fontSize: 13.5, color: T.text2, lineHeight: 1.55, marginTop: 4 }} />
              </div>
            ))}
          </div>
          <button onClick={addCards} disabled={added !== 0} style={{
            width: '100%', marginTop: 10, padding: '12px', borderRadius: 12,
            background: added > 0 ? T.successBg : T.raised,
            border: `1px solid ${added > 0 ? T.successBorder : T.borderCtl}`,
            color: T.text, fontFamily: FONT, fontSize: 13.5, fontWeight: 600,
            cursor: added ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {added > 0
              ? <><Check size={15} color={T.success} {...ICON} />{added} flashcards added</>
              : added < 0
                ? 'Could not add the flashcards'
                : <><Layers size={15} color={T.accentPale} {...ICON} />Turn key concepts into flashcards</>}
          </button>
        </>
      )}

      {!!guide.formulas.length && (
        <>
          <div style={H}>FORMULAS</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {guide.formulas.map((f, i) => (
              <div key={i} style={CARD}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  {/* minWidth 0, or a long formula widens the card and pushes
                      the page chip off the screen instead of scrolling. */}
                  <div style={{
                    flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 10, background: T.well,
                    color: T.text, overflowX: 'auto',
                  }}>
                    <Formula src={f.formula} />
                  </div>
                  <PageChip page={f.page} onGo={onGo} />
                </div>
                {f.meaning && <MathText text={f.meaning} style={{ fontSize: 13.5, color: T.text2, lineHeight: 1.55, marginTop: 8 }} />}
              </div>
            ))}
          </div>
        </>
      )}

      {!!guide.examQuestions.length && (
        <>
          <div style={H}>LIKELY EXAM QUESTIONS</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {guide.examQuestions.map((q, i) => (
              <div key={i} style={CARD}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <span style={{ color: T.accentPale, fontWeight: 700, fontSize: 13.5 }}>{i + 1}.</span>
                  <MathText text={q.question} style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.55 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <button onClick={() => onAsk(q.question)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 100,
                    background: T.raised, border: `1px solid ${T.borderCtl}`, color: T.text2,
                    fontFamily: FONT, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>
                    <MessageCircle size={13} {...ICON} />Answer from the book
                  </button>
                  <PageChip page={q.page} onGo={onGo} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function FaqView({ faq, onGo }: { faq: Faq; onGo: (p: number) => void }) {
  const [openI, setOpenI] = useState<number | null>(0)
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {faq.items.map((it, i) => {
        const on = openI === i
        return (
          <div key={i} style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
            <button onClick={() => setOpenI(on ? null : i)} aria-expanded={on} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px',
              background: 'none', border: 'none', color: T.text, fontFamily: FONT,
              fontSize: 14.5, fontWeight: 600, textAlign: 'left', cursor: 'pointer', lineHeight: 1.4,
            }}>
              <MathText text={it.q} style={{ flex: 1, minWidth: 0 }} />
              <ChevronRight size={16} color={T.faint} {...ICON}
                style={{ transform: on ? 'rotate(90deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
            </button>
            {on && (
              <div style={{ padding: '0 14px 13px' }}>
                <MathText text={it.a} style={{ fontSize: 14, color: T.text2, lineHeight: 1.6 }} />
                <div style={{ marginTop: 8 }}><PageChip page={it.page} onGo={onGo} /></div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TimelineView({ tl, onGo }: { tl: Timeline; onGo: (p: number) => void }) {
  if (tl.kind === 'none' || !tl.items.length) {
    return (
      <div style={{ fontSize: 14, color: T.text2, lineHeight: 1.6 }}>
        These pages have no dates or step-by-step process to put on a timeline. Try the
        study guide or the mind map instead.
      </div>
    )
  }
  return (
    <div>
      <div style={{ fontSize: 12.5, color: T.faint, marginBottom: 12 }}>
        {tl.kind === 'dates' ? 'Events in order' : 'Steps in order'}
      </div>
      <div style={{ position: 'relative', paddingLeft: 22 }}>
        <div style={{ position: 'absolute', left: 6, top: 6, bottom: 6, width: 2, background: T.accentSurface, borderRadius: 2 }} />
        {tl.items.map((it, i) => (
          <div key={i} style={{ position: 'relative', marginBottom: 14 }}>
            <div style={{
              position: 'absolute', left: -21, top: 4, width: 12, height: 12, borderRadius: '50%',
              background: T.bg, border: `2px solid ${T.accent}`,
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: T.accentPale, letterSpacing: 0.3 }}>{it.when}</div>
              <PageChip page={it.page} onGo={onGo} />
            </div>
            <MathText text={it.what} style={{ fontSize: 14, color: T.text, lineHeight: 1.55, marginTop: 3 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

/*
 * The mind map is a left-to-right tree: root, branches, then each branch's
 * children when it is opened. Laid out by hand on a fixed grid rather than by
 * a graph library -- three columns and a row height is all a chapter needs,
 * and it scrolls sideways on a phone instead of shrinking to unreadable.
 */
const ROW = 52
const NODE_H = 42
const COL_X = [0, 128, 304]
const COL_W = [110, 156, 176]

function MindMapView({ map, onGo }: { map: MindMap; onGo: (p: number) => void }) {
  const [openB, setOpenB] = useState<Set<number>>(() => new Set())
  const allOpen = map.branches.every((b, i) => !b.children.length || openB.has(i))

  let row = 0
  const branches = map.branches.map((b, i) => {
    const expanded = openB.has(i) && b.children.length > 0
    if (expanded) {
      const kids = b.children.map(c => ({ ...c, y: (row++) * ROW }))
      return { ...b, i, expanded, kids, y: (kids[0].y + kids[kids.length - 1].y) / 2 }
    }
    return { ...b, i, expanded, kids: [] as Array<MindMap['branches'][number]['children'][number] & { y: number }>, y: (row++) * ROW }
  })
  const rootY = (branches[0].y + branches[branches.length - 1].y) / 2
  const height = Math.max(row, 1) * ROW
  const width = COL_X[2] + COL_W[2]
  const top = (y: number) => y + (ROW - NODE_H) / 2
  const mid = (y: number) => y + ROW / 2

  const link = (c: number, y1: number, y2: number) => {
    const x1 = COL_X[c] + COL_W[c]
    const x2 = COL_X[c + 1]
    const mx = (x1 + x2) / 2
    return `M ${x1} ${mid(y1)} C ${mx} ${mid(y1)}, ${mx} ${mid(y2)}, ${x2} ${mid(y2)}`
  }

  const toggle = (i: number) => setOpenB(s => {
    const n = new Set(s)
    if (n.has(i)) n.delete(i); else n.add(i)
    return n
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={() => setOpenB(allOpen ? new Set() : new Set(map.branches.map((_, i) => i)))} style={{
          padding: '7px 12px', borderRadius: 10, background: T.raised, border: `1px solid ${T.borderCtl}`,
          color: T.text2, fontFamily: FONT, fontSize: 12.5, cursor: 'pointer',
        }}>
          {allOpen ? 'Close all' : 'Open all'}
        </button>
      </div>
      <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
        <div style={{ position: 'relative', width, height }}>
          <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
            {branches.map(b => (
              <path key={`r${b.i}`} d={link(0, rootY, b.y)} fill="none" stroke={T.accent} strokeOpacity={0.55} strokeWidth={1.6} />
            ))}
            {branches.flatMap(b => b.kids.map((k, j) => (
              <path key={`b${b.i}-${j}`} d={link(1, b.y, k.y)} fill="none" stroke={T.borderCtl} strokeWidth={1.4} />
            )))}
          </svg>

          {/* root */}
          <div style={{
            position: 'absolute', left: COL_X[0], top: top(rootY), width: COL_W[0], height: NODE_H,
            borderRadius: 12, background: T.accent, color: '#fff', display: 'grid', placeItems: 'center',
            padding: '0 8px', fontSize: 12.5, fontWeight: 700, textAlign: 'center', lineHeight: 1.2,
          }}>
            <span style={CLAMP}>{map.root}</span>
          </div>

          {branches.map(b => (
            <div key={b.i} style={{
              position: 'absolute', left: COL_X[1], top: top(b.y), width: COL_W[1], height: NODE_H,
              borderRadius: 12, background: b.expanded ? T.accentSurface : T.surface,
              border: `1px solid ${b.expanded ? T.accent : T.border}`,
              display: 'flex', alignItems: 'center', gap: 4, padding: '0 4px 0 0',
            }}>
              <button onClick={() => b.children.length && toggle(b.i)} aria-expanded={b.expanded}
                style={{
                  flex: 1, minWidth: 0, height: '100%', background: 'none', border: 'none', textAlign: 'left',
                  padding: '0 4px 0 10px', color: T.text, fontFamily: FONT, fontSize: 12.5, fontWeight: 600,
                  lineHeight: 1.2, cursor: b.children.length ? 'pointer' : 'default',
                }}>
                <span style={CLAMP}>{b.label}</span>
              </button>
              {b.page != null
                ? <MapPage page={b.page} onGo={onGo} />
                : b.children.length > 0 && <span style={{ fontSize: 11, color: T.faint, paddingRight: 6 }}>{b.children.length}</span>}
            </div>
          ))}

          {branches.flatMap(b => b.kids.map((k, j) => (
            <button key={`${b.i}-${j}`} onClick={() => k.page != null && onGo(k.page)}
              disabled={k.page == null}
              aria-label={k.page != null ? `${k.label}, open page ${k.page}` : k.label}
              style={{
                position: 'absolute', left: COL_X[2], top: top(k.y), width: COL_W[2], height: NODE_H,
                borderRadius: 12, background: T.raised, border: `1px solid ${T.borderCtl}`,
                display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px 0 10px',
                color: T.text2, fontFamily: FONT, fontSize: 12, textAlign: 'left', lineHeight: 1.2,
                cursor: k.page != null ? 'pointer' : 'default',
              }}>
              <span style={{ ...CLAMP, flex: 1 }}>{k.label}</span>
              {k.page != null && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.accentPale, flexShrink: 0 }}>p.{k.page}</span>}
            </button>
          )))}
        </div>
      </div>
    </div>
  )
}

const CLAMP: React.CSSProperties = {
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
}

function MapPage({ page, onGo }: { page: number; onGo: (p: number) => void }) {
  return (
    <button onClick={() => onGo(page)} aria-label={`Open page ${page}`} style={{
      flexShrink: 0, padding: '3px 6px', borderRadius: 100, border: `1px solid ${T.accent}`,
      background: T.bg, color: T.accentPale, fontFamily: FONT, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
    }}>
      p.{page}
    </button>
  )
}
