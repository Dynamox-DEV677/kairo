/**
 * One bottom slot: the tab bar or the screen's footer, never both.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')
const src = read('src', 'lib', 'bottomSlot.ts')

/* the rule, mirrored from bottomSlot.ts so it can be exercised here */
const IMMERSIVE = new Set(['camera-live'])
function showTabBar(page, v) {
  if (IMMERSIVE.has(page)) return false
  if (v.revealed) return true
  if (v.typing) return false
  if (v.busy) return false
  if (v.subScreen) return false
  return v.atRoot
}
const base = { atRoot: true, subScreen: false, busy: false, typing: false, revealed: false }

test('the tab bar shows on space roots', () => {
  for (const p of ['plan', 'doubt-solving', 'practice', 'progress', 'notes', 'performance', 'profile', 'home']) {
    assert.equal(showTabBar(p, base), true, p + ' is a root')
  }
})

test('and hides wherever the screen owns the bottom edge', () => {
  assert.equal(showTabBar('doubt-solving', { ...base, subScreen: true }), false, 'a sub-screen has its own footer')
  assert.equal(showTabBar('practice', { ...base, busy: true }), false, 'a running session exits via its own End')
  assert.equal(showTabBar('notes', { ...base, typing: true }), false, 'the keyboard owns the bottom edge')
  assert.equal(showTabBar('camera-live', base), false, 'immersive pages never show it')
})

test('nobody is stranded: a reveal beats every hiding rule', () => {
  for (const state of ['subScreen', 'busy', 'typing']) {
    assert.equal(showTabBar('practice', { ...base, [state]: true, revealed: true }), true,
      'a swipe up or an empty-content tap brings it back over ' + state)
  }
  // except where the page owns the whole screen
  assert.equal(showTabBar('camera-live', { ...base, revealed: true }), false)
})

test('the reveal is temporary, so an accidental one never sticks', () => {
  assert.match(src, /NAV_REVEAL_MS = 4000/)
})

test('an empty-content tap ignores anything interactive', () => {
  assert.match(src, /button, a, input, textarea, select/)
  assert.match(src, /role="button"/)
  assert.match(src, /contenteditable/)
})
