/**
 * /reset-password?token=... — landing page reached from the password-reset
 * email. POSTs the token + new password to /api/users/reset-password and
 * walks the user back to sign-in on success.
 *
 * No router — App.tsx detects the path and renders this directly.
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react'
import { post } from '../lib/api'

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif"

interface Props {
  /** Called after a successful reset OR a "back to sign in" click. */
  onDone: () => void
}

export default function ResetPasswordPage({ onDone }: Props) {
  // Pull the JWT token out of the URL
  const [token] = useState(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('token') || ''
  })

  const [password, setPassword]       = useState('')
  const [confirm, setConfirm]         = useState('')
  const [show, setShow]               = useState(false)
  const [busy, setBusy]               = useState(false)
  const [err, setErr]                 = useState('')
  const [done, setDone]               = useState(false)

  // If we land here without a token, surface the error immediately.
  useEffect(() => {
    if (!token) setErr('No reset token in the link. Open the email again and tap the button.')
  }, [token])

  async function submit() {
    if (busy) return
    if (!token) { setErr('Reset link is invalid. Request a new one from the sign-in screen.'); return }
    if (password.length < 8) { setErr('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setErr('The two passwords don\'t match.'); return }

    setBusy(true); setErr('')
    try {
      await post('/users/reset-password', { token, password })
      setDone(true)
      // Strip the token from the URL so refresh doesn't try again with a burned token.
      try { window.history.replaceState({}, '', '/') } catch {}
    } catch (e: any) {
      setErr(e.message || 'Could not reset your password. Try requesting a new link.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      height: '100dvh', minHeight: '100vh', background: '#050505',
      fontFamily: FONT,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', top: '15%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79, 124, 255, 0.10) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 460, padding: '28px 20px 48px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <img src="/kairo_logo.png" alt="Kairo"
            style={{
              width: 64, height: 64, borderRadius: 16, objectFit: 'contain',
              margin: '0 auto 14px', display: 'block',
              filter: 'drop-shadow(0 0 20px rgba(79, 124, 255, 0.03))',
            }} />
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fafafa', margin: 0, letterSpacing: '-0.5px' }}>kairo</h1>
          <p style={{ fontSize: 11, color: '#4F7CFF', fontWeight: 700, letterSpacing: 4, marginTop: 4, textTransform: 'uppercase' }}>
            Password Reset
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#0E1117', border: '1px solid #1f2532', borderRadius: 18,
          padding: 24, position: 'relative',
        }}>
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div key="done"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 280, damping: 26 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px',
                  background: 'linear-gradient(135deg, rgba(102, 217, 255, 0.18), rgba(79, 124, 255, 0.08))',
                  border: '1px solid rgba(102, 217, 255, 0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CheckCircle2 size={26} color="#A5B4FC" />
                </div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fafafa', textAlign: 'center' }}>
                  Password updated
                </h2>
                <p style={{ margin: '10px 0 22px', fontSize: 13, color: '#B1B5BA', textAlign: 'center', lineHeight: 1.55 }}>
                  Your new password is active. Sign in below to continue learning.
                </p>
                <button
                  onClick={onDone}
                  style={ctaStyle}>
                  Go to sign in
                  <ArrowRight size={14} />
                </button>
              </motion.div>
            ) : (
              <motion.div key="form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}>
                <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#fafafa' }}>
                  Set a new password
                </h2>
                <p style={{ margin: '4px 0 22px', fontSize: 12.5, color: '#9CA3AF' }}>
                  Pick a password you'll remember — at least 8 characters.
                </p>

                <Field label="New password">
                  <div style={{ position: 'relative' }}>
                    <input
                      autoFocus
                      type={show ? 'text' : 'password'}
                      value={password}
                      onChange={e => { setPassword(e.target.value); if (err) setErr('') }}
                      onKeyDown={e => e.key === 'Enter' && submit()}
                      placeholder="min 8 characters"
                      style={{ ...inp, paddingRight: 40 }}
                    />
                    <button type="button" onClick={() => setShow(s => !s)} style={eyeBtn}>
                      {show ? <EyeOff size={14} color="#6B7280" /> : <Eye size={14} color="#6B7280" />}
                    </button>
                  </div>
                </Field>

                <Field label="Confirm new password">
                  <input
                    type={show ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); if (err) setErr('') }}
                    onKeyDown={e => e.key === 'Enter' && submit()}
                    placeholder="re-type it"
                    style={inp}
                  />
                </Field>

                {err && (
                  <div role="alert" style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '10px 12px', borderRadius: 9,
                    background: 'rgba(102, 217, 255, 0.08)',
                    border: '1px solid rgba(102, 217, 255, 0.25)',
                    color: '#A5B4FC', fontSize: 12, lineHeight: 1.55,
                    marginTop: 4, marginBottom: 12,
                  }}>
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{err}</span>
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: busy ? 1 : 1.02 }}
                  whileTap={{ scale: busy ? 1 : 0.97 }}
                  onClick={submit}
                  disabled={busy || !token}
                  style={{ ...ctaStyle, opacity: busy ? 0.6 : 1 }}>
                  {busy
                    ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Updating…</>
                    : <><Lock size={14} /> Reset password</>}
                </motion.button>

                <p style={{ fontSize: 11, color: '#6B7280', textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>
                  Changed your mind?{' '}
                  <button onClick={onDone} style={{
                    background: 'none', border: 'none', color: '#A5B4FC',
                    fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0,
                  }}>Back to sign in</button>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p style={{ fontSize: 10.5, color: '#4B5563', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
          Reset links expire 30 minutes after they're sent.
          <br />
          If yours has expired, request a new one from the sign-in screen.
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600,
        color: '#9CA3AF', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8,
      }}>
        {label}
      </label>
      {children}
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

const ctaStyle: React.CSSProperties = {
  width: '100%', marginTop: 6, padding: '13px', borderRadius: 11, border: 'none',
  background: 'linear-gradient(135deg, #4F7CFF, #2046C2)',
  color: '#fff', fontFamily: FONT, fontSize: 14, fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 0 22px rgba(79, 124, 255, 0.03)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
}
