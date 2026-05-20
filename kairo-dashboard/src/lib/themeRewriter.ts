/**
 * Light-mode theme rewriter for Kairo.
 *
 * Most of Kairo's components paint themselves with hard-coded inline styles
 * (background: '#050505', color: '#fafafa', border: '1px solid #1f2532'),
 * which the browser normalises to rgb()/rgba() form in the actual inline
 * style attribute. CSS attribute selectors can't reliably cover every
 * spelling Chrome / Firefox / Safari emit, so we walk the DOM ourselves
 * and rewrite property values directly.
 *
 *   applyLightTheme()    — walk the DOM and flip every dark colour we know
 *                          about to its light counterpart. Originals are
 *                          saved as data-orig-style so we can restore.
 *   restoreDarkTheme()   — set every touched element back to its saved
 *                          inline style.
 *   startThemeWatcher()  — MutationObserver that auto-rethemes any newly
 *                          rendered element while light mode is active.
 *                          Returns a cleanup function.
 */

// ─── Colour map ────────────────────────────────────────────────────────────
// rgb() (no alpha) → light counterpart hex
const RGB_MAP: Record<string, string> = {
  // page-level dark bgs → page light
  'rgb(6, 6, 10)':       '#fafafa',
  'rgb(10, 10, 10)':     '#fafafa',
  // panels & cards → white
  'rgb(13, 13, 13)':     '#ffffff',
  'rgb(17, 17, 17)':     '#ffffff',
  'rgb(14, 14, 22)':     '#ffffff',
  'rgb(15, 15, 15)':     '#ffffff',
  // elevated surfaces → off-white
  'rgb(20, 20, 31)':     '#f4f4f5',
  'rgb(19, 19, 29)':     '#f4f4f5',
  'rgb(22, 22, 22)':     '#f4f4f5',
  'rgb(26, 26, 26)':     '#f4f4f5',
  'rgb(28, 28, 28)':     '#f4f4f5',
  // hover / pressed states → hover-light
  'rgb(30, 30, 30)':     '#ededf0',
  'rgb(30, 30, 46)':     '#ededf0',
  // borders → border-light
  'rgb(26, 26, 38)':     '#e4e4e7',
  'rgb(34, 34, 46)':     '#e4e4e7',
  'rgb(45, 45, 45)':     '#e4e4e7',
  // text white → near-black
  'rgb(250, 250, 250)':  '#18181b',
  'rgb(255, 255, 255)':  '#18181b',
  // bright greys → mid-grey
  'rgb(228, 228, 231)':  '#4B5563',
  'rgb(212, 212, 216)':  '#4B5563',
}

// Properties we'll touch. Limits the blast radius to colour-bearing ones.
const COLOUR_PROPS = new Set([
  'color',
  'background', 'background-color',
  'border-color',
  'border-top-color', 'border-right-color',
  'border-bottom-color', 'border-left-color',
  'fill', 'stroke',
  'outline-color', 'text-decoration-color',
  'caret-color',
  // Shorthands that may contain a colour token
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'outline', 'box-shadow',
])

// Properties that, when the saved value contains a known rgb(...) token,
// we attempt a token-substitution rewrite (border: 1px solid rgb(30, 30, 30)).
const SHORTHAND_PROPS = new Set([
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'outline', 'box-shadow',
])

// Common rgba semi-transparent darks → translucent white substitute.
// Detected via the `r+g+b < threshold` heuristic.
const DARK_RGBA_RGB_SUM_MAX = 90

// ─── Rewriter ─────────────────────────────────────────────────────────────
function applyToElement(el: HTMLElement | SVGElement): void {
  const style = el.style
  if (!style || style.length === 0) return

  // Save original style ONCE so we can restore later
  if (!(el as any).__kairoOrigStyle) {
    (el as any).__kairoOrigStyle = el.getAttribute('style') || ''
  }

  // Snapshot the property names first — mutating during iteration is unsafe.
  const props: string[] = []
  for (let i = 0; i < style.length; i++) props.push(style[i])

  for (const prop of props) {
    if (!COLOUR_PROPS.has(prop)) continue

    const val = style.getPropertyValue(prop)
    if (!val) continue

    // 1. Direct rgb() value → swap
    if (RGB_MAP[val]) {
      style.setProperty(prop, RGB_MAP[val])
      continue
    }

    // 2. Shorthand containing an rgb() token (border, box-shadow, etc.)
    if (SHORTHAND_PROPS.has(prop)) {
      let newVal = val
      let changed = false
      newVal = newVal.replace(/rgb\([^)]+\)/g, (match) => {
        if (RGB_MAP[match]) { changed = true; return RGB_MAP[match] }
        return match
      })
      // Also flip dark rgba() inside shorthands to translucent white
      newVal = newVal.replace(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g, (m, r, g, b, a) => {
        if (Number(r) + Number(g) + Number(b) <= DARK_RGBA_RGB_SUM_MAX) {
          changed = true
          return `rgba(255, 255, 255, ${a})`
        }
        return m
      })
      if (changed) style.setProperty(prop, newVal)
      continue
    }

    // 3. Dark rgba() on background / color → swap
    if (val.startsWith('rgba(')) {
      const m = val.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/)
      if (m && Number(m[1]) + Number(m[2]) + Number(m[3]) <= DARK_RGBA_RGB_SUM_MAX) {
        if (prop === 'color') {
          // Dark translucent text → opaque near-black
          style.setProperty(prop, `rgba(24, 24, 27, ${m[4]})`)
        } else {
          // Dark translucent surface → translucent white
          style.setProperty(prop, `rgba(255, 255, 255, ${m[4]})`)
        }
      }
    }
  }
}

function restoreElement(el: HTMLElement | SVGElement): void {
  const orig = (el as any).__kairoOrigStyle
  if (orig === undefined) return
  if (orig) el.setAttribute('style', orig)
  else el.removeAttribute('style')
  delete (el as any).__kairoOrigStyle
}

// ─── Public API ───────────────────────────────────────────────────────────
export function applyLightTheme(root: ParentNode = document.body): void {
  const all = root.querySelectorAll<HTMLElement | SVGElement>('[style]')
  all.forEach(applyToElement)
}

export function restoreDarkTheme(root: ParentNode = document.body): void {
  const all = root.querySelectorAll<HTMLElement | SVGElement>('[style]')
  all.forEach(restoreElement)
}

/**
 * Watch the DOM and re-apply the light theme whenever React mounts a new
 * styled element. Call this once after applyLightTheme(); call the returned
 * function to stop watching (and ideally call restoreDarkTheme too).
 */
export function startThemeWatcher(): () => void {
  if (typeof MutationObserver === 'undefined') return () => {}

  // Debounce to avoid hammering the page while React batch-renders
  let scheduled = 0
  const flush = (nodes: Set<HTMLElement | SVGElement>) => {
    nodes.forEach(applyToElement)
    nodes.clear()
  }
  const pending = new Set<HTMLElement | SVGElement>()

  const obs = new MutationObserver((records) => {
    for (const rec of records) {
      // Newly added subtrees
      rec.addedNodes.forEach(n => {
        if (!(n instanceof HTMLElement) && !(n instanceof SVGElement)) return
        if (n.hasAttribute('style')) pending.add(n)
        n.querySelectorAll<HTMLElement | SVGElement>('[style]').forEach(el => pending.add(el))
      })
      // Existing nodes whose style attribute was mutated (e.g., hover handlers)
      if (rec.type === 'attributes' && rec.attributeName === 'style' && rec.target instanceof HTMLElement) {
        pending.add(rec.target)
      }
    }
    if (scheduled) return
    scheduled = window.requestAnimationFrame(() => {
      scheduled = 0
      flush(pending)
    })
  })

  obs.observe(document.body, {
    subtree:        true,
    childList:      true,
    attributes:     true,
    attributeFilter:['style'],
  })

  return () => {
    obs.disconnect()
    if (scheduled) cancelAnimationFrame(scheduled)
  }
}
