/**
 * The Doubt Solving whiteboard and the Reader's colour highlights.
 *
 * What these pin: the eraser removes whole strokes it actually touches; the
 * checker's reply can never claim a wrong line that does not exist or call a
 * board "correct" while marking a line wrong; the server's board prompt never
 * hands over the answer; and highlight rectangles are stored as page
 * fractions, merged per line, clipped to the page, so a mark lands on the same
 * words at any zoom.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { distToSegment, eraseHits, inkBounds, normalizeBoardResult, boardVerdict } from '../../src/lib/whiteboard.core.js'
import { selectionRects, validRects, marksOnPage, bookMarks, MARK_COLORS, MARK_FILL, MARK_LABEL, MARK_SWATCH } from '../../src/lib/marks.core.js'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')

/* ── whiteboard ──────────────────────────────────────────────────────────── */

test('the eraser takes whole strokes it touches, and only those', () => {
  const strokes = [
    { mode: 'pen', points: [[0.1, 0.1], [0.4, 0.1]] },   // a horizontal line
    { mode: 'pen', points: [[0.1, 0.5], [0.1, 0.8]] },   // a vertical line, far away
    { mode: 'pen', points: [[0.7, 0.7]] },               // a dot
  ]
  assert.deepEqual(eraseHits(strokes, 0.25, 0.11, 0.03), [0], 'touching the middle of a segment counts')
  assert.deepEqual(eraseHits(strokes, 0.71, 0.7, 0.03), [2], 'a single-point stroke can be erased')
  assert.deepEqual(eraseHits(strokes, 0.6, 0.3, 0.03), [], 'empty space erases nothing')
  assert.ok(Math.abs(distToSegment(0, 1, 0, 0, 2, 0) - 1) < 1e-9)
  assert.ok(Math.abs(distToSegment(3, 0, 0, 0, 2, 0) - 1) < 1e-9, 'past the end measures to the end point')
})

test('the ink bounds cover every stroke, and an empty board has none', () => {
  assert.equal(inkBounds([]), null)
  assert.deepEqual(inkBounds([{ points: [[0.2, 0.3], [0.5, 0.1]] }, { points: [[0.9, 0.6]] }]),
    { minX: 0.2, minY: 0.1, maxX: 0.9, maxY: 0.6 })
})

test("the checker's reply is made consistent before it is shown", () => {
  const r = normalizeBoardResult({
    readable: true, status: 'correct', firstWrongLine: 7, feedback: 'Check the sign on line 2.',
    lines: [{ n: 1, text: '3x + 7 = 22', ok: true }, { n: 2, text: '3x = 29', ok: false }, { n: 3, text: '', ok: true }],
  })
  assert.equal(r.status, 'mistake', 'a wrong line means a mistake, whatever the model claimed')
  assert.equal(r.firstWrongLine, 2, 'line 7 does not exist; the first line marked wrong is used')
  assert.equal(r.lines.length, 2, 'empty lines are dropped')
  assert.equal(r.done, false)

  const ok = normalizeBoardResult({ status: 'mistake', lines: [{ n: 1, text: 'x = 5', ok: true }], done: true })
  assert.equal(ok.status, 'inprogress', "no line is wrong, so it can't be a mistake")
  assert.equal(ok.done, false, 'done only counts for a correct board')

  const fin = normalizeBoardResult({ status: 'correct', done: true, lines: [{ n: 1, text: 'x = 5', ok: true }] })
  assert.equal(fin.status, 'correct')
  assert.equal(fin.done, true)

  assert.equal(normalizeBoardResult({ readable: false, lines: [{ n: 1, text: 'x', ok: false }] }).status, 'unclear')
  assert.equal(normalizeBoardResult(null).status, 'unclear')
  assert.equal(normalizeBoardResult('garbage').lines.length, 0)
})

test('the headline matches the result', () => {
  assert.match(boardVerdict({ status: 'mistake', firstWrongLine: 3 }).title, /Line 3/)
  assert.equal(boardVerdict({ status: 'correct', done: true }).tone, 'good')
  assert.equal(boardVerdict({ status: 'unclear' }).tone, 'info')
})

test('the server checks the board line by line and never gives the answer', () => {
  const src = read('server', 'routes', 'cameraLive.js')
  assert.match(src, /board: \(ctx\) => `/)
  assert.match(src, /Do NOT give the final answer and do NOT write the corrected step/)
  assert.match(src, /"firstWrongLine"/)
  assert.match(src, /mode === 'board' \? 1600/, 'enough tokens for a reasoning model to judge every line')
})

test('Doubt Solving offers the board on the home screen and the answer screen', () => {
  const src = read('src', 'pages', 'DoubtSolving.tsx')
  assert.match(src, /import Whiteboard from '\.\.\/components\/Whiteboard'/)
  assert.match(src, /openBoard\(input\.trim\(\)\)/, 'home: "Check my working"')
  assert.match(src, /openBoard\(question\)/, 'answer: "Try it on the whiteboard"')
  assert.equal((src.match(/\{boardEl\}/g) || []).length, 2, 'the same keyed board in both views')
  const board = read('src', 'components', 'Whiteboard.tsx')
  assert.match(board, /mode: 'board'/)
  assert.match(board, /if \(!\(e\.buttons & 1\)\) return/, 'a hovering pen or mouse never draws')
})

/* ── colour highlights ───────────────────────────────────────────────────── */

const box = { left: 100, top: 200, width: 400, height: 600 }

test('a selection becomes page fractions, merged per line', () => {
  // Three span rects on one line (touching), one on the next line.
  const rects = [
    { left: 120, top: 230, right: 180, bottom: 246, width: 60, height: 16 },
    { left: 181, top: 231, right: 260, bottom: 246, width: 79, height: 15 },
    { left: 262, top: 230, right: 300, bottom: 246, width: 38, height: 16 },
    { left: 120, top: 252, right: 220, bottom: 268, width: 100, height: 16 },
  ]
  const out = selectionRects(rects, box)
  assert.equal(out.length, 2, 'one rectangle per line')
  assert.deepEqual(out[0], { x: 0.05, y: 0.05, w: 0.45, h: 0.02667 })
  assert.equal(out[1].y, round((252 - 200) / 600))
  for (const r of out) assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 1 && r.y + r.h <= 1)
})

function round(n) { return Math.round(n * 1e5) / 1e5 }

test('anything off the page is clipped, and slivers are dropped', () => {
  const out = selectionRects([
    { left: 50, top: 210, right: 150, bottom: 226, width: 100, height: 16 },   // starts left of the page
    { left: 300, top: 300, right: 300.5, bottom: 316, width: 0.5, height: 16 }, // a sliver
  ], box)
  assert.equal(out.length, 1)
  assert.equal(out[0].x, 0)
  assert.deepEqual(selectionRects([], box), [])
  assert.deepEqual(selectionRects([{ left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }], { left: 0, top: 0, width: 0, height: 0 }), [])
})

test('only valid marks of this page are drawn, in reading order in the list', () => {
  const ok = { x: 0.1, y: 0.1, w: 0.2, h: 0.02 }
  const hs = [
    { id: 'a', action: 'mark', page: 3, color: 'yellow', rects: [ok] },
    { id: 'b', action: 'mark', page: 3, color: 'purple', rects: [ok] },           // not a highlighter colour
    { id: 'c', action: 'mark', page: 3, color: 'green', rects: [{ x: 0.9, y: 0.1, w: 0.5, h: 0.02 }] }, // runs off the page
    { id: 'd', action: 'explain', page: 3, color: 'yellow', rects: [ok] },        // a queued action, not a mark
    { id: 'e', action: 'mark', page: 1, color: 'pink', rects: [{ ...ok, y: 0.5 }] },
    { id: 'f', action: 'mark', page: 1, color: 'green', rects: [{ ...ok, y: 0.2 }] },
  ]
  assert.deepEqual(marksOnPage(hs, 3).map(h => h.id), ['a'])
  assert.deepEqual(bookMarks(hs).map(h => h.id), ['f', 'e', 'a', 'c'])
  assert.equal(validRects([ok, { x: NaN, y: 0, w: 1, h: 1 }, null]).length, 1)
})

test('every colour has a fill, a swatch and a purpose', () => {
  for (const c of MARK_COLORS) {
    assert.ok(MARK_FILL[c] && MARK_SWATCH[c] && MARK_LABEL[c], c)
  }
})

test('the Reader saves marks as page fractions and draws them under the text layer', () => {
  const src = read('src', 'pages', 'Reader.tsx')
  assert.match(src, /selectionRects\(Array\.from\(s\.getRangeAt\(0\)\.getClientRects\(\)\), box\)/)
  assert.match(src, /action: 'mark', color, rects/)
  assert.match(src, /mixBlendMode: 'multiply', pointerEvents: 'none'/, 'marks never block selecting text')
  assert.match(read('src', 'components', 'BookStudio.tsx'), /\{ id: 'marks', label: 'Highlights', icon: Highlighter \}/)
})
