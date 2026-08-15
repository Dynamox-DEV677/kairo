import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import ResetShell, { PrimaryButton, TextButton, KairoBadge } from './ResetShell'
import OtpInput from './OtpInput'
import { RC, FONT } from './shared'
import {
  getEmail, sendOtp, verifyOtp, resendCooldown,
} from '../../lib/resetSession'

interface Props {
  devOtp?:       string
  onBack:        () => void
  onContinue:    () => void
}

export default function Step2Verify({ devOtp, onBack, onContinue }: Props) {
  const email = getEmail()
  const [code, setCode]       = useState('')
  const [busy, setBusy]       = useState(false)
  const [err, setErr]         = useState('')
  const [shake, setShake]     = useState(false)
  const [cooldown, setCooldown] = useState(resendCooldown())
  const [lastDevOtp, setLastDevOtp] = useState<string | undefined>(devOtp)
  const tickRef = useRef<number | null>(null)

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    tickRef.current = window.setInterval(() => {
      setCooldown(resendCooldown())
    }, 1000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [])

  async function attemptVerify(value: string) {
    setBusy(true); setErr('')
    const r = await verifyOtp(value)
    setBusy(false)
    if (!r.ok) {
      const msg =
        r.reason === 'expired'  ? 'This code has expired. Tap Resend to get a new one.'
        : r.reason === 'no-otp' ? 'No code on file. Go back and request a new one.'
        : r.reason === 'network' ? 'Network error — try again in a moment.'
        :                         'Incorrect verification code.'
      setErr(msg)
      setShake(true)
      window.setTimeout(() => setShake(false), 600)
      setCode('')
      return
    }
    onContinue()
  }

  async function handleResend() {
    if (cooldown > 0 || busy) return
    setErr(''); setBusy(true)
    const r = await sendOtp()
    setBusy(false)
    if (!r.ok) {
      setErr(r.reason === 'rate-limited'
        ? `Slow down — try again in ${r.cooldown}s.`
        : 'Could not resend right now.')
      return
    }
    setCode('')
    setCooldown(r.cooldown)
    if (r.dev_otp) setLastDevOtp(r.dev_otp)
  }

  return (
    <ResetShell
      stepIndex={2} stepCount={5}
      onBack={onBack}
      logo={<KairoBadge />}
      title="Check your inbox"
      subtitle={`We sent a 6-digit code to ${email || 'your email'}.`}
      footer={
        <>
          <PrimaryButton
            onClick={() => attemptVerify(code)}
            busy={busy}
            disabled={code.length !== 6}
          >
            Verify code
          </PrimaryButton>
          <TextButton
            onClick={handleResend}
            disabled={cooldown > 0 || busy}
          >
            {cooldown > 0
              ? `Resend in ${cooldown}s`
              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <RefreshCw size={13} /> Resend code
                </span>}
          </TextButton>
        </>
      }
    >
      <OtpInput
        value={code}
        onChange={(v) => { setCode(v); if (err) setErr('') }}
        onComplete={(v) => attemptVerify(v)}
        shake={shake}
        disabled={busy}
      />

      {err && (
        <div
          role="alert"
          style={{
            marginTop: 18, padding: '12px 16px',
            borderRadius: 14,
            background: 'rgba(165, 180, 252, 0.08)',
            border: `1px solid ${RC.borderHi}`,
            color: RC.purpleLite,
            fontFamily: FONT, fontSize: 13.5, fontWeight: 600,
            textAlign: 'center', lineHeight: 1.45,
          }}
        >
          {err}
        </div>
      )}

      {lastDevOtp && (
        <button className="kyno-ghost"
          onClick={() => setCode(lastDevOtp)}
          style={{
            marginTop: 18, width: '100%',
            padding: '10px 14px',
            background: 'rgba(165, 180, 252, 0.06)',
            border: `1px dashed ${RC.border}`,
            borderRadius: 12,
            color: RC.textDim,
            fontFamily: FONT, fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span>DEV · tap to fill</span>
          <span style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: 16, letterSpacing: 4,
            color: RC.purpleLite, fontWeight: 700,
          }}>
            {lastDevOtp}
          </span>
        </button>
      )}

      <p style={{
        marginTop: 22,
        fontFamily: FONT, fontSize: 12, lineHeight: 1.55,
        color: RC.textFaint, textAlign: 'center',
      }}>
        Didn't get the email? Check spam, or use the resend button below.
      </p>
    </ResetShell>
  )
}
