/**
 * AI Notebook — your second brain.
 * Auto-collected outputs (flashcards, summaries, doubts, plans) + manual notes.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Search, Plus, Pin, PinOff, Trash2, Edit3, X, Save, RefreshCw,
  BookMarked, FileText, MessageCircle, Network, StickyNote, Calendar, CheckCircle2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../lib/api'
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

// Monochrome purple — kind colors are now 3 shades of purple instead of rainbow.
const KIND_META: Record<Kind, { label: string; icon: any; color: string }> = {
  flashcards:  { label: 'Flashcards',  icon: BookMarked,    color: '#a78bfa' },
  summary:     { label: 'Summary',     icon: FileText,      color: '#c4b5fd' },
  doubt:       { label: 'Doubt',       icon: MessageCircle, color: '#a78bfa' },
  concept_map: { label: 'Concept Map', icon: Network,       color: '#7c3aed' },
  note:        { label: 'Note',        icon: StickyNote,    color: '#c4b5fd' },
  plan:        { label: 'Study Plan',  icon: Calendar,      color: '#a78bfa' },
  grade:       { label: 'Graded',      icon: CheckCircle2,  color: '#7c3aed' },
}

const card: React.CSSProperties = { background: '#111', border: '1px solid #1e1e1e', borderRadius: 14 }
const inp: React.CSSProperties = {
  background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8,
  padding: '9px 12px', fontSize: 13, color: '#fafafa',
  fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
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
    try {
      const list = await api('/notebook?limit=200')
      setNotes(list)
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
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
    try {
      await api(`/notebook/${n.id}`, { method: 'PUT', body: JSON.stringify({ pinned: !n.pinned }) })
      setNotes(prev => prev.map(x => x.id === n.id ? { ...x, pinned: !x.pinned } : x))
    } catch (e: any) { alert(e.message) }
  }

  async function remove(n: Note) {
    if (!confirm(`Delete "${n.title}"?`)) return
    try {
      await api(`/notebook/${n.id}`, { method: 'DELETE' })
      setNotes(prev => prev.filter(x => x.id !== n.id))
      if (selected?.id === n.id) setSelected(null)
    } catch (e: any) { alert(e.message) }
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1200, margin: '0 auto', height: '100%', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header — monochrome purple per strict palette rule */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, flexShrink: 0 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 18px rgba(124,58,237,0.45)', flexShrink: 0,
        }}>
          <BookOpen size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>AI Notebook</h1>
          <p style={{ fontSize: 13, color: '#52525b', marginTop: 4 }}>
            Your second brain — every flashcard, summary, and doubt saved automatically.
          </p>
        </div>
        <button onClick={() => setCreating(true)} style={{
          padding: '9px 14px', borderRadius: 9, border: 'none',
          background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff',
          fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Plus size={13} /> New Note
        </button>
        <button onClick={load} disabled={loading} style={{
          padding: '9px 12px', borderRadius: 9, border: '1px solid #1e1e1e',
          background: '#161616', color: '#71717a', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <RefreshCw size={12} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Auto-collected from unified memory engine — doubts + concepts + formulas */}
      <AutoCollectedStrip />

      {/* Search + filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={13} color="#52525b" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
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

      {/* Body — split view */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1.3fr' : '1fr', gap: 12, flex: 1, minHeight: 0 }}>
        {/* List */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {err && <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, fontSize: 12, color: '#f87171' }}>{err}</div>}
          {loading && notes.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: '#52525b' }}>Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ ...card, padding: '40px 24px', textAlign: 'center' }}>
              <StickyNote size={28} color="#52525b" style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 13, color: '#71717a', margin: 0 }}>
                {notes.length === 0 ? "Empty notebook — generate flashcards or use Kairo's Solver to start filling it." : 'No matches.'}
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
                  background: isActive ? '#1a1a2e' : '#111',
                  border: `1px solid ${isActive ? meta.color : '#1e1e1e'}`,
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
                    {n.pinned && <Pin size={10} color="#fbbf24" style={{ flexShrink: 0 }} />}
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: '#fafafa',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                    }}>{n.title}</div>
                  </div>
                  <div style={{ fontSize: 10.5, color: '#52525b', marginTop: 3, display: 'flex', gap: 8 }}>
                    <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                    {n.subject && <span>· {n.subject}</span>}
                    <span style={{ marginLeft: 'auto', color: '#3f3f46' }}>{relTime(n.updated_at)}</span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Detail / editor */}
        <AnimatePresence mode="wait">
          {selected && (
            <motion.div key={selected.id}
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

      {/* Create modal */}
      <AnimatePresence>
        {creating && (
          <CreateModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load() }} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Auto-collected strip ──────────────────────────────────────────────────
// Pulls live data from the unified memory engine (twin.ts):
//   • Recent doubts the user asked the Solver
//   • Concepts auto-discovered from quizzes/labs
//   • Formulas collected during study
// This is the "AI second brain auto-fills itself" piece from the spec.
function AutoCollectedStrip() {
  const [doubts, setDoubts]     = useState<Doubt[]>([])
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [tab, setTab] = useState<'doubts' | 'concepts' | 'formulas'>('doubts')

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

  const totals = { doubts: doubts.length, concepts: concepts.length, formulas: formulas.length }
  const anyData = totals.doubts + totals.concepts + totals.formulas > 0
  if (!anyData) return null

  return (
    <div style={{
      marginBottom: 14, padding: 14,
      background: 'rgba(124,58,237,0.04)',
      border: '1px solid rgba(167,139,250,0.22)',
      borderRadius: 12,
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{
          fontSize: 10.5, fontWeight: 700, color: '#c4b5fd',
          textTransform: 'uppercase', letterSpacing: 1.6,
        }}>
          Auto-collected from your Kairo memory
        </span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <Tab active={tab === 'doubts'}   label={`Doubts ${totals.doubts}`}     onClick={() => setTab('doubts')} />
          <Tab active={tab === 'concepts'} label={`Concepts ${totals.concepts}`} onClick={() => setTab('concepts')} />
          <Tab active={tab === 'formulas'} label={`Formulas ${totals.formulas}`} onClick={() => setTab('formulas')} />
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 90, overflowY: 'auto' }}>
        {tab === 'doubts' && doubts.map(d => (
          <span key={d.id} title={d.question} style={chipStyle()}>
            {d.topic ? <span style={{ textTransform: 'capitalize' }}>{d.topic}</span> : d.question.slice(0, 32)}
            {d.question.length > 32 && !d.topic ? '…' : ''}
          </span>
        ))}
        {tab === 'concepts' && concepts.map(c => (
          <span key={c.id} title={`Visited ${c.visits}× · ${c.subject || 'General'}`} style={chipStyle()}>
            <span style={{ textTransform: 'capitalize' }}>{c.name}</span>
            <span style={{ marginLeft: 5, color: '#7c3aed', fontSize: 10 }}>×{c.visits}</span>
          </span>
        ))}
        {tab === 'formulas' && (
          formulas.length === 0
            ? <span style={{ fontSize: 12, color: '#71717a' }}>No formulas yet. They'll appear here as Kairo extracts them from your solver answers.</span>
            : formulas.map(f => (
                <span key={f.id} style={chipStyle()}>
                  {f.name}: <code style={{ fontFamily: "'SF Mono', monospace", color: '#c4b5fd', marginLeft: 4 }}>{f.expr}</code>
                </span>
              ))
        )}
        {tab === 'doubts' && doubts.length === 0 && (
          <span style={{ fontSize: 12, color: '#71717a' }}>No doubts yet. Ask the Kairo Solver something — every Q&A auto-saves here.</span>
        )}
        {tab === 'concepts' && concepts.length === 0 && (
          <span style={{ fontSize: 12, color: '#71717a' }}>No concepts yet. Take a quiz or open a lab — Kairo will discover concepts automatically.</span>
        )}
      </div>
    </div>
  )
}

function Tab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 10px', borderRadius: 7,
      background: active ? 'rgba(167,139,250,0.18)' : 'transparent',
      border: `1px solid ${active ? 'rgba(167,139,250,0.5)' : '#22222e'}`,
      color: active ? '#c4b5fd' : '#71717a',
      fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
      cursor: 'pointer',
    }}>{label}</button>
  )
}

function chipStyle(): React.CSSProperties {
  return {
    padding: '4px 9px', borderRadius: 6,
    background: 'rgba(124,58,237,0.08)',
    border: '1px solid rgba(167,139,250,0.32)',
    fontSize: 11.5, color: '#e4e4e7', fontWeight: 500,
    whiteSpace: 'nowrap',
  }
}

// ─── Note detail / editor ───────────────────────────────────────────────────
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
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  const meta = KIND_META[note.kind]

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: `${meta.color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <meta.icon size={16} color={meta.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input value={title} onChange={e => setTitle(e.target.value)}
              style={{
                width: '100%', background: '#0d0d0d', border: '1px solid #1e1e1e',
                borderRadius: 7, padding: '6px 10px', fontSize: 16, fontWeight: 700,
                color: '#fafafa', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }} />
          ) : (
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fafafa', margin: 0, lineHeight: 1.3 }}>
              {note.title}
            </h2>
          )}
          <div style={{ fontSize: 11, color: '#52525b', marginTop: 6, display: 'flex', gap: 10 }}>
            <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
            {note.subject && <span>{note.subject}</span>}
            <span>{new Date(note.updated_at).toLocaleString()}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onTogglePin} title={note.pinned ? 'Unpin' : 'Pin'}
            style={{ padding: 6, borderRadius: 7, border: '1px solid #1e1e1e', background: '#161616', cursor: 'pointer', color: note.pinned ? '#fbbf24' : '#71717a' }}>
            {note.pinned ? <Pin size={12} /> : <PinOff size={12} />}
          </button>
          {!editing && (
            <button onClick={onEdit} title="Edit"
              style={{ padding: 6, borderRadius: 7, border: '1px solid #1e1e1e', background: '#161616', cursor: 'pointer', color: '#71717a' }}>
              <Edit3 size={12} />
            </button>
          )}
          <button onClick={onDelete} title="Delete"
            style={{ padding: 6, borderRadius: 7, border: '1px solid #1e1e1e', background: '#161616', cursor: 'pointer', color: '#71717a' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}>
            <Trash2 size={12} />
          </button>
          <button onClick={onClose} title="Close"
            style={{ padding: 6, borderRadius: 7, border: '1px solid #1e1e1e', background: '#161616', cursor: 'pointer', color: '#71717a' }}>
            <X size={12} />
          </button>
        </div>
      </div>

      {editing ? (
        <>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', marginBottom: 4 }}>Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} style={inp} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', marginBottom: 4 }}>Tags (comma-sep)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} style={inp} />
          </div>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={16}
            style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={save} disabled={saving} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: saving ? '#1c1c1c' : 'linear-gradient(135deg,#6366f1,#7c3aed)',
              color: saving ? '#52525b' : '#fff',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}><Save size={12} />{saving ? 'Saving…' : 'Save'}</button>
            <button onClick={onCancelEdit} style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid #1e1e1e',
              background: '#161616', color: '#71717a', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 12,
            }}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          {note.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
              {note.tags.map(t => (
                <span key={t} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, background: '#1a1a1a', color: '#a1a1aa' }}>{t}</span>
              ))}
            </div>
          )}
          <div className="prose-ai" style={{ fontSize: 13.5, color: '#e4e4e7', lineHeight: 1.65 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
          </div>
        </>
      )}
    </>
  )
}

// ─── Create modal ───────────────────────────────────────────────────────────
function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [kind, setKind]       = useState<Kind>('note')
  const [title, setTitle]     = useState('')
  const [content, setContent] = useState('')
  const [subject, setSubject] = useState('')
  const [saving, setSaving]   = useState(false)

  async function save() {
    if (!title.trim() || !content.trim()) return
    setSaving(true)
    try {
      await api('/notebook', {
        method: 'POST',
        body: JSON.stringify({ kind, title, content, subject: subject || null }),
      })
      onCreated()
    } catch (e: any) { alert(e.message); setSaving(false) }
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
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={10}
          placeholder="Content (supports markdown)…"
          style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 14px', borderRadius: 7, border: '1px solid #1e1e1e',
            background: '#161616', color: '#71717a', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12,
          }}>Cancel</button>
          <button onClick={save} disabled={saving || !title.trim() || !content.trim()} style={{
            padding: '8px 14px', borderRadius: 7, border: 'none',
            background: saving || !title.trim() || !content.trim() ? '#1c1c1c' : 'linear-gradient(135deg,#6366f1,#7c3aed)',
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
