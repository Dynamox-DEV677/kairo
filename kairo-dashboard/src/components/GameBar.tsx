/**
 * GameBar — the Duolingo-style habit widget on Kyno Home.
 *
 *   Level ring + XP progress to next level
 *   Today's 3 quests with progress
 *   Weekly league mini-board (top 5 + your rank) from /api/league
 *   Badges strip
 *
 * XPToast — floating "+XP" notifications, mounted once app-wide.
 * Both react live to the `kairo:xp` window event fired by lib/game.ts.
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flame, Trophy, CheckCircle2, Circle, Zap, Medal } from 'lucide-react'
import { loadGame, levelFromXP, questsForToday, badges, fetchLeaderboard } from '../lib/game'

const GLASS: React.CSSProperties = {
  background: 'linear-gradient(150deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.018) 100%)',
  backdropFilter: 'blur(16px) saturate(150%)',
  WebkitBackdropFilter: 'blur(16px) saturate(150%)',
  border: '1px solid rgba(102,217,255,0.16)',
  borderRadius: 16,
}
const lbl: React.CSSProperties = {
  fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2,
}

export function GameBar() {
  const [tick, setTick] = useState(0)
  const [board, setBoard] = useState<{ rank: number; rows: { name: string; xp: number; you: boolean }[] } | null>(null)

  useEffect(() => {
    const onXP = () => setTick(t => t + 1)
    window.addEventListener('kairo:xp', onXP)
    return () => window.removeEventListener('kairo:xp', onXP)
  }, [])

  useEffect(() => {
    fetchLeaderboard().then(b => { if (b && !('offline' in b && (b as any).offline)) setBoard(b) })
  }, [tick])

  const s = loadGame()
  const { level, into, need } = levelFromXP(s.totalXP)
  const quests = questsForToday()
  const earned = badges(s).filter(b => b.earned)

  return (
    // .kg-gamebar collapses to a single column on phones (index.css) — three
    // side-by-side cards at 390px squeezed "0/100 XP" into a vertical strip.
    <div className="kg-gamebar" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 16, marginBottom: 16 }}>
      {/* ── Level + streak ─────────────────────────────────────────── */}
      <div style={{ ...GLASS, padding: 18 }}>
        <div style={{ ...lbl, color: '#66D9FF', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={12} /> Level
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* level ring */}
          <div style={{ position: 'relative', width: 66, height: 66, flexShrink: 0 }}>
            <svg viewBox="0 0 66 66" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="33" cy="33" r="28" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              <circle cx="33" cy="33" r="28" fill="none" stroke="#66D9FF" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - into / need)}`}
                style={{ transition: 'stroke-dashoffset .6s ease' }}
              />
            </svg>
            {/* top/left/width/height instead of inset:0 — the global mobile
                rule that lifts full-page inset:0 overlays above the dock
                (index.css) was collapsing this tiny ring's number to the top. */}
            <div style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              display: 'grid', placeItems: 'center',
              fontSize: 22, fontWeight: 900, color: '#fafafa',
            }}>{level}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#fafafa', fontWeight: 700 }}>{into} / {need} XP</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>to level {level + 1}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
              <Flame size={15} style={{ color: '#ff7a4a' }} />
              <b style={{ fontSize: 15 }}>{s.streak}</b>
              <span style={{ fontSize: 10.5, color: '#9CA3AF' }}>day streak</span>
            </div>
          </div>
        </div>
        {earned.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {earned.map(b => (
              <span key={b.id} title={b.desc} style={{
                fontSize: 9.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                background: 'rgba(255,180,74,0.14)', color: '#ffd180',
                border: '1px solid rgba(255,180,74,0.35)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}><Medal size={9} />{b.label}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── Daily quests ───────────────────────────────────────────── */}
      <div style={{ ...GLASS, padding: 18 }}>
        <div style={{ ...lbl, color: '#A5B4FC', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={12} /> Daily quests
        </div>
        {quests.map(q => {
          const done = s.questsDone.includes(q.id)
          const progress = Math.min(q.target, s.actionsToday[q.action] || 0)
          return (
            <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              {done
                ? <CheckCircle2 size={16} style={{ color: '#66ff9a', flexShrink: 0 }} />
                : <Circle size={16} style={{ color: '#5B616E', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12.5, fontWeight: 600,
                  color: done ? '#66ff9a' : '#fafafa',
                  textDecoration: done ? 'line-through' : 'none',
                }}>{q.label}</div>
                {!done && (
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${(progress / q.target) * 100}%`,
                      background: 'linear-gradient(90deg, #4F7CFF, #66D9FF)', borderRadius: 2,
                      transition: 'width .4s ease',
                    }} />
                  </div>
                )}
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#ffd180', flexShrink: 0 }}>+{q.bonus}</span>
            </div>
          )
        })}
      </div>

      {/* ── Weekly league ──────────────────────────────────────────── */}
      <div style={{ ...GLASS, padding: 18 }}>
        <div style={{ ...lbl, color: '#ffd180', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Trophy size={12} /> Weekly league
        </div>
        {board && board.rows.length > 0 ? (
          <>
            {board.rows.slice(0, 5).map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7,
                padding: '4px 8px', borderRadius: 8,
                background: r.you ? 'rgba(102,217,255,0.10)' : 'transparent',
                border: r.you ? '1px solid rgba(102,217,255,0.30)' : '1px solid transparent',
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 900, width: 18,
                  color: i === 0 ? '#ffd180' : i === 1 ? '#c0c8d0' : i === 2 ? '#cd8a4a' : '#5B616E',
                }}>#{i + 1}</span>
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: r.you ? 800 : 600, color: r.you ? '#66D9FF' : '#fafafa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.you ? 'You' : r.name}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: '#9CA3AF' }}>{r.xp} XP</span>
              </div>
            ))}
            {board.rank > 5 && (
              <div style={{ fontSize: 11, color: '#66D9FF', fontWeight: 700, marginTop: 4 }}>
                Your rank: #{board.rank}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 12, color: '#5B616E', lineHeight: 1.6 }}>
            Earn XP this week to enter the league.
            <div style={{ marginTop: 6, fontSize: 15, fontWeight: 900, color: '#fafafa' }}>{s.weekXP} XP this week</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Floating "+XP" toasts — mount once (Dashboard) ─────────────────────
interface XPToastItem { id: number; amount: number; reason: string; levelUp: boolean; level: number; streak: number }

export function XPToast() {
  const [toasts, setToasts] = useState<XPToastItem[]>([])

  useEffect(() => {
    let n = 1
    const onXP = (e: Event) => {
      const d = (e as CustomEvent).detail || {}
      const id = n++
      // Cap the stack at 4 so rapid-fire XP (e.g. flashcard reviews) doesn't
      // pile up off-screen.
      setToasts(prev => [...prev.slice(-3), {
        id, amount: d.amount, reason: d.reason,
        levelUp: !!d.levelUp, level: d.level ?? 1, streak: d.streak ?? 0,
      }])
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), d.levelUp ? 3800 : 2600)
    }
    window.addEventListener('kairo:xp', onXP)
    return () => window.removeEventListener('kairo:xp', onXP)
  }, [])

  return (
    <div style={{ position: 'fixed', bottom: 96, right: 22, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none', alignItems: 'flex-end' }}>
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id}
            initial={{ opacity: 0, y: 18, scale: 0.82 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            style={{
              position: 'relative', overflow: 'hidden',
              padding: t.levelUp ? '13px 20px' : '10px 15px', borderRadius: 13,
              background: t.levelUp
                ? 'linear-gradient(135deg, #FFB44A, #FF7A3C)'
                : 'linear-gradient(135deg, #4F7CFF, #2046C2)',
              border: '1px solid rgba(255,255,255,0.28)',
              boxShadow: t.levelUp ? '0 12px 40px rgba(255,140,60,0.45)' : '0 10px 30px rgba(79,124,255,0.4)',
              color: '#fff', fontFamily: "'Space Grotesk', system-ui, sans-serif",
              display: 'flex', alignItems: 'center', gap: 11, minWidth: 150,
            }}>
            {/* one-shot light sheen across the pill */}
            <motion.div
              initial={{ x: '-130%' }} animate={{ x: '170%' }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              style={{ position: 'absolute', top: 0, bottom: 0, width: '45%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)', pointerEvents: 'none' }} />
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.18)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              {t.levelUp ? <Trophy size={18} /> : <Zap size={17} />}
            </div>
            <div style={{ position: 'relative', minWidth: 0 }}>
              <div style={{ fontSize: t.levelUp ? 16 : 15, fontWeight: 900, lineHeight: 1.1, display: 'flex', alignItems: 'center', gap: 7 }}>
                {t.levelUp ? `Level ${t.level}!` : `+${t.amount} XP`}
                {!t.levelUp && t.streak >= 2 && (
                  <span style={{ fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 2, opacity: 0.95 }}>
                    <Flame size={12} /> {t.streak}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10.5, opacity: 0.92, letterSpacing: 0.3, marginTop: 2 }}>
                {t.levelUp ? `+${t.amount} XP · ${t.reason}` : t.reason}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
