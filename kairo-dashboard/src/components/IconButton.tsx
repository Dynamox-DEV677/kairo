import type { ReactNode, CSSProperties } from 'react'

/**
 * A square, tappable icon control.
 *
 * The Formula Sheet's copy button measured 18.7 x 44px — a 19px-wide target
 * that read as a sliver rather than a button, and it sat outside the card on
 * two edges because it was placed in a flex row with `padding: 2` and nothing
 * holding its width.
 *
 * 44x44 is the floor for a touch target on a phone. This component exists so
 * the next icon button cannot be smaller: the size is not a prop you can pass
 * a 2 to.
 */
export default function IconButton({
  children,
  onClick,
  title,
  active = false,
  size = 44,
  style,
}: {
  children: ReactNode
  onClick?: () => void
  /** also used as the accessible name — an icon alone has none */
  title: string
  active?: boolean
  /** 44 is the minimum. Smaller is refused. */
  size?: number
  style?: CSSProperties
}) {
  const side = Math.max(44, size)

  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        width: side,
        height: side,
        flexShrink: 0,          // a flex row must never squeeze it thin
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--r-sm)',
        border: '1px solid rgba(255,255,255,0.08)',
        background: active ? 'rgba(124,92,255,0.16)' : 'rgba(255,255,255,0.04)',
        color: active ? '#A5B4FC' : '#9CA3AF',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background .14s ease, color .14s ease',
        ...style,
      }}
    >
      {children}
    </button>
  )
}
