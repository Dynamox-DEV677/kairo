import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, MessageCircle, Swords, BookMarked, Beaker,
  TrendingUp, AlertTriangle, ChevronRight, Repeat, Brain,
  Flame, Activity, Zap, ChevronsRight, BookOpen, Target,
  RefreshCw, FileJson,
} from 'lucide-react'
import {
  getDashboard, refresh, seedDemo,
  type DashboardSnapshot, type Twin, type MasteryRow,
} from '../lib/twin'

const C = {
  bg:        '#0A0D16',
  panel:     '#141A2A',
  panel2:    '#1C2233',
  border:    'rgba(255,255,255,0.06)',
  text:      '#fafafa',
  textDim:   '#B1B5BA',
  textFaint: '#9CA3AF',
  textGhost: '#6B7280',
  purple:    '#A5B4FC',
  purpleHi:  '#7C6BF6',
  purpleDeep:'#4A2FA8',
  purpleLite:'#A5B4FC',
  purpleSoft:'#DBE7FF',
}

const GLASS: React.CSSProperties = {
  background: 'linear-gradient(150deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.018) 100%)',
  backdropFilter: 'blur(16px) saturate(150%)',
  WebkitBackdropFilter: 'blur(16px) saturate(150%)',
}

interface Props {
  onOpenDetail?: (kind: string, payload?: any) => void
  onNavigate:    (route: string) => void
  onOpenBackup:  () => void
}

export default function KairoOSMobile({ onNavigate, onOpenBackup }: Props) {
  const [snap, setSnap] = useState<DashboardSnapshot | null>(null)
  const [pulsing, setPulsing] = useState(false)

  function reload() { setSnap(getDashboard()) }
  function recompute() {
    setSnap(refresh()); setPulsing(true); setTimeout(() => setPulsing(false), 700)
  }

  useEffect(() => { reload() }, [])

  if (!snap || !snap.hasData) {
    return (
      <EmptyState
        onSeed={() => {
          seedDemo()
          reload()
        }}
      />
    )
  }

  const twin = snap.twin!
  const mastery = snap.mastery
  const score = twin.retentionScore * 0.30
              + twin.consistencyScore * 0.25
              + twin.confidence * 0.25
              + (1 - twin.burnoutRisk) * 0.20
  const pct = Math.round(score * 100)
  const label = pct >= 75 ? 'Thriving' : pct >= 60 ? 'On track' : pct >= 45 ? 'Recovering' : 'Needs care'
  const greeting = greetingFor()
  const masteredCount = mastery.filter(m => m.mastery >= 0.7).length

  return (
    <div style={{
      width: '100%', maxWidth: '100%', height: '100%',
      overflowY: 'auto', overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      background: C.bg,
      backgroundImage:
        `radial-gradient(at 50% -10%, rgba(124, 107, 246, 0.18) 0%, transparent 40%),
         radial-gradient(at 50% 110%, rgba(74, 47, 168, 0.10) 0%, transparent 40%)`,
    }}>
      <style>{`
        @keyframes km-glow { 0%,100% { opacity: 0.45 } 50% { opacity: 0.95 } }
        @keyframes km-pulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.04) } }
      `}</style>

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 18,
        paddingTop: 18,
        paddingBottom: 'calc(128px + env(safe-area-inset-bottom))',
      }}>

        <section style={{ padding: '0 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.purpleLite, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
            {greeting}
          </div>
          <h1 style={{
            margin: 0, fontSize: 24, fontWeight: 800, color: C.text,
            letterSpacing: -0.6, lineHeight: 1.15,
          }}>
            Let's lock something in today.
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: C.textFaint, lineHeight: 1.5 }}>
            {twin.streakDays > 0
              ? <>You're on a <strong style={{ color: C.purpleLite }}>{twin.streakDays}-day streak</strong>. Keep it going.</>
              : <>Tap any card below to start studying.</>}
          </p>
        </section>

        <section style={{ padding: '0 18px' }}>
          <PulseHero pct={pct} label={label} twin={twin} pulsing={pulsing} onRecompute={recompute} />
        </section>

        <section style={{ padding: '0 18px' }}>
          <SectionLabel inline>Quick actions</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
            <QuickAction label="Solve"  icon={MessageCircle} onClick={() => onNavigate('doubt')}      accent={C.purple} />
            <QuickAction label="Battle" icon={Swords}        onClick={() => onNavigate('battle')}     accent={C.purpleLite} />
            <QuickAction label="Cards"  icon={BookMarked}    onClick={() => onNavigate('flashcards')} accent={C.purpleSoft} />
            <QuickAction label="Notes"  icon={BookOpen}      onClick={() => onNavigate('notebook')}   accent={C.purpleLite} />
            <QuickAction label="Backup" icon={FileJson}      onClick={onOpenBackup}                    accent={C.purpleSoft} />
          </div>
        </section>

        {snap.recommendations[0] && (
          <section style={{ padding: '0 18px' }}>
            <SectionLabel inline>Recommended now</SectionLabel>
            <TopRecommendation rec={snap.recommendations[0]} onClick={() => onNavigate('knowledge')} />
          </section>
        )}

        <section style={{ padding: '0 18px' }}>
          <SectionLabel inline>Vitals today</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            <VitalChip title="Burnout"     pct={Math.round(twin.burnoutRisk * 100)}     tone={twin.burnoutRisk > 0.55 ? 'danger' : twin.burnoutRisk > 0.3 ? 'warn' : 'good'} icon={Activity} />
            <VitalChip title="Consistency" pct={Math.round(twin.consistencyScore * 100)} tone={twin.consistencyScore > 0.6 ? 'good' : twin.consistencyScore > 0.3 ? 'warn' : 'danger'} icon={Flame} />
            <VitalChip title="Confidence"  pct={Math.round(twin.confidence * 100)}      tone={twin.confidence > 0.6 ? 'good' : twin.confidence > 0.4 ? 'warn' : 'danger'} icon={Zap} />
            <VitalChip title="Retention"   pct={Math.round(twin.retentionScore * 100)}  tone={twin.retentionScore > 0.6 ? 'good' : twin.retentionScore > 0.3 ? 'warn' : 'danger'} icon={Brain} />
          </div>
        </section>

        <section style={{ padding: '0 18px' }}>
          <SectionLabel inline>Trajectory</SectionLabel>
          <TrajectoryCard
            trend={twin.performanceTrend}
            predicted={twin.predictedExamScore}
            band={twin.predictedBand}
            mastered={masteredCount}
            tracked={mastery.length}
          />
        </section>

        {twin.forgettingSoon.length > 0 && (
          <section style={{ padding: '0 18px' }}>
            <SectionLabel inline>Revise soon</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {twin.forgettingSoon.slice(0, 5).map(f => (
                <ReviseRow key={f.topic} topic={f.topic} subject={f.subject} hours={f.hoursUntilForget} onClick={() => onNavigate('simulator')} />
              ))}
            </div>
          </section>
        )}

        {mastery.length > 0 && (
          <section style={{ padding: '0 18px' }}>
            <SectionLabel inline>Weak spots</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {[...mastery].sort((a, b) => a.mastery - b.mastery).slice(0, 8).map(m => (
                <TopicChip key={`${m.subject}-${m.topic}`} row={m} onClick={() => onNavigate('mistakes')} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function PulseHero({ pct, label, twin, pulsing, onRecompute }: {
  pct: number; label: string; twin: Twin; pulsing: boolean; onRecompute: () => void
}) {
  const score = Math.max(0, Math.min(1, pct / 100))
  const r = 86
  const c = 2 * Math.PI * r
  const offset = c * (1 - score)
  const tone = pct >= 75 ? C.purpleLite : pct >= 60 ? C.purple : pct >= 45 ? C.purpleHi : C.purpleDeep
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        position: 'relative', padding: 22, borderRadius: 22,
        ...GLASS,
        border: '1px solid rgba(165, 180, 252, 0.22)',
        boxShadow: '0 18px 50px rgba(124, 107, 246, 0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: '-30%', left: '50%', transform: 'translateX(-50%)',
        width: 280, height: 280, borderRadius: '50%',
        background: 'radial-gradient(closest-side, rgba(124, 107, 246, 0.42), transparent 70%)',
        filter: 'blur(40px)', animation: 'km-glow 5s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative', display: 'flex', flexDirection: 'column',
        alignItems: 'center', textAlign: 'center', gap: 14,
      }}>
        <div style={{ position: 'relative', width: 200, height: 200, flexShrink: 0 }}>
          <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
            <defs>
              <linearGradient id="km-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor={C.purpleSoft}/>
                <stop offset="50%"  stopColor={C.purple}/>
                <stop offset="100%" stopColor={C.purpleDeep}/>
              </linearGradient>
            </defs>
            <circle cx={100} cy={100} r={r} fill="none" stroke={C.panel2} strokeWidth={14} />
            <circle cx={100} cy={100} r={r} fill="none"
              stroke="url(#km-ring)" strokeWidth={14} strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={offset}
              transform="rotate(-90 100 100)"
              style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.2,.6,.2,1)' }} />
            <text x={100} y={104} textAnchor="middle" fontSize={48} fontWeight={800}
                  fill={C.text} fontFamily="inherit" letterSpacing={-1.5}>
              {pct}
            </text>
            <text x={100} y={128} textAnchor="middle" fontSize={11} fontWeight={700}
                  fill={C.textFaint} fontFamily="inherit" letterSpacing={1.4}>
              / 100
            </text>
          </svg>
        </div>

        <div style={{ width: '100%', minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: tone, letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 4 }}>
            AI Pulse
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: C.text, lineHeight: 1.15, letterSpacing: -0.4 }}>
            {label}
          </div>
          <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 8, lineHeight: 1.45 }}>
            Retention × consistency × confidence — refreshed live.
          </div>

          <button onClick={onRecompute}
            style={{
              marginTop: 14, padding: '8px 12px', borderRadius: 10,
              background: pulsing ? 'rgba(165, 180, 252, 0.20)' : 'rgba(165, 180, 252, 0.10)',
              border: '1px solid rgba(165, 180, 252, 0.32)',
              color: pulsing ? C.purpleSoft : C.purpleLite,
              fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              letterSpacing: 0.3, transition: 'all 0.2s',
              minHeight: 36,
            }}>
            <RefreshCw size={11} style={{ transform: pulsing ? 'rotate(360deg)' : 'none', transition: 'transform 0.7s' }} />
            {pulsing ? 'Done' : 'Recompute'}
          </button>
        </div>
      </div>

      <div style={{
        position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 8, marginTop: 18,
      }}>
        <MiniMetric label="Streak"      value={twin.streakDays} unit="d" />
        <MiniMetric label="Best hour"   value={twin.focusBestHour ?? '—'} unit={twin.focusBestHour != null ? ':00' : ''} />
      </div>
    </motion.div>
  )
}

function MiniMetric({ label, value, unit }: { label: string; value: any; unit?: string }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 12,
      ...GLASS,
      border: '1px solid rgba(165, 180, 252, 0.16)',
    }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: C.purpleLite, textTransform: 'uppercase', letterSpacing: 1.4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginTop: 2, letterSpacing: -0.4 }}>
        {value}<span style={{ fontSize: 11, color: C.textFaint, marginLeft: 1 }}>{unit}</span>
      </div>
    </div>
  )
}

function SectionLabel({ children, inline = false }: { children: React.ReactNode; inline?: boolean }) {
  return (
    <div style={{
      padding: inline ? 0 : '0 18px',
      fontSize: 11, fontWeight: 700,
      color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1.8,
      marginBottom: 10,
    }}>
      {children}
    </div>
  )
}

function QuickAction({ label, icon: Icon, onClick }: { label: string; icon: any; onClick: () => void; accent?: string }) {
  return (
    <button
      className="kyno-tile"
      onClick={onClick}
      style={{
        width: '100%', minWidth: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        padding: '13px 6px',
        color: C.text, fontFamily: 'inherit',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 12,
        background: 'rgba(124,107,246,0.16)',
        border: '1px solid rgba(124,107,246,0.30)',
        color: 'var(--c-purple-lite)',
        display: 'grid', placeItems: 'center',
      }}>
        <Icon size={18} strokeWidth={2.2} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 0.2, textAlign: 'center', lineHeight: 1.1 }}>
        {label}
      </span>
    </button>
  )
}

function TopRecommendation({ rec, onClick }: { rec: any; onClick: () => void }) {
  const Icon = rec.kind === 'revise' ? Repeat
    : rec.kind === 'lab' ? Beaker
    : rec.kind === 'flashcard' ? BookMarked
    : rec.kind === 'quiz' ? Target
    : rec.kind === 'break' ? AlertTriangle
    : Sparkles
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '16px 16px',
        background: 'linear-gradient(135deg, rgba(124, 107, 246, 0.14), rgba(165, 180, 252, 0.06))',
        border: '1px solid rgba(165, 180, 252, 0.32)',
        borderRadius: 18,
        cursor: 'pointer', fontFamily: 'inherit',
        WebkitTapHighlightColor: 'transparent',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 10px 30px rgba(124, 107, 246, 0.02)',
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 13, flexShrink: 0,
        background: 'linear-gradient(135deg, #A5B4FC, #7C6BF6)',
        display: 'grid', placeItems: 'center',
        boxShadow: '0 6px 18px rgba(124, 107, 246, 0.04)',
      }}>
        <Icon size={20} color="#000" strokeWidth={2.2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.purpleLite, textTransform: 'uppercase', letterSpacing: 1.4 }}>
          {rec.kind}{rec.subject ? ` · ${rec.subject}` : ''}
        </div>
        <div style={{ fontSize: 14, color: C.text, fontWeight: 700, marginTop: 3, lineHeight: 1.35 }}>
          {rec.reason}
        </div>
      </div>
      <ChevronRight size={18} color={C.purpleLite} style={{ flexShrink: 0 }} />
    </motion.button>
  )
}

function VitalChip({ title, pct, unit = '%', tone, icon: Icon }: { title: string; pct: number; unit?: string; tone: 'good' | 'warn' | 'danger' | 'neutral'; icon: any }) {
  // Health-coded accent: good = cyan, watch = gold, risk = error, else purple.
  const accent = tone === 'good' ? 'var(--c-cyan)' : tone === 'warn' ? 'var(--c-gold)' : tone === 'danger' ? 'var(--c-error)' : 'var(--c-purple-lite)'
  const p = Math.max(0, Math.min(100, pct))
  return (
    <div className="kyno-card" style={{
      width: '100%', minWidth: 0, padding: '13px 14px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: accent, display: 'inline-flex' }}><Icon size={11} /></span>
        <span style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: 1.4 }}>{title}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontSize: 24, fontWeight: 900, color: C.text, lineHeight: 1, letterSpacing: -0.6 }}>{pct}</span>
        <span style={{ fontSize: 11, color: C.textFaint, fontWeight: 700 }}>{unit}</span>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden', marginTop: 2 }}>
        <div style={{ height: '100%', width: `${p}%`, background: accent, borderRadius: 999, transition: 'width .5s cubic-bezier(0.22,1,0.36,1)' }} />
      </div>
    </div>
  )
}

function TrajectoryCard({ trend, predicted, band, mastered, tracked }: {
  trend: number; predicted: number | null; band: string | null; mastered: number; tracked: number
}) {
  const up = trend > 0.05
  return (
    <div style={{
      padding: 16, borderRadius: 18,
      ...GLASS,
      border: '1px solid rgba(165, 180, 252, 0.16)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'linear-gradient(135deg, #A5B4FC, #7C6BF6)',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <TrendingUp size={20} color="#000" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.purpleLite, textTransform: 'uppercase', letterSpacing: 1.4 }}>
            Predicted exam
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, lineHeight: 1.1, letterSpacing: -0.4 }}>
            {predicted != null ? `${predicted}%` : '—'}
            {band && <span style={{ fontSize: 12, color: C.textFaint, marginLeft: 6, fontWeight: 700 }}>{band}</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(165, 180, 252, 0.10)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: C.textFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2 }}>Trend</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: up ? C.purpleLite : trend < -0.05 ? C.purpleHi : C.textDim, marginTop: 2 }}>
            {trend > 0 ? '+' : ''}{(trend * 100).toFixed(0)}%
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: C.textFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2 }}>Mastered</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginTop: 2 }}>
            {mastered}<span style={{ fontSize: 11, color: C.textFaint, fontWeight: 600, marginLeft: 3 }}>/ {tracked}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReviseRow({ topic, subject, hours, onClick }: { topic: string; subject: string; hours: number; onClick: () => void }) {
  const urgent = hours < 24
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 14,
        ...GLASS,
        ...(urgent ? { background: 'linear-gradient(150deg, rgba(165,180,252,0.10) 0%, rgba(255,255,255,0.02) 100%)' } : {}),
        border: `1px solid ${urgent ? 'rgba(165, 180, 252, 0.30)' : 'rgba(165, 180, 252, 0.10)'}`,
        cursor: 'pointer', fontFamily: 'inherit', color: C.text, textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{
        width: 4, height: 36, borderRadius: 2,
        background: urgent ? C.purpleHi : C.purpleLite,
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, textTransform: 'capitalize', lineHeight: 1.3 }}>
          {topic}
        </div>
        <div style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>
          {subject} · forgetting in {hours < 24 ? `${Math.round(hours)}h` : `${Math.round(hours / 24)}d`}
        </div>
      </div>
      <ChevronsRight size={15} color={C.purple} />
    </motion.button>
  )
}

function TopicChip({ row, onClick }: { row: MasteryRow & { retentionNow?: number }; onClick: () => void }) {
  const color = row.mastery < 0.4 ? C.purpleHi : row.mastery < 0.7 ? C.purple : C.purpleLite
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      style={{
        padding: '7px 12px', borderRadius: 999,
        background: `${color}14`, border: `1px solid ${color}44`,
        color, fontSize: 12, fontWeight: 600,
        fontFamily: 'inherit', cursor: 'pointer',
        textTransform: 'capitalize',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {row.topic}
      <span style={{ marginLeft: 6, opacity: 0.75, fontSize: 11 }}>{Math.round(row.mastery * 100)}%</span>
    </motion.button>
  )
}

function EmptyState({ onSeed }: { onSeed?: () => void }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 14, padding: '40px 24px',
      background: C.bg,
      paddingBottom: 'calc(120px + env(safe-area-inset-bottom))',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: 'linear-gradient(135deg, #A5B4FC, #7C6BF6)',
        display: 'grid', placeItems: 'center',
        boxShadow: '0 14px 38px rgba(124, 107, 246, 0.03)',
      }}>
        <Brain size={32} color="#000" />
      </div>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>Kyno is waking up</h2>
      <p style={{ margin: 0, fontSize: 13, color: C.textFaint, maxWidth: 320, textAlign: 'center', lineHeight: 1.55 }}>
        Take a quiz, open a lab, or ask the Solver. Your dashboard fills itself in as Kyno learns how you study.
      </p>
      {onSeed && (
        <button
          onClick={onSeed}
          style={{
            marginTop: 8,
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 22px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #7C6BF6 0%, #4A2FA8 100%)',
            color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
            letterSpacing: 0.2, cursor: 'pointer',
            boxShadow: '0 6px 18px rgba(124, 107, 246, 0.18)',
            minHeight: 44,
          }}
        >
          <Sparkles size={15} />
          Try with demo data
        </button>
      )}
      {onSeed && (
        <p style={{
          margin: '6px 0 0', fontSize: 11, color: C.textGhost,
          maxWidth: 280, textAlign: 'center', lineHeight: 1.4,
        }}>
          Loads two weeks of sample activity so you can see what the
          dashboard looks like in motion.
        </p>
      )}
    </div>
  )
}

function greetingFor() {
  const h = new Date().getHours()
  if (h < 5)  return 'Late night ·'
  if (h < 12) return 'Good morning ·'
  if (h < 17) return 'Good afternoon ·'
  if (h < 21) return 'Good evening ·'
  return 'Burning midnight oil ·'
}
