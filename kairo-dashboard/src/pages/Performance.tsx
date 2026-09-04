/**
 * Performance — one diagnosis space.
 *
 * Mistake Analysis, Explain Mistake and the Weakness Radar become one screen
 * organised around ERROR PATTERNS, not chapters. A student does not "get
 * vectors wrong"; they drop the ½ when substituting, or never write units.
 * Naming the repeating error is the product.
 *
 * Everything numeric here -- patterns, counts, marks, the stacked bar, the
 * topic split -- is computed from stored rows by performance.core.js and needs
 * no AI. Only three pieces of prose are generated (what is going on, the fix,
 * why you did it), once per signature, and every screen renders without them.
 *
 * TONE, from the brief: name the habit, never the person. Pair every problem
 * with its fix on the same screen. Report movement. Show what they have
 * beaten. No red banners, no sirens. Never compare them to other students.
 */
import { useState, useEffect, useMemo } from 'react'
import { ChevronRight, ArrowLeft, Star, Check, MessageSquare, Layers, Loader2, Info } from 'lucide-react'
import { T, FONT, MONO, ICON, ERR, CALLOUT } from '../lib/spaceTokens'
import { useSpaceLayout } from '../components/SpaceFrame'
import { awardOnce } from '../lib/game'
import type { ErrorType } from '../lib/spaceTokens'
import { post } from '../lib/api'
import { loadState } from '../lib/twin'
import { getJSON, setJSON } from '../lib/storage'
import {
  mistakeRecords, summarize, beatenCopy, impact as computeImpact, topicGroups, crossCut,
  habitTitle, occurrenceContext, shortDate, sinceLine, signatureInfo, TYPE_GLOSS, TYPES,
} from '../lib/performance.core'
import type { MistakeRecord, PatternRow, Impact } from '../lib/performance.core'

type Style = React.CSSProperties

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

function Primary({ children, onClick, style }: { children: React.ReactNode; onClick?: () => void; style?: Style }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', height: 52, borderRadius: 14, border: 'none', background: T.accent, color: '#fff',
      fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: 'pointer',
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

function Back({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', color: T.muted, fontFamily: FONT, fontSize: 13, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0, minHeight: 44,
    }}><ArrowLeft size={17} {...ICON} /> {label}</button>
  )
}

/** Type chip: 7px rounded square in the type colour + label, on raised2. Data colour, never text colour. */
function TypeChip({ type }: { type: ErrorType }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 9px', borderRadius: 100,
      background: T.raised2, fontSize: 11, fontWeight: 600, color: T.text2, letterSpacing: 0.3,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 2, background: ERR[type], flexShrink: 0 }} />
      {type}
    </span>
  )
}

/** 5-bar weekly sparkline: recent two in the type colour, older three in dashed grey. */
function Sparkline({ bars, type }: { bars: number[]; type: ErrorType }) {
  const max = Math.max(1, ...bars)
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 22 }} aria-hidden>
      {bars.map((b, i) => (
        <div key={i} title={`${b} that week`} style={{
          width: 6, height: Math.max(3, Math.round((b / max) * 22)), borderRadius: 2,
          background: i >= 3 ? ERR[type] : T.dashed,
        }} />
      ))}
    </div>
  )
}

/**
 * Horizontal stacked bar. 2px surface gaps between segments, 4px rounded ends
 * on the OUTER segments only, direct labels only where a number fits, legend
 * carries the rest. Text never wears the series colour.
 */
function StackedBar({ segments, total, height = 46 }: { segments: Array<{ type: ErrorType; marks: number; count: number }>; total: number; height?: number }) {
  const n = segments.length
  return (
    <div style={{ display: 'flex', gap: 2, height, width: '100%' }} role="img" aria-label={segments.map(s => `${s.type} ${s.marks}`).join(', ')}>
      {segments.map((s, i) => {
        const pct = total ? (s.marks / total) * 100 : 0
        return (
          <div key={s.type} title={`${s.type} · ${s.marks} marks · ${s.count} question${s.count === 1 ? '' : 's'}`} style={{
            flex: `${s.marks} 0 0`, minWidth: 6, background: ERR[s.type],
            borderRadius: i === 0 ? '4px 0 0 4px' : i === n - 1 ? '0 4px 4px 0' : 0,
            display: 'grid', placeItems: 'center',
          }}>
            {pct >= 14 && height >= 30 && <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{s.marks}</span>}
          </div>
        )
      })}
    </div>
  )
}

function Legend({ rows, showGloss = true }: { rows: Array<{ type: ErrorType; value?: string | number }>; showGloss?: boolean }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.map(r => (
        <div key={r.type} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: ERR[r.type], flexShrink: 0 }} />
          <span style={{ flex: 1, color: T.text2 }}>
            <span style={{ textTransform: 'capitalize', color: T.text, fontWeight: 600 }}>{r.type}</span>
            {showGloss && <span style={{ color: T.dim }}> — {TYPE_GLOSS[r.type]}</span>}
          </span>
          {r.value != null && <span style={{ color: T.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>}
        </div>
      ))}
    </div>
  )
}

/* ── diagnosis (the only AI) ─────────────────────────────────────────────── */

interface Diagnosis { diagnosis: string; fix: string; code: string; why: string; cost: string }

function useDiagnosis(row: PatternRow | null) {
  const [d, setD] = useState<Diagnosis | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'down'>('idle')
  useEffect(() => {
    if (!row) return
    const key = `kyno:perf:diag:${row.signature}`
    const cached = getJSON<Diagnosis & { ts: number }>(key)
    if (cached && Date.now() - cached.ts < 7 * 86400000) { setD(cached); setState('ready'); return }
    let cancelled = false
    setState('loading')
    ;(async () => {
      try {
        const r = await post('/performance/diagnose', {
          signature: row.signature, name: row.name, type: row.type,
          samples: row.occurrences.slice(0, 4).map(o => ({ question: o.question, lines: o.lines, divergedAt: o.divergedAt, why: o.why })),
        })
        if (cancelled) return
        setD(r); setState('ready')
        try { setJSON(key, { ...r, ts: Date.now() }) } catch { /* storage blocked */ }
      } catch {
        if (!cancelled) setState('down')
      }
    })()
    return () => { cancelled = true }
  }, [row?.signature])
  return { d, state }
}

/* ── the page ────────────────────────────────────────────────────────────── */

type View =
  | { name: 'patterns' }
  | { name: 'impact' }
  | { name: 'topics' }
  | { name: 'pattern'; signature: string }
  | { name: 'mistake'; id: string }

export default function Performance({ onOpenDoubt, onDrill }: {
  onOpenDoubt?: (seed: string) => void
  /** Hands a filter to Practice: signatures and/or topics to drill. */
  onDrill?: (filter: { signatures?: string[]; topics?: string[] }) => void
}) {
  const [view, setView] = useState<View>({ name: 'patterns' })
  // Desktop with room for it: the impact screen asks the frame for the wide
  // column; its bar then runs to 720px with the legend beside it.
  const layout = useSpaceLayout()
  useEffect(() => { layout.setWide(view.name === 'impact' && layout.areaWidth >= 760) }, [view.name, layout.areaWidth]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => layout.setWide(false), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [tick] = useState(0)

  const state = useMemo(() => { try { return loadState() } catch { return { events: [], mastery: [] } as any } }, [view.name, tick])
  const records = useMemo(() => mistakeRecords(state.events), [state])
  const summary = useMemo(() => summarize(records), [records])
  const impact = useMemo(() => computeImpact(records, state.events), [records, state])
  const topics = useMemo(() => topicGroups(records, state.mastery), [records, state])
  const pats = summary.state === 'empty' ? null : summary.patterns
  // A beaten pattern is worth 50 XP -- once. The signature is the key, so
  // re-detecting the same beaten pattern on the next visit pays nothing.
  useEffect(() => {
    for (const p of pats?.beaten || []) { try { awardOnce('pattern_beaten', p.signature) } catch { /* nicety */ } }
  }, [pats])

  const shell: Style = { position: 'absolute', inset: 0, background: T.bg, color: T.text, fontFamily: FONT, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
  const scroll: Style = { flex: 1, overflowY: 'auto', padding: '18px 14px 24px' }
  const footer: Style = { padding: '12px 14px calc(12px + env(safe-area-inset-bottom))', borderTop: `1px solid ${T.divider}`, background: T.bgAlt, display: 'flex', gap: 10 }

  /* ── screen 1: patterns ───────────────────────────────────────────────── */
  if (view.name === 'patterns') {
    const beaten = pats ? beatenCopy(pats) : null
    const heroMarks = impact ? impact.totalLost : (pats?.live.slice(0, 3).reduce((s, r) => s + r.marksLost, 0) || 0)
    return (
      <div style={shell}>
        <div style={scroll}>
          <Eyebrow>Performance</Eyebrow>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '8px 0 0', lineHeight: 1.25, letterSpacing: -0.3 }}>{summary.headline}</h1>

          {summary.state === 'empty' && (
            <Card style={{ marginTop: 18, padding: 18 }}>
              <div style={{ fontSize: 14, color: T.text2, lineHeight: 1.55 }}>{summary.sub}</div>
            </Card>
          )}

          {summary.state === 'early' && (
            <>
              <div style={{ fontSize: 13.5, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>{summary.sub}</div>
              <div style={{ marginTop: 18 }}><Eyebrow color={T.muted}>Recent mistakes</Eyebrow></div>
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {summary.recent.map(r => (
                  <Card key={r.id} onClick={() => setView({ name: 'mistake', id: r.id })} style={{ padding: 12, borderRadius: 15 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <TypeChip type={r.type} />
                      <div style={{ flex: 1, fontSize: 13, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{signatureInfo(r.signature).name}</div>
                      <div style={{ fontSize: 11.5, color: T.faint }}>{shortDate(r.ts)}</div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}

          {summary.state === 'ready' && pats && (
            <>
              {heroMarks > 0 && pats.live.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16, padding: '14px 16px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>{heroMarks}</span>
                    <span style={{ fontSize: 13, color: T.muted }}>marks</span>
                  </div>
                  <div style={{ width: 1, alignSelf: 'stretch', background: T.divider2 }} />
                  <div style={{ fontSize: 12.5, color: T.dim, lineHeight: 1.45 }}>
                    {impact ? `lost to these in your last mock — the same slips, not new topics` : `lost to these ${Math.min(3, pats.live.length)} — the same slips, not new topics`}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                {pats.live.map(row => (
                  <Card key={row.signature} onClick={() => setView({ name: 'pattern', signature: row.signature })}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 600, color: T.text, lineHeight: 1.35 }}>{row.name}</div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                          <TypeChip type={row.type} />
                          <span style={{ fontSize: 12, color: T.dim }}>{row.count} times · {row.trendLabel}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{row.marksLost}</div>
                        <div style={{ fontSize: 10.5, color: T.faint, marginTop: -2 }}>marks</div>
                        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}><Sparkline bars={row.sparkline} type={row.type} /></div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {beaten && (
                <Card style={{ marginTop: 14, border: `1px solid ${beaten.real ? T.successBorder : T.border}` }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 11, background: beaten.real ? T.successBg : T.raised, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Check size={17} color={beaten.real ? T.success : T.muted} {...ICON} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{beaten.title}</div>
                      <div style={{ fontSize: 12.5, color: T.dim, marginTop: 3, lineHeight: 1.4 }}>{beaten.sub}</div>
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            {(topics.relearn.length + topics.tighten.length) > 0 && (
              <Secondary onClick={() => setView({ name: 'topics' })} style={{ flex: 1 }}>By topic</Secondary>
            )}
          </div>
        </div>
        {impact && (
          <div style={footer}><Primary onClick={() => setView({ name: 'impact' })}>Where my marks went <ChevronRight size={18} {...ICON} /></Primary></div>
        )}
      </div>
    )
  }

  /* ── screen 2: impact ─────────────────────────────────────────────────── */
  if (view.name === 'impact') {
    // Calling setView during render is a React violation and it left an empty
    // shell on screen for a frame. Render a real screen and let the student move.
    if (!impact) return (
      <div style={shell}>
        <div style={scroll}>
          <Back onClick={() => setView({ name: 'patterns' })} />
          <div style={{ marginTop: 16, fontSize: 16, fontWeight: 700 }}>No mock to break down yet.</div>
          <div style={{ fontSize: 13.5, color: T.dim, lineHeight: 1.55, marginTop: 6 }}>
            Sit a mock in Practice and this shows exactly where the marks went.
          </div>
        </div>
      </div>
    )
    const i: Impact = impact
    return (
      <div style={shell}>
        <div style={scroll}>
          <Back onClick={() => setView({ name: 'patterns' })} />
          <div style={{ marginTop: 6 }}><Eyebrow color={T.muted}>{i.mockName} · {shortDate(i.mockTs)}</Eyebrow></div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 8 }}>
            <div><span style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>{i.scored}</span><span style={{ fontSize: 16, color: T.muted }}>/{i.total}</span></div>
            <div style={{ fontSize: 14, color: T.text2 }}>{i.totalLost} marks lost</div>
          </div>

          {/* Desktop: the bar runs full width to 720px and the legend moves to its right. */}
          <div style={layout.wide ? { marginTop: 18, display: 'flex', gap: 28, alignItems: 'flex-start' } : { marginTop: 18 }}>
            <div style={layout.wide ? { flex: '1 1 auto', maxWidth: 720, minWidth: 0 } : undefined}><StackedBar segments={i.segments} total={i.totalLost} height={layout.wide ? 56 : 46} /></div>
            <div style={layout.wide ? { width: 280, flexShrink: 0 } : { marginTop: 14 }}><Legend rows={i.segments.map(s => ({ type: s.type, value: s.marks }))} /></div>
          </div>

          {i.reframe && (
            <div style={{ marginTop: 18, padding: 16, borderRadius: 16, ...(i.reframe.headline.includes('not about knowing') ? CALLOUT.purple : CALLOUT.amber) }}>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.35 }}>{i.reframe.headline}</div>
              <div style={{ fontSize: 13.5, color: T.text2, lineHeight: 1.55, marginTop: 8 }}>{i.reframe.body}</div>
            </div>
          )}

          {i.cheapest.length > 0 && (
            <>
              <div style={{ marginTop: 20 }}><Eyebrow color={T.muted}>Cheapest marks to get back</Eyebrow></div>
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {i.cheapest.map(c => (
                  <div key={c.type} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 13px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 15 }}>
                    <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: ERR[c.type] }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.label}</div>
                      <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>{c.marks} marks · {c.cost}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div style={footer}>
          <Primary onClick={() => onDrill?.({ signatures: pats?.live.filter(r => r.type !== 'conceptual').slice(0, 2).map(r => r.signature) })}>
            Drill these for 10 minutes <ChevronRight size={18} {...ICON} />
          </Primary>
        </div>
      </div>
    )
  }

  /* ── screen 5: topics ─────────────────────────────────────────────────── */
  if (view.name === 'topics') {
    const group = (title: string, sub: string, rows: typeof topics.relearn) => rows.length > 0 && (
      <div style={{ marginTop: 20 }}>
        <Eyebrow color={T.muted}>{title}</Eyebrow>
        <div style={{ fontSize: 12, color: T.faint, marginTop: 3 }}>{sub}</div>
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          {rows.map(t => (
            <Card key={t.topic}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, textTransform: 'capitalize' }}>{t.topic}</div>
                {t.mastery != null && <div style={{ fontSize: 13, color: T.muted, fontVariantNumeric: 'tabular-nums' }}>{t.mastery}%</div>}
              </div>
              <div style={{ display: 'flex', gap: 2, height: 7, marginTop: 10, borderRadius: 4, overflow: 'hidden' }} aria-hidden>
                {TYPES.filter(ty => t.share[ty] > 0).map(ty => (
                  <div key={ty} title={`${ty} ${Math.round(t.share[ty] * 100)}%`} style={{ flex: `${t.share[ty]} 0 0`, background: ERR[ty], minWidth: 3 }} />
                ))}
              </div>
              <div style={{ fontSize: 12.5, color: T.text2, lineHeight: 1.5, marginTop: 10 }}>{t.advice}</div>
            </Card>
          ))}
        </div>
      </div>
    )
    return (
      <div style={shell}>
        <div style={scroll}>
          <Back onClick={() => setView({ name: 'patterns' })} />
          <div style={{ marginTop: 6 }}><Eyebrow>Performance · by topic</Eyebrow></div>
          <div style={{ fontSize: 14, color: T.text2, lineHeight: 1.55, marginTop: 8 }}>Two topics can both be at 40% for completely different reasons. These are sorted by what would actually fix them.</div>
          {group('Relearn — the idea is missing', 'Most of the marks here are conceptual', topics.relearn)}
          {group('Tighten up — you know it, you slip', 'The marks here go on habits, not ideas', topics.tighten)}
          <div style={{ marginTop: 18, padding: 12, borderRadius: 14, background: T.well, border: `1px solid ${T.divider}` }}>
            <Legend rows={TYPES.map(ty => ({ type: ty }))} />
          </div>
        </div>
        <div style={footer}>
          <Primary onClick={() => onDrill?.({ topics: [...topics.relearn, ...topics.tighten].slice(0, 3).map(t => t.topic) })}>
            Build a session from this <ChevronRight size={18} {...ICON} />
          </Primary>
        </div>
      </div>
    )
  }

  /* ── screen 3: pattern detail ─────────────────────────────────────────── */
  if (view.name === 'pattern') {
    const row = pats?.all.find(r => r.signature === view.signature) || null
    return <PatternDetail row={row} onBack={() => setView({ name: 'patterns' })} onMistake={id => setView({ name: 'mistake', id })} onDrill={() => onDrill?.({ signatures: [view.signature] })} shell={shell} scroll={scroll} footer={footer} />
  }

  /* ── screen 4: mistake detail ─────────────────────────────────────────── */
  const rec = records.find(r => r.id === view.id) || null
  const patternRow = rec ? pats?.all.find(r => r.signature === rec.signature) || null : null
  return (
    <div style={shell}>
      <div style={scroll}>
        <Back onClick={() => setView(patternRow?.isPattern ? { name: 'pattern', signature: patternRow.signature } : { name: 'patterns' })} />
        {!rec ? (
          <Card style={{ marginTop: 14 }}><div style={{ fontSize: 13.5, color: T.text2 }}>That mistake is no longer in your history.</div></Card>
        ) : (
          <>
            <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center' }}><TypeChip type={rec.type} /><span style={{ fontSize: 12, color: T.faint }}>{occurrenceContext(rec)} · {shortDate(rec.ts)}</span></div>
            {rec.question && <div style={{ fontSize: 15, lineHeight: 1.55, color: T.text, marginTop: 12 }}>{rec.question}</div>}

            {(rec.studentAnswer || rec.correctAnswer) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                <div style={{ padding: 12, borderRadius: 15, background: T.surface, border: `1px solid ${T.errorBorder}` }}>
                  <Eyebrow color={T.muted}>You wrote</Eyebrow>
                  <div style={{ fontFamily: MONO, fontSize: 18, marginTop: 8, wordBreak: 'break-word' }}>{rec.studentAnswer ?? '—'}</div>
                </div>
                <div style={{ padding: 12, borderRadius: 15, background: T.surface, border: `1px solid ${T.successBorder}` }}>
                  <Eyebrow color={T.muted}>Correct</Eyebrow>
                  <div style={{ fontFamily: MONO, fontSize: 18, marginTop: 8, wordBreak: 'break-word' }}>{rec.correctAnswer ?? '—'}</div>
                </div>
              </div>
            )}

            {rec.lines && rec.lines.length > 0 && (
              <Card style={{ marginTop: 14 }}>
                <Eyebrow color={T.muted}>Your working</Eyebrow>
                <div style={{ marginTop: 10 }}>
                  {rec.lines.map((l, i) => {
                    const here = rec.divergedAt === i + 1
                    return (
                      <div key={i} style={{
                        position: 'relative', fontFamily: MONO, fontSize: 13.5, lineHeight: 1.7, padding: '3px 10px', margin: '2px 0', borderRadius: 6,
                        color: here ? T.text : T.dim,
                        background: here ? 'rgba(224,112,90,0.12)' : 'transparent',
                        borderLeft: here ? `2px solid ${T.error}` : '2px solid transparent',
                      }}>
                        {l}
                        {here && <span style={{ position: 'absolute', right: 8, top: 6, fontSize: 10, fontWeight: 700, letterSpacing: 1, color: T.error, fontFamily: FONT }}>HERE</span>}
                      </div>
                    )
                  })}
                </div>
                {rec.stepReason && (
                  <>
                    <div style={{ height: 1, background: T.divider, margin: '12px 0' }} />
                    <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.55 }}>{rec.stepReason}</div>
                    {rec.divergedAt && rec.divergedAt < rec.lines.length && (
                      <div style={{ fontSize: 12.5, color: T.dim, marginTop: 6 }}>Everything after that line was correct arithmetic on a wrong number.</div>
                    )}
                  </>
                )}
              </Card>
            )}

            <Card style={{ marginTop: 14 }}>
              <Eyebrow color={T.muted}>Why you did it</Eyebrow>
              <div style={{ fontSize: 14, color: T.text2, lineHeight: 1.55, marginTop: 8 }}>
                {rec.why || signatureInfo(rec.signature).fix || 'Not enough on record to name the habit yet — the next one like it will.'}
              </div>
            </Card>

            {patternRow?.isPattern && (
              <div role="button" tabIndex={0} onClick={() => setView({ name: 'pattern', signature: patternRow.signature })}
                onKeyDown={e => { if (e.key === 'Enter') setView({ name: 'pattern', signature: patternRow.signature }) }}
                style={{ marginTop: 14, padding: 14, borderRadius: 16, cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center', ...CALLOUT.amber }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{ordinal(patternRow.occurrences.findIndex(o => o.id === rec.id) + 1)} time this term</div>
                  <div style={{ fontSize: 12.5, color: T.warning, marginTop: 3 }}>Part of your "{patternRow.name.replace(/^./, c => c.toLowerCase())}" pattern</div>
                </div>
                <ChevronRight size={17} color={T.fainter} {...ICON} />
              </div>
            )}
          </>
        )}
      </div>
      {rec && (
        <div style={footer}>
          <button onClick={() => onOpenDoubt?.(`I got this wrong${rec.question ? `: ${rec.question}` : ''}${rec.studentAnswer ? `\nI wrote: ${rec.studentAnswer}` : ''}${rec.correctAnswer ? `\nCorrect: ${rec.correctAnswer}` : ''}\nWhy?`)}
            aria-label="Ask Kyno about this" style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 14, background: T.raised, border: `1px solid ${T.borderCtl}`, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <MessageSquare size={19} color={T.muted} {...ICON} />
          </button>
          <Primary onClick={() => onDrill?.({ signatures: [rec.signature], topics: rec.topic ? [rec.topic] : undefined })}>Try one like it</Primary>
        </div>
      )}
    </div>
  )
}

function ordinal(n: number) {
  if (n <= 0) return 'Another'
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

/* ── screen 3 as its own component so the diagnosis hook can key on the row ── */

function PatternDetail({ row, onBack, onMistake, onDrill, shell, scroll, footer }: {
  row: PatternRow | null; onBack: () => void; onMistake: (id: string) => void; onDrill: () => void
  shell: Style; scroll: Style; footer: Style
}) {
  const { d, state } = useDiagnosis(row)
  const [showAll, setShowAll] = useState(false)
  if (!row) return <div style={shell}><div style={scroll}><Back onClick={onBack} /><Card style={{ marginTop: 14 }}><div style={{ fontSize: 13.5, color: T.text2 }}>That pattern is not in your history any more.</div></Card></div></div>

  const info = signatureInfo(row.signature)
  const occ = showAll ? row.occurrences : row.occurrences.slice(0, 6)
  const cut = crossCut(row.occurrences)
  const fix = d?.fix || info.fix
  const code = d?.code || info.code
  const cost = d?.cost || info.cost

  return (
    <div style={shell}>
      <div style={scroll}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Back onClick={onBack} />
          <TypeChip type={row.type} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '10px 0 0', lineHeight: 1.3, letterSpacing: -0.3 }}>{habitTitle(row.signature)}</h1>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 6 }}>{sinceLine(row)}</div>

        <Card style={{ marginTop: 18 }}>
          <Eyebrow color={T.muted}>When it happened</Eyebrow>
          <div style={{ display: 'grid', gap: 9, marginTop: 10 }}>
            {occ.map((o, i) => (
              <div key={o.id} role="button" tabIndex={0} onClick={() => onMistake(o.id)} onKeyDown={e => { if (e.key === 'Enter') onMistake(o.id) }}
                style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', minHeight: 30 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: i < 2 ? ERR[row.type] : '#4A3A2A', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, color: i < 2 ? T.text2 : T.dim }}>{occurrenceContext(o)}</span>
                <span style={{ fontSize: 12, color: T.faint }}>{shortDate(o.ts)}</span>
              </div>
            ))}
          </div>
          {cut && (
            <>
              <div style={{ height: 1, background: T.divider, margin: '12px 0' }} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: T.text2, lineHeight: 1.5 }}>
                <Info size={15} color={T.muted} {...ICON} style={{ flexShrink: 0, marginTop: 2 }} />{cut}
              </div>
            </>
          )}
        </Card>

        <Card style={{ marginTop: 12 }}>
          <Eyebrow color={T.muted}>What is actually going on</Eyebrow>
          {state === 'loading' && <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: 13, color: T.muted }}><Loader2 size={14} {...ICON} /> Reading your last few…</div>}
          {state !== 'loading' && (
            <div style={{ fontSize: 14, color: T.text2, lineHeight: 1.6, marginTop: 8 }}>
              {d?.diagnosis || (row.occurrences.find(o => o.why)?.why) || (state === 'down' ? 'The diagnosis is not available right now. Everything above is still yours.' : `You have done this ${row.count} times, and it costs ${row.marksLost} marks. The habit below is the one that stops it.`)}
            </div>
          )}
        </Card>

        {fix && (
          <div style={{ marginTop: 12, padding: 14, borderRadius: 16, ...CALLOUT.amber }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Star size={15} color={T.warning} {...ICON} /><Eyebrow color={T.warning}>The fix</Eyebrow></div>
            <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.45, marginTop: 8 }}>{fix}</div>
            {code && <pre style={{ margin: '12px 0 0', padding: '10px 12px', borderRadius: 12, background: T.well, border: `1px solid ${T.divider}`, fontFamily: MONO, fontSize: 12.5, color: T.text2, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{code}</pre>}
            {cost && <div style={{ fontSize: 12.5, color: T.dim, marginTop: 10, lineHeight: 1.5 }}>{cost.charAt(0).toUpperCase() + cost.slice(1)}.</div>}
          </div>
        )}
      </div>
      <div style={footer}>
        {row.occurrences.length > 6 && !showAll && <Secondary onClick={() => setShowAll(true)}>See all {row.occurrences.length}</Secondary>}
        <Primary onClick={onDrill} style={{ flex: 1 }}><Layers size={17} {...ICON} /> Drill this pattern</Primary>
      </div>
    </div>
  )
}

