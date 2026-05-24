/**
 * Kairo Onboarding — four modes: Sign In · Personal · Join School · Create School
 *
 *   Sign In        : email + password → supabase.auth.signInWithPassword
 *   Personal       : 1-step → POST /api/users/register-personal (no school)
 *   Join School    : 4-step wizard → POST /api/users/register OR /api/parent/register
 *   Create School  : 3-step wizard → POST /api/schools/register → checkout
 */
import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail, Lock, User, Building2, Key, ArrowRight, ArrowLeft,
  Eye, EyeOff, Check, Sparkles, GraduationCap, BookOpen, Users,
  Shield, CreditCard, Loader2,
} from 'lucide-react'
import { post } from '../lib/api'
import { supabase, supabaseReady } from '../lib/supabase'
import { TermsAcceptLine } from '../components/Terms'

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
  cls?:             string
  board?:           string
  localMode?:       boolean
  access_token?:    string
  refresh_token?:   string
  linked_student_id?:   string
  linked_student_name?: string
}

interface LoginProps { onLogin: (profile: AuthProfile) => void }
type Mode = 'choose' | 'signin' | 'personal' | 'join' | 'create'

const ROLES = [
  { id: 'student', label: 'Student',  icon: GraduationCap, desc: 'I study here' },
  { id: 'teacher', label: 'Teacher',  icon: BookOpen,      desc: 'I teach here' },
  { id: 'parent',  label: 'Parent',   icon: Users,         desc: 'My child studies here' },
]

const PLANS = [
  { id: 'monthly', label: 'Monthly',  price: '₹1,999',  per: 'month', popular: false },
  { id: 'yearly',  label: 'Yearly',   price: '₹19,999', per: 'year',  popular: true, save: 'save 17%' },
  { id: 'trial',   label: 'Free Trial', price: '₹0',    per: '14 days', popular: false },
]

// ─── Top-level component ────────────────────────────────────────────────────
// Drifting brand wordmarks for the background.
// Time-based (not scroll-based) since Login doesn't scroll. Same monochrome
// purple palette + giant DISPLAY-style typography as the landing's
// GlobalScrollLayer, but it loops on a timer so it works on every device.
function AmbientWordmarks() {
  const display = "'Inter Tight', 'Inter', 'Neue Haas Grotesk Display', 'Helvetica Neue', system-ui, sans-serif"
  // Plain CSS keyframes — Framer Motion's `animate={{ x: [...] }}` keyframe
  // arrays were silently refusing to start in this layout (likely a conflict
  // with the centering wrapper). CSS animation is bulletproof and works on
  // every device including mobile Safari.
  return (
    <>
      <style>{`
        @keyframes kr-drift-a {
          0%, 100% { transform: translate(-50%, 0) translateX(-6vw); }
          50%      { transform: translate(-50%, 0) translateX(6vw);  }
        }
        @keyframes kr-drift-b {
          0%, 100% { transform: translate(-50%, 0) translateX(8vw);  }
          50%      { transform: translate(-50%, 0) translateX(-8vw); }
        }
        .kr-ghost-a { animation: kr-drift-a 28s ease-in-out infinite; }
        .kr-ghost-b { animation: kr-drift-b 34s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .kr-ghost-a, .kr-ghost-b { animation: none; }
        }
      `}</style>
      <div aria-hidden style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        overflow: 'hidden',
      }}>
        <div className="kr-ghost-a" style={{
          position: 'absolute', top: '14%', left: '50%',
          transform: 'translate(-50%, 0) translateX(-6vw)',
          fontFamily: display,
          fontSize: 'clamp(120px, 38vw, 540px)',
          fontWeight: 900, letterSpacing: '-0.08em',
          color: '#0B1530', opacity: 0.20,
          whiteSpace: 'nowrap', lineHeight: 1,
          willChange: 'transform',
        }}>
          KAIRO
        </div>
        <div className="kr-ghost-b" style={{
          position: 'absolute', bottom: '6%', left: '50%',
          transform: 'translate(-50%, 0) translateX(8vw)',
          fontFamily: display,
          fontSize: 'clamp(80px, 28vw, 400px)',
          fontWeight: 900, letterSpacing: '-0.08em',
          color: '#0B1530', opacity: 0.16,
          whiteSpace: 'nowrap', lineHeight: 1,
          willChange: 'transform',
        }}>
          ACADEMICS
        </div>
      </div>
    </>
  )
}

export default function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<Mode>('choose')

  const transition = { type: 'spring' as const, stiffness: 250, damping: 30 }

  return (
    // Owns its own scroll context — global `body { overflow:hidden }` on mobile
    // (which exists to keep the bottom nav fixed in the rest of the app) means
    // this page would otherwise be unscrollable. The `100dvh` keeps the layout
    // stable when mobile browser chrome shows/hides.
    <div style={{
      height: '100dvh',
      minHeight: '100vh',                          // fallback for older browsers
      background: '#050505',
      fontFamily: "'Inter', system-ui, sans-serif",
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      position: 'relative',
      overflowX: 'hidden',           // contain the drifting wordmarks
    }}>
      {/* Drifting background wordmarks — same brand language as the landing's
          GlobalScrollLayer, but TIME-based (Login doesn't scroll, so no
          scrollYProgress to bind to). Two counter-drifting bands give the
          background that "the page is breathing" feel on both desktop and
          mobile. pointerEvents: none so they never intercept taps. */}
      <AmbientWordmarks />

      {/* Ambient glow */}
      <div style={{
        position: 'fixed', top: '15%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79, 124, 255, 0.10) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      <div style={{ width: '100%', maxWidth: 480, padding: '28px 20px 48px', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 2 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 22, flexShrink: 0 }}>
          <img src="/kairo_logo.png" alt="Kairo"
            style={{
              width: 64, height: 64, borderRadius: 16, objectFit: 'contain',
              margin: '0 auto 14px', display: 'block',
              filter: 'drop-shadow(0 0 20px rgba(79, 124, 255, 0.03))',
            }} />
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fafafa', margin: 0, letterSpacing: '-0.5px' }}>kairo</h1>
          <p style={{ fontSize: 11, color: '#4F7CFF', fontWeight: 700, letterSpacing: 4, marginTop: 4, textTransform: 'uppercase' }}>
            Accelerate Your Academics
          </p>
        </div>

        {/* Wizard surface — let it size to its content (was `flex: 1` which
            collapsed the children behind a fixed viewport height). */}
        <div style={{
          background: '#0E1117', border: '1px solid #1f2532', borderRadius: 18,
          padding: 24,
        }}>
          <AnimatePresence mode="wait">
            {mode === 'choose' && (
              <motion.div key="choose" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={transition}>
                <ChooseMode setMode={setMode} />
              </motion.div>
            )}
            {mode === 'signin' && (
              <motion.div key="signin" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={transition}>
                <SignIn onLogin={onLogin} onBack={() => setMode('choose')} />
              </motion.div>
            )}
            {mode === 'personal' && (
              <motion.div key="personal" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={transition}>
                <PersonalSignup onLogin={onLogin} onBack={() => setMode('choose')} />
              </motion.div>
            )}
            {mode === 'join' && (
              <motion.div key="join" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={transition}>
                <JoinSchool onLogin={onLogin} onBack={() => setMode('choose')} />
              </motion.div>
            )}
            {mode === 'create' && (
              <motion.div key="create" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={transition}>
                <CreateSchool onLogin={onLogin} onBack={() => setMode('choose')} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!supabaseReady && (
          <p style={{ fontSize: 11, color: '#A5B4FC', textAlign: 'center', marginTop: 14, padding: '8px 14px', background: 'rgba(165, 180, 252, 0.08)', border: '1px solid rgba(165, 180, 252, 0.25)', borderRadius: 8 }}>
            ⚠ Supabase env vars missing — auth will fail. Add VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.
          </p>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Choose mode landing
// ════════════════════════════════════════════════════════════════════════════
function ChooseMode({ setMode }: { setMode: (m: Mode) => void }) {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0, marginBottom: 6 }}>Welcome</h2>
      <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 24 }}>Pick how you'd like to continue.</p>

      <ChoiceCard onClick={() => setMode('signin')} icon={Mail}
        title="Sign In" desc="Email + password — already a member" />
      <ChoiceCard onClick={() => setMode('personal')} icon={GraduationCap}
        title="Sign Up — Personal" desc="I'm a student, no school code needed" highlight />
      <ChoiceCard onClick={() => setMode('join')} icon={Building2}
        title="Join School" desc="I have a school join code" />
      <ChoiceCard onClick={() => setMode('create')} icon={Sparkles}
        title="Create School" desc="Start a new school on Kairo" />
    </div>
  )
}

function ChoiceCard({ onClick, icon: Icon, title, desc, highlight = false }: any) {
  return (
    <motion.button onClick={onClick}
      whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
      style={{
        width: '100%', padding: '16px 18px', borderRadius: 12,
        background: highlight ? 'rgba(79, 124, 255, 0.06)' : '#0E1117',
        border: `1px solid ${highlight ? 'rgba(79, 124, 255, 0.3)' : '#1f2532'}`,
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10,
      }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10, flexShrink: 0,
        background: highlight ? 'linear-gradient(135deg,#4F7CFF,#4F7CFF)' : '#1a1f2e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} color={highlight ? '#fff' : '#B1B5BA'} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fafafa' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{desc}</div>
      </div>
      <ArrowRight size={16} color="#6B7280" />
    </motion.button>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Sign In
// ════════════════════════════════════════════════════════════════════════════
function SignIn({ onLogin, onBack }: any) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow]         = useState(false)
  const [busy, setBusy]         = useState(false)
  const [err, setErr]           = useState('')
  const [resetSent, setResetSent] = useState(false)

  async function sendPasswordReset() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErr('Enter the email on your account first — we\'ll send a reset link there.')
      return
    }
    setBusy(true); setErr('')
    try {
      // Use our own Gmail-SMTP-backed endpoint — Supabase's default SMTP is
      // unreliable and 500s on free projects. Always returns 200 (anti-enum).
      await post('/users/forgot-password', { email: email.trim().toLowerCase() })
      setResetSent(true)
    } catch (e: any) {
      setErr(`Couldn't send reset email: ${e.message || 'try again later'}`)
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    if (!email.trim() || !password) { setErr('Enter your email and password.'); return }
    setBusy(true); setErr('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (error) throw new Error(error.message)

      // maybeSingle() avoids the 406 you get when .single() finds zero rows.
      // Some legacy auth users don't have a public.users profile — handle that.
      let { data: userRow } = await supabase
        .from('users').select('id, name, role, school_id, avatar_url')
        .eq('id', data.user.id).maybeSingle()

      // Auto-provision a minimal profile when the auth user has no public row.
      // Personal-mode default: role=student, no school, status=active.
      if (!userRow) {
        const fallbackName = (data.user.user_metadata as any)?.name
          || data.user.email?.split('@')[0]
          || 'Kairo Student'
        try {
          await supabase.from('users').insert({
            id:        data.user.id,
            name:      fallbackName,
            role:      'student',
            school_id: null,
          })
        } catch { /* RLS may block — server will still pick up via /users/profile */ }
        userRow = { id: data.user.id, name: fallbackName, role: 'student', school_id: null, avatar_url: null } as any
      }

      let school: any = null
      if (userRow?.school_id) {
        const { data: s } = await supabase
          .from('schools').select('id, school_name, school_logo_url, school_email, plan')
          .eq('id', userRow.school_id).maybeSingle()
        school = s
      }

      const profile: AuthProfile = {
        id:              userRow?.id || data.user.id,
        name:            userRow?.name || data.user.email || '',
        role:            userRow?.role || 'student',
        avatar_url:      userRow?.avatar_url,
        school_id:       userRow?.school_id,
        school_name:     school?.school_name,
        school_logo_url: school?.school_logo_url,
        school_email:    school?.school_email,
        plan:            school?.plan,
        access_token:    data.session.access_token,
        refresh_token:   data.session.refresh_token,
      }
      localStorage.setItem('kairo_token',   data.session.access_token)
      localStorage.setItem('kairo_refresh', data.session.refresh_token)
      localStorage.setItem('kairo_profile', JSON.stringify(profile))
      onLogin(profile)
    } catch (e: any) { setErr(e.message); setBusy(false) }
  }

  return (
    <Wizard back={onBack} step={null} title="Sign In" subtitle="Welcome back.">
      <Field label="Email" icon={Mail}>
        <input type="email" autoFocus value={email} onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="you@example.com" style={inp} />
      </Field>
      <Field label="Password" icon={Lock}>
        <div style={{ position: 'relative' }}>
          <input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="••••••••" style={{ ...inp, paddingRight: 40 }} />
          <button onClick={() => setShow(s => !s)} type="button" style={eyeBtn}>
            {show ? <EyeOff size={14} color="#6B7280" /> : <Eye size={14} color="#6B7280" />}
          </button>
        </div>
        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={sendPasswordReset}
            disabled={busy}
            style={{
              background: 'none', border: 'none', padding: 0,
              color: '#A5B4FC', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer',
              textDecoration: 'underline', textUnderlineOffset: 2,
              textDecorationColor: 'rgba(165, 180, 252, 0.4)',
            }}>
            Forgot your password?
          </button>
        </div>
      </Field>

      {resetSent && (
        <div style={{
          padding: '12px 14px', borderRadius: 10, marginBottom: 12,
          background: 'rgba(102, 217, 255, 0.10)',
          border: '1px solid rgba(102, 217, 255, 0.32)',
          color: '#A5B4FC', fontSize: 12.5, lineHeight: 1.55,
        }}>
          <strong style={{ color: '#fafafa' }}>Reset link sent ✓</strong>
          <br />
          Check <strong>{email}</strong> — click the link in the email, set a new password, then come back here and sign in.
        </div>
      )}

      {err && <ErrLine msg={err} />}
      <PrimaryBtn busy={busy} onClick={submit} icon={Sparkles}>Sign in</PrimaryBtn>
      <TermsAcceptLine action="signing in" />
    </Wizard>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Personal Sign Up — single screen, no school required
// ════════════════════════════════════════════════════════════════════════════
const BOARDS = ['CBSE', 'ICSE', 'State', 'IB', 'Other'] as const

function PersonalSignup({ onLogin, onBack }: any) {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow]         = useState(false)
  const [cls, setCls]           = useState('')
  const [board, setBoard]       = useState<string>('')
  const [avatar, setAvatar]     = useState<string | null>(null)
  const [busy, setBusy]         = useState(false)
  const [err, setErr]           = useState('')
  const [exists, setExists]     = useState(false)   // shows recovery options
  const [resetSent, setResetSent] = useState(false) // reset-email confirmation
  // Personal signup used to silently force role='student', which meant any
  // teacher signing up without a school code ended up with a student sidebar
  // and zero access to teacher tools. Default to student because that's the
  // common case; teachers tap the Teacher chip.
  const [role, setRole] = useState<'student' | 'teacher'>('student')

  async function sendPasswordReset() {
    setBusy(true); setErr('')
    try {
      // Our own Gmail-SMTP endpoint (Supabase's default SMTP 500s on free projects).
      await post('/users/forgot-password', { email: email.trim().toLowerCase() })
      setResetSent(true)
    } catch (e: any) {
      setErr(`Couldn't send reset email: ${e.message || 'try again later'}`)
    } finally {
      setBusy(false)
    }
  }

  function handleAvatar(file: File | null) {
    if (!file) { setAvatar(null); return }
    if (!file.type.startsWith('image/')) { setErr('Please pick an image file.'); return }
    if (file.size > 4 * 1024 * 1024) { setErr('Image must be under 4 MB.'); return }
    setErr('')
    const reader = new FileReader()
    reader.onload = () => setAvatar(reader.result as string)
    reader.readAsDataURL(file)
  }

  function validate() {
    if (!name.trim()) return 'Enter your full name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.'
    if (password.length < 8) return 'Password must be at least 8 characters.'
    return null
  }

  async function submit() {
    const v = validate()
    if (v) { setErr(v); return }
    setBusy(true); setErr(''); setExists(false)
    try {
      const data = await post('/users/register-personal', {
        name:          name.trim(),
        email:         email.trim().toLowerCase(),
        password,
        role,
        class_name:    cls.trim() || undefined,
        board:         board || undefined,
        avatar_base64: avatar || undefined,
      })
      const profile: AuthProfile = {
        id:            data.user?.id,
        name:          data.user?.name,
        // Trust the role the server actually persisted — falls back to the
        // form's selection so the new account lands on the right sidebar
        // even if the server returns a partial row.
        role:          data.user?.role || role,
        avatar_url:    data.user?.avatar_url,
        cls:           data.user?.class_name,
        board:         data.user?.board || board,
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
      }
      localStorage.setItem('kairo_token',   data.access_token)
      localStorage.setItem('kairo_refresh', data.refresh_token)
      localStorage.setItem('kairo_profile', JSON.stringify(profile))
      onLogin(profile)
    } catch (e: any) {
      const msg = (e.message || 'Something went wrong.').toLowerCase()
      // 409 — account already exists. Silently try to SIGN IN with the
      // same email + password. Same person, same creds → just log them in.
      if (msg.includes('already exists') || msg.includes('409')) {
        try {
          const { data: signed, error: signErr } = await supabase.auth.signInWithPassword({
            email:    email.trim().toLowerCase(),
            password,
          })
          if (signErr || !signed?.session) throw signErr || new Error('no session')

          // Success — fetch the profile row and continue as a normal login.
          const { data: userRow } = await supabase
            .from('users').select('id, name, role, school_id, avatar_url, class_name, board')
            .eq('id', signed.user!.id).maybeSingle()

          const profile: AuthProfile = {
            id:            signed.user!.id,
            name:          (userRow as any)?.name || name.trim(),
            // Preserve whatever role the DB already has — never silently
            // downgrade an existing teacher to a student.
            role:          (userRow as any)?.role || role,
            avatar_url:    (userRow as any)?.avatar_url,
            cls:           (userRow as any)?.class_name,
            board:         (userRow as any)?.board || board,
            access_token:  signed.session.access_token,
            refresh_token: signed.session.refresh_token,
          }
          localStorage.setItem('kairo_token',   signed.session.access_token)
          localStorage.setItem('kairo_refresh', signed.session.refresh_token)
          localStorage.setItem('kairo_profile', JSON.stringify(profile))
          onLogin(profile)
          return
        } catch {
          // Sign-in failed (wrong password). Show the "go to sign in" CTA.
          setErr('This email is already registered. Use the same password you signed up with, or tap "Sign In" below.')
          setExists(true)
          setBusy(false)
          return
        }
      }
      setErr(e.message || 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <Wizard back={onBack} step={null} title="Personal Sign Up" subtitle="Just for you — no school code needed.">
      <AvatarPicker avatar={avatar} onPick={handleAvatar} fallback={name} />
      <Field label="Full Name" icon={User}>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Aarav Verma" style={inp} />
      </Field>
      <Field label="Email" icon={Mail}>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inp} />
      </Field>
      <Field label="Create Password" icon={Lock}>
        <div style={{ position: 'relative' }}>
          <input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
            placeholder="min 8 characters" style={{ ...inp, paddingRight: 40 }} />
          <button onClick={() => setShow(s => !s)} type="button" style={eyeBtn}>
            {show ? <EyeOff size={14} color="#6B7280" /> : <Eye size={14} color="#6B7280" />}
          </button>
        </div>
      </Field>
      {/* Role picker — Student or Teacher. Defaults to Student. Without this
          every personal signup got silently registered as a student, which
          broke teachers signing up without a school code. */}
      <Field label="I am a..." icon={Users}>
        <div style={{ display: 'flex', gap: 8 }}>
          {([
            { id: 'student', label: 'Student', icon: GraduationCap, desc: 'I want to learn' },
            { id: 'teacher', label: 'Teacher', icon: BookOpen,      desc: 'I want to teach' },
          ] as const).map(opt => {
            const active = role === opt.id
            const Icon = opt.icon
            return (
              <button key={opt.id} type="button" onClick={() => setRole(opt.id)}
                style={{
                  flex: 1,
                  padding: '12px 14px', borderRadius: 11,
                  background: active ? 'rgba(79, 124, 255, 0.12)' : '#0E1117',
                  border: `1px solid ${active ? '#4F7CFF' : '#1f2532'}`,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'all 0.15s',
                }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: active ? 'linear-gradient(135deg,#4F7CFF,#2046C2)' : '#1a1f2e',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={14} color={active ? '#fff' : '#B1B5BA'} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: active ? '#A5B4FC' : '#fafafa' }}>{opt.label}</div>
                  <div style={{ fontSize: 10.5, color: '#9CA3AF', marginTop: 1 }}>{opt.desc}</div>
                </div>
              </button>
            )
          })}
        </div>
      </Field>
      <Field label="Class / Grade" icon={GraduationCap} hint={role === 'teacher' ? 'Optional — class you teach' : 'Optional — helps tailor content'}>
        <input value={cls} onChange={e => setCls(e.target.value)} placeholder="e.g. 9, 10A, Class 11" style={inp} />
      </Field>
      <Field label="Board" icon={BookOpen} hint="Optional — for syllabus matching">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {BOARDS.map(b => {
            const active = board === b
            return (
              <button key={b} type="button"
                onClick={() => setBoard(active ? '' : b)}
                style={{
                  padding: '7px 13px', borderRadius: 8,
                  background: active ? 'rgba(79, 124, 255, 0.12)' : '#0E1117',
                  border: `1px solid ${active ? '#4F7CFF' : '#1f2532'}`,
                  color: active ? '#A5B4FC' : '#B1B5BA',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                {b}
              </button>
            )
          })}
        </div>
      </Field>
      {err && <ErrLine msg={err} />}

      {resetSent ? (
        <div style={{
          padding: '14px 16px', borderRadius: 12,
          background: 'rgba(102, 217, 255, 0.10)',
          border: '1px solid rgba(102, 217, 255, 0.32)',
          color: '#A5B4FC', fontSize: 13, lineHeight: 1.55,
        }}>
          <strong style={{ color: '#fafafa' }}>Reset link sent ✓</strong>
          <br />
          Check <strong>{email}</strong> — click the link in the email, set a new password, then return here and sign in.
        </div>
      ) : exists ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <PrimaryBtn busy={busy} onClick={sendPasswordReset} icon={Mail}>Reset password via email</PrimaryBtn>
            <button onClick={onBack} type="button" style={{
              padding: '11px 16px', borderRadius: 10,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
              color: '#B1B5BA', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              <ArrowRight size={14} /> Go to Sign In
            </button>
          </div>
        </>
      ) : (
        <>
          <PrimaryBtn busy={busy} onClick={submit} icon={Sparkles}>Create my account</PrimaryBtn>
          <TermsAcceptLine action="creating an account" />
        </>
      )}
      <p style={{ fontSize: 11, color: '#6B7280', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
        Already have an account?{' '}
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: '#A5B4FC',
          fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0,
        }}>Sign in instead</button>
      </p>
    </Wizard>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Join School — 4-step wizard
// ════════════════════════════════════════════════════════════════════════════
function JoinSchool({ onLogin, onBack }: any) {
  const [step, setStep] = useState(1)
  const [code, setCode] = useState('')
  const [school, setSchool] = useState<any>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [role, setRole] = useState<'student' | 'teacher' | 'parent' | null>(null)
  const [avatar, setAvatar] = useState<string | null>(null)   // base64 data URL
  // Parent extras
  const [studentName, setStudentName] = useState('')
  const [parentCode, setParentCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  function handleAvatar(file: File | null) {
    if (!file) { setAvatar(null); return }
    if (!file.type.startsWith('image/')) { setErr('Please pick an image file.'); return }
    if (file.size > 4 * 1024 * 1024) { setErr('Image must be under 4 MB.'); return }
    setErr('')
    const reader = new FileReader()
    reader.onload = () => setAvatar(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function fetchSchool() {
    if (!code.trim()) { setErr('Enter the join code.'); return }
    setBusy(true); setErr('')
    try {
      const res = await fetch(`/api/schools/preview/${encodeURIComponent(code.trim().toUpperCase())}`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'School not found.')
      setSchool(d)
      setStep(2)
    } catch (e: any) { setErr(e.message) }
    finally { setBusy(false) }
  }

  async function submit() {
    setBusy(true); setErr('')
    try {
      if (role === 'parent') {
        // Parent: validate parent code (NOT the school join code)
        if (!parentCode.trim() || !studentName.trim()) {
          throw new Error('Enter the student\'s name and your access code.')
        }
        const data = await post('/parent/register', {
          name: name.trim(), email: email.trim(), password,
          access_code: parentCode.trim().toUpperCase(),
        })
        const profile: AuthProfile = {
          id: data.parent?.id, name: data.parent?.name, role: 'parent',
          school_id: data.school?.id, school_name: data.school?.school_name,
          school_logo_url: data.school?.school_logo_url,
          linked_student_id: data.linked_student?.id,
          linked_student_name: data.linked_student?.name,
          access_token: data.access_token, refresh_token: data.refresh_token,
        }
        localStorage.setItem('kairo_token',   data.access_token)
        localStorage.setItem('kairo_refresh', data.refresh_token)
        localStorage.setItem('kairo_profile', JSON.stringify(profile))
        onLogin(profile)
      } else {
        // Student / Teacher: standard register flow
        const data = await post('/users/register', {
          name: name.trim(), role, email: email.trim(), password,
          school_name: school.school_name, school_passcode: code.trim().toUpperCase(),
          avatar_base64: avatar || undefined,
        })
        const profile: AuthProfile = {
          id: data.user?.id, name: data.user?.name, role: data.user?.role,
          school_id: data.school?.id, school_name: data.school?.school_name,
          school_logo_url: data.school?.school_logo_url,
          access_token: data.access_token, refresh_token: data.refresh_token,
        }
        localStorage.setItem('kairo_token',   data.access_token)
        localStorage.setItem('kairo_refresh', data.refresh_token)
        localStorage.setItem('kairo_profile', JSON.stringify(profile))
        onLogin(profile)
      }
    } catch (e: any) { setErr(e.message); setBusy(false) }
  }

  // Step 1 — code entry
  if (step === 1) return (
    <Wizard back={onBack} step={1} of={4} title="Join School" subtitle="Enter the code your school gave you.">
      <Field label="School Join Code" icon={Key}>
        <input autoFocus value={code} onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && fetchSchool()}
          placeholder="XXXXXX-XXXXXX-XXXXXX"
          style={{ ...inp, fontFamily: 'monospace', letterSpacing: 2, textTransform: 'uppercase' }} />
      </Field>
      {err && <ErrLine msg={err} />}
      <PrimaryBtn busy={busy} onClick={fetchSchool} icon={ArrowRight}>Continue</PrimaryBtn>
    </Wizard>
  )

  // Step 2 — school preview + account
  if (step === 2) return (
    <Wizard
      back={() => setStep(1)} step={2} of={4}
      title="Account Setup" subtitle={`You're joining ${school.school_name}.`}>
      <SchoolPreview school={school} />

      {/* Avatar picker — circular, click to upload, x to remove */}
      <AvatarPicker avatar={avatar} onPick={handleAvatar} fallback={name} />

      <Field label="Full Name" icon={User}>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ananya Iyer" style={inp} />
      </Field>
      <Field label="Email" icon={Mail}>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inp} />
      </Field>
      <Field label="Create Password" icon={Lock}>
        <div style={{ position: 'relative' }}>
          <input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
            placeholder="min 8 characters" style={{ ...inp, paddingRight: 40 }} />
          <button onClick={() => setShow(s => !s)} type="button" style={eyeBtn}>
            {show ? <EyeOff size={14} color="#6B7280" /> : <Eye size={14} color="#6B7280" />}
          </button>
        </div>
      </Field>
      {err && <ErrLine msg={err} />}
      <PrimaryBtn
        busy={false}
        onClick={() => {
          if (!name.trim() || !email.trim() || password.length < 8) {
            setErr('Fill all fields. Password must be 8+ chars.'); return
          }
          setErr(''); setStep(3)
        }}
        icon={ArrowRight}>Continue</PrimaryBtn>
    </Wizard>
  )

  // Step 3 — pick role
  if (step === 3) return (
    <Wizard
      back={() => setStep(2)} step={3} of={4}
      title="I'm a..." subtitle="Pick your role at this school.">
      <SchoolPreview school={school} compact />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {ROLES.map(r => {
          const Icon = r.icon
          const active = role === r.id
          return (
            <motion.button key={r.id}
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
              onClick={() => setRole(r.id as any)}
              style={{
                padding: '14px 16px', borderRadius: 11,
                background: active ? 'rgba(79, 124, 255, 0.10)' : '#0E1117',
                border: `1px solid ${active ? '#4F7CFF' : '#1f2532'}`,
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
              <div style={{
                width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                background: active ? 'linear-gradient(135deg,#4F7CFF,#4F7CFF)' : '#1a1f2e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={16} color={active ? '#fff' : '#B1B5BA'} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: active ? '#A5B4FC' : '#fafafa' }}>{r.label}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{r.desc}</div>
              </div>
              {active && <Check size={16} color="#4F7CFF" />}
            </motion.button>
          )
        })}
      </div>

      <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(115,115,115,0.06)', border: '1px solid #1f2532', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Shield size={11} color="#9CA3AF" />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 }}>Note</span>
        </div>
        <p style={{ fontSize: 11, color: '#B1B5BA', margin: 0, lineHeight: 1.5 }}>
          Admin role is reserved for the school creator. Reach out to your school admin if you need elevated access.
        </p>
      </div>

      {err && <ErrLine msg={err} />}
      <PrimaryBtn
        busy={false}
        onClick={() => {
          if (!role) { setErr('Pick a role.'); return }
          setErr('')
          if (role === 'parent') setStep(4)
          else submit()
        }}
        icon={role === 'parent' ? ArrowRight : Sparkles}>
        {role === 'parent' ? 'Continue' : 'Create Account'}
      </PrimaryBtn>
      {role !== 'parent' && <TermsAcceptLine action="creating an account" />}
    </Wizard>
  )

  // Step 4 — parent linking
  return (
    <Wizard
      back={() => setStep(3)} step={4} of={4}
      title="Link to Your Child" subtitle="Get the access code from your child's Kairo app.">
      <Field label="Student's Name" icon={User} hint="As shown on report cards">
        <input autoFocus value={studentName} onChange={e => setStudentName(e.target.value)}
          placeholder="e.g. Ananya Iyer" style={inp} />
      </Field>
      <Field label="Parent Access Code" icon={Key} hint="8 characters, from your child's app">
        <input value={parentCode} onChange={e => setParentCode(e.target.value.toUpperCase())}
          placeholder="ABCD1234"
          style={{ ...inp, fontFamily: 'monospace', letterSpacing: 2, textTransform: 'uppercase' }} />
      </Field>
      {err && <ErrLine msg={err} />}
      <PrimaryBtn busy={busy} onClick={submit} icon={Sparkles}>Create Parent Account</PrimaryBtn>
      <TermsAcceptLine action="creating a parent account" />
    </Wizard>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Create School — 2-step wizard (payment removed; monetisation deferred)
// ════════════════════════════════════════════════════════════════════════════
function CreateSchool({ onLogin, onBack }: any) {
  const [step, setStep]           = useState(1)
  const [schoolName, setSchoolName] = useState('')
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [show, setShow]           = useState(false)
  const [busy, setBusy]           = useState(false)
  const [err, setErr]             = useState('')
  const [result, setResult]       = useState<any>(null)

  async function createSchool() {
    setBusy(true); setErr('')
    try {
      // 1. Create the school + admin account. The server signs the admin
      //    in SERVER-SIDE and returns the session tokens directly, so we
      //    don't need a separate supabase.auth.signInWithPassword call
      //    (which was 400-ing because of a race / auth-config mismatch).
      const data = await post('/schools/register', {
        school_name:    schoolName.trim(),
        school_email:   email.trim().toLowerCase(),
        owner_name:     name.trim(),
        owner_email:    email.trim().toLowerCase(),
        owner_password: password,
      })

      let access_token  = data.access_token  || null
      let refresh_token = data.refresh_token || null

      // 2. Fallback: if the server didn't return tokens (older deploy or
      //    sign-in failed server-side), try the legacy client-side sign-in.
      if (!access_token || !refresh_token) {
        try {
          const { data: signed } = await supabase.auth.signInWithPassword({
            email:    email.trim().toLowerCase(),
            password,
          })
          if (signed?.session) {
            access_token  = signed.session.access_token
            refresh_token = signed.session.refresh_token
          }
        } catch (e) {
          console.warn('[CreateSchool] client-side sign-in fallback failed:', e)
        }
      }

      // 3. Still no tokens? Walk the user to the sign-in screen with a
      //    friendly note — their school IS created, they just need to
      //    sign in manually. Better UX than a red error box.
      if (!access_token || !refresh_token) {
        setErr(`School created. Sign in with ${email} to access your dashboard.`)
        setBusy(false)
        return
      }

      setResult({
        passcode:      data.passcode,
        school_id:     data.school_id,
        access_token,
        refresh_token,
        owner_email:   email.trim().toLowerCase(),
        owner_name:    name.trim(),
        school_name:   schoolName.trim(),
      })
      setStep(3)
    } catch (e: any) { setErr(e.message); setBusy(false) }
  }

  function continueToDashboard() {
    if (!result) return
    const profile: AuthProfile = {
      id: '', name: result.owner_name, role: 'admin',
      school_id: result.school_id, school_name: result.school_name,
      access_token: result.access_token, refresh_token: result.refresh_token,
    }
    localStorage.setItem('kairo_token',   result.access_token)
    localStorage.setItem('kairo_refresh', result.refresh_token)
    localStorage.setItem('kairo_profile', JSON.stringify(profile))
    onLogin(profile)
  }

  if (step === 1) return (
    <Wizard back={onBack} step={1} of={2} title="Create School" subtitle="Let's set up your school on Kairo.">
      <Field label="School Name" icon={Building2}>
        <input autoFocus value={schoolName} onChange={e => setSchoolName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && schoolName.trim() && setStep(2)}
          placeholder="e.g. Delhi Public School, R.K. Puram" style={inp} />
      </Field>
      {err && <ErrLine msg={err} />}
      <PrimaryBtn busy={false} onClick={() => {
        if (!schoolName.trim()) { setErr('Enter your school\'s name.'); return }
        setErr(''); setStep(2)
      }} icon={ArrowRight}>Continue</PrimaryBtn>
    </Wizard>
  )

  if (step === 2) return (
    <Wizard back={() => setStep(1)} step={2} of={2} title="Owner Account" subtitle={`You'll be the admin of ${schoolName}.`}>
      <Field label="Your Name" icon={User}>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mrs. Priya Sharma" style={inp} />
      </Field>
      <Field label="Email" icon={Mail}>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@school.edu.in" style={inp} />
      </Field>
      <Field label="Create Password" icon={Lock}>
        <div style={{ position: 'relative' }}>
          <input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
            placeholder="min 8 characters" style={{ ...inp, paddingRight: 40 }} />
          <button onClick={() => setShow(s => !s)} type="button" style={eyeBtn}>
            {show ? <EyeOff size={14} color="#6B7280" /> : <Eye size={14} color="#6B7280" />}
          </button>
        </div>
      </Field>
      {err && <ErrLine msg={err} />}
      <PrimaryBtn busy={busy} onClick={() => {
        if (!name.trim() || !email.trim() || password.length < 8) {
          setErr('Fill all fields. Password must be 8+ chars.'); return
        }
        setErr(''); createSchool()
      }} icon={Sparkles}>Create School</PrimaryBtn>
      <TermsAcceptLine action="creating a school on Kairo" />
    </Wizard>
  )

  // Step 3 — passcode reveal (was step 4 before payment was removed)
  return (
    <Wizard back={null} step={null} title="School Created" subtitle="Save your join code somewhere safe.">
      <div style={{
        background: 'rgba(79, 124, 255, 0.08)', border: '1px solid rgba(79, 124, 255, 0.3)',
        borderRadius: 12, padding: 18, marginBottom: 16, textAlign: 'center',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
          Your School Join Code
        </div>
        <code style={{
          fontSize: 22, fontFamily: 'monospace', fontWeight: 800, color: '#fafafa',
          letterSpacing: 3, display: 'block', marginBottom: 8,
        }}>
          {result.passcode}
        </code>
        <button onClick={() => navigator.clipboard.writeText(result.passcode)}
          style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 11,
            background: 'rgba(79, 124, 255, 0.15)', border: '1px solid rgba(79, 124, 255, 0.3)',
            color: '#A5B4FC', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
          }}>
          Copy code
        </button>
      </div>

      <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(165, 180, 252, 0.06)', border: '1px solid rgba(165, 180, 252, 0.3)', marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: 1 }}>Free during launch</span>
        <p style={{ fontSize: 11, color: '#B1B5BA', margin: 0, marginTop: 4, lineHeight: 1.5 }}>
          Your school has full access — no payment required while Kairo is in early access. Share the join code with your teachers and students to bring them on board.
        </p>
      </div>

      <PrimaryBtn busy={false} onClick={continueToDashboard} icon={ArrowRight}>
        Open Admin Dashboard
      </PrimaryBtn>
    </Wizard>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Shared sub-components
// ════════════════════════════════════════════════════════════════════════════
function Wizard({ back, step, of, title, subtitle, children }: any) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        {back && (
          <button onClick={back} style={{
            width: 30, height: 30, borderRadius: 7, flexShrink: 0,
            background: '#151922', border: '1px solid #1f2532',
            color: '#B1B5BA', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ArrowLeft size={14} />
          </button>
        )}
        <div style={{ flex: 1 }}>
          {step !== null && (
            <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 }}>
              Step {step}{of ? ` of ${of}` : ''}
            </div>
          )}
          <h2 style={{ fontSize: 19, fontWeight: 700, color: '#fafafa', margin: 0 }}>{title}</h2>
          {subtitle && <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, marginTop: 2 }}>{subtitle}</p>}
        </div>
      </div>
      {step !== null && of && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {[...Array(of)].map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i < step ? '#4F7CFF' : '#1f2532',
            }} />
          ))}
        </div>
      )}
      {children}
    </div>
  )
}

function SchoolPreview({ school, compact = false }: { school: any; compact?: boolean }) {
  return (
    <div style={{
      padding: compact ? '10px 14px' : '14px 16px', borderRadius: 11,
      background: 'rgba(79, 124, 255, 0.06)', border: '1px solid rgba(79, 124, 255, 0.3)',
      display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
    }}>
      <div style={{
        width: compact ? 34 : 40, height: compact ? 34 : 40, borderRadius: 9, flexShrink: 0,
        background: school.school_logo_url ? '#fff' : 'linear-gradient(135deg,#4F7CFF,#4F7CFF)',
        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {school.school_logo_url
          ? <img src={school.school_logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Building2 size={18} color="#fff" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compact ? 12 : 13, fontWeight: 700, color: '#fafafa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {school.school_name}
        </div>
        <div style={{ fontSize: 10, color: '#A5B4FC', fontWeight: 600, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
          You're joining
        </div>
      </div>
      <Check size={16} color="#A5B4FC" />
    </div>
  )
}

function Field({ icon: Icon, label, hint, children }: any) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600,
        color: '#9CA3AF', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8,
      }}>
        <Icon size={11} color="#6B7280" />{label}
        {hint && <span style={{ color: '#4B5563', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 4 }}>· {hint}</span>}
      </label>
      {children}
    </div>
  )
}

function PrimaryBtn({ busy, onClick, icon: Icon, children }: any) {
  return (
    <motion.button whileHover={{ scale: busy ? 1 : 1.02 }} whileTap={{ scale: busy ? 1 : 0.97 }}
      onClick={onClick} disabled={busy}
      style={{
        width: '100%', marginTop: 6, padding: '13px', borderRadius: 11, border: 'none',
        background: busy ? '#1f2532' : 'linear-gradient(135deg, #4F7CFF, #4F7CFF)',
        color: busy ? '#6B7280' : '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
        cursor: busy ? 'not-allowed' : 'pointer',
        boxShadow: busy ? 'none' : '0 0 22px rgba(79, 124, 255, 0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
      {busy
        ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Please wait…</>
        : <>{Icon && <Icon size={14} />} {children}</>}
    </motion.button>
  )
}

function ErrLine({ msg }: { msg: string }) {
  return (
    <p style={{
      fontSize: 12, color: '#66D9FF', marginTop: -4, marginBottom: 12,
      padding: '8px 12px', background: 'rgba(102, 217, 255, 0.08)',
      border: '1px solid rgba(102, 217, 255, 0.25)', borderRadius: 7,
    }}>{msg}</p>
  )
}

function AvatarPicker({ avatar, onPick, fallback }: {
  avatar: string | null
  onPick: (file: File | null) => void
  fallback: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const initial = (fallback?.trim()?.charAt(0) || 'K').toUpperCase()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 14 }}>
      <div
        onClick={() => inputRef.current?.click()}
        style={{
          width: 90, height: 90, borderRadius: '50%', cursor: 'pointer',
          background: avatar ? 'transparent' : 'linear-gradient(135deg,#4F7CFF,#4F7CFF)',
          overflow: 'hidden', position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, fontWeight: 800, color: '#fff',
          border: '2px solid rgba(79, 124, 255, 0.14)',
          boxShadow: avatar ? '0 0 22px rgba(79, 124, 255, 0.3)' : 'none',
          transition: 'box-shadow 0.2s, border-color 0.2s',
        }}
      >
        {avatar
          ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initial}
        {/* Camera badge */}
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 26, height: 26, borderRadius: '50%',
          background: '#4F7CFF', border: '2px solid #0E1117',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11,
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => onPick(e.target.files?.[0] || null)} />

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={() => inputRef.current?.click()} style={{
          padding: '5px 11px', borderRadius: 6, border: '1px solid #1f2532',
          background: '#151922', color: '#B1B5BA', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
        }}>{avatar ? 'Change' : 'Upload photo'}</button>
        {avatar && (
          <button type="button" onClick={() => onPick(null)} style={{
            padding: '5px 11px', borderRadius: 6, border: '1px solid #1f2532',
            background: '#151922', color: '#9CA3AF', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 11,
          }}>Remove</button>
        )}
      </div>
      <p style={{ fontSize: 10, color: '#4B5563', marginTop: 8, textAlign: 'center' }}>
        Optional · max 4 MB · JPG/PNG/WebP
      </p>
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%', background: '#0E1117', border: '1px solid #1f2532',
  borderRadius: 9, padding: '11px 14px', fontSize: 14, color: '#fafafa',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

const eyeBtn: React.CSSProperties = {
  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
  background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex',
}
