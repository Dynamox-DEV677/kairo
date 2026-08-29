import { useState, useEffect, useMemo } from 'react'
import IconButton from '../components/IconButton'
import { studentMessage } from '../lib/aiError.core'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Plus, Trash2, ChevronDown, ChevronRight, Copy, Check,
  Sparkles, Sigma, Archive, FlaskConical, RotateCw,
} from 'lucide-react'
import { post, get, del } from '../lib/api'
import { listFormulas, getProfile, type Formula as TwinFormula } from '../lib/twin'
import { PrimaryButton } from '../components/PrimaryButton'
import MathExpr from '../components/MathExpr'
import { subjectLabels } from '../curriculum/subjects'

const SCHOOL_ID = 'demo_school'

const C = {
  bg:        '#0A0D16',
  panel:     '#141A2A',
  panel2:    '#1C2233',
  border:    'rgba(255,255,255,0.08)',
  borderSoft:'rgba(255,255,255,0.06)',
  text:      '#fafafa',
  textDim:   '#B1B5BA',
  textFaint: '#9CA3AF',
  textGhost: '#6B7280',
  purple:    '#A5B4FC',
  purpleHi:  '#7C5CFF',
  purpleDeep:'#4A2FA8',
  purpleLite:'#A5B4FC',
  purpleSoft:'#DBE7FF',
}

const card  = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 } as React.CSSProperties
const inp   = { background: C.panel2, border: `1px solid ${C.borderSoft}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, color: C.text, fontFamily: 'inherit', outline: 'none', width: '100%' } as React.CSSProperties
const lbl   = { fontSize: 10, color: C.purple, display: 'block', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 } as React.CSSProperties
const btn   = (active = true) => ({
  display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: 'none',
  background: active ? 'linear-gradient(135deg,#A5B4FC,#7C5CFF)' : C.panel2,
  color: active ? '#000' : C.textGhost,
  fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
  cursor: active ? 'pointer' : 'not-allowed',
  boxShadow: active ? '0 6px 18px rgba(124, 92, 255, 0.35)' : 'none',
} as React.CSSProperties)

const SUBJECTS = (() => { const p = getProfile() as any; return subjectLabels({ board: p?.board, cls: p?.cls }) })()

type Tab = 'collected' | 'sheets'

export default function FormulaSheet() {
  const [tab, setTab] = useState<Tab>('collected')

  const [collected, setCollected] = useState<TwinFormula[]>([])
  function reloadCollected() { setCollected(listFormulas()) }
  useEffect(() => { reloadCollected() }, [])

  const [sheets, setSheets]     = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [generating, setGen]    = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  // Seeded from the profile, not hard-coded to CBSE Class 10 — see the same
  // note in AdaptiveQuiz.tsx.
  const [form, setForm]         = useState(() => {
    const p = getProfile()
    return {
      subject: 'Physics', chapter: '',
      class: String(p?.cls || '10').replace(/\D/g, '') || '10',
      board: p?.board || 'CBSE',
    }
  })
  const [err, setErr]           = useState('')

  function load() {
    setLoading(true)
    get(`/formula?school_id=${SCHOOL_ID}`).then(setSheets).catch(console.error).finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function generate() {
    if (!form.subject) { setErr('Select a subject'); return }
    setGen(true); setErr('')
    try {
      const sheet = await post('/formula/generate', { school_id: SCHOOL_ID, ...form })
      setSheets(s => [sheet, ...s])
      setSelected(sheet)
      setShowForm(false)
    } catch (e: any) { setErr(studentMessage(e)) }
    finally { setGen(false) }
  }

  async function remove(id: string) {
    if (!confirm('Delete this formula sheet?')) return
    await del(`/formula/${id}?school_id=${SCHOOL_ID}`)
    if (selected?._id === id) setSelected(null)
    load()
  }

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto',
      background: C.bg,
      backgroundImage:
        `radial-gradient(at 12% 0%, rgba(124, 92, 255, 0.10) 0%, transparent 36%),
         radial-gradient(at 88% 100%, rgba(74, 47, 168, 0.10) 0%, transparent 42%)`,
      padding: '24px 32px 60px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'linear-gradient(135deg, #A5B4FC 0%, #7C5CFF 60%, #0B1530 100%)',
              display: 'grid', placeItems: 'center',
              boxShadow: '0 14px 38px rgba(124, 92, 255, 0.03)',
            }}>
              <Sigma size={24} color="#000" strokeWidth={2.4} />
            </div>
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 2.2, textTransform: 'uppercase',
                background: 'linear-gradient(90deg, #A5B4FC, #A5B4FC, #7C5CFF)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              }}>
                Formula Sheet
              </div>
              <h1 style={{ margin: '2px 0 0', fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: -0.5 }}>
                Every equation you've touched.
              </h1>
              <div style={{ fontSize: 12, color: C.textFaint, marginTop: 3 }}>
                Auto-collected from the Solver · plus AI-built chapter sheets.
              </div>
            </div>
          </div>
          <div style={{
            display: 'inline-flex', padding: 3, borderRadius: 12,
            background: 'rgba(165, 180, 252, 0.05)',
            border: '1px solid rgba(165, 180, 252, 0.22)',
          }}>
            <TabBtn active={tab === 'collected'} onClick={() => setTab('collected')}>
              <Archive size={12} /> Collected ({collected.length})
            </TabBtn>
            <TabBtn active={tab === 'sheets'} onClick={() => setTab('sheets')}>
              <FlaskConical size={12} /> AI sheets ({sheets.length})
            </TabBtn>
          </div>
        </div>

        {tab === 'collected' ? (
          <CollectedFormulas formulas={collected} onReload={reloadCollected} />
        ) : (
          <SheetsView
            sheets={sheets} loading={loading} selected={selected} setSelected={setSelected}
            showForm={showForm} setShowForm={setShowForm}
            form={form} setForm={setForm}
            generating={generating} generate={generate}
            remove={remove} err={err}
          />
        )}
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`kyno-chip${active ? ' on' : ''}`} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '9px 16px', fontSize: 12, letterSpacing: 0.3,
    }}>{children}</button>
  )
}

function CollectedFormulas({ formulas, onReload }: { formulas: TwinFormula[]; onReload: () => void }) {
  const bySubject = useMemo(() => {
    const m = new Map<string, TwinFormula[]>()
    for (const f of formulas) {
      const key = f.subject || 'General'
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(f)
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [formulas])

  if (formulas.length === 0) {
    return (
      <div style={{
        marginTop: 8, padding: '70px 24px', textAlign: 'center',
        background: C.panel, border: `1px dashed ${C.border}`, borderRadius: 18,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, margin: '0 auto 16px',
          background: 'rgba(165, 180, 252, 0.08)', border: '1px solid rgba(165, 180, 252, 0.22)',
          display: 'grid', placeItems: 'center',
        }}>
          <Sigma size={24} color={C.purple} style={{ opacity: 0.7 }} />
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: C.text }}>
          No formulas yet
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: C.textFaint, maxWidth: 460, marginInline: 'auto', lineHeight: 1.6 }}>
          Ask the Solver something with an equation in the answer — Kyno extracts it and pins it here automatically.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 11, color: C.textFaint }}>
        {formulas.length} formula{formulas.length === 1 ? '' : 's'} pinned from your study sessions · grouped by subject
        {/* Was a 10px lowercase "refresh" with a hairline border — it read as
            body text, not a control, so it was effectively invisible. */}
        <PrimaryButton
          variant="secondary" size="sm" onClick={onReload}
          title="Reload your collected formulas"
          style={{ marginLeft: 10, padding: '5px 12px', fontSize: 11 }}
        >
          <RotateCw size={11} /> Refresh
        </PrimaryButton>
      </div>
      {bySubject.map(([subject, items]) => (
        <div key={subject} style={{ ...card, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
              background: 'rgba(165, 180, 252, 0.14)', color: C.purpleLite,
              border: '1px solid rgba(165, 180, 252, 0.3)',
              textTransform: 'uppercase', letterSpacing: 1.4,
            }}>{subject}</span>
            <span style={{ fontSize: 11, color: C.textFaint }}>{items.length} formula{items.length === 1 ? '' : 's'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {items.map(f => <TwinFormulaCard key={f.id} f={f} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

function TwinFormulaCard({ f }: { f: TwinFormula }) {
  const [copied, setCopied] = useState(false)
  return (
    <motion.div
      whileHover={{ y: -2, borderColor: 'rgba(165, 180, 252, 0.18)', boxShadow: '0 8px 22px rgba(124, 92, 255, 0.01)' }}
      style={{
        background: `linear-gradient(135deg, ${C.panel2} 0%, ${C.bg} 100%)`,
        borderRadius: 11, padding: '14px 14px',
        border: `1px solid rgba(165, 180, 252, 0.18)`,
        transition: 'all 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{f.name}</div>
          {f.topic && <div style={{ fontSize: 10, color: C.textFaint, marginTop: 2, textTransform: 'capitalize' }}>{f.topic}</div>}
        </div>
        <IconButton
          onClick={() => { navigator.clipboard.writeText(f.expr); setCopied(true); setTimeout(() => setCopied(false), 1800) }}
          title={copied ? 'Copied' : 'Copy formula'}
          active={copied}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </IconButton>
      </div>
      {/* Sized to the equation, not to a fixed block. minHeight 48 plus 14px
          of vertical padding left a band of dead space around a single line of
          maths; the box now hugs its content and only grows when the formula
          actually needs two lines. */}
      <div className="kyno-formula-box" style={{
        fontSize: 17, color: C.text,
        padding: '12px 14px',
        borderRadius: 'var(--r-sm)',
        background: '#141A2A',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        wordBreak: 'break-word', overflowX: 'auto',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        lineHeight: 1.25,
      }}>
        <MathExpr expr={f.expr} displayMode />
      </div>

      {/* Rearrangements of the same law, nested rather than filed as separate
          cards. V=IR, R=V/I and I=V/R are one relation solved for different
          terms — three top-level cards made the sheet look like the student
          had learned three things when they had learned one. */}
      {f.variants && f.variants.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
          <div style={{
            fontSize: 9, color: C.textGhost, textTransform: 'uppercase',
            letterSpacing: 1, fontWeight: 700, marginBottom: 7,
          }}>
            Also written as
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {f.variants.map((v: string) => (
              <div key={v} style={{
                padding: '5px 10px', borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
                fontSize: 12,
              }}>
                <MathExpr expr={v} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 9.5, color: C.textGhost, marginTop: 8, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
        {f.source} · {formatRelative(f.ts)}
      </div>
    </motion.div>
  )
}

function SheetsView({ sheets, loading, selected, setSelected, showForm, setShowForm, form, setForm, generating, generate, remove, err }: any) {
  return (
    <div className="fs-split" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14 }}>
      <div style={{
        background: C.panel, border: `1px solid ${C.border}`,
        borderRadius: 14, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', minHeight: 480,
      }}>
        <div style={{ padding: '14px 14px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 10 }}>
            AI chapter sheets
          </div>
          <PrimaryButton onClick={() => setShowForm(!showForm)} full size="sm">
            <Plus size={13} /> New sheet
          </PrimaryButton>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ padding: 14 }}>
                <label style={lbl}>Subject</label>
                <select style={{ ...inp, marginBottom: 8 }} value={form.subject} onChange={(e: any) => setForm({ ...form, subject: e.target.value })}>
                  {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
                <label style={lbl}>Chapter (optional)</label>
                <input style={{ ...inp, marginBottom: 8 }} value={form.chapter} onChange={(e: any) => setForm({ ...form, chapter: e.target.value })} placeholder="e.g. Thermodynamics" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={lbl}>Class</label>
                    <select style={inp} value={form.class} onChange={(e: any) => setForm({ ...form, class: e.target.value })}>
                      {['8','9','10','11','12'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Board</label>
                    <select style={inp} value={form.board} onChange={(e: any) => setForm({ ...form, board: e.target.value })}>
                      {['CBSE','ICSE','State Board'].map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                </div>
                {err && <p style={{ color: C.purpleLite, fontSize: 11, marginBottom: 8 }}>{err}</p>}
                <button className="kyno-ghost" onClick={generate} disabled={generating} style={{ ...btn(!generating), width: '100%', justifyContent: 'center', padding: '8px 12px' }}>
                  {generating ? 'Generating…' : <><Sparkles size={12} /> Generate</>}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
          {loading && <div style={{ textAlign: 'center', padding: 20, color: C.textGhost, fontSize: 12 }}>Loading…</div>}
          {!loading && sheets.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: C.textGhost, fontSize: 11 }}>No AI sheets yet</div>
          )}
          {sheets.map((s: any) => (
            <div key={s.id || s._id} onClick={() => setSelected(s)}
              style={{
                padding: '10px 12px', borderRadius: 8, marginBottom: 4,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                background: (selected?.id === s.id || selected?._id === s._id) ? 'rgba(165, 180, 252, 0.10)' : 'transparent',
                border: `1px solid ${(selected?.id === s.id || selected?._id === s._id) ? 'rgba(165, 180, 252, 0.35)' : 'transparent'}`,
                transition: 'all 0.15s',
              }}>
              <BookOpen size={13} color={C.purpleLite} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.subject}</div>
                <div style={{ fontSize: 10, color: C.textGhost }}>{s.chapter || 'All chapters'}</div>
              </div>
              <button className="kyno-text" onClick={e => { e.stopPropagation(); remove(s.id || s._id) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textGhost, padding: 2 }}
                onMouseEnter={(e: any) => (e.currentTarget.style.color = C.purpleLite)}
                onMouseLeave={(e: any) => (e.currentTarget.style.color = C.textGhost)}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14,
        padding: 22, minHeight: 480, overflowY: 'auto',
      }}>
        {!selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 380, color: C.textGhost }}>
            <BookOpen size={42} color={C.purple} style={{ opacity: 0.6, marginBottom: 14 }} />
            <p style={{ margin: 0, fontSize: 14, color: C.textFaint }}>Select a sheet or generate a new one</p>
          </div>
        ) : (
          <SheetViewer sheet={selected} />
        )}
      </div>
    </div>
  )
}

function SheetViewer({ sheet }: { sheet: any }) {
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0]))
  function toggle(i: number) {
    setOpenSections(s => {
      const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n
    })
  }
  return (
    <motion.div key={sheet.id || sheet._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, color: C.text, margin: '0 0 4px', letterSpacing: -0.3 }}>
          {sheet.subject} — {sheet.chapter || 'All chapters'}
        </h2>
        <div style={{ fontSize: 12, color: C.textFaint }}>
          {sheet.sections?.length || 0} section{(sheet.sections?.length || 0) === 1 ? '' : 's'} · {sheet.sections?.reduce((a: number, s: any) => a + (s.formulas?.length || 0), 0) || 0} formulas
        </div>
      </div>

      {sheet.sections?.map((section: any, i: number) => (
        <div key={i} style={{ ...card, marginBottom: 10, padding: 0, overflow: 'hidden', borderColor: 'rgba(165, 180, 252, 0.18)' }}>
          <button onClick={() => toggle(i)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            color: C.text, fontSize: 14, fontWeight: 700, textAlign: 'left',
          }}>
            {openSections.has(i) ? <ChevronDown size={14} color={C.purple} /> : <ChevronRight size={14} color={C.purple} />}
            {section.name}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textFaint }}>{section.formulas?.length || 0} formulas</span>
          </button>
          <AnimatePresence>
            {openSections.has(i) && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
                <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {section.formulas?.map((f: any, j: number) => <FormulaRow key={j} formula={f} />)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      {sheet.constants?.length > 0 && (
        <div style={{ ...card, marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 12 }}>Constants</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
            {sheet.constants.map((c: any, i: number) => (
              <div key={i} style={{ background: C.panel2, borderRadius: 9, padding: '10px 12px', border: `1px solid ${C.borderSoft}` }}>
                <div style={{ fontSize: 15, color: C.text }}>
                  <MathExpr expr={c.symbol} />
                </div>
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: C.purple, marginTop: 3, fontFamily: 'monospace' }}>{c.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(sheet.tips?.length > 0 || sheet.common_mistakes?.length > 0) && (
        <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {sheet.tips?.length > 0 && (
            <div style={{ ...card, borderColor: 'rgba(165, 180, 252, 0.3)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.purpleLite, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 8 }}>Quick tips</div>
              {sheet.tips.map((t: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: C.textDim, marginBottom: 6, paddingLeft: 14, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color: C.purple }}>✓</span>{t}
                </div>
              ))}
            </div>
          )}
          {sheet.common_mistakes?.length > 0 && (
            <div style={{ ...card, borderColor: 'rgba(165, 180, 252, 0.3)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.purpleSoft, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 8 }}>Common mistakes</div>
              {sheet.common_mistakes.map((m: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: C.textDim, marginBottom: 6, paddingLeft: 14, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color: C.purpleSoft }}>✗</span>{m}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

function FormulaRow({ formula }: { formula: any }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ background: C.panel2, borderRadius: 10, padding: '12px 14px', border: `1px solid ${C.borderSoft}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{formula.name}</div>
        <button className="kyno-text" onClick={() => { navigator.clipboard.writeText(formula.formula); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? C.purpleLite : C.textGhost }}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
      <div style={{
        fontSize: 17, color: C.text, marginBottom: 10,
        padding: '12px 14px',
        background: '#141A2A',


        border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 9,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 46, overflowX: 'auto', lineHeight: 1.4,
      }}>
        <MathExpr expr={formula.formula} displayMode />
      </div>
      {formula.variables && <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 4 }}><strong style={{ color: C.text }}>Variables:</strong> {formula.variables}</div>}
      {formula.when_to_use && <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}><strong style={{ color: C.text }}>Use when:</strong> {formula.when_to_use}</div>}
      {formula.example && <div style={{ fontSize: 11, color: C.purpleLite }}><strong style={{ color: C.purpleSoft }}>Example:</strong> {formula.example}</div>}
    </div>
  )
}

function formatRelative(ts: number) {
  if (!ts) return '—'
  const diff = Date.now() - ts
  const s = Math.floor(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}
