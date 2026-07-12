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
  onClose:        () => void
  onBackToSignIn?: () => void
  initialEmail?:  string
}

export default function ResetPasscode({ onClose, onBackToSignIn, initialEmail }: Props) {
  const [step, setStepLocal] = useState<Step>(() => {
    const s = getStep()
    if (s === 'verify' && !getEmail()) return 'forgot'
    if ((s === 'create' || s === 'confirm') && !isVerified()) return 'forgot'
    return s
  })

  const [devOtp, setDevOtp] = useState<string | undefined>(undefined)

  useEffect(() => { saveStep(step) }, [step])

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
