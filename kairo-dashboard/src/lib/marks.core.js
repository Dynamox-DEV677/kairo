/**
 * Colour highlights in the Reader -- the pure half.
 *
 * A mark is stored as rectangles in FRACTIONS of the page (0..1), taken from
 * the text selection at the moment the student highlights. Fractions, not
 * pixels, because the same page is drawn at every zoom and screen width: a
 * mark saved on a phone at 100% has to land on the same words on a laptop at
 * 180%. Searching the text again on every draw would be slower and would
 * break on repeated phrases; the rectangles are exact.
 */

export const MARK_COLORS = ['yellow', 'green', 'pink']

/** Fill for each colour, multiplied over the page so the print stays crisp. */
export const MARK_FILL = {
  yellow: 'rgba(255, 210, 0, 0.45)',
  green: 'rgba(52, 199, 89, 0.36)',
  pink: 'rgba(255, 64, 140, 0.32)',
}

/** Solid swatch for buttons and lists, where a translucent fill reads as grey. */
export const MARK_SWATCH = { yellow: '#FFD60A', green: '#34C759', pink: '#FF4F8B' }

/** What each colour is for. Students colour-code; the labels make it easy. */
export const MARK_LABEL = { yellow: 'Definition', green: 'Example', pink: 'Revise' }

export const MAX_RECTS = 120

const round = (n) => Math.round(n * 1e5) / 1e5

/**
 * The selection's client rectangles, merged per line and turned into page
 * fractions.
 *
 * A text-layer selection arrives as one rectangle per span -- often a dozen
 * per line, overlapping -- and drawing each one stacks the colour into dark
 * bands. Rectangles on the same line that touch or nearly touch become one.
 * Anything outside the page is clipped; slivers are dropped.
 */
export function selectionRects(rects, box, { max = MAX_RECTS } = {}) {
  if (!box || !(box.width > 0) || !(box.height > 0)) return []
  const bx2 = box.left + box.width
  const by2 = box.top + box.height
  const clipped = []
  for (const r of rects || []) {
    const left = Math.max(box.left, r.left)
    const top = Math.max(box.top, r.top)
    const right = Math.min(bx2, r.right ?? r.left + r.width)
    const bottom = Math.min(by2, r.bottom ?? r.top + r.height)
    if (right - left < 1 || bottom - top < 1) continue
    clipped.push({ left, top, right, bottom })
  }
  // Group into lines first (spans on one line can differ by a pixel in their
  // top, so sorting by top alone scrambles their left-to-right order), then
  // merge left to right within each line.
  clipped.sort((a, b) => a.top - b.top)
  const lines = []
  for (const r of clipped) {
    const line = lines[lines.length - 1]
    if (line) {
      const overlap = Math.min(line.bottom, r.bottom) - Math.max(line.top, r.top)
      if (overlap >= 0.6 * Math.min(line.bottom - line.top, r.bottom - r.top)) {
        line.items.push(r)
        line.top = Math.min(line.top, r.top)
        line.bottom = Math.max(line.bottom, r.bottom)
        continue
      }
    }
    lines.push({ top: r.top, bottom: r.bottom, items: [r] })
  }

  const merged = []
  for (const line of lines) {
    line.items.sort((a, b) => a.left - b.left)
    let cur = null
    for (const r of line.items) {
      const h = Math.max(r.bottom - r.top, cur ? cur.bottom - cur.top : 0)
      if (cur && r.left - cur.right <= 0.6 * h) {
        cur.right = Math.max(cur.right, r.right)
        cur.top = Math.min(cur.top, r.top)
        cur.bottom = Math.max(cur.bottom, r.bottom)
      } else {
        if (cur) merged.push(cur)
        cur = { ...r }
      }
    }
    if (cur) merged.push(cur)
  }

  return merged.slice(0, max).map(r => ({
    x: round((r.left - box.left) / box.width),
    y: round((r.top - box.top) / box.height),
    w: round((r.right - r.left) / box.width),
    h: round((r.bottom - r.top) / box.height),
  }))
}

/** A stored mark is only drawn if its shape is sane. */
export function validRects(rects) {
  return (Array.isArray(rects) ? rects : []).filter(r =>
    r && [r.x, r.y, r.w, r.h].every(n => typeof n === 'number' && Number.isFinite(n)) &&
    r.w > 0 && r.h > 0 && r.x >= -0.01 && r.y >= -0.01 && r.x + r.w <= 1.01 && r.y + r.h <= 1.01,
  )
}

/** The colour marks on one page of one book. */
export function marksOnPage(highlights, page) {
  return (highlights || []).filter(h =>
    h && h.action === 'mark' && h.page === page && MARK_COLORS.includes(h.color) && validRects(h.rects).length,
  )
}

/** Every colour mark in a book, in reading order. */
export function bookMarks(highlights) {
  return (highlights || [])
    .filter(h => h && h.action === 'mark' && MARK_COLORS.includes(h.color))
    .sort((a, b) => ((a.page || 0) - (b.page || 0)) || (((a.rects?.[0]?.y) || 0) - ((b.rects?.[0]?.y) || 0)))
}
