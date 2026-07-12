import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Flame, Crown, Medal, Calendar, Infinity as InfinityIcon, Loader2 } from 'lucide-react'
import { fetchLeagueBoard, loadGame, type LeagueBoard } from '../lib/game'

type Range = 'week' | 'month' | 'all'

const C = {
  bg: '#050505', panel: '#0E1117', border: '#1f2532',
  text: '#fafafa', dim: '#9CA3AF', faint: '#6B7280',
  accent: '#66D9FF', blue: '#4F7CFF', gold: '#FFB44A',
}

const TABS: { id: Range; label: string; icon: any }[] = [
  { id: 'week',  label: 'This Week',  icon: Flame },
  { id: 'month', label: 'This Month', icon: Calendar },
  { id: 'all',   label: 'All-Time',   icon: InfinityIcon },
]

const RANK_COLOR = ['#FFD700', '#C0C7D0', '#CD7F32']

export default function League() {
  const [range, setRange]   = useState<Range>('week')
  const [board, setBoard]   = useState<LeagueBoard | null>(null)
  const [loading, setLoading] = useState(true)

  const g = loadGame()
  const localXp = range === 'week' ? g.weekXP : g.totalXP

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchLeagueBoard(range).then(b => {
      if (alive) { setBoard(b); setLoading(false) }
    })
    return () => { alive = false }
  }, [range])

  const rows = board?.rows || []
  const offline = board?.offline || (!loading && rows.length === 0)
  const youRank = board?.rank || 0
  const youXp = board?.youXp ?? localXp

  return (
    <div style={{ padding: 'clamp(16px, 5vw, 28px) clamp(14px, 4vw, 32px)', maxWidth: 720, margin: '0 auto', height: '100%', overflowY: 'auto', color: C.text }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, background: `linear-gradient(135deg, ${C.gold}, #FF7A3C)`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Trophy size={22} color="#1a1a1a" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: 1.6 }}>League · Every XP counts</div>
          <h1 style={{ fontSize: 'clamp(22px, 6vw, 30px)', fontWeight: 900, margin: '2px 0 0', letterSpacing: -0.5 }}>Climb the ranks.</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: C.dim, lineHeight: 1.5 }}>
            Quizzes, flashcards, labs, notes and battles all earn XP. Compete this week, this month, and all-time.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 4, marginBottom: 18 }}>
        {TABS.map(t => {
          const active = range === t.id
          return (
            <button key={t.id} onClick={() => setRange(t.id)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 6px', borderRadius: 9, border: 'none', cursor: 'pointer',
                background: active ? `linear-gradient(135deg, ${C.blue}, #2046C2)` : 'transparent',
                color: active ? '#fff' : C.dim, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                transition: 'background 0.2s',
              }}>
              <t.icon size={13} /> {t.label}
            </button>
          )
        })}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18,
        background: `linear-gradient(135deg, rgba(79,124,255,0.14), rgba(102,217,255,0.06))`,
        border: `1px solid rgba(102,217,255,0.28)`, borderRadius: 14, padding: '16px 18px',
      }}>
        <div style={{ textAlign: 'center', minWidth: 66 }}>
          <div style={{ fontSize: 30, fontWeight: 900, color: C.accent, lineHeight: 1 }}>{youRank ? `#${youRank}` : '—'}</div>
          <div style={{ fontSize: 10, color: C.dim, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>Your rank</div>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: C.border }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.text, lineHeight: 1 }}>{youXp.toLocaleString()} <span style={{ fontSize: 13, color: C.dim, fontWeight: 700 }}>XP</span></div>
          <div style={{ fontSize: 11.5, color: C.dim, marginTop: 5 }}>
            {range === 'week' ? 'earned this week' : range === 'month' ? 'earned this month' : 'earned all-time'}
            {board && board.total > 0 && ` · ${board.total} student${board.total === 1 ? '' : 's'} competing`}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Loader2 size={22} color={C.accent} style={{ animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : offline ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: C.faint }}>
          <Trophy size={30} color={C.border} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: C.dim, marginBottom: 6 }}>No rankings yet</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.55, maxWidth: 360, margin: '0 auto' }}>
            Earn XP by solving doubts, taking quizzes, reviewing flashcards, opening labs and winning battles — you'll appear here as soon as the board fills.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <AnimatePresence mode="popLayout">
            {rows.map((r, i) => (
              <motion.div key={r.name + i}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 15px', borderRadius: 11,
                  background: r.you ? 'rgba(102,217,255,0.12)' : C.panel,
                  border: `1px solid ${r.you ? 'rgba(102,217,255,0.4)' : C.border}`,
                }}>
                <div style={{ width: 30, flexShrink: 0, textAlign: 'center' }}>
                  {i < 3
                    ? <div style={{ display: 'inline-grid', placeItems: 'center', width: 26, height: 26, borderRadius: '50%', background: `${RANK_COLOR[i]}22` }}>
                        {i === 0 ? <Crown size={15} color={RANK_COLOR[0]} /> : <Medal size={15} color={RANK_COLOR[i]} />}
                      </div>
                    : <span style={{ fontSize: 14, fontWeight: 800, color: C.faint }}>{i + 1}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: r.you ? 800 : 600, color: r.you ? C.accent : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.name}{r.you && <span style={{ fontSize: 10.5, color: C.accent, marginLeft: 7, fontWeight: 700 }}>YOU</span>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: r.you ? C.accent : C.dim, flexShrink: 0 }}>
                  {r.xp.toLocaleString()} <span style={{ fontSize: 10.5, color: C.faint, fontWeight: 600 }}>XP</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {youRank > rows.length && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginTop: 4,
              padding: '12px 15px', borderRadius: 11,
              background: 'rgba(102,217,255,0.12)', border: '1px solid rgba(102,217,255,0.4)',
            }}>
              <div style={{ width: 30, flexShrink: 0, textAlign: 'center', fontSize: 14, fontWeight: 800, color: C.accent }}>{youRank}</div>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 800, color: C.accent }}>You</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.accent, flexShrink: 0 }}>{youXp.toLocaleString()} <span style={{ fontSize: 10.5, color: C.faint, fontWeight: 600 }}>XP</span></div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
