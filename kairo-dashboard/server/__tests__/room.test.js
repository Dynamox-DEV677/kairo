/**
 * C3 Study Rooms — the shared-timer rules. Convergence is the whole game:
 * every client applies these functions to the same events, so every client
 * must land on the same state with no coordinator.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  newRoomCode, cleanCode, isValidCode, CODE_LEN,
  idleState, startFocus, startBreak, stopTimer, nextPhase,
  remainingMs, phaseDone, applyTimerEvent, clockLabel, FOCUS_MIN,
} from '../../src/lib/room.core.js'

const NOW = 1_700_000_000_000

test('room codes are readable-aloud: no 0/O/1/I/5/S, fixed length', () => {
  for (let i = 0; i < 200; i++) {
    const c = newRoomCode()
    assert.equal(c.length, CODE_LEN)
    assert.ok(!/[0O1I5S]/.test(c), c)
    assert.ok(isValidCode(c), c)
  }
})

test('typed codes are cleaned for formatting but NEVER auto-corrected', () => {
  assert.equal(cleanCode(' abc-234 '), 'ABC234')
  assert.ok(isValidCode('abc 234'))
  // 0 and O are not in the alphabet; a code containing them is invalid, not
  // silently mapped onto some other room.
  assert.ok(!isValidCode('ABC230'))
  assert.ok(!isValidCode('ABCO34'))
  assert.ok(!isValidCode('ABC23'))
})

test('the timer walks focus -> break -> focus with fresh clocks', () => {
  let t = idleState()
  t = startFocus(t, { now: NOW, by: 'A' })
  assert.equal(t.phase, 'focus')
  assert.equal(t.endsAt, NOW + FOCUS_MIN * 60_000)
  assert.equal(remainingMs(t, NOW + 60_000), (FOCUS_MIN - 1) * 60_000)

  const atEnd = t.endsAt
  assert.ok(phaseDone(t, atEnd))
  t = nextPhase(t, { now: atEnd, by: 'B' })
  assert.equal(t.phase, 'break')
  assert.equal(t.by, 'B')
  t = nextPhase(t, { now: t.endsAt, by: 'A' })
  assert.equal(t.phase, 'focus')

  t = stopTimer(t, { by: 'A' })
  assert.equal(t.phase, 'idle')
  assert.equal(remainingMs(t, NOW), 0)
})

test('every action bumps seq, so stale broadcasts lose', () => {
  const base = startFocus(idleState(), { now: NOW, by: 'A' }) // seq 1
  const newer = stopTimer(base, { by: 'B' })                  // seq 2
  // A's stale copy arrives after B's stop: B's state must survive.
  assert.equal(applyTimerEvent(newer, base).phase, 'idle')
  // …and B's newer state overwrites A's older copy.
  assert.equal(applyTimerEvent(base, newer).phase, 'idle')
})

test('a seq tie (two members act in the same beat) converges the same everywhere', () => {
  const cur = startFocus(idleState(), { now: NOW, by: 'A' })
  const a = nextPhase(cur, { now: NOW + 1000, by: 'A' }) // seq 2
  const b = nextPhase(cur, { now: NOW + 1500, by: 'B' }) // seq 2, later end
  // Whichever order the two broadcasts arrive in, both clients end on b.
  assert.deepEqual(applyTimerEvent(a, b), b)
  assert.deepEqual(applyTimerEvent(b, a), b)
})

test('junk broadcasts are ignored, and a joiner adopts any real state', () => {
  const real = startFocus(idleState(), { now: NOW, by: 'A' })
  assert.deepEqual(applyTimerEvent(real, null), real)
  assert.deepEqual(applyTimerEvent(real, { seq: 'x' }), real)
  // A fresh joiner (seq 0) adopts the room's state on the first reply.
  assert.deepEqual(applyTimerEvent(idleState(), real), real)
})

test('the big clock formats like a clock', () => {
  assert.equal(clockLabel(25 * 60_000), '25:00')
  assert.equal(clockLabel(59_400), '01:00') // ceils, no 00:60
  assert.equal(clockLabel(1_000), '00:01')
  assert.equal(clockLabel(0), '00:00')
})
