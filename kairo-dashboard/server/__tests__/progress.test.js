/**
 * Progress -- the map's arithmetic. Twelve nodes at most, one sequential
 * ramp, layouts that never move, fading dates that come from the scheduler,
 * groups formed on effort. None of it calls a model.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadGraph } from '../../src/lib/syllabusGraph.core.js'
import {
  MAX_NODES, chapterGroups, layoutGroup, edgesFor, nodeRadius, paintFor, mapIsEmpty, fadingByChapter, fadingCallout,
  weekMinutes, weekStart, effortBand, leagueSections, timeLeftLabel, numberWord,
} from '../../src/lib/progress.core.js'

const GRAPH = loadGraph(JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'data', 'syllabusGraph', 'cbse10.json'), 'utf-8')))
const DAY = 86_400_000

test('every chapter lands in exactly one group of at most twelve nodes, and every group is a real map', () => {
  const groups = chapterGroups(GRAPH)
  const seen = new Map()
  for (const g of groups) {
    assert.ok(g.chapters.length <= MAX_NODES, `${g.label}: ${g.chapters.length} nodes`)
    assert.ok(g.chapters.length >= 4, `${g.label} is too small to be a map (${g.chapters.length})`)
    for (const c of g.chapters) { assert.equal(seen.has(c.id), false, `${c.id} in two groups`); seen.set(c.id, g.id) }
  }
  assert.equal(seen.size, GRAPH.chapters.length)
  const labels = groups.map(g => g.label)
  assert.deepEqual(labels.filter(l => /Physics|Chemistry|Biology/.test(l)).sort(), ['Biology & Environment', 'Chemistry', 'Physics'],
    'Science splits into the three sciences students name; Our Environment sits with Biology')
  const maths = groups.filter(g => g.chapters.every(c => c.id.startsWith('math')))
  assert.equal(maths.length, 2, 'fourteen Maths chapters become two balanced maps, not seven tiny ones')
  for (const g of maths) assert.ok(g.chapters.length >= 5 && g.chapters.length <= 9, `${g.label}: ${g.chapters.length}`)
  assert.deepEqual(maths.map(g => g.label), ['Numbers → Geometry', 'Coordinates → Statistics'])
})

test('the layout is deterministic, inside the box, and nodes do not overlap', () => {
  const group = chapterGroups(GRAPH).find(g => g.chapters.some(c => c.id === 'math.algebra.quadratic'))
  const a = layoutGroup(group.chapters), b = layoutGroup(group.chapters)
  assert.deepEqual(a, b, 'same input, same picture')
  for (const n of a.nodes) {
    assert.ok(n.x - n.r >= 0 && n.x + n.r <= a.w && n.y - n.r >= 0 && n.y + n.r <= a.h, `${n.id} escapes the box`)
    assert.ok(n.r >= 12 && n.r <= 22)
  }
  for (let i = 0; i < a.nodes.length; i++) for (let j = i + 1; j < a.nodes.length; j++) {
    const p = a.nodes[i], q = a.nodes[j]
    assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= p.r + q.r + 4, `${p.id} overlaps ${q.id}`)
  }
  const edges = edgesFor(group.chapters)
  assert.ok(edges.length >= 3, 'prerequisite links exist inside Maths')
  for (const e of edges) assert.ok(group.chapters.some(c => c.id === e.from) && group.chapters.some(c => c.id === e.to))
})

test('radius follows marks, 12 to 22', () => {
  assert.equal(nodeRadius(2, 2, 10), 12)
  assert.equal(nodeRadius(10, 2, 10), 22)
  assert.equal(nodeRadius(6, 2, 10), 17)
})

test('one ramp: solid, shaky, untouched -- and nothing else', () => {
  assert.equal(paintFor({ state: 'SOLID' }).key, 'solid')
  assert.equal(paintFor({ state: 'PRACTISED' }).key, 'shaky')
  assert.equal(paintFor({ state: 'FADING' }).key, 'shaky')
  assert.equal(paintFor({ state: 'SEEN' }).key, 'shaky')
  assert.equal(paintFor({ state: 'UNTOUCHED' }).key, 'untouched')
  assert.equal(paintFor(null).key, 'untouched')
  assert.ok(paintFor({ state: 'UNTOUCHED' }).stroke, 'untouched gets the stroke so it stays visible on dark')
})

test('no mastery data means no constellation', () => {
  assert.equal(mapIsEmpty(new Map()), true)
  assert.equal(mapIsEmpty(new Map([['a', { state: 'UNTOUCHED', mastery: 0 }]])), true)
  assert.equal(mapIsEmpty(new Map([['a', { state: 'UNTOUCHED', mastery: 0 }], ['b', { state: 'SEEN', mastery: 0.2 }]])), false)
})

test('the fading lens reads the scheduler: reviewed cards due within a week, by chapter, days remaining', () => {
  const now = Date.UTC(2026, 8, 4, 9)
  const cards = [
    { subject: 'Physics', topic: 'ohm\'s law', reviews: 3, dueAt: now + 2 * DAY },
    { subject: 'Physics', topic: 'electric power', reviews: 1, dueAt: now + 5 * DAY },   // same chapter, later
    { subject: 'Maths', topic: 'quadratic formula', reviews: 2, dueAt: now - DAY },        // overdue → 0
    { subject: 'Maths', topic: 'probability', reviews: 0, dueAt: now + DAY },              // never reviewed: new, not fading
    { subject: 'Physics', topic: 'refraction', reviews: 4, dueAt: now + 20 * DAY },        // fine for now
  ]
  const f = fadingByChapter(GRAPH, cards, now)
  assert.equal(f.get('sci.phy.electricity'), 2, 'the soonest card sets the chapter')
  assert.equal(f.get('math.algebra.quadratic'), 0)
  assert.equal(f.has('math.stats.probability'), false)
  assert.equal(f.has('sci.phy.light'), false)
})

test('the callout says forgetting is normal, and counts in words', () => {
  const three = fadingCallout(3)
  assert.equal(three.headline, 'Three chapters slip below usable this week.')
  assert.equal(three.body, 'You learned them properly. Memory just does this — twenty minutes brings all three back.')
  assert.equal(three.action, 'Refresh all three · 20 min')
  assert.equal(fadingCallout(1).headline, 'One chapter slips below usable this week.')
  assert.equal(fadingCallout(1).action, 'Refresh it · 20 min')
  // "all two" is not English
  assert.equal(fadingCallout(2).action, 'Refresh both · 20 min')
  assert.match(fadingCallout(2).body, /brings both back/)
  assert.equal(fadingCallout(0), null)
  assert.equal(numberWord(13), '13')
})

test('effort is minutes since Monday from both time sources, and bands never mention ability', () => {
  const now = Date.UTC(2026, 8, 3, 12)              // a Thursday
  const monday = weekStart(now)
  assert.equal(new Date(monday).getDay(), 1)
  const minutes = weekMinutes({
    focusHistory: [{ ts: monday + DAY, focusedMs: 25 * 60_000 }, { ts: monday - DAY, focusedMs: 90 * 60_000 }],
    timeStore: { rows: { a: { days: { [new Date(monday + 2 * DAY).toISOString().slice(0, 10)]: 35 * 60_000 } } } },
    now,
  })
  assert.equal(minutes, 60, 'last week\'s 90 minutes do not count')
  assert.equal(effortBand(0), 1); assert.equal(effortBand(59), 1); assert.equal(effortBand(60), 2)
  assert.equal(effortBand(300), 3); assert.equal(effortBand(1000), 4)
})

test('top five move up, the rest stay put, nobody is relegated', () => {
  const rows = Array.from({ length: 9 }, (_, i) => ({ username: `u${i}`, xp: i * 10 }))
  const { movingUp, stayingPut } = leagueSections(rows)
  assert.equal(movingUp.length, 5); assert.equal(stayingPut.length, 4)
  assert.equal(movingUp[0].username, 'u8'); assert.equal(movingUp[0].rank, 1)
  assert.equal(stayingPut[3].rank, 9)
  assert.match(timeLeftLabel(Date.UTC(2026, 8, 3, 12)), /\dd \d+h left/)
})
