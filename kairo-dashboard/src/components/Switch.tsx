/**
 * The one on/off switch in the app.
 *
 * It lived inside Profile.tsx, so "fix the toggle" meant fixing one instance
 * and hoping. These switches control privacy -- who can see you in a league,
 * whether you appear in study rooms -- so an ambiguous one is not a cosmetic
 * problem. It has to read at a glance, on a phone, without thinking.
 *
 * WHAT WAS ACTUALLY WRONG: not the geometry. The knob positions were already
 * fixed pixels. The OFF knob was T.muted on a T.raised track -- two mid-greys
 * a shade apart -- so at phone width it read as a blob somewhere in the
 * middle rather than a knob parked at one end. Off now uses a light knob on a
 * dark track, so the two states differ in POSITION and in CONTRAST.
 *
 * One mechanism for movement: the track is a flexbox and the knob is placed by
 * justify-content. Nothing computes a percentage, so nothing can resolve
 * differently at 375px than at 390px.
 */

const TRACK_W = 42
const TRACK_H = 25
const PAD = 3
const KNOB = 19

export const SWITCH_ON_TRACK = '#7C5CFF'
export const SWITCH_OFF_TRACK = '#2A2A3C'
export const SWITCH_ON_KNOB = '#FFFFFF'
export const SWITCH_OFF_KNOB = '#7E7E96'

export default function Switch({
  on, onChange, label, disabled,
}: {
  on: boolean
  onChange: (v: boolean) => void
  /** Announced to a screen reader. Required: an unlabelled switch is a guess. */
  label: string
  disabled?: boolean
}) {
  return (
    /*
     * TWO boxes on purpose. A global rule gives every button a 44px minimum
     * height for thumbs, which stretched the pill to 44 and is what made the
     * knob look stranded in the middle of an over-tall track. So the BUTTON
     * stays 44 and invisible -- the touch target is not something to trade
     * away -- and the pill inside it is exactly 42x25.
     */
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{
        background: 'none', border: 'none', padding: 0, margin: 0,
        width: TRACK_W, minWidth: TRACK_W, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        // fixed, never a percentage or a flex-computed width
        width: TRACK_W, height: TRACK_H, minWidth: TRACK_W, flexShrink: 0,
        boxSizing: 'border-box', padding: PAD, borderRadius: 100,
        background: on ? SWITCH_ON_TRACK : SWITCH_OFF_TRACK,
        display: 'flex', alignItems: 'center',
        justifyContent: on ? 'flex-end' : 'flex-start',
        transition: 'background .15s ease',
      }}>
        <span style={{
          width: KNOB, height: KNOB, borderRadius: '50%', display: 'block',
          background: on ? SWITCH_ON_KNOB : SWITCH_OFF_KNOB,
          transition: 'background .15s ease',
        }} />
      </span>
    </button>
  )
}
