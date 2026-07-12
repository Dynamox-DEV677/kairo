import { useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { motion, useMotionValue } from 'framer-motion'

export interface FloatingModuleProps {
  children: ReactNode
  large?:    boolean
  draggable?: boolean
  resizable?: boolean
  initialSize?: { width?: number | string; height?: number | string }
  animate?:  boolean
  className?: string
  style?:    CSSProperties
  onDragStart?: () => void
  onDragEnd?: (offset: { x: number; y: number }) => void
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ')
}

export default function FloatingModule({
  children,
  large       = false,
  draggable   = false,
  resizable   = false,
  initialSize,
  animate     = true,
  className,
  style,
  onDragStart,
  onDragEnd,
}: FloatingModuleProps) {
  const ref      = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const [size, setSize] = useState<{ width: number | string | undefined; height: number | string | undefined }>({
    width:  initialSize?.width,
    height: initialSize?.height,
  })

  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const resizeStateRef = useRef<{ startX: number; startY: number; w: number; h: number } | null>(null)
  function onResizePointerDown(e: React.PointerEvent) {
    e.stopPropagation()
    e.preventDefault()
    const node = ref.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    resizeStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      w:      rect.width,
      h:      rect.height,
    }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    document.body.style.cursor = 'nwse-resize'
  }
  function onResizePointerMove(e: React.PointerEvent) {
    const s = resizeStateRef.current
    if (!s) return
    const w = Math.max(200, s.w + (e.clientX - s.startX))
    const h = Math.max(120, s.h + (e.clientY - s.startY))
    setSize({ width: w, height: h })
  }
  function onResizePointerUp(e: React.PointerEvent) {
    resizeStateRef.current = null
    document.body.style.cursor = ''
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
  }

  return (
    <motion.div
      ref={ref}
      drag={draggable}
      dragMomentum={false}
      dragElastic={0.12}
      dragTransition={{ bounceStiffness: 320, bounceDamping: 28 }}
      onDragStart={() => { setDragging(true);  onDragStart?.() }}
      onDragEnd={() => {
        setDragging(false)
        onDragEnd?.({ x: x.get(), y: y.get() })
      }}
      whileDrag={{ scale: 1.015 }}
      style={{
        x, y,
        width:  size.width,
        height: size.height,
        position: 'relative',
        ...style,
      }}
      initial={animate ? { opacity: 0, y: 8, scale: 0.99 } : false}
      animate={animate ? { opacity: 1, y: 0, scale: 1 } : false}
      transition={{
        type:      'spring',
        stiffness: 220,
        damping:   24,
        mass:      0.7,
      }}
      className={cx(
        'kr-floating',
        large     && 'kr-floating-lg',
        draggable && 'kr-draggable',
        dragging  && 'kr-dragging',
        className,
      )}
    >
      {children}

      {resizable && (
        <div
          className="kr-resize-handle"
          aria-label="Resize"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
        />
      )}
    </motion.div>
  )
}
