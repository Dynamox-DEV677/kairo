/**
 * Kairo OS — the AI Academic Twin dashboard.
 *
 * Reads everything from localStorage via src/lib/twin.ts. No network calls.
 * Each student's data lives entirely on their own device (Netflix-downloads
 * model). Wipes cleanly via the "Wipe my Twin" action.
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Eye, BookOpen, MousePointerClick, Repeat,
  Activity, TrendingUp, TrendingDown, Clock, Brain,
  RefreshCw, X, Check, Beaker, Layers, Target,
  AlertTriangle, Award, Trash2, ChevronRight, Flame,
  CalendarDays, Zap, AlertCircle, Trophy, FileJson,
} from 'lucide-react'
import {
  getDashboard, refresh, track, dumpState,
  dismissRecommendation, actOnRecommendation, clearTwin,
  type DashboardSnapshot,
  type Twin, type Observation, type Recommendation, type TwinEvent,
  type MasteryRow, type Modality,
} from '../lib/twin'
import { confirmDialog } from '../components/ConfirmModal'
import TwinBackupModal from '../components/TwinBackupModal'
import { useIsMobile } from '../lib/useIsMobile'
import KairoOSMobile from './KairoOSMobile'

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
  blue:      '#c4b5fd',
  cyan:      '#c4b5fd',
  green:     '#c4b5fd',
  amber:     '#c4b5fd',
  red:       '#a78bfa',
}

const GRAD = {
  pill:   'linear-gradient(135deg, #7c3aed 0%, #5b21b6 50%, #7c3aed 100%)',
  text:   'linear-gradient(90deg, #c4b5fd 0%, #c4b5fd 50%, #c4b5fd 100%)',
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────────────────────
// DETAIL DRAWER — every tile on this dashboard opens one
// ────────────────────────────────────────────────────────────────────────────
type DetailKind =
  | { type: 'retention' }
  | { type: 'consistency' }
  | { type: 'confidence' }
  | { type: 'streak' }
  | { type: 'style'; modality: Modality }
  | { type: 'trend' }
  | { type: 'predictedExam' }
  | { type: 'mastered' }
  | { type: 'burnout' }
  | { type: 'vitalConsistency' }
  | { type: 'vitalConfidence' }
  | { type: 'mastery'; subject: string; topic: string }
  | { type: 'forgetting'; subject: string; topic: string }

export default function KairoOS() {
  const isMobile = useIsMobile(768)
  const [snap, setSnap] = useState<DashboardSnapshot | null>(null)
  const [pulse, setPulse] = useState(false)   // brief visual flash on recompute
  const [detail, setDetail] = useState<DetailKind | null>(null)
  const [backupOpen, setBackupOpen] = useState(false)

  function reload() {
    setSnap(getDashboard())
  }

  // ⚠️ ALL hooks must run before any conditional early-return (React rule).
  // Keep the desktop dashboard's useEffect here even when the mobile fork
  // takes over rendering — the snap state is shared by both branches.
  useEffect(() => {
    reload()
    // Re-read whenever another tab updates localStorage (multi-tab safety)
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('kairo:twin:')) reload()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // ── Mobile fork: render the native phone-first layout instead of the
  // desktop grid. The dashboard data still lives in localStorage so this
  // is just a different view of the same twin.
  if (isMobile) {
    return (
      <>
        <KairoOSMobile
          onNavigate={(route) => {
            const setActive = (window as any).__kairoSetActive
            if (typeof setActive === 'function') setActive(route)
          }}
          onOpenBackup={() => setBackupOpen(true)}
        />
        <TwinBackupModal
          open={backupOpen}
          onClose={() => setBackupOpen(false)}
        />
      </>
    )
  }

  function onRefresh() {
    setSnap(refresh())
    // Brief flash so the user knows the button did something even when data is unchanged
    setPulse(true)
    setTimeout(() => setPulse(false), 700)
  }
  async function onWipe() {
    const ok = await confirmDialog({
      title:        'Wipe your Twin?',
      body:         "Everything Kairo OS has learned about you on this device will be permanently erased. Schools, marks, and other school data are not affected.",
      confirmLabel: 'Yes, wipe my Twin',
      cancelLabel:  'Keep my Twin',
      tone:         'danger',
    })
    if (!ok) return
    clearTwin()
    reload()
  }

  function onAct(id: string) {
    try { actOnRecommendation(id) } catch (e) { console.warn('[Twin] mark-done failed:', e) }
    reload()
  }
  function onDismiss(id: string) {
    try { dismissRecommendation(id) } catch (e) { console.warn('[Twin] dismiss failed:', e) }
    reload()
  }
  function onSeed() {
    seedDemoEvents()
    reload()
  }

  if (!snap) return <PageSkeleton />

  if (!snap.hasData) {
    return <EmptyState onRefresh={onRefresh} onSeed={onSeed} />
  }

  return (
    // The Dashboard wraps every page in a `position:absolute; inset:0; flex`
    // container — pages must own their own scroll. Without `overflow-y:auto`
    // here, content past the viewport is clipped and the user can't reach
    // recommendations / timeline / footer.
    <div className="kr-page" style={{
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
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

        /* ── Responsive: collapse all grids to single column on phones ── */
        @media (max-width: 760px) {
          .kr-page { padding: 14px 16px 116px !important; }
          .kr-pulse-row,
          .kr-half-row,
          .kr-vitals-row,
          .kr-recs-row { grid-template-columns: 1fr !important; gap: 12px !important; }

          .kr-style-grid   { grid-template-columns: repeat(2, 1fr) !important; }
          .kr-perf-grid    { grid-template-columns: repeat(3, 1fr) !important; }
          .kr-submetrics   { gap: 6px !important; }

          .kr-pulse-ring   { width: 160px !important; height: 160px !important; }
          .kr-pulse-svg    { width: 160px !important; height: 160px !important; }

          .kr-header       { gap: 10px !important; }
          .kr-header h1    { font-size: 22px !important; }
          .kr-chip-row     { width: 100%; }

          .kr-card         { padding: 14px !important; }
          .kr-heatmap-list { max-height: 240px !important; }
          .kr-rec-item     { padding: 10px 12px !important; }
        }

        @media (max-width: 380px) {
          .kr-page { padding: 12px 12px 116px !important; }
          .kr-pulse-ring   { width: 140px !important; height: 140px !important; }
          .kr-pulse-svg    { width: 140px !important; height: 140px !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1240, margin: '0 auto' }}>

        <Header twin={snap.twin!} onRefresh={onRefresh} onWipe={onWipe} pulse={pulse} onBackup={() => setBackupOpen(true)} />

        {snap.observations.length > 0 && (
          <TwinVoice obs={snap.observations[0]} />
        )}

        <div className="kr-pulse-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 18, marginTop: 22 }}>
          <PulseCard twin={snap.twin!} openDetail={setDetail} />
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 18 }}>
            <StyleCard twin={snap.twin!} openDetail={setDetail} />
            <PerformanceCard twin={snap.twin!} mastery={snap.mastery} openDetail={setDetail} />
          </div>
        </div>

        <div className="kr-half-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 18 }}>
          <HeatmapCard mastery={snap.mastery} openDetail={setDetail} />
          <RetentionCard mastery={snap.mastery} forgetting={snap.twin!.forgettingSoon} openDetail={setDetail} />
        </div>

        <div className="kr-vitals-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginTop: 18 }}>
          <VitalsTile title="Burnout risk" value={snap.twin!.burnoutRisk}
            color={snap.twin!.burnoutRisk > 0.55 ? C.red : snap.twin!.burnoutRisk > 0.3 ? C.amber : C.green}
            hint={snap.twin!.burnoutRisk > 0.55 ? "Slow down. Sleep + walks are part of learning." : "You're pacing well."}
            onClick={() => setDetail({ type: 'burnout' })} />
          <VitalsTile title="Consistency" value={snap.twin!.consistencyScore}
            color={snap.twin!.consistencyScore > 0.6 ? C.green : snap.twin!.consistencyScore > 0.3 ? C.amber : C.red}
            hint={`${Math.round(snap.twin!.consistencyScore * 14)} of last 14 days active`}
            onClick={() => setDetail({ type: 'vitalConsistency' })} />
          <VitalsTile title="Confidence" value={snap.twin!.confidence}
            color={snap.twin!.confidence > 0.6 ? C.green : snap.twin!.confidence > 0.4 ? C.amber : C.red}
            hint={`Predicted exam: ${snap.twin!.predictedExamScore ?? '—'}${snap.twin!.predictedExamScore != null ? '%' : ''}  ·  ${snap.twin!.predictedBand ?? '—'}`}
            onClick={() => setDetail({ type: 'vitalConfidence' })} />
        </div>

        <div className="kr-recs-row" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18, marginTop: 18 }}>
          <RecommendationsCard recs={snap.recommendations} onAct={onAct} onDismiss={onDismiss} />
          <ObservationsCard obs={snap.observations.slice(1)} />
        </div>

        <div style={{ marginTop: 18 }}>
          <TimelineCard events={snap.recentEvents} />
        </div>

        <PrivacyFooter onWipe={onWipe} eventCount={snap.recentEvents.length} />
      </div>

      <AnimatePresence>
        {detail && (
          <DetailDrawer
            kind={detail}
            twin={snap.twin!}
            mastery={snap.mastery}
            onClose={() => setDetail(null)}
          />
        )}
      </AnimatePresence>

      <TwinBackupModal
        open={backupOpen}
        onClose={() => setBackupOpen(false)}
        onChange={reload}
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// HEADER
// ════════════════════════════════════════════════════════════════════════════
function Header({ twin, onRefresh, onWipe, pulse, onBackup }: { twin: Twin; onRefresh: () => void; onWipe: () => void; pulse: boolean; onBackup: () => void }) {
  return (
    <div className="kr-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
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
            {pulse ? (
              <span style={{ color: C.green, fontWeight: 600 }}>● Recomputed just now</span>
            ) : (
              <>Updated {formatRelative(twin.computedAt)}  ·  {twin.streakDays} day streak  ·  stored on this device</>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onRefresh} style={{
          ...chipBtn(),
          transition: 'all 0.2s ease',
          ...(pulse ? { borderColor: C.green, color: C.green, boxShadow: `0 0 12px ${C.green}55` } : {}),
        }}>
          <RefreshCw size={13} style={{ transform: pulse ? 'rotate(360deg)' : 'none', transition: 'transform 0.7s ease' }} />
          {pulse ? 'Recomputed' : 'Recompute'}
        </button>
        <button onClick={onBackup} title="Backup / restore your Twin to move it between devices" style={{
          ...chipBtn(), color: C.purple, borderColor: 'rgba(167,139,250,0.4)',
        }}>
          <FileJson size={13} />
          Backup
        </button>
        <button onClick={onWipe} style={{ ...chipBtn(), color: C.red, borderColor: 'rgba(167, 139, 250,0.4)' }}>
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
      background: `linear-gradient(135deg, rgba(124,58,237,0.08), rgba(196, 181, 253,0.05))`,
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
function PulseCard({ twin, openDetail }: { twin: Twin; openDetail: (k: DetailKind) => void }) {
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
          background: pct >= 75 ? 'rgba(196, 181, 253,0.12)' : pct >= 60 ? 'rgba(196, 181, 253,0.12)'
                    : pct >= 45 ? 'rgba(196, 181, 253,0.12)' : 'rgba(167, 139, 250,0.12)',
          color:    pct >= 75 ? C.green : pct >= 60 ? C.blue : pct >= 45 ? C.amber : C.red,
        }}>
          ● {label}
        </div>
      </div>
      <div className="kr-submetrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 18 }}>
        <SubMetric label="Retention"   value={Math.round(twin.retentionScore * 100)}   unit="%" onClick={() => openDetail({ type: 'retention' })} />
        <SubMetric label="Consistency" value={Math.round(twin.consistencyScore * 100)} unit="%" onClick={() => openDetail({ type: 'consistency' })} />
        <SubMetric label="Confidence"  value={Math.round(twin.confidence * 100)}       unit="%" onClick={() => openDetail({ type: 'confidence' })} />
        <SubMetric label="Streak"      value={twin.streakDays}                          unit="d" onClick={() => openDetail({ type: 'streak' })} />
      </div>
    </Card>
  )
}

function Ring({ score }: { score: number }) {
  const r = 78
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.max(0, Math.min(1, score)))
  return (
    <div className="kr-pulse-ring" style={{ position: 'relative', width: 200, height: 200 }}>
      <div style={{
        position: 'absolute', inset: -20,
        background: `radial-gradient(closest-side, rgba(124,58,237,0.42), transparent 70%)`,
        filter: 'blur(20px)', animation: 'kr-glow 4s ease-in-out infinite',
      }} />
      <svg className="kr-pulse-svg" width="200" height="200" style={{ position: 'relative', display: 'block' }}>
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#c4b5fd"/>
            <stop offset="40%"  stopColor="#7c3aed"/>
            <stop offset="80%"  stopColor="#a78bfa"/>
            <stop offset="100%" stopColor="#c4b5fd"/>
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

function SubMetric({ label, value, unit, onClick }: { label: string; value: number; unit: string; onClick?: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2, borderColor: 'rgba(167,139,250,0.5)', boxShadow: '0 6px 16px rgba(124,58,237,0.18)' }}
      whileTap={{ scale: 0.97 }}
      style={{
        background: C.panel2, border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: '10px 8px',
        textAlign: 'center', cursor: onClick ? 'pointer' : 'default', color: 'inherit', fontFamily: 'inherit',
        position: 'relative',
      }}
    >
      <div style={{ fontSize: 9.5, fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1.2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginTop: 4 }}>
        {value}<span style={{ fontSize: 11, color: C.textFaint, marginLeft: 1 }}>{unit}</span>
      </div>
      {onClick && (
        <ChevronRight size={10} color={C.textFaint} style={{ position: 'absolute', top: 6, right: 6, opacity: 0.5 }} />
      )}
    </motion.button>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// STYLE
// ════════════════════════════════════════════════════════════════════════════
function StyleCard({ twin, openDetail }: { twin: Twin; openDetail: (k: DetailKind) => void }) {
  const segments: Array<{ id: Modality; label: string; value: number; icon: any; color: string }> = [
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
      <div className="kr-style-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 14 }}>
        {segments.map(s => {
          const I = s.icon
          const isTop = s.id === top.id
          return (
            <motion.button
              key={s.id}
              type="button"
              onClick={() => openDetail({ type: 'style', modality: s.id })}
              whileHover={{ y: -2, boxShadow: `0 6px 16px ${s.color}26` }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: 10, borderRadius: 10,
                border: `1px solid ${isTop ? s.color + '50' : C.borderSoft}`,
                background: isTop ? s.color + '0d' : C.panel2,
                cursor: 'pointer', textAlign: 'left',
                color: 'inherit', fontFamily: 'inherit', position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <I size={12} color={s.color} />
                <span style={{ fontSize: 10.5, color: isTop ? s.color : C.textDim, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s.label}</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginTop: 4 }}>
                {Math.round(s.value * 100)}<span style={{ fontSize: 11, color: C.textFaint }}>%</span>
              </div>
              <ChevronRight size={10} color={C.textFaint} style={{ position: 'absolute', top: 8, right: 8, opacity: 0.5 }} />
            </motion.button>
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
function PerformanceCard({ twin, mastery, openDetail }: { twin: Twin; mastery: (MasteryRow & { retentionNow: number })[]; openDetail: (k: DetailKind) => void }) {
  const trendUp = twin.performanceTrend > 0.05
  const trendDn = twin.performanceTrend < -0.05
  const TrendIcon = trendUp ? TrendingUp : trendDn ? TrendingDown : Activity
  const trendColor = trendUp ? C.green : trendDn ? C.red : C.blue
  const masteredCount = mastery.filter(m => m.mastery >= 0.7).length

  return (
    <Card>
      <CardTitle icon={<TrendingUp size={13} />}>Trajectory</CardTitle>
      <div className="kr-perf-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12 }}>
        <BigStat label="Trend" value={`${twin.performanceTrend > 0 ? '+' : ''}${(twin.performanceTrend * 100).toFixed(0)}`} unit="%" color={trendColor} icon={<TrendIcon size={14} color={trendColor} />} onClick={() => openDetail({ type: 'trend' })} />
        <BigStat label="Predicted exam" value={twin.predictedExamScore ?? '—'} unit={twin.predictedExamScore != null ? '%' : ''} color={C.purple} subtitle={twin.predictedBand ? `Grade ${twin.predictedBand}` : 'Need more data'} onClick={() => openDetail({ type: 'predictedExam' })} />
        <BigStat label="Mastered" value={masteredCount} unit={` topic${masteredCount === 1 ? '' : 's'}`} color={C.cyan} subtitle={`${mastery.length} total tracked`} onClick={() => openDetail({ type: 'mastered' })} />
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

function BigStat({ label, value, unit, color, icon, subtitle, onClick }: any) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={onClick ? { y: -2, borderColor: (color || C.purple) + '50', boxShadow: `0 6px 18px ${(color || C.purple)}22` } : undefined}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      style={{
        background: C.panel2, border: `1px solid ${C.borderSoft}`, borderRadius: 10,
        padding: '12px 10px', cursor: onClick ? 'pointer' : 'default',
        color: 'inherit', fontFamily: 'inherit', textAlign: 'left', position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon}
        <span style={{ fontSize: 9.5, fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1.2 }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || C.text, marginTop: 4, letterSpacing: -0.5 }}>
        {value}<span style={{ fontSize: 12, color: C.textFaint, marginLeft: 1, fontWeight: 600 }}>{unit}</span>
      </div>
      {subtitle && (<div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 2 }}>{subtitle}</div>)}
      {onClick && (
        <ChevronRight size={10} color={C.textFaint} style={{ position: 'absolute', top: 8, right: 8, opacity: 0.5 }} />
      )}
    </motion.button>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// HEATMAP
// ════════════════════════════════════════════════════════════════════════════
function HeatmapCard({ mastery, openDetail }: { mastery: (MasteryRow & { retentionNow: number })[]; openDetail: (k: DetailKind) => void }) {
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
      <div className="kr-heatmap-list" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 320, overflowY: 'auto' }}>
        {bySubject.map(([subject, rows]) => (
          <div key={subject}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1.3 }}>{subject}</span>
              <span style={{ fontSize: 11, color: C.textFaint }}>{Math.round(avgMastery(rows) * 100)}% avg</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {rows.map(t => (
                <motion.button
                  key={`${subject}-${t.topic}`}
                  type="button"
                  onClick={() => openDetail({ type: 'mastery', subject: t.subject, topic: t.topic })}
                  whileHover={{ y: -2, boxShadow: `0 4px 12px ${masteryColor(t.mastery, 0.4)}` }}
                  whileTap={{ scale: 0.95 }}
                  title={`${t.topic}: ${(t.mastery * 100).toFixed(0)}% mastery, ${t.attempts} attempts`}
                  style={{
                    padding: '6px 10px', borderRadius: 8,
                    background: masteryColor(t.mastery, 0.15),
                    border: `1px solid ${masteryColor(t.mastery, 0.4)}`,
                    fontSize: 11.5, fontWeight: 500,
                    color: masteryColor(t.mastery, 1),
                    whiteSpace: 'nowrap', cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {t.topic}
                  <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>{Math.round(t.mastery * 100)}%</span>
                </motion.button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.borderSoft}` }}>
        <span style={{ fontSize: 10, color: C.textFaint, fontWeight: 600 }}>WEAK</span>
        <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'linear-gradient(90deg, #a78bfa, #c4b5fd 50%, #c4b5fd)' }} />
        <span style={{ fontSize: 10, color: C.textFaint, fontWeight: 600 }}>MASTERED</span>
      </div>
    </Card>
  )
}

function avgMastery(rows: MasteryRow[]) {
  return rows.length === 0 ? 0 : rows.reduce((a, b) => a + b.mastery, 0) / rows.length
}

function masteryColor(m: number, alpha: number) {
  if (m < 0.4)  return alpha === 1 ? '#c4b5fd' : `rgba(167, 139, 250,${alpha})`
  if (m < 0.7)  return alpha === 1 ? '#e9d5ff' : `rgba(196, 181, 253,${alpha})`
  return alpha === 1 ? '#c4b5fd' : `rgba(196, 181, 253,${alpha})`
}

// ════════════════════════════════════════════════════════════════════════════
// RETENTION
// ════════════════════════════════════════════════════════════════════════════
function RetentionCard({ mastery, forgetting, openDetail }: { mastery: (MasteryRow & { retentionNow: number })[]; forgetting: Twin['forgettingSoon']; openDetail: (k: DetailKind) => void }) {
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
              <stop offset="100%" stopColor="#c4b5fd"/>
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
              <motion.button
                key={f.topic}
                type="button"
                onClick={() => openDetail({ type: 'forgetting', subject: f.subject, topic: f.topic })}
                whileHover={{ x: 4, background: 'rgba(167,139,250,0.08)' }}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: C.textDim,
                  background: 'transparent', border: 'none', padding: '8px 6px', borderRadius: 8,
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}
              >
                <span style={{ width: 4, height: 18, background: f.hoursUntilForget < 24 ? C.red : C.amber, borderRadius: 2 }} />
                <span style={{ color: C.text, fontWeight: 600, textTransform: 'capitalize', flex: 1 }}>{f.topic}</span>
                <span style={{ color: C.textFaint, fontSize: 10.5 }}>
                  {f.hoursUntilForget < 24 ? `${Math.round(f.hoursUntilForget)}h` : `${Math.round(f.hoursUntilForget / 24)}d`}
                </span>
                <ChevronRight size={11} color={C.textFaint} />
              </motion.button>
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
function VitalsTile({ title, value, color, hint, onClick }: { title: string; value: number; color: string; hint: string; onClick?: () => void }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={onClick ? { y: -3, borderColor: color + '60', boxShadow: `0 10px 24px ${color}22` } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14,
        padding: '16px 18px', cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left', color: 'inherit', fontFamily: 'inherit',
        width: '100%', position: 'relative',
      }}
    >
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
      {onClick && (
        <ChevronRight size={12} color={C.textFaint} style={{ position: 'absolute', top: 14, right: 14, opacity: 0.5 }} />
      )}
    </motion.button>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// RECOMMENDATIONS
// ════════════════════════════════════════════════════════════════════════════
function RecommendationsCard({ recs, onAct, onDismiss }: { recs: Recommendation[]; onAct: (id: string) => void; onDismiss: (id: string) => void }) {
  // Keep a single render path so AnimatePresence stays mounted across the
  // last-rec → empty-state transition. Previously the component swapped
  // returns when recs.length hit 0 mid-exit-animation, which orphaned the
  // exit-animating item and collapsed the entire card to 0 visual height.
  const isEmpty = recs.length === 0
  return (
    <Card>
      <CardTitle icon={<Sparkles size={13} />}>
        Recommended next
        {!isEmpty && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: C.textFaint, fontWeight: 600 }}>Ranked by priority</span>
        )}
      </CardTitle>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 90 }}>
        {isEmpty ? (
          <EmptyInline
            icon={<Sparkles size={20} color={C.textFaint} />}
            text="No suggestions right now — you're doing great. Recompute after your next session."
          />
        ) : (
          // Plain map — no layout animations, no popLayout. The card was
          // flickering / "blinking" because every re-render of the parent
          // (poll, scroll, anything) triggered Framer's layout animator
          // on every rec item simultaneously. Static items now.
          recs.map(r => (
            <div key={r.id} className="kr-rec-item"
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
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAct(r.id) }}
                title="Mark done"
                aria-label="Mark this recommendation done"
                style={iconBtnStyle()}
              >
                <Check size={13} color={C.green} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(r.id) }}
                title="Dismiss"
                aria-label="Dismiss this recommendation"
                style={iconBtnStyle()}
              >
                <X size={13} color={C.textFaint} />
              </button>
            </div>
          ))
        )}
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
        ...chipBtn(), color: C.red, borderColor: 'rgba(167, 139, 250,0.4)', flexShrink: 0,
      }}>
        <Trash2 size={13} />
        Wipe my Twin
      </button>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// DETAIL DRAWER — interactive drill-down for every tile
// ════════════════════════════════════════════════════════════════════════════
function DetailDrawer({ kind, twin, mastery, onClose }: {
  kind:    DetailKind
  twin:    Twin
  mastery: (MasteryRow & { retentionNow: number })[]
  onClose: () => void
}) {
  const state   = useMemo(() => dumpState(), [])
  const events  = state.events
  const content = useMemo(() => renderDetail(kind, twin, mastery, events), [kind, twin, mastery, events])

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Portal to body so we escape any transform/filter stacking context
  // the dashboard layout (which has its own header at zIndex 200) might create.
  return createPortal(
    <>
      <motion.div
        key="dd-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(6,6,10,0.72)', backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      />
      <motion.div
        key="dd-panel"
        initial={{ opacity: 0, x: 80 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 80 }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(520px, 100vw)',
          zIndex: 9999, background: C.panel,
          borderLeft: `1px solid ${C.border}`,
          boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '20px 24px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'flex-start', gap: 14,
          background: `linear-gradient(180deg, ${content.accent}10, transparent)`,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11, flexShrink: 0,
            display: 'grid', placeItems: 'center',
            background: content.accent + '22',
            border: `1px solid ${content.accent}33`,
          }}>
            <content.icon size={20} color={content.accent} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: content.accent, textTransform: 'uppercase', letterSpacing: 1.4 }}>
              {content.kindLabel}
            </div>
            <h2 style={{ margin: '2px 0 0', fontSize: 19, fontWeight: 800, color: C.text, letterSpacing: -0.3, lineHeight: 1.25 }}>
              {content.title}
            </h2>
            {content.subtitle && (
              <div style={{ fontSize: 12, color: C.textFaint, marginTop: 4 }}>{content.subtitle}</div>
            )}
          </div>
          <button onClick={onClose} title="Close" style={{
            ...iconBtnStyle(), width: 32, height: 32, flexShrink: 0,
          }}>
            <X size={14} color={C.textDim} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 28px' }}>
          {/* Big value */}
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 10,
            padding: '18px 18px',
            borderRadius: 14,
            background: `linear-gradient(135deg, ${content.accent}18, ${content.accent}06)`,
            border: `1px solid ${content.accent}33`,
          }}>
            <div style={{ fontSize: 44, fontWeight: 800, color: content.accent, letterSpacing: -1.6, lineHeight: 1 }}>
              {content.value}
            </div>
            {content.valueSuffix && (
              <div style={{ fontSize: 16, color: C.textDim, fontWeight: 700 }}>{content.valueSuffix}</div>
            )}
          </div>

          {/* Explanation */}
          <DrawerSection title="What this means">
            <p style={{ margin: 0, fontSize: 13.5, color: C.textDim, lineHeight: 1.65 }}>{content.explanation}</p>
          </DrawerSection>

          {/* Breakdown rows */}
          {content.rows.length > 0 && (
            <DrawerSection title={content.rowsTitle || 'Recent contributions'}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {content.rows.map((r, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 10,
                    background: C.panel2, border: `1px solid ${C.borderSoft}`,
                  }}>
                    {r.dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: r.dot, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: C.text, fontWeight: 600, lineHeight: 1.35 }}>{r.label}</div>
                      {r.detail && <div style={{ fontSize: 11, color: C.textFaint, marginTop: 2, lineHeight: 1.4 }}>{r.detail}</div>}
                    </div>
                    {r.value != null && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: r.valueColor || C.textDim, whiteSpace: 'nowrap' }}>
                        {r.value}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </DrawerSection>
          )}

          {content.empty && (
            <DrawerSection title="No data yet">
              <p style={{ margin: 0, fontSize: 13, color: C.textFaint, lineHeight: 1.55 }}>{content.empty}</p>
            </DrawerSection>
          )}

          {content.tips.length > 0 && (
            <DrawerSection title="How to improve">
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {content.tips.map((t, i) => (
                  <li key={i} style={{ fontSize: 13, color: C.textDim, lineHeight: 1.55 }}>{t}</li>
                ))}
              </ul>
            </DrawerSection>
          )}
        </div>
      </motion.div>
    </>,
    document.body,
  )
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

// ── DETAIL CONTENT BUILDER ───────────────────────────────────────────────────
interface DetailContent {
  icon:        any
  accent:      string
  kindLabel:   string
  title:       string
  subtitle?:   string
  value:       string
  valueSuffix?: string
  explanation: string
  rowsTitle?:  string
  rows:        Array<{ label: string; detail?: string; value?: string; valueColor?: string; dot?: string }>
  empty?:      string
  tips:        string[]
}

function renderDetail(
  kind:    DetailKind,
  twin:    Twin,
  mastery: (MasteryRow & { retentionNow: number })[],
  events:  TwinEvent[],
): DetailContent {
  switch (kind.type) {
    case 'retention': {
      const retainingRows = [...mastery]
        .sort((a, b) => b.retentionNow - a.retentionNow)
        .slice(0, 6)
      return {
        icon: Brain, accent: C.purple,
        kindLabel: 'AI Pulse · Memory',
        title: 'Retention',
        subtitle: 'How much of what you studied you still remember.',
        value: `${Math.round(twin.retentionScore * 100)}`,
        valueSuffix: '/ 100',
        explanation: 'Kairo runs every topic through an Ebbinghaus forgetting curve. Each correct quiz or flashcard review boosts memory strength; time decays it. This is the weighted average across all topics you\'ve touched.',
        rowsTitle: 'Top retained topics',
        rows: retainingRows.length === 0
          ? []
          : retainingRows.map(r => ({
              label:      titleCase(r.topic),
              detail:     `${r.subject} · ${r.attempts} attempt${r.attempts === 1 ? '' : 's'} · last ${formatRelative(r.lastStudiedAt)}`,
              value:      `${Math.round(r.retentionNow * 100)}%`,
              valueColor: r.retentionNow > 0.7 ? C.green : r.retentionNow > 0.45 ? C.amber : C.red,
              dot:        r.retentionNow > 0.7 ? C.green : r.retentionNow > 0.45 ? C.amber : C.red,
            })),
        empty: retainingRows.length === 0 ? 'Take a quiz or review a flashcard — your retention curve will fill in.' : undefined,
        tips: [
          'Review topics in the "Revise soon" panel before they decay below 60%.',
          'Short daily flashcard runs beat long weekend sessions for memory.',
          'Re-deriving a formula from scratch strengthens memory more than re-reading.',
        ],
      }
    }
    case 'consistency': {
      const dayRows = buildDayActivityRows(events, 14)
      return {
        icon: CalendarDays, accent: C.blue,
        kindLabel: 'AI Pulse · Habit',
        title: 'Consistency',
        subtitle: 'How regularly you show up to study.',
        value: `${Math.round(twin.consistencyScore * 100)}`,
        valueSuffix: '/ 100',
        explanation: `Out of the last 14 days, you've been active on ${Math.round(twin.consistencyScore * 14)}. Consistency compounds — even a 10-minute daily session beats a weekend cram for keeping mastery stable.`,
        rowsTitle: 'Last 14 days',
        rows: dayRows,
        tips: [
          'Aim for at least one Kairo session per day, even if short.',
          'Use the streak counter as a daily commitment, not a chore.',
          'Block 20 minutes at your best hour — see the Trajectory card.',
        ],
      }
    }
    case 'confidence': {
      const recentQuiz = events
        .filter(e => e.type === 'quiz_answered' || e.type === 'quiz_completed')
        .slice(-8).reverse()
      return {
        icon: Zap, accent: C.amber,
        kindLabel: 'AI Pulse · Skill',
        title: 'Confidence',
        subtitle: 'How likely you are to get a question right.',
        value: `${Math.round(twin.confidence * 100)}`,
        valueSuffix: '/ 100',
        explanation: 'A blend of your recent correctness, average mastery across tracked topics, and how often the AI estimates you "really know" vs. "got lucky". Falls fast after streaks of wrong answers.',
        rowsTitle: 'Recent quiz answers',
        rows: recentQuiz.length === 0 ? [] : recentQuiz.map(e => ({
          label:      `${titleCase(e.topic || 'untitled')}`,
          detail:     `${e.subject || 'General'} · ${formatRelative(e.ts)}${e.score != null ? ` · ${Math.round(e.score)}%` : ''}`,
          value:      e.correct === true ? '✓' : e.correct === false ? '✗' : '—',
          valueColor: e.correct === true ? C.green : e.correct === false ? C.red : C.textDim,
          dot:        e.correct === true ? C.green : e.correct === false ? C.red : C.textFaint,
        })),
        empty: recentQuiz.length === 0 ? 'Answer a few quiz questions to lift this signal.' : undefined,
        tips: [
          'Confidence climbs with two correct answers in a row on the same topic.',
          'A 70%+ score on Adaptive Quiz at medium difficulty is a strong signal.',
          'Use the Solver to clear doubts the moment they appear — confidence sticks better.',
        ],
      }
    }
    case 'streak': {
      const today = new Date()
      const lastActive = twin.lastActiveAt ? new Date(twin.lastActiveAt) : null
      const sameDay = lastActive && lastActive.toDateString() === today.toDateString()
      const dayRows = buildDayActivityRows(events, 7)
      return {
        icon: Flame, accent: C.red,
        kindLabel: 'AI Pulse · Habit',
        title: 'Streak',
        subtitle: 'Consecutive days you\'ve studied with Kairo.',
        value: `${twin.streakDays}`,
        valueSuffix: twin.streakDays === 1 ? 'day' : 'days',
        explanation: sameDay
          ? `Today counts ✓. Come back tomorrow to extend your streak.`
          : `Open Kairo any time today (quiz, lab, flashcard, or solver) to keep the streak going. A missed day resets to 0 — but mastery doesn\'t reset.`,
        rowsTitle: 'Last 7 days',
        rows: dayRows,
        tips: [
          'A 5-minute flashcard run is enough to bank a day.',
          'Stack the streak with a habit you already do (after dinner, before bed).',
          'Long streaks correlate strongly with predicted exam scores in Kairo data.',
        ],
      }
    }
    case 'style': {
      const m = kind.modality
      const meta: Record<Modality, { label: string; color: string; icon: any; explain: string; tip: string }> = {
        visual:      { label: 'Visual',      color: C.purple, icon: Eye,               explain: 'You learn best from labs, diagrams, and 3D visualizations. Every lab you open boosts this.', tip: 'Open Kairo Labs first when starting a new topic.' },
        interactive: { label: 'Interactive', color: C.blue,   icon: MousePointerClick, explain: 'You learn best by doing — Battle Mode, Adaptive Quiz, drag-and-drop labs. Every quiz answer boosts this.', tip: 'Start each session with a 5-question quiz to prime your brain.' },
        text:        { label: 'Reading',     color: C.cyan,   icon: BookOpen,          explain: 'You learn best from notes, articles, and written explanations. Every notebook entry boosts this.', tip: 'Convert AI answers into Notebook entries — re-reading them is high-yield.' },
        repetition:  { label: 'Repetition',  color: C.green,  icon: Repeat,            explain: 'You learn best by spaced review — flashcards, voice mode, drilling formulas. Every flashcard review boosts this.', tip: 'Run flashcards twice a day at your best hour.' },
      }
      const ix = meta[m]
      const value = m === 'visual'      ? twin.styleVisual
                  : m === 'interactive' ? twin.styleInteractive
                  : m === 'text'        ? twin.styleText
                  :                       twin.styleRepetition
      const modalityEvents = events.filter(e => (e.modality || defaultModalityFor(e.type)) === m).slice(-10).reverse()
      return {
        icon: ix.icon, accent: ix.color,
        kindLabel: 'Learning style',
        title: `${ix.label} learner`,
        subtitle: 'How much of your study time falls into this modality.',
        value: `${Math.round(value * 100)}%`,
        valueSuffix: 'of style mix',
        explanation: ix.explain,
        rowsTitle: 'Recent sessions in this style',
        rows: modalityEvents.length === 0 ? [] : modalityEvents.map(e => ({
          label:      labelFor(e.type),
          detail:     `${titleCase(e.topic || 'general')}${e.subject ? ` · ${e.subject}` : ''} · ${formatRelative(e.ts)}`,
          value:      e.score != null ? `${Math.round(e.score)}%` : (e.correct === true ? '✓' : e.correct === false ? '✗' : ''),
          valueColor: e.correct === true ? C.green : e.correct === false ? C.red : C.textDim,
          dot:        ix.color,
        })),
        empty: modalityEvents.length === 0 ? `No recent ${ix.label.toLowerCase()} sessions yet. Try one to lift this signal.` : undefined,
        tips: [ix.tip, 'Mix two modalities per study block to deepen memory.'],
      }
    }
    case 'trend': {
      const recent = events
        .filter(e => typeof e.score === 'number')
        .slice(-12).reverse()
      const dir = twin.performanceTrend > 0.05 ? 'climbing' : twin.performanceTrend < -0.05 ? 'sliding' : 'steady'
      return {
        icon: TrendingUp, accent: twin.performanceTrend > 0.05 ? C.green : twin.performanceTrend < -0.05 ? C.red : C.blue,
        kindLabel: 'Trajectory',
        title: 'Performance trend',
        subtitle: 'Slope of your recent scores over time.',
        value: `${twin.performanceTrend > 0 ? '+' : ''}${(twin.performanceTrend * 100).toFixed(0)}%`,
        valueSuffix: 'vs. baseline',
        explanation: `Your recent scores are ${dir}. Kairo fits a linear slope to your last 20 graded events — anything above +5% is true upward momentum, below −5% means it\'s time to slow down and revise.`,
        rowsTitle: 'Last 12 scored events',
        rows: recent.length === 0 ? [] : recent.map(e => ({
          label:      titleCase(e.topic || 'untitled'),
          detail:     `${e.subject || 'General'} · ${labelFor(e.type)} · ${formatRelative(e.ts)}`,
          value:      `${Math.round(e.score!)}%`,
          valueColor: (e.score! >= 70) ? C.green : (e.score! >= 40) ? C.amber : C.red,
          dot:        (e.score! >= 70) ? C.green : (e.score! >= 40) ? C.amber : C.red,
        })),
        empty: recent.length === 0 ? 'Score events from quizzes and essays power this graph.' : undefined,
        tips: [
          'A flat or sliding trend usually means it\'s time to revise old topics, not push new ones.',
          'Two strong sessions in a row will flip the trend within hours.',
        ],
      }
    }
    case 'predictedExam': {
      const topTopics = [...mastery].sort((a, b) => b.mastery - a.mastery).slice(0, 6)
      return {
        icon: Trophy, accent: C.purple,
        kindLabel: 'Trajectory',
        title: 'Predicted exam score',
        subtitle: 'Where Kairo thinks you\'d land today.',
        value: twin.predictedExamScore != null ? `${twin.predictedExamScore}` : '—',
        valueSuffix: twin.predictedExamScore != null ? `% · grade ${twin.predictedBand || '—'}` : 'need more data',
        explanation: 'A blend of mastery × confidence × consistency, weighted by exam-style difficulty. Updates every time you finish a quiz or essay. Treat it as a directional signal, not a guarantee.',
        rowsTitle: 'Highest-mastered topics',
        rows: topTopics.length === 0 ? [] : topTopics.map(t => ({
          label:      titleCase(t.topic),
          detail:     `${t.subject} · ${t.attempts} attempt${t.attempts === 1 ? '' : 's'} · last ${formatRelative(t.lastStudiedAt)}`,
          value:      `${Math.round(t.mastery * 100)}%`,
          valueColor: t.mastery >= 0.7 ? C.green : t.mastery >= 0.4 ? C.amber : C.red,
          dot:        t.mastery >= 0.7 ? C.green : t.mastery >= 0.4 ? C.amber : C.red,
        })),
        empty: topTopics.length === 0 ? 'Need a few quiz scores before the prediction stabilizes.' : undefined,
        tips: [
          'Closing one weak topic moves this number more than polishing a strong one.',
          'A predicted dip is usually a forgetting-curve issue — revise, don\'t cram.',
        ],
      }
    }
    case 'mastered': {
      const mastered = mastery.filter(m => m.mastery >= 0.7).sort((a, b) => b.mastery - a.mastery)
      return {
        icon: Award, accent: C.cyan,
        kindLabel: 'Trajectory',
        title: 'Mastered topics',
        subtitle: 'Topics where you\'ve cleared the 70% bar.',
        value: `${mastered.length}`,
        valueSuffix: `of ${mastery.length} tracked`,
        explanation: 'A topic is "mastered" when its EMA mastery score stays above 0.70 — meaning you\'ve been consistently correct on questions of mixed difficulty across multiple sessions.',
        rowsTitle: 'Your mastered set',
        rows: mastered.length === 0 ? [] : mastered.map(t => ({
          label:      titleCase(t.topic),
          detail:     `${t.subject} · ${t.attempts} attempt${t.attempts === 1 ? '' : 's'} · last ${formatRelative(t.lastStudiedAt)}`,
          value:      `${Math.round(t.mastery * 100)}%`,
          valueColor: C.green,
          dot:        C.green,
        })),
        empty: mastered.length === 0 ? 'No topics over 70% yet — keep going on the ones in the Heatmap.' : undefined,
        tips: [
          'Mastered topics still decay — revisit each once a week to keep them locked in.',
          'Lock a topic in by answering a hard question correctly on it.',
        ],
      }
    }
    case 'burnout': {
      const lastDay = events.filter(e => Date.now() - e.ts < 24 * 3600_000)
      const lateNight = lastDay.filter(e => {
        const h = new Date(e.ts).getHours()
        return h >= 23 || h <= 4
      })
      const wrongStreak = events.slice(-10).filter(e => e.correct === false).length
      return {
        icon: AlertCircle, accent: twin.burnoutRisk > 0.55 ? C.red : twin.burnoutRisk > 0.3 ? C.amber : C.green,
        kindLabel: 'Vitals · Wellbeing',
        title: 'Burnout risk',
        subtitle: 'Pacing & fatigue signals from the last 7 days.',
        value: `${Math.round(twin.burnoutRisk * 100)}%`,
        valueSuffix: 'risk',
        explanation: 'Kairo watches for long sessions, late-night study, drops in correctness, and over-density across days. A high score doesn\'t mean stop — it means rest. Sleep is study.',
        rowsTitle: 'Signals contributing',
        rows: [
          { label: 'Events in last 24h',       value: `${lastDay.length}`,    valueColor: lastDay.length > 30 ? C.red : C.textDim, dot: lastDay.length > 30 ? C.red : C.green },
          { label: 'Late-night sessions (24h)', value: `${lateNight.length}`, valueColor: lateNight.length > 2 ? C.red : C.textDim, dot: lateNight.length > 2 ? C.red : C.green },
          { label: 'Wrong in last 10 answers',  value: `${wrongStreak}`,      valueColor: wrongStreak > 5 ? C.red : C.textDim,      dot: wrongStreak > 5 ? C.red : C.green },
          { label: 'Streak length',             value: `${twin.streakDays}d`, valueColor: twin.streakDays > 30 ? C.amber : C.textDim, dot: C.amber },
        ],
        tips: [
          'Take a real break every 25–45 minutes. Walk, stretch, drink water.',
          'Stop studying at least an hour before bed. Sleep consolidates memory.',
          'If burnout is high, do flashcards instead of new topics — easier on the brain.',
        ],
      }
    }
    case 'vitalConsistency': {
      const dayRows = buildDayActivityRows(events, 14)
      return {
        icon: CalendarDays, accent: C.blue,
        kindLabel: 'Vitals · Habit',
        title: 'Consistency vital',
        subtitle: 'Days active in the last 14 days.',
        value: `${Math.round(twin.consistencyScore * 100)}%`,
        valueSuffix: `(${Math.round(twin.consistencyScore * 14)} of 14)`,
        explanation: 'Same data as the Pulse Consistency tile — shown here as a vital because it\'s the single highest leading indicator of exam outcomes in Kairo data.',
        rowsTitle: 'Day-by-day activity',
        rows: dayRows,
        tips: [
          'Even 5 minutes a day counts.',
          'Use Battle Mode for fast 90-second sessions on busy days.',
        ],
      }
    }
    case 'vitalConfidence': {
      const recentScores = events
        .filter(e => typeof e.score === 'number')
        .slice(-8).reverse()
      return {
        icon: Zap, accent: C.amber,
        kindLabel: 'Vitals · Skill',
        title: 'Confidence vital',
        subtitle: 'Combined with predicted exam grade.',
        value: `${Math.round(twin.confidence * 100)}%`,
        valueSuffix: twin.predictedExamScore != null ? `→ predicted ${twin.predictedExamScore}%` : '',
        explanation: `Confidence × difficulty curves into the exam prediction. Right now Kairo expects you to score around ${twin.predictedExamScore ?? '—'}${twin.predictedExamScore != null ? '%' : ''}${twin.predictedBand ? ` (grade ${twin.predictedBand})` : ''}.`,
        rowsTitle: 'Recent graded events',
        rows: recentScores.length === 0 ? [] : recentScores.map(e => ({
          label:      titleCase(e.topic || 'untitled'),
          detail:     `${e.subject || 'General'} · ${formatRelative(e.ts)}`,
          value:      `${Math.round(e.score!)}%`,
          valueColor: (e.score! >= 70) ? C.green : (e.score! >= 40) ? C.amber : C.red,
          dot:        (e.score! >= 70) ? C.green : (e.score! >= 40) ? C.amber : C.red,
        })),
        empty: recentScores.length === 0 ? 'Need a few graded events to lift this.' : undefined,
        tips: [
          'Stack two strong topics back-to-back to lock in a confidence run.',
          'A weak topic answered right under pressure adds 2x to confidence.',
        ],
      }
    }
    case 'mastery': {
      const row = mastery.find(m => m.subject === kind.subject && m.topic === kind.topic)
      const topicEvents = events.filter(e => e.topic === kind.topic && (e.subject === kind.subject || !e.subject)).slice(-12).reverse()
      if (!row) {
        return {
          icon: Target, accent: C.purple, kindLabel: 'Topic', title: titleCase(kind.topic),
          value: '—', explanation: 'No mastery data yet for this topic.', rows: [], tips: [],
        }
      }
      return {
        icon: Target,
        accent: row.mastery >= 0.7 ? C.green : row.mastery >= 0.4 ? C.amber : C.red,
        kindLabel: `${kind.subject} · topic`,
        title: titleCase(row.topic),
        subtitle: `${row.attempts} attempt${row.attempts === 1 ? '' : 's'} · ${row.correct} correct`,
        value: `${Math.round(row.mastery * 100)}%`,
        valueSuffix: 'mastery',
        explanation: `Your EMA mastery for "${row.topic}" is ${(row.mastery * 100).toFixed(0)}%. Strength (Ebbinghaus S) = ${row.strength.toFixed(1)}; retention right now ≈ ${(row.retentionNow * 100).toFixed(0)}%. Last touched ${formatRelative(row.lastStudiedAt)}.`,
        rowsTitle: 'Recent activity on this topic',
        rows: topicEvents.length === 0 ? [] : topicEvents.map(e => ({
          label:      labelFor(e.type),
          detail:     formatRelative(e.ts) + (e.score != null ? ` · ${Math.round(e.score)}%` : ''),
          value:      e.correct === true ? '✓' : e.correct === false ? '✗' : '—',
          valueColor: e.correct === true ? C.green : e.correct === false ? C.red : C.textDim,
          dot:        e.correct === true ? C.green : e.correct === false ? C.red : C.textFaint,
        })),
        tips: row.mastery >= 0.7 ? [
          'You\'ve mastered this. Re-touch once a week to keep it locked.',
          'Try a hard question on this topic to push to expert.',
        ] : [
          'Open a Lab on this topic — your style benefits from visual context.',
          'Generate flashcards on this topic from the Solver and drill twice a day.',
          'Take a 5-question Adaptive Quiz at medium difficulty and review wrong answers.',
        ],
      }
    }
    case 'forgetting': {
      const row = mastery.find(m => m.subject === kind.subject && m.topic === kind.topic)
      const forget = twin.forgettingSoon.find(f => f.topic === kind.topic)
      const topicEvents = events.filter(e => e.topic === kind.topic).slice(-8).reverse()
      const hours = forget?.hoursUntilForget ?? 0
      return {
        icon: AlertTriangle, accent: hours < 24 ? C.red : C.amber,
        kindLabel: 'Memory · revise soon',
        title: titleCase(kind.topic),
        subtitle: 'Predicted to drop below 60% retention soon.',
        value: hours < 24 ? `${Math.round(hours)}h` : `${Math.round(hours / 24)}d`,
        valueSuffix: 'until forgetting',
        explanation: `Without review, Kairo expects retention on "${kind.topic}" to fall below the 60% threshold in roughly ${hours < 24 ? `${Math.round(hours)} hours` : `${Math.round(hours / 24)} days`}. A single correct flashcard or quiz answer resets the curve.`,
        rowsTitle: 'Recent activity',
        rows: topicEvents.length === 0 ? [] : topicEvents.map(e => ({
          label:      labelFor(e.type),
          detail:     `${e.subject || 'General'} · ${formatRelative(e.ts)}${e.score != null ? ` · ${Math.round(e.score)}%` : ''}`,
          value:      e.correct === true ? '✓' : e.correct === false ? '✗' : '—',
          valueColor: e.correct === true ? C.green : e.correct === false ? C.red : C.textDim,
          dot:        e.correct === true ? C.green : e.correct === false ? C.red : C.textFaint,
        })),
        empty: topicEvents.length === 0 ? 'No event history for this topic yet.' : undefined,
        tips: [
          `Open a flashcard for "${kind.topic}" before going to sleep tonight.`,
          row && row.mastery < 0.4 ? 'Mastery is low — start with a Lab, not a quiz.' : 'A 60-second Battle Mode round is enough to reset the curve.',
        ],
      }
    }
  }
}

function defaultModalityFor(t: TwinEvent['type']): Modality {
  if (t === 'lab_opened' || t === 'lab_explored')   return 'visual'
  if (t === 'quiz_answered' || t === 'quiz_completed') return 'interactive'
  if (t === 'flashcard_review')                      return 'repetition'
  return 'text'
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

function buildDayActivityRows(events: TwinEvent[], days: number) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const rows: Array<{ label: string; detail?: string; value?: string; valueColor?: string; dot?: string }> = []
  for (let i = 0; i < days; i++) {
    const dayStart = today.getTime() - i * 86_400_000
    const dayEnd   = dayStart + 86_400_000
    const dayEvents = events.filter(e => e.ts >= dayStart && e.ts < dayEnd)
    const active = dayEvents.length > 0
    const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : new Date(dayStart).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })
    rows.push({
      label,
      detail: active ? `${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}` : 'No activity',
      value: active ? '●' : '○',
      valueColor: active ? C.green : C.textFaint,
      dot: active ? C.green : C.borderSoft,
    })
  }
  return rows
}

// ════════════════════════════════════════════════════════════════════════════
// PRIMITIVES
// ════════════════════════════════════════════════════════════════════════════
function Card({ children }: { children: React.ReactNode }) {
  return (
    <motion.div className="kr-card" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{
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
      width: '100%', height: '100%', overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
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
