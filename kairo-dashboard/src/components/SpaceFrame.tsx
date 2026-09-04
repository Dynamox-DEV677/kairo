/**
 * Responsive frame for the seven-spaces screens -- and only those.
 *
 * Every new screen was drawn at 390px. On a laptop that column, stranded in a
 * 1440px window, looks broken. Three breakpoints and no others:
 *
 *   phone    < 640       as designed, edge to edge
 *   tablet   640 - 1023  centred column, max-width 480
 *   desktop  >= 1024     240px sidebar listing the spaces + centred content
 *
 * The baseline everywhere is the 480px column with the phone layout intact.
 * A screen with a real desktop layout (the doubt answer, the syllabus map, the
 * impact bar) asks for the wide column through the context; everything else
 * keeps the column, because a flashcard stretched across a laptop is
 * unreadable.
 *
 * The frame is a flex child of its Dashboard slot, not an absolute overlay, so
 * on a phone it respects the slot's bottom-nav clearance and the screens'
 * footers sit above the existing bottom bar instead of underneath it.
 *
 * The old screens never render inside this frame and keep whatever responsive
 * behaviour they have. Nothing here touches them.
 */
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { T, FONT, ICON } from '../lib/spaceTokens'
import { SPACES } from '../lib/spaces'

export type Breakpoint = 'phone' | 'tablet' | 'desktop'

export interface SpaceLayout {
  bp: Breakpoint
  /** Width in px of the area the column sits in: the viewport minus any sidebars. */
  areaWidth: number
  /** True while the frame is giving this screen the wide column. */
  wide: boolean
  /** A screen with a real desktop layout calls this; the frame widens the column for it. */
  setWide: (wide: boolean) => void
}

const FALLBACK: SpaceLayout = { bp: 'phone', areaWidth: 390, wide: false, setWide: () => {} }
const Ctx = createContext<SpaceLayout>(FALLBACK)

/** Read the frame's layout from inside a space. Outside a frame it reports a phone. */
export const useSpaceLayout = () => useContext(Ctx)

export const COLUMN_MAX = 480
export const WIDE_MAX = 1040

function readBp(): Breakpoint {
  if (typeof window === 'undefined') return 'phone'
  const w = window.innerWidth
  return w >= 1024 ? 'desktop' : w >= 640 ? 'tablet' : 'phone'
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(readBp)
  useEffect(() => {
    const on = () => setBp(readBp())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return bp
}

export default function SpaceFrame({ active, onNavigate, children }: {
  active: string
  onNavigate: (id: string) => void
  children: ReactNode
}) {
  const bp = useBreakpoint()
  const [wide, setWide] = useState(false)
  const areaRef = useRef<HTMLDivElement>(null)
  const [areaWidth, setAreaWidth] = useState(0)

  useLayoutEffect(() => {
    const el = areaRef.current
    if (!el) return
    const measure = () => setAreaWidth(el.getBoundingClientRect().width)
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [bp])

  const constrained = bp !== 'phone'
  const isWide = wide && constrained
  const ctx = useMemo<SpaceLayout>(() => ({ bp, areaWidth, wide: isWide, setWide }), [bp, areaWidth, isWide])

  return (
    <Ctx.Provider value={ctx}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative', overflow: 'hidden', background: T.bg, color: T.text, fontFamily: FONT }}>
        {bp === 'desktop' && <SpaceSidebar active={active} onNavigate={onNavigate} />}
        <div ref={areaRef} style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, margin: '0 auto',
            maxWidth: !constrained ? undefined : isWide ? WIDE_MAX : COLUMN_MAX,
            ...(constrained && !isWide ? { borderLeft: `1px solid ${T.divider}`, borderRight: `1px solid ${T.divider}` } : null),
          }}>
            {children}
          </div>
        </div>
      </div>
    </Ctx.Provider>
  )
}

/** The desktop sidebar: the finished spaces, and nothing a phone user ever sees. */
function SpaceSidebar({ active, onNavigate }: { active: string; onNavigate: (id: string) => void }) {
  return (
    <nav aria-label="New design" style={{
      width: 240, boxSizing: 'border-box', flexShrink: 0, background: T.bgAlt, borderRight: `1px solid ${T.divider}`,
      padding: '18px 12px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto',
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4, color: T.faint, textTransform: 'uppercase', padding: '0 12px 10px' }}>New design · preview</div>
      {SPACES.map(s => {
        const on = active === s.id
        const Icon = s.icon
        return (
          <button key={s.id} onClick={() => onNavigate(s.id)} className={`kyno-space-nav${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined} style={{
            height: 44, width: '100%', borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 12,
            background: on ? T.accentSurface : 'transparent', border: 'none', color: on ? T.accentPale : T.text2,
            fontFamily: FONT, fontSize: 14, fontWeight: on ? 600 : 500, cursor: 'pointer', textAlign: 'left',
          }}>
            <Icon size={18} color={on ? T.accentPale : T.muted} {...ICON} />
            <span style={{ flex: 1 }}>{s.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
