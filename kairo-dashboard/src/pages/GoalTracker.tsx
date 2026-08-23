import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Target, Pencil, RotateCw, ArrowRight, Info, TrendingUp } from 'lucide-react'
import { PrimaryButton } from '../components/PrimaryButton'
import { getDashboard } from '../lib/twin'
import {
  goalPlan, parseGoal, suggestSubjects, TARGET_PRESETS, MIN_ATTEMPTS,
  type GoalTarget, type GoalSubject,
} from '../lib/goal.core'

/**
 * The 490 Tracker — the student's own board target, tracked against their REAL
 * answer history. Projections are accuracy over real attempts (goal.core), so
 * every number on this screen can be traced to questions they actually did.
 * No data → no number; the screen says what to do to unlock it instead.
 */

const KEY = 'kyno:goal'

const C = {
  bg: '#0A0D16', panel: '#141A2A', border: 'rgba(255,255,255,0.08)',
  text: '#fafafa', dim: '#B1B5BA', faint: '#9CA3AF',
  purple: '#A5B4FC', green: '#34D399', amber: '#FFB020',
}
const card: React.CSSProperties = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }

function loadGoal(): GoalTarget | null {
  try { return parseGoal(localStorage.getItem(KEY) || '') } catch { return null }
}

export default function GoalTracker() {
  const [goal, setGoal] = useState<GoalTarget | null>(loadGoal)
  const [editing, setEditing] = useState(false)
  const [tick, setTick] = useState(0) // manual refresh of the projection

  const mastery = useMemo(() => {
    try { return getDashboard().mastery } catch { return [] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const plan = useMemo(() => goalPlan({ mastery, target: goal }), [mastery, goal])

  function save(t: GoalTarget) {
    try { localStorage.setItem(KEY, JSON.stringify(t)) } catch {}
    setGoal(t)
    setEditing(false)
  }

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: C.bg, padding: '24px 20px 80px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: 'linear-gradient(135deg, #A5B4FC 0%, #7C5CFF 60%, #0B1530 100%)', display: 'grid', placeItems: 'center' }}>
            <Target size={22} color="#000" strokeWidth={2.4} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: -0.4 }}>
              {goal ? `Your ${goal.total} plan` : 'My goal'}
            </h1>
            <div style={{ fontSize: 12, color: C.faint }}>Your board target vs how you actually score in Kyno — and the topics that close the gap.</div>
          </div>
          {goal && !editing && (
            <button className="kyno-ghost" onClick={() => setTick(t => t + 1)} title="Recompute from your latest answers"
              style={{ padding: '8px 12px', borderRadius: 10, cursor: 'pointer', background: 'transparent', color: C.faint, fontFamily: 'inherit', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <RotateCw size={13} /> Refresh
            </button>
          )}
        </div>

        {(!goal || editing) ? (
          <GoalSetup initial={goal} mastery={mastery} onSave={save} onCancel={goal ? () => setEditing(false) : undefined} />
        ) : plan && (
          <>
            {/* Headline pace */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ ...card, marginBottom: 14 }}>
              {plan.ready ? (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: C.purple, marginBottom: 6 }}>On this pace</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 38, fontWeight: 900, color: (plan.paceTotal ?? 0) >= plan.total ? C.green : C.text, letterSpacing: -1 }}>~{plan.paceTotal}</span>
                    <span style={{ fontSize: 16, color: C.faint, fontWeight: 600 }}>/ {plan.total} target ({plan.outOf} max)</span>
                  </div>
                  {plan.topLever && (plan.paceTotal ?? 0) < plan.total && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10 }}>
                      <TrendingUp size={14} color={C.green} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: 13, color: C.dim, lineHeight: 1.5 }}>
                        Biggest lever right now: <b style={{ color: C.text }}>{plan.topLever.topic}</b> ({plan.topLever.subject}) — ≈ +{plan.topLever.gainEstimate} marks hiding in its {plan.topLever.wrong} recent misses.
                      </span>
                    </div>
                  )}
                  {(plan.paceTotal ?? 0) >= plan.total && (
                    <div style={{ fontSize: 13, color: C.green, marginTop: 8, fontWeight: 600 }}>You're pacing at or above your target — keep the streak, and stretch the strong subjects.</div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Info size={15} color={C.amber} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>
                    No pace headline yet — that would be a made-up number. <b style={{ color: C.text }}>{plan.subjectsWithData} of {plan.subjects.length}</b> subjects have enough answered questions ({MIN_ATTEMPTS}+ each). Quiz the greyed subjects below and the projection unlocks.
                  </span>
                </div>
              )}
            </motion.div>

            {/* Per-subject bars */}
            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: C.faint, marginBottom: 14 }}>
                Subject by subject <span style={{ color: C.faint, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>· │ = your per-subject target</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {plan.subjects.map(s => <SubjectRow key={s.subject} s={s} />)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <PrimaryButton variant="secondary" onClick={() => setEditing(true)}><Pencil size={13} /> Edit goal</PrimaryButton>
            </div>
            <div style={{ fontSize: 10.5, color: C.faint, marginTop: 14, lineHeight: 1.5 }}>
              Projections are your real accuracy on Kyno questions — a guide for where to work, not a prediction of your board result.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SubjectRow({ s }: { s: GoalSubject }) {
  const [open, setOpen] = useState(false)
  const hasData = s.projected != null
  const barColor = !hasData ? 'rgba(255,255,255,0.10)' : s.onTrack ? C.green : C.amber
  const width = hasData ? Math.min(100, Math.max(3, s.projected!)) : 0

  const go = (view: string) => { try { (window as any).__kairoSetActive?.(view) } catch {} }

  return (
    <div>
      <button onClick={() => hasData && setOpen(o => !o)}
        style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: 0, cursor: hasData ? 'pointer' : 'default', fontFamily: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: hasData ? C.text : C.faint }}>{s.subject}</span>
          <span style={{ fontSize: 11.5, color: C.faint }}>
            {hasData
              ? <>projected <b style={{ color: barColor }}>{s.projected}</b> / target {s.targetPer} · from {s.attempts} answers{s.confidence === 'low' ? ' · early' : ''}</>
              : <>needs {Math.max(0, MIN_ATTEMPTS - s.attempts)} more answered questions to project</>}
          </span>
          {hasData && s.levers.length > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: C.purple, flexShrink: 0 }}>{open ? 'hide' : 'where?'} ▾</span>
          )}
        </div>
        <div style={{ position: 'relative', height: 22, borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${width}%`, background: barColor, opacity: 0.85, borderRadius: '6px 0 0 6px', transition: 'width .6s cubic-bezier(.2,.7,.2,1)' }} />
          <div style={{ position: 'absolute', top: -2, bottom: -2, left: `${Math.min(99, s.targetPer)}%`, width: 2.5, background: '#fff', borderRadius: 2, opacity: 0.9 }} />
        </div>
      </button>

      {open && s.levers.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          style={{ margin: '8px 0 2px', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
          {s.levers.map(l => (
            <div key={l.topic} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
              <ArrowRight size={12} color={C.amber} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: C.dim, flex: 1, minWidth: 0 }}>
                <b style={{ color: C.text }}>{l.topic}</b> — {l.wrong} of your last {l.attempts} went wrong · ≈ +{l.gainEstimate} marks
              </span>
              <button className="kyno-ghost" onClick={() => go('quiz')}
                style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', background: 'transparent', color: C.purple, fontFamily: 'inherit', fontSize: 11, fontWeight: 700 }}>
                Drill
              </button>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  )
}

function GoalSetup({ initial, mastery, onSave, onCancel }: {
  initial: GoalTarget | null
  mastery: unknown
  onSave: (t: GoalTarget) => void
  onCancel?: () => void
}) {
  const options = useMemo(() => {
    const sugg = suggestSubjects(mastery)
    for (const s of initial?.subjects || []) if (!sugg.some(x => x.toLowerCase() === s.toLowerCase())) sugg.unshift(s)
    return sugg
  }, [mastery, initial])

  const [picked, setPicked] = useState<string[]>(() => initial?.subjects || options.slice(0, 5))
  const [total, setTotal] = useState<number>(() => initial?.total || 490)
  const outOf = picked.length * 100

  const toggle = (s: string) => setPicked(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])
  const valid = picked.length >= 2 && total > 0 && total <= outOf

  return (
    <div style={card}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: C.purple, marginBottom: 12 }}>Set your target</div>

      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 8 }}>Which subjects count?</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
        {options.map(s => (
          <button key={s} onClick={() => toggle(s)} className={`kyno-chip${picked.includes(s) ? ' on' : ''}`}
            style={{ padding: '7px 14px', fontSize: 12 }}>{s}</button>
        ))}
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 8 }}>Total target (out of {outOf})</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center', marginBottom: 6 }}>
        {TARGET_PRESETS.filter(p => p <= outOf).map(p => (
          <button key={p} onClick={() => setTotal(p)} className={`kyno-chip${total === p ? ' on' : ''}`}
            style={{ padding: '7px 14px', fontSize: 12 }}>{p}</button>
        ))}
        <input
          type="number" value={total} min={1} max={outOf}
          onChange={e => setTotal(Number(e.target.value))}
          style={{ width: 90, background: '#0d1117', border: '1px solid #1f2532', borderRadius: 9, padding: '8px 10px', fontSize: 13, color: C.text, fontFamily: 'inherit', outline: 'none' }}
        />
      </div>
      {!valid && (
        <div style={{ fontSize: 11.5, color: C.amber, marginBottom: 8 }}>
          {picked.length < 2 ? 'Pick at least two subjects.' : `Target must be between 1 and ${outOf}.`}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <PrimaryButton disabled={!valid} onClick={() => onSave({ total, subjects: picked })}>Save my goal</PrimaryButton>
        {onCancel && <PrimaryButton variant="secondary" onClick={onCancel}>Cancel</PrimaryButton>}
      </div>
    </div>
  )
}
