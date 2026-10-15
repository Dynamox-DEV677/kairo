/**
 * The Doubt Solving whiteboard -- the pure half.
 *
 * Strokes are stored in units of the board's WIDTH (x / width, y / width),
 * so a board drawn in portrait survives the keyboard opening, a rotation or a
 * resize without stretching the handwriting.
 */

/** A stroke's points, as [x, y] pairs in board-width units. */
export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

/**
 * Indexes of the strokes the eraser touches at (x, y) with radius r.
 *
 * Whole strokes go, not pixels. A pixel eraser leaves fragments a model then
 * reads as stray marks ("is that a minus sign?"), and whole-stroke erasing
 * keeps undo simple: the board is always a list of strokes.
 */
export function eraseHits(strokes, x, y, r) {
  const hits = []
  ;(strokes || []).forEach((s, i) => {
    const p = s?.points || []
    if (p.length === 1 && Math.hypot(p[0][0] - x, p[0][1] - y) <= r) { hits.push(i); return }
    for (let k = 1; k < p.length; k++) {
      if (distToSegment(x, y, p[k - 1][0], p[k - 1][1], p[k][0], p[k][1]) <= r) { hits.push(i); return }
    }
  })
  return hits
}

/** The area the ink covers, in board-width units, or null for an empty board. */
export function inkBounds(strokes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const s of strokes || []) {
    for (const [x, y] of s?.points || []) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null
}

const STATUSES = ['correct', 'mistake', 'inprogress', 'unclear']
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

/**
 * The checker's reply, made safe to show.
 *
 * The model is asked for a line-by-line verdict; this keeps only what can be
 * drawn honestly: numbered lines in order, a first wrong line that actually
 * exists and is actually marked wrong, and a status that agrees with them.
 */
export function normalizeBoardResult(raw) {
  const o = raw && typeof raw === 'object' ? raw : {}
  const lines = (Array.isArray(o.lines) ? o.lines : [])
    .map((l, i) => ({ n: Number.isFinite(Number(l?.n)) ? Math.round(Number(l.n)) : i + 1, text: clip(l?.text, 140), ok: l?.ok === true }))
    .filter(l => l.text && l.n > 0)
    .slice(0, 20)
  const wrong = lines.find(l => !l.ok)
  const claimed = Number(o.firstWrongLine)
  const firstWrongLine = lines.some(l => l.n === claimed && !l.ok) ? claimed : (wrong ? wrong.n : null)
  let status = STATUSES.includes(o.status) ? o.status : 'unclear'
  if (o.readable === false || !lines.length) status = 'unclear'
  else if (firstWrongLine != null) status = 'mistake'
  else if (status === 'mistake') status = 'inprogress'
  return {
    status,
    lines,
    firstWrongLine: status === 'mistake' ? firstWrongLine : null,
    feedback: clip(o.feedback, 240),
    done: o.done === true && status === 'correct',
  }
}

/** The one-line headline for a result. */
export function boardVerdict(r) {
  switch (r?.status) {
    case 'correct': return { tone: 'good', title: r.done ? 'All correct. Nice work.' : 'Correct so far. Keep going.' }
    case 'mistake': return { tone: 'warn', title: `Line ${r.firstWrongLine} needs another look` }
    case 'inprogress': return { tone: 'info', title: 'Looks right so far. Keep going.' }
    default: return { tone: 'info', title: "Kyno couldn't read that clearly" }
  }
}
