import { useEffect, useRef, type RefObject } from 'react'
import { shouldHandleHotkey } from './hotkeys.core'

/**
 * Register a window-level keydown handler that behaves itself.
 *
 * Use this instead of a raw `window.addEventListener('keydown', …)` on any
 * page. Pages stay mounted when hidden (Dashboard uses `display:none`), so a
 * raw listener keeps firing for the rest of the session on screens that know
 * nothing about it — see hotkeys.core.js for the two bugs that caused.
 *
 * Pass `containerRef` pointing at the page root so the handler switches itself
 * off while the page is parked. The handler is held in a ref, so it always sees
 * fresh state without re-subscribing and without a stale-closure deps list.
 */
export function useHotkeys(
  handler: (e: KeyboardEvent) => void,
  opts: {
    /** page root — while it is hidden, the hotkey does not fire */
    containerRef?: RefObject<HTMLElement | null>
    /** only for keys that can never be text: Escape, Ctrl+K */
    allowWhileTyping?: boolean
    enabled?: boolean
  } = {},
) {
  const { containerRef, allowWhileTyping = false, enabled = true } = opts

  const saved = useRef(handler)
  useEffect(() => { saved.current = handler })

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (!shouldHandleHotkey(e, { container: containerRef?.current ?? null, allowWhileTyping })) return
      saved.current(e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, allowWhileTyping, containerRef])
}
