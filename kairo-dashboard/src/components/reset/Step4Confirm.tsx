import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import ResetShell, { PrimaryButton, TextButton, KairoBadge } from './ResetShell'
import PinDots from './PinDots'
import Keypad from './Keypad'
import { RC, FONT } from './shared'
import { confirmPin, commitNewPasscode } from '../../lib/resetSession'

interface Props {
  onBack:     () => void
  onContinue: () => void
}

export default function Step4Confirm({ onBack, onContinue }: Props) {
  const [pin, setPin]     = useState('')
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState('')
  const [shake, setShake] = useState(false)
  const [tries, setTries] = useState(0)

  function handleDigit(d: string) {
    if (pin.length >= 6 || busy) return
    setPin(prev => (prev + d).slice(0, 6))
    try { if ('vibrate' in navigator) (navigator as any).vibrate(8) } catch {  }
  }
  function handleBackspace() {
    if (busy) return
    setPin(prev => prev.slice(0, -1))
    setErr('')
    try { if ('vibrate' in navigator) (navigator as any).vibrate(6) } catch {  }
  }

  async function attempt() {
    setBusy(true)
    const ok = await confirmPin(pin)
    if (!ok) {
      setShake(true)
      setErr("Passcodes don't match.")
      window.setTimeout(() => setShake(false), 600)
      window.setTimeout(() => setPin(''), 460)
      setTries(t => t + 1)
      setBusy(false)
      try { if ('vibrate' in navigator) (navigator as any).vibrate([0, 50, 50, 50]) } catch {  }
      return
    }
    await commitNewPasscode(pin)
    setBusy(false)
    onContinue()
  }

  useEffect(() => {
    if (pin.length === 6 && !busy) {
      const t = window.setTimeout(attempt, 280)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  return (
    <ResetShell
      stepIndex={4} stepCount={5}
      onBack={onBack}
      logo={<KairoBadge />}
      title="Confirm your passcode"
      subtitle="Enter the same 6 digits again to lock it in."
      footer={
        <>
          <PrimaryButton
            onClick={attempt}
            busy={busy}
            disabled={pin.length !== 6}
          >
            Confirm
          </PrimaryButton>
          {tries >= 2 && (
            <TextButton onClick={onBack}>
              Forgot the new code? Re-enter it
            </TextButton>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <PinDots filled={pin.length} large shake={shake} />

        {err && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            role="alert"
            style={{
              marginTop: 18, padding: '10px 16px',
              borderRadius: 12,
              background: 'rgba(165, 180, 252, 0.10)',
              border: `1px solid ${RC.borderHi}`,
              color: RC.purpleLite,
              fontFamily: FONT, fontSize: 13, fontWeight: 700,
              letterSpacing: 0.2, textAlign: 'center',
            }}
          >
            {err}
          </motion.div>
        )}

        <Keypad onDigit={handleDigit} onBackspace={handleBackspace} disabled={busy} />
      </div>
    </ResetShell>
  )
}
