/**
 * Login / Register / School Setup / Quick Start
 *
 * Modes:
 *  signin   — email + password → POST /api/users/login
 *  signup   — name + role + email + password + school_name + school_passcode → POST /api/users/register
 *  school   — school_name + school_email → POST /api/schools/register
 *  local    — Quick Start, no account needed (works without Supabase)
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GraduationCap, Mail, Lock, User, Building2,
  Key, ArrowRight, Sparkles, Eye, EyeOff, Copy, Check, Zap,
} from 'lucide-react'
import { post } from '../lib/api'

export interface AuthProfile {
  id:               string
  name:             string
  role:             string
  avatar_url?:      string
  school_id?:       string
  school_name?:     string
  school_logo_url?: string
  school_email?:    string
  plan?:            string
  // local-only fields (Quick Start — no Supabase)
  cls?:             string
  board?:           string
  localMode?:       boolean
  // Supabase tokens (absent in localMode)
  access_token?:    string
  refresh_token?:   string
}

interface LoginProps {
  onLogin: (profile: AuthProfile) => void
}

type Mode = 'signin' | 'signup' | 'school' | 'local'

const ROLES = [
  { id: 'student', label: 'Student', icon: '🎓', desc: 'Learn, revise & practice' },
  { id: 'teacher', label: 'Teacher', icon: '📚', desc: 'Create papers & plans' },
]

const BOARDS  = ['CBSE', 'ICSE', 'Maharashtra', 'Tamil Nadu', 'Karnataka', 'UP Board', 'Bihar Board']
const CLASSES = ['6', '7', '8', '9', '10', '11', '12']

// Detect if Supabase is available by pinging the backend
async function checkSupabase(): Promise<boolean> {
  try {
    const API = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:4000/api'
    const res = await fetch(`${API}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'probe@check.internal', password: 'probe' }),
      signal: AbortSignal.timeout(3000),
    })
    // 503 = Supabase not configured; anything else (even 401) = Supabase is up
    return res.status !== 503
  } catch {
    return false  // backend not running
  }
}

export default function Login({ onLogin }: LoginProps) {
  const [mode, setMode]               = useState<Mode>('signin')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [supabaseDown, setSupabaseDown] = useState(false)

  // Probe backend on mount to detect if Supabase is configured
  useEffect(() => { checkSupabase().then(ok => setSupabaseDown(!ok)) }, [])

  // Sign in fields
  const [siEmail, setSiEmail]         = useState('')
  const [siPassword, setSiPassword]   = useState('')
  const [siShowPw, setSiShowPw]       = useState(false)

  // Sign up fields
  const [suName, setSuName]           = useState('')
  const [suRole, setSuRole]           = useState('student')
  const [suEmail, setSuEmail]         = useState('')
  const [suPassword, setSuPassword]   = useState('')
  const [suShowPw, setSuShowPw]       = useState(false)
  const [suSchool, setSuSchool]       = useState('')
  const [suPasscode, setSuPasscode]   = useState('')

  // School register
  const [scName, setScName]           = useState('')
  const [scEmail, setScEmail]         = useState('')
  const [scResult, setScResult]       = useState<{ passcode: string; school_id: string } | null>(null)
  const [copied, setCopied]           = useState(false)

  // Quick Start (local) fields
  const [qlName, setQlName]           = useState('')
  const [qlRole, setQlRole]           = useState('student')
  const [qlCls, setQlCls]             = useState('10')
  const [qlBoard, setQlBoard]         = useState('CBSE')

  // ── Sign In ──────────────────────────────────────────────────────────────────
  async function handleSignIn() {
    if (!siEmail.trim() || !siPassword) { setError('Email and password are required.'); return }
    setLoading(true); setError(''); setSupabaseDown(false)
    try {
      const data = await post('/users/login', { email: siEmail.trim(), password: siPassword })
      const profile: AuthProfile = {
        id:              data.user?.id,
        name:            data.user?.name,
        role:            data.user?.role,
        avatar_url:      data.user?.avatar_url,
        school_id:       data.user?.school_id,
        school_name:     data.user?.school_name,
        school_logo_url: data.user?.school_logo_url,
        school_email:    data.user?.school_email,
        plan:            data.user?.plan,
        access_token:    data.access_token,
        refresh_token:   data.refresh_token,
      }
      localStorage.setItem('kairo_token',   data.access_token)
      localStorage.setItem('kairo_refresh',  data.refresh_token)
      localStorage.setItem('kairo_profile',  JSON.stringify(profile))
      onLogin(profile)
    } catch (e: any) {
      if (e.message?.includes('503') || e.message?.toLowerCase().includes('not configured')) {
        setSupabaseDown(true)
      } else {
        setError(e.message || 'Login failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Sign Up ──────────────────────────────────────────────────────────────────
  async function handleSignUp() {
    if (!suName.trim())     { setError('Name is required.');            return }
    if (!suEmail.trim())    { setError('Email is required.');           return }
    if (!suPassword)        { setError('Password is required.');        return }
    if (!suSchool.trim())   { setError('School name is required.');     return }
    if (!suPasscode.trim()) { setError('School passcode is required.'); return }
    setLoading(true); setError(''); setSupabaseDown(false)
    try {
      const data = await post('/users/register', {
        name:            suName.trim(),
        role:            suRole,
        email:           suEmail.trim(),
        password:        suPassword,
        school_name:     suSchool.trim(),
        school_passcode: suPasscode.trim(),
      })
      const profile: AuthProfile = {
        id:              data.user?.id,
        name:            data.user?.name,
        role:            data.user?.role,
        school_id:       data.school?.id,
        school_name:     data.school?.school_name,
        school_logo_url: data.school?.school_logo_url,
        access_token:    data.access_token,
        refresh_token:   data.refresh_token,
      }
      localStorage.setItem('kairo_token',   data.access_token)
      localStorage.setItem('kairo_refresh',  data.refresh_token)
      localStorage.setItem('kairo_profile',  JSON.stringify(profile))
      onLogin(profile)
    } catch (e: any) {
      if (e.message?.includes('503') || e.message?.toLowerCase().includes('not configured')) {
        setSupabaseDown(true)
      } else {
        setError(e.message || 'Registration failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Register School ───────────────────────────────────────────────────────────
  async function handleSchoolRegister() {
    if (!scName.trim())  { setError('School name is required.');  return }
    if (!scEmail.trim()) { setError('School email is required.'); return }
    setLoading(true); setError(''); setSupabaseDown(false); setScResult(null)
    try {
      const data = await post('/schools/register', { school_name: scName.trim(), school_email: scEmail.trim() })
      setScResult({ passcode: data.passcode, school_id: data.school_id })
    } catch (e: any) {
      if (e.message?.includes('503') || e.message?.toLowerCase().includes('not configured')) {
        setSupabaseDown(true)
      } else {
        setError(e.message || 'School registration failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Quick Start (local, no account) ─────────────────────────────────────────
  function handleQuickStart() {
    if (!qlName.trim()) { setError('Please enter your name.'); return }
    const profile: AuthProfile = {
      id:        `local_${Date.now()}`,
      name:      qlName.trim(),
      role:      qlRole,
      cls:       qlCls,
      board:     qlBoard,
      localMode: true,
    }
    localStorage.setItem('kairo_profile', JSON.stringify(profile))
    // clear any stale tokens from a previous Supabase session
    localStorage.removeItem('kairo_token')
    localStorage.removeItem('kairo_refresh')
    onLogin(profile)
  }

  function copyPasscode() {
    if (!scResult) return
    navigator.clipboard.writeText(scResult.passcode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tabStyle = (t: Mode) => ({
    flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 600,
    borderRadius: 8, border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', transition: 'all 0.2s',
    background: mode === t ? '#1e1e2e' : 'transparent',
    color: mode === t ? '#818cf8' : '#52525b',
    boxShadow: mode === t ? 'inset 0 0 0 1px #2d2d4d' : 'none',
  })

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0a', fontFamily: "'Inter', system-ui, sans-serif", padding: 20,
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', top: '15%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: '100%', maxWidth: 460, position: 'relative' }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 58, height: 58, borderRadius: 16,
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed, #ec4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', boxShadow: '0 0 40px rgba(99,102,241,0.35)',
          }}>
            <GraduationCap size={26} color="#fff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fafafa', margin: 0 }}>Kairo</h1>
          <p style={{ fontSize: 13, color: '#52525b', marginTop: 5 }}>AI education platform</p>
        </div>

        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 18, padding: 28 }}>

          {/* ── Supabase not configured banner ─────────────────────────────── */}
          <AnimatePresence>
            {supabaseDown && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{
                  background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)',
                  borderRadius: 10, padding: '14px 16px', marginBottom: 16,
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', margin: '0 0 6px' }}>
                  ⚠️ Supabase is not configured
                </p>
                <p style={{ fontSize: 12, color: '#92400e', margin: '0 0 12px', lineHeight: 1.6 }}>
                  The backend doesn't have Supabase credentials yet. Add <code style={{ color: '#fbbf24' }}>SUPABASE_URL</code>,{' '}
                  <code style={{ color: '#fbbf24' }}>SUPABASE_ANON_KEY</code>, and{' '}
                  <code style={{ color: '#fbbf24' }}>SUPABASE_SERVICE_ROLE_KEY</code> to your{' '}
                  <code style={{ color: '#fbbf24' }}>.env</code> file.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { setSupabaseDown(false); setMode('local') }}
                    style={{
                      flex: 1, padding: '9px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff',
                      fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <Zap size={13} /> Use Quick Start
                  </button>
                  <a
                    href="https://app.supabase.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1, padding: '9px', borderRadius: 8, textDecoration: 'none',
                      border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24',
                      fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    Set up Supabase →
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab bar */}
          {!supabaseDown && (
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#0d0d0d', borderRadius: 10, padding: 4 }}>
              <button style={tabStyle('signin')} onClick={() => { setMode('signin'); setError('') }}>Sign In</button>
              <button style={tabStyle('signup')} onClick={() => { setMode('signup'); setError('') }}>Sign Up</button>
              <button style={tabStyle('school')} onClick={() => { setMode('school'); setError(''); setScResult(null) }}>School</button>
              <button style={tabStyle('local')}  onClick={() => { setMode('local');  setError('') }}>
                <Zap size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                Quick
              </button>
            </div>
          )}

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171', marginBottom: 16 }}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">

            {/* ── SIGN IN ─────────────────────────────────────────────────── */}
            {mode === 'signin' && !supabaseDown && (
              <motion.div key="signin" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                <Field icon={<Mail size={14} color="#52525b" />} label="Email">
                  <input type="email" value={siEmail} onChange={e => setSiEmail(e.target.value)}
                    placeholder="you@example.com" autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                    style={inputStyle} />
                </Field>
                <Field icon={<Lock size={14} color="#52525b" />} label="Password">
                  <div style={{ position: 'relative' }}>
                    <input type={siShowPw ? 'text' : 'password'} value={siPassword}
                      onChange={e => setSiPassword(e.target.value)} placeholder="••••••••"
                      onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                      style={{ ...inputStyle, paddingRight: 40 }} />
                    <button onClick={() => setSiShowPw(p => !p)} style={eyeBtn}>
                      {siShowPw ? <EyeOff size={13} color="#52525b" /> : <Eye size={13} color="#52525b" />}
                    </button>
                  </div>
                </Field>
                <PrimaryBtn loading={loading} onClick={handleSignIn}>
                  <Sparkles size={14} /> Sign in to Kairo
                </PrimaryBtn>
              </motion.div>
            )}

            {/* ── SIGN UP ─────────────────────────────────────────────────── */}
            {mode === 'signup' && !supabaseDown && (
              <motion.div key="signup" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  {ROLES.map(r => (
                    <button key={r.id} onClick={() => setSuRole(r.id)} style={{
                      padding: '12px 10px', borderRadius: 10, cursor: 'pointer',
                      border: `1px solid ${suRole === r.id ? '#6366f1' : '#1e1e1e'}`,
                      background: suRole === r.id ? 'rgba(99,102,241,0.08)' : '#0d0d0d',
                      fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s',
                    }}>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{r.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: suRole === r.id ? '#818cf8' : '#d4d4d8' }}>{r.label}</div>
                      <div style={{ fontSize: 11, color: '#52525b', marginTop: 2 }}>{r.desc}</div>
                    </button>
                  ))}
                </div>
                <Field icon={<User size={14} color="#52525b" />} label="Full Name">
                  <input value={suName} onChange={e => setSuName(e.target.value)} placeholder="e.g. Rahul Kumar" style={inputStyle} autoFocus />
                </Field>
                <Field icon={<Mail size={14} color="#52525b" />} label="Email">
                  <input type="email" value={suEmail} onChange={e => setSuEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
                </Field>
                <Field icon={<Lock size={14} color="#52525b" />} label="Password">
                  <div style={{ position: 'relative' }}>
                    <input type={suShowPw ? 'text' : 'password'} value={suPassword}
                      onChange={e => setSuPassword(e.target.value)} placeholder="min 8 characters"
                      style={{ ...inputStyle, paddingRight: 40 }} />
                    <button onClick={() => setSuShowPw(p => !p)} style={eyeBtn}>
                      {suShowPw ? <EyeOff size={13} color="#52525b" /> : <Eye size={13} color="#52525b" />}
                    </button>
                  </div>
                </Field>
                <div style={{ margin: '16px 0 12px', padding: '14px 16px', background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>🏫 Join your school</p>
                  <Field icon={<Building2 size={14} color="#52525b" />} label="School Name">
                    <input value={suSchool} onChange={e => setSuSchool(e.target.value)} placeholder="e.g. Delhi Public School" style={inputStyle} />
                  </Field>
                  <Field icon={<Key size={14} color="#52525b" />} label="School Passcode" hint="Get this from your school admin">
                    <input value={suPasscode} onChange={e => setSuPasscode(e.target.value)}
                      placeholder="XXXXXX-XXXXXX-XXXXXX"
                      style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: 1 }} />
                  </Field>
                </div>
                <PrimaryBtn loading={loading} onClick={handleSignUp}>
                  <ArrowRight size={14} /> Create account
                </PrimaryBtn>
              </motion.div>
            )}

            {/* ── REGISTER SCHOOL ─────────────────────────────────────────── */}
            {mode === 'school' && !supabaseDown && (
              <motion.div key="school" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                {!scResult ? (
                  <>
                    <p style={{ fontSize: 13, color: '#71717a', marginBottom: 16, lineHeight: 1.6 }}>
                      Register your school to get a <strong style={{ color: '#fafafa' }}>unique passcode</strong>. Share it with teachers &amp; students so they can join.
                    </p>
                    <Field icon={<Building2 size={14} color="#52525b" />} label="School Name">
                      <input value={scName} onChange={e => setScName(e.target.value)} placeholder="e.g. Delhi Public School, R.K. Puram" autoFocus style={inputStyle} />
                    </Field>
                    <Field icon={<Mail size={14} color="#52525b" />} label="School Email">
                      <input type="email" value={scEmail} onChange={e => setScEmail(e.target.value)} placeholder="admin@school.edu.in" style={inputStyle} />
                    </Field>
                    <PrimaryBtn loading={loading} onClick={handleSchoolRegister}>
                      <Building2 size={14} /> Register School
                    </PrimaryBtn>
                  </>
                ) : (
                  <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                      <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fafafa', margin: 0 }}>School Registered!</h3>
                      <p style={{ fontSize: 13, color: '#71717a', marginTop: 6 }}>Share this passcode with your staff and students</p>
                    </div>
                    <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, padding: '18px 20px', textAlign: 'center', marginBottom: 16 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>School Passcode</p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                        <code style={{ fontSize: 22, fontFamily: 'monospace', fontWeight: 800, color: '#fafafa', letterSpacing: 3 }}>
                          {scResult.passcode}
                        </code>
                        <button onClick={copyPasscode} style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          {copied ? <Check size={15} color="#34d399" /> : <Copy size={15} color="#818cf8" />}
                        </button>
                      </div>
                      <p style={{ fontSize: 11, color: '#f87171', marginTop: 12, fontWeight: 600 }}>
                        ⚠️ Save this now — it will never be shown again
                      </p>
                    </div>
                    <button onClick={() => { setScResult(null); setScName(''); setScEmail(''); setMode('signup') }}
                      style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid #1e1e1e', background: '#0d0d0d', color: '#fafafa', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Continue → Create your teacher account
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ── QUICK START (local, no Supabase needed) ─────────────────── */}
            {(mode === 'local' || supabaseDown) && (
              <motion.div key="local" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10 }}>
                  <Zap size={14} color="#f59e0b" style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: '#92400e', margin: 0, lineHeight: 1.5 }}>
                    <strong style={{ color: '#fbbf24' }}>Quick Start</strong> — no account needed. All AI features work. Data stays on your device. Add Supabase later for school sync.
                  </p>
                </div>

                {/* Role picker */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {ROLES.map(r => (
                    <button key={r.id} onClick={() => setQlRole(r.id)} style={{
                      padding: '12px 10px', borderRadius: 10, cursor: 'pointer',
                      border: `1px solid ${qlRole === r.id ? '#f59e0b' : '#1e1e1e'}`,
                      background: qlRole === r.id ? 'rgba(245,158,11,0.08)' : '#0d0d0d',
                      fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s',
                    }}>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{r.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: qlRole === r.id ? '#fbbf24' : '#d4d4d8' }}>{r.label}</div>
                      <div style={{ fontSize: 11, color: '#52525b', marginTop: 2 }}>{r.desc}</div>
                    </button>
                  ))}
                </div>

                <Field icon={<User size={14} color="#52525b" />} label="Your Name">
                  <input value={qlName} onChange={e => setQlName(e.target.value)}
                    placeholder={qlRole === 'teacher' ? 'e.g. Mrs. Priya Sharma' : 'e.g. Rahul Kumar'}
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleQuickStart()}
                    style={inputStyle} />
                </Field>

                {qlRole === 'student' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
                    <Field label="Board">
                      <select value={qlBoard} onChange={e => setQlBoard(e.target.value)} style={{ ...inputStyle, appearance: 'none' as any }}>
                        {BOARDS.map(b => <option key={b}>{b}</option>)}
                      </select>
                    </Field>
                    <Field label="Class">
                      <select value={qlCls} onChange={e => setQlCls(e.target.value)} style={{ ...inputStyle, appearance: 'none' as any }}>
                        {CLASSES.map(c => <option key={c}>Class {c}</option>)}
                      </select>
                    </Field>
                  </div>
                )}

                <PrimaryBtn loading={false} onClick={handleQuickStart} color="amber">
                  <Zap size={14} /> Start using Kairo
                </PrimaryBtn>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer hint */}
        {!supabaseDown && (
          <p style={{ fontSize: 11, color: '#27272a', textAlign: 'center', marginTop: 14 }}>
            {mode === 'signin'
              ? "New here? → Sign Up tab  ·  No account? → Quick tab"
              : mode === 'signup'
                ? "School admin? → School tab first to get your passcode"
                : mode === 'school'
                  ? "Already registered? → Sign In tab"
                  : "Your data stays on this device · Add Supabase later for school sync"}
          </p>
        )}
      </motion.div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ icon, label, hint, children }: { icon?: React.ReactNode; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#71717a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {icon}{label}
        {hint && <span style={{ color: '#3f3f46', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 4 }}>· {hint}</span>}
      </label>
      {children}
    </div>
  )
}

function PrimaryBtn({ loading, onClick, children, color = 'indigo' }: { loading: boolean; onClick: () => void; children: React.ReactNode; color?: 'indigo' | 'amber' }) {
  const bg = color === 'amber'
    ? 'linear-gradient(135deg, #f59e0b, #d97706)'
    : 'linear-gradient(135deg, #6366f1, #7c3aed)'
  const glow = color === 'amber'
    ? '0 0 24px rgba(245,158,11,0.35)'
    : '0 0 24px rgba(99,102,241,0.35)'
  return (
    <motion.button
      whileHover={{ scale: loading ? 1 : 1.02 }}
      whileTap={{ scale: loading ? 1 : 0.97 }}
      onClick={onClick}
      disabled={loading}
      style={{
        width: '100%', marginTop: 8, padding: '13px', borderRadius: 10, border: 'none',
        background: loading ? '#1e1e2e' : bg,
        color: loading ? '#52525b' : '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
        cursor: loading ? 'not-allowed' : 'pointer',
        boxShadow: loading ? 'none' : glow,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        transition: 'all 0.2s',
      }}
    >
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #3f3f46', borderTopColor: '#818cf8', animation: 'spin 0.8s linear infinite' }} />
          Please wait…
        </div>
      ) : children}
    </motion.button>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0d0d0d', border: '1px solid #1e1e1e',
  borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#fafafa',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

const eyeBtn: React.CSSProperties = {
  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
  background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex',
}
