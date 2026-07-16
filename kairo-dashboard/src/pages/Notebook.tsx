import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Search, Plus, Pin, PinOff, Trash2, Edit3, X, Save, RefreshCw,
  BookMarked, FileText, MessageCircle, Network, StickyNote, Calendar, CheckCircle2,
  Sparkles, Eye,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { api, friendlyError } from '../lib/api'
import {
  listNotebook, deleteNotebookEntry, updateNotebookEntry,
  saveToNotebook, type NoteEntry,
} from '../lib/notebook'
import { listDoubts, listConcepts, listFormulas, type Doubt, type Concept, type Formula } from '../lib/twin'

type Kind = 'flashcards' | 'summary' | 'doubt' | 'concept_map' | 'note' | 'plan' | 'grade'

interface Note {
  id:         string
  kind:       Kind
  subject:    string | null
  title:      string
  content:    string
  tags:       string[]
  source:     string | null
  pinned:     boolean
  created_at: string
  updated_at: string
}

const KIND_META: Record<Kind, { label: string; icon: any; color: string }> = {
  flashcards:  { label: 'Flashcards',  icon: BookMarked,    color: '#A5B4FC' },
  summary:     { label: 'Summary',     icon: FileText,      color: '#A5B4FC' },
  doubt:       { label: 'Doubt',       icon: MessageCircle, color: '#A5B4FC' },
  concept_map: { label: 'Concept Map', icon: Network,       color: '#7C6BF6' },
  note:        { label: 'Note',        icon: StickyNote,    color: '#A5B4FC' },
  plan:        { label: 'Study Plan',  icon: Calendar,      color: '#A5B4FC' },
  grade:       { label: 'Graded',      icon: CheckCircle2,  color: '#7C6BF6' },
}

const card: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(14px) saturate(140%)', WebkitBackdropFilter: 'blur(14px) saturate(140%)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }
const inp: React.CSSProperties = {
  background: '#141A2A', border: '1px solid #1f2532', borderRadius: 8,
  padding: '9px 12px', fontSize: 13, color: '#fafafa',
  fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
}

// Normalise LaTeX delimiters so KaTeX renders them: \[..\] -> $$..$$, \(..\) -> $..$.
function normalizeMath(md: string): string {
  return (md || '')
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, e) => `$$${e}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, e) => `$${e}$`)
}

function entryToNote(e: NoteEntry): Note {
  return {
    id:         e.id,
    kind:       e.kind as Kind,
    subject:    e.subject,
    title:      e.title,
    content:    e.content,
    tags:       e.tags,
    source:     e.source,
    pinned:     false,
    created_at: new Date(e.createdAt).toISOString(),
    updated_at: new Date(e.updatedAt).toISOString(),
  }
}

export default function Notebook() {
  const [notes, setNotes]     = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [kindFilter, setKindFilter] = useState<Kind | 'all'>('all')
  const [selected, setSelected] = useState<Note | null>(null)
  const [editing, setEditing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [err, setErr]         = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    const local = listNotebook({ limit: 200 })
    setNotes(local.map(entryToNote))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    let r = notes
    if (kindFilter !== 'all') r = r.filter(n => n.kind === kindFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        (n.subject || '').toLowerCase().includes(q) ||
        n.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return r
  }, [notes, search, kindFilter])

  async function togglePin(n: Note) {
    setNotes(prev => prev.map(x => x.id === n.id ? { ...x, pinned: !x.pinned } : x))
  }

  async function remove(n: Note) {
    if (!confirm(`Delete "${n.title}"?`)) return
    deleteNotebookEntry(n.id)
    setNotes(prev => prev.filter(x => x.id !== n.id))
    if (selected?.id === n.id) setSelected(null)
  }

  return (
    <div className="nb-page" style={{ padding: '28px 36px', maxWidth: 1200, margin: '0 auto', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .nb-math .katex { color: #fafafa; }
        .nb-math .katex-display { overflow-x: auto; overflow-y: hidden; margin: 10px 0; padding: 2px 0; }
        .nb-math p { overflow-wrap: anywhere; }
      `}</style>
      <div className="nb-header" style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, flexShrink: 0 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: 'linear-gradient(135deg, #7C6BF6, #4A2FA8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 18px rgba(124, 107, 246, 0.03)', flexShrink: 0,
        }}>
          <BookOpen size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>AI Notebook</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            Your second brain — every flashcard, summary, and doubt saved automatically.
          </p>
        </div>
        <button className="nb-newbtn-inline" onClick={() => setCreating(true)} style={{
          padding: '9px 14px', borderRadius: 9, border: 'none',
          background: 'linear-gradient(135deg, #7C6BF6, #4A2FA8)', color: '#fff',
          fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Plus size={13} /> New Note
        </button>
        <button onClick={load} disabled={loading} style={{
          padding: '9px 12px', borderRadius: 9, border: '1px solid #1f2532',
          background: '#1C2233', color: '#9CA3AF', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <RefreshCw size={12} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
        </button>
      </div>

      <button
        className="nb-fab"
        onClick={() => setCreating(true)}
        aria-label="Create a new note"
      >
        <Plus size={18} strokeWidth={2.6} />
        <span>Generate</span>
      </button>

      <AutoCollectedStrip onBuilt={(id) => {
        const local = listNotebook({ limit: 200 })
        const fresh = local.map(entryToNote)
        setNotes(fresh)
        const justMade = fresh.find(n => n.id === id)
        if (justMade) setSelected(justMade)
      }} />

      <div className="nb-tools" style={{ display: 'flex', gap: 10, marginBottom: 14, flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={13} color="#6B7280" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search title, content, tag, subject…"
            style={{ ...inp, paddingLeft: 32 }} />
        </div>
        <select value={kindFilter} onChange={e => setKindFilter(e.target.value as any)}
          style={{ ...inp, width: 180, appearance: 'none' as any }}>
          <option value="all">All kinds</option>
          {Object.entries(KIND_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className={`nb-split${selected ? ' has-sel' : ''}`} style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1.3fr' : '1fr', gap: 12, flex: 1, minHeight: 0 }}>
        <div className="nb-list" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {err && <div style={{ padding: '10px 14px', background: 'rgba(165, 180, 252, 0.08)', border: '1px solid rgba(165, 180, 252, 0.25)', borderRadius: 8, fontSize: 12, color: '#A5B4FC' }}>{err}</div>}
          {loading && notes.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7280' }}>Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ ...card, padding: '40px 24px', textAlign: 'center' }}>
              <StickyNote size={28} color="#6B7280" style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                {notes.length === 0 ? "Empty notebook — generate flashcards or use Kyno's Solver to start filling it." : 'No matches.'}
              </p>
            </div>
          )}
          {filtered.map(n => {
            const meta = KIND_META[n.kind]
            const isActive = selected?.id === n.id
            return (
              <motion.div key={n.id}
                whileHover={{ x: 2 }}
                onClick={() => { setSelected(n); setEditing(false) }}
                style={{
                  padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                  background: isActive ? '#1a1a2e' : '#141A2A',
                  border: `1px solid ${isActive ? meta.color : '#1f2532'}`,
                  borderLeft: `3px solid ${meta.color}`,
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: `${meta.color}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <meta.icon size={13} color={meta.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {n.pinned && <Pin size={10} color="#A5B4FC" style={{ flexShrink: 0 }} />}
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: '#fafafa',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                    }}>{n.title}</div>
                  </div>
                  <div style={{ fontSize: 10.5, color: '#6B7280', marginTop: 3, display: 'flex', gap: 8 }}>
                    <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                    {n.subject && <span>· {n.subject}</span>}
                    <span style={{ marginLeft: 'auto', color: '#4B5563' }}>{relTime(n.updated_at)}</span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        <AnimatePresence mode="wait">
          {selected && (
            <motion.div key={selected.id} className="nb-detail"
              initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              style={{ ...card, padding: 22, overflowY: 'auto' }}>
              <NoteDetail
                note={selected}
                editing={editing}
                onClose={() => { setSelected(null); setEditing(false) }}
                onTogglePin={() => togglePin(selected)}
                onDelete={() => remove(selected)}
                onEdit={() => setEditing(true)}
                onSaved={(updated) => {
                  setNotes(prev => prev.map(x => x.id === updated.id ? updated : x))
                  setSelected(updated); setEditing(false)
                }}
                onCancelEdit={() => setEditing(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {creating && (
          <CreateModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load() }} />
        )}
      </AnimatePresence>
    </div>
  )
}

function AutoCollectedStrip({ onBuilt }: { onBuilt?: (id: string) => void }) {
  const [doubts, setDoubts]     = useState<Doubt[]>([])
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [tab, setTab] = useState<'doubts' | 'concepts' | 'formulas'>('doubts')
  const [working, setWorking] = useState<string | null>(null)
  const [toast, setToast]     = useState<string | null>(null)

  function reload() {
    setDoubts(listDoubts(20))
    setConcepts(listConcepts().slice(0, 24))
    setFormulas(listFormulas())
  }
  useEffect(() => {
    reload()
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('kairo:twin:')) reload()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  async function expandToNotebook(args: {
    kind:   Kind
    title:  string
    raw:    string
    subject?: string | null
    tags?:  string[]
  }) {
    const id = `${args.kind}:${args.title}`
    if (working) return
    setWorking(id)
    let body = args.raw
    try {
      const { chat } = await import('../lib/openrouter')
      const reply = await chat({
        messages: [
          {
            role: 'system',
            content: 'You are Kyno, a study notebook author. Given a topic or doubt, write a clean, exam-ready markdown note for an Indian high-school student. Structure: short summary, key points (3-5 bullets), worked example or formula if relevant, common mistake. Wrap EVERY equation, formula, variable and math symbol in KaTeX delimiters — inline math as $...$ and standalone equations as $$...$$. Keep total length under 200 words. Output only markdown, no preamble.',
          },
          { role: 'user', content: args.raw },
        ],
      })
      if (reply && reply.length > 60) body = reply
    } catch {  }

    try {
      const saved = await saveToNotebook({
        kind:    args.kind,
        title:   args.title,
        content: body,
        subject: args.subject ?? null,
        tags:    args.tags ?? [],
        source:  'auto-from-memory',
      })
      setToast(`Saved to Notebook: ${args.title}`)
      onBuilt?.(saved.id)
      try { const { awardXP } = await import('../lib/game'); awardXP('note_built') } catch {  }
    } catch (e: any) {
      setToast(`Couldn't save — ${e?.message || 'try again'}`)
    } finally {
      setWorking(null)
    }
  }

  const totals = { doubts: doubts.length, concepts: concepts.length, formulas: formulas.length }
  const anyData = totals.doubts + totals.concepts + totals.formulas > 0
  if (!anyData) return null

  return (
    <div style={{
      marginBottom: 14, padding: 14,
      background: 'rgba(124, 107, 246, 0.04)',
      border: '1px solid rgba(165, 180, 252, 0.22)',
      borderRadius: 12,
      flexShrink: 0,
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{
          fontSize: 10.5, fontWeight: 700, color: '#A5B4FC',
          textTransform: 'uppercase', letterSpacing: 1.6,
        }}>
          Auto-collected memory  ·  click to AI-build a note
        </span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <Tab active={tab === 'doubts'}   label={`Doubts ${totals.doubts}`}     onClick={() => setTab('doubts')} />
          <Tab active={tab === 'concepts'} label={`Concepts ${totals.concepts}`} onClick={() => setTab('concepts')} />
          <Tab active={tab === 'formulas'} label={`Formulas ${totals.formulas}`} onClick={() => setTab('formulas')} />
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 110, overflowY: 'auto' }}>
        {tab === 'doubts' && doubts.map(d => {
          const id = `doubt:${d.id}`
          const isBusy = working === id
          return (
            <button key={d.id} title={d.question + (isBusy ? '' : '  ·  click to AI-build a note')}
              disabled={!!working && !isBusy}
              onClick={() => expandToNotebook({
                kind: 'doubt',
                title: d.topic ? `Doubt: ${d.topic}` : d.question.slice(0, 60),
                raw:   `Doubt: ${d.question}\n\n${d.answer ? `Answer: ${d.answer}` : ''}`.trim(),
                subject: d.subject ?? null,
                tags:    d.topic ? [d.topic] : [],
              })}
              style={chipBtn(isBusy)}>
              {isBusy ? 'Building…' : (d.topic ? <span style={{ textTransform: 'capitalize' }}>{d.topic}</span> : d.question.slice(0, 32))}
              {!isBusy && d.question.length > 32 && !d.topic ? '…' : ''}
            </button>
          )
        })}
        {tab === 'concepts' && concepts.map(c => {
          const id = `concept:${c.id}`
          const isBusy = working === id
          return (
            <button key={c.id} title={`Visited ${c.visits}× · ${c.subject || 'General'}  ·  click to AI-build a note`}
              disabled={!!working && !isBusy}
              onClick={() => expandToNotebook({
                kind:  'summary',
                title: `Concept: ${c.name}`,
                raw:   `Explain the concept "${c.name}" for a high-school student. Subject: ${c.subject || 'General'}. Visited ${c.visits} times so far — emphasise the parts most often confused.`,
                subject: c.subject ?? null,
                tags:    [c.name],
              })}
              style={chipBtn(isBusy)}>
              {isBusy ? 'Building…' : <>
                <span style={{ textTransform: 'capitalize' }}>{c.name}</span>
                <span style={{ marginLeft: 5, color: '#7C6BF6', fontSize: 10 }}>×{c.visits}</span>
              </>}
            </button>
          )
        })}
        {tab === 'formulas' && (
          formulas.length === 0
            ? <span style={{ fontSize: 12, color: '#9CA3AF' }}>No formulas yet. They'll appear here as Kyno extracts them from your solver answers.</span>
            : formulas.map(f => {
                const id = `formula:${f.id}`
                const isBusy = working === id
                return (
                  <button key={f.id} title="Click to AI-build a note from this formula"
                    disabled={!!working && !isBusy}
                    onClick={() => expandToNotebook({
                      kind:  'summary',
                      title: `Formula: ${f.name}`,
                      raw:   `Write a notebook entry for the formula ${f.name}: ${f.expr}. Subject: ${f.subject || 'General'}. Include: what each variable means, when to use it, one worked example, one common mistake.`,
                      subject: f.subject ?? null,
                      tags:    [f.name],
                    })}
                    style={chipBtn(isBusy)}>
                    {isBusy ? 'Building…' : <>
                      {f.name}: <code style={{ fontFamily: "'SF Mono', monospace", color: '#A5B4FC', marginLeft: 4 }}>{f.expr}</code>
                    </>}
                  </button>
                )
              })
        )}
        {tab === 'doubts' && doubts.length === 0 && (
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>No doubts yet. Ask the Kyno Solver something — every Q&A auto-saves here.</span>
        )}
        {tab === 'concepts' && concepts.length === 0 && (
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>No concepts yet. Take a quiz or open a lab — Kyno will discover concepts automatically.</span>
        )}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              position: 'absolute', bottom: -42, left: 12,
              padding: '8px 14px', borderRadius: 10,
              background: 'rgba(13,13,21,0.95)',
              border: '1px solid rgba(165, 180, 252, 0.18)',
              boxShadow: '0 14px 32px rgba(124, 107, 246, 0.03)',
              fontSize: 12, color: '#e4e4e7', fontWeight: 500,
              zIndex: 5,
            }}>
            <span style={{ color: '#A5B4FC', fontWeight: 700 }}>● </span>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function chipBtn(busy: boolean): React.CSSProperties {
  return {
    padding: '4px 9px', borderRadius: 6,
    background: busy ? 'rgba(165, 180, 252, 0.22)' : 'rgba(124, 107, 246, 0.08)',
    border: `1px solid ${busy ? 'rgba(165, 180, 252, 0.55)' : 'rgba(165, 180, 252, 0.32)'}`,
    fontSize: 11.5, color: '#e4e4e7', fontWeight: 500,
    whiteSpace: 'nowrap',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontFamily: 'inherit',
    cursor: busy ? 'wait' : 'pointer',
    transition: 'all .15s ease',
  }
}

function Tab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 10px', borderRadius: 7,
      background: active ? 'rgba(165, 180, 252, 0.18)' : 'transparent',
      border: `1px solid ${active ? 'rgba(165, 180, 252, 0.18)' : 'rgba(255,255,255,0.08)'}`,
      color: active ? '#A5B4FC' : '#9CA3AF',
      fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
      cursor: 'pointer',
    }}>{label}</button>
  )
}

function NoteDetail({ note, editing, onClose, onTogglePin, onDelete, onEdit, onSaved, onCancelEdit }: {
  note: Note; editing: boolean
  onClose: () => void; onTogglePin: () => void; onDelete: () => void
  onEdit: () => void; onSaved: (n: Note) => void; onCancelEdit: () => void
}) {
  const [title, setTitle]     = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [subject, setSubject] = useState(note.subject || '')
  const [tags, setTags]       = useState((note.tags || []).join(', '))
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    setTitle(note.title); setContent(note.content); setSubject(note.subject || '')
    setTags((note.tags || []).join(', '))
  }, [note.id])

  async function save() {
    setSaving(true)
    try {
      await api(`/notebook/${note.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title, content, subject: subject || null,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      })
      onSaved({ ...note, title, content, subject: subject || null, tags: tags.split(',').map(t => t.trim()).filter(Boolean), updated_at: new Date().toISOString() })
    } catch (e: any) { alert(friendlyError(e)) }
    finally { setSaving(false) }
  }

  const meta = KIND_META[note.kind]

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: `${meta.color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <meta.icon size={16} color={meta.color} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          {editing ? (
            <input value={title} onChange={e => setTitle(e.target.value)}
              style={{
                width: '100%', background: '#141A2A', border: '1px solid #1f2532',
                borderRadius: 7, padding: '6px 10px', fontSize: 16, fontWeight: 700,
                color: '#fafafa', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }} />
          ) : (
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fafafa', margin: 0, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
              {note.title}
            </h2>
          )}
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
            {note.subject && <span>{note.subject}</span>}
            <span>{new Date(note.updated_at).toLocaleString()}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <button onClick={onTogglePin} title={note.pinned ? 'Unpin' : 'Pin'}
            style={{ padding: 6, borderRadius: 7, border: '1px solid #1f2532', background: '#1C2233', cursor: 'pointer', color: note.pinned ? '#A5B4FC' : '#9CA3AF' }}>
            {note.pinned ? <Pin size={12} /> : <PinOff size={12} />}
          </button>
          {!editing && (
            <button onClick={onEdit} title="Edit"
              style={{ padding: 6, borderRadius: 7, border: '1px solid #1f2532', background: '#1C2233', cursor: 'pointer', color: '#9CA3AF' }}>
              <Edit3 size={12} />
            </button>
          )}
          <button onClick={onDelete} title="Delete"
            style={{ padding: 6, borderRadius: 7, border: '1px solid #1f2532', background: '#1C2233', cursor: 'pointer', color: '#9CA3AF' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#A5B4FC')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}>
            <Trash2 size={12} />
          </button>
          <button onClick={onClose} title="Close"
            style={{ padding: 6, borderRadius: 7, border: '1px solid #1f2532', background: '#1C2233', cursor: 'pointer', color: '#9CA3AF' }}>
            <X size={12} />
          </button>
        </div>
      </div>

      {editing ? (
        <>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', marginBottom: 4 }}>Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} style={inp} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', marginBottom: 4 }}>Tags (comma-sep)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} style={inp} />
          </div>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={16}
            style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={save} disabled={saving} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: saving ? '#171D2D' : 'linear-gradient(135deg,#7C6BF6,#7C6BF6)',
              color: saving ? '#6B7280' : '#fff',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}><Save size={12} />{saving ? 'Saving…' : 'Save'}</button>
            <button onClick={onCancelEdit} style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid #1f2532',
              background: '#1C2233', color: '#9CA3AF', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 12,
            }}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          {note.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
              {note.tags.map(t => (
                <span key={t} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, background: '#171D2D', color: '#B1B5BA' }}>{t}</span>
              ))}
            </div>
          )}
          <div className="prose-ai nb-math" style={{ fontSize: 13.5, color: '#e4e4e7', lineHeight: 1.65 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{normalizeMath(note.content)}</ReactMarkdown>
          </div>
        </>
      )}
    </>
  )
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [kind, setKind]       = useState<Kind>('note')
  const [title, setTitle]     = useState('')
  const [content, setContent] = useState('')
  const [subject, setSubject] = useState('')
  const [saving, setSaving]   = useState(false)
  const [formatting, setFormatting] = useState(false)
  const [preview, setPreview] = useState(false)

  // Paste anything (even messy math) and let Kyno rewrite it into clean
  // markdown with proper $…$ equations, then show it rendered.
  async function formatWithAI() {
    if (!content.trim() || formatting) return
    setFormatting(true)
    try {
      const { chat } = await import('../lib/openrouter')
      const reply = await chat({
        messages: [
          { role: 'system', content: "You tidy a student's pasted study note into clean markdown. Keep ALL the original content and meaning — do not add, remove or answer anything. Only fix the formatting: sensible headings and bullet points, and wrap EVERY equation, formula, variable and math symbol in KaTeX delimiters — inline math as $...$ and standalone equations as $$...$$. Output only the cleaned markdown, no preamble." },
          { role: 'user', content },
        ],
      })
      if (reply && reply.trim().length > 20) { setContent(reply.trim()); setPreview(true) }
    } catch {  }
    finally { setFormatting(false) }
  }

  async function save() {
    if (!title.trim() || !content.trim()) return
    setSaving(true)
    try {
      await saveToNotebook({ kind, title, content, subject: subject || null })
      onCreated()
    } catch (e: any) { alert(friendlyError(e)); setSaving(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
      <motion.div onClick={e => e.stopPropagation()}
        initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96 }}
        style={{ ...card, padding: 24, width: 520, maxWidth: '100%' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fafafa', margin: 0, marginBottom: 14 }}>Create Note</h3>
        <select value={kind} onChange={e => setKind(e.target.value as Kind)}
          style={{ ...inp, marginBottom: 10, appearance: 'none' as any }}>
          {Object.entries(KIND_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Title" style={{ ...inp, marginBottom: 10 }} />
        <input value={subject} onChange={e => setSubject(e.target.value)}
          placeholder="Subject (optional)" style={{ ...inp, marginBottom: 10 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button type="button" onClick={formatWithAI} disabled={formatting || !content.trim()} style={{
            padding: '6px 11px', borderRadius: 7, border: '1px solid rgba(165, 180, 252, 0.32)',
            background: formatting ? 'rgba(165, 180, 252, 0.22)' : 'rgba(124, 107, 246, 0.08)',
            color: '#A5B4FC', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600,
            cursor: formatting || !content.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Sparkles size={12} />{formatting ? 'Formatting…' : 'Format math with AI'}
          </button>
          <button type="button" onClick={() => setPreview(p => !p)} disabled={!content.trim()} style={{
            padding: '6px 11px', borderRadius: 7, border: '1px solid #1f2532',
            background: '#1C2233', color: preview ? '#A5B4FC' : '#9CA3AF',
            fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600,
            cursor: !content.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto',
          }}>
            <Eye size={12} />{preview ? 'Edit' : 'Preview'}
          </button>
        </div>
        {preview ? (
          <div className="prose-ai nb-math" style={{
            fontSize: 13.5, color: '#e4e4e7', lineHeight: 1.65,
            minHeight: 160, maxHeight: 320, overflowY: 'auto',
            background: '#141A2A', border: '1px solid #1f2532', borderRadius: 8, padding: '10px 12px',
          }}>
            {content.trim()
              ? <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{normalizeMath(content)}</ReactMarkdown>
              : <span style={{ color: '#6B7280' }}>Nothing to preview yet.</span>}
          </div>
        ) : (
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={10}
            placeholder="Paste or type content — supports markdown & $math$…"
            style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 14px', borderRadius: 7, border: '1px solid #1f2532',
            background: '#1C2233', color: '#9CA3AF', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12,
          }}>Cancel</button>
          <button onClick={save} disabled={saving || !title.trim() || !content.trim()} style={{
            padding: '8px 14px', borderRadius: 7, border: 'none',
            background: saving || !title.trim() || !content.trim() ? '#171D2D' : 'linear-gradient(135deg,#7C6BF6,#7C6BF6)',
            color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
            cursor: saving || !title.trim() || !content.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}><Save size={12} />{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000); if (m < 60) return m < 1 ? 'just now' : `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}
