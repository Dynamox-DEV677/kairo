export function isTypingTarget(target: unknown): boolean
export function isOnScreen(el: Element | null | undefined): boolean
export function shouldHandleHotkey(
  e: { target?: unknown } | null | undefined,
  opts?: { container?: Element | null; allowWhileTyping?: boolean },
): boolean
