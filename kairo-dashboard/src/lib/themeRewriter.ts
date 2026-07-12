
const RGB_MAP: Record<string, string> = {
  'rgb(6, 6, 10)':       '#fafafa',
  'rgb(10, 10, 10)':     '#fafafa',
  'rgb(13, 13, 13)':     '#ffffff',
  'rgb(17, 17, 17)':     '#ffffff',
  'rgb(14, 14, 22)':     '#ffffff',
  'rgb(15, 15, 15)':     '#ffffff',
  'rgb(20, 20, 31)':     '#f4f4f5',
  'rgb(19, 19, 29)':     '#f4f4f5',
  'rgb(22, 22, 22)':     '#f4f4f5',
  'rgb(26, 26, 26)':     '#f4f4f5',
  'rgb(28, 28, 28)':     '#f4f4f5',
  'rgb(30, 30, 30)':     '#ededf0',
  'rgb(30, 30, 46)':     '#ededf0',
  'rgb(26, 26, 38)':     '#e4e4e7',
  'rgb(34, 34, 46)':     '#e4e4e7',
  'rgb(45, 45, 45)':     '#e4e4e7',
  'rgb(250, 250, 250)':  '#18181b',
  'rgb(255, 255, 255)':  '#18181b',
  'rgb(228, 228, 231)':  '#4B5563',
  'rgb(212, 212, 216)':  '#4B5563',
}

const COLOUR_PROPS = new Set([
  'color',
  'background', 'background-color',
  'border-color',
  'border-top-color', 'border-right-color',
  'border-bottom-color', 'border-left-color',
  'fill', 'stroke',
  'outline-color', 'text-decoration-color',
  'caret-color',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'outline', 'box-shadow',
])

const SHORTHAND_PROPS = new Set([
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'outline', 'box-shadow',
])

const DARK_RGBA_RGB_SUM_MAX = 90

function applyToElement(el: HTMLElement | SVGElement): void {
  const style = el.style
  if (!style || style.length === 0) return

  if (!(el as any).__kairoOrigStyle) {
    (el as any).__kairoOrigStyle = el.getAttribute('style') || ''
  }

  const props: string[] = []
  for (let i = 0; i < style.length; i++) props.push(style[i])

  for (const prop of props) {
    if (!COLOUR_PROPS.has(prop)) continue

    const val = style.getPropertyValue(prop)
    if (!val) continue

    if (RGB_MAP[val]) {
      style.setProperty(prop, RGB_MAP[val])
      continue
    }

    if (SHORTHAND_PROPS.has(prop)) {
      let newVal = val
      let changed = false
      newVal = newVal.replace(/rgb\([^)]+\)/g, (match) => {
        if (RGB_MAP[match]) { changed = true; return RGB_MAP[match] }
        return match
      })
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

    if (val.startsWith('rgba(')) {
      const m = val.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/)
      if (m && Number(m[1]) + Number(m[2]) + Number(m[3]) <= DARK_RGBA_RGB_SUM_MAX) {
        if (prop === 'color') {
          style.setProperty(prop, `rgba(24, 24, 27, ${m[4]})`)
        } else {
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

export function applyLightTheme(root: ParentNode = document.body): void {
  const all = root.querySelectorAll<HTMLElement | SVGElement>('[style]')
  all.forEach(applyToElement)
}

export function restoreDarkTheme(root: ParentNode = document.body): void {
  const all = root.querySelectorAll<HTMLElement | SVGElement>('[style]')
  all.forEach(restoreElement)
}

export function startThemeWatcher(): () => void {
  if (typeof MutationObserver === 'undefined') return () => {}

  let scheduled = 0
  const flush = (nodes: Set<HTMLElement | SVGElement>) => {
    nodes.forEach(applyToElement)
    nodes.clear()
  }
  const pending = new Set<HTMLElement | SVGElement>()

  const obs = new MutationObserver((records) => {
    for (const rec of records) {
      rec.addedNodes.forEach(n => {
        if (!(n instanceof HTMLElement) && !(n instanceof SVGElement)) return
        if (n.hasAttribute('style')) pending.add(n)
        n.querySelectorAll<HTMLElement | SVGElement>('[style]').forEach(el => pending.add(el))
      })
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
