/**
 * Focus Mode — distraction-free study session
 * - Big timer
 * - Optional study goal text
 * - Ambient gradient backdrop
 * - Tracks total focused minutes in localStorage
 */
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, RotateCcw, Target, Award, Volume2, VolumeX } from 'lucide-react'

const STORAGE = 'kairo_focus_total_min'

const PRESETS = [
  { label: '15 min', mins: 15 },
  { label: '25 min', mins: 25 },
  { label: '45 min', mins: 45 },
  { label: '60 min', mins: 60 },
]

function fmt(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function FocusMode() {
  const [duration, setDuration]   = useState(25 * 60)
  const [remaining, setRemaining] = useState(25 * 60)
  const [running, setRunning]     = useState(false)
  const [goal, setGoal]           = useState('')
  const [done, setDone]           = useState(false)
  const [ambient, setAmbient]     = useState(false)
  const [totalMin, setTotalMin]   = useState(() => Number(localStorage.getItem(STORAGE) || 0))
  const intervalRef = useRef<number | null>(null)
  const audioRef    = useRef<HTMLAudioElement | null>(null)

  // Tick
  useEffect(() => {
    if (!running) return
    intervalRef.current = window.setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          setRunning(false)
          setDone(true)
          // Bank the minutes
          const finishedMin = Math.round(duration / 60)
          const next = totalMin + finishedMin
          localStorage.setItem(STORAGE, String(next))
          setTotalMin(next)
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('Kora Focus Mode', { body: 'Session complete. Take a 5-minute break.' })
          }
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) window.clearInterval(intervalRef.current) }
  }, [running, duration, totalMin])

  // Page-leave protection while running
  useEffect(() => {
    if (!running) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [running])

  function start() {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    setDone(false)
    setRunning(true)
  }
  function pause() { setRunning(false) }
  function reset() {
    setRunning(false); setDone(false); setRemaining(duration)
  }
  function pickPreset(mins: number) {
    setDuration(mins * 60); setRemaining(mins * 60); setRunning(false); setDone(false)
  }

  const progress = 1 - remaining / duration
  // Donut math
  const R = 130
  const C = 2 * Math.PI * R
  const dash = C * progress

  const bg = ambient
    ? 'radial-gradient(ellipse at top, #1a1a2e 0%, #050505 60%), radial-gradient(ellipse at bottom right, rgba(79, 124, 255, 0.18), transparent 50%)'
    : '#050505'

  return (
    <div style={{
      minHeight: '100%', background: bg, padding: '40px 36px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      transition: 'background 0.4s ease', position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient background blobs */}
      <AnimatePresence>
        {ambient && [0, 1, 2].map(i => (
          <motion.div key={i}
            initial={{ opacity: 0 }}
            animate={{
              opacity: 0.12,
              x: [0, 60, -40, 0],
              y: [0, -30, 50, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 18 + i * 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              top: `${20 + i * 25}%`, left: `${15 + i * 28}%`,
              width: 260, height: 260, borderRadius: '50%',
              background: ['#4F7CFF', '#4F7CFF', '#A5B4FC'][i],
              filter: 'blur(80px)', pointerEvents: 'none',
            }} />
        ))}
      </AnimatePresence>

      {/* Header */}
      <div style={{ width: '100%', maxWidth: 720, display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32, zIndex: 1 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'linear-gradient(135deg,#4F7CFF,#4F7CFF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 18px rgba(79, 124, 255, 0.04)', flexShrink: 0,
        }}>
          <Target size={20} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Focus Mode</h1>
          <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Distraction-free deep work, with one goal at a time</p>
        </div>
        <button
          onClick={() => setAmbient(a => !a)}
          title={ambient ? 'Calm mode off' : 'Calm mode on'}
          style={{
            width: 36, height: 36, borderRadius: 8,
            background: ambient ? 'rgba(79, 124, 255, 0.15)' : '#151922',
            border: `1px solid ${ambient ? '#4F7CFF' : '#1f2532'}`,
            color: ambient ? '#A5B4FC' : '#9CA3AF', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          {ambient ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>
      </div>

      {/* Timer donut */}
      <div style={{
        position: 'relative', width: 320, height: 320, marginBottom: 28, zIndex: 1,
      }}>
        <svg viewBox="-160 -160 320 320" width={320} height={320}
          style={{ transform: 'rotate(-90deg)' }}>
          <circle r={R} fill="none" stroke="#1a1f2e" strokeWidth={6} />
          <motion.circle
            r={R} fill="none"
            stroke={done ? '#A5B4FC' : 'url(#grad)'}
            strokeWidth={6} strokeLinecap="round"
            strokeDasharray={C}
            animate={{ strokeDashoffset: C - dash }}
            transition={{ ease: 'linear', duration: 0.8 }}
          />
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#4F7CFF" />
              <stop offset="1" stopColor="#4F7CFF" />
            </linearGradient>
          </defs>
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <motion.div
            key={done ? 'done' : remaining}
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            style={{
              fontSize: 64, fontWeight: 800, color: '#fafafa',
              fontFamily: 'Consolas, monospace', letterSpacing: -2, lineHeight: 1,
            }}>
            {done ? 'Done' : fmt(remaining)}
          </motion.div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8, textTransform: 'uppercase', letterSpacing: 2.5 }}>
            {done ? 'great session' : running ? 'focusing' : 'paused'}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 32, zIndex: 1 }}>
        {!running ? (
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={start}
            style={{
              padding: '12px 28px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,#4F7CFF,#4F7CFF)',
              color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', boxShadow: '0 0 22px rgba(79, 124, 255, 0.04)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
            <Play size={14} />{done ? 'Start Again' : 'Start Focus'}
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={pause}
            style={{
              padding: '12px 28px', borderRadius: 10, border: '1px solid #4F7CFF',
              background: 'rgba(79, 124, 255, 0.1)', color: '#A5B4FC',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
            <Pause size={14} />Pause
          </motion.button>
        )}
        <button onClick={reset} style={{
          padding: '12px 18px', borderRadius: 10, border: '1px solid #1f2532',
          background: '#151922', color: '#9CA3AF', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <RotateCcw size={13} />Reset
        </button>
      </div>

      {/* Presets */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, zIndex: 1 }}>
        {PRESETS.map(p => (
          <button key={p.mins} onClick={() => pickPreset(p.mins)} style={{
            padding: '8px 16px', borderRadius: 8,
            border: `1px solid ${duration === p.mins * 60 ? '#4F7CFF' : '#1f2532'}`,
            background: duration === p.mins * 60 ? 'rgba(79, 124, 255, 0.12)' : 'transparent',
            color: duration === p.mins * 60 ? '#A5B4FC' : '#9CA3AF',
            fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{p.label}</button>
        ))}
      </div>

      {/* Goal input */}
      <div style={{ width: '100%', maxWidth: 560, marginBottom: 24, zIndex: 1 }}>
        <label style={{
          fontSize: 11, fontWeight: 700, color: '#6B7280',
          textTransform: 'uppercase', letterSpacing: 2, display: 'block', marginBottom: 8,
        }}>
          What are you focusing on?
        </label>
        <input
          value={goal}
          onChange={e => setGoal(e.target.value)}
          placeholder="e.g. Revise quadratic equations · Read Chapter 6"
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 10,
            background: '#0E1117', border: '1px solid #1f2532',
            color: '#fafafa', fontFamily: 'inherit', fontSize: 14,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Lifetime stats */}
      <div style={{
        padding: '12px 18px', borderRadius: 10,
        background: 'rgba(165, 180, 252, 0.08)', border: '1px solid rgba(165, 180, 252, 0.25)',
        display: 'flex', alignItems: 'center', gap: 10, zIndex: 1,
      }}>
        <Award size={14} color="#A5B4FC" />
        <span style={{ fontSize: 12, color: '#A5B4FC', fontWeight: 600 }}>
          {totalMin === 0 ? 'No focused minutes yet — start your first session.' :
            `${totalMin} focused minute${totalMin === 1 ? '' : 's'} banked.`}
        </span>
      </div>

      {/* Hidden audio element for completion chime (placeholder) */}
      <audio ref={audioRef} />
    </div>
  )
}
