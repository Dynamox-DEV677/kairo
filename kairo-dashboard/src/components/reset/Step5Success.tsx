/**
 * Step 5 — Success.
 *
 * Animated check + halo + soft particle burst.
 *  "Passcode reset complete"
 *  "Kora is ready."
 *  [ Continue to Kora ]
 */
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import ResetShell, { PrimaryButton } from './ResetShell'
import { RC, FONT } from './shared'

interface Props {
  onContinue: () => void
}

export default function Step5Success({ onContinue }: Props) {
  // Auto-continue after 6 s as a safety net
  useEffect(() => {
    const t = window.setTimeout(onContinue, 6000)
    return () => clearTimeout(t)
  }, [onContinue])

  return (
    <ResetShell
      stepIndex={5} stepCount={5}
      logo={null}
      title="Passcode reset complete"
      subtitle="Kora is ready."
      footer={
        <PrimaryButton onClick={onContinue}>
          Continue to Kora
        </PrimaryButton>
      }
    >
      <div style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 10, marginBottom: 24,
        height: 220,
      }}>
        {/* Particle ring — 12 sparks pulsing outward */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * Math.PI * 2
          const dist  = 90
          const dx    = Math.cos(angle) * dist
          const dy    = Math.sin(angle) * dist
          return (
            <motion.div
              key={i}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
              animate={{ x: dx, y: dy, opacity: [0, 1, 0], scale: [0, 1.2, 0.7] }}
              transition={{ duration: 1.2, delay: 0.1 + i * 0.03, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                width: 8, height: 8, borderRadius: '50%',
                background: i % 3 === 0 ? RC.purpleSoft : i % 3 === 1 ? RC.purpleLite : RC.purple,
                boxShadow: `0 0 12px ${RC.purpleLite}`,
              }}
            />
          )
        })}

        {/* Halo */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          style={{
            position: 'absolute', inset: 0,
            display: 'grid', placeItems: 'center',
          }}
        >
          <div style={{
            width: 220, height: 220, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(79, 124, 255, 0.32) 0%, transparent 70%)',
            filter: 'blur(20px)',
          }} />
        </motion.div>

        {/* The check itself */}
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.15 }}
          style={{
            position: 'relative',
            width: 130, height: 130, borderRadius: '50%',
            background: 'linear-gradient(135deg, #A5B4FC 0%, #4F7CFF 100%)',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 24px 60px rgba(79, 124, 255, 0.03), inset 0 1px 0 rgba(255,255,255,0.25)',
          }}
        >
          {/* Inner ring */}
          <div style={{
            position: 'absolute', inset: -6, borderRadius: '50%',
            border: '2px solid rgba(165, 180, 252, 0.50)',
            pointerEvents: 'none',
          }} />
          <Check size={62} color="#000" strokeWidth={3.4} />
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        style={{
          marginTop: 0,
          fontFamily: FONT, fontSize: 13.5, lineHeight: 1.55,
          color: RC.textFaint, textAlign: 'center',
          padding: '0 12px',
        }}
      >
        Your new 6-digit passcode is saved. Use it next time Kora asks
        you to unlock.
      </motion.p>
    </ResetShell>
  )
}
