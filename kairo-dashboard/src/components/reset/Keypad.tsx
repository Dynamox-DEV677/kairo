/**
 * Keypad — large-tap numeric pad for PIN entry.
 *
 *   1 2 3
 *   4 5 6
 *   7 8 9
 *     0 ⌫
 *
 * Every key 72×72, ample gap, soft purple ripple on press.
 */
import { motion } from 'framer-motion'
import { Delete } from 'lucide-react'
import { RC, FONT } from './shared'

interface Props {
  onDigit:    (d: string) => void
  onBackspace: () => void
  /** Disable while busy / loading. */
  disabled?:   boolean
}

const ROWS: Array<Array<string | 'space' | 'back'>> = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['space', '0', 'back'],
]

export default function Keypad({ onDigit, onBackspace, disabled = false }: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 14,
        maxWidth: 360,
        margin: '20px auto 0',
        padding: '0 4px',
      }}
    >
      {ROWS.flat().map((cell, i) => {
        if (cell === 'space') return <div key={`empty-${i}`} />
        if (cell === 'back') {
          return (
            <KeypadButton key="back" onClick={onBackspace} disabled={disabled}>
              <Delete size={26} color={RC.text} strokeWidth={2} />
            </KeypadButton>
          )
        }
        return (
          <KeypadButton key={cell} onClick={() => onDigit(cell)} disabled={disabled}>
            <span style={{
              fontFamily: FONT,
              fontSize: 28, fontWeight: 700,
              color: RC.text, letterSpacing: -0.5,
            }}>
              {cell}
            </span>
          </KeypadButton>
        )
      })}
    </div>
  )
}

function KeypadButton({ children, onClick, disabled }: {
  children: React.ReactNode
  onClick: () => void
  disabled: boolean
}) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.93 }}
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: 72,
        borderRadius: 22,
        border: `1px solid ${RC.border}`,
        background: 'rgba(102, 217, 255, 0.06)',
        color: RC.text,
        display: 'grid', placeItems: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        WebkitTapHighlightColor: 'transparent',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 0.15s',
      }}
      onMouseDown={e => !disabled && (e.currentTarget.style.background = 'rgba(102, 217, 255, 0.20)')}
      onMouseUp={e => !disabled && (e.currentTarget.style.background = 'rgba(102, 217, 255, 0.06)')}
      onMouseLeave={e => !disabled && (e.currentTarget.style.background = 'rgba(102, 217, 255, 0.06)')}
    >
      {children}
    </motion.button>
  )
}
