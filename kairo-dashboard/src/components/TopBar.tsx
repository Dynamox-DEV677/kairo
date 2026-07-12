import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown, Bell, Flame, Star,
  Gauge, BrainCircuit, Rabbit, Check, Users,
  Key, Copy, Building2, Shield, RefreshCw,
} from 'lucide-react'

const MODELS = [
  { id: 'openai/gpt-oss-20b:free',                            name: 'GPT OSS 20B',          provider: 'OpenAI', users: 3241, color: '#34d399', badge: 'Default' },
  { id: 'openai/gpt-oss-120b:free',                           name: 'GPT OSS 120B',         provider: 'OpenAI', users: 1872, color: '#A5B4FC', badge: 'Smart' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free',             name: 'Llama 3.3 70B',        provider: 'Meta',   users: 5104, color: '#66D9FF', badge: '' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free',             name: 'Nemotron Super 120B',  provider: 'Nvidia', users: 987,  color: '#76b900', badge: 'New' },
  { id: 'google/gemma-4-31b-it:free',                         name: 'Gemma 4 31B',          provider: 'Google', users: 2398, color: '#C7D2E8', badge: '' },
  { id: 'qwen/qwen3-coder:free',                              name: 'Qwen3 Coder',          provider: 'Alibaba',users: 2761, color: '#f472b6', badge: 'Huge' },
]

type AccuracyMode = 'fast' | 'balanced' | 'smart'

const MODES: { id: AccuracyMode; label: string; icon: React.ElementType; color: string; desc: string }[] = [
  { id: 'fast', label: 'Fast', icon: Rabbit, color: '#34d399', desc: 'Quick answers' },
  { id: 'balanced', label: 'Balanced', icon: Gauge, color: '#A5B4FC', desc: 'Best of both' },
  { id: 'smart', label: 'Smart', icon: BrainCircuit, color: '#f472b6', desc: 'Deep reasoning' },
]

function fmt(n: number) {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n)
}

interface ProfileLike {
  role?: string
  school_id?: string
  school_name?: string
  school_logo_url?: string
}

interface TopBarProps {
  title: string
  onModelChange?: (modelId: string) => void
  profile?: ProfileLike
  modelLocked?: boolean
  modelLockReason?: string
}

export default function TopBar({ title, onModelChange, profile, modelLocked, modelLockReason }: TopBarProps) {
  const [modelOpen, setModelOpen] = useState(false)
  const [modeOpen, setModeOpen] = useState(false)
  const [model, setModel] = useState(MODELS[0])
  const [mode, setMode] = useState<AccuracyMode>('balanced')
  const [passcode, setPasscode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (!isAdmin || !profile?.school_id) return
    fetch(`/api/schools/${profile.school_id}/passcode`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('kairo_token') || ''}` },
    })
      .then(r => r.json())
      .then(d => { if (d?.passcode) setPasscode(d.passcode) })
      .catch(() => {})
  }, [isAdmin, profile?.school_id])

  async function copyPasscode() {
    if (!passcode) return
    try {
      await navigator.clipboard.writeText(passcode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {}
  }

  async function regeneratePasscode() {
    if (!profile?.school_id || regenerating) return
    if (!confirm('Regenerate passcode? The old one will stop working immediately.')) return
    setRegenerating(true)
    try {
      const res = await fetch(`/api/schools/${profile.school_id}/regenerate-passcode`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('kairo_token') || ''}` },
      })
      const d = await res.json()
      if (d?.passcode) setPasscode(d.passcode)
    } catch {} finally { setRegenerating(false) }
  }

  function selectModel(m: typeof MODELS[0]) {
    setModel(m)
    setModelOpen(false)
    onModelChange?.(m.id)
  }
  const [notifOpen, setNotifOpen] = useState(false)

  const currentMode = MODES.find(m => m.id === mode)!

  return (
    <div style={{
      flexShrink: 0,
      margin: '10px 12px 0',
      borderRadius: 22,
      border: isAdmin ? '1px solid rgba(79, 124, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.05)',
      display: 'flex', alignItems: 'center',
      padding: '8px 16px', gap: 10,
      minHeight: 56,
      background: isAdmin
        ? 'linear-gradient(90deg, rgba(79, 124, 255, 0.06) 0%, rgba(20, 24, 35, 0.55) 60%)'
        : 'rgba(255, 255, 255, 0.035)',
      backdropFilter: 'blur(24px) saturate(160%)',
      WebkitBackdropFilter: 'blur(24px) saturate(160%)',
      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.025) inset',
      zIndex: 200,
      position: 'relative',
    }}>
      {isAdmin ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'linear-gradient(135deg, #4F7CFF, #4F7CFF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 14px rgba(79, 124, 255, 0.04)',
            }}>
              {profile?.school_logo_url
                ? <img src={profile.school_logo_url} alt="" style={{ width: '100%', height: '100%', borderRadius: 6, objectFit: 'cover' }} />
                : <Shield size={14} color="#fff" />}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fafafa', lineHeight: 1.2, letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                {profile?.school_name || 'School'}
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1, lineHeight: 1.2 }}>
                Admin · {title}
              </div>
            </div>
          </div>

          {passcode && (
            <motion.button
              onClick={copyPasscode}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              title="Click to copy passcode"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: 7,
                background: copied ? 'rgba(52,211,153,0.12)' : 'rgba(79, 124, 255, 0.08)',
                border: `1px solid ${copied ? 'rgba(52,211,153,0.35)' : 'rgba(79, 124, 255, 0.25)'}`,
                cursor: 'pointer', fontFamily: 'monospace', fontSize: 12,
                color: copied ? '#34d399' : '#A5B4FC', fontWeight: 700,
                letterSpacing: 0.5, transition: 'all 0.15s',
              }}
            >
              <Key size={11} />
              <span style={{ letterSpacing: 1 }}>{copied ? 'Copied!' : passcode}</span>
              {!copied && <Copy size={11} style={{ opacity: 0.6 }} />}
            </motion.button>
          )}
          <button
            onClick={regeneratePasscode}
            disabled={regenerating}
            title="Regenerate passcode"
            style={{
              width: 26, height: 26, borderRadius: 6,
              background: '#151922', border: '1px solid #1f2532',
              cursor: regenerating ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#9CA3AF', flexShrink: 0,
            }}
          >
            <RefreshCw size={11} style={{ animation: regenerating ? 'spin 0.8s linear infinite' : 'none' }} />
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 14, fontWeight: 600, color: '#fafafa', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h1>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

        <div style={{ position: 'relative' }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={() => { setModeOpen(o => !o); setModelOpen(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 13px', borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.025)', border: '1px solid rgba(255, 255, 255, 0.08)',
              cursor: 'pointer', fontFamily: 'inherit',
              color: currentMode.color, fontSize: 12, fontWeight: 600,
            }}
          >
            <currentMode.icon size={12} />
            {currentMode.label}
            <ChevronDown size={11} color="#6B7280" style={{ transform: modeOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
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
                  background: '#0E1117', border: '1px solid #1f2532', borderRadius: 10,
                  minWidth: 180, zIndex: 300, overflow: 'hidden',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
                }}
              >
                {MODES.map(m => (
                  <button key={m.id} onClick={() => { setMode(m.id); setModeOpen(false) }}
                    style={{
                      width: '100%', padding: '10px 14px', border: 'none',
                      background: mode === m.id ? '#151922' : 'none',
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 10,
                      borderLeft: mode === m.id ? `2px solid ${m.color}` : '2px solid transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (mode !== m.id) (e.currentTarget as HTMLButtonElement).style.background = '#151922' }}
                    onMouseLeave={e => { if (mode !== m.id) (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                  >
                    <m.icon size={14} color={m.color} />
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: mode === m.id ? '#fafafa' : '#B1B5BA' }}>{m.label}</div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>{m.desc}</div>
                    </div>
                    {mode === m.id && <Check size={12} color={m.color} />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={{ width: 1, height: 20, background: '#1f2532' }} />

        <div style={{ position: 'relative' }} title={modelLocked ? (modelLockReason || 'Model locked for this chat') : undefined}>
          <motion.button
            whileHover={{ scale: modelLocked ? 1 : 1.02 }}
            onClick={() => {
              if (modelLocked) return
              setModelOpen(o => !o); setModeOpen(false)
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 13px', borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.025)',
              border: `1px solid ${modelLocked ? 'rgba(199, 210, 232, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              cursor: modelLocked ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', fontSize: 12,
              opacity: modelLocked ? 0.72 : 1,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: model.color, boxShadow: `0 0 5px ${model.color}`, flexShrink: 0 }} />
            <span style={{ color: '#9CA3AF', fontSize: 10, fontWeight: 600 }}>{model.provider}</span>
            <span style={{ color: '#fafafa', fontWeight: 500 }}>{model.name}</span>
            {modelLocked ? (
              <span title={modelLockReason} style={{ display: 'flex', alignItems: 'center' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#C7D2E8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </span>
            ) : (
              <ChevronDown size={11} color="#6B7280" style={{ transform: modelOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            )}
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
                  background: '#0E1117', border: '1px solid #1f2532', borderRadius: 12,
                  minWidth: 300, zIndex: 300, overflow: 'hidden',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
                }}
              >
                <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #1a1f2e' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', letterSpacing: 1 }}>AI Models · All Free</p>
                </div>
                {MODELS.map(m => (
                  <button key={m.id} onClick={() => selectModel(m)}
                    style={{
                      width: '100%', padding: '10px 14px', border: 'none',
                      background: model.id === m.id ? '#151922' : 'none',
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 10,
                      borderLeft: model.id === m.id ? `2px solid ${m.color}` : '2px solid transparent',
                    }}
                    onMouseEnter={e => { if (model.id !== m.id) (e.currentTarget as HTMLButtonElement).style.background = '#151922' }}
                    onMouseLeave={e => { if (model.id !== m.id) (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, boxShadow: `0 0 6px ${m.color}`, flexShrink: 0 }} />
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: model.id === m.id ? '#fafafa' : '#d4d4d8' }}>{m.name}</span>
                        <span style={{ fontSize: 10, color: '#6B7280' }}>{m.provider}</span>
                        {m.badge && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: `${m.color}22`, color: m.color, fontWeight: 700 }}>{m.badge}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={10} color="#4B5563" />
                      <span style={{ fontSize: 11, color: '#6B7280' }}>{fmt(m.users)}</span>
                      {model.id === m.id && <Check size={12} color={m.color} />}
                    </div>
                  </button>
                ))}
                <div style={{ padding: '8px 14px', borderTop: '1px solid #1a1f2e' }}>
                  <p style={{ fontSize: 11, color: '#4B5563' }}>Powered by OpenRouter — zero cost</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={{ width: 1, height: 20, background: '#1f2532' }} />

        <div className="animate-streak" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 999,
          background: 'rgba(79, 124, 255, 0.08)',
          border: '1px solid rgba(79, 124, 255, 0.22)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          transition: 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
        }}>
          <Flame size={13} color="#4F7CFF" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#4F7CFF' }}>5</span>
          <span style={{ fontSize: 11, color: '#6B7280' }}>day streak</span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 999,
          background: 'rgba(199, 210, 232, 0.06)',
          border: '1px solid rgba(199, 210, 232, 0.18)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          transition: 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
        }}>
          <Star size={12} color="#C7D2E8" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#C7D2E8' }}>450 XP</span>
        </div>

        <div style={{ position: 'relative' }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setNotifOpen(o => !o); setModelOpen(false); setModeOpen(false) }}
            style={{
              width: 34, height: 34, borderRadius: 8,
              background: '#151922', border: '1px solid #1f2532',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', position: 'relative',
            }}
          >
            <Bell size={14} color="#9CA3AF" />
            <span style={{
              position: 'absolute', top: 7, right: 7,
              width: 6, height: 6, borderRadius: '50%',
              background: '#4F7CFF', boxShadow: '0 0 6px #4F7CFF',
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
                  background: '#0E1117', border: '1px solid #1f2532', borderRadius: 12,
                  width: 280, zIndex: 300, overflow: 'hidden',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
                }}
              >
                <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid #1a1f2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#fafafa' }}>Notifications</p>
                  <span style={{ fontSize: 10, background: '#4F7CFF', color: '#fff', padding: '1px 6px', borderRadius: 4 }}>3 new</span>
                </div>
                {[
                  { text: 'New flashcards ready: Chapter 5 Physics', time: '2m ago', icon: '📚', color: '#34d399' },
                  { text: 'Your essay was graded: 8.5/10', time: '1h ago', icon: '📝', color: '#f472b6' },
                  { text: 'Study streak milestone: 5 days!', time: '3h ago', icon: '🔥', color: '#4F7CFF' },
                ].map((n, i) => (
                  <div key={i} style={{
                    padding: '10px 14px', borderBottom: i < 2 ? '1px solid #1a1f2e' : 'none',
                    display: 'flex', gap: 10, cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#151922' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'none' }}
                  >
                    <span style={{ fontSize: 18 }}>{n.icon}</span>
                    <div>
                      <p style={{ fontSize: 12, color: '#d4d4d8', lineHeight: 1.5 }}>{n.text}</p>
                      <p style={{ fontSize: 10, color: '#4B5563', marginTop: 2 }}>{n.time}</p>
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
