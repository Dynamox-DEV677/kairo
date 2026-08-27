/**
 * The space-bar bug, pinned down.
 *
 * Reels bound Space to "flip card" with preventDefault() on a window listener.
 * Pages stay mounted, so after one visit that handler swallowed the space bar
 * everywhere — the Solver turned a typed doubt into one unreadable word.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTypingTarget, isOnScreen, shouldHandleHotkey } from '../../src/lib/hotkeys.core.js'

const el = (tagName, extra = {}) => ({ tagName, closest: () => null, ...extra })

test('typing targets are recognised', () => {
  assert.equal(isTypingTarget(el('TEXTAREA')), true)
  assert.equal(isTypingTarget(el('INPUT')), true)
  assert.equal(isTypingTarget(el('SELECT')), true)
  assert.equal(isTypingTarget(el('input')), true, 'tagName casing must not matter')
  assert.equal(isTypingTarget(el('DIV', { isContentEditable: true })), true)
  assert.equal(isTypingTarget(el('SPAN', { closest: s => (s.includes('contenteditable') ? {} : null) })), true,
    'a span inside a contenteditable is still typing')
})

test('non-typing targets are not', () => {
  assert.equal(isTypingTarget(el('DIV')), false)
  assert.equal(isTypingTarget(el('BODY')), false)
  assert.equal(isTypingTarget(null), false)
  assert.equal(isTypingTarget(undefined), false)
})

test('a hidden container switches its page hotkeys off', () => {
  const shown  = { getClientRects: () => [{}] }
  const parked = { getClientRects: () => [] }        // display:none
  assert.equal(isOnScreen(shown), true)
  assert.equal(isOnScreen(parked), false)
  assert.equal(isOnScreen(null), true, 'no container given → never silently disable')
})

test('checkVisibility wins when the engine has it', () => {
  assert.equal(isOnScreen({ checkVisibility: () => false, getClientRects: () => [{}] }), false)
  assert.equal(isOnScreen({ checkVisibility: () => true }), true)
  assert.equal(isOnScreen({ checkVisibility() { throw new Error('unsupported') }, getClientRects: () => [] }), false,
    'a throwing checkVisibility falls through to rects, it does not fail open')
})

test('THE BUG: space typed into the Solver never reaches the Reels handler', () => {
  const reelsParked = { getClientRects: () => [] }
  const solverBox = el('TEXTAREA')
  assert.equal(
    shouldHandleHotkey({ key: ' ', target: solverBox }, { container: reelsParked }),
    false)
})

test('and it would still be blocked even if Reels were somehow visible', () => {
  const visible = { getClientRects: () => [{}] }
  assert.equal(shouldHandleHotkey({ key: ' ', target: el('TEXTAREA') }, { container: visible }), false,
    'typing beats visibility — two independent guards, not one')
})

test('arrow keys in a text field cannot advance the deck', () => {
  // This one was persisting the new position: moving the cursor while editing a
  // doubt was rewriting the student's revision queue in localStorage.
  for (const key of ['ArrowLeft', 'ArrowRight']) {
    assert.equal(shouldHandleHotkey({ key, target: el('INPUT') }, {}), false, key)
  }
})

test('the hotkey still works where it should', () => {
  const visible = { getClientRects: () => [{}] }
  assert.equal(shouldHandleHotkey({ key: ' ', target: el('DIV') }, { container: visible }), true)
  assert.equal(shouldHandleHotkey({ key: ' ', target: el('BODY') }, { container: visible }), true,
    'body is the target when nothing is focused — the normal case')
})

test('allowWhileTyping is honoured, for Escape and Ctrl+K only', () => {
  assert.equal(
    shouldHandleHotkey({ key: 'Escape', target: el('INPUT') }, { allowWhileTyping: true }),
    true)
  // but it must not also override visibility
  assert.equal(
    shouldHandleHotkey({ key: 'Escape', target: el('INPUT') },
      { allowWhileTyping: true, container: { getClientRects: () => [] } }),
    false)
})

test('a missing event is never handled', () => {
  assert.equal(shouldHandleHotkey(null), false)
  assert.equal(shouldHandleHotkey(undefined), false)
})
