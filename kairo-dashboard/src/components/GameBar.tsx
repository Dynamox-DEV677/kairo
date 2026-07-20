import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flame, Trophy, CheckCircle2, Circle, Zap, Medal } from 'lucide-react'
import { loadGame, levelFromXP, questsForToday, badges, fetchLeaderboard } from '../lib/game'
import { KYNO } from '../theme/tokens'

const GLASS: React.CSSProperties = {
  background: KYNO.surface,
  border: `1px solid ${KYNO.border}`,
  borderRadius: 18,
}
const lbl: React.CSSProperties = {
  fontSize: 10, color: KYNO.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.3,
  fontFamily: KYNO.display,
}
const bigNum: React.CSSProperties = { fontFamily: KYNO.display, fontWeight: 900 }

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
  const pct = Math.max(0, Math.min(100, (into / need) * 100))
  const flameSize = 15 + Math.min(s.streak, 30) * 0.4
  const flameGlow = Math.min(s.streak, 18)

  const R = 28, CIRC = 2 * Math.PI * R

  return (
    <div className="kg-gamebar" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 16, marginBottom: 16 }}>
      {/* ── Level ── */}
      <div style={{ ...GLASS, padding: 18 }}>
        <div style={{ ...lbl, color: KYNO.violet, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={12} /> Level
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative', width: 66, height: 66, flexShrink: 0 }}>
            <svg viewBox="0 0 66 66" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <defs>
                <linearGradient id="kyno-level-ring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%"  stopColor={KYNO.violet} />
                  <stop offset="100%" stopColor={KYNO.cyan} />
                </linearGradient>
              </defs>
              <circle cx="33" cy="33" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              <circle cx="33" cy="33" r={R} fill="none" stroke="url(#kyno-level-ring)" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - into / need)}
                style={{ transition: 'stroke-dashoffset .7s cubic-bezier(0.22,1,0.36,1)' }}
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
              fontSize: 24, color: KYNO.text, ...bigNum,
            }}>{level}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: KYNO.text, fontWeight: 700 }}>
              <span style={{ ...bigNum, fontSize: 16, color: KYNO.cyan }}>{into}</span>
              <span style={{ color: KYNO.textMuted }}> / {need} XP</span>
            </div>
            {/* animated cyan XP bar */}
            <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 999, marginTop: 6, overflow: 'hidden', position: 'relative' }}>
              <motion.div
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                style={{ height: '100%', background: KYNO.cyan, borderRadius: 999, position: 'relative', overflow: 'hidden' }}
              >
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, width: '40%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
                  animation: 'kyno-xp-shine 2.4s ease-in-out infinite',
                }} />
              </motion.div>
            </div>
            <div style={{ fontSize: 10.5, color: KYNO.textMuted, marginTop: 4 }}>to level {level + 1}</div>
          </div>
        </div>
        {/* gold flame streak — reacts to length */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${KYNO.border}` }}>
          <Flame
            size={flameSize}
            style={{
              color: KYNO.gold,
              filter: `drop-shadow(0 0 ${flameGlow}px rgba(255,176,32,0.6))`,
              animation: s.streak >= 3 ? 'kyno-flame 1.6s ease-in-out infinite' : undefined,
            }}
          />
          <span style={{ ...bigNum, fontSize: 20, color: KYNO.gold }}>{s.streak}</span>
          <span style={{ fontSize: 10.5, color: KYNO.textMuted }}>day streak</span>
        </div>
        {earned.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {earned.map(b => (
              <span key={b.id} title={b.desc} style={{
                fontSize: 9.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999,
                background: 'rgba(255,176,32,0.14)', color: KYNO.gold,
                border: '1px solid rgba(255,176,32,0.35)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}><Medal size={9} />{b.label}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── Daily quests ── */}
      <div style={{ ...GLASS, padding: 18 }}>
        <div style={{ ...lbl, color: KYNO.violet, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={12} /> Daily quests
        </div>
        {quests.map(q => {
          const done = s.questsDone.includes(q.id)
          const progress = Math.min(q.target, s.actionsToday[q.action] || 0)
          return (
            <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
              {done
                ? <CheckCircle2 size={17} style={{ color: KYNO.cyan, flexShrink: 0, animation: 'kyno-pop .4s cubic-bezier(0.22,1,0.36,1)' }} />
                : <Circle size={17} style={{ color: '#3A4260', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12.5, fontWeight: 700,
                  color: done ? KYNO.cyan : KYNO.text,
                  textDecoration: done ? 'line-through' : 'none',
                }}>{q.label}</div>
                {!done && (
                  <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, marginTop: 5, overflow: 'hidden' }}>
                    <motion.div
                      initial={false}
                      animate={{ width: `${(progress / q.target) * 100}%` }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                      style={{ height: '100%', background: KYNO.cyan, borderRadius: 3 }}
                    />
                  </div>
                )}
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: KYNO.gold, flexShrink: 0, ...bigNum }}>+{q.bonus}</span>
            </div>
          )
        })}
      </div>

      {/* ── Weekly league ── */}
      <div style={{ ...GLASS, padding: 18 }}>
        <div style={{ ...lbl, color: KYNO.gold, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Trophy size={12} /> Weekly league
        </div>
        {board && board.rows.length > 0 ? (
          <>
            {board.rows.slice(0, 5).map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7,
                padding: '5px 8px', borderRadius: 10,
                background: r.you ? 'rgba(124,92,255,0.12)' : 'transparent',
                border: r.you ? `1px solid ${'rgba(124,92,255,0.32)'}` : '1px solid transparent',
              }}>
                <span style={{
                  fontSize: 11, ...bigNum, width: 18,
                  color: i === 0 ? KYNO.gold : i === 1 ? '#C0C8D0' : i === 2 ? '#CD8A4A' : KYNO.textMuted,
                }}>#{i + 1}</span>
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: r.you ? 800 : 600, color: r.you ? KYNO.violet : KYNO.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.you ? 'You' : r.name}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: KYNO.textMuted }}>{r.xp} XP</span>
              </div>
            ))}
            {board.rank > 5 && (
              <div style={{ fontSize: 11, color: KYNO.violet, fontWeight: 700, marginTop: 4 }}>
                Your rank: #{board.rank}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 12, color: KYNO.textMuted, lineHeight: 1.6 }}>
            Earn XP this week to enter the league.
            <div style={{ marginTop: 6, fontSize: 15, ...bigNum, color: KYNO.text }}>{s.weekXP} XP this week</div>
          </div>
        )}
      </div>
    </div>
  )
}

interface XPToastItem { id: number; amount: number; reason: string; levelUp: boolean; level: number; streak: number }

export function XPToast() {
  const [toasts, setToasts] = useState<XPToastItem[]>([])

  useEffect(() => {
    let n = 1
    const onXP = (e: Event) => {
      const d = (e as CustomEvent).detail || {}
      const id = n++
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
              padding: t.levelUp ? '13px 20px' : '10px 15px', borderRadius: 14,
              background: t.levelUp
                ? `linear-gradient(135deg, ${KYNO.gold}, #FF7A3C)`
                : KYNO.heroGradient,
              border: '1px solid rgba(255,255,255,0.28)',
              boxShadow: t.levelUp ? '0 12px 40px rgba(255,176,32,0.4)' : '0 10px 30px rgba(124,92,255,0.4)',
              color: '#0A0D16', fontFamily: KYNO.display, fontWeight: 800,
              display: 'flex', alignItems: 'center', gap: 11, minWidth: 150,
            }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(0,0,0,0.14)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              {t.levelUp ? <Trophy size={18} /> : <Zap size={17} />}
            </div>
            <div style={{ position: 'relative', minWidth: 0 }}>
              <div style={{ fontSize: t.levelUp ? 16 : 15, fontWeight: 900, lineHeight: 1.1, display: 'flex', alignItems: 'center', gap: 7 }}>
                {t.levelUp ? `Level ${t.level}!` : `+${t.amount} XP`}
                {!t.levelUp && t.streak >= 2 && (
                  <span style={{ fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    <Flame size={12} /> {t.streak}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10.5, opacity: 0.85, letterSpacing: 0.2, marginTop: 2, fontWeight: 700 }}>
                {t.levelUp ? `+${t.amount} XP · ${t.reason}` : t.reason}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
