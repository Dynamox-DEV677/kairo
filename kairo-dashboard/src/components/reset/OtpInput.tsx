import { useEffect, useRef } from 'react'
import { RC, FONT } from './shared'

interface Props {
  value:        string
  onChange:     (next: string) => void
  onComplete?:  (final: string) => void
  shake?:       boolean
  disabled?:    boolean
  length?:      number
  accent?:      string
}

export default function OtpInput({
  value, onChange, onComplete, shake, disabled = false, length = 6, accent,
}: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    const first = Math.min(value.length, length - 1)
    refs.current[first]?.focus()
  }, [])

  function handleInput(idx: number, raw: string) {
    if (disabled) return
    const digits = raw.replace(/\D/g, '').slice(0, length - idx)
    if (digits.length === 0) {
      const next = value.substring(0, idx) + value.substring(idx + 1)
      onChange(next)
      return
    }
    const before = value.substring(0, idx)
    const next   = (before + digits).slice(0, length)
    onChange(next)
    const focusIdx = Math.min(idx + digits.length, length - 1)
    refs.current[focusIdx]?.focus()
    if (next.length === length) onComplete?.(next)
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (value[idx]) {
        const next = value.substring(0, idx) + value.substring(idx + 1)
        onChange(next)
      } else if (idx > 0) {
        const next = value.substring(0, idx - 1) + value.substring(idx)
        onChange(next)
        refs.current[idx - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      refs.current[idx - 1]?.focus()
    } else if (e.key === 'ArrowRight' && idx < length - 1) {
      refs.current[idx + 1]?.focus()
    }
  }

  function handlePaste(idx: number, e: React.ClipboardEvent<HTMLInputElement>) {
    if (disabled) return
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    e.preventDefault()
    onChange(pasted)
    const focusIdx = Math.min(pasted.length, length - 1)
    refs.current[focusIdx]?.focus()
    if (pasted.length === length) onComplete?.(pasted)
  }

  const border = accent || RC.borderHi

  return (
    <div
      className={shake ? 'rs-shake' : ''}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))`,
        gap: 'clamp(6px, 2vw, 12px)',
        maxWidth: 360,
        margin: '12px auto 0',
      }}
    >
      {Array.from({ length }).map((_, i) => {
        const ch = value[i] || ''
        const filled = !!ch
        return (
          <input
            key={i}
            ref={el => (refs.current[i] = el)}
            value={ch}
            onChange={e => handleInput(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={e => handlePaste(i, e)}
            onFocus={e => e.currentTarget.select()}
            disabled={disabled}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={length}
            type="tel"
            aria-label={`Digit ${i + 1}`}
            style={{
              aspectRatio: '1 / 1',
              width: '100%',
              borderRadius: 16,
              border: `2px solid ${filled ? border : RC.border}`,
              background: filled ? 'rgba(102, 217, 255, 0.10)' : 'rgba(255, 255, 255, 0.02)',
              boxShadow: filled ? '0 0 18px rgba(102, 217, 255, 0.35)' : 'none',
              color: RC.text,
              fontFamily: FONT,
              fontSize: 'clamp(22px, 7vw, 30px)',
              fontWeight: 700,
              textAlign: 'center',
              outline: 'none',
              caretColor: RC.purpleLite,
              transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
              WebkitAppearance: 'none',
              MozAppearance: 'textfield',
              opacity: disabled ? 0.5 : 1,
            }}
          />
        )
      })}
    </div>
  )
}
