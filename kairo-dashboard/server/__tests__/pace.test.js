/**
 * Plan — the pace model, against realistic rows.
 *
 * Three screens read this model and it must never disagree with itself. These
 * pin the rules that keep it honest: median not mean, no projection under a
 * week of history, coverage weighted by marks, a target that is never shown
 * once it is out of reach, and a "leave it as it is" option that is a real
 * choice.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadGraph } from '../../src/lib/syllabusGraph.core.js'
import {
  dailyMinutes, coverageSplit, minutesNeeded, project, honestLine, weekStrip, missedRun,
  chapterRows, untouchedCallout, defaultTopicPlan, adjustOptions, elapsedMs, remainingMs, driftLine,
  MIN_HISTORY_DAYS,
} from '../../src/lib/pace.core.js'

const DAY = 86_400_000
// a Wednesday at noon, so the week strip has past, today and future tiles
const NOW = new Date(2026, 8, 2, 12, 0, 0).getTime()
const graph = loadGraph(JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'data', 'syllabusGraph', 'cbse10.json'), 'utf-8')))

const focus = (daysAgo, minutes) => ({ ts: NOW - daysAgo * DAY, focusedMs: minutes * 60_000 })

/* ── daily minutes ────────────────────────────────────────────────────────── */

test('the daily figure is a MEDIAN — one three-hour panic day does not flatter it', () => {
  const hist = [focus(1, 20), focus(2, 20), focus(3, 20), focus(4, 20), focus(5, 20), focus(6, 20), focus(7, 180)]
  const d = dailyMinutes({ focusHistory: hist, now: NOW })
  assert.equal(d.days, 7)
  assert.equal(d.median, 20, 'mean would say 43')
})

test('no projection under seven days of data', () => {
  const d = dailyMinutes({ focusHistory: [focus(1, 60), focus(2, 60)], now: NOW })
  assert.equal(d.days, 2)
  assert.equal(d.median, null)
  assert.equal(MIN_HISTORY_DAYS, 7)
})

test('focus history and the topic time store add up per day, and old days fall outside the window', () => {
  const key = (daysAgo) => { const t = new Date(NOW - daysAgo * DAY); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` }
  const store = { rows: { 'Physics|motion': { ms: 0, days: { [key(1)]: 10 * 60_000, [key(20)]: 999 * 60_000 } } } }
  const d = dailyMinutes({ focusHistory: [focus(1, 15)], timeStore: store, now: NOW })
  assert.equal(Math.round(d.byDay.get(key(1))), 25)
  assert.equal(d.byDay.has(key(20)), false)
})

/* ── coverage ─────────────────────────────────────────────────────────────── */

const statesWith = (map) => new Map(graph.chapters.map(c => [c.id, map[c.id] || { state: 'UNTOUCHED', mastery: 0, retention: 1, lastContact: 0 }]))

test('coverage is weighted by marks, and shaky is not solid', () => {
  const st = statesWith({
    'math.geometry.triangles': { state: 'SOLID', mastery: 0.8, retention: 1 },      // 9 marks
    'math.algebra.polynomials': { state: 'PRACTISED', mastery: 0.4, retention: 1 }, // 4 marks
  })
  const c = coverageSplit(graph, st)
  assert.equal(c.totalMarks, 160)
  assert.equal(c.solidPct, Math.round(9 / 160 * 100))
  assert.equal(c.shakyPct, Math.round(4 / 160 * 100))
  assert.equal(c.solidPct + c.shakyPct + c.untouchedPct, 100)
})

test('minutes needed skips solid chapters and scales partial ones by what is missing', () => {
  const all = minutesNeeded(graph, statesWith({}))
  const some = minutesNeeded(graph, statesWith({
    'math.geometry.triangles': { state: 'SOLID', mastery: 0.9 },                    // 330 min gone
    'math.algebra.polynomials': { state: 'PRACTISED', mastery: 0.5 },               // 120 -> 60
  }))
  assert.equal(all - some, 330 + 60)
})

/* ── projection + the honest line ─────────────────────────────────────────── */

test('project() lands the current pace and prices the target', () => {
  // 40% solid, 3000 minutes still needed, 20 min/day, 30 days
  const p = project({ solidPct: 40, needMinutes: 3000, dailyMedian: 20, daysLeft: 30, target: 90 })
  // 60 points remaining over 3000 minutes = 0.02 points/min; 20*30*0.02 = 12 -> 52%
  assert.equal(p.projected, 52)
  // gap 50 points / 0.02 = 2500 minutes / 30 days = 84 min/day
  assert.equal(p.required, 84)
  assert.equal(p.reachable, 90)
  assert.match(honestLine(p, 20), /^At 20 minutes a day you reach 52% by exam day\. Eighty-four minutes a day gets you to 90%\.$/)
})

test('a target that is out of reach is never shown — the reachable one is', () => {
  // 3 days left, 3000 minutes needed: even 4 h/day only buys 240*3*0.02 = 14 points
  const p = project({ solidPct: 40, needMinutes: 3000, dailyMedian: 20, daysLeft: 3, target: 90 })
  assert.ok(p.reachable < 90)
  assert.equal(p.reachable, 50)
  const line = honestLine(p, 20)
  assert.match(line, /90% is out of reach now/)
  assert.match(line, /gets you to 50%/)
})

test('without a week of history the line promises nothing', () => {
  const p = project({ solidPct: 40, needMinutes: 3000, dailyMedian: null, daysLeft: 30 })
  assert.equal(p.projected, null)
  assert.match(honestLine(p, null), /about a week of your real study time/)
})

test('a pace that already clears the target says so, and big numbers read as digits', () => {
  const p = project({ solidPct: 80, needMinutes: 500, dailyMedian: 60, daysLeft: 30, target: 90 })
  assert.ok(p.projected >= 90)
  assert.match(honestLine(p, 60), /already clears 90%/)
  const q = project({ solidPct: 10, needMinutes: 6000, dailyMedian: 10, daysLeft: 20, target: 90 })
  assert.match(honestLine(q, 10), /\d{3} minutes a day|out of reach/)
  assert.ok(!/undefined/.test(honestLine(q, 10)))
})

/* ── week strip ───────────────────────────────────────────────────────────── */

test('the week strip counts days and never judges them', () => {
  const byDay = dailyMinutes({ focusHistory: [focus(1, 30), focus(2, 30)], now: NOW }).byDay
  const w = weekStrip(byDay, NOW)
  assert.equal(w.tiles.length, 7)
  assert.equal(w.header, '2 of 7 days')
  const today = w.tiles.find(t => t.state === 'today')
  assert.ok(today, 'today with no minutes yet is "today", not "missed"')
  assert.equal(w.tiles.filter(t => t.state === 'future').length, 4, 'Thu-Sun are future on a Wednesday')
  assert.equal(w.tiles.filter(t => t.state === 'done').length, 2)
})

test('missedRun counts consecutive days ending yesterday; today is still running', () => {
  const byDay = dailyMinutes({ focusHistory: [focus(4, 30)], now: NOW }).byDay
  assert.equal(missedRun(byDay, NOW), 3)
  assert.equal(missedRun(new Map(), NOW), 30)
})

/* ── syllabus map ─────────────────────────────────────────────────────────── */

test('chapter rows are sorted by marks × weakness, never by chapter order; solid ones collapse', () => {
  const st = statesWith({ 'math.geometry.triangles': { state: 'SOLID', mastery: 0.9, retention: 1 } })
  const { open, done } = chapterRows(graph, st, { sessionMin: 30 })
  assert.equal(done.length, 1)
  assert.equal(done[0].name, 'Triangles')
  assert.ok(open.every((r, i) => i === 0 || open[i - 1].score >= r.score), 'descending by risk')
  // the first open row is a high-marks untouched chapter, not "Real Numbers" (chapter 1)
  assert.notEqual(open[0].name, 'Real Numbers')
  const big = open.find(r => r.name === 'Electricity')
  assert.equal(big.atRisk, true)
  assert.match(big.status, /^Not started · needs about \d+ sessions?$/)
})

test('session counts come from the student\'s real median session, not 25', () => {
  const { open } = chapterRows(graph, statesWith({}), { sessionMin: 60 })
  const e60 = open.find(r => r.name === 'Electricity').sessions   // 360 / 60 = 6
  const { open: open2 } = chapterRows(graph, statesWith({}), { sessionMin: 20 })
  const e20 = open2.find(r => r.name === 'Electricity').sessions  // 360 / 20 = 18
  assert.equal(e60, 6); assert.equal(e20, 18)
})

test('the untouched callout appears only when real marks are at stake', () => {
  const { open } = chapterRows(graph, statesWith({}))
  const c = untouchedCallout(open)
  assert.ok(c && c.marks === 160)
  assert.match(c.headline, /untouched chapters are worth 160 marks together/)
  assert.equal(untouchedCallout(open.map(r => ({ ...r, state: 'PRACTISED' }))), null)
})

/* ── topic plan ───────────────────────────────────────────────────────────── */

test('the default topic plan is three sessions that always end on TEST', () => {
  const node = graph.chapters.find(c => c.name === 'Electricity')
  const plan = defaultTopicPlan(node, { daysLeft: 12, now: NOW })
  assert.deepEqual(plan.sessions.map(s => s.kind), ['LEARN', 'PRACTISE', 'TEST'])
  assert.ok(plan.sessions.every(s => s.minutes >= 15))
  assert.match(plan.framing, /^Three sessions over five days\. Twelve days left, so this finishes with room to revise\.$/)
  // a small chapter is two sessions, still ending on TEST
  const small = defaultTopicPlan(graph.chapters.find(c => c.name === 'Probability'), { daysLeft: 12, now: NOW })
  assert.deepEqual(small.sessions.map(s => s.kind), ['LEARN', 'TEST'])
})

/* ── adjust ───────────────────────────────────────────────────────────────── */

test('adjust offers three real options; leaving it alone is a choice with the same standing', () => {
  const p = project({ solidPct: 40, needMinutes: 3000, dailyMedian: 20, daysLeft: 30, target: 90 })
  const { open } = chapterRows(graph, statesWith({}))
  const a = adjustOptions({ p, dailyMedian: 20, rows: open, target: 90 })
  assert.equal(a.options.length, 3)
  assert.equal(a.options[0].id, 'more'); assert.equal(a.options[0].to, 61)      // +15/day: 35*30*0.02 = 21 -> 61
  assert.equal(a.options[1].id, 'skip'); assert.ok(a.options[1].to > a.now)
  assert.match(a.options[1].detail, /blank on those/)
  assert.equal(a.options[2].id, 'keep'); assert.equal(a.options[2].to, a.now)
  assert.equal(a.options[2].tone, 'neutral')
  // no alarm words on the neutral option -- the brief's own copy says "not a failure", which is the point
  assert.ok(!/warning|behind|broke|lost/i.test(a.options[2].title + a.options[2].detail))
})

/* ── focus timer ──────────────────────────────────────────────────────────── */

test('elapsed time is wall-clock and survives a pause', () => {
  const s = { startedAt: NOW - 10 * 60_000, plannedMs: 25 * 60_000, pausedMs: 2 * 60_000, pausedAt: null }
  assert.equal(elapsedMs(s, NOW), 8 * 60_000)
  assert.equal(remainingMs(s, NOW), 17 * 60_000)
  const paused = { ...s, pausedAt: NOW - 60_000 }
  assert.equal(elapsedMs(paused, NOW), 7 * 60_000, 'a live pause keeps growing')
  assert.equal(remainingMs({ startedAt: NOW - 60 * 60_000, plannedMs: 25 * 60_000 }, NOW), 0, 'never negative')
})

test('the drift line is accountability, not enforcement', () => {
  assert.equal(driftLine(0, 0), null)
  assert.deepEqual(driftLine(2, 4 * 60_000), { left: 'You left the app twice', lost: '4 min lost' })
  assert.equal(driftLine(1, 20_000).lost, 'under a minute lost')
})
