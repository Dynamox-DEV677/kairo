/**
 * ONE fixed slot at the bottom of the screen.
 *
 * Two fixed stacks were colliding: the tab bar and whatever footer the screen
 * pinned. On the Doubt answer only a few pixels of "I'm stuck here" and
 * "Similar question" showed either side of the nav, and scrolling could not
 * help because both were fixed.
 *
 * The rule: the tab bar belongs to SPACE ROOTS. On a sub-screen, or while a
 * session is running, or while the keyboard is up, the screen's own footer
 * takes the bottom edge and the tab bar goes away.
 *
 * Nobody is stranded, because the back chevron always returns to the space
 * root, and a swipe up from the bottom edge (or a tap on empty content)
 * reveals the bar for a few seconds.
 */

export const NAV_REVEAL_MS = 4000

/** Pages that own the whole screen and never show the tab bar. */
const IMMERSIVE = new Set(['camera-live'])

export interface NavVisibility {
  /** The route is a space root, or Home. */
  atRoot: boolean
  /** A sub-screen is open (anything deeper than a root). */
  subScreen: boolean
  /** A session, mock, battle or focus timer is running. */
  busy: boolean
  /** A text input or textarea has focus. */
  typing: boolean
  /** The student asked for the bar back. */
  revealed: boolean
}

/**
 * Whether the tab bar shows. Pure, so the rule is testable and stated once
 * rather than scattered across the screens that happen to have footers.
 */
export function showTabBar(page: string, v: NavVisibility): boolean {
  if (IMMERSIVE.has(page)) return false
  if (v.revealed) return true
  if (v.typing) return false      // the keyboard owns the bottom edge
  if (v.busy) return false        // exit is via the screen's own End/Close
  if (v.subScreen) return false   // the screen's footer owns the bottom edge
  return v.atRoot
}

/** True when a tap landed on plain content rather than something interactive. */
export function isEmptyContentTap(target: Element | null): boolean {
  if (!target) return false
  return !target.closest('button, a, input, textarea, select, [role="button"], [contenteditable="true"]')
}
