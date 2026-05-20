/**
 * Step 1 — Forgot passcode.
 *
 * The user enters their email; we save it to the reset session and
 * send the first OTP, then advance to step 2.
 */
import { useState } from 'react'
import { Mail } from 'lucide-react'
import ResetShell, { PrimaryButton, TextButton, KairoBadge } from './ResetShell'
import { RC, FONT } from './shared'
import {
  emailValid, setEmail as saveEmail, sendOtp,
} from '../../lib/resetSession'

interface Props {
  initialEmail?: string
  onContinue:    (devOtp?: string) => void
  onBackToSignIn: () => void
}

export default function Step1Forgot({ initialEmail = '', onContinue, onBackToSignIn }: Props) {
  const [email, setEmail] = useState(initialEmail)
  const [err, setErr]     = useState('')
  const [busy, setBusy]   = useState(false)

  async function submit() {
    if (!emailValid(email)) {
      setErr('Enter a valid email address.')
      return
    }
    setErr(''); setBusy(true)
    saveEmail(email)

    const r = await sendOtp()
    setBusy(false)

    if (!r.ok) {
      if (r.reason === 'rate-limited') {
        setErr(`Try again in ${r.cooldown}s — too many requests.`)
      } else if (r.reason === 'no-email') {
        setErr('Email is required.')
      } else {
        setErr('Something went wrong. Try again.')
      }
      return
    }
    onContinue(r.dev_otp)
  }

  return (
    <ResetShell
      stepIndex={1} stepCount={5}
      logo={<KairoBadge />}
      title="Forgot your passcode?"
      subtitle="Reset access securely and continue learning."
      footer={
        <>
          <PrimaryButton onClick={submit} busy={busy} disabled={!email.trim()}>
            Continue
          </PrimaryButton>
          <TextButton onClick={onBackToSignIn}>
            Back to sign in
          </TextButton>
        </>
      }
    >
      {/* Email input */}
      <label
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px', marginTop: 6,
          borderRadius: 20,
          background: 'rgba(102, 217, 255, 0.05)',
          border: `1.5px solid ${err ? RC.purple : RC.border}`,
          boxShadow: err ? '0 0 18px rgba(102, 217, 255, 0.25)' : 'none',
          transition: 'border-color 0.18s, box-shadow 0.18s',
        }}
      >
        <Mail size={18} color={RC.purpleLite} />
        <input
          autoFocus
          type="email"
          inputMode="email"
          autoComplete="email"
          enterKeyHint="go"
          value={email}
          onChange={e => { setEmail(e.target.value); if (err) setErr('') }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="you@example.com"
          style={{
            flex: 1, minWidth: 0,
            background: 'transparent', border: 'none', outline: 'none',
            color: RC.text, fontFamily: FONT,
            fontSize: 16, fontWeight: 500,
            letterSpacing: 0.1,
            padding: '4px 0',
          }}
        />
      </label>

      {err && (
        <div
          role="alert"
          style={{
            marginTop: 14, padding: '12px 16px',
            borderRadius: 14,
            background: 'rgba(102, 217, 255, 0.08)',
            border: `1px solid ${RC.borderHi}`,
            color: RC.purpleLite,
            fontFamily: FONT, fontSize: 13, fontWeight: 600,
            textAlign: 'center', lineHeight: 1.45,
          }}
        >
          {err}
        </div>
      )}

      <p style={{
        marginTop: 22,
        fontFamily: FONT, fontSize: 12.5, lineHeight: 1.55,
        color: RC.textFaint, textAlign: 'center',
        padding: '0 16px',
      }}>
        We'll send a 6-digit code to your inbox. No personal data ever leaves
        your device beyond what's needed to deliver this email.
      </p>
    </ResetShell>
  )
}
