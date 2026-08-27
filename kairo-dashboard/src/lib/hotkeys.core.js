/**
 * Page-scoped keyboard shortcuts, guarded.
 *
 * One listener in Revision Reels caused two separate bugs, and both came from
 * the same wrong assumption: that a page's key handler only runs while that
 * page is on screen. It doesn't. Dashboard hides inactive pages with
 * `display:none` and leaves them mounted, so a window listener registered on
 * first visit lives for the rest of the session.
 *
 *   1. Space was bound to "flip card" WITH preventDefault(). After one visit to
 *      Reels, the space bar stopped working in every text field in the app.
 *      On the Solver — the highest-traffic screen — a first-time student typing
 *      "what is newtons second law" sent "whatisnewtonssecondlaw".
 *
 *   2. Arrow keys advanced the deck and PERSISTED the new position. Moving the
 *      text cursor while editing a doubt silently reshuffled the student's
 *      revision queue. That one was destroying data, quietly.
 *
 * So a page hotkey needs two guards: not while the student is typing, and not
 * while the page is hidden. Pure predicates — testable without a DOM.
 */

/** Fields where a keystroke is text, not a command. */
const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/**
 * Is this keystroke headed somewhere the student is typing?
 *
 * Checkboxes and buttons are counted as typing targets too. Space genuinely
 * means something there (toggle / press) and the browser already handles it,
 * so staying out is right for the same reason.
 */
export function isTypingTarget(target) {
  if (!target || typeof target !== 'object') return false
  const tag = String(target.tagName || '').toUpperCase()
  if (EDITABLE_TAGS.has(tag)) return true
  if (target.isContentEditable === true) return true
  if (typeof target.closest === 'function') {
    try { return !!target.closest('[contenteditable=""],[contenteditable="true"]') } catch { return false }
  }
  return false
}

/**
 * Is this element actually rendered?
 *
 * `display:none` is exactly how Dashboard parks an inactive page, and it leaves
 * no client rects. A null element means "caller gave no container to check" →
 * treat as visible, so this guard can never silently disable a hotkey it wasn't
 * told how to scope.
 */
export function isOnScreen(el) {
  if (!el) return true
  if (typeof el.checkVisibility === 'function') {
    try { return el.checkVisibility() !== false } catch { /* older engines */ }
  }
  if (typeof el.getClientRects === 'function') {
    try { return el.getClientRects().length > 0 } catch { /* detached */ }
  }
  return true
}

/**
 * The single decision: handle this key, or stay out of the way?
 *
 * @param {{ target?: any }} e  keyboard event (a plain object works, for tests)
 * @param {{ container?: any, allowWhileTyping?: boolean }} [opts]
 *   container         the page root — hidden means the page isn't showing
 *   allowWhileTyping  opt-in, and only correct for keys that can never be text:
 *                     Escape, and modifier combos like Ctrl+K
 */
export function shouldHandleHotkey(e, opts = {}) {
  if (!e) return false
  const { container = null, allowWhileTyping = false } = opts
  if (!allowWhileTyping && isTypingTarget(e.target)) return false
  if (!isOnScreen(container)) return false
  return true
}
