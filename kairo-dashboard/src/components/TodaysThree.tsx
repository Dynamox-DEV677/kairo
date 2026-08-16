import { useMemo } from 'react'
import { ListTodo, ArrowRight, TrendingUp } from 'lucide-react'
import { getDashboard, listFlashcards, getProfile } from '../lib/twin'
import { todaysThree, growthStat, type DailyTask } from '../lib/daily.core'

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
  const { tasks, growth } = useMemo(() => {
    const now = Date.now()
    const snap = getDashboard()
    const dueCards = listFlashcards().filter(c => typeof c.dueAt === 'number' && c.dueAt <= now).length
    const examDates = (getProfile() as any)?.examDates || []
    return {
      tasks: todaysThree({ twin: snap.twin, dueCards, examDates, now }),
      growth: growthStat(snap.recentEvents, now),
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
        <ListTodo size={13} /> Today's 3 things
      </div>

      {tasks.length === 0 ? (
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
