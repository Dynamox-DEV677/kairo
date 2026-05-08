/**
 * Exam Battle Mode — daily challenge + school leaderboard.
 * Async multiplayer (no realtime infra) with XP, streaks, and ranks.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Swords, Trophy, Flame, Target, Crown, Medal,
  Clock, RefreshCw, Sparkles, Zap, Award,
} from 'lucide-react'
import { api } from '../lib/api'
import { chat } from '../lib/openrouter'

interface Q { q: string; options: string[]; answer: number; explain: string }
interface DailyChallenge {
  date: string
  challenge: { subject: string; topic: string; difficulty: 'easy' | 'medium' | 'hard' }
  already_played: boolean
  xp_per_correct: number
  questions: number
}
interface Leader {
  rank: number; user_id: string; name: string; avatar_url: string | null
  class_name: string | null; xp: number; battles: number; accuracy: number
}
interface MyStats {
  total_xp:     number
  battles:      number
  avg_accuracy: number
  streak:       number
  best:         { accuracy: number; xp: number; topic: string; difficulty: string } | null
  recent:       any[]
}

const card: React.CSSProperties = { background: '#111', border: '1px solid #1e1e1e', borderRadius: 14 }

type Phase = 'lobby' | 'loading' | 'live' | 'results'

export default function BattleMode() {
  const [phase, setPhase]     = useState<Phase>('lobby')
  const [tab, setTab]         = useState<'today' | 'week' | 'all'>('week')
  const [daily, setDaily]     = useState<DailyChallenge | null>(null)
  const [stats, setStats]     = useState<MyStats | null>(null)
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [me, setMe]           = useState<Leader | null>(null)
  const [questions, setQuestions] = useState<Q[]>([])
  const [idx, setIdx]         = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [secsLeft, setSecsLeft] = useState(20)
  const [err, setErr]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const intervalRef = useRef<number | null>(null)

  // Initial load
  const load = useCallback(async () => {
    try {
      const [d, s, l] = await Promise.all([
        api('/battle/daily-challenge'),
        api('/battle/me'),
        api(`/battle/leaderboard?range=${tab}`),
      ])
      setDaily(d); setStats(s); setLeaders(l.leaders || []); setMe(l.you)
    } catch (e: any) { setErr(e.message) }
  }, [tab])
  useEffect(() => { load() }, [load])

  // Timer
  useEffect(() => {
    if (phase !== 'live') return
    setSecsLeft(20)
    intervalRef.current = window.setInterval(() => {
      setSecsLeft(s => {
        if (s <= 1) {
          if (intervalRef.current) window.clearInterval(intervalRef.current)
          advance(null)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) window.clearInterval(intervalRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx])

  function advance(picked: number | null) {
    if (intervalRef.current) window.clearInterval(intervalRef.current)
    const next = [...answers]
    next[idx] = picked
    setAnswers(next)
    if (idx + 1 >= questions.length) {
      finishBattle(next)
    } else {
      setIdx(i => i + 1)
    }
  }

  async function startDaily() {
    if (!daily) return
    setErr(''); setPhase('loading'); setQuestions([]); setIdx(0); setAnswers([])
    try {
      const reply = await chat({
        messages: [
          { role: 'system', content: `You are an exam question writer for Indian school students. Write exactly ${daily.questions} ${daily.challenge.difficulty} difficulty MCQs about "${daily.challenge.topic}" (${daily.challenge.subject}). Each has 4 options + one correct answer (0-3). Concise, exam-realistic.

Return ONLY a JSON array:
[{"q":"...","options":["A","B","C","D"],"answer":2,"explain":"why"}]` },
          { role: 'user', content: `Generate the daily battle questions.` },
        ],
      })
      const m = reply.match(/\[[\s\S]*\]/)
      if (!m) throw new Error('AI returned no questions.')
      const parsed = JSON.parse(m[0]) as Q[]
      const valid = parsed.filter(q => q.q && Array.isArray(q.options) && q.options.length === 4 && typeof q.answer === 'number')
      if (valid.length < 5) throw new Error('Not enough valid questions.')
      setQuestions(valid)
      setAnswers(new Array(valid.length).fill(null))
      setIdx(0)
      setPhase('live')
    } catch (e: any) {
      setErr(e.message); setPhase('lobby')
    }
  }

  async function finishBattle(finalAnswers: (number | null)[]) {
    const correct = finalAnswers.filter((a, i) => a === questions[i].answer).length
    setSubmitting(true)
    try {
      await api('/battle/submit', {
        method: 'POST',
        body: JSON.stringify({
          score: correct,
          total: questions.length,
          difficulty: daily?.challenge.difficulty || 'medium',
          topic: daily?.challenge.topic,
          subject: daily?.challenge.subject,
          daily: true,
        }),
      })
    } catch (e: any) { setErr(e.message) }
    finally {
      setSubmitting(false)
      setPhase('results')
      // Refresh stats + leaderboard
      load()
    }
  }

  function pickAnswer(i: number) {
    const next = [...answers]; next[idx] = i; setAnswers(next)
    setTimeout(() => advance(i), 250)
  }

  function backToLobby() { setPhase('lobby'); setQuestions([]); setIdx(0); setAnswers([]) }

  // ── LOADING ────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #1e1e2e', borderTopColor: '#fbbf24' }} />
        <p style={{ fontSize: 14, color: '#a1a1aa' }}>Generating today's battle…</p>
      </div>
    )
  }

  // ── LIVE ──────────────────────────────────────────────────────────────
  if (phase === 'live') {
    const q = questions[idx]
    if (!q) return null
    const pct = (secsLeft / 20) * 100
    const color = secsLeft < 5 ? '#f87171' : secsLeft < 10 ? '#fbbf24' : '#34d399'
    return (
      <div style={{ padding: '28px 36px', maxWidth: 760, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#fbbf24', marginBottom: 6, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
              ⚡ Battle · Question {idx + 1} of {questions.length}
            </div>
            <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
              <motion.div animate={{ width: `${((idx + 1) / questions.length) * 100}%` }}
                style={{ height: '100%', background: 'linear-gradient(90deg,#fbbf24,#fb923c)' }} />
            </div>
          </div>
          <div style={{ width: 64, height: 64, position: 'relative' }}>
            <svg viewBox="-32 -32 64 64" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle r={26} fill="none" stroke="#1a1a1a" strokeWidth={3} />
              <motion.circle r={26} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 26}
                animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - pct / 100) }}
                transition={{ duration: 0.95, ease: 'linear' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
              <Clock size={11} color={color} />
              <div style={{ fontSize: 14, fontWeight: 800, color, fontFamily: 'monospace' }}>{secsLeft}</div>
            </div>
          </div>
        </div>
        <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{ ...card, padding: 22, marginBottom: 14 }}>
          <div style={{ fontSize: 16, color: '#fafafa', fontWeight: 600, lineHeight: 1.6 }}>{q.q}</div>
        </motion.div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q.options.map((opt, i) => {
            const isPicked = answers[idx] === i
            return (
              <motion.button key={i} whileHover={{ x: 3 }} whileTap={{ scale: 0.99 }}
                onClick={() => pickAnswer(i)} disabled={answers[idx] !== null && answers[idx] !== undefined}
                style={{
                  padding: '13px 16px', borderRadius: 10,
                  border: `1px solid ${isPicked ? '#fbbf24' : '#1e1e1e'}`,
                  background: isPicked ? 'rgba(251,191,36,0.12)' : '#111',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                  background: isPicked ? '#fbbf24' : '#1a1a1a',
                  color: isPicked ? '#000' : '#71717a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                }}>{String.fromCharCode(65 + i)}</div>
                <span style={{ flex: 1, fontSize: 14, color: '#e4e4e7' }}>{opt}</span>
              </motion.button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── RESULTS ──────────────────────────────────────────────────────────
  if (phase === 'results') {
    const correct = answers.filter((a, i) => a === questions[i]?.answer).length
    const total = questions.length
    const xp = correct * (daily?.xp_per_correct || 14)
    return (
      <div style={{ padding: '28px 36px', maxWidth: 720, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          style={{ ...card, padding: 32, textAlign: 'center', marginBottom: 18 }}>
          <Trophy size={48} color="#fbbf24" style={{ marginBottom: 14 }} />
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fafafa', margin: 0, marginBottom: 6 }}>
            Battle complete!
          </h2>
          <p style={{ fontSize: 14, color: '#a1a1aa', margin: 0, marginBottom: 24 }}>
            You got <strong style={{ color: '#34d399' }}>{correct}</strong> out of <strong>{total}</strong> · accuracy {Math.round((correct / total) * 100)}%
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 22px', borderRadius: 10,
            background: 'linear-gradient(135deg,#fbbf24,#fb923c)',
            color: '#000', fontFamily: 'inherit', fontSize: 18, fontWeight: 800,
          }}>
            <Zap size={18} /> +{xp} XP
          </div>
          {submitting && <p style={{ fontSize: 11, color: '#52525b', marginTop: 14 }}>Saving to leaderboard…</p>}
        </motion.div>

        <button onClick={backToLobby}
          style={{
            width: '100%', padding: '12px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #fbbf24, #fb923c)',
            color: '#000', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
          <Trophy size={14} /> View Leaderboard
        </button>
      </div>
    )
  }

  // ── LOBBY ────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '28px 36px', maxWidth: 1100, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: 'linear-gradient(135deg, #fbbf24, #fb923c)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 18px rgba(251,191,36,0.4)', flexShrink: 0,
        }}>
          <Swords size={22} color="#000" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Battle Mode</h1>
          <p style={{ fontSize: 13, color: '#52525b', marginTop: 4 }}>
            Daily challenge · school leaderboard · streaks & XP
          </p>
        </div>
        <button onClick={load} title="Refresh"
          style={{
            padding: '8px 12px', borderRadius: 8, border: '1px solid #1e1e1e',
            background: '#161616', color: '#71717a', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
          }}>
          <RefreshCw size={12} />
        </button>
      </div>

      {err && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, fontSize: 12, color: '#f87171' }}>
          {err}
        </div>
      )}

      {/* Personal stats row */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          <Tile icon={Zap}    label="Total XP"  value={stats.total_xp}             color="#fbbf24" />
          <Tile icon={Flame}  label="Streak"    value={`${stats.streak}d`}         color="#fb923c" />
          <Tile icon={Target} label="Avg Acc"   value={`${stats.avg_accuracy}%`}   color="#34d399" />
          <Tile icon={Award}  label="Battles"   value={stats.battles}              color="#818cf8" />
        </div>
      )}

      {/* Daily challenge */}
      {daily && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          style={{
            ...card, padding: 22, marginBottom: 16,
            background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(251,146,60,0.04))',
            borderColor: 'rgba(251,191,36,0.3)',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <Sparkles size={16} color="#fbbf24" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                Today's Challenge · {daily.date}
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fafafa', margin: 0, marginTop: 4 }}>
                {daily.challenge.topic}
              </h3>
              <p style={{ fontSize: 12, color: '#a1a1aa', margin: 0, marginTop: 4 }}>
                {daily.challenge.subject} · {daily.questions} questions · 20s each ·
                <span style={{ color: '#fbbf24', fontWeight: 700 }}> {daily.xp_per_correct} XP</span> per correct
              </p>
            </div>
          </div>
          <button onClick={startDaily} disabled={daily.already_played}
            style={{
              width: '100%', padding: '13px', borderRadius: 10, border: 'none',
              background: daily.already_played ? '#1c1c1c' : 'linear-gradient(135deg, #fbbf24, #fb923c)',
              color: daily.already_played ? '#52525b' : '#000',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
              cursor: daily.already_played ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: daily.already_played ? 'none' : '0 0 22px rgba(251,191,36,0.35)',
            }}>
            <Swords size={14} /> {daily.already_played ? 'Already Played Today — Come Back Tomorrow' : 'Start Today\'s Battle'}
          </button>
        </motion.div>
      )}

      {/* Leaderboard */}
      <div style={{ ...card, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Trophy size={15} color="#fbbf24" />
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', margin: 0, flex: 1 }}>School Leaderboard</h3>
          <div style={{ display: 'flex', gap: 4, background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8, padding: 3 }}>
            {(['today', 'week', 'all'] as const).map(r => (
              <button key={r} onClick={() => setTab(r)}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none',
                  background: tab === r ? '#1e1e2e' : 'transparent',
                  color: tab === r ? '#fbbf24' : '#52525b',
                  fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  textTransform: 'capitalize',
                }}>{r}</button>
            ))}
          </div>
        </div>

        {leaders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#3f3f46', fontSize: 13 }}>
            No battles yet — be the first to claim the top spot.
          </div>
        )}

        {me && me.rank > 10 && (
          <div style={{ marginBottom: 12 }}>
            <LeaderRow l={me} highlightSelf />
            <div style={{ height: 1, background: '#1e1e1e', margin: '8px 0' }} />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {leaders.slice(0, 12).map(l => (
            <LeaderRow key={l.user_id} l={l} highlightSelf={me?.user_id === l.user_id} />
          ))}
        </div>
      </div>
    </div>
  )
}

function Tile({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color: string }) {
  return (
    <div style={{ ...card, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <Icon size={12} color={color} />
        <span style={{ fontSize: 10, color: '#71717a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
    </div>
  )
}

function LeaderRow({ l, highlightSelf }: { l: Leader; highlightSelf?: boolean }) {
  const RankIcon = l.rank === 1 ? Crown : l.rank === 2 ? Medal : l.rank === 3 ? Medal : null
  const rankColor = l.rank === 1 ? '#fbbf24' : l.rank === 2 ? '#a1a1aa' : l.rank === 3 ? '#fb923c' : '#52525b'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 12px', borderRadius: 8,
      background: highlightSelf ? 'rgba(99,102,241,0.08)' : 'transparent',
      border: highlightSelf ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
    }}>
      <div style={{
        width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {RankIcon ? <RankIcon size={14} color={rankColor} />
          : <span style={{ fontSize: 11, fontWeight: 700, color: rankColor }}>{l.rank}</span>}
      </div>
      <div style={{
        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
        background: l.avatar_url ? 'transparent' : 'linear-gradient(135deg,#6366f1,#7c3aed)',
        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 11, fontWeight: 700,
      }}>
        {l.avatar_url ? <img src={l.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : l.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {l.name} {highlightSelf && <span style={{ color: '#a5b4fc', fontWeight: 500 }}>(you)</span>}
        </div>
        <div style={{ fontSize: 10.5, color: '#52525b', marginTop: 1 }}>
          {l.class_name && <>{l.class_name} · </>}{l.battles} battle{l.battles === 1 ? '' : 's'} · {l.accuracy}% acc
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24', lineHeight: 1 }}>{l.xp}</div>
        <div style={{ fontSize: 9, color: '#52525b', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>XP</div>
      </div>
    </div>
  )
}
