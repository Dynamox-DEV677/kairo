import { useMemo } from 'react'
import { Target, ArrowRight } from 'lucide-react'
import { getDashboard } from '../lib/twin'
import { goalPlan, parseGoal } from '../lib/goal.core'

/**
 * The one-line 490 Tracker strip on Home. Reads the same plan the full page
 * shows (goal.core over real mastery); if no goal is set it's a quiet nudge,
 * never a demand. Tapping anywhere opens the full page.
 */
export default function GoalStrip({ onNavigate }: { onNavigate?: (v: string) => void }) {
  const plan = useMemo(() => {
    try {
      const target = parseGoal(localStorage.getItem('kyno:goal') || '')
      if (!target) return null
      return goalPlan({ mastery: getDashboard().mastery, target })
    } catch { return null }
  }, [])

  const go = () => onNavigate?.('goal')

  const box: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
    background: '#141A2A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14,
    padding: '13px 16px', marginBottom: 18, cursor: 'pointer', fontFamily: 'inherit',
  }

  if (!plan) {
    return (
      <button onClick={go} style={box}>
        <Target size={16} color="#A5B4FC" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, color: '#B1B5BA', flex: 1, minWidth: 0 }}>
          Aiming for a board total? <b style={{ color: '#fafafa' }}>Set your target</b> and Kyno tracks the gap per subject.
        </span>
        <ArrowRight size={14} color="#9CA3AF" style={{ flexShrink: 0 }} />
      </button>
    )
  }

  const behind = plan.ready && (plan.paceTotal ?? 0) < plan.total
  return (
    <button onClick={go} style={box}>
      <Target size={16} color={behind ? '#FFB020' : '#34D399'} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, color: '#B1B5BA', flex: 1, minWidth: 0, lineHeight: 1.5 }}>
        {plan.ready ? (
          <>On pace for <b style={{ color: '#fafafa' }}>~{plan.paceTotal}</b> / {plan.total}.
            {behind && plan.topLever && <> Biggest lever: <b style={{ color: '#fafafa' }}>{plan.topLever.topic}</b> (≈ +{plan.topLever.gainEstimate}).</>}
            {!behind && <> Keep it up.</>}
          </>
        ) : (
          <>Your {plan.total} plan: <b style={{ color: '#fafafa' }}>{plan.subjectsWithData}/{plan.subjects.length}</b> subjects have enough answers to project — quiz the rest to unlock the pace.</>
        )}
      </span>
      <ArrowRight size={14} color="#9CA3AF" style={{ flexShrink: 0 }} />
    </button>
  )
}
