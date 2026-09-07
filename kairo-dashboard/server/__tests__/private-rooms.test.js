/**
 * Private study rooms: a code, never a directory.
 *
 * Two students who already know each other needed a way to land in the same
 * room on purpose. The obvious way -- look your friend up by username -- is
 * the one thing this app must never ship, because a directory a friend can
 * search is a directory a stranger can search, and the users are children.
 *
 * The last test in this file is the one that matters: it fails if anything
 * resembling a person-lookup appears anywhere in the room code.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  makeRoomCode, normalizeCode, isValidCodeShape, codeExpired,
  channelForCode, minutesLeft, CODE_LENGTH, CODE_TTL_MS,
} from '../../src/lib/roomCode.core.js'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf-8')

test('a code is short, unambiguous, and never uses a confusable character', () => {
  for (let i = 0; i < 4000; i++) {
    const c = makeRoomCode()
    assert.equal(c.length, CODE_LENGTH)
    assert.ok(isValidCodeShape(c), c + ' is malformed')
    // read aloud across a room, or squinted at in a screenshot
    assert.doesNotMatch(c, /[O0I1L]/, c + ' contains a confusable character')
  }
})

test('what a student actually types still works', () => {
  assert.equal(normalizeCode(' a b2 c 9 '), 'AB2C9')
  assert.equal(normalizeCode('abc23' + String.fromCharCode(10)), 'ABC23')
  assert.equal(normalizeCode('ABC23XXXX'), 'ABC23', 'never longer than a code')
  assert.equal(normalizeCode(null), '')
})

test('a code containing a letter the alphabet never makes is rejected, not trimmed', () => {
  // silently deleting the O would make a four-character code and a
  // confusing error; better to say the code is wrong
  assert.equal(normalizeCode('OK2X9'), 'OK2X9')
  assert.equal(isValidCodeShape('OK2X9'), false)
  assert.equal(isValidCodeShape('AB2C'), false, 'too short')
  assert.equal(isValidCodeShape(''), false)
})

test('a code dies after the window, and a missing timestamp is dead', () => {
  const now = Date.now()
  assert.equal(codeExpired(now - 1000, now), false)
  assert.equal(codeExpired(now - CODE_TTL_MS + 60000, now), false)
  assert.equal(codeExpired(now - CODE_TTL_MS - 1, now), true)
  // an unknown room is an expired room, never an open one
  assert.equal(codeExpired(0, now), true)
  assert.equal(codeExpired(undefined, now), true)
  assert.equal(minutesLeft(now - CODE_TTL_MS, now), 0)
})

test('a channel name reveals a code, never a person', () => {
  assert.equal(channelForCode('AB2C9'), 'kyno-priv-AB2C9')
  assert.doesNotMatch(channelForCode('AB2C9'), /user|name|student|id/i)
})

test('a wrong code, an expired code and an emptied room give the SAME answer', () => {
  const rooms = read('src', 'lib', 'rooms.ts')
  const fn = rooms.slice(rooms.indexOf('export async function joinPrivateRoom'))
  const msg = /This code isn't active right now/g
  // three separate reasons, one message: telling them apart would leak
  // whether a code was ever real
  assert.ok((fn.match(msg) || []).length >= 3, 'each dead-end path says the same thing')
  assert.doesNotMatch(fn, /did you mean|similar|closest/i, 'a code is exact or it is nothing')
})

test('a private room keeps every property a topic room has', () => {
  const rooms = read('src', 'lib', 'rooms.ts')
  const fn = rooms.slice(rooms.indexOf('export async function joinPrivateRoom'))
  assert.match(fn, /present >= ROOM_MAX/, 'the same twelve-person cap')
  const progress = read('src', 'pages', 'Progress.tsx')
  assert.match(progress, /there is no chat/, 'the no-chat promise stays on screen')
  // presence carries a subject and nothing else that identifies anybody
  assert.match(rooms, /username: arr\[0\]\?\.username \|\| 'student'/)
})

test('a private room is not announced anywhere public', () => {
  const rooms = read('src', 'lib', 'rooms.ts')
  const fn = rooms.slice(rooms.indexOf('export async function createPrivateRoom'), rooms.indexOf('export async function joinPrivateRoom'))
  assert.doesNotMatch(fn, /LOBBY/, 'the lobby counter would start to undo the privacy')
})

test('NOTHING here can look up a person', () => {
  const rooms = read('src', 'lib', 'rooms.ts')
  const core = read('src', 'lib', 'roomCode.core.js')
  const progress = read('src', 'pages', 'Progress.tsx')

  // the shapes a directory takes, in code
  const banned = [
    /listUsers|searchUsers|findUser|lookupUser|userSearch/i,
    /recent(Study)?Partners|friendList|friends\b/i,
    /by[_-]?username|username=|searchByName/i,
    /from\('social_profiles'\)[^]{0,200}(ilike|like|textSearch)/i,
  ]
  for (const [name, src] of [['rooms.ts', rooms], ['roomCode.core.js', core]]) {
    for (const re of banned) {
      assert.doesNotMatch(src, re, name + ' looks like it can find a person: ' + re)
    }
  }

  // and the room UI offers no field that takes a name
  const room = progress.slice(progress.indexOf('function RoomScreen'))
  assert.doesNotMatch(room, /placeholder="[^"]*(name|user|friend)[^"]*"/i,
    'the only text input in this flow is the code field')
  assert.match(room, /aria-label="Room code"/, 'and that field asks for a code')
})
