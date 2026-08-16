import type { ReactNode, ComponentPropsWithRef } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * The one primary-action button.
 *
 * Before this the app had at least five spellings of "the main button on this
 * screen". A student reading a screen cannot tell which control is the main one
 * when every screen answers that differently, so the inconsistency was costing
 * more than looks.
 *
 * The look is NOT invented here: it is the treatment Home's "Refresh brief"
 * button already had — a flat violet face, a 14px radius and a hard darker
 * bottom edge that presses down on tap. The job was to spread that, not to
 * design something new. (A first pass turned it into a glowing 999px pill and
 * spread THAT, which was the wrong thing done thoroughly.)
 *
 * IMPORTANT: this is for PRIMARY actions only. Deliberately not applied to
 * secondary or destructive controls — if everything glows, nothing reads as
 * the main action, and "Clear all data" must never look like the thing you are
 * being invited to press.
 */

type Variant = 'primary' | 'secondary' | 'danger'
type Size = 'sm' | 'md'

// ComponentPropsWithRef, not ButtonHTMLAttributes: React 19 passes `ref` as an
// ordinary prop to function components, and ConfirmModal needs to focus Cancel
// when the dialog opens. Typing it this way lets that ref reach the DOM node.
interface Props extends Omit<ComponentPropsWithRef<'button'>, 'className'> {
  children?: ReactNode
  /** Shows a spinner and blocks clicks. Keeps the label so the button does not
   *  change width mid-action and shift everything beside it. */
  loading?: boolean
  variant?: Variant
  size?: Size
  /** Square button for a lone icon — same treatment, 1:1 footprint. */
  iconOnly?: boolean
  full?: boolean
}

const SIZES: Record<Size, { padding: string; fontSize: number; icon: number }> = {
  sm: { padding: '8px 14px',  fontSize: 12.5, icon: 13 },
  md: { padding: '11px 20px', fontSize: 13.5, icon: 15 },
}

/**
 * The skin lives in index.css, not here.
 *
 * .kyno-chunky / .kyno-ghost / .kyno-danger are on ~320 buttons across the app.
 * Restating the face a second time in this file would make this component a
 * *new* button style rather than the shared one — exactly the problem it exists
 * to fix. So the component only contributes layout, and the paint comes from
 * the same class every other call site uses. One definition, two ways in.
 */
const CLASS: Record<Variant, string> = {
  primary:   'kyno-chunky',
  secondary: 'kyno-ghost',
  danger:    'kyno-danger',
}

export function PrimaryButton({
  children, loading = false, variant = 'primary', size = 'md',
  iconOnly = false, full = false, disabled, style, ...rest
}: Props) {
  const s = SIZES[size]
  const off = disabled || loading

  // Layout only. Paint comes from CLASS[variant] — see the note above.
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: iconOnly ? 0 : s.padding,
    width: iconOnly ? 38 : full ? '100%' : undefined,
    height: iconOnly ? 38 : undefined,
    fontSize: s.fontSize,
    letterSpacing: 0.2,
    flexShrink: 0,
    ...style,
  }

  return (
    <button
      {...rest}
      disabled={off}
      aria-busy={loading || undefined}
      className={CLASS[variant]}
      style={base}
    >
      {loading && <Loader2 size={s.icon} style={{ animation: 'kyno-pb-spin .9s linear infinite' }} />}
      {children}
    </button>
  )
}

/**
 * Selected/unselected pill for toggle groups — board and class pickers, subject
 * chips, tab pairs.
 *
 * Selected gets the same violet face as PrimaryButton so "this one is chosen"
 * reads identically everywhere. Previously the selected state was a slightly
 * different grey on almost every screen, which is a real usability problem, not
 * a cosmetic one: on the Settings board picker you could not tell at a glance
 * which board was actually set.
 */
export function ToggleChip({
  selected, children, style, ...rest
}: Omit<ComponentPropsWithRef<'button'>, 'className'> & { selected: boolean; children: ReactNode }) {
  return (
    <button
      {...rest}
      // aria-pressed is the part a stylesheet cannot do: a screen reader has to
      // announce the selected board, not just show it.
      aria-pressed={selected}
      className={`kyno-chip${selected ? ' on' : ''}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 15px', fontSize: 12.5, flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export default PrimaryButton
