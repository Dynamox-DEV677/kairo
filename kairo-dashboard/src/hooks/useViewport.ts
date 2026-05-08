/**
 * Viewport / device hooks.
 * useIsMobile() — true under 768px wide.
 * useSafeAreaInsets() — for iOS notch / Android nav bar via env(safe-area-inset-*).
 */
import { useState, useEffect } from 'react'

const MOBILE_BREAKPOINT = 768

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  )
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < MOBILE_BREAKPOINT) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

export function useViewportSize() {
  const [size, setSize] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth  : 1024,
    h: typeof window !== 'undefined' ? window.innerHeight : 768,
  }))
  useEffect(() => {
    function onResize() { setSize({ w: window.innerWidth, h: window.innerHeight }) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}
