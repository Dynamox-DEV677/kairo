import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Plus, Trash2, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'
import { post, get, del } from '../lib/api'

const SCHOOL_ID = 'demo_school'

const card  = { background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 20 } as React.CSSProperties
const inp   = { background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', width: '100%' } as React.CSSProperties
const lbl   = { fontSize: 11, color: '#71717a', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 } as React.CSSProperties
const btn   = (active = true) => ({ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: 'none', background: active ? 'linear-gradient(135deg,#6366f1,#7c3aed)' : '#1c1c1c', color: active ? '#fff' : '#52525b', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: active ? 'pointer' : 'not-allowed' } as React.CSSProperties)

const SUBJECTS = ['Physics','Chemistry','Biology','Mathematics','History','Geography','Economics','English','Computer Science']

export default function FormulaSheet() {
  const [sheets, setSheets]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]       = useState({ subject: 'Physics', chapter: '', class: '10', board: 'CBSE' })
  const [err, setErr]         = useState('')

  function load() {
    setLoading(true)
    get(`/formula?school_id=${SCHOOL_ID}`).then(setSheets).catch(console.error).finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function generate() {
    if (!form.subject) { setErr('Select a subject'); return }
    setGenerating(true); setErr('')
    try {
      const sheet = await post('/formula/generate', { school_id: SCHOOL_ID, ...form })
      setSheets(s => [sheet, ...s])
      setSelected(sheet)
      setShowForm(false)
    } catch (e: any) { setErr(e.message) }
    finally { setGenerating(false) }
  }

  async function remove(id: string) {
    if (!confirm('Delete this formula sheet?')) return
    await del(`/formula/${id}?school_id=${SCHOOL_ID}`)
    if (selected?._id === id) setSelected(null)
    load()
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left panel - sheet list */}
      <div style={{ width: 260, borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0d0d0d' }}>
        <div style={{ padding: '16px 12px', borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa', marginBottom: 10 }}>Formula Sheets</div>
          <button onClick={() => setShowForm(f => !f)} style={{ ...btn(), width: '100%', justifyContent: 'center', padding: '7px 12px' }}>
            <Plus size={13} /> New Sheet
          </button>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden', borderBottom: '1px solid #1a1a1a' }}>
              <div style={{ padding: 12 }}>
                <label style={lbl}>Subject</label>
                <select style={{ ...inp, marginBottom: 8 }} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
                  {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
                <label style={lbl}>Chapter (optional)</label>
                <input style={{ ...inp, marginBottom: 8 }} value={form.chapter} onChange={e => setForm(f => ({ ...f, chapter: e.target.value }))} placeholder="e.g. Thermodynamics" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={lbl}>Class</label>
                    <select style={inp} value={form.class} onChange={e => setForm(f => ({ ...f, class: e.target.value }))}>
                      {['8','9','10','11','12'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Board</label>
                    <select style={inp} value={form.board} onChange={e => setForm(f => ({ ...f, board: e.target.value }))}>
                      {['CBSE','ICSE','State Board'].map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                </div>
                {err && <p style={{ color: '#f87171', fontSize: 11, marginBottom: 8 }}>{err}</p>}
                <button onClick={generate} disabled={generating} style={{ ...btn(!generating), width: '100%', justifyContent: 'center', padding: '7px 12px' }}>
                  {generating ? 'Generating…' : 'Generate'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
          {loading && <div style={{ textAlign: 'center', padding: 20, color: '#52525b', fontSize: 12 }}>Loading…</div>}
          {!loading && sheets.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: '#3f3f46', fontSize: 11 }}>No sheets yet</div>}
          {sheets.map(s => (
            <div key={s.id || s._id} onClick={() => setSelected(s)}
              style={{ padding: '10px 10px', borderRadius: 8, marginBottom: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                background: selected?.id === s.id || selected?._id === s._id ? '#1e1e2e' : 'transparent',
                border: `1px solid ${selected?.id === s.id || selected?._id === s._id ? '#6366f130' : 'transparent'}` }}>
              <BookOpen size={13} color="#818cf8" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e4e4e7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.subject}</div>
                <div style={{ fontSize: 10, color: '#52525b' }}>{s.chapter || 'All Chapters'}</div>
              </div>
              <button onClick={e => { e.stopPropagation(); remove(s.id || s._id) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3f3f46', padding: 2 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                onMouseLeave={e => (e.currentTarget.style.color = '#3f3f46')}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - sheet content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {!selected && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#3f3f46' }}>
            <BookOpen size={48} />
            <p style={{ marginTop: 16, fontSize: 14 }}>Select or generate a formula sheet</p>
          </div>
        )}

        {selected && <SheetViewer sheet={selected} />}
      </div>
    </div>
  )
}

function SheetViewer({ sheet }: { sheet: any }) {
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0]))

  function toggle(i: number) {
    setOpenSections(s => {
      const n = new Set(s)
      n.has(i) ? n.delete(i) : n.add(i)
      return n
    })
  }

  return (
    <motion.div key={sheet.id || sheet._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fafafa', margin: '0 0 4px' }}>
          {sheet.subject} — {sheet.chapter || 'All Chapters'}
        </h2>
        <div style={{ fontSize: 12, color: '#52525b' }}>{sheet.sections?.length || 0} sections · {sheet.sections?.reduce((a: number, s: any) => a + s.formulas?.length, 0) || 0} formulas</div>
      </div>

      {/* Sections */}
      {sheet.sections?.map((section: any, i: number) => (
        <div key={i} style={{ ...card, marginBottom: 10, padding: 0, overflow: 'hidden' }}>
          <button onClick={() => toggle(i)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            color: '#e4e4e7', fontSize: 14, fontWeight: 600, textAlign: 'left',
          }}>
            {openSections.has(i) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {section.name}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#52525b' }}>{section.formulas?.length} formulas</span>
          </button>
          <AnimatePresence>
            {openSections.has(i) && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
                <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {section.formulas?.map((f: any, j: number) => <FormulaCard key={j} formula={f} />)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      {/* Constants */}
      {sheet.constants?.length > 0 && (
        <div style={{ ...card, marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Constants</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8 }}>
            {sheet.constants.map((c: any, i: number) => (
              <div key={i} style={{ background: '#0d0d0d', borderRadius: 8, padding: '8px 12px', border: '1px solid #1e1e1e' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#818cf8' }}>{c.symbol}</div>
                <div style={{ fontSize: 11, color: '#a1a1aa' }}>{c.name}</div>
                <div style={{ fontSize: 11, color: '#34d399', marginTop: 2 }}>{c.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      {(sheet.tips?.length > 0 || sheet.common_mistakes?.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {sheet.tips?.length > 0 && (
            <div style={{ ...card, borderColor: '#34d39930' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Quick Tips</div>
              {sheet.tips.map((t: string, i: number) => <div key={i} style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 4 }}>✓ {t}</div>)}
            </div>
          )}
          {sheet.common_mistakes?.length > 0 && (
            <div style={{ ...card, borderColor: '#f8717130' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Common Mistakes</div>
              {sheet.common_mistakes.map((m: string, i: number) => <div key={i} style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 4 }}>✗ {m}</div>)}
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

function FormulaCard({ formula }: { formula: any }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ background: '#0d0d0d', borderRadius: 10, padding: '12px 14px', border: '1px solid #1e1e1e' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>{formula.name}</div>
        <button onClick={() => { navigator.clipboard.writeText(formula.formula); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#34d399' : '#52525b' }}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#818cf8', fontFamily: 'monospace', marginBottom: 6, padding: '6px 10px', background: '#818cf810', borderRadius: 6 }}>
        {formula.formula}
      </div>
      {formula.variables && <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}><strong>Variables:</strong> {formula.variables}</div>}
      {formula.when_to_use && <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 4 }}><strong>Use when:</strong> {formula.when_to_use}</div>}
      {formula.example && <div style={{ fontSize: 11, color: '#34d399' }}><strong>Example:</strong> {formula.example}</div>}
    </div>
  )
}
