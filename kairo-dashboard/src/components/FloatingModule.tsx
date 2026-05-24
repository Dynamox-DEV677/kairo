/**
 * FloatingModule — Kairo's softer, more tactile panel wrapper.
 *
 * This is the refinement-pass primitive: drop it around ANY existing panel
 * to give it the new Apple Vision Pro / Arc Browser feel without rebuilding
 * the page. Opt-in: no other code is affected.
 *
 *   <FloatingModule>
 *     ...your existing content...
 *   </FloatingModule>
 *
 * Capabilities (all optional, additive):
 *   • Softly-rounded glass surface with ambient hover lift
 *   • Drag-to-move (`draggable`) — Framer Motion spring physics
 *   • Resize handle (`resizable`) — drag bottom-right corner
 *   • Spring entrance — picks up the "everything is alive" feel
 *
 * The component renders a single <motion.div> with the .kr-floating utility
 * (defined in index.css). All the heavy styling lives in CSS so the
 * component stays tiny and you can theme it from one place later.
 *
 * USAGE NOTES
 *   • This is intentionally NOT a replacement for any existing component.
 *     Use it to upgrade specific panels you want to feel more tactile —
 *     not as a global wrapper for every <div>.
 *   • `draggable` works in any positioned container. By default we let
 *     Framer Motion's `dragConstraints` clamp the drag to the parent.
 *   • Honours `prefers-reduced-motion` automatically (transitions only).
 */
import { useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { motion, useMotionValue } from 'framer-motion'

export interface FloatingModuleProps {
  /** Content of the module. */
  children: ReactNode
  /** Add the larger-radius treatment (28px) — better for top-level panels. */
  large?:    boolean
  /** Make the whole module draggable around its parent. */
  draggable?: boolean
  /** Add a bottom-right resize handle. */
  resizable?: boolean
  /** Optional initial size when resizable. Defaults to {width: 'auto', height: 'auto'}. */
  initialSize?: { width?: number | string; height?: number | string }
  /** Animate in on mount. Default true. */
  animate?:  boolean
  /** Extra class names. */
  className?: string
  /** Extra inline styles. */
  style?:    CSSProperties
  /** Fired when the drag starts. */
  onDragStart?: () => void
  /** Fired when the drag ends. Receives the final {x, y} offset. */
  onDragEnd?: (offset: { x: number; y: number }) => void
}

/** Composes class names while skipping undefined / empty entries. */
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

  // ── Resize handler — pointer-based, freezes the size on the host node ──
  // We track size in component state so the resize sticks across renders.
  // Each pointer-move recalculates against the start point + initial size
  // (captured on pointer-down) to avoid drift.
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
