import { motion } from 'framer-motion'
import { RC } from './shared'

interface Props {
  filled: number
  length?: number
  shake?: boolean
  large?: boolean
}

export default function PinDots({ filled, length = 6, shake = false, large = false }: Props) {
  const size = large ? 18 : 14
  const gap  = large ? 18 : 14
  return (
    <div
      className={shake ? 'rs-shake' : ''}
      style={{
        display: 'flex', justifyContent: 'center',
        gap, padding: '8px 0 4px',
      }}
    >
      {Array.from({ length }).map((_, i) => {
        const active = i < filled
        const isMostRecent = i === filled - 1
        return (
          <motion.div
            key={i}
            animate={isMostRecent ? { scale: [1, 1.35, 1] } : { scale: 1 }}
            transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
            style={{
              width: size, height: size, borderRadius: '50%',
              background: active
                ? 'radial-gradient(circle at 30% 30%, #DBE7FF, #4F7CFF 80%)'
                : 'transparent',
              border: active
                ? '1px solid rgba(165, 180, 252, 0.7)'
                : `1.5px solid ${RC.border}`,
              boxShadow: active
                ? '0 0 14px rgba(102, 217, 255, 0.6), inset 0 0 6px rgba(255,255,255,0.25)'
                : 'none',
              transition: 'background 0.18s, border-color 0.18s',
            }}
          />
        )
      })}
    </div>
  )
}
