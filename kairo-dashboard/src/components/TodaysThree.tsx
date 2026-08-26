import { useMemo } from 'react'
import { ListTodo, ArrowRight, TrendingUp } from 'lucide-react'
import { getDashboard, listFlashcards, getProfile, loadState } from '../lib/twin'
import { todaysThree, growthStat, type DailyTask } from '../lib/daily.core'
import { graphForProfile } from '../lib/syllabusFor'
import { nodeStates } from '../lib/syllabusGraph.core'
import { rankNodes } from '../lib/syllabusRank.core'
import { todayPlan, DEFAULT_DAILY_MINUTES, type TodayPlan } from '../lib/todayPlan.core'
import { nearestExamDays } from '../lib/examDate'

/** "2–4 hrs" style capacity from onboarding → a minutes budget. */
function dailyMinutesOf(profile: { dailyHours?: string } | null | undefined): number {
  const h = String(profile?.dailyHours || '')
  if (/under 1/i.test(h)) return 45
  if (/1.?2/.test(h)) return 90
  if (/2.?4/.test(h)) return 150
  if (/4\+/.test(h)) return 210
  return DEFAULT_DAILY_MINUTES
}

/**
 * C8 — "today's 3 things", on Home.
 *
 * Every task is traceable to a real record (forgetting-curve entry, weak-topic
 * row, due flashcards, an exam date the student typed), computed in
 * daily.core.js. If the student has no history yet the card says so and points
 * at one concrete first step — it never pads with generic filler tasks.
 *
 * Carries the C29 growth line in its footer: the student against their own
 * past self, never against anyone else, and only once there is enough data for
 * the number to mean something.
 */
export default function TodaysThree({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const { tasks, growth, plan } = useMemo(() => {
    const now = Date.now()
    const snap = getDashboard()
    const cards = listFlashcards()
    const due = cards.filter(c => typeof c.dueAt === 'number' && c.dueAt <= now)
    const examDates = (getProfile() as any)?.examDates || []

    // Retention+coverage brief (part D-2): when a syllabus graph exists for
    // this student, the MIX of today comes from the scheduler — phase-aware,
    // capped to their declared capacity. Otherwise the original C8 three.
    let syllabusPlan: TodayPlan | null = null
    try {
      const graph = graphForProfile(getProfile() as any)
      if (graph) {
        const states = nodeStates(graph, { events: loadState().events, mastery: snap.mastery })
        const fading = graph.chapters.filter(c => states.get(c.id)?.state === 'FADING')
        syllabusPlan = todayPlan({
          dueCards: due,
          ranked: rankNodes(graph, states, { max: 5 }),
          fading,
          daysToExam: nearestExamDays(now),
          dailyMinutes: dailyMinutesOf(getProfile() as any),
          now,
        })
      }
    } catch {  }

    return {
      tasks: todaysThree({ twin: snap.twin, dueCards: due.length, examDates, now }),
      growth: growthStat(snap.recentEvents, now),
      plan: syllabusPlan,
    }
  }, [])

  return (
    <div style={{
      background: '#141A2A', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: 18, marginBottom: 18,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
        fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase', color: '#A5B4FC',
      }}>
        <ListTodo size={13} /> Today
        {plan?.daysToExam != null && (
          <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0, fontWeight: 600, color: '#9CA3AF', fontSize: 11 }}>
            {plan.daysToExam} day{plan.daysToExam === 1 ? '' : 's'} to your exam · {plan.phase.toLowerCase()} phase
          </span>
        )}
      </div>

      {/* The scheduler's day, when a syllabus map exists for this student. */}
      {plan && plan.items.length > 0 ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {plan.items.map((it, i) => (
              <button key={it.id} onClick={() => onNavigate?.(it.to)} className="kyno-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 14px', textAlign: 'left' }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: 'grid', placeItems: 'center',
                  fontSize: 11, fontWeight: 800,
                  background: it.kind === 'repair' ? 'rgba(255,122,144,0.16)' : it.kind === 'review' ? 'rgba(52,211,153,0.16)' : 'rgba(124,92,255,0.14)',
                  color: it.kind === 'repair' ? '#FF9CB0' : it.kind === 'review' ? '#34D399' : '#A5B4FC',
                }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#fafafa' }}>{it.title}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: '#9CA3AF', marginTop: 2, lineHeight: 1.5 }}>{it.why}</span>
                </span>
                <span style={{ flexShrink: 0, fontSize: 10.5, color: '#6B7280' }}>{it.minutes}m</span>
                <ArrowRight size={13} style={{ flexShrink: 0, opacity: 0.7 }} />
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: '#6B7280', marginTop: 9, lineHeight: 1.5 }}>
            {plan.note} · about {plan.plannedMinutes} min of your {plan.budgetMinutes}.
          </div>
        </>
      ) : tasks.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12.5, color: '#B1B5BA', lineHeight: 1.7 }}>
          Nothing queued yet — that just means Kyno hasn't seen you work.
          Ask one doubt in the Solver and tomorrow's three will be built from it.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.map((t: DailyTask, i: number) => (
            <button
              key={i}
              onClick={() => onNavigate?.(t.to)}
              className="kyno-ghost"
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '10px 14px', textAlign: 'left',
              }}
            >
              <span style={{
                width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                background: 'rgba(124, 92, 255, 0.14)', color: '#A5B4FC',
                display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800,
              }}>{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#fafafa' }}>
                  {t.title}
                </span>
                <span style={{ display: 'block', fontSize: 11.5, color: '#9CA3AF', marginTop: 2, lineHeight: 1.5 }}>
                  {t.why}
                </span>
              </span>
              <ArrowRight size={13} style={{ flexShrink: 0, opacity: 0.7 }} />
            </button>
          ))}
        </div>
      )}

      {growth.ready && (
        <div style={{
          marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5,
          color: growth.deltaPts >= 0 ? '#34D399' : '#B1B5BA',
        }}>
          <TrendingUp size={12} />
          {growth.deltaPts > 0
            ? `You're answering ${growth.deltaPts} points more accurately than three weeks ago (${growth.accBefore}% → ${growth.accNow}%).`
            : growth.deltaPts === 0
              ? `Holding steady at ${growth.accNow}% accuracy — consistency is what compounds.`
              // Tone rule: a dip is information plus a next step, never a verdict.
              : `Accuracy dipped from ${growth.accBefore}% to ${growth.accNow}% — usually a sign the questions got harder. Task 1 above is the fastest way back.`}
        </div>
      )}
    </div>
  )
}
