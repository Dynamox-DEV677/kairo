/**
 * useIsMobile — reactive viewport breakpoint hook.
 *
 * Returns `true` when the viewport is <= the breakpoint (default 768px).
 * Listens to `resize` + `orientationchange` so pages re-render when the user
 * rotates the device or resizes the window.
 */
import { useEffect, useState } from 'react'

export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= breakpoint
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint)
    window.addEventListener('resize', onResize, { passive: true })
    window.addEventListener('orientationchange', onResize, { passive: true })
    onResize()
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [breakpoint])

  return isMobile
}
