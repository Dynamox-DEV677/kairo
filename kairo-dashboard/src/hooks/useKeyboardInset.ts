/**
 * How far the keyboard covers the bottom of the window.
 *
 * On mobile the browser does not always shrink the LAYOUT viewport when the
 * keyboard opens, so `bottom: 0` can sit behind the keyboard -- which is what
 * left the Doubt input bar floating with dead space beneath it. The VISUAL
 * viewport does move, so that is what a bottom-anchored bar must follow.
 *
 * Returns pixels to lift by: 0 when the keyboard is closed, and on desktop,
 * where visualViewport tracks the window exactly.
 */
import { useEffect, useState } from 'react'

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const read = () => {
      // what the window has that the visible area does not
      const hidden = window.innerHeight - vv.height - vv.offsetTop
      // small negative values and rounding noise are not a keyboard
      setInset(hidden > 24 ? Math.round(hidden) : 0)
    }
    read()
    vv.addEventListener('resize', read)
    vv.addEventListener('scroll', read)
    return () => {
      vv.removeEventListener('resize', read)
      vv.removeEventListener('scroll', read)
    }
  }, [])

  return inset
}
