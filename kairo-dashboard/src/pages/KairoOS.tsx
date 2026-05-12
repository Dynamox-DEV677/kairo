/**
 * Kairo OS — the AI Academic Twin dashboard.
 *
 * Reads everything from localStorage via src/lib/twin.ts. No network calls.
 * Each student's data lives entirely on their own device (Netflix-downloads
 * model). Wipes cleanly via the "Wipe my Twin" action.
 */
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Eye, BookOpen, MousePointerClick, Repeat,
  Activity, TrendingUp, TrendingDown, Clock, Brain,
  RefreshCw, X, Check, Beaker, Layers, Target,
  AlertTriangle, Award, Trash2,
} from 'lucide-react'
import {
  getDashboard, refresh, track,
  dismissRecommendation, actOnRecommendation, clearTwin,
  type DashboardSnapshot,
  type Twin, type Observation, type Recommendation, type TwinEvent,
  type MasteryRow,
} from '../lib/twin'

// ════════════════════════════════════════════════════════════════════════════
// TOKENS
// ════════════════════════════════════════════════════════════════════════════
const C = {
  bg:        '#06060a',
  panel:     '#0e0e16',
  panel2:    '#13131d',
  border:    '#222232',
  borderSoft:'#1a1a26',
  text:      '#fafafa',
  textDim:   '#a1a1aa',
  textFaint: '#71717a',
  purple:    '#a78bfa',
  blue:      '#60a5fa',
  cyan:      '#22d3ee',
  green:     '#34d399',
  amber:     '#fbbf24',
  red:       '#f87171',
}

const GRAD = {
  pill:   'linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #2563eb 100%)',
  text:   'linear-gradient(90deg, #c4b5fd 0%, #60a5fa 50%, #22d3ee 100%)',
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

export default function KairoOS() {
  const [snap, setSnap] = useState<DashboardSnapshot | null>(null)

  function reload() {
    setSnap(getDashboard())
  }

  useEffect(() => {
    reload()
    // Re-read whenever another tab updates localStorage (multi-tab safety)
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('kairo:twin:')) reload()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function onRefresh()  { setSnap(refresh()) }
  function onWipe() {
    if (confirm("Wipe your Kairo OS data on this device? This can't be undone.")) {
      clearTwin()
      reload()
    }
  }

  function onAct(id: string)     { actOnRecommendation(id);     reload() }
  function onDismiss(id: string) { dismissRecommendation(id);   reload() }
  function onSeed() {
    seedDemoEvents()
    reload()
  }

  if (!snap) return <PageSkeleton />

  if (!snap.hasData) {
    return <EmptyState onRefresh={onRefresh} onSeed={onSeed} />
  }

  return (
    <div style={{
      minHeight: '100%',
      background: C.bg,
      backgroundImage:
        `radial-gradient(at 12% 0%, rgba(124,58,237,0.10) 0%, transparent 36%),
         radial-gradient(at 88% 100%, rgba(37,99,235,0.10) 0%, transparent 42%)`,
      padding: '24px 24px 80px',
    }}>
      <style>{`
        @keyframes kr-spin { to { transform: rotate(360deg) } }
        @keyframes kr-glow { 0%,100% { opacity: .55 } 50% { opacity: .95 } }
        .kr-spin { animation: kr-spin .8s linear infinite }
      `}</style>

      <div style={{ maxWidth: 1240, margin: '0 auto' }}>

        <Header twin={snap.twin!} onRefresh={onRefresh} onWipe={onWipe} />

        {snap.observations.length > 0 && (
          <TwinVoice obs={snap.observations[0]} />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 18, marginTop: 22 }}>
          <PulseCard twin={snap.twin!} />
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 18 }}>
            <StyleCard twin={snap.twin!} />
            <PerformanceCard twin={snap.twin!} mastery={snap.mastery} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 18 }}>
          <HeatmapCard mastery={snap.mastery} />
          <RetentionCard mastery={snap.mastery} forgetting={snap.twin!.forgettingSoon} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginTop: 18 }}>
          <VitalsTile title="Burnout risk" value={snap.twin!.burnoutRisk}
            color={snap.twin!.burnoutRisk > 0.55 ? C.red : snap.twin!.burnoutRisk > 0.3 ? C.amber : C.green}
            hint={snap.twin!.burnoutRisk > 0.55 ? "Slow down. Sleep + walks are part of learning." : "You're pacing well."} />
          <VitalsTile title="Consistency" value={snap.twin!.consistencyScore}
            color={snap.twin!.consistencyScore > 0.6 ? C.green : snap.twin!.consistencyScore > 0.3 ? C.amber : C.red}
            hint={`${Math.round(snap.twin!.consistencyScore * 14)} of last 14 days active`} />
          <VitalsTile title="Confidence" value={snap.twin!.confidence}
            color={snap.twin!.confidence > 0.6 ? C.green : snap.twin!.confidence > 0.4 ? C.amber : C.red}
            hint={`Predicted exam: ${snap.twin!.predictedExamScore ?? '—'}${snap.twin!.predictedExamScore != null ? '%' : ''}  ·  ${snap.twin!.predictedBand ?? '—'}`} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18, marginTop: 18 }}>
          <RecommendationsCard recs={snap.recommendations} onAct={onAct} onDismiss={onDismiss} />
          <ObservationsCard obs={snap.observations.slice(1)} />
        </div>

        <div style={{ marginTop: 18 }}>
          <TimelineCard events={snap.recentEvents} />
        </div>

        <PrivacyFooter onWipe={onWipe} eventCount={snap.recentEvents.length} />
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// HEADER
// ════════════════════════════════════════════════════════════════════════════
function Header({ twin, onRefresh, onWipe }: { twin: Twin; onRefresh: () => void; onWipe: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: GRAD.pill, display: 'grid', placeItems: 'center',
          boxShadow: '0 8px 28px rgba(124,58,237,0.45)',
        }}>
          <Brain size={22} color="#fff" />
        </div>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 2.2, textTransform: 'uppercase',
            background: GRAD.text, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          }}>
            Kairo OS  ·  Academic Twin
          </div>
          <h1 style={{ margin: '2px 0 0', fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: -0.4 }}>
            Your learning intelligence
          </h1>
          <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 2 }}>
            Updated {formatRelative(twin.computedAt)}  ·  {twin.streakDays} day streak  ·  stored on this device
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onRefresh} style={chipBtn()}>
          <RefreshCw size={13} />
          Recompute
        </button>
        <button onClick={onWipe} style={{ ...chipBtn(), color: C.red, borderColor: 'rgba(248,113,113,0.4)' }}>
          <Trash2 size={13} />
          Wipe Twin
        </button>
      </div>
    </div>
  )
}

function chipBtn(): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'transparent', border: `1px solid ${C.border}`,
    borderRadius: 10, padding: '9px 14px', cursor: 'pointer',
    color: C.textDim, fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TWIN VOICE
// ════════════════════════════════════════════════════════════════════════════
function TwinVoice({ obs }: { obs: Observation }) {
  const toneColor = obs.tone === 'caution' ? C.amber : obs.tone === 'neutral' ? C.blue : C.purple
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{
      marginTop: 22, padding: '18px 22px',
      background: `linear-gradient(135deg, rgba(124,58,237,0.08), rgba(34,211,238,0.05))`,
      border: `1px solid rgba(124,58,237,0.32)`, borderRadius: 14,
      display: 'flex', alignItems: 'flex-start', gap: 14, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(at 0% 0%, rgba(124,58,237,0.18), transparent 40%)`, pointerEvents: 'none' }} />
      <div style={{
        width: 38, height: 38, borderRadius: 12, flexShrink: 0,
        background: GRAD.pill, display: 'grid', placeItems: 'center',
        boxShadow: `0 0 24px rgba(124,58,237,0.45)`,
      }}>
        <Sparkles size={18} color="#fff" />
      </div>
      <div style={{ position: 'relative', flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: toneColor, textTransform: 'uppercase', letterSpacing: 1.6 }}>
          Kairo  ·  {obs.kind}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginTop: 4, letterSpacing: -0.2 }}>
          {obs.title}
        </div>
        {obs.body && (
          <div style={{ fontSize: 13, color: C.textDim, marginTop: 4, lineHeight: 1.6 }}>
            {obs.body}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PULSE
// ════════════════════════════════════════════════════════════════════════════
function PulseCard({ twin }: { twin: Twin }) {
  const score = twin.retentionScore * 0.30
              + twin.consistencyScore * 0.25
              + twin.confidence * 0.25
              + (1 - twin.burnoutRisk) * 0.20
  const pct = Math.round(score * 100)
  const label = pct >= 75 ? 'Thriving' : pct >= 60 ? 'On track' : pct >= 45 ? 'Recovering' : 'Needs care'

  return (
    <Card>
      <CardTitle icon={<Activity size={13} />}>AI Pulse</CardTitle>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 0 8px' }}>
        <Ring score={score} />
      </div>
      <div style={{ textAlign: 'center', marginTop: 4 }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: C.text, letterSpacing: -1 }}>
          {pct}<span style={{ fontSize: 16, color: C.textFaint, marginLeft: 4 }}>/ 100</span>
        </div>
        <div style={{
          display: 'inline-block', marginTop: 4, padding: '4px 10px', borderRadius: 999,
          fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase',
          background: pct >= 75 ? 'rgba(52,211,153,0.12)' : pct >= 60 ? 'rgba(96,165,250,0.12)'
                    : pct >= 45 ? 'rgba(251,191,36,0.12)' : 'rgba(248,113,113,0.12)',
          color:    pct >= 75 ? C.green : pct >= 60 ? C.blue : pct >= 45 ? C.amber : C.red,
        }}>
          ● {label}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 18 }}>
        <SubMetric label="Retention"   value={Math.round(twin.retentionScore * 100)}   unit="%" />
        <SubMetric label="Consistency" value={Math.round(twin.consistencyScore * 100)} unit="%" />
        <SubMetric label="Confidence"  value={Math.round(twin.confidence * 100)}       unit="%" />
        <SubMetric label="Streak"      value={twin.streakDays}                          unit="d" />
      </div>
    </Card>
  )
}

function Ring({ score }: { score: number }) {
  const r = 78
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.max(0, Math.min(1, score)))
  return (
    <div style={{ position: 'relative', width: 200, height: 200 }}>
      <div style={{
        position: 'absolute', inset: -20,
        background: `radial-gradient(closest-side, rgba(124,58,237,0.42), transparent 70%)`,
        filter: 'blur(20px)', animation: 'kr-glow 4s ease-in-out infinite',
      }} />
      <svg width="200" height="200" style={{ position: 'relative', display: 'block' }}>
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#c4b5fd"/>
            <stop offset="40%"  stopColor="#7c3aed"/>
            <stop offset="80%"  stopColor="#3b82f6"/>
            <stop offset="100%" stopColor="#22d3ee"/>
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={r} fill="none" stroke={C.borderSoft} strokeWidth="14" />
        <circle cx="100" cy="100" r={r} fill="none"
          stroke="url(#ringGrad)" strokeWidth="14" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          transform="rotate(-90 100 100)"
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.2,.6,.2,1)' }} />
        <circle cx="100" cy="100" r="4" fill="#c4b5fd">
          <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite"/>
        </circle>
      </svg>
    </div>
  )
}

function SubMetric({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div style={{ background: C.panel2, border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1.2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginTop: 4 }}>
        {value}<span style={{ fontSize: 11, color: C.textFaint, marginLeft: 1 }}>{unit}</span>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// STYLE
// ════════════════════════════════════════════════════════════════════════════
function StyleCard({ twin }: { twin: Twin }) {
  const segments = [
    { id: 'visual',      label: 'Visual',      value: twin.styleVisual,      icon: Eye,               color: C.purple },
    { id: 'interactive', label: 'Interactive', value: twin.styleInteractive, icon: MousePointerClick, color: C.blue },
    { id: 'text',        label: 'Reading',     value: twin.styleText,        icon: BookOpen,          color: C.cyan },
    { id: 'repetition',  label: 'Repetition',  value: twin.styleRepetition,  icon: Repeat,            color: C.green },
  ]
  const top = [...segments].sort((a, b) => b.value - a.value)[0]
  return (
    <Card>
      <CardTitle icon={<Layers size={13} />}>Learning style</CardTitle>
      <div style={{ display: 'flex', height: 14, borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
        {segments.map(s => (
          <div key={s.id} style={{ width: `${s.value * 100}%`, background: s.color, transition: 'width 0.8s ease' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 14 }}>
        {segments.map(s => {
          const I = s.icon
          const isTop = s.id === top.id
          return (
            <div key={s.id} style={{
              padding: 10, borderRadius: 10,
              border: `1px solid ${isTop ? s.color + '50' : C.borderSoft}`,
              background: isTop ? s.color + '0d' : C.panel2,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <I size={12} color={s.color} />
                <span style={{ fontSize: 10.5, color: isTop ? s.color : C.textDim, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s.label}</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginTop: 4 }}>
                {Math.round(s.value * 100)}<span style={{ fontSize: 11, color: C.textFaint }}>%</span>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{
        marginTop: 14, padding: '10px 12px', borderRadius: 10,
        background: 'rgba(124,58,237,0.06)', border: `1px solid rgba(124,58,237,0.22)`,
        fontSize: 12.5, color: C.textDim, lineHeight: 1.55,
      }}>
        <span style={{ color: top.color, fontWeight: 700 }}>You're a {top.label.toLowerCase()} learner.</span>{' '}
        Kairo will preferentially surface {top.label.toLowerCase()} content (labs, flashcards, notes) when you next ask for help.
      </div>
    </Card>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PERFORMANCE
// ════════════════════════════════════════════════════════════════════════════
function PerformanceCard({ twin, mastery }: { twin: Twin; mastery: (MasteryRow & { retentionNow: number })[] }) {
  const trendUp = twin.performanceTrend > 0.05
  const trendDn = twin.performanceTrend < -0.05
  const TrendIcon = trendUp ? TrendingUp : trendDn ? TrendingDown : Activity
  const trendColor = trendUp ? C.green : trendDn ? C.red : C.blue
  const masteredCount = mastery.filter(m => m.mastery >= 0.7).length

  return (
    <Card>
      <CardTitle icon={<TrendingUp size={13} />}>Trajectory</CardTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12 }}>
        <BigStat label="Trend" value={`${twin.performanceTrend > 0 ? '+' : ''}${(twin.performanceTrend * 100).toFixed(0)}`} unit="%" color={trendColor} icon={<TrendIcon size={14} color={trendColor} />} />
        <BigStat label="Predicted exam" value={twin.predictedExamScore ?? '—'} unit={twin.predictedExamScore != null ? '%' : ''} color={C.purple} subtitle={twin.predictedBand ? `Grade ${twin.predictedBand}` : 'Need more data'} />
        <BigStat label="Mastered" value={masteredCount} unit={` topic${masteredCount === 1 ? '' : 's'}`} color={C.cyan} subtitle={`${mastery.length} total tracked`} />
      </div>
      <div style={{
        marginTop: 14, padding: '10px 12px', borderRadius: 10,
        background: C.panel2, border: `1px solid ${C.borderSoft}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Clock size={14} color={C.purple} />
        <div style={{ flex: 1, fontSize: 12, color: C.textDim, lineHeight: 1.55 }}>
          {twin.focusBestHour != null ? (
            <>You score highest around <span style={{ color: C.text, fontWeight: 700 }}>{twin.focusBestHour}:00</span>{twin.focusAvgMinutes ? ` · avg session ${twin.focusAvgMinutes} min` : ''}</>
          ) : (
            <>Build a study habit and Kairo will pinpoint your best hour.</>
          )}
        </div>
        <span style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase',
          padding: '3px 8px', borderRadius: 6,
          background: paceColor(twin.pace) + '18', color: paceColor(twin.pace),
        }}>{twin.pace}</span>
      </div>
    </Card>
  )
}

function paceColor(pace: string) {
  if (pace === 'fast')         return C.green
  if (pace === 'inconsistent') return C.amber
  if (pace === 'slow')         return C.red
  return C.blue
}

function BigStat({ label, value, unit, color, icon, subtitle }: any) {
  return (
    <div style={{ background: C.panel2, border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: '12px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon}
        <span style={{ fontSize: 9.5, fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1.2 }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || C.text, marginTop: 4, letterSpacing: -0.5 }}>
        {value}<span style={{ fontSize: 12, color: C.textFaint, marginLeft: 1, fontWeight: 600 }}>{unit}</span>
      </div>
      {subtitle && (<div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 2 }}>{subtitle}</div>)}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// HEATMAP
// ════════════════════════════════════════════════════════════════════════════
function HeatmapCard({ mastery }: { mastery: (MasteryRow & { retentionNow: number })[] }) {
  const bySubject = useMemo(() => {
    const m = new Map<string, MasteryRow[]>()
    for (const row of mastery) {
      if (!m.has(row.subject)) m.set(row.subject, [])
      m.get(row.subject)!.push(row)
    }
    for (const [, rows] of m) rows.sort((a, b) => a.mastery - b.mastery)
    return [...m.entries()].sort((a, b) => avgMastery(a[1]) - avgMastery(b[1]))
  }, [mastery])

  if (mastery.length === 0) {
    return (
      <Card>
        <CardTitle icon={<Target size={13} />}>Weakness heatmap</CardTitle>
        <EmptyInline icon={<Target size={20} color={C.textFaint} />} text="Take a quiz or open a lab — topics you touch will appear here, coloured by mastery." />
      </Card>
    )
  }

  return (
    <Card>
      <CardTitle icon={<Target size={13} />}>
        Weakness heatmap
        <span style={{ marginLeft: 'auto', fontSize: 10, color: C.textFaint, fontWeight: 600 }}>{mastery.length} topic{mastery.length === 1 ? '' : 's'}</span>
      </CardTitle>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 320, overflowY: 'auto' }}>
        {bySubject.map(([subject, rows]) => (
          <div key={subject}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1.3 }}>{subject}</span>
              <span style={{ fontSize: 11, color: C.textFaint }}>{Math.round(avgMastery(rows) * 100)}% avg</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {rows.map(t => (
                <div key={`${subject}-${t.topic}`} title={`${t.topic}: ${(t.mastery * 100).toFixed(0)}% mastery, ${t.attempts} attempts`} style={{
                  padding: '6px 10px', borderRadius: 8,
                  background: masteryColor(t.mastery, 0.15),
                  border: `1px solid ${masteryColor(t.mastery, 0.4)}`,
                  fontSize: 11.5, fontWeight: 500,
                  color: masteryColor(t.mastery, 1),
                  whiteSpace: 'nowrap',
                }}>
                  {t.topic}
                  <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>{Math.round(t.mastery * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.borderSoft}` }}>
        <span style={{ fontSize: 10, color: C.textFaint, fontWeight: 600 }}>WEAK</span>
        <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'linear-gradient(90deg, #f87171, #fbbf24 50%, #34d399)' }} />
        <span style={{ fontSize: 10, color: C.textFaint, fontWeight: 600 }}>MASTERED</span>
      </div>
    </Card>
  )
}

function avgMastery(rows: MasteryRow[]) {
  return rows.length === 0 ? 0 : rows.reduce((a, b) => a + b.mastery, 0) / rows.length
}

function masteryColor(m: number, alpha: number) {
  if (m < 0.4)  return alpha === 1 ? '#fca5a5' : `rgba(248,113,113,${alpha})`
  if (m < 0.7)  return alpha === 1 ? '#fcd34d' : `rgba(251,191,36,${alpha})`
  return alpha === 1 ? '#86efac' : `rgba(52,211,153,${alpha})`
}

// ════════════════════════════════════════════════════════════════════════════
// RETENTION
// ════════════════════════════════════════════════════════════════════════════
function RetentionCard({ mastery, forgetting }: { mastery: (MasteryRow & { retentionNow: number })[]; forgetting: Twin['forgettingSoon'] }) {
  const top = useMemo(() => [...mastery].sort((a, b) => b.mastery - a.mastery).slice(0, 10), [mastery])

  const points = useMemo(() => {
    if (top.length === 0) return []
    const series: { d: number; retention: number }[] = []
    for (let d = 0; d < 7; d++) {
      const a = top.reduce((acc, t) => {
        const halfLife = 2 + t.mastery * 12
        const r = Math.pow(0.5, d / halfLife)
        return acc + r * t.retentionNow
      }, 0) / top.length
      series.push({ d, retention: a })
    }
    return series
  }, [top])

  if (mastery.length === 0) {
    return (
      <Card>
        <CardTitle icon={<Brain size={13} />}>Memory retention</CardTitle>
        <EmptyInline icon={<Brain size={20} color={C.textFaint} />} text="Your forgetting curve appears here once Kairo sees you study a topic." />
      </Card>
    )
  }

  const W = 480, H = 140, P = 22
  const xs = (d: number) => P + (W - 2*P) * (d / 6)
  const ys = (r: number) => H - P - (H - 2*P) * r
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xs(p.d)} ${ys(p.retention)}`).join(' ')
  const areaPath = `${linePath} L ${xs(6)} ${H - P} L ${xs(0)} ${H - P} Z`

  return (
    <Card>
      <CardTitle icon={<Brain size={13} />}>
        Memory retention
        <span style={{ marginLeft: 'auto', fontSize: 10, color: C.textFaint, fontWeight: 600 }}>7-day forecast</span>
      </CardTitle>
      <div style={{ marginTop: 12 }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="retArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#a78bfa" stopOpacity="0.45"/>
              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0"/>
            </linearGradient>
            <linearGradient id="retLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#c4b5fd"/>
              <stop offset="100%" stopColor="#22d3ee"/>
            </linearGradient>
          </defs>
          <line x1={P} y1={ys(0.6)} x2={W - P} y2={ys(0.6)} stroke={C.borderSoft} strokeDasharray="3 4" />
          <text x={W - P + 2} y={ys(0.6) + 3} fill={C.textFaint} fontSize="9" fontFamily="inherit">60%</text>
          <path d={areaPath} fill="url(#retArea)" />
          <path d={linePath} fill="none" stroke="url(#retLine)" strokeWidth="2.5" strokeLinejoin="round" />
          {points.map(p => (
            <circle key={p.d} cx={xs(p.d)} cy={ys(p.retention)} r="3.5" fill="#fff" stroke="#a78bfa" strokeWidth="2" />
          ))}
          {points.map(p => (
            <text key={`l-${p.d}`} x={xs(p.d)} y={H - 6} fill={C.textFaint} fontSize="9" textAnchor="middle" fontFamily="inherit">
              {p.d === 0 ? 'Today' : `+${p.d}d`}
            </text>
          ))}
        </svg>
      </div>
      {forgetting.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.borderSoft}` }}>
          <div style={{ fontSize: 10, color: C.textFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 8 }}>Revise soon</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {forgetting.slice(0, 3).map(f => (
              <div key={f.topic} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: C.textDim }}>
                <span style={{ width: 4, height: 18, background: f.hoursUntilForget < 24 ? C.red : C.amber, borderRadius: 2 }} />
                <span style={{ color: C.text, fontWeight: 600, textTransform: 'capitalize', flex: 1 }}>{f.topic}</span>
                <span style={{ color: C.textFaint, fontSize: 10.5 }}>
                  {f.hoursUntilForget < 24 ? `${Math.round(f.hoursUntilForget)}h` : `${Math.round(f.hoursUntilForget / 24)}d`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// VITALS
// ════════════════════════════════════════════════════════════════════════════
function VitalsTile({ title, value, color, hint }: { title: string; value: number; color: string; hint: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1.4 }}>{title}</span>
        <span style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: -0.5 }}>{pct}%</span>
      </div>
      <div style={{ marginTop: 10, height: 7, background: C.panel2, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          boxShadow: `0 0 12px ${color}88`,
          transition: 'width 0.9s cubic-bezier(.2,.6,.2,1)',
        }} />
      </div>
      <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 9, lineHeight: 1.5 }}>{hint}</div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// RECOMMENDATIONS
// ════════════════════════════════════════════════════════════════════════════
function RecommendationsCard({ recs, onAct, onDismiss }: { recs: Recommendation[]; onAct: (id: string) => void; onDismiss: (id: string) => void }) {
  if (recs.length === 0) {
    return (
      <Card>
        <CardTitle icon={<Sparkles size={13} />}>Recommended next</CardTitle>
        <EmptyInline icon={<Sparkles size={20} color={C.textFaint} />} text="No suggestions right now — you're doing great. Recompute after your next session." />
      </Card>
    )
  }
  return (
    <Card>
      <CardTitle icon={<Sparkles size={13} />}>
        Recommended next
        <span style={{ marginLeft: 'auto', fontSize: 10, color: C.textFaint, fontWeight: 600 }}>Ranked by priority</span>
      </CardTitle>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <AnimatePresence>
          {recs.map(r => (
            <motion.div key={r.id}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 12,
                background: C.panel2, border: `1px solid ${C.borderSoft}`,
                position: 'relative', overflow: 'hidden',
              }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: recKindColor(r.kind) }} />
              <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: recKindColor(r.kind) + '18', display: 'grid', placeItems: 'center' }}>
                <RecIcon kind={r.kind} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: recKindColor(r.kind), textTransform: 'uppercase', letterSpacing: 1.2 }}>
                  {r.kind}{r.subject ? ` · ${r.subject}` : ''}
                </div>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginTop: 2 }}>{r.reason}</div>
              </div>
              <button onClick={() => onAct(r.id)} title="Mark done" style={iconBtnStyle()}>
                <Check size={13} color={C.green} />
              </button>
              <button onClick={() => onDismiss(r.id)} title="Dismiss" style={iconBtnStyle()}>
                <X size={13} color={C.textFaint} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Card>
  )
}

function iconBtnStyle(): React.CSSProperties {
  return {
    width: 28, height: 28, borderRadius: 7,
    background: 'transparent', border: `1px solid ${C.borderSoft}`,
    cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0,
  }
}

function recKindColor(kind: string) {
  return kind === 'revise'    ? C.amber
       : kind === 'lab'       ? C.purple
       : kind === 'flashcard' ? C.cyan
       : kind === 'quiz'      ? C.blue
       : kind === 'break'     ? C.red
       : kind === 'plan'      ? C.green
       : C.textDim
}

function RecIcon({ kind }: { kind: string }) {
  const I = kind === 'revise' ? Repeat
    : kind === 'lab' ? Beaker
    : kind === 'flashcard' ? Layers
    : kind === 'quiz' ? Target
    : kind === 'break' ? AlertTriangle
    : Sparkles
  return <I size={15} color={recKindColor(kind)} />
}

// ════════════════════════════════════════════════════════════════════════════
// OBSERVATIONS
// ════════════════════════════════════════════════════════════════════════════
function ObservationsCard({ obs }: { obs: Observation[] }) {
  if (obs.length === 0) {
    return (
      <Card>
        <CardTitle icon={<Award size={13} />}>Insights</CardTitle>
        <EmptyInline icon={<Award size={20} color={C.textFaint} />} text="Kairo will surface insights as patterns emerge in your studying." />
      </Card>
    )
  }
  return (
    <Card>
      <CardTitle icon={<Award size={13} />}>Insights</CardTitle>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {obs.slice(0, 6).map(o => {
          const tone = o.tone === 'caution' ? C.amber : o.tone === 'neutral' ? C.blue : C.purple
          return (
            <div key={o.id} style={{ padding: '11px 12px', borderRadius: 10, background: C.panel2, border: `1px solid ${C.borderSoft}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: tone, textTransform: 'uppercase', letterSpacing: 1.2 }}>{o.kind}</div>
              <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginTop: 2, lineHeight: 1.4 }}>{o.title}</div>
              {o.body && (<div style={{ fontSize: 11.5, color: C.textDim, marginTop: 4, lineHeight: 1.55 }}>{o.body}</div>)}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TIMELINE
// ════════════════════════════════════════════════════════════════════════════
function TimelineCard({ events }: { events: TwinEvent[] }) {
  if (events.length === 0) {
    return (
      <Card>
        <CardTitle icon={<Activity size={13} />}>Recent activity</CardTitle>
        <EmptyInline icon={<Activity size={20} color={C.textFaint} />} text="Your activity timeline will fill in as you take quizzes, open labs, and review flashcards." />
      </Card>
    )
  }
  return (
    <Card>
      <CardTitle icon={<Activity size={13} />}>
        Recent activity
        <span style={{ marginLeft: 'auto', fontSize: 10, color: C.textFaint, fontWeight: 600 }}>Last {events.length} events</span>
      </CardTitle>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflowY: 'auto' }}>
        {events.map((e, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '8px 10px', borderRadius: 8,
            borderLeft: `2px solid ${eventColor(e.type)}`,
            background: i % 2 === 0 ? 'transparent' : C.panel2 + '88',
          }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: eventColor(e.type), textTransform: 'uppercase', letterSpacing: 1.2, width: 110 }}>
              {labelFor(e.type)}
            </span>
            <span style={{ fontSize: 12, color: C.text, fontWeight: 500, flex: 1 }}>
              {e.topic ? <span style={{ textTransform: 'capitalize' }}>{e.topic}</span> : '—'}
              {e.subject && <span style={{ color: C.textFaint, marginLeft: 6 }}>· {e.subject}</span>}
            </span>
            {e.score != null && (
              <span style={{ fontSize: 11, fontWeight: 700, color: C.text, padding: '2px 8px', borderRadius: 6, background: C.panel }}>
                {Math.round(e.score)}%
              </span>
            )}
            {e.correct === true  && <Check size={12} color={C.green} />}
            {e.correct === false && <X     size={12} color={C.red} />}
            <span style={{ fontSize: 10.5, color: C.textFaint, width: 70, textAlign: 'right' }}>{formatRelative(e.ts)}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function eventColor(t: string) {
  if (t === 'quiz_completed' || t === 'quiz_answered') return C.blue
  if (t === 'lab_opened' || t === 'lab_explored')      return C.purple
  if (t === 'flashcard_review')                         return C.cyan
  if (t === 'essay_graded')                              return C.green
  if (t === 'mistake')                                   return C.red
  if (t === 'mastery_up')                                return C.green
  if (t === 'mastery_down')                              return C.amber
  return C.textDim
}

function labelFor(t: string) { return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }

// ════════════════════════════════════════════════════════════════════════════
// PRIVACY FOOTER
// ════════════════════════════════════════════════════════════════════════════
function PrivacyFooter({ onWipe, eventCount }: { onWipe: () => void; eventCount: number }) {
  return (
    <div style={{
      marginTop: 26, padding: '14px 18px', borderRadius: 12,
      background: 'rgba(124,58,237,0.04)', border: `1px solid rgba(124,58,237,0.18)`,
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    }}>
      <Sparkles size={14} color={C.purple} />
      <div style={{ flex: 1, minWidth: 260, fontSize: 12, color: C.textDim, lineHeight: 1.55 }}>
        <span style={{ color: C.text, fontWeight: 700 }}>Stored on this device only.</span>{' '}
        Your Kairo OS profile ({eventCount} events) lives in your browser's localStorage —
        none of this is uploaded to Kairo's servers. Clearing your browser data wipes it.
      </div>
      <button onClick={onWipe} style={{
        ...chipBtn(), color: C.red, borderColor: 'rgba(248,113,113,0.4)', flexShrink: 0,
      }}>
        <Trash2 size={13} />
        Wipe my Twin
      </button>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PRIMITIVES
// ════════════════════════════════════════════════════════════════════════════
function Card({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{
      background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: 18, position: 'relative', overflow: 'hidden',
    }}>{children}</motion.div>
  )
}

function CardTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {icon && <div style={{ color: C.purple, display: 'flex', alignItems: 'center' }}>{icon}</div>}
      <span style={{
        fontSize: 11, fontWeight: 700, color: C.textDim,
        textTransform: 'uppercase', letterSpacing: 1.4,
        display: 'flex', alignItems: 'center', flex: 1, gap: 6,
      }}>{children}</span>
    </div>
  )
}

function EmptyInline({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{
      marginTop: 14, padding: '24px 16px', borderRadius: 12,
      border: `1px dashed ${C.border}`, background: C.panel2 + '66',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    }}>
      <div style={{ opacity: 0.55 }}>{icon}</div>
      <p style={{ margin: 0, fontSize: 12.5, color: C.textFaint, textAlign: 'center', maxWidth: 340, lineHeight: 1.55 }}>{text}</p>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div style={{ padding: 40, color: C.textDim }}>
      <style>{`@keyframes kr-spin { to { transform: rotate(360deg) } } .kr-spin { animation: kr-spin .8s linear infinite }`}</style>
      Loading your Twin…
    </div>
  )
}

function EmptyState({ onRefresh, onSeed }: { onRefresh: () => void; onSeed: () => void }) {
  return (
    <div style={{
      minHeight: '70vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40,
      background: C.bg,
      backgroundImage:
        `radial-gradient(at 12% 0%, rgba(124,58,237,0.10) 0%, transparent 36%),
         radial-gradient(at 88% 100%, rgba(37,99,235,0.10) 0%, transparent 42%)`,
    }}>
      <style>{`@keyframes kr-glow { 0%,100% { opacity: .55 } 50% { opacity: .95 } }`}</style>
      <div style={{
        width: 60, height: 60, borderRadius: 16,
        background: GRAD.pill, display: 'grid', placeItems: 'center',
        boxShadow: '0 12px 36px rgba(124,58,237,0.45)',
      }}>
        <Brain size={28} color="#fff" />
      </div>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>Kairo OS is waking up</h2>
      <p style={{ margin: 0, fontSize: 13, color: C.textFaint, maxWidth: 420, textAlign: 'center', lineHeight: 1.6 }}>
        Take a quiz, open a lab, or review flashcards. Every interaction starts shaping your Academic Twin —
        which lives entirely on this device, never on our servers.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <button onClick={onRefresh} style={{
          padding: '10px 18px', borderRadius: 10,
          background: GRAD.pill, color: '#fff', fontWeight: 700, fontSize: 13,
          border: 'none', cursor: 'pointer',
        }}>Check again</button>
        <button onClick={onSeed} style={chipBtn()}>
          <Sparkles size={13} />
          Try with demo data
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// DEMO SEED — for new users to see what the dashboard looks like
// ════════════════════════════════════════════════════════════════════════════
function seedDemoEvents() {
  const demo: Array<Parameters<typeof track>[0] & { _daysAgo?: number }> = [
    { type: 'lab_opened',     subject: 'Biology',   topic: 'cell',                                       _daysAgo: 9 },
    { type: 'quiz_answered',  subject: 'Math',      topic: 'quadratic equations', correct: false, score: 40, difficulty: 0.6, _daysAgo: 8 },
    { type: 'quiz_answered',  subject: 'Math',      topic: 'quadratic equations', correct: true,  score: 70, difficulty: 0.6, _daysAgo: 8 },
    { type: 'flashcard_review', subject: 'Chemistry', topic: 'periodic table',  correct: true, _daysAgo: 7 },
    { type: 'lab_opened',     subject: 'Space',     topic: 'solar system',                              _daysAgo: 6 },
    { type: 'quiz_answered',  subject: 'Physics',   topic: 'newton laws',         correct: true,  score: 80, difficulty: 0.5, _daysAgo: 5 },
    { type: 'quiz_answered',  subject: 'Physics',   topic: 'newton laws',         correct: true,  score: 90, difficulty: 0.5, _daysAgo: 5 },
    { type: 'essay_graded',   subject: 'English',   topic: 'persuasive essay',                          _daysAgo: 4 },
    { type: 'lab_opened',     subject: 'Biology',   topic: 'dna',                                        _daysAgo: 3 },
    { type: 'quiz_answered',  subject: 'Math',      topic: 'vectors',             correct: false, score: 30, difficulty: 0.7, _daysAgo: 2 },
    { type: 'quiz_answered',  subject: 'Math',      topic: 'vectors',             correct: false, score: 50, difficulty: 0.7, _daysAgo: 2 },
    { type: 'flashcard_review', subject: 'Chemistry', topic: 'periodic table',  correct: true, _daysAgo: 1 },
    { type: 'lab_opened',     subject: 'Biology',   topic: 'heart',                                      _daysAgo: 1 },
    { type: 'quiz_completed', subject: 'Math',      topic: 'quadratic equations', score: 75,             _daysAgo: 0 },
  ]
  // Use track normally, then post-process timestamps by reading + re-saving.
  // (Cheap hack: avoids exposing a private "track at time T" API.)
  for (const d of demo) {
    const { _daysAgo, ...args } = d
    track(args as any)
    // Backdate the just-pushed event
    try {
      const state = JSON.parse(localStorage.getItem(localStorageKeyForDemo())!)
      const ev = state.events[state.events.length - 1]
      if (ev && _daysAgo) {
        ev.ts = Date.now() - _daysAgo * 86_400_000
        localStorage.setItem(localStorageKeyForDemo(), JSON.stringify(state))
      }
    } catch { /* ignore */ }
  }
}

// Demo seed helper — read the same storage key the lib uses.
function localStorageKeyForDemo(): string {
  // duplicate the key derivation so we don't need to export the internal
  try {
    const tok = localStorage.getItem('kairo_token')
    if (tok) {
      const payload = JSON.parse(atob(tok.split('.')[1]))
      if (payload?.sub) {
        let h = 0x811c9dc5
        const s = String(payload.sub)
        for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
        return 'kairo:twin:' + ((h >>> 0).toString(36)).padStart(7, '0')
      }
    }
  } catch { /* ignore */ }
  return 'kairo:twin:_local'
}

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════
function formatRelative(ms: number | null) {
  if (!ms) return '—'
  const diff = Date.now() - ms
  const s = Math.floor(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`
  return new Date(ms).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}
