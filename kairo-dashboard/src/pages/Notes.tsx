/**
 * Notes — one library.
 *
 * AI Notebook, Formula Sheet, Writing Tools, Concept Tools, Revision Reels and
 * Listen become one space. Nothing is stored without a return date: every save
 * makes cards, the cards enter the scheduler, and the note shows when it comes
 * back. No folders -- folders are where notes go to die.
 *
 * WHAT IS AI HERE: only the marking scheme on the writing screen. Notes,
 * formulas, search, counts, return dates and card generation are stored rows
 * and the deterministic cloze builder, so all of it works offline.
 *
 * WHAT THIS SPACE WILL NOT DO: write the student's answer. The writing screen
 * shows what the scheme wants, says what is missing, flags length. It never
 * produces the sentences -- that is the part that earns the marks.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Search, ChevronRight, ArrowLeft, Bookmark, Check, Play, Pause, Mic, Printer, Layers, Headphones, PenLine, FunctionSquare, AlertTriangle, Plus, X } from 'lucide-react'
import { SPACE_VIEW_EVENT, publishSpaceView } from '../lib/spaces.core'
import { T, FONT, MONO, ICON, CALLOUT, ERR } from '../lib/spaceTokens'
import type { ErrorType } from '../lib/spaceTokens'
import { post } from '../lib/api'
import { listNotebook, saveToNotebook, getNotebookEntry, updateNotebookEntry } from '../lib/notebook'
import type { NoteEntry } from '../lib/notebook'
import { listFlashcards, listFormulas, listDoubts, loadState, recordFlashcard, reviewFlashcard, recordMistake, getProfile, getMistakes } from '../lib/twin'
import { graphForProfile } from '../lib/syllabusFor'
import { matchChapter } from '../lib/syllabusGraph.core'
import { getJSON, setJSON } from '../lib/storage'
import { nearestExamDays } from '../lib/examDate'
import { buildDeck } from '../lib/reels.core'
import { speakableText } from '../lib/listen.core'
import { speak, stopSpeaking, pauseSpeaking, resumeSpeaking, ttsAvailable } from '../lib/tts'
import { mistakeRecords, patterns as computePatterns } from '../lib/performance.core'
import { topicGroups } from '../lib/performance.core'
import {
  provenanceLabel, originLine, returnLabel, attachCards, noteStats, cardsForNote, unifiedSearch, dueSummary,
  boldTriggers, splitBody, formulaFlags, chapterChips, pickClips, wordJudgement, schemeCheck,
} from '../lib/notes.core'
import type { SheetFormula, Requirement, Clip } from '../lib/notes.core'
import SHEET from '../data/formulas.cbse10.json'

type Style = React.CSSProperties
const CARDS_KEY = 'kyno:notes:cards'
const BOOKMARK_KEY = 'kyno:notes:formula-bookmarks'
const RATE_KEY = 'kyno:notes:playback-rate'

/* ── shared bits ─────────────────────────────────────────────────────────── */

function Eyebrow({ children, color = T.accent }: { children: React.ReactNode; color?: string }) {
  return <div style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: 700, color, textTransform: 'uppercase' }}>{children}</div>
}
function Card({ children, style, onClick }: { children: React.ReactNode; style?: Style; onClick?: () => void }) {
  return (
    <div onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, cursor: onClick ? 'pointer' : undefined, ...style }}>
      {children}
    </div>
  )
}
function Primary({ children, onClick, style, disabled }: { children: React.ReactNode; onClick?: () => void; style?: Style; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', height: 52, borderRadius: 14, border: 'none', background: disabled ? T.raised : T.accent, color: disabled ? T.faint : '#fff',
      fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...style,
    }}>{children}</button>
  )
}
function Secondary({ children, onClick, style }: { children: React.ReactNode; onClick?: () => void; style?: Style }) {
  return (
    <button onClick={onClick} style={{
      height: 52, padding: '0 16px', borderRadius: 14, background: T.raised, border: `1px solid ${T.borderCtl}`,
      color: T.text2, fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', ...style,
    }}>{children}</button>
  )
}
function Back({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', color: T.muted, fontFamily: FONT, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0, minHeight: 44 }}>
      <ArrowLeft size={17} {...ICON} /> Back
    </button>
  )
}
function Pill({ children, on, onClick }: { children: React.ReactNode; on?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      minHeight: 36, padding: '0 12px', borderRadius: 100, fontFamily: FONT, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
      flexShrink: 0, whiteSpace: 'nowrap',   // in a scrolling chip row a pill scrolls, it never squashes into a four-line blob
      background: on ? T.accentSurface : T.raised, border: `1px solid ${on ? T.accent : T.borderCtl}`, color: on ? T.accentPale : T.muted,
    }}>{children}</button>
  )
}

/* ── data ─────────────────────────────────────────────────────────────────── */

function readIndex(): Record<string, string[]> { return getJSON(CARDS_KEY) || {} }

function useLibrary(tick: number) {
  return useMemo(() => {
    const notes = (() => { try { return listNotebook({ limit: 200 }) } catch { return [] as NoteEntry[] } })()
    const cards = (() => { try { return listFlashcards() } catch { return [] } })()
    const doubts = (() => { try { return listDoubts(200) } catch { return [] } })()
    const own = (() => { try { return listFormulas() } catch { return [] } })()
    const st = (() => { try { return loadState() } catch { return { events: [], mastery: [] } as any } })()
    const index = readIndex()
    // Each slip is placed in its syllabus chapter, so the formula sheet flags only the lines it was really about.
    const graph = (() => { try { return graphForProfile(getProfile()) } catch { return null } })()
    const records = mistakeRecords(st.events).map(r => ({ ...r, chapter: graph ? matchChapter(graph, r.subject, r.topic) : null }))
    return { notes, cards, doubts, own, index, events: st.events, mastery: st.mastery, records }
  }, [tick])
}

const SHEET_FORMULAS = (SHEET as any).formulas as SheetFormula[]

/* ── the page ─────────────────────────────────────────────────────────────── */

type View = { name: 'library' } | { name: 'note'; id: string } | { name: 'formulas' } | { name: 'watch' } | { name: 'write'; noteId?: string } | { name: 'new' }

export default function Notes({ onOpenDoubt, onPractice }: {
  onOpenDoubt?: (seed: string) => void
  onPractice?: (filter: { topics?: string[]; cardIds?: string[] }) => void
}) {
  const [view, setView] = useState<View>({ name: 'library' })
  const [tick, setTick] = useState(0)
  const lib = useLibrary(tick + (view.name === 'library' ? 0 : 0))
  const [q, setQ] = useState('')

  useEffect(() => {
    const on = () => setTick(t => t + 1)
    window.addEventListener('kyno:focus-banked', on)
    return () => window.removeEventListener('kyno:focus-banked', on)
  }, [])

  /**
   * Any note without cards gets them, once.
   *
   * Notes saved from the solver, teach-back and Mistake Explained never went
   * through the card builder, so the library listed them as "0 cards" -- a
   * note with no return date, which is the one thing this space promises not
   * to keep. The builder is deterministic and offline, so this is a local
   * repair, not a request: nothing is pending and nothing can fail.
   *
   * A note that genuinely cannot yield a card (empty, or a couple of words)
   * is left alone and says so, rather than being retried forever.
   */
  useEffect(() => {
    const index = readIndex()
    const missing = lib.notes.filter(n => !(index[n.id] || []).length && String(n.content || '').trim().length > 24)
    if (!missing.length) return
    let changed = false
    let next = index
    for (const n of missing) {
      const built = cardsForNote(n.title, n.content, { max: 4 })
      if (!built.length) continue
      const ids: string[] = []
      for (const c of built) {
        try { ids.push(recordFlashcard({ front: c.front, back: c.back, subject: n.subject || undefined, topic: n.tags?.[0] || undefined }).id) }
        catch { /* storage full: stop, do not half-write */ }
      }
      if (ids.length) { next = attachCards(next, n.id, ids); changed = true }
    }
    if (changed) {
      try { setJSON(CARDS_KEY, next) } catch { /* storage blocked */ }
      setTick(t => t + 1)
    }
  }, [lib.notes])
  // A redirect may ask this space to open on a particular screen: #/formula
  // must land on the formula sheet, not the library index.
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (d?.space !== 'notes') return
      if (d.view === 'formulas' || d.view === 'watch' || d.view === 'write' || d.view === 'library') setView({ name: d.view })
    }
    window.addEventListener(SPACE_VIEW_EVENT, on)
    return () => window.removeEventListener(SPACE_VIEW_EVENT, on)
  }, [])


  // The URL is the record of where you are: every move this space makes is
  // reported so the address bar matches the screen.
  useEffect(() => { publishSpaceView('notes', view.name) }, [view.name])

  const shell: Style = { position: 'absolute', inset: 0, background: T.bg, color: T.text, fontFamily: FONT, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
  const scroll: Style = { flex: 1, overflowY: 'auto', padding: '18px 14px 24px' }
  const footer: Style = { padding: '12px 14px calc(12px + env(safe-area-inset-bottom))', borderTop: `1px solid ${T.divider}`, background: T.bgAlt, display: 'flex', gap: 10 }

  /** Save any text as a note + cards + index. Returns the note id. */
  const saveNote = useCallback(async (title: string, content: string, source: string, subject?: string | null, topic?: string | null) => {
    const { id } = await saveToNotebook({ kind: 'note', title: title.slice(0, 120), content, subject: subject ?? null, tags: topic ? [topic] : [], source })
    const ids: string[] = []
    for (const c of cardsForNote(title, content, { max: 3 })) {
      try { ids.push(recordFlashcard({ front: c.front, back: c.back, subject: subject || undefined, topic: topic || undefined, source: 'auto-from-note' }).id) } catch { /* nicety */ }
    }
    try { setJSON(CARDS_KEY, attachCards(readIndex(), id, ids)) } catch { /* storage blocked */ }
    setTick(t => t + 1)
    return id
  }, [])

  /* ── screen 1: library ───────────────────────────────────────────────────── */
  if (view.name === 'library' || view.name === 'new') {
    const due = dueSummary(lib.cards, lib.index)
    const results = q.trim() ? unifiedSearch(q, { notes: lib.notes, formulas: [...SHEET_FORMULAS, ...lib.own], doubts: lib.doubts }) : []
    const bookmarks: string[] = getJSON(BOOKMARK_KEY) || []
    return (
      <div style={shell}>
        <div style={scroll}>
          <Eyebrow>Notes</Eyebrow>
          <h1 style={{ fontSize: 25, fontWeight: 700, margin: '8px 0 0', letterSpacing: -0.3 }}>Your library</h1>

          <div style={{ position: 'relative', marginTop: 14 }}>
            <Search size={17} color={T.faint} {...ICON} style={{ position: 'absolute', left: 16, top: 14 }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search notes, formulas and doubts" aria-label="Search"
              style={{ width: '100%', height: 46, borderRadius: 100, padding: '0 16px 0 42px', background: T.raised, border: `1px solid ${T.borderCtl}`, color: T.text, fontFamily: FONT, fontSize: 16, boxSizing: 'border-box', outline: 'none' }} />
          </div>

          {q.trim() ? (
            <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
              {results.length === 0 && <div style={{ fontSize: 13.5, color: T.dim, padding: '8px 2px' }}>Nothing matches "{q}" yet.</div>}
              {results.map(r => (
                <Card key={`${r.kind}-${r.id}`} style={{ padding: 12, borderRadius: 15 }} onClick={() => {
                  if (r.kind === 'note') setView({ name: 'note', id: r.id })
                  else if (r.kind === 'formula') setView({ name: 'formulas' })
                  else onOpenDoubt?.(r.title)
                }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: T.accentSurface, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      {r.kind === 'formula' ? <FunctionSquare size={15} color={T.accentPale} {...ICON} /> : r.kind === 'doubt' ? <Search size={15} color={T.accentPale} {...ICON} /> : <Bookmark size={15} color={T.accentPale} {...ICON} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                      <div style={{ fontSize: 11.5, color: T.faint, marginTop: 2, fontFamily: r.kind === 'formula' ? MONO : FONT }}>{r.sub}</div>
                    </div>
                    <ChevronRight size={16} color={T.fainter} {...ICON} />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {due && (
                <div style={{ marginTop: 14, padding: 14, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12, ...CALLOUT.purple }}>
                  <div style={{ flex: 1 }}>
                    <Eyebrow>Coming back to you</Eyebrow>
                    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>{due.headline}</div>
                    <div style={{ fontSize: 12.5, color: T.accentPale, marginTop: 3 }}>{due.sub}</div>
                  </div>
                  <button onClick={() => onPractice?.({ cardIds: due.ids })} style={{ height: 40, padding: '0 16px', borderRadius: 100, background: T.accent, border: 'none', color: '#fff', fontFamily: FONT, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Review</button>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 20 }}>
                <Eyebrow color={T.muted}>Saved</Eyebrow>
                <span style={{ fontSize: 12.5, color: T.text2, fontWeight: 600 }}>{lib.notes.length}</span>
              </div>
              {lib.notes.length === 0 ? (
                <Card style={{ marginTop: 10 }}><div style={{ fontSize: 14, color: T.text2, lineHeight: 1.55 }}>Nothing saved yet. When Kyno answers a doubt, tap save and it turns into cards that come back to you.</div></Card>
              ) : (
                <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                  {lib.notes.map(n => {
                    const st = noteStats(n.id, lib.index, lib.cards, lib.events)
                    return (
                      <Card key={n.id} onClick={() => setView({ name: 'note', id: n.id })} style={{ padding: 12, borderRadius: 15 }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.title}</div>
                            <div style={{ fontSize: 12, marginTop: 5, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ color: T.dim }}>{st.cards} card{st.cards === 1 ? '' : 's'}</span>
                              {st.nextLabel && <span style={{ color: T.accentPale }}>· {st.nextLabel}</span>}
                            </div>
                          </div>
                          <span style={{ fontSize: 11, color: T.faint, flexShrink: 0, textAlign: 'right', maxWidth: 96 }}>{provenanceLabel(n.source, n.kind)}</span>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
                <Card onClick={() => setView({ name: 'formulas' })}>
                  <FunctionSquare size={18} color={T.accentPale} {...ICON} />
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 10 }}>Formula sheet</div>
                  <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>{SHEET_FORMULAS.length + lib.own.length} formulas{bookmarks.length ? ` · ${bookmarks.length} saved` : ''}</div>
                </Card>
                <Card onClick={() => setView({ name: 'watch' })}>
                  <Headphones size={18} color={T.accentPale} {...ICON} />
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 10 }}>Watch & listen</div>
                  <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>Six for your gaps</div>
                </Card>
              </div>
            </>
          )}
        </div>
        <div style={footer}>
          <Secondary onClick={() => setView({ name: 'write' })} style={{ flex: 1 }}><PenLine size={15} {...ICON} /> Long answer</Secondary>
          <Primary onClick={() => setView({ name: 'new' })} style={{ flex: 1 }}><Plus size={17} {...ICON} /> New note</Primary>
        </div>
        {view.name === 'new' && <NewNoteSheet onClose={() => setView({ name: 'library' })} onSave={async (t, c) => { const id = await saveNote(t, c, 'manual', (getProfile() as any)?.subject || null, null); setView({ name: 'note', id }) }} />}
      </div>
    )
  }

  /* ── screen 2: note ──────────────────────────────────────────────────────── */
  if (view.name === 'note') {
    const n = getNotebookEntry(view.id)
    const st = n ? noteStats(n.id, lib.index, lib.cards, lib.events) : null
    const sourceDoubt = n ? lib.doubts.find(d => d.question && n.title && d.question.trim() === n.title.trim()) : null
    return (
      <div style={shell}>
        <div style={scroll}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Back onClick={() => setView({ name: 'library' })} />
            {n && <button onClick={() => setView({ name: 'write', noteId: n.id })} aria-label="Edit" style={{ width: 44, height: 44, background: 'none', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><PenLine size={17} color={T.muted} {...ICON} /></button>}
          </div>
          {!n ? (
            <Card style={{ marginTop: 14 }}><div style={{ fontSize: 13.5, color: T.text2 }}>That note is not in your library any more.</div></Card>
          ) : (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: '10px 0 0', lineHeight: 1.3, letterSpacing: -0.3 }}>{n.title}</h1>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                {n.subject && <span style={{ fontSize: 10.5, letterSpacing: 1.2, fontWeight: 700, color: T.accentPale, background: T.accentSurface, borderRadius: 100, padding: '4px 9px' }}>{n.subject.toUpperCase()}</span>}
                <span style={{ fontSize: 12.5, color: T.dim }}>{originLine(n)}</span>
              </div>

              <div style={{ marginTop: 16, fontSize: 15, lineHeight: 1.7, color: T.text2 }}>
                {splitBody(n.content).map((seg, i) => seg.kind === 'eq'
                  ? <pre key={i} style={{ margin: '10px 0', padding: '10px 12px', borderRadius: 12, background: T.well, border: `1px solid ${T.divider}`, fontFamily: MONO, fontSize: 14, color: T.text, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>{seg.text}</pre>
                  : seg.kind === 'heading'
                    ? <div key={i} style={{ fontSize: 13.5, fontWeight: 700, color: T.text, margin: i === 0 ? '0 0 6px' : '16px 0 6px' }}>{seg.text}</div>
                    : <p key={i} style={{ margin: '0 0 10px' }}>{boldTriggers(seg.text.replace(/\*\*/g, '')).map((p, k) => p.bold ? <strong key={k} style={{ color: T.text }}>{p.text}</strong> : <span key={k}>{p.text}</span>)}</p>
                )}
              </div>

              <div style={{ marginTop: 16, padding: 16, borderRadius: 16, ...CALLOUT.purple }}>
                <Eyebrow>This note is alive</Eyebrow>
                <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <Layers size={16} color={T.accentPale} {...ICON} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div><div style={{ fontSize: 14, fontWeight: 600 }}>{st!.cards} flashcard{st!.cards === 1 ? '' : 's'} made from it</div>{st!.nextLabel && <div style={{ fontSize: 12.5, color: T.accentPale, marginTop: 2 }}>Next one comes {st!.nextLabel === 'due now' ? 'back today' : st!.nextLabel}</div>}</div>
                  </div>
                  {st!.total > 0 && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <Check size={16} color={T.success} {...ICON} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div><div style={{ fontSize: 14, fontWeight: 600 }}>Answered right {st!.right} of {st!.total} times</div><div style={{ fontSize: 12.5, color: T.dim, marginTop: 2 }}>Since you saved it</div></div>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: T.dim, lineHeight: 1.5, marginTop: 14, borderTop: `1px solid ${T.divider2}`, paddingTop: 12 }}>Saving something here schedules it. A note you never see again is not a note.</div>
              </div>

              <div style={{ marginTop: 14, fontSize: 12.5, color: T.faint }}>
                {provenanceLabel(n.source, n.kind)}
                {sourceDoubt && <button onClick={() => onOpenDoubt?.(sourceDoubt.question)} style={{ marginLeft: 8, background: 'none', border: 'none', padding: 0, color: T.accentPale, fontFamily: FONT, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Open the doubt →</button>}
              </div>
            </>
          )}
        </div>
        {n && (
          <div style={footer}>
            <Secondary style={{ flex: 1 }} onClick={() => {
              const more = cardsForNote(n.title, n.content, { max: 6 }).slice(st!.cards)
              const ids: string[] = []
              for (const c of more) { try { ids.push(recordFlashcard({ front: c.front, back: c.back, subject: n.subject || undefined, topic: n.tags?.[0], source: 'auto-from-note' }).id) } catch { /* nicety */ } }
              try { setJSON(CARDS_KEY, attachCards(readIndex(), n.id, ids)) } catch { /* ignore */ }
              setTick(t => t + 1)
            }}>Make more cards</Secondary>
            <Primary style={{ flex: 1 }} onClick={() => onPractice?.({ cardIds: lib.index[n.id] || [], topics: n.tags?.length ? n.tags : undefined })}>Practise now</Primary>
          </div>
        )}
      </div>
    )
  }

  /* ── screen 3: formulas ──────────────────────────────────────────────────── */
  if (view.name === 'formulas') {
    return <FormulaScreen shell={shell} scroll={scroll} footer={footer} records={lib.records} own={lib.own} onBack={() => setView({ name: 'library' })} />
  }

  /* ── screen 4: watch & listen ────────────────────────────────────────────── */
  if (view.name === 'watch') {
    return <WatchScreen shell={shell} scroll={scroll} footer={footer} lib={lib} onBack={() => setView({ name: 'library' })} onOpenDoubt={onOpenDoubt} onTick={() => setTick(t => t + 1)} />
  }

  /* ── screen 5: write ─────────────────────────────────────────────────────── */
  return <WriteScreen shell={shell} scroll={scroll} footer={footer} noteId={view.noteId} onBack={() => setView({ name: 'library' })} onSaved={id => setView({ name: 'note', id })} saveNote={saveNote} />
}

/* ── new note sheet ───────────────────────────────────────────────────────── */

function NewNoteSheet({ onClose, onSave }: { onClose: () => void; onSave: (title: string, content: string) => Promise<void> }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(5,5,12,.66)', display: 'flex', alignItems: 'flex-end', zIndex: 40 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: T.sheet, borderRadius: '26px 26px 0 0', borderTop: `1px solid ${T.border}`, padding: '10px 18px calc(18px + env(safe-area-inset-bottom))' }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: T.borderCtl, margin: '0 auto 16px' }} />
        <Eyebrow>New note</Eyebrow>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" aria-label="Title"
          style={{ width: '100%', height: 46, marginTop: 10, borderRadius: 12, padding: '0 12px', background: T.raised, border: `1px solid ${T.borderCtl}`, color: T.text, fontFamily: FONT, fontSize: 16, boxSizing: 'border-box' }} />
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={6} placeholder="What do you want to remember? Equations on their own line." aria-label="Note"
          style={{ width: '100%', marginTop: 10, borderRadius: 12, padding: 12, background: T.well, border: `1px solid ${T.borderCtl}`, color: T.text2, fontFamily: FONT, fontSize: 16, lineHeight: 1.6, boxSizing: 'border-box', resize: 'vertical' }} />
        <div style={{ fontSize: 12, color: T.dim, marginTop: 8 }}>Saving makes flashcards from this and schedules them.</div>
        <div style={{ marginTop: 12 }}><Primary disabled={!title.trim() || !content.trim()} onClick={() => onSave(title.trim(), content.trim())}>Save and schedule</Primary></div>
      </div>
    </div>
  )
}

/* ── screen 3 ─────────────────────────────────────────────────────────────── */

function FormulaScreen({ shell, scroll, footer, records, own, onBack }: { shell: Style; scroll: Style; footer: Style; records: any[]; own: any[]; onBack: () => void }) {
  const [q, setQ] = useState('')
  const [chapter, setChapter] = useState<string | null>(null)
  const [marks, setMarks] = useState<string[]>(() => getJSON(BOOKMARK_KEY) || [])
  const flags = useMemo(() => formulaFlags(SHEET_FORMULAS, records), [records])
  const chips = useMemo(() => chapterChips(SHEET_FORMULAS), [])
  const ownRows: SheetFormula[] = own.map((f: any) => ({ id: `own-${f.id}`, chapter: '', chapterName: f.topic || 'Saved by you', name: f.name, expr: f.expr, when: 'You saved this one yourself.', signatures: [] }))
  const rows = [...SHEET_FORMULAS, ...ownRows].filter(f => (!chapter || f.chapterName === chapter) && (!q.trim() || unifiedSearch(q, { formulas: [f] }).length > 0))
  const toggle = (id: string) => { const next = marks.includes(id) ? marks.filter(m => m !== id) : [...marks, id]; setMarks(next); try { setJSON(BOOKMARK_KEY, next) } catch { /* ignore */ } }

  return (
    <div style={shell}>
      <style>{`@media print { body * { visibility: hidden !important; } .kyno-print, .kyno-print * { visibility: visible !important; } .kyno-print { position: absolute; inset: 0; background: #fff !important; color: #000 !important; padding: 12mm; column-count: 2; column-gap: 10mm; font-family: Georgia, serif; } .kyno-print .kyno-no-print { display: none !important; } .kyno-print pre { color: #000 !important; background: none !important; border: none !important; font-size: 12pt; } .kyno-print .kyno-print-row { break-inside: avoid; border-bottom: 1px solid #ccc; padding: 6px 0; } }`}</style>
      <div style={scroll}>
        <Back onClick={onBack} />
        <div style={{ marginTop: 6 }}><Eyebrow>Formula sheet</Eyebrow></div>
        <div style={{ position: 'relative', marginTop: 12 }} className="kyno-no-print">
          <Search size={17} color={T.faint} {...ICON} style={{ position: 'absolute', left: 16, top: 14 }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search formulas" aria-label="Search formulas"
            style={{ width: '100%', height: 46, borderRadius: 100, padding: '0 16px 0 42px', background: T.raised, border: `1px solid ${T.borderCtl}`, color: T.text, fontFamily: FONT, fontSize: 16, boxSizing: 'border-box', outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', paddingBottom: 4 }} className="kyno-no-print">
          <Pill on={!chapter} onClick={() => setChapter(null)}>All</Pill>
          {chips.map(c => <Pill key={c.name} on={chapter === c.name} onClick={() => setChapter(chapter === c.name ? null : c.name)}>{c.name.replace(/ — .*$/, '')} · {c.count}</Pill>)}
        </div>

        <div className="kyno-print" style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {rows.map(f => {
            const flag = flags.get(f.id)
            return (
              <Card key={f.id} style={{ borderRadius: 16 }} >
                <div className="kyno-print-row">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: T.faint, letterSpacing: 0.4 }}>{f.chapterName} · {f.name}</div>
                      <pre style={{ margin: '8px 0 0', fontFamily: MONO, fontSize: 19, fontWeight: 600, color: T.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowX: 'auto' }}>{f.expr}</pre>
                    </div>
                    <button onClick={() => toggle(f.id)} aria-label={marks.includes(f.id) ? 'Remove bookmark' : 'Bookmark'} className="kyno-no-print"
                      style={{ width: 44, height: 44, marginRight: -8, marginTop: -8, background: 'none', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                      <Bookmark size={18} color={marks.includes(f.id) ? T.accent : T.faint} fill={marks.includes(f.id) ? T.accent : 'none'} {...ICON} />
                    </button>
                  </div>
                  <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.5, marginTop: 8 }}>{f.when}</div>
                  {flag && (
                    <div className="kyno-no-print" style={{ marginTop: 10, display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, background: T.warningBg, border: `1px solid ${T.warningBorder}` }}>
                      <AlertTriangle size={15} color={T.warning} {...ICON} style={{ flexShrink: 0, marginTop: 1 }} />
                      <div style={{ fontSize: 12.5, color: '#E5C08A', lineHeight: 1.5 }}>{flag.line}</div>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
          {rows.length === 0 && <div style={{ fontSize: 13.5, color: T.dim }}>No formulas match.</div>}
        </div>
      </div>
      <div style={footer} className="kyno-no-print">
        <Primary onClick={() => { try { window.print() } catch { /* ignore */ } }}><Printer size={17} {...ICON} /> Export as one page to print</Primary>
      </div>
    </div>
  )
}

/* ── screen 4 ─────────────────────────────────────────────────────────────── */

function WatchScreen({ shell, scroll, footer, lib, onBack, onOpenDoubt, onTick }: { shell: Style; scroll: Style; footer: Style; lib: ReturnType<typeof useLibrary>; onBack: () => void; onOpenDoubt?: (s: string) => void; onTick: () => void }) {
  const picked = useMemo(() => {
    const deck = buildDeck({ formulas: lib.own, flashcards: lib.cards })
    const groups = topicGroups(lib.records, lib.mastery)
    const weak = [...groups.relearn, ...groups.tighten].map(t => ({ topic: t.topic, marksLost: t.marksLost, dominant: t.dominant, recent3w: t.recent3w }))
    const pats = computePatterns(lib.records)
    return pickClips(deck, weak, { max: 6, patterns: pats.all })
  }, [lib])
  const [open, setOpen] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [playing, setPlaying] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  /**
   * Playback speed, remembered.
   *
   * It offered 1x, 1.25x and 1.5x and forgot the choice the moment the screen
   * closed, so a student who prefers 1.5x reset it every single time. 2x is
   * there now too -- revision listening is usually a second pass.
   */
  const [rate, setRateState] = useState<number>(() => {
    try { const v = Number(getJSON<number>(RATE_KEY)); return [1, 1.25, 1.5, 2].includes(v) ? v : 1 } catch { return 1 }
  })
  const setRate = (r: number) => {
    setRateState(r)
    try { setJSON(RATE_KEY, r) } catch { /* storage blocked */ }
  }
  const queue = useRef<Clip[]>([])

  useEffect(() => () => { try { stopSpeaking() } catch { /* ignore */ } }, [])

  function playFrom(i: number) {
    const items = picked.items
    if (!ttsAvailable() || i >= items.length) { setPlaying(null); return }
    const c = items[i]
    setPlaying(c.id); setPaused(false)
    try {
      if ('mediaSession' in navigator) {
        (navigator as any).mediaSession.metadata = new (window as any).MediaMetadata({ title: c.front.slice(0, 80), artist: 'Kyno · Listen', album: c.topic || c.subject || 'Revision' })
        ;(navigator as any).mediaSession.setActionHandler('pause', () => { pauseSpeaking(); setPaused(true) })
        ;(navigator as any).mediaSession.setActionHandler('play', () => { resumeSpeaking(); setPaused(false) })
        ;(navigator as any).mediaSession.setActionHandler('nexttrack', () => { stopSpeaking(); playFrom(i + 1) })
      }
    } catch { /* not supported */ }
    const script = `${speakableText(c.front)}. ... ${speakableText(c.back)}.`
    // One item, then the next -- and then it stops. Never a loop.
    speak(script, { rate, onend: () => playFrom(i + 1), onerror: () => setPlaying(null) })
  }

  const grad = (i: number) => `linear-gradient(135deg, hsl(${250 + (i * 23) % 40} 60% ${22 + (i % 3) * 6}%), hsl(${215 + (i * 17) % 30} 55% ${14 + (i % 2) * 6}%))`

  return (
    <div style={shell}>
      <div style={scroll}>
        <Back onClick={onBack} />
        <div style={{ marginTop: 6 }}><Eyebrow>Watch & listen</Eyebrow></div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '8px 0 0', lineHeight: 1.3 }}>{picked.items.length ? `${['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'][picked.items.length]} clips for your gaps` : 'Nothing to play yet'}</h1>
        <div style={{ fontSize: 13.5, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>
          {picked.items.length === 0 ? 'Save a note or answer some questions and Kyno will pick from your own cards.'
            : picked.general ? 'Not a feed. No weak topics recorded yet, so these are from your own cards — and the list ends.'
            : 'Not a feed. These are chosen from the topics you are actually weak on, and the list ends.'}
        </div>

        {picked.items.map((c, i) => {
          const isOpen = open === c.id
          const dot = ERR[(c.type as ErrorType) in ERR ? (c.type as ErrorType) : 'conceptual']
          return (
            <Card key={c.id} style={{ marginTop: i === 0 ? 16 : 10, padding: 0, overflow: 'hidden' }}>
              <div role="button" tabIndex={0} onClick={() => { setOpen(isOpen ? null : c.id); setRevealed(false) }} onKeyDown={e => { if (e.key === 'Enter') { setOpen(isOpen ? null : c.id); setRevealed(false) } }}
                style={{ display: 'flex', gap: 12, alignItems: 'center', padding: i === 0 ? 0 : 10, cursor: 'pointer', flexDirection: i === 0 ? 'column' : 'row' }}>
                <div style={{ width: i === 0 ? '100%' : 76, height: i === 0 ? 118 : 56, flexShrink: 0, borderRadius: i === 0 ? 0 : 10, background: grad(i), display: 'grid', placeItems: 'center' }}>
                  <Play size={i === 0 ? 30 : 18} color="rgba(255,255,255,.9)" {...ICON} />
                </div>
                <div style={{ flex: 1, minWidth: 0, padding: i === 0 ? '12px 14px 14px' : 0, alignSelf: 'stretch' }}>
                  <div style={{ fontSize: i === 0 ? 15.5 : 13.5, fontWeight: 600, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.front}</div>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 5, fontSize: 12, color: T.dim }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: dot, flexShrink: 0 }} />{c.why}
                  </div>
                </div>
              </div>
              {isOpen && (
                <div style={{ padding: '0 14px 14px' }}>
                  <div style={{ padding: 12, borderRadius: 12, background: T.well, border: `1px solid ${T.divider}`, fontFamily: MONO, fontSize: 14, color: T.text2, whiteSpace: 'pre-wrap' }}>{c.back}</div>
                  <div style={{ marginTop: 12 }}><Eyebrow color={T.muted}>One question</Eyebrow></div>
                  <div style={{ fontSize: 14, marginTop: 6 }}>Without looking — can you say the answer?</div>
                  {!revealed ? (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <Secondary style={{ flex: 1, height: 44 }} onClick={() => { setRevealed(true); try { reviewFlashcard(c.id, 1, { daysToExam: nearestExamDays() }); if (c.topic) recordMistake({ topic: c.topic, subject: c.subject, source: 'flashcard', errType: 'conceptual' }) } catch { /* nicety */ } onTick() }}>Not yet</Secondary>
                      <Primary style={{ flex: 1, height: 44 }} onClick={() => { setRevealed(true); try { reviewFlashcard(c.id, 3, { daysToExam: nearestExamDays() }) } catch { /* nicety */ } onTick() }}>Got it</Primary>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12.5, color: T.dim, marginTop: 10 }}>Logged. {c.topic ? <button onClick={() => onOpenDoubt?.(`Explain ${c.topic} to me simply: ${c.front}`)} style={{ background: 'none', border: 'none', padding: 0, color: T.accentPale, fontFamily: FONT, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Ask Kyno about it →</button> : null}</div>
                  )}
                </div>
              )}
            </Card>
          )
        })}

        {picked.items.length > 0 && (
          <>
            <div style={{ marginTop: 16, padding: 12, borderRadius: 14, background: T.well, border: `1px solid ${T.divider}`, fontSize: 12.5, color: T.dim, lineHeight: 1.55 }}>
              Watching moves your marks less than answering does. Every clip here ends with one question, so you find out straight away whether it stuck.
            </div>
            <div style={{ marginTop: 16 }}><Eyebrow color={T.muted}>Listen</Eyebrow></div>
            <Card style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button onClick={() => { if (playing) { if (paused) { resumeSpeaking(); setPaused(false) } else { pauseSpeaking(); setPaused(true) } } else playFrom(0) }} aria-label={playing && !paused ? 'Pause' : 'Play'}
                  style={{ width: 48, height: 48, borderRadius: '50%', background: T.accent, border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  {playing && !paused ? <Pause size={20} color="#fff" {...ICON} /> : <Play size={20} color="#fff" {...ICON} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{playing ? (paused ? 'Paused' : 'Playing your six') : 'The same six, as audio'}</div>
                  <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>{ttsAvailable() ? 'For the bus, chores, hands-busy time. Lock-screen controls work.' : 'No speech engine in this browser.'}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[1, 1.25, 1.5, 2].map(r => <Pill key={r} on={rate === r} onClick={() => setRate(r)}>{r}×</Pill>)}
                </div>
              </div>
            </Card>
          </>
        )}
        {void queue}
      </div>
      {picked.items.length > 0 && (
        <div style={footer}><Primary onClick={() => playFrom(0)}><Headphones size={17} {...ICON} /> Play all · {picked.totalMinutes} min</Primary></div>
      )}
    </div>
  )
}

/* ── screen 5 ─────────────────────────────────────────────────────────────── */

function WriteScreen({ shell, scroll, footer, noteId, onBack, onSaved, saveNote }: {
  shell: Style; scroll: Style; footer: Style; noteId?: string; onBack: () => void; onSaved: (id: string) => void
  saveNote: (title: string, content: string, source: string, subject?: string | null, topic?: string | null) => Promise<string>
}) {
  const existing = noteId ? getNotebookEntry(noteId) : null
  const [question, setQuestion] = useState(existing?.title || '')
  const [marks, setMarks] = useState(5)
  const [text, setText] = useState(existing?.content || '')
  const [reqs, setReqs] = useState<Requirement[] | null>(null)
  const [schemeState, setSchemeState] = useState<'idle' | 'loading' | 'ready' | 'down'>('idle')
  const [manual, setManual] = useState<Record<number, boolean>>({})
  const [listening, setListening] = useState(false)
  const [grade, setGrade] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const pauseRef = useRef<number | null>(null)
  const [checked, setChecked] = useState(() => schemeCheck('', []))

  // Re-check on pause, not on every keystroke.
  useEffect(() => {
    if (pauseRef.current) window.clearTimeout(pauseRef.current)
    pauseRef.current = window.setTimeout(() => setChecked(schemeCheck(text, reqs || [])), 900)
    return () => { if (pauseRef.current) window.clearTimeout(pauseRef.current) }
  }, [text, reqs])

  async function fetchScheme() {
    if (!question.trim()) return
    setSchemeState('loading')
    try {
      const prof = getProfile() as any
      const r = await post('/notes-scheme/scheme', { question: question.trim(), marks, board: prof?.board || 'CBSE', class: prof?.cls || '10', subject: prof?.subject || 'Science' })
      setReqs(r.requirements); setSchemeState('ready')
    } catch {
      // Static checklist the student ticks by hand -- never blank.
      setReqs([
        { point: 'Define the key term in the question', marks: 1, keywords: [] },
        { point: 'State the formula, equation or law involved', marks: 1, keywords: [] },
        { point: 'Explain the mechanism or reasoning', marks: Math.max(1, marks - 3), keywords: [] },
        { point: 'A labelled diagram or example if asked', marks: 1, keywords: [] },
      ].slice(0, Math.max(2, Math.min(4, marks))))
      setSchemeState('down')
    }
  }

  function dictate() {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    if (listening) { setListening(false); return }
    try {
      const rec = new SR(); rec.lang = 'en-IN'; rec.interimResults = false
      rec.onresult = (ev: any) => { const said = ev?.results?.[0]?.[0]?.transcript || ''; if (said) setText(t => (t ? t + ' ' : '') + said) }
      rec.onend = () => setListening(false); rec.onerror = () => setListening(false)
      rec.start(); setListening(true)
    } catch { setListening(false) }
  }

  const wj = wordJudgement(text, marks)
  const have = (reqs || []).reduce((s, r, i) => s + ((checked.rows[i]?.present || manual[i]) ? (r.marks || 1) : 0), 0)
  const total = (reqs || []).reduce((s, r) => s + (r.marks || 1), 0)

  return (
    <div style={shell}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${T.divider}` }}>
        <Back onClick={onBack} />
        <div style={{ flex: 1, fontSize: 14, fontWeight: 600, textAlign: 'center' }}>Long answer</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[3, 5].map(m => <Pill key={m} on={marks === m} onClick={() => setMarks(m)}>{m} marks</Pill>)}
        </div>
      </div>
      <div style={scroll}>
        <Card>
          <Eyebrow color={T.muted}>Question</Eyebrow>
          <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={2} placeholder="Paste or type the question"
            style={{ width: '100%', marginTop: 8, borderRadius: 12, padding: 10, background: T.well, border: `1px solid ${T.borderCtl}`, color: T.text, fontFamily: FONT, fontSize: 16, lineHeight: 1.5, boxSizing: 'border-box', resize: 'vertical' }} />
          {!reqs && <div style={{ marginTop: 10 }}><Secondary onClick={fetchScheme} style={{ width: '100%', height: 44 }}>{schemeState === 'loading' ? 'Reading the scheme…' : 'Show what the marking scheme wants'}</Secondary></div>}
        </Card>

        {reqs && (
          <Card style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Eyebrow color={T.muted}>What the marking scheme wants</Eyebrow>
              <span style={{ fontSize: 13, fontWeight: 700, color: have === total && total ? T.success : T.text2 }}>{have} of {total}</span>
            </div>
            {schemeState === 'down' && <div style={{ fontSize: 12, color: T.faint, marginTop: 6 }}>The scheme service is down — tick these by hand as you cover them.</div>}
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {reqs.map((r, i) => {
                const present = checked.rows[i]?.present || !!manual[i]
                return (
                  <div key={i} role={schemeState === 'down' ? 'button' : undefined} onClick={schemeState === 'down' ? () => setManual(m => ({ ...m, [i]: !m[i] })) : undefined}
                    style={{ display: 'flex', gap: 12, alignItems: 'center', cursor: schemeState === 'down' ? 'pointer' : 'default', minHeight: 44 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', background: present ? T.successBg : 'transparent', border: `1.5px solid ${present ? T.successBorder : T.warningBorder}` }}>
                      {present && <Check size={15} color={T.success} {...ICON} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: T.text }}>{r.point}</div>
                      <div style={{ fontSize: 12, color: present ? T.dim : '#E5C08A', marginTop: 2 }}>{r.marks} mark{r.marks === 1 ? '' : 's'} · {present ? 'you have it' : 'not written yet — the question asks for it'}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        <div style={{ marginTop: 12, position: 'relative' }}>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={9} placeholder="Write your answer here, in your own words."
            style={{ width: '100%', borderRadius: 16, padding: 14, background: T.well, border: `1px solid ${T.borderCtl}`, color: T.text2, fontFamily: FONT, fontSize: 16, lineHeight: 1.75, boxSizing: 'border-box', resize: 'vertical' }} />
          <button onClick={dictate} aria-label="Dictate" style={{ position: 'absolute', right: 10, bottom: 12, width: 44, height: 44, borderRadius: '50%', background: listening ? T.accentSurface : T.raised, border: `1px solid ${listening ? T.accent : T.borderCtl}`, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <Mic size={18} color={listening ? T.accentPale : T.muted} {...ICON} />
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: T.dim, marginTop: 8 }}>{wj.line}</div>

        <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: T.well, border: `1px solid ${T.divider}`, fontSize: 12.5, color: T.dim, lineHeight: 1.55 }}>
          Kyno shows you what the scheme wants. It will not write the answer — that is the part that earns the marks.
        </div>

        {grade && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 16, border: `1px solid ${T.successBorder}`, background: 'linear-gradient(135deg, #123D2B, #15251F)' }}>
            <Eyebrow color={T.success}>CBSE step marking</Eyebrow>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: T.success }}>{grade.awarded}</span><span style={{ fontSize: 15, color: T.successInk }}>/{grade.total}</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{grade.verdict}</span>
            </div>
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {(grade.steps || []).map((s: any, i: number) => (
                <div key={i} style={{ fontSize: 13, color: T.text2, lineHeight: 1.5 }}><strong style={{ color: s.awarded < s.marks ? '#E5C08A' : T.text }}>{s.title}</strong> — {s.reason}</div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div style={footer}>
        <Secondary style={{ flex: 1 }} onClick={async () => {
          if (!text.trim()) return
          const title = question.trim() || text.trim().slice(0, 60)
          if (existing) { updateNotebookEntry(existing.id, { title, content: text }); onSaved(existing.id); return }
          onSaved(await saveNote(title, text, 'written', (getProfile() as any)?.subject || null, null))
        }}>Save as note</Secondary>
        <Primary style={{ flex: 1 }} disabled={!text.trim() || !question.trim() || busy} onClick={async () => {
          setBusy(true)
          try {
            const prof = getProfile() as any
            const g = await post('/practice/grade', { question: question.trim(), answer: text.trim(), marks, board: prof?.board || 'CBSE', class: prof?.cls || '10' })
            setGrade(g)
          } catch { setGrade({ total: marks, awarded: 0, verdict: 'The grader is not available right now — your answer is still here.', steps: [] }) }
          finally { setBusy(false) }
        }}>{busy ? 'Marking…' : 'Check my answer'}</Primary>
      </div>
    </div>
  )
}
