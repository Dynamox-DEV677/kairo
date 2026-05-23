import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, RotateCcw, Brain, Coffee, Leaf } from 'lucide-react'

type Mode = 'focus' | 'short' | 'long'

const DURATIONS: Record<Mode, number> = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 }
const MODE_LABELS: Record<Mode, string> = { focus: 'Focus Time', short: 'Short Break', long: 'Long Break' }
const MODE_COLORS: Record<Mode, string> = { focus: '#4F7CFF', short: '#A5B4FC', long: '#38bdf8' }

const TASKS_PRESET = ['Study Chapter', 'Solve Problems', 'Revise Notes', 'Practice Questions', 'Read Textbook']

export default function Pomodoro() {
  const [mode, setMode]       = useState<Mode>('focus')
  const [timeLeft, setTimeLeft] = useState(DURATIONS.focus)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState(0)
  const [task, setTask]       = useState('')
  const [history, setHistory] = useState<{ task: string; mode: Mode; completed: boolean; time: string }[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const color = MODE_COLORS[mode]
  const total = DURATIONS[mode]
  const pct   = ((total - timeLeft) / total) * 100
  const r     = 80
  const circ  = 2 * Math.PI * r
  const stroke = circ - (pct / 100) * circ

  function fmt(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(intervalRef.current!)
            setRunning(false)
            onComplete()
            return 0
          }
          return t - 1
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current!)
    }
    return () => clearInterval(intervalRef.current!)
  }, [running])

  function onComplete() {
    if (mode === 'focus') setSessions(s => s + 1)
    setHistory(h => [{ task: task || mode, mode, completed: true, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }, ...h].slice(0, 20))
    // auto suggest break after focus
    if (mode === 'focus') {
      const nextMode = sessions > 0 && (sessions + 1) % 4 === 0 ? 'long' : 'short'
      setMode(nextMode)
      setTimeLeft(DURATIONS[nextMode])
    }
  }

  function switchMode(m: Mode) {
    clearInterval(intervalRef.current!)
    setRunning(false)
    setMode(m)
    setTimeLeft(DURATIONS[m])
  }

  function reset() {
    clearInterval(intervalRef.current!)
    setRunning(false)
    setTimeLeft(DURATIONS[mode])
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 800, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Pomodoro Timer</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Focus 25 min · Break 5 min · Stay sharp</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Timer */}
        <div style={{ background: '#0E1117', border: '1px solid #1f2532', borderRadius: 20, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Mode selector */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#0E1117', border: '1px solid #1f2532', borderRadius: 9, padding: 3 }}>
            {(['focus', 'short', 'long'] as Mode[]).map(m => (
              <button key={m} onClick={() => switchMode(m)} style={{
                padding: '5px 10px', borderRadius: 7, border: 'none', fontFamily: 'inherit',
                fontSize: 11, fontWeight: mode === m ? 600 : 400, cursor: 'pointer',
                background: mode === m ? `${MODE_COLORS[m]}20` : 'transparent',
                color: mode === m ? MODE_COLORS[m] : '#6B7280', transition: 'all 0.15s',
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {m === 'focus' ? <Brain size={12} /> : m === 'short' ? <Coffee size={12} /> : <Leaf size={12} />}
                  {m === 'focus' ? 'Focus' : m === 'short' ? 'Short' : 'Long'}
                </span>
              </button>
            ))}
          </div>

          {/* Circle timer */}
          <div style={{ position: 'relative', width: 200, height: 200, marginBottom: 20 }}>
            <svg width="200" height="200" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
              <circle cx="100" cy="100" r={r} fill="none" stroke="#1f2532" strokeWidth="8" />
              <motion.circle
                cx="100" cy="100" r={r} fill="none" stroke={color} strokeWidth="8"
                strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={stroke}
                animate={{ strokeDashoffset: stroke }}
                transition={{ duration: 0.3 }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 38, fontWeight: 800, color: '#fafafa', fontFamily: 'monospace' }}>{fmt(timeLeft)}</div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{MODE_LABELS[mode]}</div>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button onClick={() => setRunning(r => !r)} style={{
              width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: `linear-gradient(135deg,${color},${color}cc)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 20px ${color}40`,
            }}>
              {running ? <Pause size={22} color="#fff" /> : <Play size={22} color="#fff" fill="#fff" />}
            </button>
            <button onClick={reset} style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid #1f2532', background: '#0E1117', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
              <RotateCcw size={15} color="#6B7280" />
            </button>
          </div>

          {/* Task */}
          <div style={{ width: '100%' }}>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Current Task</div>
            <input value={task} onChange={e => setTask(e.target.value)} placeholder="What are you working on?" style={{ background: '#0E1117', border: '1px solid #1f2532', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#fafafa', fontFamily: 'inherit', outline: 'none', width: '100%' }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {TASKS_PRESET.map(t => (
                <button key={t} onClick={() => setTask(t)} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid #1f2532', background: 'transparent', color: '#6B7280', cursor: 'pointer', fontFamily: 'inherit' }}>{t}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 16, width: '100%' }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '8px', background: '#0E1117', borderRadius: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#66D9FF' }}>{sessions}</div>
              <div style={{ fontSize: 10, color: '#6B7280' }}>Sessions</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '8px', background: '#0E1117', borderRadius: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#A5B4FC' }}>{Math.floor(sessions * 25 / 60)}h {(sessions * 25) % 60}m</div>
              <div style={{ fontSize: 10, color: '#6B7280' }}>Focused</div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div>
          {/* Tips */}
          <div style={{ background: '#0E1117', border: '1px solid #1f2532', borderRadius: 14, padding: 20, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: mode === 'focus' ? '#66D9FF' : '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {mode === 'focus' ? <Brain size={13} /> : <Coffee size={13} />}
                {mode === 'focus' ? 'Focus Tips' : 'Break Tips'}
              </span>
            </div>
            {mode === 'focus' ? [
              'Close all social media tabs',
              'Put your phone face-down',
              'Work on ONE thing at a time',
              'Write down distracting thoughts to deal with later',
              'Set a clear mini-goal for this session',
            ].map((t, i) => <div key={i} style={{ fontSize: 12, color: '#B1B5BA', marginBottom: 6 }}>→ {t}</div>)
            : [
              'Stand up and stretch',
              'Drink some water',
              'Walk for 2 minutes',
              'Look away from the screen',
              'Take 5 deep breaths',
            ].map((t, i) => <div key={i} style={{ fontSize: 12, color: '#B1B5BA', marginBottom: 6 }}>→ {t}</div>)}
          </div>

          {/* Session history */}
          <div style={{ background: '#0E1117', border: '1px solid #1f2532', borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Session Log</div>
            {history.length === 0 && <div style={{ fontSize: 12, color: '#4B5563', textAlign: 'center', padding: '20px 0' }}>Start your first session!</div>}
            <AnimatePresence>
              {history.slice(0, 8).map((h, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, padding: '6px 0', borderBottom: '1px solid #1a1f2e' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: MODE_COLORS[h.mode], flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 12, color: '#B1B5BA' }}>{h.task}</div>
                  <div style={{ fontSize: 10, color: '#4B5563' }}>{h.time}</div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
