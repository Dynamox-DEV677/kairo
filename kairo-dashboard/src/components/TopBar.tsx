import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown, Bell, Zap, Flame, Star,
  Gauge, BrainCircuit, Rabbit, Check, Users,
} from 'lucide-react'

const MODELS = [
  { id: 'openai/gpt-oss-20b:free',                            name: 'GPT OSS 20B',          provider: 'OpenAI', users: 3241, color: '#34d399', badge: 'Default' },
  { id: 'openai/gpt-oss-120b:free',                           name: 'GPT OSS 120B',         provider: 'OpenAI', users: 1872, color: '#818cf8', badge: 'Smart' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free',             name: 'Llama 3.3 70B',        provider: 'Meta',   users: 5104, color: '#a78bfa', badge: '' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free',             name: 'Nemotron Super 120B',  provider: 'Nvidia', users: 987,  color: '#76b900', badge: 'New' },
  { id: 'google/gemma-4-31b-it:free',                         name: 'Gemma 4 31B',          provider: 'Google', users: 2398, color: '#fbbf24', badge: '' },
  { id: 'qwen/qwen3-coder:free',                              name: 'Qwen3 Coder',          provider: 'Alibaba',users: 2761, color: '#f472b6', badge: 'Huge' },
]

type AccuracyMode = 'fast' | 'balanced' | 'smart'

const MODES: { id: AccuracyMode; label: string; icon: React.ElementType; color: string; desc: string }[] = [
  { id: 'fast', label: 'Fast', icon: Rabbit, color: '#34d399', desc: 'Quick answers' },
  { id: 'balanced', label: 'Balanced', icon: Gauge, color: '#818cf8', desc: 'Best of both' },
  { id: 'smart', label: 'Smart', icon: BrainCircuit, color: '#f472b6', desc: 'Deep reasoning' },
]

function fmt(n: number) {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n)
}

interface TopBarProps {
  title: string
  onModelChange?: (modelId: string) => void
}

export default function TopBar({ title, onModelChange }: TopBarProps) {
  const [modelOpen, setModelOpen] = useState(false)
  const [modeOpen, setModeOpen] = useState(false)
  const [model, setModel] = useState(MODELS[0])
  const [mode, setMode] = useState<AccuracyMode>('balanced')

  function selectModel(m: typeof MODELS[0]) {
    setModel(m)
    setModelOpen(false)
    onModelChange?.(m.id)
  }
  const [notifOpen, setNotifOpen] = useState(false)

  const currentMode = MODES.find(m => m.id === mode)!

  return (
    <div style={{
      height: 52, flexShrink: 0,
      borderBottom: '1px solid #1a1a1a',
      display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: 10,
      background: 'rgba(13,13,13,0.95)',
      backdropFilter: 'blur(12px)',
      zIndex: 200,
      position: 'relative',
    }}>
      {/* Page title */}
      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: 14, fontWeight: 600, color: '#fafafa', letterSpacing: '-0.2px' }}>{title}</h1>
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

        {/* Accuracy mode selector */}
        <div style={{ position: 'relative' }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={() => { setModeOpen(o => !o); setModelOpen(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 11px', borderRadius: 7,
              background: '#161616', border: '1px solid #1e1e1e',
              cursor: 'pointer', fontFamily: 'inherit',
              color: currentMode.color, fontSize: 12, fontWeight: 600,
            }}
          >
            <currentMode.icon size={12} />
            {currentMode.label}
            <ChevronDown size={11} color="#52525b" style={{ transform: modeOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </motion.button>

          <AnimatePresence>
            {modeOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 6,
                  background: '#111', border: '1px solid #1e1e1e', borderRadius: 10,
                  minWidth: 180, zIndex: 300, overflow: 'hidden',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
                }}
              >
                {MODES.map(m => (
                  <button key={m.id} onClick={() => { setMode(m.id); setModeOpen(false) }}
                    style={{
                      width: '100%', padding: '10px 14px', border: 'none',
                      background: mode === m.id ? '#161616' : 'none',
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 10,
                      borderLeft: mode === m.id ? `2px solid ${m.color}` : '2px solid transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (mode !== m.id) (e.currentTarget as HTMLButtonElement).style.background = '#161616' }}
                    onMouseLeave={e => { if (mode !== m.id) (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                  >
                    <m.icon size={14} color={m.color} />
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: mode === m.id ? '#fafafa' : '#a1a1aa' }}>{m.label}</div>
                      <div style={{ fontSize: 11, color: '#52525b' }}>{m.desc}</div>
                    </div>
                    {mode === m.id && <Check size={12} color={m.color} />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: '#1e1e1e' }} />

        {/* Model selector */}
        <div style={{ position: 'relative' }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={() => { setModelOpen(o => !o); setModeOpen(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 11px', borderRadius: 7,
              background: '#161616', border: '1px solid #1e1e1e',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: model.color, boxShadow: `0 0 5px ${model.color}`, flexShrink: 0 }} />
            <span style={{ color: '#71717a', fontSize: 10, fontWeight: 600 }}>{model.provider}</span>
            <span style={{ color: '#fafafa', fontWeight: 500 }}>{model.name}</span>
            <ChevronDown size={11} color="#52525b" style={{ transform: modelOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </motion.button>

          <AnimatePresence>
            {modelOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 6,
                  background: '#111', border: '1px solid #1e1e1e', borderRadius: 12,
                  minWidth: 300, zIndex: 300, overflow: 'hidden',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
                }}
              >
                <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #1a1a1a' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#3f3f46', textTransform: 'uppercase', letterSpacing: 1 }}>AI Models · All Free</p>
                </div>
                {MODELS.map(m => (
                  <button key={m.id} onClick={() => selectModel(m)}
                    style={{
                      width: '100%', padding: '10px 14px', border: 'none',
                      background: model.id === m.id ? '#161616' : 'none',
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 10,
                      borderLeft: model.id === m.id ? `2px solid ${m.color}` : '2px solid transparent',
                    }}
                    onMouseEnter={e => { if (model.id !== m.id) (e.currentTarget as HTMLButtonElement).style.background = '#161616' }}
                    onMouseLeave={e => { if (model.id !== m.id) (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, boxShadow: `0 0 6px ${m.color}`, flexShrink: 0 }} />
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: model.id === m.id ? '#fafafa' : '#d4d4d8' }}>{m.name}</span>
                        <span style={{ fontSize: 10, color: '#52525b' }}>{m.provider}</span>
                        {m.badge && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: `${m.color}22`, color: m.color, fontWeight: 700 }}>{m.badge}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={10} color="#3f3f46" />
                      <span style={{ fontSize: 11, color: '#52525b' }}>{fmt(m.users)}</span>
                      {model.id === m.id && <Check size={12} color={m.color} />}
                    </div>
                  </button>
                ))}
                <div style={{ padding: '8px 14px', borderTop: '1px solid #1a1a1a' }}>
                  <p style={{ fontSize: 11, color: '#3f3f46' }}>Powered by OpenRouter — zero cost</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: '#1e1e1e' }} />

        {/* Streak */}
        <div className="animate-streak" style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 10px', borderRadius: 7,
          background: 'rgba(251,146,60,0.08)',
          border: '1px solid rgba(251,146,60,0.2)',
        }}>
          <Flame size={13} color="#fb923c" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fb923c' }}>5</span>
          <span style={{ fontSize: 11, color: '#78350f' }}>day streak</span>
        </div>

        {/* XP */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 10px', borderRadius: 7,
          background: 'rgba(250,204,21,0.06)',
          border: '1px solid rgba(250,204,21,0.15)',
        }}>
          <Star size={12} color="#facc15" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#facc15' }}>450 XP</span>
        </div>

        {/* Notification bell */}
        <div style={{ position: 'relative' }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setNotifOpen(o => !o); setModelOpen(false); setModeOpen(false) }}
            style={{
              width: 34, height: 34, borderRadius: 8,
              background: '#161616', border: '1px solid #1e1e1e',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', position: 'relative',
            }}
          >
            <Bell size={14} color="#71717a" />
            <span style={{
              position: 'absolute', top: 7, right: 7,
              width: 6, height: 6, borderRadius: '50%',
              background: '#6366f1', boxShadow: '0 0 6px #6366f1',
            }} />
          </motion.button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 6,
                  background: '#111', border: '1px solid #1e1e1e', borderRadius: 12,
                  width: 280, zIndex: 300, overflow: 'hidden',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
                }}
              >
                <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#fafafa' }}>Notifications</p>
                  <span style={{ fontSize: 10, background: '#6366f1', color: '#fff', padding: '1px 6px', borderRadius: 4 }}>3 new</span>
                </div>
                {[
                  { text: 'New flashcards ready: Chapter 5 Physics', time: '2m ago', icon: '📚', color: '#34d399' },
                  { text: 'Your essay was graded: 8.5/10', time: '1h ago', icon: '📝', color: '#f472b6' },
                  { text: 'Study streak milestone: 5 days!', time: '3h ago', icon: '🔥', color: '#fb923c' },
                ].map((n, i) => (
                  <div key={i} style={{
                    padding: '10px 14px', borderBottom: i < 2 ? '1px solid #1a1a1a' : 'none',
                    display: 'flex', gap: 10, cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#161616' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'none' }}
                  >
                    <span style={{ fontSize: 18 }}>{n.icon}</span>
                    <div>
                      <p style={{ fontSize: 12, color: '#d4d4d8', lineHeight: 1.5 }}>{n.text}</p>
                      <p style={{ fontSize: 10, color: '#3f3f46', marginTop: 2 }}>{n.time}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
