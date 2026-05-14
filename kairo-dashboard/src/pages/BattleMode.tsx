/**
 * Exam Battle Mode — daily challenge + school leaderboard.
 * Async multiplayer (no realtime infra) with XP, streaks, and ranks.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Swords, Trophy, Flame, Target, Crown, Medal,
  Clock, RefreshCw, Sparkles, Zap, Award, Bot,
  Cpu, Gavel, Brain, Skull,
} from 'lucide-react'
import { api } from '../lib/api'
import { chat } from '../lib/openrouter'
import { track } from '../lib/twin'

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
type Mode  = 'daily' | 'spar'
type AILevel = 'rookie' | 'pro' | 'champion'

const AI_PROFILES: Record<AILevel, { name: string; icon: any; accuracy: number; speedMs: [number, number]; color: string; tag: string }> = {
  rookie:   { name: 'Echo',      icon: Bot,   accuracy: 0.55, speedMs: [9000, 14000], color: '#86efac', tag: 'training wheels' },
  pro:      { name: 'Quark',     icon: Cpu,   accuracy: 0.82, speedMs: [4500, 8500],  color: '#a78bfa', tag: 'sharp & fast' },
  champion: { name: 'Vortex',    icon: Skull, accuracy: 0.94, speedMs: [2500, 5000],  color: '#f87171', tag: 'merciless' },
}

export default function BattleMode() {
  const [phase, setPhase]     = useState<Phase>('lobby')
  const [mode, setMode]       = useState<Mode>('daily')
  const [aiLevel, setAiLevel] = useState<AILevel>('pro')
  const [tab, setTab]         = useState<'today' | 'week' | 'all'>('week')
  const [daily, setDaily]     = useState<DailyChallenge | null>(null)
  const [stats, setStats]     = useState<MyStats | null>(null)
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [me, setMe]           = useState<Leader | null>(null)
  const [questions, setQuestions] = useState<Q[]>([])
  const [idx, setIdx]         = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [aiAnswers, setAiAnswers] = useState<(number | null)[]>([])
  const [aiAnsweredAt, setAiAnsweredAt] = useState<(number | null)[]>([])
  const [aiThinking, setAiThinking] = useState(false)
  const [secsLeft, setSecsLeft] = useState(20)
  const [err, setErr]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [judge, setJudge]     = useState<{ verdict: string; tips: string[]; tone: 'praise' | 'neutral' | 'tough' } | null>(null)
  const [judging, setJudging] = useState(false)
  const intervalRef = useRef<number | null>(null)
  const aiTimerRef  = useRef<number | null>(null)
  const liveStartedAtRef = useRef<number>(0)

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

  // Timer + AI opponent schedule
  useEffect(() => {
    if (phase !== 'live') return
    setSecsLeft(20)
    liveStartedAtRef.current = Date.now()
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

    // Schedule AI answer when sparring
    if (mode === 'spar' && questions[idx]) {
      setAiThinking(true)
      const prof   = AI_PROFILES[aiLevel]
      const delay  = prof.speedMs[0] + Math.random() * (prof.speedMs[1] - prof.speedMs[0])
      const willGetRight = Math.random() < prof.accuracy
      aiTimerRef.current = window.setTimeout(() => {
        setAiThinking(false)
        const correctIdx = questions[idx].answer
        const wrongIdxs  = [0, 1, 2, 3].filter(i => i !== correctIdx)
        const pick = willGetRight ? correctIdx : wrongIdxs[Math.floor(Math.random() * wrongIdxs.length)]
        setAiAnswers(prev => { const n = [...prev]; n[idx] = pick; return n })
        setAiAnsweredAt(prev => { const n = [...prev]; n[idx] = Date.now() - liveStartedAtRef.current; return n })
      }, delay)
    }

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
      if (aiTimerRef.current)  window.clearTimeout(aiTimerRef.current)
    }
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
    setMode('daily')
    setErr(''); setPhase('loading'); setQuestions([]); setIdx(0); setAnswers([])
    setAiAnswers([]); setAiAnsweredAt([]); setJudge(null)
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
      setAiAnswers(new Array(valid.length).fill(null))
      setAiAnsweredAt(new Array(valid.length).fill(null))
      setIdx(0)
      setPhase('live')
    } catch (e: any) {
      setErr(e.message); setPhase('lobby')
    }
  }

  async function startSparring() {
    if (!daily) return
    setMode('spar')
    setErr(''); setPhase('loading'); setQuestions([]); setIdx(0); setAnswers([])
    setAiAnswers([]); setAiAnsweredAt([]); setJudge(null)
    const diff = aiLevel === 'rookie' ? 'easy' : aiLevel === 'pro' ? 'medium' : 'hard'
    try {
      const reply = await chat({
        messages: [
          { role: 'system', content: `You are an exam question writer. Write exactly 6 ${diff} difficulty MCQs about "${daily.challenge.topic}" (${daily.challenge.subject}). Each has 4 options + one correct answer (0-3). Exam-realistic, concise.

Return ONLY a JSON array:
[{"q":"...","options":["A","B","C","D"],"answer":2,"explain":"why"}]` },
          { role: 'user', content: `Generate 6 fresh MCQs for an AI sparring round.` },
        ],
      })
      const m = reply.match(/\[[\s\S]*\]/)
      if (!m) throw new Error('AI returned no questions.')
      const parsed = JSON.parse(m[0]) as Q[]
      const valid = parsed.filter(q => q.q && Array.isArray(q.options) && q.options.length === 4 && typeof q.answer === 'number')
      if (valid.length < 4) throw new Error('Not enough valid questions.')
      setQuestions(valid)
      setAnswers(new Array(valid.length).fill(null))
      setAiAnswers(new Array(valid.length).fill(null))
      setAiAnsweredAt(new Array(valid.length).fill(null))
      setIdx(0)
      setPhase('live')
    } catch (e: any) {
      setErr(e.message); setPhase('lobby')
    }
  }

  async function askJudge(playerCorrect: number, aiCorrect: number, total: number) {
    setJudging(true)
    try {
      const wrongTopics = questions
        .map((q, i) => ({ q, picked: answers[i], correct: q.answer }))
        .filter(x => x.picked !== null && x.picked !== x.correct)
        .map(x => x.q.q)
        .slice(0, 3)
      const sys = `You are the Kairo Judge — a calm, sharp AI examiner. You have just watched a battle between a student and Kairo's AI rival (${AI_PROFILES[aiLevel].name}, "${AI_PROFILES[aiLevel].tag}").

Return ONLY this JSON:
{"verdict": "1 sentence verdict, max 22 words, addressed to the student in 2nd person", "tips": ["tip 1", "tip 2"], "tone": "praise|neutral|tough"}

Tone rules:
- "praise" if student >= AI + 1 correct
- "tough" if student < AI - 1 correct
- "neutral" otherwise
Tips: each tip is one specific actionable line (max 18 words) — reference the actual mistakes if possible.`
      const u = `Student got ${playerCorrect}/${total}. AI got ${aiCorrect}/${total}. ${wrongTopics.length > 0 ? `Student missed questions about: ${wrongTopics.join(' | ')}` : 'Student missed nothing.'} Topic: ${daily?.challenge.topic}.`
      const reply = await chat({ messages: [{ role: 'system', content: sys }, { role: 'user', content: u }] })
      const m = reply.match(/\{[\s\S]*\}/)
      if (!m) throw new Error('judge produced no JSON')
      const parsed = JSON.parse(m[0])
      setJudge({
        verdict: String(parsed.verdict || 'Solid round.').slice(0, 200),
        tips:    Array.isArray(parsed.tips) ? parsed.tips.slice(0, 3).map((t: any) => String(t).slice(0, 140)) : [],
        tone:    parsed.tone === 'praise' || parsed.tone === 'tough' ? parsed.tone : 'neutral',
      })
    } catch {
      // Fallback judge
      const tone: 'praise' | 'neutral' | 'tough' = playerCorrect > aiCorrect ? 'praise' : playerCorrect < aiCorrect ? 'tough' : 'neutral'
      setJudge({
        verdict: tone === 'praise' ? 'Clean win — you outpaced the AI on the questions that mattered.'
              : tone === 'tough'  ? 'Rough round. Slow down, re-derive the answer before you tap.'
              :                     'Tight match. One small habit shift and you flip the result.',
        tips: ['Open the Solver on any question you missed.', 'Run flashcards on this topic tonight.'],
        tone,
      })
    } finally {
      setJudging(false)
    }
  }

  async function finishBattle(finalAnswers: (number | null)[]) {
    if (aiTimerRef.current) window.clearTimeout(aiTimerRef.current)
    const correct = finalAnswers.filter((a, i) => a === questions[i]?.answer).length
    const aiCorrect = aiAnswers.filter((a, i) => a !== null && a === questions[i]?.answer).length

    if (mode === 'daily') {
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
        load()  // Refresh stats + leaderboard
      }
    } else {
      // Sparring: skip the leaderboard submit, but always ask the judge
      setPhase('results')
    }

    // Judge always runs (both daily and spar)
    askJudge(correct, mode === 'spar' ? aiCorrect : 0, questions.length)
  }

  function pickAnswer(i: number) {
    const next = [...answers]; next[idx] = i; setAnswers(next)
    // Feed unified memory engine — every battle answer flows into the twin
    // so Mistake Analysis + Kairo OS see your battle performance too.
    try {
      const q = questions[idx]
      if (q && daily) {
        const correct = i === q.answer
        track({
          type: 'quiz_answered',
          subject: daily.challenge.subject,
          topic:   daily.challenge.topic,
          correct,
          score:   correct ? 100 : 0,
          difficulty: ({ easy: 0.3, medium: 0.55, hard: 0.8 } as any)[daily.challenge.difficulty] ?? 0.55,
          modality: 'interactive',
          payload: { source: 'battle' },
        })
      }
    } catch { /* ignore */ }
    setTimeout(() => advance(i), 250)
  }

  function backToLobby() {
    if (aiTimerRef.current) window.clearTimeout(aiTimerRef.current)
    setPhase('lobby'); setQuestions([]); setIdx(0); setAnswers([])
    setAiAnswers([]); setAiAnsweredAt([]); setJudge(null); setAiThinking(false)
  }

  // ── LOADING ────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #1e1e2e', borderTopColor: '#c4b5fd' }} />
        <p style={{ fontSize: 14, color: '#a1a1aa' }}>Generating today's battle…</p>
      </div>
    )
  }

  // ── LIVE ──────────────────────────────────────────────────────────────
  if (phase === 'live') {
    const q = questions[idx]
    if (!q) return null
    const pct = (secsLeft / 20) * 100
    const color = secsLeft < 5 ? '#5b21b6' : secsLeft < 10 ? '#c4b5fd' : '#a78bfa'
    const playerCorrectSoFar = answers.slice(0, idx).filter((a, i) => a === questions[i]?.answer).length
    const aiCorrectSoFar     = aiAnswers.slice(0, idx).filter((a, i) => a !== null && a === questions[i]?.answer).length
    const prof = AI_PROFILES[aiLevel]
    const RivalIcon = prof.icon
    return (
      <div style={{ padding: '28px 36px', maxWidth: 760, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#c4b5fd', marginBottom: 6, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
              {mode === 'spar' ? `Sparring vs ${prof.name}` : 'Battle'} · Question {idx + 1} of {questions.length}
            </div>
            <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
              <motion.div animate={{ width: `${((idx + 1) / questions.length) * 100}%` }}
                style={{ height: '100%', background: 'linear-gradient(90deg,#c4b5fd,#7c3aed)' }} />
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

        {mode === 'spar' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={{ ...card, padding: '12px 14px', borderColor: 'rgba(167,139,250,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', display: 'grid', placeItems: 'center' }}>
                  <Brain size={14} color="#000" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1 }}>You</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>{playerCorrectSoFar}/{idx} correct</div>
                </div>
                {answers[idx] != null && (
                  <span style={{ fontSize: 10, color: answers[idx] === q.answer ? '#86efac' : '#f87171', fontWeight: 700 }}>
                    {answers[idx] === q.answer ? '✓ LOCKED' : '✗ LOCKED'}
                  </span>
                )}
              </div>
            </div>
            <div style={{ ...card, padding: '12px 14px', borderColor: `${prof.color}50` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg,${prof.color},#000)`, display: 'grid', placeItems: 'center' }}>
                  <RivalIcon size={14} color="#000" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: prof.color, textTransform: 'uppercase', letterSpacing: 1 }}>{prof.name} · {aiLevel}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>{aiCorrectSoFar}/{idx} correct</div>
                </div>
                {aiAnswers[idx] != null ? (
                  <span style={{ fontSize: 10, color: aiAnswers[idx] === q.answer ? '#86efac' : '#f87171', fontWeight: 700 }}>
                    {aiAnswers[idx] === q.answer ? '✓ ANSWERED' : '✗ ANSWERED'}
                  </span>
                ) : aiThinking ? (
                  <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }}
                    style={{ fontSize: 10, color: prof.color, fontWeight: 700 }}>● thinking…</motion.span>
                ) : null}
              </div>
            </div>
          </div>
        )}
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
                  border: `1px solid ${isPicked ? '#c4b5fd' : '#1e1e1e'}`,
                  background: isPicked ? 'rgba(251,191,36,0.12)' : '#111',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                  background: isPicked ? '#c4b5fd' : '#1a1a1a',
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
    const correct   = answers.filter((a, i) => a === questions[i]?.answer).length
    const aiCorrect = aiAnswers.filter((a, i) => a !== null && a === questions[i]?.answer).length
    const total     = questions.length
    const xp        = correct * (daily?.xp_per_correct || 14)
    const isSpar    = mode === 'spar'
    const won       = isSpar && correct > aiCorrect
    const tied      = isSpar && correct === aiCorrect
    const lost      = isSpar && correct < aiCorrect
    const prof      = AI_PROFILES[aiLevel]
    const RivalIcon = prof.icon
    return (
      <div style={{ padding: '28px 36px', maxWidth: 720, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          style={{ ...card, padding: 32, textAlign: 'center', marginBottom: 18 }}>
          {isSpar ? (
            won  ? <Trophy size={48} color="#86efac" style={{ marginBottom: 14 }} />
            : tied ? <Swords size={48} color="#a78bfa" style={{ marginBottom: 14 }} />
            :        <Skull  size={48} color="#f87171" style={{ marginBottom: 14 }} />
          ) : <Trophy size={48} color="#c4b5fd" style={{ marginBottom: 14 }} />}

          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fafafa', margin: 0, marginBottom: 6 }}>
            {isSpar ? (won ? 'Victory.' : tied ? 'Draw.' : `${prof.name} wins this round.`) : 'Battle complete!'}
          </h2>
          {!isSpar && (
            <p style={{ fontSize: 14, color: '#a1a1aa', margin: 0, marginBottom: 24 }}>
              You got <strong style={{ color: '#a78bfa' }}>{correct}</strong> out of <strong>{total}</strong> · accuracy {Math.round((correct / total) * 100)}%
            </p>
          )}

          {isSpar && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 14, margin: '14px 0 22px' }}>
              <div>
                <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.4 }}>You</div>
                <div style={{ fontSize: 38, fontWeight: 800, color: won || tied ? '#86efac' : '#fafafa', lineHeight: 1, letterSpacing: -1 }}>{correct}</div>
                <div style={{ fontSize: 11, color: '#71717a' }}>{Math.round((correct / total) * 100)}% accuracy</div>
              </div>
              <div style={{ fontSize: 28, color: '#3f3f46', fontWeight: 800 }}>—</div>
              <div>
                <div style={{ fontSize: 10, color: prof.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.4 }}>
                  <RivalIcon size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                  {prof.name}
                </div>
                <div style={{ fontSize: 38, fontWeight: 800, color: lost ? prof.color : '#fafafa', lineHeight: 1, letterSpacing: -1 }}>{aiCorrect}</div>
                <div style={{ fontSize: 11, color: '#71717a' }}>{Math.round((aiCorrect / total) * 100)}% accuracy</div>
              </div>
            </div>
          )}

          {!isSpar && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 22px', borderRadius: 10,
              background: 'linear-gradient(135deg,#c4b5fd,#7c3aed)',
              color: '#000', fontFamily: 'inherit', fontSize: 18, fontWeight: 800,
            }}>
              <Zap size={18} /> +{xp} XP
            </div>
          )}
          {submitting && <p style={{ fontSize: 11, color: '#52525b', marginTop: 14 }}>Saving to leaderboard…</p>}
        </motion.div>

        {/* AI JUDGE VERDICT */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          style={{
            ...card, padding: 20, marginBottom: 14,
            background: judge?.tone === 'praise' ? 'linear-gradient(135deg, rgba(134,239,172,0.08), rgba(167,139,250,0.04))'
                      : judge?.tone === 'tough'  ? 'linear-gradient(135deg, rgba(248,113,113,0.08), rgba(167,139,250,0.04))'
                      :                            'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(124,58,237,0.04))',
            borderColor: judge?.tone === 'praise' ? 'rgba(134,239,172,0.3)'
                       : judge?.tone === 'tough'  ? 'rgba(248,113,113,0.3)'
                       :                            'rgba(167,139,250,0.3)',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9,
              background: judge?.tone === 'praise' ? 'linear-gradient(135deg,#86efac,#5b21b6)'
                         : judge?.tone === 'tough' ? 'linear-gradient(135deg,#f87171,#5b21b6)'
                         :                           'linear-gradient(135deg,#a78bfa,#5b21b6)',
              display: 'grid', placeItems: 'center' }}>
              <Gavel size={15} color="#000" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: 1.4 }}>Kairo Judge</div>
              <div style={{ fontSize: 11, color: '#71717a' }}>Independent verdict on this round</div>
            </div>
          </div>
          {judging ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#a1a1aa', fontSize: 13 }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #1e1e2e', borderTopColor: '#c4b5fd' }} />
              Reviewing your answers…
            </div>
          ) : judge ? (
            <>
              <p style={{ margin: 0, fontSize: 14.5, color: '#fafafa', fontWeight: 600, lineHeight: 1.55 }}>"{judge.verdict}"</p>
              {judge.tips.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(167,139,250,0.18)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 8 }}>What to do next</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {judge.tips.map((t, i) => (
                      <li key={i} style={{ fontSize: 13, color: '#d4d4d8', lineHeight: 1.55 }}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : null}
        </motion.div>

        <button onClick={backToLobby}
          style={{
            width: '100%', padding: '12px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #c4b5fd, #7c3aed)',
            color: '#000', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
          {isSpar ? <><Swords size={14} /> Battle Again</> : <><Trophy size={14} /> View Leaderboard</>}
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
          background: 'linear-gradient(135deg, #c4b5fd, #7c3aed)',
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
        <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, fontSize: 12, color: '#5b21b6' }}>
          {err}
        </div>
      )}

      {/* Personal stats row */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          <Tile icon={Zap}    label="Total XP"  value={stats.total_xp}             color="#c4b5fd" />
          <Tile icon={Flame}  label="Streak"    value={`${stats.streak}d`}         color="#7c3aed" />
          <Tile icon={Target} label="Avg Acc"   value={`${stats.avg_accuracy}%`}   color="#a78bfa" />
          <Tile icon={Award}  label="Battles"   value={stats.battles}              color="#a78bfa" />
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
            <Sparkles size={16} color="#c4b5fd" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#c4b5fd', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                Today's Challenge · {daily.date}
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fafafa', margin: 0, marginTop: 4 }}>
                {daily.challenge.topic}
              </h3>
              <p style={{ fontSize: 12, color: '#a1a1aa', margin: 0, marginTop: 4 }}>
                {daily.challenge.subject} · {daily.questions} questions · 20s each ·
                <span style={{ color: '#c4b5fd', fontWeight: 700 }}> {daily.xp_per_correct} XP</span> per correct
              </p>
            </div>
          </div>
          <button onClick={startDaily} disabled={daily.already_played}
            style={{
              width: '100%', padding: '13px', borderRadius: 10, border: 'none',
              background: daily.already_played ? '#1c1c1c' : 'linear-gradient(135deg, #c4b5fd, #7c3aed)',
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

      {/* AI Sparring */}
      {daily && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          style={{
            ...card, padding: 22, marginBottom: 16,
            background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(167,139,250,0.04))',
            borderColor: 'rgba(124,58,237,0.3)',
          }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <Bot size={16} color="#a78bfa" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                AI Sparring · unlimited
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fafafa', margin: 0, marginTop: 4 }}>
                Battle Kairo's AI rival
              </h3>
              <p style={{ fontSize: 12, color: '#a1a1aa', margin: 0, marginTop: 4 }}>
                6 fresh questions on <strong>{daily.challenge.topic}</strong> · race the AI to answer first · Kairo Judge gives a verdict at the end.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
            {(Object.keys(AI_PROFILES) as AILevel[]).map(lvl => {
              const p = AI_PROFILES[lvl]
              const Icon = p.icon
              const selected = aiLevel === lvl
              return (
                <motion.button key={lvl} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setAiLevel(lvl)}
                  style={{
                    padding: '12px 10px', borderRadius: 10,
                    border: `1px solid ${selected ? p.color : '#1e1e1e'}`,
                    background: selected ? `${p.color}14` : '#0d0d0d',
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    transition: 'all 0.18s ease',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                    <Icon size={13} color={p.color} />
                    <span style={{ fontSize: 11, color: p.color, fontWeight: 700, textTransform: 'capitalize', letterSpacing: 0.6 }}>
                      {lvl} · {p.name}
                    </span>
                  </div>
                  <div style={{ fontSize: 10.5, color: '#71717a', fontStyle: 'italic' }}>{p.tag}</div>
                  <div style={{ fontSize: 10, color: '#52525b', marginTop: 4 }}>
                    {Math.round(p.accuracy * 100)}% · ~{Math.round((p.speedMs[0] + p.speedMs[1]) / 2000)}s
                  </div>
                </motion.button>
              )
            })}
          </div>

          <button onClick={startSparring}
            style={{
              width: '100%', padding: '13px', borderRadius: 10, border: 'none',
              background: `linear-gradient(135deg, ${AI_PROFILES[aiLevel].color}, #7c3aed)`,
              color: '#000',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: `0 0 22px ${AI_PROFILES[aiLevel].color}55`,
            }}>
            <Swords size={14} /> Spar with {AI_PROFILES[aiLevel].name}
          </button>
        </motion.div>
      )}

      {/* Leaderboard */}
      <div style={{ ...card, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Trophy size={15} color="#c4b5fd" />
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', margin: 0, flex: 1 }}>School Leaderboard</h3>
          <div style={{ display: 'flex', gap: 4, background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8, padding: 3 }}>
            {(['today', 'week', 'all'] as const).map(r => (
              <button key={r} onClick={() => setTab(r)}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none',
                  background: tab === r ? '#1e1e2e' : 'transparent',
                  color: tab === r ? '#c4b5fd' : '#52525b',
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
  const rankColor = l.rank === 1 ? '#c4b5fd' : l.rank === 2 ? '#a1a1aa' : l.rank === 3 ? '#7c3aed' : '#52525b'
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
        background: l.avatar_url ? 'transparent' : 'linear-gradient(135deg,#7c3aed,#7c3aed)',
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
        <div style={{ fontSize: 14, fontWeight: 800, color: '#c4b5fd', lineHeight: 1 }}>{l.xp}</div>
        <div style={{ fontSize: 9, color: '#52525b', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>XP</div>
      </div>
    </div>
  )
}
