/**
 * ResetPasscode — the full mobile-first Kyno passcode reset flow.
 *
 *   step 1  forgot   email entry
 *   step 2  verify   6-digit OTP
 *   step 3  create   new 6-digit PIN + strength meter
 *   step 4  confirm  re-enter PIN + shake on mismatch
 *   step 5  success  animated check
 *
 * State persists across refresh in localStorage via src/lib/resetSession.ts
 * so a half-completed reset survives an accidental tab close.
 *
 * Mounted as a full-screen overlay (position: fixed) — there's no host
 * page layout to negotiate. Background is its own scene.
 */
import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'

import Step1Forgot   from '../components/reset/Step1Forgot'
import Step2Verify   from '../components/reset/Step2Verify'
import Step3Create   from '../components/reset/Step3Create'
import Step4Confirm  from '../components/reset/Step4Confirm'
import Step5Success  from '../components/reset/Step5Success'

import {
  getStep, setStep as saveStep, getEmail, isVerified, endSession,
  type Step,
} from '../lib/resetSession'

interface Props {
  /** Called when the user backs out of step 1 or completes the flow. */
  onClose:        () => void
  /** Called when user taps "Back to sign in" on step 1 (separate from cancel). */
  onBackToSignIn?: () => void
  /** Pre-fill the email field (e.g. from a sign-in screen). */
  initialEmail?:  string
}

export default function ResetPasscode({ onClose, onBackToSignIn, initialEmail }: Props) {
  // Restore from localStorage so a refresh mid-flow lands you where you were.
  const [step, setStepLocal] = useState<Step>(() => {
    const s = getStep()
    // If the session is in 'verify' but the OTP was never verified AND we
    // have no email on file, fall back to 'forgot'. If user is in 'create'
    // / 'confirm' but never verified, reset too.
    if (s === 'verify' && !getEmail()) return 'forgot'
    if ((s === 'create' || s === 'confirm') && !isVerified()) return 'forgot'
    return s
  })

  // Dev-OTP surfacing — survives the trip from step 1 → step 2.
  const [devOtp, setDevOtp] = useState<string | undefined>(undefined)

  // Persist every step change
  useEffect(() => { saveStep(step) }, [step])

  // Lock body scroll while the overlay is visible
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  function go(next: Step) { setStepLocal(next) }

  function handleBackToSignIn() {
    endSession()
    if (onBackToSignIn) onBackToSignIn()
    else onClose()
  }

  function handleSuccessContinue() {
    endSession()
    onClose()
  }

  return (
    <AnimatePresence mode="wait">
      {step === 'forgot' && (
        <Step1Forgot
          key="forgot"
          initialEmail={initialEmail}
          onContinue={(otp) => { setDevOtp(otp); go('verify') }}
          onBackToSignIn={handleBackToSignIn}
        />
      )}
      {step === 'verify' && (
        <Step2Verify
          key="verify"
          devOtp={devOtp}
          onBack={() => go('forgot')}
          onContinue={() => go('create')}
        />
      )}
      {step === 'create' && (
        <Step3Create
          key="create"
          onBack={() => go('verify')}
          onContinue={() => go('confirm')}
        />
      )}
      {step === 'confirm' && (
        <Step4Confirm
          key="confirm"
          onBack={() => go('create')}
          onContinue={() => go('success')}
        />
      )}
      {step === 'success' && (
        <Step5Success
          key="success"
          onContinue={handleSuccessContinue}
        />
      )}
    </AnimatePresence>
  )
}
