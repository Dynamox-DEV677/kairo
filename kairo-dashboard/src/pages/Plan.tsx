/**
 * Plan — one horizon.
 *
 * My Goal, Smart Timetable, Exam Planner, Topic Architect, Focus Lock and
 * Pomodoro become one space. Home owns "what do I do right now"; this owns the
 * exam date, syllabus coverage, and whether the current pace is honestly enough.
 *
 * Everything numeric -- countdown, coverage bars, the honest line, the week
 * strip, the timer -- is arithmetic over stored rows in pace.core.js and never
 * needs AI. The only generated thing is the wording of a chapter's three
 * sessions, and the standard split stands in when that is unavailable.
 *
 * TONE, from the brief: count days, never score them. Every projection comes
 * with the action that changes it. Never show a target that cannot still be
 * reached. No flames, no broken streaks. Missing days is normal; the app's job
 * is to re-plan, not to react.
 *
 * FOCUS: a PWA cannot lock a phone. The timer counts departures and time away
 * and says so honestly at the end. It persists its start time so a reload
 * cannot lose a session.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { ChevronRight, ArrowLeft, Check, Play, Pause, SkipForward, Pencil, AlertTriangle, Calendar, BookOpen, Layers, PenLine } from 'lucide-react'
import { T, FONT, MONO, ICON, CALLOUT } from '../lib/spaceTokens'
import { useSpaceLayout } from '../components/SpaceFrame'
import { keepPageMounted } from '../lib/keepMounted'
import { awardXP, awardMasteryCrossings } from '../lib/game'
import { post } from '../lib/api'
import { loadState, getDashboard, getProfile, track } from '../lib/twin'
import { getJSON, setJSON, getRaw } from '../lib/storage'
import { nearestExamDays } from '../lib/examDate'
import { graphForProfile } from '../lib/syllabusFor'
import { nodeStates } from '../lib/syllabusGraph.core'
import type { Graph, GraphNode, NodeState } from '../lib/syllabusGraph.core'
import { parseHistory, appendSession } from '../lib/focus.core'
import { readTimeStore } from '../lib/timeTracker'
import {
  dailyMinutes, coverageSplit, minutesNeeded, project, honestLine, weekStrip, missedRun,
  chapterRows, untouchedCallout, defaultTopicPlan, adjustOptions, elapsedMs, remainingMs, driftLine,
  DEFAULT_TARGET,
} from '../lib/pace.core'
import type { Projection, ChapterRow, TopicPlan, PlanSession, FocusSession } from '../lib/pace.core'

type Style = React.CSSProperties

/* ── tokens local to this space ───────────────────────────────────────────── */

/** Coverage ramp: ONE hue, monotonic in lightness. Not a categorical palette. */
const RAMP = { solid: '#9B82FF', shaky: '#55429E', untouched: '#262636' } as const

const FOCUS_KEY = 'kyno:plan:focus'
const SESSIONS_KEY = 'kyno:plan:sessions'
const HISTORY_KEY = 'kyno:focus:history'
const PROFILE_KEY = 'kyno:student_profile'

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

/** Two-segment coverage bar on the track. 2px gap. */
function CoverageBar({ solid, shaky, height = 12 }: { solid: number; shaky: number; height?: number }) {
  return (
    <div style={{ display: 'flex', gap: 2, height, background: T.divider, borderRadius: height / 2, overflow: 'hidden' }} role="img" aria-label={`${solid}% solid, ${shaky}% shaky`}>
      {solid > 0 && <div style={{ width: `${solid}%`, background: RAMP.solid }} />}
      {shaky > 0 && <div style={{ width: `${shaky}%`, background: RAMP.shaky }} />}
    </div>
  )
}

/** AT RISK is a status flag: icon + words + amber border. Never colour alone. */
function AtRisk() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: T.warning, letterSpacing: 0.4 }}>
      <AlertTriangle size={12} {...ICON} /> at risk
    </span>
  )
}

/* ── the model, computed once and cached ─────────────────────────────────── */

interface Model {
  graph: Graph | null
  states: Map<string, NodeState> | null
  daysLeft: number | null
  examName: string
  daily: ReturnType<typeof dailyMinutes>
  split: ReturnType<typeof coverageSplit>
  need: number
  p: Projection
  line: string
  week: ReturnType<typeof weekStrip>
  missed: number
  rows: { open: ChapterRow[]; done: ChapterRow[] }
  computedAt: number
}

function computeModel(now = Date.now()): Model {
  const profile = getProfile() as any
  const graph = (() => { try { return graphForProfile(profile) } catch { return null } })()
  const st = (() => { try { return loadState() } catch { return { events: [], mastery: [] } as any } })()
  const states = graph ? nodeStates(graph, { events: st.events, mastery: getDashboard().mastery }) : null

  const history = (() => { try { return parseHistory(JSON.parse(getRaw(HISTORY_KEY) || '[]')) } catch { return [] } })()
  const timeStore = (() => { try { return readTimeStore() } catch { return null } })()
  const daily = dailyMinutes({ focusHistory: history as any, timeStore, now })

  const daysLeft = nearestExamDays(now)
  let examName = 'Exam'
  try {
    const p = getJSON<{ examDates?: Array<{ name?: string; date?: string }> }>(PROFILE_KEY)
    const soon = (p?.examDates || []).map(e => ({ n: e?.name, t: Date.parse(e?.date || '') })).filter(e => Number.isFinite(e.t) && e.t > now - 86400000).sort((a, b) => a.t - b.t)[0]
    if (soon?.n) examName = soon.n
  } catch { /* ignore */ }

  const split = coverageSplit(graph, states)
  const need = minutesNeeded(graph, states)
  // No exam date: project to end of term (~90 days) so the rest still works.
  const p = project({ solidPct: split.solidPct, needMinutes: need, dailyMedian: daily.median, daysLeft: daysLeft ?? 90, target: DEFAULT_TARGET })
  return {
    graph, states, daysLeft, examName, daily, split, need, p,
    line: honestLine(p, daily.median, DEFAULT_TARGET),
    week: weekStrip(daily.byDay, now),
    missed: missedRun(daily.byDay, now),
    rows: chapterRows(graph, states, { sessionMin: daily.sessionMedian }),
    computedAt: now,
  }
}

/* ── ring timer ──────────────────────────────────────────────────────────── */

function Ring({ fraction, size = 236 }: { fraction: number; size?: number }) {
  const half = size / 2, r = half - 14, c = 2 * Math.PI * r   // 236 → r 104, as drawn; 320 on a desktop
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }} aria-hidden>
      <circle cx={half} cy={half} r={r} fill="none" stroke={T.raised} strokeWidth={12} />
      <circle cx={half} cy={half} r={r} fill="none" stroke={T.accent} strokeWidth={12} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, fraction)))} transform={`rotate(-90 ${half} ${half})`}
        style={{ transition: 'stroke-dashoffset .6s linear' }} />
    </svg>
  )
}

/* ── the page ─────────────────────────────────────────────────────────────── */

type View = { name: 'plan' } | { name: 'syllabus' } | { name: 'topic'; id: string } | { name: 'focus' } | { name: 'adjust' }

export default function Plan({ onOpenDoubt, onPractice }: {
  onOpenDoubt?: (seed: string) => void
  onPractice?: (filter: { topics?: string[] }) => void
}) {
  // A focus session still running when the page mounts (a reload, the app
  // reopened) comes straight back up. Its start time is persisted, so the timer
  // recomputes from the wall clock -- nothing is lost, and "Start" on the home
  // screen can no longer quietly overwrite a session that was in progress.
  const [view, setView] = useState<View>(() => {
    try {
      const s = getJSON<FocusSession>(FOCUS_KEY)
      if (s?.startedAt && remainingMs(s, Date.now()) > 0) return { name: 'focus' }
    } catch { /* storage blocked */ }
    return { name: 'plan' }
  })
  const [tick, setTick] = useState(0)
  const [now, setNow] = useState(Date.now())

  const model = useMemo(() => computeModel(Date.now()), [tick, view.name])

  // recompute when a focus session banks (the timer here or the old Focus Lock)
  useEffect(() => {
    const on = () => setTick(t => t + 1)
    window.addEventListener('kyno:focus-banked', on)
    return () => window.removeEventListener('kyno:focus-banked', on)
  }, [])

  // 3+ missed days opens the adjust screen once per run of misses
  useEffect(() => {
    if (view.name !== 'plan' || model.missed < 3 || model.daily.median == null) return
    const seen = getJSON<number>('kyno:plan:adjust-seen') || 0
    if (Date.now() - seen > 86400000) { setJSON('kyno:plan:adjust-seen', Date.now()); setView({ name: 'adjust' }) }
  }, [model.missed, view.name, model.daily.median])

  const sessions = useMemo<Array<PlanSession & { id: string; chapterId: string; chapter: string; done?: boolean }>>(() => getJSON(SESSIONS_KEY) || [], [tick, view.name])

  /** The one thing for today: the next undone planned session, else the top-risk chapter. */
  const oneThing = useMemo(() => {
    const planned = sessions.find(s => !s.done)
    if (planned) return { title: `${planned.kind === 'LEARN' ? 'Learn' : planned.kind === 'PRACTISE' ? 'Practise' : 'Test'}: ${planned.chapter}`, why: planned.why, minutes: planned.minutes, chapterId: planned.chapterId, sessionId: planned.id }
    const top = model.rows.open[0]
    if (!top) return null
    return { title: top.name, why: top.state === 'UNTOUCHED' ? `Untouched, and ${top.marks} marks on the paper` : `${top.marks} marks on the paper, ${top.status.toLowerCase()}`, minutes: 25, chapterId: top.id, sessionId: null }
  }, [sessions, model])

  // Desktop with room for it: the syllabus map asks the frame for the wide
  // column and lays its chapter cards out in two columns.
  const layout = useSpaceLayout()
  useEffect(() => { layout.setWide(view.name === 'syllabus' && layout.areaWidth >= 760) }, [view.name, layout.areaWidth]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => layout.setWide(false), []) // eslint-disable-line react-hooks/exhaustive-deps

  // A chapter crossing 70% is credited once, here, where the states are freshly computed.
  useEffect(() => { try { awardMasteryCrossings(model.states) } catch { /* nicety */ } }, [model])
  // A running focus timer must not be unmounted out from under the student.
  useEffect(() => (view.name === 'focus' ? keepPageMounted('plan') : undefined), [view.name])

  const shell: Style = { position: 'absolute', inset: 0, background: T.bg, color: T.text, fontFamily: FONT, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
  const scroll: Style = { flex: 1, overflowY: 'auto', padding: '18px 14px 24px' }
  const footer: Style = { padding: '12px 14px calc(12px + env(safe-area-inset-bottom))', borderTop: `1px solid ${T.divider}`, background: T.bgAlt, display: 'flex', gap: 10 }

  function startFocus(task: string, minutes: number, chapterId?: string, sessionId?: string | null) {
    const s: FocusSession & { task: string; chapterId?: string; sessionId?: string | null; drifts: number; driftMs: number } =
      { startedAt: Date.now(), plannedMs: minutes * 60_000, pausedMs: 0, pausedAt: null, task, chapterId, sessionId, drifts: 0, driftMs: 0 }
    setJSON(FOCUS_KEY, s)
    setView({ name: 'focus' })
  }

  /* ── screen 1: the plan ──────────────────────────────────────────────────── */
  if (view.name === 'plan') {
    const { daysLeft, split, line, week, graph, daily } = model
    return (
      <div style={shell}>
        <div style={scroll}>
          <Eyebrow>Plan</Eyebrow>
          {daysLeft != null ? (
            <h1 style={{ fontSize: 25, fontWeight: 700, margin: '8px 0 0', letterSpacing: -0.3 }}>{daysLeft} day{daysLeft === 1 ? '' : 's'} to go</h1>
          ) : (
            <ExamDateCard onSaved={() => setTick(t => t + 1)} />
          )}

          {graph ? (
            <Card style={{ marginTop: 16 }}>
              <Eyebrow color={T.muted}>Syllabus by exam day</Eyebrow>
              <div style={{ marginTop: 12 }}><CoverageBar solid={split.solidPct} shaky={split.shakyPct} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12.5 }}>
                <span style={{ color: T.text2 }}>{split.solidPct}% solid · {split.shakyPct}% shaky</span>
                <span style={{ color: T.dim }}>target {DEFAULT_TARGET}%</span>
              </div>
              <div style={{ height: 1, background: T.divider, margin: '12px 0' }} />
              <div style={{ fontSize: 14, color: T.text, lineHeight: 1.55 }}>{line}</div>
              {daily.median == null && daily.days > 0 && (
                <div style={{ fontSize: 12, color: T.faint, marginTop: 6 }}>{daily.days} of 7 days of study time recorded so far.</div>
              )}
            </Card>
          ) : (
            <Card style={{ marginTop: 16 }}>
              <div style={{ fontSize: 14, color: T.text2, lineHeight: 1.55 }}>Kyno does not have a verified syllabus map for your board and class yet, so it will not invent one. Add your board and class on Home, or enter chapters by hand from the syllabus screen.</div>
            </Card>
          )}

          {oneThing && (
            <div style={{ marginTop: 14, padding: 16, borderRadius: 16, ...CALLOUT.purple }}>
              <Eyebrow>Today — one thing</Eyebrow>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 8, lineHeight: 1.3 }}>{oneThing.title}</div>
              <div style={{ fontSize: 13, color: T.accentPale, marginTop: 5, lineHeight: 1.5 }}>{oneThing.why}</div>
              <div style={{ marginTop: 14 }}>
                <Primary onClick={() => startFocus(oneThing.title, oneThing.minutes, oneThing.chapterId, oneThing.sessionId)}>
                  <Play size={17} {...ICON} /> Start {oneThing.minutes} minutes
                </Primary>
              </div>
            </div>
          )}

          <Card style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Eyebrow color={T.muted}>This week</Eyebrow>
              <span style={{ fontSize: 12.5, color: T.text2, fontWeight: 600 }}>{week.header}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {week.tiles.map(t => (
                <div key={t.ts} title={`${t.minutes} min`} style={{
                  flex: 1, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center',
                  background: t.state === 'done' ? RAMP.shaky : t.state === 'future' ? T.well : T.raised,
                  border: t.state === 'today' ? `1.5px solid ${T.accent}` : t.state === 'missed' ? `1px solid ${T.borderCtl}` : '1px solid transparent',
                  fontSize: 11, color: t.state === 'done' ? '#fff' : T.faint, fontWeight: 600,
                }}>{t.state === 'done' ? <Check size={14} color="#fff" {...ICON} /> : t.label}</div>
              ))}
            </div>
          </Card>
        </div>
        <div style={footer}>
          <Secondary onClick={() => setView({ name: 'syllabus' })} style={{ flex: 1 }}>Syllabus map</Secondary>
          <Secondary onClick={() => setView({ name: 'adjust' })} style={{ flex: 1 }}>Change my plan</Secondary>
        </div>
      </div>
    )
  }

  /* ── screen 2: syllabus ──────────────────────────────────────────────────── */
  if (view.name === 'syllabus') {
    const { rows, graph } = model
    const callout = untouchedCallout(rows.open)
    const top = rows.open.find(r => r.atRisk) || rows.open[0]
    return (
      <div style={shell}>
        <div style={scroll}>
          <Back onClick={() => setView({ name: 'plan' })} />
          <div style={{ marginTop: 6 }}><Eyebrow>Syllabus</Eyebrow></div>
          {!graph ? (
            <Card style={{ marginTop: 12 }}>
              <div style={{ fontSize: 14, color: T.text2, lineHeight: 1.55 }}>No verified syllabus for your board and class yet. Kyno will not invent one — chapters entered by hand will appear here once that form ships.</div>
            </Card>
          ) : (
            <>
              {callout && (
                <div style={{ marginTop: 12, padding: 14, borderRadius: 16, ...CALLOUT.amber }}>
                  <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>{callout.headline}</div>
                  <div style={{ fontSize: 12.5, color: T.text2, marginTop: 5 }}>{callout.sub}</div>
                </div>
              )}
              <div style={{ display: 'grid', gap: 10, marginTop: 12, gridTemplateColumns: layout.wide ? '1fr 1fr' : undefined }}>
                {rows.open.map(r => (
                  <Card key={r.id} onClick={() => setView({ name: 'topic', id: r.id })} style={{ borderRadius: 15, border: `1px solid ${r.atRisk ? T.warningBorder : T.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600, flex: 1, minWidth: 0 }}>{r.name}</div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexShrink: 0 }}>
                        {r.atRisk && <AtRisk />}
                        <span style={{ fontSize: 12.5, color: T.muted, fontVariantNumeric: 'tabular-nums' }}>{r.marks} marks</span>
                      </div>
                    </div>
                    <div style={{ marginTop: 10 }}><CoverageBar solid={r.solidPct} shaky={r.shakyPct} height={7} /></div>
                    <div style={{ fontSize: 12.5, color: T.dim, marginTop: 8 }}>{r.status}</div>
                  </Card>
                ))}
                {rows.done.length > 0 && (
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', background: T.surface, border: `1px solid ${T.successBorder}`, borderRadius: 15 }}>
                    <Check size={16} color={T.success} {...ICON} />
                    <div style={{ fontSize: 13.5, color: T.text2 }}>{rows.done.length} chapter{rows.done.length === 1 ? '' : 's'} solid — {rows.done.map(r => r.name).join(', ')}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        {top && <div style={footer}><Primary onClick={() => setView({ name: 'topic', id: top.id })}>Plan {top.name} now <ChevronRight size={18} {...ICON} /></Primary></div>}
      </div>
    )
  }

  /* ── screen 3: topic ─────────────────────────────────────────────────────── */
  if (view.name === 'topic') {
    const node = model.graph?.byId.get(view.id) || null
    const row = model.rows.open.find(r => r.id === view.id) || model.rows.done.find(r => r.id === view.id) || null
    return (
      <TopicScreen node={node} row={row} model={model} shell={shell} scroll={scroll} footer={footer}
        onBack={() => setView({ name: 'syllabus' })}
        onAdd={(plan) => {
          const existing: any[] = getJSON(SESSIONS_KEY) || []
          const added = plan.sessions.map((s, i) => ({ ...s, id: `${view.id}-${Date.now()}-${i}`, chapterId: view.id, chapter: node?.name || '', done: false }))
          setJSON(SESSIONS_KEY, [...existing.filter(s => s.chapterId !== view.id), ...added])
          setTick(t => t + 1); setView({ name: 'plan' })
        }}
        onLearn={() => onOpenDoubt?.(`Teach me ${node?.name || 'this chapter'} from the start: ${(node?.topics || []).slice(0, 4).join(', ')}.`)}
        onTest={() => onPractice?.({ topics: [node?.name || ''] })}
      />
    )
  }

  /* ── screen 4: focus ─────────────────────────────────────────────────────── */
  if (view.name === 'focus') {
    return <FocusScreen shell={shell} footer={footer} now={now} setNow={setNow} onExit={() => { setTick(t => t + 1); setView({ name: 'plan' }) }} sessionsTotal={sessions.filter(s => !s.done).length} />
  }

  /* ── screen 5: adjust ────────────────────────────────────────────────────── */
  const a = adjustOptions({ p: model.p, dailyMedian: model.daily.median, rows: model.rows.open, target: DEFAULT_TARGET })
  const missed = model.missed
  const words = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven']
  return (
    <div style={shell}>
      <div style={scroll}>
        <Back onClick={() => setView({ name: 'plan' })} />
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '10px 0 0', lineHeight: 1.3, letterSpacing: -0.3 }}>
          {missed >= 3 ? `${words[Math.min(missed, 7)] || missed} days off. Here is where that leaves you.` : 'Change my plan'}
        </h1>
        {!a ? (
          <Card style={{ marginTop: 16 }}>
            <div style={{ fontSize: 14, color: T.text2, lineHeight: 1.55 }}>
              {model.daily.median == null
                ? 'Kyno needs about a week of your real study time before it can show you what a change would do.'
                : 'Add an exam date and a syllabus map first — then the options here mean something.'}
            </div>
          </Card>
        ) : (
          <>
            <Card style={{ marginTop: 16 }}>
              <Eyebrow color={T.muted}>Projection</Eyebrow>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8 }}>
                <span style={{ fontSize: 15, color: T.dim }}>Was {a.was}%</span>
                <span style={{ fontSize: 15, color: T.faint }}>→</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: T.text }}>Now {a.now}%</span>
              </div>
              <div style={{ fontSize: 13.5, color: T.text2, lineHeight: 1.55, marginTop: 10 }}>Nothing here is a punishment and nothing is lost. Pick one of these and the plan rewrites itself.</div>
            </Card>
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {a.options.map(o => (
                <Card key={o.id} onClick={() => { setJSON('kyno:plan:choice', { id: o.id, ts: Date.now() }); setView({ name: 'plan' }) }}
                  style={o.tone === 'recommended' ? { ...CALLOUT.purple } : {}}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{o.title}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: o.tone === 'recommended' ? T.accentPale : T.text, fontVariantNumeric: 'tabular-nums' }}>→ {o.to}%</div>
                  </div>
                  <div style={{ fontSize: 12.5, color: T.text2, lineHeight: 1.5, marginTop: 6 }}>{o.detail}</div>
                </Card>
              ))}
            </div>
            <div style={{ fontSize: 12.5, color: T.dim, lineHeight: 1.5, marginTop: 16 }}>Your streak is intact. Rest days do not break it — that is what they are for.</div>
          </>
        )}
      </div>
      <div style={footer}>
        <Secondary onClick={() => setView({ name: 'plan' })} style={{ flex: 1 }}>Decide later</Secondary>
        {a && <Primary onClick={() => { setJSON('kyno:plan:choice', { id: 'more', ts: Date.now() }); setView({ name: 'plan' }) }} style={{ flex: 1.4 }}>Add 15 minutes a day</Primary>}
      </div>
    </div>
  )
}

/* ── exam date, one field ─────────────────────────────────────────────────── */

function ExamDateCard({ onSaved }: { onSaved: () => void }) {
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  return (
    <Card style={{ marginTop: 10 }}>
      <div style={{ fontSize: 17, fontWeight: 700 }}>Add your exam date</div>
      <div style={{ fontSize: 12.5, color: T.dim, marginTop: 4, lineHeight: 1.5 }}>Everything below still works — it is projecting to end of term until then.</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Half-yearly" aria-label="Exam name"
          style={{ flex: 1, height: 44, minWidth: 0, borderRadius: 12, padding: '0 12px', background: T.raised, border: `1px solid ${T.borderCtl}`, color: T.text, fontFamily: FONT, fontSize: 16 }} />
        <input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Exam date"
          style={{ height: 44, borderRadius: 12, padding: '0 10px', background: T.raised, border: `1px solid ${T.borderCtl}`, color: T.text, fontFamily: FONT, fontSize: 16 }} />
      </div>
      <div style={{ marginTop: 10 }}>
        <Primary disabled={!date} onClick={() => {
          try {
            const p = getJSON<any>(PROFILE_KEY) || {}
            const dates = Array.isArray(p.examDates) ? p.examDates : []
            setJSON(PROFILE_KEY, { ...p, examDates: [...dates, { name: name.trim() || 'Exam', date }] })
          } catch { /* storage blocked */ }
          onSaved()
        }}><Calendar size={16} {...ICON} /> Save</Primary>
      </div>
    </Card>
  )
}

/* ── screen 3 ─────────────────────────────────────────────────────────────── */

function TopicScreen({ node, row, model, shell, scroll, footer, onBack, onAdd, onLearn, onTest }: {
  node: GraphNode | null; row: ChapterRow | null; model: Model; shell: Style; scroll: Style; footer: Style
  onBack: () => void; onAdd: (plan: TopicPlan) => void; onLearn: () => void; onTest: () => void
}) {
  const base = useMemo(() => defaultTopicPlan(node, { needMinutes: row?.needMinutes ?? null, sessionMin: model.daily.sessionMedian, daysLeft: model.daysLeft }), [node?.id, row?.needMinutes, model.daily.sessionMedian, model.daysLeft])
  const [plan, setPlan] = useState<TopicPlan>(base)
  const [standard, setStandard] = useState(false)
  useEffect(() => { setPlan(base) }, [base])

  useEffect(() => {
    if (!node) return
    let cancelled = false
    ;(async () => {
      try {
        const prof = getProfile() as any
        const r = await post('/plan/topic', { chapter: node.name, topics: node.topics || [], sessions: base.sessions.map(s => ({ kind: s.kind, minutes: s.minutes, what: s.what, why: s.why })), board: prof?.board || 'CBSE', class: prof?.cls || '10' })
        if (cancelled || !Array.isArray(r?.sessions)) return
        setPlan({ ...base, sessions: base.sessions.map((s, i) => ({ ...s, what: r.sessions[i]?.what || s.what, why: r.sessions[i]?.why || s.why })) })
      } catch { if (!cancelled) setStandard(true) }
    })()
    return () => { cancelled = true }
  }, [node?.id, base])

  if (!node) return <div style={shell}><div style={scroll}><Back onClick={onBack} /><Card style={{ marginTop: 14 }}><div style={{ fontSize: 13.5, color: T.text2 }}>That chapter is not in your syllabus map.</div></Card></div></div>

  const finish = new Date(plan.finish).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const KIND = { LEARN: { icon: BookOpen, label: 'Learn' }, PRACTISE: { icon: Layers, label: 'Practise' }, TEST: { icon: PenLine, label: 'Test' } } as const

  return (
    <div style={shell}>
      <div style={scroll}>
        <Back onClick={onBack} />
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '10px 0 0', lineHeight: 1.3, letterSpacing: -0.3 }}>{node.name}</h1>
        <div style={{ fontSize: 13.5, color: T.text2, marginTop: 6, lineHeight: 1.5 }}>{plan.framing}</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
          {[{ v: `${plan.totalMinutes}`, l: 'minutes' }, { v: `${node.typical_marks}`, l: 'marks on the paper' }, { v: finish, l: 'finish date' }].map(t => (
            <Card key={t.l} style={{ textAlign: 'center', padding: '12px 8px' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{t.v}</div>
              <div style={{ fontSize: 10.5, color: T.faint, marginTop: 3 }}>{t.l}</div>
            </Card>
          ))}
        </div>

        <div style={{ marginTop: 18, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 14, top: 15, bottom: 15, width: 2, background: T.border }} aria-hidden />
          <div style={{ display: 'grid', gap: 12 }}>
            {plan.sessions.map((s, i) => {
              const K = KIND[s.kind]
              const when = new Date(s.day).toLocaleDateString('en-IN', { weekday: 'short' })
              return (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 10, background: T.accentSurface, color: T.accentPale, display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 700, flexShrink: 0, position: 'relative', zIndex: 1 }}>{i + 1}</div>
                  <Card style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, letterSpacing: 1.2, fontWeight: 700, color: T.accentPale, background: T.accentSurface, borderRadius: 100, padding: '4px 9px' }}><K.icon size={12} {...ICON} /> {K.label.toUpperCase()}</span>
                      <span style={{ fontSize: 12, color: T.dim }}>{when} · {s.minutes} min</span>
                    </div>
                    <div style={{ fontSize: 14, color: T.text, lineHeight: 1.5, marginTop: 8 }}>{s.what}</div>
                    <div style={{ fontSize: 12.5, color: T.dim, lineHeight: 1.5, marginTop: 5 }}>{s.why}</div>
                    {s.kind === 'LEARN' && <button onClick={onLearn} style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, color: T.accentPale, fontSize: 12.5, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', minHeight: 32 }}>Open in Doubt Solving →</button>}
                    {s.kind === 'TEST' && <button onClick={onTest} style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, color: T.accentPale, fontSize: 12.5, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', minHeight: 32 }}>Run it in Practice →</button>}
                  </Card>
                </div>
              )
            })}
          </div>
        </div>
        {standard && <div style={{ fontSize: 12, color: T.faint, marginTop: 12 }}>Using the standard breakdown for this chapter.</div>}
      </div>
      <div style={footer}>
        <button aria-label="Edit" style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 14, background: T.raised, border: `1px solid ${T.borderCtl}`, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Pencil size={18} color={T.muted} {...ICON} /></button>
        <Primary onClick={() => onAdd(plan)}>Add to my plan</Primary>
      </div>
    </div>
  )
}

/* ── screen 4 ─────────────────────────────────────────────────────────────── */

function FocusScreen({ shell, footer, now, setNow, onExit, sessionsTotal }: {
  shell: Style; footer: Style; now: number; setNow: (n: number) => void; onExit: () => void; sessionsTotal: number
}) {
  const [session, setSession] = useState<any>(() => getJSON(FOCUS_KEY))
  const ring = useSpaceLayout().bp === 'desktop' ? 320 : 236   // the ring grows on a laptop; the column does not
  const [done, setDone] = useState(false)
  const awayRef = useRef<number | null>(null)

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [setNow])

  // Departures: visibilitychange + blur. Counted and summed, never punished.
  useEffect(() => {
    const leave = () => { if (!awayRef.current && session && !session.pausedAt) awayRef.current = Date.now() }
    const back = () => {
      if (awayRef.current == null) return
      const gone = Date.now() - awayRef.current; awayRef.current = null
      if (gone < 2000) return
      const next = { ...(getJSON<any>(FOCUS_KEY) || session), drifts: (session?.drifts || 0) + 1, driftMs: (session?.driftMs || 0) + gone }
      setJSON(FOCUS_KEY, next); setSession(next)
    }
    const onVis = () => (document.hidden ? leave() : back())
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', leave)
    window.addEventListener('focus', back)
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', leave); window.removeEventListener('focus', back) }
  }, [session])

  const left = remainingMs(session, now)
  const elapsed = elapsedMs(session, now)
  const fraction = session ? elapsed / Math.max(1, session.plannedMs) : 0

  function finish(why: 'complete' | 'stopped') {
    if (!session) return
    const focused = Math.min(session.plannedMs, elapsed)
    if (why === 'complete') { try { awardXP('session_done') } catch { /* nicety */ } }   // a finished session, not time spent
    try {
      const hist = parseHistory(JSON.parse(getRaw(HISTORY_KEY) || '[]'))
      const next = appendSession(hist, { ts: Date.now(), focusedMs: focused, plannedMs: session.plannedMs, drifts: session.drifts || 0, goal: session.task, driftMs: session.driftMs || undefined })
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    } catch { /* storage blocked */ }
    try { track({ type: 'session_end', durationMs: focused, payload: { kind: 'focus', goal: session.task, drifts: session.drifts || 0, why, plan: true } }) } catch { /* nicety */ }
    if (session.sessionId) {
      try { const all: any[] = getJSON(SESSIONS_KEY) || []; setJSON(SESSIONS_KEY, all.map(s => s.id === session.sessionId ? { ...s, done: true } : s)) } catch { /* ignore */ }
    }
    try { localStorage.removeItem(FOCUS_KEY) } catch { /* ignore */ }
    try { window.dispatchEvent(new CustomEvent('kyno:focus-banked')) } catch { /* ignore */ }
    setDone(true)
  }

  useEffect(() => { if (session && !done && left === 0 && elapsed > 0) finish('complete') }, [left]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return <div style={shell}><div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 20 }}><Card><div style={{ fontSize: 13.5, color: T.text2 }}>No session running.</div><div style={{ marginTop: 10 }}><Primary onClick={onExit}>Back to the plan</Primary></div></Card></div></div>

  const drift = driftLine(session.drifts || 0, session.driftMs || 0)
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000)

  return (
    <div style={shell}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 14px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ alignSelf: 'stretch', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Back onClick={() => finish('stopped')} />
          {sessionsTotal > 0 && <span style={{ fontSize: 11.5, fontWeight: 600, color: T.text2, background: T.raised, borderRadius: 100, padding: '5px 10px' }}>Session {Math.max(1, Math.min(sessionsTotal, 1))} of {sessionsTotal}</span>}
        </div>
        <div style={{ alignSelf: 'stretch', marginTop: 8 }}>
          <Eyebrow color={T.muted}>Focusing on</Eyebrow>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4, lineHeight: 1.35 }}>{session.task}</div>
        </div>

        <div style={{ position: 'relative', marginTop: 22 }}>
          <Ring fraction={done ? 1 : fraction} size={ring} />
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <div style={{ fontFamily: MONO, fontSize: ring === 320 ? 66 : 52, fontWeight: 600, letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>{done ? 'Done' : `${mm}:${String(ss).padStart(2, '0')}`}</div>
          </div>
        </div>

        <Card style={{ alignSelf: 'stretch', marginTop: 22 }}>
          <Eyebrow color={T.muted}>Accountability</Eyebrow>
          {drift ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{drift.left}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.warning }}>{drift.lost}</span>
            </div>
          ) : (
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>You have stayed in the app so far</div>
          )}
          <div style={{ fontSize: 12.5, color: T.dim, lineHeight: 1.5, marginTop: 8 }}>Kyno cannot lock your phone — no website can. It just notices, and tells you honestly at the end.</div>
        </Card>
      </div>
      <div style={{ ...footer, flexDirection: 'column', gap: 8 }}>
        {done ? (
          <Primary onClick={onExit}>Back to the plan</Primary>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <Secondary style={{ flex: 1 }} onClick={() => {
              const next = session.pausedAt ? { ...session, pausedMs: (session.pausedMs || 0) + (Date.now() - session.pausedAt), pausedAt: null } : { ...session, pausedAt: Date.now() }
              setJSON(FOCUS_KEY, next); setSession(next)
            }}>{session.pausedAt ? <><Play size={15} {...ICON} /> Resume</> : <><Pause size={15} {...ICON} /> Pause</>}</Secondary>
            <Secondary style={{ flex: 1 }} onClick={() => finish('complete')}><SkipForward size={15} {...ICON} /> Skip to break</Secondary>
          </div>
        )}
        <div style={{ fontSize: 12, color: T.faint, textAlign: 'center' }}>{done ? 'Five minute break. Then the next one, if you want it.' : '5 minute break after this, then one more session'}</div>
      </div>
    </div>
  )
}
