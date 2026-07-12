import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ResetShell, { PrimaryButton, KairoBadge } from './ResetShell'
import PinDots from './PinDots'
import Keypad from './Keypad'
import { RC, FONT } from './shared'
import { setPendingPin, pinStrength, type PinStrength } from '../../lib/resetSession'

interface Props {
  onBack:     () => void
  onContinue: () => void
}

export default function Step3Create({ onBack, onContinue }: Props) {
  const [pin, setPin]       = useState('')
  const [busy, setBusy]     = useState(false)
  const [err, setErr]       = useState('')

  const strength = pin.length === 6 ? pinStrength(pin) : null

  async function continueIfValid() {
    if (pin.length !== 6) return
    if (strength === 'weak') {
      setErr('That code is too easy to guess. Mix more digits.')
      return
    }
    setErr(''); setBusy(true)
    await setPendingPin(pin)
    setBusy(false)
    onContinue()
  }

  useEffect(() => {
    if (pin.length === 6 && strength && strength !== 'weak') {
      const t = window.setTimeout(() => continueIfValid(), 280)
      return () => clearTimeout(t)
    }
    if (pin.length === 6 && strength === 'weak') {
      setErr('That code is too easy to guess. Mix more digits.')
    } else {
      if (err) setErr('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, strength])

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

  return (
    <ResetShell
      stepIndex={3} stepCount={5}
      onBack={onBack}
      logo={<KairoBadge />}
      title="Create a new passcode"
      subtitle="Choose 6 digits you'll remember. Avoid simple sequences."
      footer={
        <PrimaryButton onClick={continueIfValid} busy={busy} disabled={pin.length !== 6 || strength === 'weak'}>
          Continue
        </PrimaryButton>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <PinDots filled={pin.length} large shake={!!err} />

        <AnimatePresence>
          {pin.length > 0 && (
            <motion.div
              key={strength ?? 'typing'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              style={{ marginTop: 18 }}
            >
              <StrengthChip filled={pin.length} strength={strength} />
            </motion.div>
          )}
        </AnimatePresence>

        {err && (
          <div
            role="alert"
            style={{
              marginTop: 14, padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(102, 217, 255, 0.08)',
              border: `1px solid ${RC.borderHi}`,
              color: RC.purpleLite,
              fontFamily: FONT, fontSize: 12.5, fontWeight: 600,
              textAlign: 'center', maxWidth: 360,
            }}
          >
            {err}
          </div>
        )}

        <Keypad onDigit={handleDigit} onBackspace={handleBackspace} disabled={busy} />
      </div>
    </ResetShell>
  )
}

function StrengthChip({ filled, strength }: { filled: number; strength: PinStrength | null }) {
  const stages = filled < 6
    ? { label: `${filled} / 6`, color: RC.textFaint, fill: 0.4, accent: RC.border }
    : strength === 'weak'   ? { label: 'Weak',   color: RC.purpleLite, fill: 0.33, accent: RC.purpleLite }
    : strength === 'good'   ? { label: 'Good',   color: RC.purple,     fill: 0.66, accent: RC.purple }
    :                         { label: 'Strong', color: RC.purpleSoft, fill: 1.00, accent: RC.purpleSoft }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 16px', borderRadius: 999,
      background: 'rgba(102, 217, 255, 0.06)',
      border: `1px solid ${stages.accent}66`,
    }}>
      <div style={{
        width: 60, height: 4, borderRadius: 999,
        background: 'rgba(102, 217, 255, 0.18)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          width: `${stages.fill * 100}%`,
          background: stages.accent,
          borderRadius: 999,
          transition: 'width 0.28s ease, background 0.18s',
          boxShadow: `0 0 8px ${stages.accent}99`,
        }} />
      </div>
      <span style={{
        fontFamily: FONT, fontSize: 11, fontWeight: 700,
        letterSpacing: 1.6, textTransform: 'uppercase',
        color: stages.color,
      }}>
        {stages.label}
      </span>
    </div>
  )
}
