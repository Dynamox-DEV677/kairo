/**
 * The username is the only identity another student ever sees, so its rules
 * are pinned: what is refused, what generated handles look like, and that the
 * SQL backfill uses the very same word lists as the app.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  USERNAME_RE, ADJECTIVES, NOUNS, TILE_HUES, validateUsername, generateUsername, fallbackHandle, tileHue, tileLetter,
} from '../../src/lib/username.core.js'

const SQL = readFileSync(join(import.meta.dirname, '..', 'db', '2026-09-04_social.sql'), 'utf-8')

test('a username is lowercase letters, digits and single underscores, 3-20 long, starting with a letter', () => {
  assert.deepEqual(validateUsername('  QuietStorm42 '), { ok: true, username: 'quietstorm42' })
  assert.equal(validateUsername('ab').ok, false)
  assert.equal(validateUsername('a'.repeat(21)).ok, false)
  assert.equal(validateUsername('42storm').ok, false)
  assert.equal(validateUsername('quiet storm').ok, false)
  assert.equal(validateUsername('quiet@storm').ok, false)
  assert.equal(validateUsername('quiet__storm').ok, false)
  assert.equal(validateUsername('quiet_storm').ok, true)
})

test('nothing that could be a phone number, a placeholder, a staff role or a slur', () => {
  assert.match(validateUsername('rahul9876543210').reason, /phone/)
  assert.match(validateUsername('student_ab12cd').reason, /placeholder/)
  assert.equal(validateUsername('admin').ok, false)
  assert.equal(validateUsername('kyno').ok, false)
  assert.equal(validateUsername('teacher').ok, false)
  assert.equal(validateUsername('f_u_c_k99').ok, false, 'underscores and digits do not hide a blocked word')
})

test('generated handles are adjective + noun + two digits and always pass validation', () => {
  let seed = 12345
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
  const seen = new Set()
  for (let i = 0; i < 2000; i++) {
    const u = generateUsername(rand)
    assert.match(u, USERNAME_RE)
    assert.equal(validateUsername(u).ok, true, u)
    assert.ok(/\d\d$/.test(u))
    seen.add(u)
  }
  assert.ok(seen.size > 1500, 'the space is large enough that collisions are rare')
  for (const w of [...ADJECTIVES, ...NOUNS]) assert.match(w, /^[a-z]{3,8}$/)
})

test('the placeholder handle is deterministic per account, valid in shape, and cannot be chosen', () => {
  const a = fallbackHandle('8d4c2e6a-1111-4222-8333-944455556666')
  assert.equal(a, fallbackHandle('8d4c2e6a-1111-4222-8333-944455556666'))
  assert.match(a, USERNAME_RE)
  assert.match(a, /^student_[0-9a-f]{6}$/)
  assert.notEqual(a, fallbackHandle('8d4c2e6a-1111-4222-8333-944455556666', 1), 'a salt gives a different placeholder')
  assert.equal(validateUsername(a).ok, false)
})

test('letter tiles come from the username alone', () => {
  assert.equal(tileLetter('quietstorm42'), 'Q')
  assert.equal(tileHue('quietstorm42'), tileHue('QuietStorm42'))
  assert.ok(TILE_HUES.includes(tileHue('anything')))
})

test('the SQL backfill uses exactly the same word lists and the same shape rule', () => {
  const grab = name => {
    const m = SQL.match(new RegExp(`${name}\\s+text\\[\\]\\s*:=\\s*array\\[([^\\]]+)\\]`))
    assert.ok(m, `${name} array present in the migration`)
    return m[1].split(',').map(s => s.trim().replace(/^'|'$/g, ''))
  }
  assert.deepEqual(grab('adjs'), ADJECTIVES)
  assert.deepEqual(grab('nouns'), NOUNS)
  assert.ok(SQL.includes(`'${USERNAME_RE.source}'`), 'the check constraint is the same regex the app uses')
  assert.match(SQL, /drop column if exists name/, 'real names leave league_scores for good')
})
