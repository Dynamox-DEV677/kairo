/**
 * DepthDust — a fixed full-viewport canvas of slow-drifting particles
 * that persists across the ENTIRE landing scroll.
 *
 * Sits ABOVE the AtmosphereLayer (glow blobs + logo watermarks) but
 * BELOW every section's content. Gives the page the "continuous space"
 * feel — as you scroll from Hero → Problem → Labs → ..., the same dust
 * is always there, drifting at parallax-different speeds depending on
 * each particle's z-depth.
 *
 * Pure 2D canvas, no R3F — keeps the perf budget tiny (1 canvas, no
 * three.js overhead). 60 particles at ~120 ops/frame.
 *
 * Reactive inputs:
 *   - Mouse: cursor "blows" the dust away from itself (~80px radius)
 *   - Scroll: dust drifts down a bit faster, simulating camera ascent
 */
import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  z:  number      // 0..1 — depth (0 = closest, 1 = farthest)
  r:  number      // radius
  vx: number      // base velocity
  vy: number
  hue: number     // 0..1 for color picking
  glow: number    // 0..1 — twinkle phase
}

const COUNT = 80
const PALETTE = [
  [196, 181, 253],  // light purple
  [167, 139, 250],  // purple
  [96,  165, 250],  // blue
  [34,  211, 238],  // cyan
  [255, 255, 255],  // white
]

export default function DepthDust({
  intensity = 1,
  zIndex    = 0,
}: { intensity?: number; zIndex?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const mouseRef = useRef({ x: -9999, y: -9999, active: false })
  const scrollVRef = useRef(0)              // smoothed vertical scroll velocity
  const lastScrollYRef = useRef(0)
  const frameRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    // ── Sizing ────────────────────────────────────────────────
    let w = window.innerWidth
    let h = window.innerHeight
    const dpr = Math.min(1.5, window.devicePixelRatio || 1)
    function resize() {
      w = window.innerWidth
      h = window.innerHeight
      canvas!.width  = w * dpr
      canvas!.height = h * dpr
      canvas!.style.width  = w + 'px'
      canvas!.style.height = h + 'px'
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // ── Initial particle distribution ─────────────────────────
    particlesRef.current = Array.from({ length: COUNT }, () => spawnParticle(w, h))

    // ── Mouse tracking ────────────────────────────────────────
    function onMouseMove(e: MouseEvent) {
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY
      mouseRef.current.active = true
    }
    function onMouseLeave() { mouseRef.current.active = false }
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('mouseleave', onMouseLeave)

    // ── Scroll velocity (used to bias dust drift) ─────────────
    lastScrollYRef.current = window.scrollY
    function onScroll() {
      const cur = window.scrollY
      const dv  = cur - lastScrollYRef.current
      lastScrollYRef.current = cur
      // Lerp toward latest dv to smooth out
      scrollVRef.current += (dv - scrollVRef.current) * 0.18
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    // ── Animation loop ────────────────────────────────────────
    let last = performance.now()
    function frame(now: number) {
      const dt = Math.min(60, now - last) / 16.67    // normalised dt in 60fps units
      last = now

      ctx!.clearRect(0, 0, w, h)
      // Scroll velocity decay even when no scroll event fires
      scrollVRef.current *= 0.92

      const m = mouseRef.current
      const sv = scrollVRef.current
      const parts = particlesRef.current

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]

        // Base drift (parallax: close particles move slower than far)
        const depthSpeed = 0.6 + (1 - p.z) * 1.4
        p.x += p.vx * dt * depthSpeed
        p.y += p.vy * dt * depthSpeed + sv * (0.05 + p.z * 0.18)   // scroll bias

        // Mouse repel
        if (m.active) {
          const mdx = p.x - m.x
          const mdy = p.y - m.y
          const d2  = mdx * mdx + mdy * mdy
          const R   = 90 + (1 - p.z) * 50
          if (d2 < R * R) {
            const d  = Math.sqrt(d2) || 0.001
            const force = (1 - d / R) * 1.6
            p.x += (mdx / d) * force
            p.y += (mdy / d) * force
          }
        }

        // Wrap-around so dust never disappears
        if (p.x < -10)        p.x = w + 10
        if (p.x > w + 10)     p.x = -10
        if (p.y < -10)        p.y = h + 10
        if (p.y > h + 10)     p.y = -10

        // Twinkle
        p.glow = (p.glow + dt * 0.012 + p.r * 0.001) % 1

        // Render
        const a = 0.25 + Math.sin(p.glow * Math.PI * 2) * 0.18
        const rgb = PALETTE[Math.floor(p.hue * PALETTE.length) % PALETTE.length]
        const radius = p.r * (1 + Math.sin(p.glow * Math.PI * 2) * 0.18)
        const grad = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 3.5)
        grad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a * intensity})`)
        grad.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`)
        ctx!.fillStyle = grad
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, radius * 3.5, 0, Math.PI * 2)
        ctx!.fill()
      }

      frameRef.current = requestAnimationFrame(frame)
    }
    frameRef.current = requestAnimationFrame(frame)

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      window.removeEventListener('resize',    resize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('scroll',    onScroll)
    }
  }, [intensity])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed', inset: 0,
        width:  '100%', height: '100%',
        zIndex,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
      }}
    />
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function spawnParticle(w: number, h: number): Particle {
  const z = Math.random()
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    z,
    r:  0.6 + (1 - z) * 1.2,
    vx: (Math.random() - 0.5) * 0.12,
    vy: -0.04 - Math.random() * 0.12,        // gentle upward drift
    hue: Math.random(),
    glow: Math.random(),
  }
}
