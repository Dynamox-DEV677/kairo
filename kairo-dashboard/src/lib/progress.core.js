/**
 * Progress -- the arithmetic behind space 6. No AI anywhere in this file.
 *
 * THE MAP. Knowledge Graph, Concept Map and Memory Graph were three views of
 * one dataset; this is the one map with two lenses. Nodes are syllabus
 * chapters, radius = weight in marks, fill = mastery on ONE sequential ramp
 * (solid / shaky / untouched -- monotonic lightness, so it survives colour
 * blindness and greyscale with no legend). Edges are prerequisite links.
 *
 * MAX ~12 NODES ON A PHONE: a subject with more chapters is split by unit,
 * and units too small to stand alone are merged into a neighbour. A hairball
 * is not a map.
 *
 * LAYOUT is computed once per group from static data -- a golden-angle spiral
 * plus a dozen deterministic separation passes -- and memoised. There is no
 * live force simulation, nothing animates, and it works offline, which the
 * brief also requires (a server-cached layout would not).
 *
 * THE FADING LENS uses the spaced-repetition scheduler's own dates: a card's
 * next review date IS the fading date. No new model.
 */
import { matchChapter } from './syllabusGraph.core.js'

const DAY = 86_400_000
export const MAX_NODES = 12

/** ONE hue, monotonic in lightness. Never categorical. */
export const RAMP = { solid: '#9B82FF', shaky: '#55429E', untouched: '#1A1A26', untouchedStroke: '#3A3A50' }
/** The fading lens repaints, it does not recolour: amber ring for what is slipping, everything else dims. */
export const FADE = { ring: '#F2A65A', fill: '#2A1A10', dimFill: '#1A1A26', dimStroke: '#2E2E42', edge: '#1E1E2C' }
export const EDGE = '#262636'

const UNIT_LABEL = {
  'sci.phy': 'Physics', 'sci.chem': 'Chemistry', 'sci.bio': 'Biology', 'sci.env': 'Environment',
  'math.numbers': 'Numbers', 'math.algebra': 'Algebra', 'math.geometry': 'Geometry', 'math.coord': 'Coordinates',
  'math.trig': 'Trigonometry', 'math.mensuration': 'Mensuration', 'math.stats': 'Statistics',
}
/** Units that belong with a neighbour in every classroom: Our Environment is taught with Biology. */
const SITS_WITH = { 'sci.env': 'sci.bio' }
/** Fewer nodes than this is not a map. */
const MIN_MAP = 4

function subjectIdOf(graph, node) {
  let cur = node
  for (let i = 0; cur && i < 6; i++) {
    if (cur.kind === 'subject') return cur.id
    cur = cur.parent ? graph.byId.get(cur.parent) : null
  }
  return null
}

function labelFor(units) {
  const names = units.map(u => UNIT_LABEL[u.id] || u.name)
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  return `${names[0]} → ${names[names.length - 1]}`
}

/**
 * Chapters in groups of at most MAX_NODES, one chip each.
 *
 *   - a subject that fits is one map
 *   - a bigger subject splits per unit when every unit is a real map of its
 *     own (Science: Physics 4, Chemistry 4, Biology & Environment 5)
 *   - otherwise it becomes as few balanced maps as fit, cut on unit
 *     boundaries (Maths, 14 chapters: Numbers → Geometry 7, Coordinates →
 *     Statistics 7 -- not seven maps of two nodes)
 */
export function chapterGroups(graph) {
  if (!graph) return []
  const groups = []
  for (const s of graph.subjects || []) {
    const chapters = (graph.chapters || []).filter(c => subjectIdOf(graph, c) === s.id)
    if (!chapters.length) continue
    if (chapters.length <= MAX_NODES) { groups.push({ id: s.id, label: s.name, chapters }); continue }

    let parts = (graph.units || []).filter(u => u.parent === s.id)
      .map(u => ({ units: [u], chapters: chapters.filter(c => c.parent === u.id) }))
      .filter(p => p.chapters.length)
    for (const p of [...parts]) {
      const hostId = SITS_WITH[p.units[0].id]
      const host = hostId && parts.find(x => x !== p && x.units.some(u => u.id === hostId))
      if (host) { host.chapters = [...host.chapters, ...p.chapters]; host.units = [...host.units, ...p.units]; parts = parts.filter(x => x !== p) }
    }
    const mk = list => ({ id: list.flatMap(p => p.units).map(u => u.id).join('+'), label: labelFor(list.flatMap(p => p.units)), chapters: list.flatMap(p => p.chapters) })

    if (parts.every(p => p.chapters.length >= MIN_MAP && p.chapters.length <= MAX_NODES)) {
      groups.push(...parts.map(p => mk([p])))
      continue
    }
    const total = chapters.length
    const k = Math.ceil(total / MAX_NODES)
    const target = total / k
    let acc = [], accN = 0, made = 0
    const flush = () => { if (acc.length) { groups.push(mk(acc)); acc = []; accN = 0; made++ } }
    parts.forEach((p, i) => {
      const remaining = parts.length - i, left = k - made
      if (acc.length && (accN + p.chapters.length > MAX_NODES || (accN >= target && left > 1 && remaining >= left))) flush()
      acc.push(p); accN += p.chapters.length
    })
    flush()
  }
  return groups
}

/** 12-22px by marks, scaled inside the group so the spread is visible. */
export function nodeRadius(marks, minMarks = 0, maxMarks = 12) {
  const m = Number(marks) || 0
  const span = Math.max(1, maxMarks - minMarks)
  const t = Math.max(0, Math.min(1, (m - minMarks) / span))
  return Math.round(12 + t * 10)
}

/** Deterministic constellation inside a w×h box. Same input, same picture. */
export function layoutGroup(chapters, { w = 320, h = 240, pad = 10 } = {}) {
  const n = chapters.length
  if (!n) return { w, h, nodes: [] }
  const marks = chapters.map(c => Number(c.typical_marks) || 0)
  const minM = Math.min(...marks), maxM = Math.max(...marks)
  const cx = w / 2, cy = h / 2
  const R = Math.min(w, h) * 0.40
  const nodes = chapters.map((c, i) => {
    const a = i * 2.39996323 + 0.9                            // golden angle: even, non-repeating
    const r = n === 1 ? 0 : (0.25 + 0.75 * Math.sqrt((i + 0.5) / n)) * R
    return { id: c.id, name: c.name, marks: marks[i], x: cx + Math.cos(a) * r * (w / h), y: cy + Math.sin(a) * r, r: nodeRadius(marks[i], minM, maxM) }
  })
  // separation: a dozen passes, pushing apart any pair closer than r1 + r2 + gap
  for (let pass = 0; pass < 12; pass++) {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = nodes[i], b = nodes[j]
      let dx = b.x - a.x, dy = b.y - a.y
      let d = Math.hypot(dx, dy)
      if (d < 0.01) { dx = 1; dy = 0; d = 1 }
      const min = a.r + b.r + 18
      if (d < min) {
        const push = (min - d) / 2
        a.x -= (dx / d) * push; a.y -= (dy / d) * push
        b.x += (dx / d) * push; b.y += (dy / d) * push
      }
    }
    for (const p of nodes) {
      p.x = Math.max(pad + p.r, Math.min(w - pad - p.r, p.x))
      p.y = Math.max(pad + p.r, Math.min(h - pad - p.r, p.y))
    }
  }
  return { w, h, nodes: nodes.map(p => ({ ...p, x: Math.round(p.x), y: Math.round(p.y) })) }
}

/** Prerequisite links that stay inside the group. */
export function edgesFor(chapters) {
  const ids = new Set(chapters.map(c => c.id))
  const out = []
  for (const c of chapters) for (const p of c.prereq || []) if (ids.has(p)) out.push({ from: p, to: c.id })
  return out
}

/** The ramp step for a node state. Anything touched but not solid is shaky. */
export function paintFor(state) {
  const s = state?.state || 'UNTOUCHED'
  if (s === 'SOLID') return { key: 'solid', fill: RAMP.solid, stroke: null }
  if (s === 'UNTOUCHED') return { key: 'untouched', fill: RAMP.untouched, stroke: RAMP.untouchedStroke }
  return { key: 'shaky', fill: RAMP.shaky, stroke: null }
}

/** No mastery data at all → the map is not drawn. Never an empty constellation. */
export function mapIsEmpty(states) {
  if (!states || !states.size) return true
  for (const st of states.values()) if (st && (st.state !== 'UNTOUCHED' || (st.mastery || 0) > 0)) return false
  return true
}

/**
 * Chapters whose reviewed cards fall due within `withinDays`: chapter id →
 * days remaining (0 = due today or overdue). Cards never reviewed are new, not
 * fading, and are left out.
 */
export function fadingByChapter(graph, flashcards = [], now = Date.now(), { withinDays = 7 } = {}) {
  const out = new Map()
  if (!graph) return out
  for (const c of flashcards || []) {
    if (!c || typeof c.dueAt !== 'number' || (c.reviews || 0) < 1) continue
    const days = Math.ceil((c.dueAt - now) / DAY)
    if (days > withinDays) continue
    const ch = matchChapter(graph, c.subject, c.topic)
    if (!ch) continue
    const d = Math.max(0, days)
    out.set(ch, Math.min(out.has(ch) ? out.get(ch) : 99, d))
  }
  return out
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
export function numberWord(n) { return n >= 0 && n < WORDS.length ? WORDS[n] : String(n) }
const cap = s => s.charAt(0).toUpperCase() + s.slice(1)

/** Forgetting is not a personal failing; the copy must never read as one. */
export function fadingCallout(count) {
  if (!count) return null
  const one = count === 1
  // "all two" is not English: one → it, two → both, more → all three, all four…
  const them = one ? 'it' : count === 2 ? 'both' : `all ${numberWord(count)}`
  return {
    headline: `${cap(numberWord(count))} chapter${one ? '' : 's'} slip${one ? 's' : ''} below usable this week.`,
    body: `You learned ${one ? 'it' : 'them'} properly. Memory just does this — twenty minutes brings ${them} back.`,
    action: `Refresh ${them} · 20 min`,
  }
}

/* ── effort, for the league ───────────────────────────────────────────────── */

function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
export function weekStart(now = Date.now()) {
  const d = new Date(startOfDay(now))
  const day = (d.getDay() + 6) % 7          // Monday = 0
  d.setDate(d.getDate() - day)
  return d.getTime()
}

/** Study minutes since Monday, from the same two sources the planner reads. */
export function weekMinutes({ focusHistory = [], timeStore = null, now = Date.now() } = {}) {
  const from = weekStart(now)
  let ms = 0
  for (const r of Array.isArray(focusHistory) ? focusHistory : []) {
    if (r && typeof r.ts === 'number' && r.ts >= from) ms += Math.max(0, r.focusedMs || 0)
  }
  const rows = timeStore && timeStore.rows ? Object.values(timeStore.rows) : []
  for (const row of rows) {
    for (const [k, v] of Object.entries(row?.days || {})) {
      const t = Date.parse(k)
      if (Number.isFinite(t) && t >= from) ms += Math.max(0, Number(v) || 0)
    }
  }
  return Math.round(ms / 60_000)
}

/** Groups are formed on effort, never ability: minutes this week → band 1-4. */
export function effortBand(minutes) {
  const m = Math.max(0, Number(minutes) || 0)
  return m < 60 ? 1 : m < 180 ? 2 : m < 420 ? 3 : 4
}

export const GROUP_SIZE = 15
export const MIN_GROUP = 5

/** Top five move up; the rest stay put. Nobody drops. */
export function leagueSections(rows = []) {
  const sorted = [...rows].sort((a, b) => (b.xp || 0) - (a.xp || 0)).map((r, i) => ({ ...r, rank: i + 1 }))
  return { movingUp: sorted.slice(0, 5), stayingPut: sorted.slice(5) }
}

/** "2d 4h left" until next Monday. */
export function timeLeftLabel(now = Date.now()) {
  const next = weekStart(now) + 7 * DAY
  const ms = Math.max(0, next - now)
  const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / 3_600_000)
  return d > 0 ? `${d}d ${h}h left` : h > 0 ? `${h}h left` : 'ends today'
}

/** Elapsed minutes since joining a room. */
export function roomMinutes(joinedAt, now = Date.now()) {
  return Math.max(0, Math.floor((now - (joinedAt || now)) / 60_000))
}
