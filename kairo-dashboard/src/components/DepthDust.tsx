import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  z:  number
  r:  number
  vx: number
  vy: number
  hue: number
  glow: number
}

const COUNT = 80
const PALETTE = [
  [255, 255, 255],
  [233, 213, 255],
  [196, 181, 253],
  [167, 139, 250],
  [124,  58, 237],
]

export default function DepthDust({
  intensity = 1,
  zIndex    = 0,
}: { intensity?: number; zIndex?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const mouseRef = useRef({ x: -9999, y: -9999, active: false })
  const scrollVRef = useRef(0)
  const lastScrollYRef = useRef(0)
  const frameRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

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

    particlesRef.current = Array.from({ length: COUNT }, () => spawnParticle(w, h))

    function onMouseMove(e: MouseEvent) {
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY
      mouseRef.current.active = true
    }
    function onMouseLeave() { mouseRef.current.active = false }
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('mouseleave', onMouseLeave)

    lastScrollYRef.current = window.scrollY
    function onScroll() {
      const cur = window.scrollY
      const dv  = cur - lastScrollYRef.current
      lastScrollYRef.current = cur
      scrollVRef.current += (dv - scrollVRef.current) * 0.18
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    let last = performance.now()
    function frame(now: number) {
      const dt = Math.min(60, now - last) / 16.67
      last = now

      ctx!.clearRect(0, 0, w, h)
      scrollVRef.current *= 0.92

      const m = mouseRef.current
      const sv = scrollVRef.current
      const parts = particlesRef.current

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]

        const depthSpeed = 0.6 + (1 - p.z) * 1.4
        p.x += p.vx * dt * depthSpeed
        p.y += p.vy * dt * depthSpeed + sv * (0.05 + p.z * 0.18)

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

        if (p.x < -10)        p.x = w + 10
        if (p.x > w + 10)     p.x = -10
        if (p.y < -10)        p.y = h + 10
        if (p.y > h + 10)     p.y = -10

        p.glow = (p.glow + dt * 0.012 + p.r * 0.001) % 1

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

function spawnParticle(w: number, h: number): Particle {
  const z = Math.random()
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    z,
    r:  0.6 + (1 - z) * 1.2,
    vx: (Math.random() - 0.5) * 0.12,
    vy: -0.04 - Math.random() * 0.12,
    hue: Math.random(),
    glow: Math.random(),
  }
}
